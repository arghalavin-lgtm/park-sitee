'use strict';
const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
const esc = x => String(x == null ? '' : x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const img = p => !p ? '/assets/img/placeholder.svg' : (/^https?:\/\//i.test(p) ? p : '/' + String(p).replace(/^\/+/, ''));
const PH = '/assets/img/placeholder.svg';

let S = null, tab = 'profile', dirty = false, onPicked = null;

async function api(url, opt = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opt });
  let x = {}; try { x = await r.json(); } catch {}
  if (!r.ok) { const e = new Error(x.error || 'خطای ناشناخته'); e.status = r.status; e.data = x; throw e; }
  return x;
}
function toast(t, bad) {
  const el = document.createElement('div'); el.className = 'toast' + (bad ? ' bad' : ''); el.textContent = t;
  $('#toast').appendChild(el); setTimeout(() => el.remove(), 2800);
}
function show(id) { ['login', 'force', 'app'].forEach(x => $('#' + x).classList.toggle('hidden', x !== id)); }

/* ---------------------------- ورود ---------------------------- */
async function boot() {
  let me;
  try { me = await api('/api/me'); } catch { show('login'); $('#loginErr').textContent = 'سرور در دسترس نیست.'; return; }
  if (!me.authenticated) { show('login'); return; }
  if (me.role === 'admin') {
    show('login');
    $('#loginErr').textContent = 'با حساب مدیر وارد شده‌اید. پنل مدیریت در آدرس /admin/ است؛ برای این صفحه با حساب عضو وارد شوید.';
    return;
  }
  if (me.mustChange) { show('force'); return; }
  await load();
}
$('#loginForm').onsubmit = async e => {
  e.preventDefault(); $('#loginErr').textContent = '';
  const btn = e.target.querySelector('button'); btn.disabled = true;
  try {
    await api('/api/login', { method: 'POST', body: JSON.stringify({ username: $('#user').value.trim(), password: $('#pass').value }) });
    $('#pass').value = ''; await boot();
  } catch (x) { $('#loginErr').textContent = x.message === 'Failed to fetch' ? 'سرور در دسترس نیست.' : x.message; }
  finally { btn.disabled = false; }
};
async function logout() { try { await api('/api/logout', { method: 'POST' }); } catch {} location.reload(); }
$('#logout').onclick = logout; $('#forceLogout').onclick = logout;

async function changePassword(form, errEl) {
  const f = new FormData(form), cur = f.get('current'), next = f.get('next'), again = f.get('again');
  errEl.textContent = '';
  if (next !== again) { errEl.textContent = 'رمز جدید و تکرارش یکی نیست.'; return false; }
  try { await api('/api/panel/password', { method: 'POST', body: JSON.stringify({ current: cur, next }) }); return true; }
  catch (x) { errEl.textContent = x.message; return false; }
}
$('#forceForm').onsubmit = async e => {
  e.preventDefault();
  if (await changePassword(e.target, $('#forceErr'))) { e.target.reset(); await boot(); }
};

/* ---------------------------- بارگذاری داده ---------------------------- */
function fromServer(p) {
  return {
    id: p.id, name: p.name || '', photo: p.photo || '', type: p.type, team: p.team,
    tags: (p.tags || []).map(t => ({ label: t.label || '', value: t.value || '' })),
    samples: (p.samples || []).map(s => ({ title: s.title || '', image: s.image || '', media: s.video || s.link || '' }))
  };
}
async function load(pid) {
  let d;
  try { d = await api('/api/panel/me' + (pid ? '?person=' + encodeURIComponent(pid) : '')); }
  catch (x) { if (x.status === 401) { show('login'); return; } toast(x.message, true); return; }
  if (d.user.mustChange) { show('force'); return; }
  S = { me: d.user, person: d.person ? fromServer(d.person) : null, projects: d.projects || [], stages: d.stages || [], teamTitle: d.teamTitle || '', teamPeople: d.teamPeople || [] };
  dirty = false; show('app'); renderAll();
}
function setDirty(v) { dirty = v; $('#savebar').classList.toggle('hidden', !v); }
window.addEventListener('beforeunload', e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ---------------------------- رندر ---------------------------- */
const pct = p => Math.max(0, Math.min(100, Number(p.progress ?? (Number(p.stage || 0) * 25))));
function renderAll() {
  const p = S.person;
  $('#whoRole').textContent = (S.me.role === 'lead' ? 'سرگروه' : 'عضو مرکز') + (p ? ' · ' + p.name : '');
  $('#viewSite').href = p ? '/profile.html?id=' + encodeURIComponent(p.id) : '/';
  const sw = $('#switcher');
  if (S.me.role === 'lead' && S.teamPeople.length > 1 && p) {
    sw.classList.remove('hidden');
    $('#personSwitch').innerHTML = S.teamPeople.map(x => `<option value="${esc(x.id)}" ${x.id === p.id ? 'selected' : ''}>${esc(x.name)}${x.id === S.me.personId ? ' (خودم)' : ''}</option>`).join('');
  } else sw.classList.add('hidden');
  $('#cSamples').textContent = p && p.samples.length ? fa(p.samples.length) : '';
  $('#cProjects').textContent = S.projects.length ? fa(S.projects.length) : '';
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
  renderBody(); renderPreview(); setDirty(dirty);
}
$('#personSwitch').onchange = async e => {
  if (dirty && !confirm('تغییرات ذخیره‌نشده از بین می‌رود. ادامه می‌دهید؟')) { e.target.value = S.person.id; return; }
  await load(e.target.value);
};
$('#tabs').onclick = e => {
  const b = e.target.closest('button[data-tab]'); if (!b) return;
  tab = b.dataset.tab; renderAll();
};

function tagRow(t, i) {
  return `<div class="trow"><input data-f="tags.${i}.label" placeholder="عنوان (مثلاً تخصص)" maxlength="60" value="${esc(t.label)}" aria-label="عنوان مشخصه">
    <input data-f="tags.${i}.value" placeholder="مقدار" maxlength="120" value="${esc(t.value)}" aria-label="مقدار مشخصه">
    <button type="button" class="btn danger sm" data-act="delTag" data-i="${i}" aria-label="حذف مشخصه">×</button></div>`;
}
function sampleRow(s, i) {
  const thumb = s.image ? `style="background-image:url('${esc(img(s.image))}')"` : '';
  return `<div class="sample">
    <div class="thumb" ${thumb}>${s.image ? '' : 'بدون عکس'}</div>
    <div class="fields">
      <input data-f="samples.${i}.title" placeholder="عنوان نمونه‌کار" maxlength="120" value="${esc(s.title)}" aria-label="عنوان نمونه‌کار">
      <input data-f="samples.${i}.media" dir="ltr" placeholder="لینک ویدیو یا صفحه (اختیاری)  https://…" maxlength="500" value="${esc(s.media)}" aria-label="لینک">
      <div class="line"><button type="button" class="btn sm" data-act="upSample" data-i="${i}">${s.image ? 'عوض کردن عکس' : 'آپلود عکس'}</button>
      ${s.image ? `<button type="button" class="btn sm" data-act="clrSample" data-i="${i}">حذف عکس</button>` : ''}</div>
    </div>
    <button type="button" class="btn danger sm" data-act="delSample" data-i="${i}">حذف</button>
  </div>`;
}
function projCard(p) {
  const v = pct(p);
  return `<div class="proj"><div class="proj-top"><b>${esc(p.title || 'بدون عنوان')}</b><span class="stage">${esc(S.stages[p.stage] || '')}</span></div>
    <div class="bar" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100"><i style="width:${v}%"></i></div>
    <div class="meta"><span>پیشرفت <b>${fa(v)}٪</b></span><span>شروع <b>${esc(p.start || '—')}</b></span><span>پایان <b>${esc(p.end || '—')}</b></span>
    ${p.daysWorked != null ? `<span>روز کاری <b>${fa(p.daysWorked)}</b></span>` : ''}${p.hoursWorked != null ? `<span>ساعت <b>${fa(p.hoursWorked)}</b></span>` : ''}</div>
    ${p.note ? `<p class="sub" style="margin:10px 0 0">${esc(p.note)}</p>` : ''}
    <div class="acts"><button class="btn" data-act="editProj" data-id="${esc(p.id)}">ویرایش</button><button class="btn danger" data-act="delProj" data-id="${esc(p.id)}">حذف</button></div></div>`;
}
function renderBody() {
  const p = S.person, el = $('#body');
  if (!p) { el.innerHTML = '<div class="empty">پروفایلی به حساب شما وصل نیست. با مدیر مرکز تماس بگیرید.</div>'; return; }
  if (tab === 'profile') {
    el.innerHTML = `
    <div class="card"><h2>عکس و نام</h2><p class="sub">این اطلاعات روی کارت شما در سایت دیده می‌شود. عکس مربع و کمتر از ۴ مگابایت بهتر نمایش داده می‌شود.</p>
      <div class="photo-row"><img id="photoImg" src="${esc(img(p.photo))}" alt="عکس پروفایل" onerror="this.onerror=null;this.src='${PH}'">
        <div class="btns"><button type="button" class="btn" data-act="upPhoto">آپلود عکس</button>${p.photo ? '<button type="button" class="btn danger" data-act="delPhoto">حذف عکس</button>' : ''}</div></div>
      <div class="grid2" style="margin-top:18px"><label class="full">نام نمایشی<input data-f="name" maxlength="80" value="${esc(p.name)}"></label></div></div>
    <div class="card"><h2>مشخصات</h2><p class="sub">مثل تخصص، ابزارها یا شهر. هر مورد یک عنوان و یک مقدار دارد.</p>
      <div class="rows">${p.tags.map(tagRow).join('') || '<div class="empty">هنوز مشخصه‌ای اضافه نکرده‌اید.</div>'}</div>
      <button type="button" class="btn add" data-act="addTag">+ مشخصه‌ی جدید</button></div>`;
  } else if (tab === 'samples') {
    el.innerHTML = `<div class="card"><h2>نمونه‌کارها</h2><p class="sub">بهترین کارهایتان را اضافه کنید. هر نمونه‌کار یک عنوان، یک عکس و در صورت دلخواه یک لینک دارد.</p>
      <div class="rows">${p.samples.map(sampleRow).join('') || '<div class="empty">هنوز نمونه‌کاری ندارید. اولین کارتان را اضافه کنید.</div>'}</div>
      <button type="button" class="btn add" data-act="addSample">+ نمونه‌کار جدید</button></div>`;
  } else if (tab === 'projects') {
    el.innerHTML = `<div class="card"><h2>پروژه‌ها</h2><p class="sub">مرحله و درصد پیشرفت هر پروژه را به‌روز نگه دارید؛ نمودارهای سایت از همین‌جا می‌آیند.</p>
      ${S.projects.map(projCard).join('') || '<div class="empty">پروژه‌ای ثبت نشده است.</div>'}
      <button type="button" class="primary add" data-act="newProj">+ پروژه‌ی جدید</button></div>`;
  } else {
    el.innerHTML = `<div class="card"><h2>حساب من</h2><p class="sub">نام کاربری شما: <b dir="ltr">${esc(S.me.username)}</b></p>
      <form id="pwForm" class="grid2" style="max-width:520px"><label class="full">رمز فعلی<input name="current" type="password" autocomplete="current-password" dir="ltr" required></label>
        <label>رمز جدید <small>(حداقل ۸ نویسه)</small><input name="next" type="password" autocomplete="new-password" minlength="8" dir="ltr" required></label>
        <label>تکرار رمز جدید<input name="again" type="password" autocomplete="new-password" minlength="8" dir="ltr" required></label>
        <div class="full"><button class="primary" type="submit">تغییر رمز</button></div><div id="pwErr" class="err full" role="alert"></div></form></div>`;
    $('#pwForm').onsubmit = async e => { e.preventDefault(); if (await changePassword(e.target, $('#pwErr'))) { e.target.reset(); toast('رمز عبور تغییر کرد'); } };
  }
}
function renderPreview() {
  const p = S.person; if (!p) { $('#previewCard').innerHTML = ''; return; }
  const avg = S.projects.length ? Math.round(S.projects.reduce((a, x) => a + pct(x), 0) / S.projects.length) : 0;
  const chips = p.tags.filter(t => t.label).slice(0, 4).map(t => `<span class="chip">${esc(t.label)}${t.value ? ': <b>' + esc(t.value) + '</b>' : ''}</span>`).join('');
  $('#previewCard').innerHTML = `<img src="${esc(img(p.photo))}" alt="" onerror="this.onerror=null;this.src='${PH}'">
    <div class="pinfo"><h3>${esc(p.name || '—')}</h3><div class="team">${esc(S.teamTitle)}</div>
    <div class="chips">${chips}</div>
    <div class="bar"><i style="width:${avg}%"></i></div><div class="foot"><span>میانگین پیشرفت پروژه‌ها</span><b>${fa(avg)}٪</b></div></div>`;
}

/* ---------------------------- ویرایش فیلدها ---------------------------- */
function setPath(obj, path, val) {
  const k = path.split('.'); let o = obj;
  for (let i = 0; i < k.length - 1; i++) o = o[k[i]];
  o[k[k.length - 1]] = val;
}
$('#body').addEventListener('input', e => {
  const f = e.target.dataset && e.target.dataset.f; if (!f) return;
  setPath(S.person, f, e.target.value); setDirty(true); renderPreview();
});

/* ---------------------------- آپلود عکس ---------------------------- */
function pickImage(cb) { onPicked = cb; $('#file').value = ''; $('#file').click(); }
$('#file').onchange = async e => {
  const file = e.target.files[0]; if (!file) return;
  if (file.size > 4 * 1024 * 1024) return toast('حجم عکس باید کمتر از ۴ مگابایت باشد.', true);
  if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) return toast('فقط JPG، PNG، WebP یا GIF مجاز است.', true);
  toast('در حال آپلود…');
  try {
    const r = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': file.type, 'X-Requested-With': 'park' }, body: file });
    const x = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(x.error || 'آپلود انجام نشد.');
    onPicked && onPicked(x.path);
  } catch (err) { toast(err.message, true); }
};

/* ---------------------------- کلیک‌ها ---------------------------- */
$('#body').addEventListener('click', async e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const p = S.person, i = Number(b.dataset.i), act = b.dataset.act;
  if (act === 'upPhoto') pickImage(path => { p.photo = path; setDirty(true); renderBody(); renderPreview(); });
  else if (act === 'delPhoto') { p.photo = ''; setDirty(true); renderBody(); renderPreview(); }
  else if (act === 'addTag') { p.tags.push({ label: '', value: '' }); setDirty(true); renderBody(); }
  else if (act === 'delTag') { p.tags.splice(i, 1); setDirty(true); renderBody(); renderPreview(); }
  else if (act === 'addSample') { p.samples.push({ title: '', image: '', media: '' }); setDirty(true); renderAll(); }
  else if (act === 'delSample') { p.samples.splice(i, 1); setDirty(true); renderAll(); }
  else if (act === 'clrSample') { p.samples[i].image = ''; setDirty(true); renderBody(); }
  else if (act === 'upSample') pickImage(path => { p.samples[i].image = path; setDirty(true); renderBody(); });
  else if (act === 'newProj') openProj(null);
  else if (act === 'editProj') openProj(b.dataset.id);
  else if (act === 'delProj') {
    if (!confirm('این پروژه حذف شود؟')) return;
    try { await api('/api/panel/project/' + encodeURIComponent(b.dataset.id), { method: 'DELETE' }); toast('پروژه حذف شد'); await load(S.person.id); }
    catch (x) { toast(x.message, true); }
  }
});

/* ---------------------------- ذخیره‌ی پروفایل ---------------------------- */
async function save() {
  const p = S.person;
  if (!p.name.trim()) { tab = 'profile'; renderAll(); return toast('نام نمی‌تواند خالی باشد.', true); }
  if (p.samples.some(s => !s.title.trim())) { tab = 'samples'; renderAll(); return toast('برای هر نمونه‌کار یک عنوان بنویسید.', true); }
  const payload = { id: p.id, name: p.name, photo: p.photo,
    tags: p.tags.filter(t => t.label.trim()),
    samples: p.samples.map(s => ({ title: s.title, image: s.image || undefined, link: s.media || undefined })) };
  const btn = $('#saveBtn'); btn.disabled = true;
  try {
    const r = await api('/api/panel/person', { method: 'PUT', body: JSON.stringify(payload) });
    S.person = fromServer(r.person); dirty = false; renderAll(); toast('ذخیره شد و روی سایت قرار گرفت');
  } catch (x) { toast(x.message, true); }
  finally { btn.disabled = false; }
}
$('#saveBtn').onclick = save;
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 's' && dirty && S) { e.preventDefault(); save(); } });

/* ---------------------------- پروژه‌ها ---------------------------- */
function openProj(id) {
  const old = id ? S.projects.find(x => x.id === id) : null;
  const p = old || { title: '', stage: 0, progress: 0, start: '', end: '', daysWorked: '', hoursWorked: '', note: '' };
  const v = pct(p);
  $('#projForm').innerHTML = `<h2>${old ? 'ویرایش پروژه' : 'پروژه‌ی جدید'}</h2>
    <label>عنوان پروژه<input name="title" required maxlength="120" value="${esc(p.title)}"></label>
    <div class="grid2"><label>مرحله‌ی فعلی<select name="stage">${S.stages.map((x, i) => `<option value="${i}" ${i === Number(p.stage) ? 'selected' : ''}>${esc(x)}</option>`).join('')}</select></label>
      <div><label for="pn" style="margin-bottom:6px">درصد پیشرفت</label><div class="prange"><input type="range" id="pr" min="0" max="100" value="${v}" aria-label="نوار پیشرفت"><input type="number" id="pn" name="progress" min="0" max="100" value="${v}"></div></div>
      <label>تاریخ شروع<input name="start" dir="ltr" placeholder="1405/01/01" maxlength="12" value="${esc(p.start || '')}"></label>
      <label>تاریخ پایان<input name="end" dir="ltr" placeholder="1405/06/30" maxlength="12" value="${esc(p.end || '')}"></label>
      <label>روزهای کارکرد<input name="daysWorked" type="number" min="0" value="${esc(p.daysWorked ?? '')}"></label>
      <label>ساعت‌های کارکرد<input name="hoursWorked" type="number" min="0" value="${esc(p.hoursWorked ?? '')}"></label>
      <label class="full">توضیح کوتاه<textarea name="note" maxlength="1000" placeholder="الان روی چه کاری هستید؟">${esc(p.note || '')}</textarea></label></div>
    <div id="projErr" class="err" role="alert"></div>
    <div class="dlg-acts"><button type="submit" class="primary">ذخیره‌ی پروژه</button><button type="button" class="btn" id="projCancel">انصراف</button></div>`;
  const r = $('#pr'), n = $('#pn');
  r.oninput = () => n.value = r.value;
  n.oninput = () => { n.value = Math.max(0, Math.min(100, Number(n.value) || 0)); r.value = n.value; };
  $('#projCancel').onclick = () => $('#projDlg').close();
  $('#projForm').onsubmit = async e => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.target).entries());
    const body = { id: old ? old.id : undefined, personId: S.person.id, title: f.title, stage: Number(f.stage), progress: Number(f.progress),
      start: f.start, end: f.end, note: f.note, daysWorked: f.daysWorked, hoursWorked: f.hoursWorked };
    try {
      await api('/api/panel/project', { method: 'PUT', body: JSON.stringify(body) });
      $('#projDlg').close(); toast('پروژه ذخیره شد'); await load(S.person.id);
    } catch (x) { $('#projErr').textContent = x.message; }
  };
  $('#projDlg').showModal();
}

boot();
