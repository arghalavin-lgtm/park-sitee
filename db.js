'use strict';
/* ===================================================================
   لایه‌ی دیتابیس SQLite
   - منبع اصلی داده‌ها: فایل data/park.sqlite
   - فایل js/data.js پس از هر ذخیره از روی دیتابیس بازسازی می‌شود تا
     صفحات عمومی سایت (که فقط data.js را می‌خوانند) مثل قبل کار کنند.
   - درایور: ابتدا node:sqlite (داخلی Node 22.5+) و در صورت نبودن
     better-sqlite3 (با npm install).
=================================================================== */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
const DB_DIR = path.join(ROOT, 'data');
const DB_FILE = process.env.PARK_DB || path.join(DB_DIR, 'park.sqlite');
const DATA_JS = path.join(ROOT, 'js', 'data.js');

/* ----------------------------- درایور ----------------------------- */
function openDriver(file){
  fs.mkdirSync(path.dirname(file), { recursive: true });

  // 1) node:sqlite — هشدار «Experimental» را بی‌صدا می‌کنیم
  const origEmit = process.emitWarning;
  try{
    process.emitWarning = function(w, ...rest){
      const msg = typeof w === 'string' ? w : (w && w.message) || '';
      if(/sqlite/i.test(msg)) return;
      return origEmit.call(process, w, ...rest);
    };
    const { DatabaseSync } = require('node:sqlite');
    const db = new DatabaseSync(file);
    return { name: 'node:sqlite', db };
  }catch(e){
    /* ادامه با better-sqlite3 */
  }finally{
    process.emitWarning = origEmit;
  }

  // 2) better-sqlite3
  try{
    const Database = require('better-sqlite3');
    return { name: 'better-sqlite3', db: new Database(file) };
  }catch(e){
    const err = new Error(
      'هیچ درایور SQLite پیدا نشد.\n' +
      '  • اگر Node.js نسخه‌ی 22.5 یا بالاتر دارید، همان کافی است (نسخه‌ی شما: ' + process.version + ').\n' +
      '  • در غیر این صورت در پوشه‌ی پروژه این دستور را بزنید:  npm install'
    );
    err.cause = e;
    throw err;
  }
}

const drv = openDriver(DB_FILE);
const raw = drv.db;
const DRIVER = drv.name;

const run  = (sql, ...p) => raw.prepare(sql).run(...p);
const get  = (sql, ...p) => raw.prepare(sql).get(...p);
const all  = (sql, ...p) => raw.prepare(sql).all(...p);

let txDepth = 0;
function tx(fn){
  if(txDepth > 0) return fn();
  raw.exec('BEGIN IMMEDIATE');
  txDepth++;
  try{
    const out = fn();
    raw.exec('COMMIT');
    return out;
  }catch(e){
    try{ raw.exec('ROLLBACK'); }catch(_){}
    throw e;
  }finally{
    txDepth--;
  }
}

raw.exec('PRAGMA journal_mode = WAL');
raw.exec('PRAGMA foreign_keys = ON');
raw.exec('PRAGMA synchronous = NORMAL');

/* ----------------------------- ساختار جدول‌ها ----------------------------- */
raw.exec(`
CREATE TABLE IF NOT EXISTS meta(
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS site(
  key      TEXT PRIMARY KEY,
  value    TEXT NOT NULL,            -- JSON
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menu(
  id       TEXT PRIMARY KEY,
  label    TEXT,
  label_fa TEXT,
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stages(
  idx  INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS teams(
  id       TEXT PRIMARY KEY,
  title    TEXT,
  title_fa TEXT,
  subtitle TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  extra    TEXT
);

CREATE TABLE IF NOT EXISTS team_stats(
  team_id  TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  label    TEXT,
  value    TEXT,
  PRIMARY KEY(team_id, position)
);

CREATE TABLE IF NOT EXISTS team_tools(
  team_id    TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  group_name TEXT,
  items      TEXT NOT NULL,          -- JSON array
  PRIMARY KEY(team_id, position)
);

CREATE TABLE IF NOT EXISTS people(
  id          TEXT PRIMARY KEY,
  team_id     TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'person',
  name        TEXT NOT NULL,
  photo       TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 0,
  pi_start    TEXT,
  pi_end      TEXT,
  pi_progress REAL,
  pi_days     REAL,
  pi_hours    REAL,
  extra       TEXT
);
CREATE INDEX IF NOT EXISTS idx_people_team ON people(team_id, position);

CREATE TABLE IF NOT EXISTS person_tags(
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  label     TEXT,
  value     TEXT,
  PRIMARY KEY(person_id, position)
);

CREATE TABLE IF NOT EXISTS person_samples(
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  position  INTEGER NOT NULL,
  title     TEXT,
  image     TEXT,
  video     TEXT,
  link      TEXT,
  extra     TEXT,
  PRIMARY KEY(person_id, position)
);

CREATE TABLE IF NOT EXISTS projects(
  id           TEXT PRIMARY KEY,
  person_id    TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  title        TEXT,
  stage        INTEGER NOT NULL DEFAULT 0,
  progress     REAL,
  note         TEXT,
  updated_at   TEXT,
  start_date   TEXT,
  end_date     TEXT,
  days_worked  REAL,
  hours_worked REAL,
  extra        TEXT
);
CREATE INDEX IF NOT EXISTS idx_projects_person ON projects(person_id);

CREATE TABLE IF NOT EXISTS project_history(
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL,
  month      TEXT,
  stage      INTEGER,
  PRIMARY KEY(project_id, position)
);
`);

/* ----------------------------- کمکی‌ها ----------------------------- */
const nn = v => (v === undefined ? null : v);                 // undefined → null
const jstr = o => (o && Object.keys(o).length ? JSON.stringify(o) : null);
const jparse = s => { try{ return s ? JSON.parse(s) : {}; }catch(e){ return {}; } };
const numOrNull = v => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const strOrNull = v => (v === undefined || v === null ? null : String(v));
function pick(obj, known){
  const extra = {};
  Object.keys(obj || {}).forEach(k => { if(!known.includes(k)) extra[k] = obj[k]; });
  return extra;
}
function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
function maxStage(){
  const r = get('SELECT COUNT(*) AS n FROM stages');
  return Math.max(0, (r ? r.n : 0) - 1) || 4;
}

/* ----------------------------- خواندن: ساخت SITE_DATA ----------------------------- */
function loadData(){
  const site = {};
  all('SELECT key, value FROM site ORDER BY position').forEach(r => { site[r.key] = jparse2(r.value); });

  const menu = all('SELECT id, label, label_fa FROM menu ORDER BY position')
    .map(r => ({ id: r.id, label: r.label, labelFa: r.label_fa }));
  const stages = all('SELECT name FROM stages ORDER BY idx').map(r => r.name);

  const stats = group(all('SELECT team_id, label, value FROM team_stats ORDER BY team_id, position'), 'team_id',
    r => ({ label: r.label, value: r.value }));
  const tools = group(all('SELECT team_id, group_name, items FROM team_tools ORDER BY team_id, position'), 'team_id',
    r => ({ group: r.group_name, items: jparse2(r.items) || [] }));
  const peopleRows = all('SELECT * FROM people ORDER BY team_id, position, rowid');
  const members = group(peopleRows, 'team_id', r => r.id);

  const teams = {};
  all('SELECT * FROM teams ORDER BY position, rowid').forEach(r => {
    const t = { id: r.id, title: r.title, titleFa: r.title_fa, subtitle: r.subtitle,
      stats: stats[r.id] || [], members: members[r.id] || [] };
    if(tools[r.id] && tools[r.id].length) t.tools = tools[r.id];
    Object.assign(t, jparse(r.extra));
    teams[r.id] = t;
  });

  const tags = group(all('SELECT person_id, label, value FROM person_tags ORDER BY person_id, position'), 'person_id',
    r => ({ label: r.label, value: r.value }));
  const samples = group(all('SELECT * FROM person_samples ORDER BY person_id, position'), 'person_id', r => {
    const s = { title: r.title };
    if(r.image != null) s.image = r.image;
    if(r.video != null) s.video = r.video;
    if(r.link  != null) s.link  = r.link;
    return Object.assign(s, jparse(r.extra));
  });

  const people = {};
  const order = [];
  peopleRows.forEach(r => {
    const p = { id: r.id, team: r.team_id, type: r.type, name: r.name, photo: r.photo,
      tags: tags[r.id] || [], samples: samples[r.id] || [] };
    const pi = {};
    if(r.pi_start    != null) pi.start       = r.pi_start;
    if(r.pi_end      != null) pi.end         = r.pi_end;
    if(r.pi_progress != null) pi.progress    = r.pi_progress;
    if(r.pi_days     != null) pi.daysWorked  = r.pi_days;
    if(r.pi_hours    != null) pi.hoursWorked = r.pi_hours;
    if(Object.keys(pi).length) p.projectInfo = pi;
    Object.assign(p, jparse(r.extra));
    people[r.id] = p;
    order.push(r.id);
  });

  const hist = group(all('SELECT project_id, month, stage FROM project_history ORDER BY project_id, position'), 'project_id',
    r => ({ month: r.month, stage: r.stage }));
  const projects = {};
  all('SELECT * FROM projects ORDER BY rowid').forEach(r => {
    const p = { id: r.id, personId: r.person_id, title: r.title, stage: r.stage };
    if(r.progress     != null) p.progress     = r.progress;
    if(r.note         != null) p.note         = r.note;
    if(r.updated_at   != null) p.updatedAt    = r.updated_at;
    if(r.start_date   != null) p.start        = r.start_date;
    if(r.end_date     != null) p.end          = r.end_date;
    if(r.days_worked  != null) p.daysWorked   = r.days_worked;
    if(r.hours_worked != null) p.hoursWorked  = r.hours_worked;
    p.history = hist[r.id] || [];
    Object.assign(p, jparse(r.extra));
    projects[r.id] = p;
  });

  return { site, menu, teams, people, stages, projects };
}
function jparse2(s){ try{ return JSON.parse(s); }catch(e){ return s; } }
function group(rows, key, map){
  const out = {};
  rows.forEach(r => { (out[r[key]] = out[r[key]] || []).push(map(r)); });
  return out;
}

/* ----------------------------- نوشتن: بخش‌های ساده ----------------------------- */
function setSite(site){
  tx(() => {
    run('DELETE FROM site');
    Object.keys(site || {}).forEach((k, i) =>
      run('INSERT INTO site(key,value,position) VALUES(?,?,?)', k, JSON.stringify(site[k]), i));
  });
}
function setMenu(menu){
  tx(() => {
    run('DELETE FROM menu');
    (menu || []).forEach((m, i) =>
      run('INSERT INTO menu(id,label,label_fa,position) VALUES(?,?,?,?)', String(m.id), strOrNull(m.label), strOrNull(m.labelFa), i));
  });
}
function setStages(stages){
  tx(() => {
    run('DELETE FROM stages');
    (stages || []).forEach((s, i) => run('INSERT INTO stages(idx,name) VALUES(?,?)', i, String(s)));
  });
}

/* ----------------------------- حوزه‌ها ----------------------------- */
function writeTeam(t, position){
  const extra = pick(t, ['id','title','titleFa','subtitle','stats','members','tools']);
  const exists = get('SELECT 1 AS x FROM teams WHERE id=?', t.id);
  if(exists){
    run('UPDATE teams SET title=?, title_fa=?, subtitle=?, extra=? WHERE id=?',
      strOrNull(t.title), strOrNull(t.titleFa), strOrNull(t.subtitle), jstr(extra), t.id);
    if(position !== undefined) run('UPDATE teams SET position=? WHERE id=?', position, t.id);
  }else{
    run('INSERT INTO teams(id,title,title_fa,subtitle,position,extra) VALUES(?,?,?,?,?,?)',
      t.id, strOrNull(t.title), strOrNull(t.titleFa), strOrNull(t.subtitle), position || 0, jstr(extra));
  }
  if(Array.isArray(t.stats)){
    run('DELETE FROM team_stats WHERE team_id=?', t.id);
    t.stats.forEach((s, i) => run('INSERT INTO team_stats(team_id,position,label,value) VALUES(?,?,?,?)',
      t.id, i, strOrNull(s.label), strOrNull(s.value)));
  }
  if(Array.isArray(t.tools)){
    run('DELETE FROM team_tools WHERE team_id=?', t.id);
    t.tools.forEach((g, i) => run('INSERT INTO team_tools(team_id,position,group_name,items) VALUES(?,?,?,?)',
      t.id, i, strOrNull(g.group), JSON.stringify(Array.isArray(g.items) ? g.items : [])));
  }
}
/* ذخیره‌ی حوزه‌ها: فهرست اعضا از جدول people می‌آید، نه از این ورودی */
function setTeams(teams){
  tx(() => {
    Object.keys(teams || {}).forEach((id, i) => {
      const t = Object.assign({}, teams[id], { id });
      writeTeam(t, i);
    });
  });
}

/* ----------------------------- افراد ----------------------------- */
function writePersonChildren(p){
  run('DELETE FROM person_tags WHERE person_id=?', p.id);
  (p.tags || []).forEach((t, i) => run('INSERT INTO person_tags(person_id,position,label,value) VALUES(?,?,?,?)',
    p.id, i, strOrNull(t.label), strOrNull(t.value)));
  run('DELETE FROM person_samples WHERE person_id=?', p.id);
  (p.samples || []).forEach((s, i) => run(
    'INSERT INTO person_samples(person_id,position,title,image,video,link,extra) VALUES(?,?,?,?,?,?,?)',
    p.id, i, strOrNull(s.title), strOrNull(s.image), strOrNull(s.video), strOrNull(s.link),
    jstr(pick(s, ['title','image','video','link']))));
}
function nextPosition(teamId){
  return get('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM people WHERE team_id=?', teamId).n;
}
function upsertPerson(p){
  return tx(() => {
    const extra = jstr(pick(p, ['id','name','type','team','photo','tags','samples','projectInfo']));
    const old = get('SELECT team_id, position FROM people WHERE id=?', p.id);
    const pi = p.projectInfo;
    if(old){
      const pos = old.team_id === p.team ? old.position : nextPosition(p.team);
      run('UPDATE people SET team_id=?, type=?, name=?, photo=?, position=?, extra=? WHERE id=?',
        p.team, p.type, p.name, p.photo || '', pos, extra, p.id);
      if(pi){ // اگر ورودی projectInfo داشت جایگزین می‌شود؛ وگرنه مقدار قبلی دست‌نخورده می‌ماند
        run('UPDATE people SET pi_start=?, pi_end=?, pi_progress=?, pi_days=?, pi_hours=? WHERE id=?',
          strOrNull(pi.start), strOrNull(pi.end), numOrNull(pi.progress), numOrNull(pi.daysWorked), numOrNull(pi.hoursWorked), p.id);
      }
    }else{
      run(`INSERT INTO people(id,team_id,type,name,photo,position,pi_start,pi_end,pi_progress,pi_days,pi_hours,extra)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`,
        p.id, p.team, p.type, p.name, p.photo || '', nextPosition(p.team),
        strOrNull(pi && pi.start), strOrNull(pi && pi.end), numOrNull(pi && pi.progress),
        numOrNull(pi && pi.daysWorked), numOrNull(pi && pi.hoursWorked), extra);
    }
    writePersonChildren(p);
    // هر فرد یک پروژه‌ی پیش‌فرض دارد
    const pid = 'proj_' + p.id;
    if(!get('SELECT 1 AS x FROM projects WHERE id=?', pid)){
      run('INSERT INTO projects(id,person_id,title,stage,progress) VALUES(?,?,?,?,?)', pid, p.id, 'پروژه در دست انجام', 0, 0);
    }
  });
}
function deletePerson(id){
  return tx(() => {
    const r = run('DELETE FROM people WHERE id=?', id); // پروژه‌ها، تگ‌ها و نمونه‌کارها با CASCADE پاک می‌شوند
    return r.changes > 0;
  });
}
function personExists(id){ return !!get('SELECT 1 AS x FROM people WHERE id=?', id); }

/* ----------------------------- پروژه‌ها ----------------------------- */
/* opts.fromImport: مقدار درصد همان‌طور که در فایل بوده ذخیره می‌شود و projectInfo فرد تغییر نمی‌کند */
function upsertProject(b, opts = {}){
  return tx(() => {
    const stage = clamp(Number(b.stage) || 0, 0, maxStage());
    const hasProgress = b.progress !== undefined && b.progress !== null;
    const progress = hasProgress ? clamp(Number(b.progress) || 0, 0, 100)
      : (opts.fromImport ? null : clamp(stage * 25, 0, 100));
    const extra = jstr(pick(b, ['id','personId','title','stage','progress','note','updatedAt','start','end','daysWorked','hoursWorked','history']));
    const exists = get('SELECT 1 AS x FROM projects WHERE id=?', b.id);
    const vals = [b.personId, strOrNull(b.title), stage, progress, strOrNull(b.note), strOrNull(b.updatedAt),
      strOrNull(b.start), strOrNull(b.end), numOrNull(b.daysWorked), numOrNull(b.hoursWorked), extra];
    if(exists){
      run(`UPDATE projects SET person_id=?, title=?, stage=?, progress=?, note=?, updated_at=?,
           start_date=?, end_date=?, days_worked=?, hours_worked=?, extra=? WHERE id=?`, ...vals, b.id);
    }else{
      run(`INSERT INTO projects(person_id,title,stage,progress,note,updated_at,start_date,end_date,days_worked,hours_worked,extra,id)
           VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`, ...vals, b.id);
    }
    run('DELETE FROM project_history WHERE project_id=?', b.id);
    (Array.isArray(b.history) ? b.history : []).forEach((h, i) =>
      run('INSERT INTO project_history(project_id,position,month,stage) VALUES(?,?,?,?)',
        b.id, i, strOrNull(h.month), numOrNull(h.stage)));

    if(opts.fromImport) return;
    // همگام‌سازی با projectInfo فرد، تا نمودارهای سایت با پنل یکی باشند
    run('UPDATE people SET pi_progress=? WHERE id=?', progress, b.personId);
    if(b.start       !== undefined) run('UPDATE people SET pi_start=? WHERE id=?', String(b.start), b.personId);
    if(b.end         !== undefined) run('UPDATE people SET pi_end=? WHERE id=?', String(b.end), b.personId);
    if(b.daysWorked  !== undefined) run('UPDATE people SET pi_days=? WHERE id=?', Number(b.daysWorked) || 0, b.personId);
    if(b.hoursWorked !== undefined) run('UPDATE people SET pi_hours=? WHERE id=?', Number(b.hoursWorked) || 0, b.personId);
  });
}
function deleteProject(id){
  return tx(() => run('DELETE FROM projects WHERE id=?', id).changes > 0);
}

/* ----------------------------- وارد کردن کل داده (از data.js) ----------------------------- */
function replaceAll(data){
  tx(() => {
    ['project_history','projects','person_samples','person_tags','people','team_tools','team_stats','teams','stages','menu','site']
      .forEach(t => run('DELETE FROM ' + t));
    setSite(data.site);
    setMenu(data.menu);
    setStages(data.stages);
    Object.keys(data.teams || {}).forEach((id, i) => writeTeam(Object.assign({}, data.teams[id], { id }), i));

    // ترتیب افراد در هر حوزه همان ترتیب آرایه‌ی members است
    const placed = new Set();
    Object.keys(data.teams || {}).forEach(tid => {
      (data.teams[tid].members || []).forEach(pid => {
        const p = data.people[pid];
        if(!p || placed.has(pid)) return;
        placed.add(pid);
        upsertPerson(normPerson(p, pid, tid));
      });
    });
    Object.keys(data.people || {}).forEach(pid => {           // افرادی که در هیچ members نیستند
      if(placed.has(pid)) return;
      const p = data.people[pid];
      upsertPerson(normPerson(p, pid, p.team || Object.keys(data.teams || {})[0] || 'game'));
    });

    Object.keys(data.projects || {}).forEach(k => {
      const pr = data.projects[k];
      if(!personExists(pr.personId)) return;                   // پروژه‌ی بی‌صاحب وارد نمی‌شود
      upsertProject(Object.assign({}, pr, { id: k }), { fromImport: true });
    });
  });
  setMeta('imported_at', new Date().toISOString());
}
function normPerson(p, id, team){
  return Object.assign({}, p, { id, team: p.team || team, type: p.type || 'person', name: p.name || id,
    tags: Array.isArray(p.tags) ? p.tags : [], samples: Array.isArray(p.samples) ? p.samples : [] });
}
/* ----------------------------- متا ----------------------------- */
function getMeta(k){ const r = get('SELECT value FROM meta WHERE key=?', k); return r ? r.value : null; }
function setMeta(k, v){ run('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', k, String(v)); }
function isEmpty(){ return get('SELECT COUNT(*) AS n FROM teams').n === 0 && get('SELECT COUNT(*) AS n FROM people').n === 0; }

/* ----------------------------- js/data.js ----------------------------- */
function readDataJs(file = DATA_JS){
  const code = fs.readFileSync(file, 'utf8') + '\nSITE_DATA;';
  return vm.runInNewContext(code, {});
}
function exportDataJs(file = DATA_JS){
  if(isEmpty()) throw new Error('دیتابیس خالی است؛ برای جلوگیری از پاک شدن js/data.js خروجی گرفته نشد.');
  const header = '/* Generated from the SQLite database (data/park.sqlite). Edit through /admin. */\nconst SITE_DATA = ';
  const text = header + JSON.stringify(loadData(), null, 2) + ';\n';
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, text, 'utf8');       // اول فایل موقت، بعد جایگزینی — نیمه‌کاره نمی‌ماند
  fs.renameSync(tmp, file);
}
/* اولین اجرا: اگر دیتابیس خالی بود، از js/data.js وارد می‌کند */
function initFromDataJsIfEmpty(){
  if(!isEmpty()) return false;
  if(!fs.existsSync(DATA_JS)) return false;
  replaceAll(readDataJs());
  return true;
}
/* نسخه‌ی پشتیبان یکدست از دیتابیس (در حین کار هم امن است) */
function backupTo(file){
  fs.rmSync(file, { force: true });
  raw.exec("VACUUM INTO '" + file.replace(/'/g, "''") + "'");
}
function close(){ try{ raw.exec('PRAGMA wal_checkpoint(TRUNCATE)'); raw.close(); }catch(e){} }

/* ----------------------------- حساب‌های کاربری (اعضا و سرگروه‌ها) ----------------------------- */
/* هر حساب به یک فرد/شرکت (people.id) وصل است. نقش‌ها: member | lead
   عمداً کلید خارجی ندارد تا db:import (که people را پاک و دوباره می‌سازد) حساب‌ها را حذف نکند. */
raw.exec(`
CREATE TABLE IF NOT EXISTS users(
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  username   TEXT NOT NULL UNIQUE COLLATE NOCASE,
  pass_hash  TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member',
  person_id  TEXT NOT NULL,
  must_change INTEGER NOT NULL DEFAULT 1,
  disabled   INTEGER NOT NULL DEFAULT 0,
  created_at TEXT,
  last_login TEXT
);
`);
const userRow = r => r && ({ id: r.id, username: r.username, passHash: r.pass_hash, role: r.role,
  personId: r.person_id, mustChange: !!r.must_change, disabled: !!r.disabled, createdAt: r.created_at, lastLogin: r.last_login });
function getUserByName(name){ return userRow(get('SELECT * FROM users WHERE username=?', String(name || ''))); }
function getUserById(id){ return userRow(get('SELECT * FROM users WHERE id=?', Number(id))); }
function listUsers(){ return all('SELECT * FROM users ORDER BY id').map(userRow); }
function createUser(u){
  const r = run('INSERT INTO users(username,pass_hash,role,person_id,must_change,created_at) VALUES(?,?,?,?,?,?)',
    u.username, u.passHash, u.role === 'lead' ? 'lead' : 'member', String(u.personId), u.mustChange === false ? 0 : 1, new Date().toISOString());
  return Number(r.lastInsertRowid);
}
function updateUser(id, f){
  const cur = getUserById(id); if(!cur) return false;
  run('UPDATE users SET role=?, person_id=?, disabled=?, pass_hash=?, must_change=? WHERE id=?',
    f.role ? (f.role === 'lead' ? 'lead' : 'member') : cur.role,
    f.personId != null ? String(f.personId) : cur.personId,
    f.disabled != null ? (f.disabled ? 1 : 0) : (cur.disabled ? 1 : 0),
    f.passHash || cur.passHash,
    f.mustChange != null ? (f.mustChange ? 1 : 0) : (cur.mustChange ? 1 : 0), Number(id));
  return true;
}
function deleteUser(id){ return run('DELETE FROM users WHERE id=?', Number(id)).changes > 0; }
function deleteUsersOfPerson(personId){ return run('DELETE FROM users WHERE person_id=?', String(personId)).changes; }
function touchLogin(id){ run('UPDATE users SET last_login=? WHERE id=?', new Date().toISOString(), Number(id)); }
function getPerson(id){ const d = loadData(); return d.people[id] || null; }
function projectsOfPerson(personId){ const d = loadData(); return Object.values(d.projects).filter(p => p.personId === personId); }
function getProject(id){ return loadData().projects[id] || null; }

module.exports = {
  DRIVER, DB_FILE, DATA_JS,
  loadData, setSite, setTeams, setMenu, setStages,
  upsertPerson, deletePerson, personExists, upsertProject, deleteProject,
  replaceAll, isEmpty,
  getUserByName, getUserById, listUsers, createUser, updateUser, deleteUser, deleteUsersOfPerson, touchLogin,
  getPerson, projectsOfPerson, getProject, initFromDataJsIfEmpty, readDataJs, exportDataJs, backupTo, close, getMeta, setMeta
};
