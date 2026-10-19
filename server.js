const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8000);
const ADMIN_CONFIG_FILE = path.join(ROOT, 'admin-config.json');
const DEFAULT_ADMIN_USER = 'admin';
const DEFAULT_ADMIN_PASSWORD_HASH = crypto.createHash('sha256').update('admin1234', 'utf8').digest('hex');
const UPLOAD_DIR = path.join(ROOT, 'assets', 'uploads');
const UPLOAD_MAX = 4 * 1024 * 1024;           // حداکثر حجم هر عکس: ۴ مگابایت
const SECURE_COOKIE = process.env.COOKIE_SECURE === '1'; // پشت HTTPS مقدار 1 بگذارید

function loadAdminConfig(){
  try{
    const cfg = JSON.parse(fs.readFileSync(ADMIN_CONFIG_FILE, 'utf8'));
    return {
      username: String(cfg.username || DEFAULT_ADMIN_USER),
      passwordHash: String(cfg.passwordHash || DEFAULT_ADMIN_PASSWORD_HASH).toLowerCase()
    };
  }catch(e){
    return {username: DEFAULT_ADMIN_USER, passwordHash: DEFAULT_ADMIN_PASSWORD_HASH};
  }
}

const ADMIN = loadAdminConfig();
const sessions = new Map();           // sid -> {created, role, userId, username}
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/* ---------------------------- رمز عبور ---------------------------- */
function passwordMatches(password){                      // رمز ادمین اصلی (SHA-256 در admin-config.json)
  const actual = crypto.createHash('sha256').update(String(password ?? ''), 'utf8').digest('hex');
  const a=Buffer.from(actual,'hex'), b=Buffer.from(ADMIN.passwordHash,'hex');
  return a.length===b.length && crypto.timingSafeEqual(a,b);
}
function hashPassword(pw){                               // رمز اعضا: scrypt + salt تصادفی
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(String(pw), salt, 64);
  return 'scrypt$' + salt.toString('hex') + '$' + h.toString('hex');
}
const DUMMY_HASH = hashPassword('dummy-password-for-timing');
function verifyPassword(pw, stored){
  try{
    const [tag, saltHex, hashHex] = String(stored).split('$');
    if(tag !== 'scrypt') return false;
    const expect = Buffer.from(hashHex, 'hex');
    const got = crypto.scryptSync(String(pw ?? ''), Buffer.from(saltHex, 'hex'), expect.length);
    return crypto.timingSafeEqual(got, expect);
  }catch(e){ return false; }
}
const PW_ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function randomPassword(n=10){ let s=''; for(let i=0;i<n;i++) s += PW_ALPHABET[crypto.randomInt(PW_ALPHABET.length)]; return s; }

/* ---------------------------- محدودیت تلاش ورود ---------------------------- */
const attempts = new Map();                              // key -> {n, first}
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const MAX_FAILS_USER = 8;                               // برای هر جفت «IP + نام کاربری»
const MAX_FAILS_IP = 60;                                // برای کل یک IP (سقف بالا تا یک شبکه‌ی مشترک قفل نشود)
const TRUST_PROXY = process.env.TRUST_PROXY === '1';    // فقط پشت پراکسی خودتان (nginx و ...) روشن کنید
function clientIp(req){
  if(TRUST_PROXY && req.headers['x-forwarded-for']) return String(req.headers['x-forwarded-for']).split(',').pop().trim();
  return String(req.socket.remoteAddress || '');
}
function isLocked(key, max){
  const a = attempts.get(key); if(!a) return false;
  if(Date.now() - a.first > FAIL_WINDOW_MS){ attempts.delete(key); return false; }
  return a.n >= max;
}
function noteFail(key){
  const a = attempts.get(key);
  if(!a || Date.now() - a.first > FAIL_WINDOW_MS) attempts.set(key, {n:1, first:Date.now()}); else a.n++;
}

/* ---------------------------- ابزارها ---------------------------- */
const SEC_HEADERS = {'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'same-origin'};
function publish(){ db.exportDataJs(); }
function send(res, status, body, type='application/json'){
  res.writeHead(status, {'Content-Type': type, 'Cache-Control':'no-store', ...SEC_HEADERS});
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}
function parseCookies(req){
  return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(x=>{
    const i=x.indexOf('='); return [x.slice(0,i).trim(), decodeURIComponent(x.slice(i+1))];
  }));
}
function cookieFlags(){ return 'HttpOnly; SameSite=Lax; Path=/' + (SECURE_COOKIE ? '; Secure' : ''); }
function getSession(req){
  const sid=parseCookies(req).sid;
  if(!sid) return null;
  const s=sessions.get(sid);
  if(!s) return null;
  if(Date.now()-s.created>SESSION_TTL_MS){ sessions.delete(sid); return null; }
  if(s.role !== 'admin'){                                // حساب حذف/غیرفعال شده باشد، سشن بی‌اعتبار است
    const u = db.getUserById(s.userId);
    if(!u || u.disabled){ sessions.delete(sid); return null; }
    s.role = u.role; s.username = u.username;
  }
  return s;
}
const isAdmin = req => { const s=getSession(req); return !!(s && s.role==='admin'); };
function body(req){ return new Promise((resolve,reject)=>{ let b=''; req.on('data',c=>{b+=c; if(b.length>5e6) req.destroy();}); req.on('end',()=>{try{resolve(b?JSON.parse(b):{});}catch(e){reject(e);}}); }); }
function rawBody(req, max){ return new Promise((resolve,reject)=>{
  const chunks=[]; let n=0, tooBig=false;
  req.on('data',c=>{
    n+=c.length;
    if(n>max*4){ req.destroy(); return; }               // سقف مطلق: قطع اتصال
    if(n>max){ tooBig=true; return; }                    // بقیه را دور می‌ریزیم تا بتوانیم پاسخ ۴۱۳ بدهیم
    chunks.push(c);
  });
  req.on('end',()=>tooBig ? reject(Object.assign(new Error('too large'),{code:413})) : resolve(Buffer.concat(chunks)));
  req.on('error',reject);
}); }
function safeId(s){ return String(s||'').trim().replace(/[^a-zA-Z0-9_-]/g,'_'); }

/* پاک‌سازی ورودی اعضا: نوشته‌ی اعضا در پنل ادمین و سایت نمایش داده می‌شود،
   پس نویسه‌هایی که می‌توانند HTML/اسکریپت بسازند حذف می‌شوند. */
function clean(v, max=200){ return String(v==null?'':v).replace(/[\u0000-\u001f\u007f<>"'`]/g,'').replace(/\s+/g,' ').trim().slice(0,max); }
function cleanLong(v, max=1000){ return String(v==null?'':v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>"'`]/g,'').trim().slice(0,max); }
function cleanUrl(v){
  const s = String(v==null?'':v).trim();
  if(!s) return '';
  if(/[\s"'<>`\\]/.test(s) || s.includes('..')) return '';
  if(/^https?:\/\/[^\s]+$/i.test(s) && s.length<=500) return s;
  if(/^assets\/[A-Za-z0-9_\-./]+$/.test(s) && s.length<=200) return s;
  return '';
}
function cleanNum(v, lo, hi){ if(v===''||v==null) return null; const n=Number(v); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : null; }

/* ---------------------------- فایل‌های استاتیک ---------------------------- */
/* فقط پوشه‌های عمومی و صفحات html ریشه سرو می‌شوند؛
   admin-config.json، server.js، db.js، پوشه‌ی data (دیتابیس) و ... هرگز. */
const PUBLIC_DIRS = new Set(['assets','css','js','admin','panel']);
function isPublicPath(rel){
  const parts = rel.split('/').filter(Boolean);
  if(!parts.length) return false;
  if(parts.some(p=>p.startsWith('.'))) return false;
  if(parts.length===1) return /\.html$/i.test(parts[0]);
  return PUBLIC_DIRS.has(parts[0]);
}
function serveStatic(req,res){
  let u = decodeURIComponent(req.url.split('?')[0]);
  if(u === '/') u='/index.html';
  if(u === '/admin' || u === '/admin/') u='/admin/index.html';
  if(u === '/panel' || u === '/panel/') u='/panel/index.html';
  const file = path.normalize(path.join(ROOT,u));
  if(!file.startsWith(ROOT + path.sep)) return send(res,403,{error:'forbidden'});
  const rel = path.relative(ROOT,file).split(path.sep).join('/');
  if(!isPublicPath(rel)) return send(res,404,{error:'not found'});
  fs.stat(file,(err,st)=>{
    if(err || !st.isFile()) return send(res,404,{error:'not found'});
    const ext=path.extname(file).toLowerCase();
    const types={'.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp','.gif':'image/gif','.mp4':'video/mp4'};
    res.writeHead(200,{'Content-Type':types[ext]||'application/octet-stream','Cache-Control':'no-store',...SEC_HEADERS}); fs.createReadStream(file).pipe(res);
  });
}

/* ---------------------------- آپلود عکس ---------------------------- */
function sniffImage(buf){
  if(buf.length>12 && buf[0]===0xFF && buf[1]===0xD8 && buf[2]===0xFF) return 'jpg';
  if(buf.length>12 && buf.slice(0,8).equals(Buffer.from([0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A]))) return 'png';
  if(buf.length>12 && buf.slice(0,4).toString('latin1')==='RIFF' && buf.slice(8,12).toString('latin1')==='WEBP') return 'webp';
  if(buf.length>12 && /^GIF8[79]a/.test(buf.slice(0,6).toString('latin1'))) return 'gif';
  return null;
}
const uploadLog = new Map();                             // key -> [timestamps]
function uploadAllowed(key){
  const now=Date.now(), arr=(uploadLog.get(key)||[]).filter(t=>now-t<3600e3);
  if(arr.length>=60){ uploadLog.set(key,arr); return false; }
  arr.push(now); uploadLog.set(key,arr); return true;
}

/* ---------------------------- دسترسی اعضا ---------------------------- */
function sameTeam(personId, otherId){
  const d = db.loadData();
  return d.people[personId] && d.people[otherId] && d.people[personId].team === d.people[otherId].team;
}
function canEditPerson(user, personId){
  if(!personId || !db.personExists(personId)) return false;
  if(user.personId === personId) return true;
  return user.role === 'lead' && sameTeam(user.personId, personId);
}
function sanitizePerson(existing, b){
  const tags = (Array.isArray(b.tags)?b.tags:[]).slice(0,12)
    .map(t=>({label:clean(t&&t.label,60), value:clean(t&&t.value,120)})).filter(t=>t.label);
  const samples = (Array.isArray(b.samples)?b.samples:[]).slice(0,30).map(s=>{
    const o = {title: clean(s&&s.title,120)};
    const image = cleanUrl(s&&s.image); if(image) o.image = image;
    const media = cleanUrl((s&&(s.video||s.link))||'');
    if(media){ if(/aparat|youtube|youtu\.be/i.test(media)) o.video = media; else o.link = media; }
    return o;
  }).filter(s=>s.title);
  return {
    id: existing.id, team: existing.team, type: existing.type,   // این‌ها را عضو نمی‌تواند عوض کند
    name: clean(b.name,80) || existing.name,
    photo: (b.photo===''||b.photo==null) ? '' : (cleanUrl(b.photo) || existing.photo || ''),
    tags, samples
  };
}

async function api(req,res){
  const p=req.url.split('?')[0];
  const qs=new URL(req.url,'http://x').searchParams;

  /* ----- ورود / خروج ----- */
  if(req.method==='POST' && p==='/api/login'){
    const b=await body(req);
    const username=String(b.username ?? '').trim();
    const key = clientIp(req)+'|'+username.toLowerCase();
    if(isLocked(key, MAX_FAILS_USER) || isLocked('ip:'+clientIp(req), MAX_FAILS_IP)) return send(res,429,{error:'تلاش‌های ناموفق زیاد بود. چند دقیقه بعد دوباره امتحان کنید.'});
    const start = (extra)=>{
      const sid=crypto.randomBytes(32).toString('hex');
      sessions.set(sid,{created:Date.now(),...extra});
      res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':`sid=${sid}; ${cookieFlags()}`,...SEC_HEADERS});
    };
    if(username===ADMIN.username && passwordMatches(b.password)){
      attempts.delete(key);
      start({role:'admin',username}); return res.end(JSON.stringify({ok:true,role:'admin'}));
    }
    const u = db.getUserByName(username);
    const ok = verifyPassword(b.password, u ? u.passHash : DUMMY_HASH) && !!u;
    if(ok && !u.disabled){
      attempts.delete(key); db.touchLogin(u.id);
      start({role:u.role,userId:u.id,username:u.username});
      return res.end(JSON.stringify({ok:true,role:u.role,mustChange:u.mustChange}));
    }
    noteFail(key); noteFail('ip:'+clientIp(req));
    if(ok && u.disabled) return send(res,403,{error:'این حساب غیرفعال شده است. با مدیر مرکز تماس بگیرید.'});
    return send(res,401,{error:'نام کاربری یا رمز عبور اشتباه است.'});
  }
  if(p==='/api/me'){
    const s=getSession(req);
    if(!s) return send(res,200,{authenticated:false});
    if(s.role==='admin') return send(res,200,{authenticated:true,role:'admin',username:s.username});
    const u=db.getUserById(s.userId);
    return send(res,200,{authenticated:true,role:u.role,username:u.username,personId:u.personId,mustChange:u.mustChange});
  }
  if(req.method==='POST' && p==='/api/logout'){
    const sid=parseCookies(req).sid; if(sid) sessions.delete(sid);
    res.writeHead(200,{'Content-Type':'application/json','Set-Cookie':`sid=; Max-Age=0; ${cookieFlags()}`,...SEC_HEADERS}); return res.end(JSON.stringify({ok:true}));
  }

  const sess = getSession(req);
  if(!sess) return send(res,401,{error:'احراز هویت لازم است.'});

  /* ----- آپلود عکس (ادمین و اعضا) ----- */
  if(req.method==='POST' && p==='/api/upload'){
    if(req.headers['x-requested-with'] !== 'park') return send(res,400,{error:'درخواست نامعتبر'});
    if(!uploadAllowed(sess.role+':'+(sess.userId||sess.username))) return send(res,429,{error:'تعداد آپلود در این ساعت زیاد بود.'});
    let buf; try{ buf = await rawBody(req, UPLOAD_MAX); }catch(e){ return send(res,413,{error:'حجم عکس باید کمتر از ۴ مگابایت باشد.'}); }
    const ext = sniffImage(buf);
    if(!ext) return send(res,400,{error:'فقط عکس JPG، PNG، WebP یا GIF مجاز است.'});
    fs.mkdirSync(UPLOAD_DIR,{recursive:true});
    const name = crypto.randomBytes(8).toString('hex') + '.' + ext;
    fs.writeFileSync(path.join(UPLOAD_DIR,name), buf);
    return send(res,200,{ok:true,path:'assets/uploads/'+name});
  }

  /* ----- پنل اعضا و سرگروه‌ها ----- */
  if(p.startsWith('/api/panel/')){
    if(sess.role==='admin') return send(res,403,{error:'این بخش مخصوص حساب اعضاست.'});
    const user = db.getUserById(sess.userId);
    if(req.method==='POST' && p==='/api/panel/password'){
      const b=await body(req);
      if(!verifyPassword(b.current,user.passHash)) return send(res,400,{error:'رمز فعلی درست نیست.'});
      const next=String(b.next||'');
      if(next.length<8) return send(res,400,{error:'رمز جدید باید حداقل ۸ نویسه باشد.'});
      if(next===String(b.current)) return send(res,400,{error:'رمز جدید باید با رمز فعلی فرق داشته باشد.'});
      db.updateUser(user.id,{passHash:hashPassword(next),mustChange:false});
      return send(res,200,{ok:true});
    }
    if(user.mustChange && !(req.method==='GET' && p==='/api/panel/me'))
      return send(res,403,{error:'ابتدا رمز عبور خود را تغییر دهید.',mustChange:true});

    if(req.method==='GET' && p==='/api/panel/me'){
      const data=db.loadData();
      const wanted = qs.get('person') || user.personId;
      const pid = canEditPerson(user,wanted) ? wanted : user.personId;
      const person = data.people[pid] || null;
      const team = person && data.teams[person.team];
      const teamPeople = user.role==='lead' && person
        ? Object.values(data.people).filter(x=>x.team===person.team).map(x=>({id:x.id,name:x.name,type:x.type}))
        : [];
      return send(res,200,{
        user:{username:user.username,role:user.role,mustChange:user.mustChange,personId:user.personId},
        person, teamTitle: team ? team.titleFa : '',
        projects: Object.values(data.projects).filter(x=>x.personId===pid),
        stages: data.stages, teamPeople
      });
    }
    if(req.method==='PUT' && p==='/api/panel/person'){
      const b=await body(req); const id=safeId(b.id);
      if(!canEditPerson(user,id)) return send(res,403,{error:'اجازه‌ی ویرایش این پروفایل را ندارید.'});
      const person = sanitizePerson(db.getPerson(id), b);
      db.upsertPerson(person); publish();
      return send(res,200,{ok:true,person:db.getPerson(id)});
    }
    if(req.method==='PUT' && p==='/api/panel/project'){
      const b=await body(req);
      const stages=db.loadData().stages.length;
      let id=safeId(b.id), personId;
      let history=[];
      if(id){
        const old=db.getProject(id);
        if(!old || !canEditPerson(user,old.personId)) return send(res,403,{error:'اجازه‌ی ویرایش این پروژه را ندارید.'});
        personId=old.personId; history=old.history||[];
      }else{
        personId=safeId(b.personId||user.personId);
        if(!canEditPerson(user,personId)) return send(res,403,{error:'اجازه‌ی ثبت پروژه برای این پروفایل را ندارید.'});
        id='p'+personId+'_'+crypto.randomBytes(3).toString('hex');
        if(db.projectsOfPerson(personId).length>=20) return send(res,400,{error:'حداکثر ۲۰ پروژه برای هر پروفایل مجاز است.'});
      }
      const stage=Math.round(cleanNum(b.stage,0,Math.max(0,stages-1))??0);
      const proj={id,personId,title:clean(b.title,120)||'پروژه بدون عنوان',stage,
        progress:cleanNum(b.progress,0,100)??stage*25,
        note:cleanLong(b.note,1000),
        start:clean(b.start,12), end:clean(b.end,12),
        history, updatedAt:new Date().toISOString().slice(0,10)};
      const d=cleanNum(b.daysWorked,0,100000), h=cleanNum(b.hoursWorked,0,1000000);
      if(d!==null) proj.daysWorked=d; if(h!==null) proj.hoursWorked=h;
      db.upsertProject(proj); publish();
      return send(res,200,{ok:true,project:db.getProject(id)});
    }
    if(req.method==='DELETE' && p.startsWith('/api/panel/project/')){
      const id=safeId(p.split('/').pop()); const old=db.getProject(id);
      if(!old || !canEditPerson(user,old.personId)) return send(res,403,{error:'اجازه‌ی حذف این پروژه را ندارید.'});
      db.deleteProject(id); publish();
      return send(res,200,{ok:true});
    }
    return send(res,404,{error:'route not found'});
  }

  /* ----- از اینجا به بعد فقط ادمین ----- */
  if(sess.role!=='admin') return send(res,403,{error:'دسترسی کافی ندارید.'});

  /* مدیریت حساب‌ها */
  if(req.method==='GET' && p==='/api/users'){
    const people=db.loadData().people;
    return send(res,200,{users:db.listUsers().map(u=>({id:u.id,username:u.username,role:u.role,personId:u.personId,
      personName:people[u.personId]?people[u.personId].name:'(حذف‌شده)',disabled:u.disabled,mustChange:u.mustChange,
      createdAt:u.createdAt,lastLogin:u.lastLogin}))});
  }
  if(req.method==='POST' && p==='/api/users'){
    const b=await body(req);
    const username=String(b.username||'').trim().toLowerCase();
    if(!/^[a-z0-9._-]{3,32}$/.test(username)) return send(res,400,{error:'نام کاربری باید ۳ تا ۳۲ نویسه‌ی انگلیسی/عدد باشد.'});
    if(username===ADMIN.username.toLowerCase()) return send(res,400,{error:'این نام کاربری رزرو است.'});
    if(db.getUserByName(username)) return send(res,400,{error:'این نام کاربری قبلاً ساخته شده است.'});
    const personId=safeId(b.personId);
    if(!db.personExists(personId)) return send(res,400,{error:'فرد/شرکت انتخاب‌شده پیدا نشد.'});
    const password=String(b.password||'').length>=8 ? String(b.password) : randomPassword();
    const id=db.createUser({username,passHash:hashPassword(password),role:b.role==='lead'?'lead':'member',personId});
    return send(res,200,{ok:true,id,username,password});
  }
  if(req.method==='POST' && p==='/api/users/bulk'){
    const people=Object.values(db.loadData().people);
    const have=new Set(db.listUsers().map(u=>u.personId));
    const created=[];
    for(const person of people){
      if(have.has(person.id)) continue;
      let username='u'+safeId(person.id).toLowerCase(); let n=1;
      while(db.getUserByName(username) || username===ADMIN.username.toLowerCase()) username='u'+safeId(person.id).toLowerCase()+'_'+(++n);
      const password=randomPassword();
      db.createUser({username,passHash:hashPassword(password),role:'member',personId:person.id});
      created.push({name:person.name,username,password});
    }
    return send(res,200,{ok:true,created});
  }
  if(req.method==='PUT' && p.startsWith('/api/users/')){
    const id=Number(p.split('/').pop()); const u=db.getUserById(id);
    if(!u) return send(res,404,{error:'حساب پیدا نشد.'});
    const b=await body(req); const f={};
    if(b.role) f.role=b.role==='lead'?'lead':'member';
    if(b.personId!=null){ if(!db.personExists(safeId(b.personId))) return send(res,400,{error:'فرد/شرکت پیدا نشد.'}); f.personId=safeId(b.personId); }
    if(b.disabled!=null) f.disabled=!!b.disabled;
    let password=null;
    if(b.resetPassword){ password=randomPassword(); f.passHash=hashPassword(password); f.mustChange=true; }
    db.updateUser(id,f);
    return send(res,200,{ok:true,password});
  }
  if(req.method==='DELETE' && p.startsWith('/api/users/')){
    if(!db.deleteUser(Number(p.split('/').pop()))) return send(res,404,{error:'حساب پیدا نشد.'});
    return send(res,200,{ok:true});
  }

  /* مدیریت سایت (قبلی) */
  if(req.method==='GET' && p==='/api/data') return send(res,200,db.loadData());
  if(req.method==='GET' && (p==='/api/backup' || p==='/api/backup.sqlite')){
    const tmp=path.join(require('os').tmpdir(),'park-backup-'+Date.now()+'.sqlite');
    db.backupTo(tmp);
    const buf=fs.readFileSync(tmp); fs.rmSync(tmp,{force:true});
    const stamp=new Date().toISOString().slice(0,10);
    res.writeHead(200,{'Content-Type':'application/x-sqlite3','Content-Disposition':`attachment; filename="park-${stamp}.sqlite"`,'Cache-Control':'no-store'});
    return res.end(buf);
  }
  if(req.method==='PUT' && p==='/api/site'){
    const b=await body(req); db.setSite(b); publish();
    return send(res,200,{ok:true,site:db.loadData().site});
  }
  if(req.method==='PUT' && p==='/api/teams'){
    const b=await body(req); if(b.teams) db.setTeams(b.teams); publish();
    return send(res,200,{ok:true});
  }
  if(req.method==='PUT' && p==='/api/people'){
    const b=await body(req); const id=safeId(b.id); if(!id) return send(res,400,{error:'شناسه الزامی است'});
    const teams=db.loadData().teams;
    const team=teams[b.team]?b.team:(teams.game?'game':Object.keys(teams)[0]);
    const person={...b,id,team,type:b.type==='company'?'company':'person',name:String(b.name||id),
      tags:Array.isArray(b.tags)?b.tags:[],samples:Array.isArray(b.samples)?b.samples:[]};
    db.upsertPerson(person); publish();
    return send(res,200,{ok:true,person});
  }
  if(req.method==='DELETE' && p.startsWith('/api/people/')){
    const id=safeId(p.split('/').pop());
    if(!db.deletePerson(id)) return send(res,404,{error:'یافت نشد'});
    db.deleteUsersOfPerson(id);
    publish(); return send(res,200,{ok:true});
  }
  if(req.method==='PUT' && p==='/api/projects'){
    const b=await body(req); const id=safeId(b.id); if(!id) return send(res,400,{error:'شناسه الزامی است'});
    if(!db.personExists(b.personId)) return send(res,400,{error:'فرد یا شرکت انتخاب‌شده پیدا نشد'});
    db.upsertProject({...b,id}); publish();
    return send(res,200,{ok:true,project:db.loadData().projects[id]});
  }
  if(req.method==='DELETE' && p.startsWith('/api/projects/')){
    const id=safeId(p.split('/').pop()); db.deleteProject(id); publish();
    return send(res,200,{ok:true});
  }
  return send(res,404,{error:'route not found'});
}

const server=http.createServer(async(req,res)=>{
  try{ if(req.url.startsWith('/api/')) await api(req,res); else serveStatic(req,res); }
  catch(e){ console.error(e); send(res,500,{error:'خطای داخلی سرور'}); }
});
if(db.initFromDataJsIfEmpty()){ console.log('دیتابیس خالی بود؛ داده‌ها از js/data.js وارد SQLite شد.'); publish(); }
const shutdown=()=>{ db.close(); process.exit(0); };
process.on('SIGINT',shutdown); process.on('SIGTERM',shutdown);
server.listen(PORT,()=>console.log(`Park running: http://localhost:${PORT} | admin: /admin/ | members: /panel/ | database: ${path.relative(ROOT,db.DB_FILE)} (${db.DRIVER})`));
