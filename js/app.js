/* ===================================================================
   منطق نمایش سایت — همان صفحات سایت اصلی، بدون حالت ویرایش
   افزوده: تعامل سه‌بعدی (تیلت با حرکت ماوس) و پارالاکس پس‌زمینه
=================================================================== */

const D = SITE_DATA;
const FALLBACK = 'assets/img/placeholder.svg';

const qs  = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

function esc(s){
  return String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function ce(tag, cls, html){
  const el = document.createElement(tag);
  if(cls) el.className = cls;
  if(html !== undefined) el.innerHTML = html;
  return el;
}
function param(n){ return new URLSearchParams(location.search).get(n); }
function fa(n){ return String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]); }
function num(v){
  const t = String(v == null ? '' : v).trim();
  return /^[0-9]+$/.test(t) ? fa(t) : t;
}
function tagVal(p, label){
  const t = (p.tags || []).find(x => x.label === label);
  return t ? t.value : '';
}
function roleOf(p){ return tagVal(p,'زمینه فعالیت') || tagVal(p,'نوع اثر') || ''; }
/* ---- کارآموزان: حوزه‌ی کارآموزی و درصد پیشرفت چک‌لیست ---- */
const internField = p => (p && p.team === 'intern' && D.internTasks && D.internTasks[p.internField]) || null;
const internPct = p => Math.max(0, Math.min(100, Number(p && p.internProgress) || 0));
function internAvg(){
  const list = Object.values(D.people || {}).filter(p => p.team === 'intern');
  return list.length ? Math.round(list.reduce((a, p) => a + internPct(p), 0) / list.length) : null;
}
function statVal(team, label){
  const s = (team.stats || []).find(x => x.label === label);
  return s ? s.value : '';
}
function projectProgress(p){
  return Math.max(0, Math.min(100, Number(p.progress ?? (Number(p.stage || 0) * 25))));
}
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const I = {
  home:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M9.5 20.5v-6h5v6"/></svg>',
  back:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
  search:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  film:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="4" width="19" height="16" rx="2"/><path d="M7 4v16M17 4v16M2.5 9.5h4.5M2.5 14.5h4.5M17 9.5h4.5M17 14.5h4.5"/></svg>',
  frame:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5.2-5a2 2 0 0 1 2.8 0L20 20"/></svg>',
  link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1"/></svg>'
};

/* =====================================================================
   موتور سه‌بعدی: تیلت با حرکت ماوس + پارالاکس پس‌زمینه
===================================================================== */

/* بعد از پایان انیمیشن ورود، transform را آزاد می‌کند تا تیلت کار کند */
function settle(el){
  el.addEventListener('animationend', () => {
    el.style.animation = 'none';
    el.style.opacity = '1';
    el.style.transform = '';
    el.dataset.settled = '1';
  }, { once:true });
}

/* target: عنصری که می‌چرخد | zone: ناحیه‌ای که ماوس در آن رصد می‌شود */
function tilt(zone, target, max = 12, lift = 0){
  if(REDUCED || window.matchMedia('(hover: none)').matches) return;
  let raf = null, rx = 0, ry = 0;

  const apply = () => {
    raf = null;
    target.style.transform =
      `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translateZ(${lift}px)`;
  };
  zone.addEventListener('pointermove', e => {
    if(target.dataset.settled === '0') return;
    const r = zone.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width  - .5;
    const py = (e.clientY - r.top)  / r.height - .5;
    ry = px *  max * 2;
    rx = py * -max * 2;
    if(!raf) raf = requestAnimationFrame(apply);
  });
  zone.addEventListener('pointerleave', () => {
    rx = ry = 0;
    if(!raf) raf = requestAnimationFrame(apply);
  });
}

/* IntersectionObserver مشترک: نمودارها هر بار که وارد دید می‌شوند از صفر تا مقدار واقعی رشد کنند */
const chartRevealObserver = (!REDUCED && 'IntersectionObserver' in window)
  ? new IntersectionObserver(entries => {
      entries.forEach(en => en.target.classList.toggle('in-view', en.isIntersecting));
    }, { threshold: 0.3 })
  : null;

function watchChartReveal(card){
  if(chartRevealObserver) chartRevealObserver.observe(card);
  else card.classList.add('in-view');
}

/* پس‌زمینه‌ی عمق‌دار + حرکت آرام با ماوس */
function buildStage(){
  const st = ce('div','stage');
  st.innerHTML = `
    <span class="stage__light"></span>
    <span class="stage__glow"></span>
    <span class="stage__grain"></span>`;
  document.body.appendChild(st);
}

/* ------------------------- عناصر مشترک صفحه ------------------------- */
function chrome({ back = null } = {}){
  buildStage();
  document.body.appendChild(ce('div','bottom-bar'));

  const home = ce('a','nav-fab home', I.home);
  home.href = 'index.html';
  home.title = 'صفحه اصلی';
  home.setAttribute('aria-label','صفحه اصلی');
  document.body.appendChild(home);

  if(back){
    const b = ce('a','nav-fab back', I.back);
    b.href = back;
    b.title = 'بازگشت';
    b.setAttribute('aria-label','بازگشت');
    document.body.appendChild(b);
  }
  buildSearch();
}

/* ------------------------------ جستجو ------------------------------
   نوار جستجوی بالا: حوزه‌ها، افراد و شرکت‌ها، و پروژه‌ها.
   فهرست جستجو از روی SITE_DATA ساخته می‌شود؛ پس با ویرایش داده، خودکار به‌روز است. */
const SEARCH_ACCENTS = { game:'#E97132', cinema:'#156082', '2d':'#A02B93', '3d':'#0F9ED5', intern:'#2E9E6B' };
const SEARCH_GLYPHS  = { game:'✦', cinema:'◈', '2d':'✺', '3d':'◇', intern:'❖', projects:'⌁' };
const SEARCH_GROUPS  = [
  { label:'حوزه‌ها',           kinds:['domain','page'],     limit:3 },
  { label:'افراد و شرکت‌ها',   kinds:['person','company'],  limit:5 },
  { label:'پروژه‌ها',           kinds:['project'],           limit:4 }
];

let SEARCH_INDEX = null;
function searchIndex(){
  if(SEARCH_INDEX) return SEARCH_INDEX;
  const stages = D.stages || [];
  const idx = [];

  (D.menu || []).forEach(m => {
    if(m.id === 'projects'){
      idx.push({ kind:'page', glyph:SEARCH_GLYPHS.projects, color:'#E97132', href:'projects.html',
        title:m.labelFa, sub:'همه‌ی پروژه‌ها، به تفکیک حوزه', keys:[m.labelFa, m.label] });
      return;
    }
    const t = D.teams[m.id];
    if(!t) return;
    idx.push({ kind:'domain', glyph:SEARCH_GLYPHS[m.id] || '✦', color:SEARCH_ACCENTS[m.id] || '#E97132',
      href:`team.html?id=${m.id}`, title:t.titleFa || m.labelFa,
      sub:`${t.title || m.label} — ${fa((t.members || []).length)} عضو`,
      keys:[t.titleFa, m.labelFa, t.title, m.label] });
  });

  Object.values(D.people || {}).forEach(p => {
    const team = (D.teams[p.team] || {}).titleFa || '';
    const role = roleOf(p);
    idx.push({ kind:p.type === 'company' ? 'company' : 'person', photo:p.photo || FALLBACK,
      href:`profile.html?id=${p.id}`, title:p.name, sub:team + (role ? ' — ' + role : ''),
      keys:[p.name], extra:[role, team] });
  });

  Object.values(D.projects || {}).forEach(pr => {
    const p = D.people[pr.personId];
    if(!p) return;
    const team  = (D.teams[p.team] || {}).titleFa || '';
    const stage = stages[pr.stage] || '';
    const pct   = Math.max(0, Math.min(100, Math.round(Number(getProjectInfo(p, pr).progress) || 0)));
    idx.push({ kind:'project', photo:p.photo || FALLBACK, href:`profile.html?id=${p.id}#project-info`,
      title:pr.title || 'پروژه', sub:p.name + (stage ? ' — ' + stage : ''), chip:`${fa(pct)}٪`,
      keys:[pr.title, p.name], extra:[pr.note, stage, team] });
  });

  idx.forEach(it => {
    it.nk = (it.keys  || []).map(normFa);
    it.ne = (it.extra || []).map(normFa);
  });
  return (SEARCH_INDEX = idx);
}

/* شروعِ متن = ۳، شروعِ کلمه = ۲، میانه‌ی متن = ۱؛ فیلدهای فرعی نصف امتیاز */
function matchScore(text, q){
  const i = text.indexOf(q);
  if(i < 0) return 0;
  return i === 0 ? 3 : (text[i - 1] === ' ' ? 2 : 1);
}
function scoreItem(it, q){
  let s = 0;
  it.nk.forEach(k => { s = Math.max(s, matchScore(k, q)); });
  it.ne.forEach(k => { s = Math.max(s, matchScore(k, q) * .5); });
  return s;
}
/* هایلایت: فقط وقتی طول متن بعد از نرمال‌سازی عوض نشده باشد، تا اندیس‌ها درست بمانند */
function hlMatch(text, q){
  const raw = String(text == null ? '' : text);
  const n = normFa(raw);
  const i = n.length === raw.length ? n.indexOf(q) : -1;
  if(i < 0) return esc(raw);
  return esc(raw.slice(0, i)) + '<mark>' + esc(raw.slice(i, i + q.length)) + '</mark>' + esc(raw.slice(i + q.length));
}

function buildSearch(){
  const wrap = ce('div','site-search');
  wrap.innerHTML = `
    <div class="site-search__field">
      ${I.search}
      <input type="text" id="searchInput" placeholder="جستجوی فرد، شرکت، پروژه، حوزه…" autocomplete="off" aria-label="جستجوی فرد، شرکت، پروژه یا حوزه">
    </div>
    <div class="search-results" id="searchResults" role="listbox"></div>`;
  document.body.appendChild(wrap);

  const input = qs('#searchInput', wrap);
  const box   = qs('#searchResults', wrap);
  let cursor = 0, hits = [];

  function row(it, i, q){
    const lead = it.glyph
      ? `<span class="search-glyph" style="--g:${esc(it.color)}">${it.glyph}</span>`
      : `<img src="${esc(it.photo)}" alt="" onerror="this.src='${FALLBACK}'">`;
    return `
      <a class="search-result-item${i === 0 ? ' on' : ''}" href="${esc(it.href)}" role="option">
        ${lead}
        <div class="search-result-body">
          <div class="search-result-name">${hlMatch(it.title, q)}</div>
          <div class="search-result-team">${esc(it.sub)}</div>
        </div>
        ${it.chip ? `<span class="search-chip">${esc(it.chip)}</span>` : ''}
      </a>`;
  }

  function paint(raw){
    const q = normFa(raw);
    if(!q){ box.classList.remove('show'); box.innerHTML = ''; hits = []; return; }

    const all = searchIndex();
    hits = [];
    let html = '';
    SEARCH_GROUPS.forEach(g => {
      const list = all
        .filter(it => g.kinds.includes(it.kind))
        .map(it => ({ it, s:scoreItem(it, q) }))
        .filter(x => x.s > 0)
        .sort((a, b) => b.s - a.s)
        .slice(0, g.limit);
      if(!list.length) return;
      html += `<div class="search-group">${g.label}</div>`;
      list.forEach(x => { html += row(x.it, hits.push(x.it) - 1, q); });
    });

    cursor = 0;
    box.innerHTML = html || '<div class="search-empty">نتیجه‌ای پیدا نشد</div>';
    box.classList.add('show');
  }

  function moveCursor(step){
    if(!hits.length) return;
    cursor = (cursor + step + hits.length) % hits.length;
    qsa('.search-result-item', box).forEach((n, i) => {
      n.classList.toggle('on', i === cursor);
      if(i === cursor) n.scrollIntoView({ block:'nearest' });
    });
  }

  input.addEventListener('input', () => paint(input.value));
  input.addEventListener('focus', () => { if(input.value.trim()) paint(input.value); });
  input.addEventListener('keydown', e => {
    if(e.key === 'ArrowDown'){ e.preventDefault(); moveCursor(1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); moveCursor(-1); }
    else if(e.key === 'Enter' && hits[cursor]){ location.href = hits[cursor].href; }
    else if(e.key === 'Escape'){ input.value=''; box.classList.remove('show'); input.blur(); }
  });
  /* نتیجه‌ها لینک واقعی‌اند؛ کلیک/کلیک‌وسط/Ctrl+کلیک خودشان کار می‌کنند */
  document.addEventListener('click', e => { if(!wrap.contains(e.target)) box.classList.remove('show'); });
}


/* ---------------------- کاربر برتر ماه (Spotlight) ---------------------- */
function buildSpotlight(){
  const m = D.site.memberOfMonth;
  const person = m && D.people[m.personId];
  if(!person) return '';
  const proj = Object.values(D.projects || {}).filter(p => p.personId === person.id)
    .sort((a,b) => projectProgress(b) - projectProgress(a))[0];
  const pr = proj ? projectProgress(proj) : 0;
  const stageName = proj && (D.stages || [])[Number(proj.stage)] || '';
  const team = (D.menu || []).find(x => x.id === person.team);
  const role = roleOf(person);
  const reasons = (m.reasons || []).filter(Boolean);
  const since = tagVal(person, 'تاریخ ورود');
  const photo = person.photo || FALLBACK;
  return `
    <section id="spotlight" class="home-section spotlight-section">
      <div class="section-intro"><div><span class="eyebrow">MEMBER OF THE MONTH</span><h2>کاربر برتر ماه</h2></div><p>هر ماه، یک نفر از میان اعضا و مجموعه‌ها به‌خاطر عملکرد و پیشرفت پروژه‌اش انتخاب می‌شود.</p></div>
      <article class="spot">
        <span class="spot__orb spot__orb--a"></span><span class="spot__orb spot__orb--b"></span>
        <div class="spot__media">
          <div class="spot__ring"><img src="${esc(photo)}" alt="${esc(person.name)}" onerror="this.onerror=null;this.src='${FALLBACK}'"></div>
          <span class="spot__crown" title="کاربر برتر">★</span>
          <span class="spot__month">${esc(m.month || '')}</span>
        </div>
        <div class="spot__body">
          <div class="spot__badges"><span class="spot__badge">🏆 کاربر برتر ماه</span>${team ? `<span class="spot__badge spot__badge--ghost">${esc(team.labelFa)}</span>` : ''}</div>
          <h3 class="spot__name">${esc(person.name)}</h3>
          ${role ? `<div class="spot__role">${esc(role)}</div>` : ''}
          ${m.headline ? `<p class="spot__headline">${esc(m.headline)}</p>` : ''}
          ${m.quote ? `<blockquote class="spot__quote">${esc(m.quote)}</blockquote>` : ''}
          ${reasons.length ? `<ul class="spot__reasons">${reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
          <div class="spot__foot">
            ${proj ? `<div class="spot__project">
              <div class="spot__project-head"><span>پروژه‌ی در دست انجام</span><b>${num(pr)}٪</b></div>
              <div class="spot__project-title">${esc(proj.title || '')}${stageName ? ` <small>· ${esc(stageName)}</small>` : ''}</div>
              <div class="spot__bar"><i style="--p:${pr}%"></i></div>
            </div>` : ''}
            <div class="spot__actions">
              <a class="spot__btn" href="profile.html?id=${esc(person.id)}">مشاهده پروفایل و نمونه‌کارها <span>←</span></a>
              ${since ? `<span class="spot__meta">عضو از ${esc(since)}</span>` : ''}
            </div>
          </div>
        </div>
      </article>
    </section>`;
}

/* ---------------------- بخش کارآموزی صفحه‌ی اصلی (زیر کاربر برتر ماه) ---------------------- */
function buildInternshipTeaser(){
  if(typeof INTERN_INFO === 'undefined') return '';
  const info = INTERN_INFO;
  const keys = ['game','2d','3d','cinema'].filter(k => info.fields && info.fields[k]);
  const interns = Object.values(D.people || {}).filter(p => p.team === 'intern');
  const tile = (k, i) => {
    const f = info.fields[k];
    const title = (D.internTasks && D.internTasks[k] && D.internTasks[k].title) || k;
    const n = interns.filter(p => p.internField === k).length;
    return `<a class="ip__tile" href="internship.html#field-${esc(k)}" style="--ac:${SEARCH_ACCENTS[k] || '#E97132'};--i:${i}">
      <span class="ip__tile-glyph">${esc(f.glyph)}</span>
      <span class="ip__tile-en">${esc(f.en)}</span>
      <b>${esc(title)}</b>
      <small>${esc(f.short)}</small>
      ${n ? `<span class="ip__tile-count">${esc(fa(n))} کارآموز</span>` : ''}
    </a>`;
  };
  return `
    <section id="internship" class="home-section intern-promo-section">
      <div class="section-intro"><div><span class="eyebrow">INTERNSHIP</span><h2>کارآموزی در مرکز</h2></div><p>می‌خواهید کارآموز مرکز شوید؟ مسیر ثبت‌نام، شرایط لازم و جزئیات هر حوزه را اینجا ببینید.</p></div>
      <article class="ip">
        <span class="ip__orb ip__orb--a"></span><span class="ip__orb ip__orb--b"></span>
        <div class="ip__copy">
          <div class="ip__badges"><span class="ip__badge">🎓 ثبت‌نام کارآموزی</span></div>
          <h3>مسیر کارآموزی، قدم‌به‌قدم</h3>
          <p>${esc(info.intro || '')}</p>
          <ol class="ip__steps">
            ${(info.steps || []).slice(0,4).map((st, i) => `<li><span class="ip__step-n">${esc(fa(i + 1))}</span><div><b>${esc(st.t)}</b><small>${esc(st.d)}</small></div></li>`).join('')}
          </ol>
          <div class="ip__needs">
            <span class="ip__needs-label">شرایط لازم</span>
            ${(info.requirements || []).slice(0,4).map(r => `<span>${esc(r.t)}</span>`).join('')}
          </div>
          <div class="ip__actions">
            <a class="ip__btn ip__btn--main" href="internship.html">اطلاعات کامل کارآموزی <span>←</span></a>
            <a class="ip__btn ip__btn--ghost" href="internship.html#apply">مراحل ثبت‌نام</a>
          </div>
        </div>
        <div class="ip__scene-wrap">
          <div class="ip__scene">${keys.map(tile).join('')}</div>
        </div>
      </article>
    </section>`;
}

/* =========================================================================
   اسلایدر حوزه‌های صفحه‌ی اصلی: چرخش پیوسته و بی‌پایان، توقف با قرار گرفتن ماوس روی کارت‌ها
========================================================================= */
function initDomainSlider(root){
  const g = root.querySelector('.domain-grid');
  if(!g) return;
  const sec = g.parentElement;
  const proj = g.querySelector('.projects-card');
  if(proj){ proj.classList.add('moved'); const w = document.createElement('div'); w.className = 'domain-grid projects-row'; w.appendChild(proj); sec.appendChild(w); }
  g.classList.add('is-slider'); g.style.scrollSnapType = 'none'; g.style.scrollBehavior = 'auto';
  const cards = [...g.querySelectorAll('.domain-card')]; const n = cards.length;
  if(n < 2) return;
  cards.forEach(c => { const k = c.cloneNode(true); k.setAttribute('aria-hidden','true'); k.tabIndex = -1; g.appendChild(k); });
  const bar = document.createElement('div'); bar.className = 'slider-bar';
  bar.innerHTML = '<div class="slider-dots"></div><div class="slider-arrows"><button type="button" class="pv" aria-label="قبلی">→</button><button type="button" class="nx" aria-label="بعدی">←</button></div>';
  g.after(bar);
  const dots = bar.querySelector('.slider-dots');
  cards.forEach((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'حوزه ' + (i + 1)); b.onclick = () => goTo(i); dots.appendChild(b); });
  const sign = getComputedStyle(g).direction === 'rtl' ? -1 : 1;
  const SPEED = 55; /* پیکسل در ثانیه */
  let pos = 0, paused = false, visible = true, tween = null, last = 0, shown = -1, resumeT = null, down = false;
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const step = () => Math.abs(cards[1].getBoundingClientRect().left - cards[0].getBoundingClientRect().left);
  function wrap(L){ if(pos >= L){ pos -= L; if(tween){ tween.from -= L; tween.to -= L; } } else if(pos < 0){ pos += L; if(tween){ tween.from += L; tween.to += L; } } }
  function show(s){ const i = Math.round(pos / s) % n; if(i !== shown){ shown = i; [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i)); } }
  function loop(t){
    const dt = Math.min(50, t - (last || t)) / 1000; last = t;
    const s = step(), L = n * s;
    if(tween){ const p = Math.min(1, (t - tween.t0) / tween.d), e = 1 - Math.pow(1 - p, 3); pos = tween.from + (tween.to - tween.from) * e; if(p >= 1) tween = null; wrap(L); g.scrollLeft = sign * pos; }
    else if(!paused && !down && visible && !document.hidden && !reduce){ pos += SPEED * dt; wrap(L); g.scrollLeft = sign * pos; }
    show(s); requestAnimationFrame(loop);
  }
  function slide(to){ wrap(n * step()); tween = { from: pos, to: to, t0: performance.now(), d: 550 }; }
  function goTo(i){ const s = step(), L = n * s; let to = i * s; if(to - pos > L / 2) to -= L; if(pos - to > L / 2) to += L; slide(to); }
  bar.querySelector('.nx').onclick = () => { const s = step(); slide((Math.round(pos / s) + 1) * s); };
  bar.querySelector('.pv').onclick = () => { const s = step(); slide((Math.round(pos / s) - 1) * s); };
  const hold = () => { paused = true; clearTimeout(resumeT); };
  const release = () => { clearTimeout(resumeT); resumeT = setTimeout(() => { paused = false; }, 600); };
  [g, bar].forEach(el => { el.addEventListener('mouseenter', hold); el.addEventListener('mouseleave', release); });
  g.addEventListener('focusin', hold); g.addEventListener('focusout', release);
  g.addEventListener('touchstart', hold, { passive:true }); g.addEventListener('touchend', release, { passive:true });
  g.addEventListener('scroll', () => { if(paused && !tween) pos = sign * g.scrollLeft; });
  let sx = 0, sl = 0;
  g.addEventListener('pointerdown', e => { if(e.pointerType !== 'mouse') return; down = true; sx = e.clientX; sl = g.scrollLeft; g.classList.add('dragging'); });
  window.addEventListener('pointermove', e => { if(!down) return; g.scrollLeft = sl - (e.clientX - sx); pos = sign * g.scrollLeft; });
  window.addEventListener('pointerup', () => { if(!down) return; down = false; g.classList.remove('dragging'); });
  if('IntersectionObserver' in window) new IntersectionObserver(es => { visible = es[0].isIntersecting; }, { threshold:.2 }).observe(g);
  requestAnimationFrame(loop);
}

/* =========================================================================
   صفحه‌ی اصلی — عنوان + چهار دایره‌ی نارنجی (سه‌بعدی)
========================================================================= */
function renderHome(){
  document.title = D.site.title;
  chrome();

  const people = Object.values(D.people || {});
  const projects = Object.values(D.projects || {});
  const teams = Object.values(D.teams || {});
  const stages = D.stages || [];
  const stageDone = stages.length - 1;
  const done = projects.filter(p => Number(p.stage) === stageDone).length;
  const active = projects.filter(p => Number(p.stage) > 0 && Number(p.stage) < stageDone).length;
  const avg = projects.length ? Math.round(projects.reduce((a,p) => a + projectProgress(p), 0) / projects.length) : 0;

  const wrap = ce('div','home-dashboard');
  wrap.innerHTML = `
    <section class="overview-strip" aria-label="نمای کلی مرکز">
      <div class="overview-main"><span class="live-dot"></span><div><b>نمای کلی مرکز</b><small>اطلاعات نمایش‌داده‌شده از داده‌های فعلی سایت محاسبه می‌شود</small></div></div>
      <div class="overview-stat"><strong>${num(teams.length)}</strong><span>حوزه فعال</span></div>
      <div class="overview-stat"><strong>${num(people.length)}</strong><span>عضو و مجموعه</span></div>
      <div class="overview-stat"><strong>${num(projects.length)}</strong><span>پروژه</span></div>
      <div class="overview-stat"><strong>${num(avg)}٪</strong><span>میانگین پیشرفت</span></div>
    </section>

    <section id="domains" class="home-section domains-section">
      <div class="section-intro"><div><span class="eyebrow">CORE DOMAINS</span><h2>حوزه‌های فعال مرکز</h2></div><p>هر حوزه، یک فضای مستقل برای مشاهده اعضا، تیم‌ها، ابزارها و فعالیت‌های جاری.</p></div>
      <div class="domain-grid">
        ${D.menu.filter(m => m.id !== 'projects').map((m,i) => {
          const t=D.teams[m.id]||{};
          const members=(t.members||[]).length;
          const teamCount=statVal(t,'تعداد تیم‌ها');
          const iAvg = m.id === 'intern' ? internAvg() : null;
          const accent=['orange','blue','purple','cyan','green'][i]||'orange';
          const cover={'game':'game.svg','cinema':'cinema.svg','2d':'animation-2d.svg','3d':'animation-3d.svg','intern':'intern.svg'}[m.id];
          return `<a class="domain-card has-cover accent-${accent}" href="team.html?id=${esc(m.id)}">
            ${cover ? `<span class="domain-cover"><img src="assets/img/domains/${cover}" alt="${esc(m.labelFa)}" loading="lazy" decoding="async"></span>` : ''}
            <span class="domain-number">0${i+1}</span><span class="domain-arrow">↗</span>
            <span class="domain-icon">${['✦','◈','✺','◇','❖'][i] || '✦'}</span>
            <span class="domain-en">${esc(m.label)}</span><h3>${esc(m.labelFa)}</h3>
            <p>${esc(t.subtitle || '')}</p>
            <span class="domain-meta"><b>${num(members)}</b> ${m.id === 'intern' ? 'کارآموز' : 'عضو'}${iAvg !== null ? ` <i></i><b>${fa(iAvg)}٪</b> میانگین پیشرفت` : (teamCount ? ` <i></i><b>${num(teamCount)}</b> تیم` : '')}</span>
          </a>`;
        }).join('')}
        <a class="domain-card projects-card" href="projects.html">
          <span class="domain-number">0${D.menu.filter(x => x.id !== 'projects').length + 1}</span><span class="domain-arrow">↗</span><span class="domain-icon">⌁</span>
          <span class="domain-en">PROJECTS</span><h3>پروژه‌های در دست انجام</h3>
          <p>نمایش مسیر پیشرفت پروژه‌ها و مرحله فعلی هر مجموعه.</p>
          <span class="project-mini-progress"><i style="width:${avg}%"></i></span><span class="domain-meta"><b>${num(active)}</b> در حال انجام <i></i><b>${num(done)}</b> تکمیل‌شده</span>
        </a>
      </div>
    </section>

    <section class="home-section pulse-section">
      <div class="section-intro"><div><span class="eyebrow">PROJECT PULSE</span><h2>نبض پروژه‌ها</h2></div><a class="section-link" href="projects.html">مشاهده همه پروژه‌ها <span>←</span></a></div>
      <div class="pulse-grid">
        <div class="pulse-card pulse-chart"><div class="pulse-card-head"><div><b>میانگین پیشرفت</b><small>بر اساس وضعیت فعلی پروژه‌ها</small></div><strong>${num(avg)}٪</strong></div><div class="big-progress"><i style="width:${avg}%"></i><span style="left:${avg}%"></span></div><div class="progress-scale"><span>۰</span><span>۲۵</span><span>۵۰</span><span>۷۵</span><span>۱۰۰</span></div></div>
        <div class="pulse-card stage-card"><div class="pulse-card-head"><div><b>توزیع وضعیت</b><small>تعداد پروژه در هر مرحله</small></div></div>
          ${stages.map((st,i)=>{const c=projects.filter(p=>Number(p.stage)===i).length; const w=projects.length?Math.round(c/projects.length*100):0; return `<div class="stage-row"><span>${esc(st)}</span><div><i class="s${i}" style="width:${w}%"></i></div><b>${num(c)}</b></div>`}).join('')}
        </div>
      </div>
    </section>

    <section class="home-section tools-section">
      <div class="section-intro"><div><span class="eyebrow">CREATIVE TOOLKIT</span><h2>${esc(D.site.toolsTitle || 'ابزارها و بستر کاری')}</h2></div><p>${esc(D.site.toolsText || '')}</p></div>
      <div class="toolkit-grid">
        ${D.menu.filter(m => m.id !== 'projects' && ((D.teams[m.id] || {}).tools || []).length).map((m,i) => {
          const t = D.teams[m.id] || {};
          const accent = ['orange','blue','purple','cyan','green'][i] || 'orange';
          const groups = t.tools || [];
          return `<a class="toolkit-card accent-${accent}" href="team.html?id=${esc(m.id)}">
            <div class="toolkit-head"><span class="toolkit-dot"></span><div><b>${esc(m.labelFa)}</b><small>${esc(m.label)}</small></div><span class="toolkit-go">↗</span></div>
            ${groups.length ? groups.map(g => `
              <div class="toolkit-group"><span class="toolkit-group-name">${esc(g.group)}</span>
                <div class="toolkit-chips">${(g.items||[]).map(x => `<span>${esc(x)}</span>`).join('')}</div>
              </div>`).join('') : '<div class="toolkit-empty">ابزاری ثبت نشده است.</div>'}
          </a>`;
        }).join('')}
      </div>
    </section>

    ${buildSpotlight()}

    ${buildInternshipTeaser()}

    <footer class="home-footer"><div><b>${esc(D.site.name)}</b><span>${esc(D.site.footText || '')}</span></div><a href="projects.html">پروژه‌ها <span>↗</span></a></footer>
  `;
  document.body.appendChild(wrap);
  initDomainSlider(wrap);

  /* هیرو سینمایی (js/cinema.js): قبل از داشبورد درج می‌شود */
  if(typeof Cinema !== "undefined") Cinema.mount(D, { teams: teams.length, people: people.length, projects: projects.length, avg }, wrap);

  const spot = qs('.spot', wrap);
  if(spot){
    if(!REDUCED) tilt(spot, spot, 2.2);
    const io = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ spot.classList.add('in-view'); io.disconnect(); } }), { threshold:.25 });
    io.observe(spot);
  }
  const ip = qs('.ip', wrap);
  if(ip){
    const scene = qs('.ip__scene', ip);
    if(!REDUCED && scene) tilt(ip, scene, 7, 0);
    const io2 = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ ip.classList.add('in-view'); io2.disconnect(); } }), { threshold:.2 });
    io2.observe(ip);
  }
  qsa('.domain-card',wrap).forEach((card,i)=>{ card.style.animationDelay=(.12+i*.07)+'s'; if(!REDUCED) tilt(card, card, 3.2); });

  /* نوار جستجو در هیروی سینمایی دیده نمی‌شود؛ وقتی سینماتیک تمام شد ظاهر می‌شود */
  const cineRoot = qs('.cine'), searchEl = qs('.site-search');
  if(cineRoot && searchEl){
    searchEl.classList.add('site-search--gated');
    const sync = () => {
      const on = cineRoot.getBoundingClientRect().bottom <= window.innerHeight * .25;
      searchEl.classList.toggle('is-shown', on);
      if(!on){ const inp = qs('input', searchEl); if(inp === document.activeElement) inp.blur(); qs('.search-results', searchEl).classList.remove('show'); }
    };
    window.addEventListener('scroll', sync, { passive:true });
    window.addEventListener('resize', sync);
    sync();
  }
}

/* استایل بخش‌های کارآموز (فقط در صفحه‌ی کارآموز بارگذاری می‌شود) */
function ensureInternCss(){
  if(document.querySelector('link[data-intern-css]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = 'css/intern.css'; l.setAttribute('data-intern-css','1');
  document.head.appendChild(l);
}

/* هدر تیره‌ی صفحه‌ی هر حوزه (عنوان + چهار آمار کلیدی) */
function ensureTeamHeroCss(){
  if(document.querySelector('link[data-team-hero-css]')) return;
  const l = document.createElement('link');
  l.rel = 'stylesheet'; l.href = 'css/team-hero.css'; l.setAttribute('data-team-hero-css','1');
  document.head.appendChild(l);
}
function buildTeamHero(id, team){
  const ps = teamProjectStats(id);
  const members = (team.members || []).filter(pid => D.people[pid]);
  const statVal = label => { const x = (team.stats || []).find(s => String(s.label).replace(/\u200c/g,'').includes(label)); return x ? num(x.value) : null; };
  let tiles;
  if(id === 'intern'){
    const keys = ['game','2d','3d','cinema'].filter(k => D.internTasks && D.internTasks[k]);
    tiles = [
      [fa(members.length), 'کارآموز فعال'],
      [fa(members.length ? (internAvg() || 0) : 0) + '٪', 'میانگین پیشرفت'],
      [fa(keys.length), 'حوزه‌ی آموزشی'],
      [fa(ps.total), 'پروژه در دست انجام']
    ];
  }else{
    tiles = [
      [statVal('تعداد تیم') !== null ? statVal('تعداد تیم') : fa(members.length), 'تعداد تیم‌ها'],
      [statVal('جمع کل نفرات') !== null ? statVal('جمع کل نفرات') : fa(members.length), 'جمع کل نفرات'],
      [fa(ps.total), 'پروژه در دست انجام'],
      [fa(ps.done.length), 'پروژه‌ی اتمام‌شده']
    ];
  }
  const hero = ce('header','th-hero');
  hero.style.setProperty('--hc', SEARCH_ACCENTS[id] || '#E97132');
  hero.innerHTML = `
    <span class="th-orb th-orb--a"></span><span class="th-orb th-orb--b"></span>
    <div class="th-top">
      <span class="th-eyebrow">${esc(team.title)}</span>
      <h1>${esc(team.titleFa)}</h1>
      <p>${esc(team.subtitle)}</p>
    </div>
    <div class="th-stats">${tiles.map(t => `<div class="th-stat"><b>${esc(t[0])}</b><span>${esc(t[1])}</span></div>`).join('')}</div>`;
  return hero;
}

/* =========================================================================
   صفحه‌ی بخش — بج نارنجی + کارت آمار + شبکه‌ی اعضا
========================================================================= */
function renderTeam(){
  const id = param('id') || 'game';
  const team = D.teams[id];
  if(!team) return oops('این بخش پیدا نشد.');

  document.title = `${team.titleFa} | ${D.site.name}`;
  chrome({ back:'index.html' });

  const c = ce('div','container');

  ensureTeamHeroCss();
  const head = ce('div','team-header');
  head.appendChild(buildTeamHero(id, team));
  c.appendChild(head);

  const body = ce('div','team-body');

  /* کارت آمار */
  const stats = ce('div','stats-card');
  stats.appendChild(ce('div','stats-card__head','آمار این بخش'));
  team.stats.forEach(s => {
    const row = ce('div','stat-row');
    row.appendChild(ce('span','stat-label', esc(s.label)));
    row.appendChild(ce('span','stat-value', esc(num(s.value))));
    stats.appendChild(row);
  });
  /* آمار پروژه‌های این حوزه (از روی همان جدول اطلاعات پروژه محاسبه می‌شود) */
  const ps = teamProjectStats(id);
  const addStat = (label, valueHtml, cls = '') => {
    const row = ce('div','stat-row stat-row--project' + (cls ? ' ' + cls : ''));
    row.appendChild(ce('span','stat-label', esc(label)));
    row.appendChild(ce('span','stat-value', valueHtml));
    stats.appendChild(row);
  };
  stats.appendChild(ce('div','stats-card__sub','وضعیت پروژه‌ها'));
  addStat('تعداد پروژه‌ها', esc(fa(ps.total)));
  addStat('پروژه‌های اتمام‌شده', esc(fa(ps.done.length)), 'is-done');
  addStat('در حال اتمام', ps.finishing.length
    ? `<span class="stat-people">${ps.finishing.map(x => `<a href="profile.html?id=${esc(x.person.id)}">${esc(x.person.name)}<em>${esc(fa(x.progress))}٪</em></a>`).join('')}</span>`
    : '<span class="stat-none">موردی نیست</span>', 'is-finishing');

  /* خلاصه‌ی کارآموزان: تعداد، میانگین پیشرفت و تعداد در هر حوزه */
  if(id === 'intern'){
    const list = (team.members || []).map(pid => D.people[pid]).filter(Boolean);
    stats.appendChild(ce('div','stats-card__sub','کارآموزان'));
    addStat('تعداد کارآموزان', esc(fa(list.length)));
    addStat('میانگین پیشرفت', `<b>${esc(fa(list.length ? (internAvg() || 0) : 0))}٪</b>`, 'is-done');
    const fieldKeys = ['game','2d','3d','cinema'].filter(k => D.internTasks && D.internTasks[k]);
    if(fieldKeys.length){
      stats.appendChild(ce('div','stats-card__sub','حوزه‌های کارآموزی'));
      fieldKeys.forEach(k => addStat(D.internTasks[k].title, esc(fa(list.filter(x => x.internField === k).length))));
    }
  }

  /* ابزارهای این حوزه */
  if((team.tools || []).length){
    stats.appendChild(ce('div','stats-card__sub','ابزارهای کاری'));
    const tl = ce('div','stats-tools');
    tl.innerHTML = team.tools.map(g => `
      <div class="stats-tools-group"><span>${esc(g.group)}</span>
        <div>${(g.items||[]).map(x => `<i>${esc(x)}</i>`).join('')}</div>
      </div>`).join('');
    stats.appendChild(tl);
  }
  settle(stats);
  body.appendChild(stats);

  /* اعضا */
  const makeCard = (pid, i) => {
    const p = D.people[pid];
    if(!p) return null;
    const card = ce('a','member-card');
    card.href = `profile.html?id=${pid}`;
    card.style.animationDelay = (0.35 + i * 0.08) + 's';
    card.innerHTML = `
      <span class="avatar-wrap">
        <span class="avatar-ring"></span>
        <img class="avatar" src="${esc(p.photo || FALLBACK)}" alt="${esc(p.name)}" loading="lazy" onerror="this.src='${FALLBACK}'">
        <span class="avatar-shadow"></span>
      </span>
      <span class="member-name">${esc(p.name)}</span>
      <span class="member-role">${esc(internField(p) ? 'کارآموز ' + internField(p).title : roleOf(p))}</span>
      ${p.team === 'intern' ? `<span class="member-prog" title="پیشرفت آموزشی"><span class="mini-prog"><i style="width:${internPct(p)}%"></i></span><b>${esc(fa(internPct(p)))}٪</b></span>` : ''}
      <span class="type-chip${p.type === 'company' ? '' : ' is-person'}">${p.type === 'company' ? 'شرکت/گروه' : 'کارآموز'}</span>`;
    tilt(card, qs('.avatar-wrap', card), 10);
    return card;
  };

  let grid;
  if(id === 'intern'){
    /* کارآموزان: چهار بخش جدا (گیم، انیمیشن دوبعدی، انیمیشن سه‌بعدی، سینما) */
    ensureInternCss();
    grid = ce('div','intern-sections');
    const people = (team.members || []).map(pid => D.people[pid]).filter(Boolean);
    const keys = ['game','2d','3d','cinema'].filter(k => D.internTasks && D.internTasks[k]);
    const groups = keys.map(k => ({
      key:k, title:D.internTasks[k].title,
      list: people.filter(x => x.internField === k)
    }));
    const loose = people.filter(x => !keys.includes(x.internField));
    if(loose.length) groups.push({ key:'other', title:'بدون حوزه‌ی کارآموزی', list:loose });

    const nav = ce('nav','intern-nav');
    nav.innerHTML = groups.map(g => `<a href="#intern-${esc(g.key)}" style="--ac:${SEARCH_ACCENTS[g.key] || '#2E9E6B'}">${esc(g.title)}<b>${esc(fa(g.list.length))}</b></a>`).join('');
    grid.appendChild(nav);

    groups.forEach(g => {
      const sec = ce('section','intern-section');
      sec.id = 'intern-' + g.key;
      sec.style.setProperty('--ac', SEARCH_ACCENTS[g.key] || '#2E9E6B');
      const avg = g.list.length ? Math.round(g.list.reduce((a, x) => a + internPct(x), 0) / g.list.length) : null;
      sec.innerHTML = `
        <div class="intern-section__head">
          <h3>${esc(g.title)}</h3>
          <span class="intern-section__meta"><b>${esc(fa(g.list.length))}</b> کارآموز${avg !== null ? ` <i></i><b>${esc(fa(avg))}٪</b> میانگین پیشرفت` : ''}</span>
        </div>`;
      const inner = ce('div','members-grid intern-section__grid');
      if(!g.list.length) inner.appendChild(ce('div','team-empty','هنوز کارآموزی در این بخش ثبت نشده است.'));
      g.list.forEach((x, i) => { const card = makeCard(x.id, i); if(card) inner.appendChild(card); });
      sec.appendChild(inner);
      grid.appendChild(sec);
    });
  }else{
    grid = ce('div','members-grid');
    if(!(team.members || []).some(pid => D.people[pid])){
      grid.appendChild(ce('div','team-empty','هنوز کسی در این بخش ثبت نشده است. از پنل مدیریت، بخش «افراد و شرکت‌ها»، می‌توانید اولین نفر را اضافه کنید.'));
    }
    team.members.forEach((pid, i) => { const card = makeCard(pid, i); if(card) grid.appendChild(card); });
  }
  body.appendChild(grid);

  c.appendChild(body);

  /* پروژه‌های در دست انجام همین بخش */
  c.appendChild(ce('h2','section-heading','پروژه‌های در دست انجام این بخش'));
  c.appendChild(buildTeamProjectsSection(id, { showHeader:false, top3:true }));

  document.body.appendChild(c);

  tilt(stats, stats, 3.5);
}

/* =========================================================================
   پروژه‌های در دست انجام — یک نمودار واحد به‌جای کارت‌های جدا
========================================================================= */

/* آمار پروژه‌های یک حوزه: کل، اتمام‌شده، در حال اتمام (۷۵٪ تا کمتر از ۱۰۰٪ یا مرحله‌ی بازبینی) */
const FINISHING_FROM = 75;
function teamProjectStats(teamId){
  const team = D.teams[teamId] || {};
  const stages = D.stages || [];
  const lastStage = stages.length - 1;
  const done = [], finishing = [];
  let total = 0;
  (team.members || []).forEach(pid => {
    const person = D.people[pid];
    const project = D.projects['proj_' + pid];
    if(!person || !project) return;
    total++;
    const info = getProjectInfo(person, project);
    const progress = Math.max(0, Math.min(100, Math.round(Number(info.progress) || 0)));
    const entry = { person, project, progress };
    if(progress >= 100 || Number(project.stage) === lastStage) done.push(entry);
    else if(progress >= FINISHING_FROM || Number(project.stage) === lastStage - 1) finishing.push(entry);
  });
  finishing.sort((a,b) => b.progress - a.progress);
  return { total, done, finishing };
}

/* بخش «پروژه‌های در دست انجام» مخصوص یک تیم؛ هم در صفحه‌ی پروژه‌ها
   (برای هر ۴ تیم جدا) و هم در صفحه‌ی همان تیم استفاده می‌شود */
function buildTeamProjectsSection(teamId, { showHeader = true, top3 = false } = {}){
  const team = D.teams[teamId] || {};
  const section = ce('div','team-projects-block');

  if(showHeader){
    const head = ce('div','team-projects-header');
    head.innerHTML = `<span class="team-projects-badge">${esc(team.titleFa || '')}</span>`;
    section.appendChild(head);
  }

  const items = Object.values(D.projects || {}).filter(p => {
    const person = D.people[p.personId];
    return person && person.team === teamId;
  });

  if(!items.length){
    section.appendChild(ce('div','no-result','هنوز پروژه‌ای برای این بخش ثبت نشده است.'));
  }else{
    if(top3){ const top = buildTopProjects(teamId); if(top) section.appendChild(top); }
    section.appendChild(buildTeamDataTable(teamId));
  }

  return section;
}

/* سه پروژه‌ی برتر یک حوزه (بر اساس درصد پیشرفت همان جدول) + اینکه مال کیست */
function buildTopProjects(teamId, n = 3){
  const team = D.teams[teamId] || {};
  const stages = D.stages || [];
  const list = [];
  (team.members || []).forEach(pid => {
    const person = D.people[pid], project = D.projects['proj_' + pid];
    if(!person || !project) return;
    const info = getProjectInfo(person, project);
    const progress = Math.max(0, Math.min(100, Math.round(Number(info.progress) || 0)));
    list.push({ person, project, progress, stage: stages[project.stage] || '' });
  });
  if(!list.length) return null;
  list.sort((a, b) => b.progress - a.progress || Number(b.project.stage) - Number(a.project.stage) || a.person.name.localeCompare(b.person.name, 'fa'));
  const top = list.slice(0, n);

  const box = ce('section','top-projects');
  box.setAttribute('aria-label','برترین پروژه‌های این بخش');
  box.innerHTML = `
    <div class="top-projects__head"><h3>برترین پروژه‌های این بخش</h3><small>بر اساس درصد پیشرفت</small></div>
    <div class="top-projects__grid">
      ${top.map((t, i) => `
        <a class="top-card rank-${i + 1}" href="profile.html?id=${esc(t.person.id)}" style="--k:${i}">
          <span class="top-card__rank">${fa(i + 1)}</span>
          <img class="top-card__photo" src="${esc(t.person.photo || FALLBACK)}" alt="" loading="lazy" onerror="this.src='${FALLBACK}'">
          <span class="top-card__body">
            <small>${esc(t.project.title || 'پروژه')} — مال</small>
            <b>${esc(t.person.name)}</b>
            <em>${t.person.type === 'company' ? 'شرکت/گروه' : 'کارآموز'}${t.stage ? ' · ' + esc(t.stage) : ''}</em>
          </span>
          <span class="top-card__pct">${esc(fa(t.progress))}<i>٪</i></span>
          <span class="top-card__bar"><i style="--p:${t.progress}%"></i></span>
        </a>`).join('')}
    </div>`;
  return box;
}

/* =========================================================================
   نمودارهای هفتگی/ماهانه هر فرد (میله‌ای + S-Curve) + جدول اطلاعات پروژه
   -------------------------------------------------------------------------
   داده‌ی واقعی: در js/data.js داخل بلوک هر فرد می‌توانید فیلدهای زیر را
   اضافه کنید؛ تا وقتی اضافه نشده باشند، مقداری آزمایشی (و ثابت برای
   همان فرد) به‌جای آن ساخته می‌شود تا فقط ظاهر نمودار دیده شود:

     "weekly":  { "daily": [7 عدد ساعت کار هر روز], "cumulative": [7 عدد درصد پیشرفت تجمعی] }
     "monthly": { "daily": [12 عدد درصد پیشرفت آن ماه], "cumulative": [12 عدد درصد پیشرفت تجمعی] }
     "projectInfo": { "start": "1404/02/10", "end": "1404/07/01", "progress": 42, "daysWorked": 38, "hoursWorked": 210 }
========================================================================= */

function hashSeed(str){
  let h = 0;
  for(let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h >>> 0;
}
function makeRng(seed){
  let s = seed >>> 0 || 1;
  return function(){
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function rngIn(rng, min, max){ return min + rng() * (max - min); }

/* داده‌ی آزمایشی جدول اطلاعات پروژه (تاریخ‌ها فرضی‌اند، فقط برای نمایش ظاهر) */
function demoProjectInfo(id, project){
  const rng = makeRng(hashSeed(id + '_p'));
  const stages = D.stages || [];
  const stageFrac = stages.length > 1 ? (project ? project.stage : 0) / (stages.length - 1) : 0;
  const startMonth = Math.floor(rngIn(rng, 0, 7));
  const startDay = Math.floor(rngIn(rng, 1, 27));
  const durMonths = Math.floor(rngIn(rng, 2, 7));
  let endMonth = startMonth + durMonths, endYear = 1404;
  if(endMonth > 11){ endMonth -= 12; endYear = 1405; }
  const pad2 = n => String(n).padStart(2,'0');
  const progress = Math.max(4, Math.min(100, Math.round(stageFrac * 100 + rngIn(rng, -6, 10))));
  const daysWorked = Math.round(rngIn(rng, 16, 72));
  const hoursWorked = Math.round(daysWorked * rngIn(rng, 3.2, 6.8));
  return {
    start: `۱۴۰۴/${fa(pad2(startMonth+1))}/${fa(pad2(startDay))}`,
    end: `${fa(String(endYear))}/${fa(pad2(endMonth+1))}/${fa(pad2(startDay))}`,
    progress, daysWorked, hoursWorked
  };
}

/* فیلدهای خالی/ناقص projectInfo (مثلاً تاریخ یا روز کارکرد ثبت‌نشده) از مقدار آزمایشی پر می‌شوند، تا «undefined» نمایش داده نشود */
function getProjectInfo(person, project){
  const demo = demoProjectInfo(person.id, project);
  const real = person.projectInfo;
  if(!real) return demo;
  const out = { ...demo };
  Object.keys(real).forEach(k => { if(real[k] !== '' && real[k] != null) out[k] = real[k]; });
  return out;
}

let PC_UID = 0;

/* =========================================================================
   نمودار ماهانه به‌صورت دایره‌ای (Pie) — همه‌ی افراد/شرکت‌های یک حوزه
   در یک دایره‌ی واحد، هر کدام یک قطعه، با درصد پیشرفت به‌عنوان برچسب
========================================================================= */
const DONUT_PALETTE = ['var(--teal)','var(--orange)','var(--purple)','var(--cyan)',
  'var(--teal-lo)','var(--orange-mid)','var(--cyan-lo)','var(--orange-lo)','var(--orange-deep)'];

/* اطلاعات فرد + پروژه‌اش برای کارت کوچک هاور */
function personPopInfo(person){
  const project = D.projects['proj_' + person.id];
  const info = getProjectInfo(person, project);
  const stages = D.stages || [];
  return {
    id: person.id, name: person.name, progress: info.progress,
    photo: person.photo, type: person.type, role: roleOf(person), tags: person.tags || [],
    projectTitle: project ? project.title : '',
    stageName: project ? (stages[project.stage] || '') : '',
    dateStart: info.start, dateEnd: info.end, daysWorked: info.daysWorked, hoursWorked: info.hoursWorked
  };
}
/* هر عنصری (مثلاً عکس/هدر کارت) با ایستادن ماوس روی آن، کارت اطلاعات فرد را نشان می‌دهد */
function attachPersonPop(el, s, extra){
  el.addEventListener('pointerenter', e => {
    if(extra && extra.onEnter) extra.onEnter();
    if(e.pointerType !== 'touch') showDonutPop(s, e.clientX, e.clientY);
  });
  el.addEventListener('pointermove', e => {
    if(e.pointerType !== 'touch') placeDonutPop(e.clientX, e.clientY);
  });
  el.addEventListener('pointerleave', () => { if(extra && extra.onLeave) extra.onLeave(); hideDonutPop(); });
  el.addEventListener('focus', () => {
    if(extra && extra.onEnter) extra.onEnter();
    const b = el.getBoundingClientRect();
    showDonutPop(s, b.left + b.width/2, b.top + b.height/2);
  });
  el.addEventListener('blur', () => { if(extra && extra.onLeave) extra.onLeave(); hideDonutPop(); });
}

/* ---------- پاپ‌آپ اطلاعات (مشترک بین همه‌ی دایره‌ها) ---------- */
let donutPopEl = null;
function getDonutPop(){
  if(!donutPopEl){
    donutPopEl = ce('div','donut-pop');
    donutPopEl.setAttribute('role','tooltip');
    document.body.appendChild(donutPopEl);
  }
  return donutPopEl;
}
function fillDonutPop(s){
  const chips = (s.tags || [])
    .filter(t => t && t.value && !['سن','زمینه فعالیت','نوع اثر'].includes(t.label))
    .slice(0,3)
    .map(t => `<span class="donut-pop-tag"><em>${esc(t.label)}</em>${esc(t.value)}</span>`).join('');
  getDonutPop().innerHTML = `
    <div class="donut-pop-head">
      <img class="donut-pop-avatar" src="${esc(s.photo || FALLBACK)}" alt="" onerror="this.src='${FALLBACK}'">
      <div class="donut-pop-who">
        <b>${esc(s.name)}</b>
        <span>${esc(s.role || (s.type === 'company' ? 'شرکت' : 'کارآموز'))}</span>
      </div>
      <span class="type-chip${s.type === 'company' ? '' : ' is-person'}">${s.type === 'company' ? 'شرکت' : 'کارآموز'}</span>
    </div>
    ${chips ? `<div class="donut-pop-tags">${chips}</div>` : ''}
    <div class="donut-pop-project">
      <div class="donut-pop-ptitle"><small>پروژه</small><b>${esc(s.projectTitle || '—')}</b>${s.stageName ? `<span class="donut-pop-stage">${esc(s.stageName)}</span>` : ''}</div>
      <div class="donut-pop-bar"><span style="width:${s.progress}%"></span></div>
      <div class="donut-pop-pct">${fa(s.progress)}٪ پیشرفت</div>
    </div>
    <div class="donut-pop-grid">
      <div><small>شروع</small><b>${esc(s.dateStart)}</b></div>
      <div><small>پایان</small><b>${esc(s.dateEnd)}</b></div>
      <div><small>روزهای کارکرد</small><b>${fa(s.daysWorked)} روز</b></div>
      <div><small>ساعت‌های کارکرد</small><b>${fa(s.hoursWorked)} ساعت</b></div>
    </div>
    <div class="donut-pop-hint">برای رفتن به پروفایل کلیک کنید ←</div>`;
}
function placeDonutPop(x, y){
  const pop = getDonutPop(), pad = 18, m = 8;
  const w = pop.offsetWidth, h = pop.offsetHeight;
  let left = x + pad, top = y + pad;
  if(left + w > window.innerWidth - m) left = x - w - pad;
  if(top + h > window.innerHeight - m) top = window.innerHeight - h - m;
  left = Math.max(m, left); top = Math.max(m, top);
  pop.style.left = left + 'px';
  pop.style.top  = top + 'px';
}
function showDonutPop(s, x, y){
  fillDonutPop(s);
  placeDonutPop(x, y);
  getDonutPop().classList.add('is-open');
}
function hideDonutPop(){ if(donutPopEl) donutPopEl.classList.remove('is-open'); }

/* ---------- ورود به دید: تکمیل شدن دایره + شمارش درصدها ---------- */
const donutObserver = (!REDUCED && 'IntersectionObserver' in window)
  ? new IntersectionObserver(entries => {
      entries.forEach(en => { if(en.target._donutToggle) en.target._donutToggle(en.isIntersecting); });
    }, { threshold: 0.35 })
  : null;

/* شمارنده‌ی درصد: عدد را از روی عرض واقعی میله می‌خواند تا دقیقاً هم‌زمان با انیمیشن بالا برود */
function setBarNums(tr, v){
  qsa('[data-num]', tr).forEach(n => { n.textContent = fa(n.dataset.num === 'rest' ? 100 - v : v); });
}
function resetBarNums(tr){ setBarNums(tr, 0); }
function countBarUp(tr){
  const target = Number(tr.dataset.p) || 0;
  const fill = tr.querySelector('.pb-fill');
  const track = fill && fill.parentElement;
  if(!track){ return; }
  const t0 = performance.now();
  (function tick(){
    if(!tr.classList.contains('in-view')) return;
    const tw = track.getBoundingClientRect().width || 1;
    const v = Math.min(target, Math.round(fill.getBoundingClientRect().width / tw * 100));
    setBarNums(tr, v);
    if(v < target && performance.now() - t0 < 4000) requestAnimationFrame(tick);
    else setBarNums(tr, target);
  })();
}

/* جدول سوم: اطلاعات پروژه — همان جدول قبلی؛ زیر ردیف هر فرد/شرکت یک نمودار میله‌ای
   چپ ← راست (شروع پروژه سمت چپ، پایان سمت راست) نشان می‌دهد چند درصد از پروژه تکمیل شده. */
function buildTeamDataTable(teamId, { onlyId = null, search = true, title = "جدول اطلاعات پروژه‌ها" } = {}){
  const team = D.teams[teamId] || {};
  const block = ce('div','data-table-block');
  const head = ce('div','charts-table-head');
  head.innerHTML = `
    <span class="team-projects-badge">${esc(team.titleFa || '')}</span>
    <h3 class="charts-table-title">${esc(title)}</h3>`;
  block.appendChild(head);

  /* بیشترین پیشرفت بالا، کمترین پایین (در تساوی، ترتیب اصلی حفظ می‌شود) */
  const prog = pid => {
    const person = D.people[pid];
    return person ? (Number(getProjectInfo(person, D.projects['proj_' + pid]).progress) || 0) : -1;
  };
  const memberIds = (team.members || []).filter(pid => !onlyId || pid === onlyId)
    .map((pid, i) => ({ pid, i, v: prog(pid) }))
    .sort((a, b) => b.v - a.v || a.i - b.i)
    .map(x => x.pid);

  /* نوار جستجو بالای جدول: با انتخاب نام، صفحه به ردیف همان فرد می‌رود */
  const searchBar = search ? buildTableSearch(memberIds) : null;
  if(searchBar) block.appendChild(searchBar.el);

  const rows = memberIds.map(pid => {
    const person = D.people[pid];
    if(!person) return '';
    const project = D.projects['proj_' + pid];
    const info = getProjectInfo(person, project);
    const pr = Math.max(0, Math.min(100, Number(info.progress) || 0));
    const done = pr >= 100;
    const edge = pr < 9 ? 'is-edge-start' : (pr > 91 ? 'is-edge-end' : '');
    return `
      <tr class="dt-main" data-row="${esc(person.id)}">
        <td class="dt-person" data-pid="${esc(person.id)}">
          ${onlyId ? `<img class="dt-avatar" src="${esc(person.photo || FALLBACK)}" alt="" loading="lazy" onerror="this.src='${FALLBACK}'">`
            : `<a class="dt-avatar-link" href="profile.html?id=${esc(person.id)}" aria-label="پروفایل ${esc(person.name)}"><img class="dt-avatar" src="${esc(person.photo || FALLBACK)}" alt="" loading="lazy" onerror="this.src='${FALLBACK}'"></a>`}
          <span>${esc(person.name)}</span>
        </td>
        <td>${person.type === 'company' ? 'شرکت' : 'کارآموز'}</td>
        <td>${esc(info.start)}</td>
        <td>${esc(info.end)}</td>
        <td>${fa(info.daysWorked)} روز</td>
        <td>${fa(info.hoursWorked)} ساعت</td>
      </tr>
      <tr class="dt-bar-row${done ? ' is-done' : ''}" data-p="${pr}" data-row="${esc(person.id)}">
        <td colspan="6">
          <div class="pb-chart" dir="ltr">
            <div class="pb-date pb-date-start"><small>شروع پروژه</small><b>${esc(info.start)}</b></div>
            <div class="pb-plot">
              <div class="pb-track" role="img" aria-label="${esc(person.name)}: ${pr}٪ از پروژه تکمیل شده">
                <div class="pb-fill" style="--p:${pr}%">${pr >= 20 ? `<span class="pb-in"><span data-num="done">${fa(0)}</span>٪ تکمیل شده</span>` : ''}</div>
                ${pr <= 80 ? `<span class="pb-rest"><span data-num="rest">${fa(100)}</span>٪ باقی‌مانده</span>` : ''}
                <div class="pb-ticks"><i></i><i></i><i></i></div>
                <div class="pb-marker ${edge}" style="--p:${pr}%">
                  <span class="pb-pct">${done ? '<svg viewBox="0 0 16 16" width="9" height="9" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}<span class="pb-pctnum"><span data-num="done">${fa(0)}</span>٪</span></span>
                  <span class="pb-dot"></span>
                </div>
              </div>
            </div>
            <div class="pb-date pb-date-end"><small>پایان پروژه</small><b>${esc(info.end)}</b></div>
          </div>
        </td>
      </tr>`;
  }).join('');

  const wrap = ce('div','data-table-wrap');
  wrap.innerHTML = `
    <table class="data-table has-bars">
      <thead><tr>
        <th>نام</th><th>نوع</th><th>تاریخ شروع</th><th>تاریخ پایان</th>
        <th>روزهای کارکرد</th><th>ساعت‌های کارکرد</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  qsa('.dt-person', wrap).forEach(td => {
    const person = D.people[td.dataset.pid];
    if(!person) return;
    attachPersonPop(qs('.dt-avatar-link', td) || td, personPopInfo(person));
  });
  /* دایره‌ی نارنجی روی نوار پیشرفت: مثل عکس، با ایستادن اطلاعات فرد را نشان می‌دهد و با کلیک به پروفایل می‌رود */
  qsa('.dt-bar-row', wrap).forEach(tr => {
    const person = D.people[tr.dataset.row];
    const dot = qs('.pb-dot', tr);
    if(!person || !dot) return;
    attachPersonPop(dot, personPopInfo(person));
    if(onlyId) return;                          // داخل خود پروفایل، لینک به همان صفحه بی‌معناست
    dot.classList.add('is-link');
    dot.tabIndex = 0;
    dot.setAttribute('role','link');
    dot.setAttribute('aria-label', 'پروفایل ' + person.name);
    const go = () => { location.href = `profile.html?id=${encodeURIComponent(person.id)}`; };
    dot.addEventListener('click', go);
    dot.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); go(); } });
  });
  /* پر شدن میله‌ها هنگام دیده‌شدن + شمارش درصد از ۰ تا عدد نهایی، هم‌زمان با خود میله */
  const barObserver = ('IntersectionObserver' in window)
    ? new IntersectionObserver(entries => {
        entries.forEach(en => {
          const tr = en.target;
          tr.classList.toggle('in-view', en.isIntersecting);
          if(en.isIntersecting) countBarUp(tr); else resetBarNums(tr);
        });
      }, { threshold: 0.3 })
    : null;
  qsa('.dt-bar-row', wrap).forEach((tr, i) => {
    tr.style.setProperty('--i', Math.min(i, 5));
    if(barObserver) barObserver.observe(tr);
    else { tr.classList.add('in-view'); countBarUp(tr); }
  });
  block.appendChild(wrap);
  if(searchBar) searchBar.bind(wrap);
  settle(block);
  return block;
}

/* =========================================================================
   نوار جستجوی بالای جدول اطلاعات پروژه (برای همه‌ی حوزه‌ها)
   با تایپ نام، فهرست پیشنهادها باز می‌شود؛ با کلیک یا Enter به ردیف همان فرد می‌رود
========================================================================= */
function normFa(s){
  return String(s == null ? '' : s)
    .replace(/[يى]/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200f\u200e]/g,' ')
    .replace(/[\u064B-\u0652]/g,'').replace(/\s+/g,' ').trim().toLowerCase()
    .replace(/[۰-۹]/g, d => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}
function buildTableSearch(memberIds){
  const el = ce('div','table-search');
  el.innerHTML = `
    <div class="table-search__field">
      ${I.search}
      <input type="text" class="table-search__input" placeholder="جستجوی نام فرد یا شرکت در جدول…" autocomplete="off" aria-label="جستجو در جدول اطلاعات پروژه">
      <button type="button" class="table-search__clear" aria-label="پاک کردن" hidden>×</button>
    </div>
    <div class="table-search__results" role="listbox"></div>`;
  const input = qs('input', el), box = qs('.table-search__results', el), clear = qs('.table-search__clear', el);
  const people = memberIds.map(id => D.people[id]).filter(Boolean);
  let hits = [], cursor = 0, tableWrap = null;

  const jump = person => {
    if(!tableWrap) return;
    const rows = qsa(`[data-row="${CSS.escape(person.id)}"]`, tableWrap);
    if(!rows.length) return;
    box.classList.remove('show');
    input.value = person.name; clear.hidden = false;
    qsa('.dt-flash', tableWrap).forEach(r => r.classList.remove('dt-flash'));
    const first = rows[0];
    const top = first.getBoundingClientRect().top + window.scrollY - 150;
    window.scrollTo({ top: Math.max(0, top), behavior: REDUCED ? 'auto' : 'smooth' });
    void first.offsetWidth;
    rows.forEach(r => r.classList.add('dt-flash'));
    setTimeout(() => rows.forEach(r => r.classList.remove('dt-flash')), 2600);
  };

  const paint = raw => {
    const q = normFa(raw);
    clear.hidden = !raw;
    if(!q){ box.classList.remove('show'); box.innerHTML = ''; hits = []; return; }
    hits = people.filter(p => normFa(p.name).includes(q) || normFa(roleOf(p)).includes(q)).slice(0, 8);
    cursor = 0;
    box.innerHTML = hits.length ? hits.map((p,i) => `
      <div class="search-result-item${i === 0 ? ' on' : ''}" data-id="${esc(p.id)}" role="option">
        <img src="${esc(p.photo || FALLBACK)}" alt="" onerror="this.src='${FALLBACK}'">
        <div><div class="search-result-name">${esc(p.name)}</div>
        <div class="search-result-team">${p.type === 'company' ? 'شرکت/گروه' : 'کارآموز'}${roleOf(p) ? ' — ' + esc(roleOf(p)) : ''}</div></div>
      </div>`).join('') : '<div class="search-empty">نتیجه‌ای در این جدول پیدا نشد</div>';
    box.classList.add('show');
  };
  const move = step => {
    if(!hits.length) return;
    cursor = (cursor + step + hits.length) % hits.length;
    qsa('.search-result-item', box).forEach((n,i) => n.classList.toggle('on', i === cursor));
  };

  input.addEventListener('input', () => paint(input.value));
  input.addEventListener('focus', () => { if(input.value.trim()) paint(input.value); });
  input.addEventListener('keydown', e => {
    if(e.key === 'ArrowDown'){ e.preventDefault(); move(1); }
    else if(e.key === 'ArrowUp'){ e.preventDefault(); move(-1); }
    else if(e.key === 'Enter'){ e.preventDefault(); if(hits[cursor]) jump(hits[cursor]); }
    else if(e.key === 'Escape'){ box.classList.remove('show'); input.blur(); }
  });
  box.addEventListener('click', e => {
    const item = e.target.closest('.search-result-item[data-id]');
    if(item){ const p = D.people[item.dataset.id]; if(p) jump(p); }
  });
  clear.addEventListener('click', () => { input.value = ''; paint(''); input.focus(); });
  document.addEventListener('click', e => { if(!el.contains(e.target)) box.classList.remove('show'); });

  return { el, bind: w => { tableWrap = w; } };
}

/* -------------------- تایم‌لاین پیشرفت (نمودار ماهانه) -------------------- */
const PERSIAN_MONTHS = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const TL_LINE_COLORS = ['--orange','--teal','--purple','--cyan','--green','--orange-lo','--teal-lo','--cyan-lo'];

function buildTimelineMonths(){
  const months = [];
  [1404, 1405].forEach(y => {
    for(let m = 1; m <= 12; m++){
      months.push({ key:`${y}-${String(m).padStart(2,'0')}`, label:PERSIAN_MONTHS[m-1], year:y, mIdx:m-1 });
    }
  });
  return months;
}
const TIMELINE_MONTHS = buildTimelineMonths();
const TL_COL = 30;        /* عرض هر ستون ماه، پیکسل */
const TL_ROW_H = 42;      /* ارتفاع هر بانِد مرحله، پیکسل */
const TL_PAD = 14;        /* حاشیه‌ی بالا/پایین نمودار */
const TL_LABEL_QUARTERS = [0,3,6,9,12,15,18,21]; /* فروردین و تیر هر سال، برای کم‌شلوغ ماندن محور */

function buildTimelineAxis(plotW){
  const cells = TIMELINE_MONTHS.map((m,i) => {
    const showLabel = TL_LABEL_QUARTERS.includes(i);
    return `<span class="tl-axis-cell" style="width:${TL_COL}px">${showLabel ? `${esc(m.label)}<b>${fa(m.year)}</b>` : ''}</span>`;
  }).join('');
  return `<div class="tl-axis-row" style="width:${plotW}px">${cells}</div>`;
}

/* نمودار واحد: محور Y همان مرحله‌های پروژه (stages) است، هر پروژه یک خط رنگی */
function buildTimelineSVG(items, stages){
  const maxStage = stages.length - 1;
  const plotW = TIMELINE_MONTHS.length * TL_COL;
  const plotH = TL_PAD*2 + maxStage*TL_ROW_H;
  /* محور ماه‌ها به‌خاطر چیدمان RTL از راست (فروردین ۱۴۰۴) به چپ (اسفند ۱۴۰۵) پیش می‌رود،
     پس مختصات x نمودار باید آینه شود تا با محور ماه‌ها هم‌تراز بماند */
  const yearSplitX = plotW - 12 * TL_COL;

  const yOf = stage => TL_PAD + (maxStage - stage) * TL_ROW_H;
  const xOf = idx => plotW - (idx*TL_COL + TL_COL/2);

  const gridLines = stages.map((label,i) => {
    const y = yOf(i);
    return `<line x1="0" y1="${y}" x2="${plotW}" y2="${y}" class="tl-grid-h"/>`;
  }).join('') + `<line x1="${yearSplitX}" y1="0" x2="${yearSplitX}" y2="${plotH}" class="tl-grid-line"/>`;

  /* خطوط ابتدا رسم می‌شوند و نشونه‌ی وضعیت فعلی (آخرین نقطه‌ی هر خط) جدا و روی همه‌ی خطوط
     نگه داشته می‌شود تا وقتی چند خط به هم نزدیک‌اند، نشونه‌ها گم یا قاطی نشوند */
  const paths = [];
  const markers = [];

  items.forEach((proj, li) => {
    const color = `var(${TL_LINE_COLORS[li % TL_LINE_COLORS.length]})`;
    const pts = (proj.history || [])
      .map(h => ({ idx: TIMELINE_MONTHS.findIndex(m => m.key === h.month), stage: h.stage }))
      .filter(p => p.idx !== -1)
      .sort((a,b) => a.idx - b.idx);
    if(!pts.length) return;

    const xy = p => [ xOf(p.idx), yOf(p.stage) ];
    const pathD = pts.map((p,i) => {
      const [x,y] = xy(p);
      return (i === 0 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1);
    }).join(' ');

    const person = D.people[proj.personId];
    const last = pts[pts.length - 1];
    const [lx, ly] = xy(last);

    paths.push(`<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`);
    if(person){
      markers.push({ person, color, note: proj.note || '', stage: last.stage, x: lx, y: ly, dx: 0, dy: 0 });
    }
  });

  /* وقتی چند نفر دقیقاً در یک ماه و یک مرحله‌ی یکسان‌اند (مثلاً همه «شروع نشده»)،
     لوزی‌ها روی هم می‌افتند و بعضی‌ها کامل زیر بقیه پنهان می‌شوند؛ اینجا آن‌ها را
     در یک شبکه‌ی منظم و مساوی از هم باز می‌کنیم تا همه‌شان دیده و جدا-جدا قابل هاور باشند */
  const MK_SPACING_X = 15, MK_SPACING_Y = 16, MK_PER_ROW = 4;
  const groups = new Map();
  markers.forEach(m => {
    const key = m.x.toFixed(1) + '_' + m.y.toFixed(1);
    if(!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  });
  groups.forEach(group => {
    const n = group.length;
    if(n <= 1) return;
    const rows = Math.ceil(n / MK_PER_ROW);
    group.forEach((m, j) => {
      const row = Math.floor(j / MK_PER_ROW);
      const rowStart = row * MK_PER_ROW;
      const itemsInRow = Math.min(MK_PER_ROW, n - rowStart);
      const col = j - rowStart;
      const rowWidth = (itemsInRow - 1) * MK_SPACING_X;
      m.dx = -rowWidth/2 + col*MK_SPACING_X;
      m.dy = (row - (rows-1)/2) * MK_SPACING_Y;
    });
  });

  const endpoints = markers.map(m => {
    const mx = m.x + m.dx, my = m.y + m.dy;
    /* لوزی کمی بزرگ‌تر به‌جای دایره، فقط روی آخرین نقطه‌ی هر خط (وضعیت فعلی همان پروژه)؛
       اطلاعات کامل فرد با هاور روی همین لوزی نمایش داده می‌شود (نگاه کنید به wireTimelineTooltips) */
    return `<g class="tl-endpoint" data-person="${esc(m.person.id)}" data-stage="${m.stage}" data-note="${esc(m.note)}" tabindex="0" transform="translate(${mx.toFixed(1)} ${my.toFixed(1)}) rotate(45)"><rect x="-5" y="-5" width="10" height="10" rx="1.6" fill="${m.color}" stroke="var(--paper)" stroke-width="1.6"/></g>`;
  }).join('');

  const lines = paths.join('') + endpoints;

  return { plotW, plotH,
    svg: `<svg class="timeline-chart-svg" viewBox="0 0 ${plotW} ${plotH}" preserveAspectRatio="none" style="height:${plotH}px">${gridLines}${lines}</svg>` };
}

/* -------------------- تولتیپ اطلاعات فرد، روی لوزی‌های نمودار -------------------- */
let TL_TOOLTIP_EL = null;
function getTimelineTooltip(){
  if(!TL_TOOLTIP_EL){
    TL_TOOLTIP_EL = ce('div','tl-tooltip');
    document.body.appendChild(TL_TOOLTIP_EL);
    /* روی موبایل، با لمس هر نقطه‌ی دیگر یا اسکرول کردن، کارت اطلاعات بسته شود */
    document.addEventListener('touchstart', e => {
      if(!e.target.closest('.tl-endpoint')) TL_TOOLTIP_EL.classList.remove('is-visible');
    }, { passive:true });
    document.addEventListener('scroll', () => TL_TOOLTIP_EL.classList.remove('is-visible'), true);
  }
  return TL_TOOLTIP_EL;
}

function timelineTooltipHTML(person, note){
  const team = D.teams[person.team];
  const tagsHtml = (person.tags || []).map(t => `
    <div class="tl-tooltip-tag"><span class="k">${esc(t.label)}</span><span class="v">${esc(num(t.value) || '—')}</span></div>`).join('');
  return `
    <div class="tl-tooltip-head">
      <img class="tl-tooltip-avatar" src="${esc(person.photo || FALLBACK)}" alt="" onerror="this.src='${FALLBACK}'">
      <div class="tl-tooltip-id">
        <div class="tl-tooltip-name">${esc(person.name)}</div>
        <div class="tl-tooltip-team">${esc(team ? team.titleFa : '')}${team ? ' · ' : ''}${person.type === 'company' ? 'شرکت/گروه' : 'کارآموز'}</div>
      </div>
    </div>
    ${tagsHtml ? `<div class="tl-tooltip-tags">${tagsHtml}</div>` : ''}
    ${note ? `<div class="tl-tooltip-note">${esc(note)}</div>` : ''}`;
}

function positionTimelineTooltip(tooltip, x, y){
  const pad = 10;
  const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
  let left = x - w/2;
  let top = y - h - 16;
  if(top < pad) top = y + 20;
  if(left < pad) left = pad;
  if(left + w > window.innerWidth - pad) left = window.innerWidth - w - pad;
  tooltip.style.left = left + 'px';
  tooltip.style.top = top + 'px';
}

/* روی هر لوزی (وضعیت فعلی هر خط)، با هاور یا لمس، کارت اطلاعات فرد باز می‌شود
   و با دور کردن ماوس/انگشت بسته می‌شود — بدون نیاز به رفتن به صفحه‌ی پروفایل */
function wireTimelineTooltips(root){
  const tooltip = getTimelineTooltip();

  qsa('.tl-endpoint', root).forEach(g => {
    const person = D.people[g.getAttribute('data-person')];
    if(!person) return;
    const note = g.getAttribute('data-note') || '';

    const open = (x, y) => {
      tooltip.innerHTML = timelineTooltipHTML(person, note);
      tooltip.classList.add('is-visible');
      positionTimelineTooltip(tooltip, x, y);
    };
    const close = () => tooltip.classList.remove('is-visible');

    g.addEventListener('mouseenter', e => open(e.clientX, e.clientY));
    g.addEventListener('mousemove', e => positionTimelineTooltip(tooltip, e.clientX, e.clientY));
    g.addEventListener('mouseleave', close);
    g.addEventListener('focus', () => { const r = g.getBoundingClientRect(); open(r.left + r.width/2, r.top); });
    g.addEventListener('blur', close);
    g.addEventListener('touchstart', e => {
      const t = e.touches[0];
      open(t.clientX, t.clientY);
    }, { passive:true });
  });
}

function buildProjectsTimeline(items){
  const stages = D.stages || [];
  const block = ce('div','timeline-block');
  block.innerHTML = `<div class="timeline-title">نمودار پیشرفت پروژه‌ها <span>فروردین ۱۴۰۴ تا اسفند ۱۴۰۵</span></div>`;

  const wrap = ce('div','timeline-wrap');

  const outer = ce('div','tl-outer');

  /* محور Y — نام مرحله‌ها، از تکمیل‌شده در بالا تا شروع‌نشده در پایین */
  const yaxis = ce('div','tl-yaxis');
  yaxis.innerHTML = stages.slice().reverse().map(label => `<span class="tl-yaxis-label">${esc(label)}</span>`).join('');
  outer.appendChild(yaxis);

  /* ناحیه‌ی اسکرول‌شونده: نمودار + محور ماه‌ها */
  const scroller = ce('div','timeline-scroll');
  const { plotW, svg } = buildTimelineSVG(items, stages);
  scroller.innerHTML = `
    <div class="tl-plot" style="width:${plotW}px">${svg}</div>
    ${buildTimelineAxis(plotW)}
  `;
  outer.appendChild(scroller);

  wrap.appendChild(outer);
  block.appendChild(wrap);

  /* راهنما: عکس و اسم هر فرد/شرکت، با کلیک می‌رود به پروفایل خودش */
  const legend = ce('div','tl-legend');
  items.forEach((proj, li) => {
    const person = D.people[proj.personId];
    if(!person) return;
    const color = `var(${TL_LINE_COLORS[li % TL_LINE_COLORS.length]})`;
    const chip = ce('a','tl-legend-item');
    chip.href = `profile.html?id=${esc(person.id)}`;
    chip.title = `مشاهده‌ی پروفایل ${person.name}`;
    chip.innerHTML = `
      <span class="tl-legend-dot" style="background:${color}"></span>
      <img class="tl-legend-avatar" src="${esc(person.photo || FALLBACK)}" alt="" loading="lazy" onerror="this.src='${FALLBACK}'">
      <span class="tl-legend-name">${esc(person.name)}</span>`;
    legend.appendChild(chip);
  });
  block.appendChild(legend);

  wireTimelineTooltips(block);
  settle(block);
  return block;
}

/* =========================================================================
   صفحه‌ی پروژه‌ها — وضعیت پروژه‌های همه‌ی بخش‌ها، جدا از هم
========================================================================= */
function renderProjects(){
  document.title = `پروژه‌های در دست انجام | ${D.site.name}`;
  chrome({ back:'index.html' });

  const c = ce('div','container');

  const head = ce('div','team-header');
  head.appendChild(ce('div','team-badge','پروژه‌ها'));
  head.appendChild(ce('h1','team-title','پروژه‌های در دست انجام'));
  head.appendChild(ce('p','team-subtitle',
    'مرحله‌ی فعلی پروژه‌ی هر فرد و شرکت، به تفکیک هر بخش. این اطلاعات از js/data.js خوانده می‌شود و هر فرد می‌تواند مرحله‌ی خودش را (مثلاً هفته‌ای یک‌بار) همان‌جا به‌روزرسانی کند.'));
  c.appendChild(head);

  D.menu.filter(m => m.id !== 'projects').map(m => m.id).forEach(teamId => {
    if(D.teams[teamId]) c.appendChild(buildTeamProjectsSection(teamId, { showHeader:true }));
  });

  document.body.appendChild(c);
}

/* =========================================================================
   صفحه‌ی پروفایل — بج بنفش «نمونه کارها» + کارت مشخصات + قاب‌ها
========================================================================= */
/* =========================================================================
   بخش «پروژه‌ها» در پروفایل فرد/شرکت: همه‌ی پروژه‌های ثبت‌شده برای او، به‌صورت کارت
========================================================================= */
function projectCategory(pr, stage){
  const last = Math.max(1, (D.stages || []).length - 1);
  return (stage >= last || pr >= 100) ? 'done' : (stage >= 2 || pr > 0) ? 'active' : 'planned';
}
/* لینک پروژه را به یک «رسانه‌ی قابل نمایش» تبدیل می‌کند: ویدیو، بازی، تصویر یا فقط لینک */
function projectMedia(link, kind){
  const u = String(link || '').trim();
  if(!/^https?:\/\//i.test(u) || kind === 'link') return { type:'link' };
  if(kind === 'game') return { type:'game', src:u };
  if(kind === 'image' || ((!kind || kind === 'auto') && /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(u))) return { type:'image', src:u };
  let m;
  if((m = u.match(/aparat\.com\/v\/([A-Za-z0-9]+)/i))) return { type:'embed', src:`https://www.aparat.com/video/video/embed/videohash/${m[1]}/vt/frame` };
  if((m = u.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i))) return { type:'embed', src:`https://www.youtube-nocookie.com/embed/${m[1]}` };
  if((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i))) return { type:'embed', src:`https://player.vimeo.com/video/${m[1]}` };
  if(/\.(mp4|webm|ogv)(\?.*)?$/i.test(u)) return { type:'file', src:u };
  if(kind === 'video') return { type:'embed', src:u };            // لینک آماده‌ی embed
  return { type:'link' };
}
function projectMediaHTML(md, title){
  const IF = 'allow="fullscreen; autoplay; gamepad; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-pointer-lock allow-forms"';
  if(md.type === 'embed') return `<div class="pp-media"><div class="video-embed"><iframe src="${esc(md.src)}" title="${esc(title)}" loading="lazy" ${IF}></iframe></div></div>`;
  if(md.type === 'file')  return `<div class="pp-media"><video controls preload="metadata" playsinline src="${esc(md.src)}"></video></div>`;
  if(md.type === 'image') return `<div class="pp-media is-image"><img src="${esc(md.src)}" alt="${esc(title)}" loading="lazy"></div>`;
  if(md.type === 'game')  return `<div class="pp-media pp-game" data-src="${esc(md.src)}" data-title="${esc(title)}"><button type="button" class="pp-play"><span class="pp-play-ico">▶</span><b>اجرای بازی</b><small>برای شروع کلیک کنید</small></button></div>`;
  return '';
}

function buildPersonProjects(p){
  /* فقط خودِ پروژه نمایش داده می‌شود (ویدیو / بازی / تصویر)، نه اطلاعات آن */
  const items = Object.values(D.projects || {}).filter(x => x.personId === p.id).map(x => ({ x, md: projectMedia(x.link, x.kind) }))
    .sort((a, b) => (b.md.type !== 'link' || !!b.x.image) - (a.md.type !== 'link' || !!a.x.image) || a.x.title.localeCompare(b.x.title, 'fa'));
  const hasLink = x => /^https?:\/\//i.test(x.link || '');
  const mediaOf = ({ x, md }) => {
    const title = x.title || 'پروژه';
    if(md.type === 'game' && x.image) return projectMediaHTML(md, title).replace('class="pp-media pp-game"', `class="pp-media pp-game" style="background-image:linear-gradient(rgba(14,40,65,.45),rgba(14,40,65,.45)),url('${esc(x.image)}');background-size:cover;background-position:center"`);
    if(md.type !== 'link') return projectMediaHTML(md, title);
    if(x.image) return hasLink(x)
      ? `<a class="pp-media is-image" href="${esc(x.link)}" target="_blank" rel="noopener noreferrer"><img src="${esc(x.image)}" alt="${esc(title)}" loading="lazy"></a>`
      : `<div class="pp-media is-image"><img src="${esc(x.image)}" alt="${esc(title)}" loading="lazy"></div>`;
    return `<div class="pp-media pp-slot"><span class="slot-icon">${I.frame}</span><b>جای این پروژه خالی است</b><small>پروژه بعداً اینجا قرار می‌گیرد</small></div>`;
  };

  const sec = ce('section','person-projects');
  sec.id = 'person-projects';
  sec.innerHTML = `
    <div class="pp-head">
      <h3 class="pp-title">پروژه‌ها</h3>
      <span class="pp-count">${esc(fa(items.length))} پروژه</span>
    </div>
    ${items.length ? `<div class="pp-grid">${items.map(it => `
      <article class="pp-card">
        ${mediaOf(it)}
        <div class="pp-body">
          <h4 class="pp-name">${esc(it.x.title || 'پروژه بدون عنوان')}</h4>
          ${it.x.note ? `<p class="pp-note">${esc(it.x.note)}</p>` : ''}
          ${hasLink(it.x) && (it.md.type !== 'link' || !it.x.image) ? `<a class="pp-open${it.md.type !== 'link' ? ' is-ghost' : ''}" href="${esc(it.x.link)}" target="_blank" rel="noopener noreferrer">${it.md.type === 'link' ? 'مشاهده پروژه' : 'باز کردن در صفحه‌ی جدید'} <span aria-hidden="true">↗</span></a>` : ''}
        </div>
      </article>`).join('')}</div>`
    : '<div class="pp-empty">هنوز پروژه‌ای برای این پروفایل ثبت نشده است.</div>'}`;
  settle(sec);
  /* بازی: با کلیک اجرا می‌شود (تا صفحه سنگین نشود) */
  qsa('.pp-game', sec).forEach(box => {
    const btn = qs('.pp-play', box);
    btn.addEventListener('click', () => {
      box.classList.add('is-live'); box.style.backgroundImage = 'none';
      box.innerHTML = `<div class="video-embed"><iframe src="${esc(box.dataset.src)}" title="${esc(box.dataset.title)}" allow="fullscreen; autoplay; gamepad; pointer-lock" allowfullscreen referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-popups allow-pointer-lock allow-forms"></iframe></div>`;
    });
  });
  return sec;
}

function renderProfile(){
  const id = param('id');
  const p = D.people[id];
  if(!p) return oops('این پروفایل پیدا نشد.');

  const team = D.teams[p.team] || { titleFa:'', title:'' };
  document.title = `${p.name} | ${D.site.name}`;
  chrome({ back:`team.html?id=${p.team}` });

  const c = ce('div','container');

  const top = ce('div','profile-top');
  top.appendChild(ce('div','sample-badge', I.film + '<span>نمونه کارها</span>'));
  c.appendChild(top);

  const layout = ce('div','profile-layout');

  /* کارت مشخصات */
  const card = ce('div','profile-card');
  card.innerHTML = `
    <div class="profile-photo-wrap">
      <span class="photo-arc"></span>
      <img class="profile-photo" src="${esc(p.photo || FALLBACK)}" alt="${esc(p.name)}" onerror="this.src='${FALLBACK}'">
    </div>
    <div class="profile-name">${esc(p.name)}</div>
    <div class="profile-type">
      <span class="type-chip${p.type === 'company' ? '' : ' is-person'}">${p.type === 'company' ? 'شرکت/گروه' : 'کارآموز'}</span>
    </div>
    ${internField(p) ? `<div class="profile-prog"><div class="pp-label"><span>پیشرفت آموزشی — ${esc(internField(p).title)}</span><b>${esc(fa(internPct(p)))}٪</b></div><div class="mini-prog lg"><i style="width:${internPct(p)}%"></i></div></div>` : ''}
    <div class="spec-head">مشخصات</div>
    <div class="tag-list">
      ${(p.tags || []).map(t => `
        <div class="tag-chip">
          <span class="tag-label">${esc(t.label)}</span>
          <span class="tag-value">${esc(num(t.value) || '—')}</span>
        </div>`).join('')}
    </div>
    <a class="back-strip" href="team.html?id=${esc(p.team)}">${I.back}<span>بازگشت به ${esc(team.titleFa)}</span></a>`;
  settle(card);
  layout.appendChild(card);

  /* نمونه‌کارها */
  const area = ce('div','samples-area');
  const iF = internField(p);
  if(iF){
    const done = new Set(p.internDone || []);
    const n = iF.tasks.filter(t => done.has(t.id)).length;
    const box = ce('div','intern-check');
    box.innerHTML = `<div class="ic-head"><h3>چک‌لیست آموزشی — ${esc(iF.title)}</h3><span>${esc(fa(n))} از ${esc(fa(iF.tasks.length))} وظیفه</span></div>
      <ul>${iF.tasks.map(t => `<li class="${done.has(t.id) ? 'is-done' : ''}"><i aria-hidden="true">${done.has(t.id) ? '✓' : ''}</i><span>${esc(t.title)}</span></li>`).join('')}</ul>`;
    area.appendChild(box);
  }
  (p.samples || []).forEach(s => {
    const box = ce('div','sample-box');
    let media, state;

    if(s.video){
      media = `<div class="sample-media has-video"><div class="video-embed">
        <iframe src="${esc(s.video)}" title="${esc(s.title)}" allowfullscreen loading="lazy"></iframe></div></div>`;
      state = '<span class="sample-state ready">ویدیو</span>';
    }else if(s.image){
      media = `<div class="sample-media"><img src="${esc(s.image)}" alt="${esc(s.title)}" loading="lazy"></div>`;
      state = '<span class="sample-state ready">منتشر شده</span>';
    }else{
      media = `
        <div class="sample-media">
          <span class="slot">
            <span class="slot-icon">${I.frame}</span>
            <b>جای این نمونه‌کار خالی است</b>
            <small>تصویر یا ویدیو بعداً اینجا قرار می‌گیرد</small>
          </span>
        </div>`;
      state = '<span class="sample-state">در انتظار فایل</span>';
    }

    box.innerHTML = `
      <div class="sample-title"><span>${esc(s.title)}</span>${state}</div>
      ${media}
      ${s.link ? `<a class="sample-link" href="${esc(s.link)}" target="_blank" rel="noopener">${I.link}مشاهده‌ی کامل</a>` : ''}`;
    settle(box);
    area.appendChild(box);
  });
  layout.appendChild(area);

  c.appendChild(layout);

  /* بخش پروژه‌های همین فرد/شرکت */
  c.appendChild(buildPersonProjects(p));

  /* زیر نمونه‌کارها: فقط ردیف و اطلاعات پروژه‌ی خودِ همین فرد/شرکت */
  if(D.projects['proj_' + p.id] && team.members && team.members.includes(p.id)){
    const info = buildTeamDataTable(p.team, { onlyId:p.id, search:false, title:'اطلاعات پروژه‌ی در دست انجام' });
    info.id = 'project-info';
    c.appendChild(info);
  }
  document.body.appendChild(c);

  /* ورود از نتیجه‌ی جستجوی «پروژه»: به جدول پروژه برو و ردیف را هایلایت کن */
  if(location.hash === '#project-info'){
    const target = qs('#project-info');
    if(target) setTimeout(() => {
      target.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block:'center' });
      const rows = qsa('[data-row]', target);
      rows.forEach(r => r.classList.add('dt-flash'));
      setTimeout(() => rows.forEach(r => r.classList.remove('dt-flash')), 2600);
    }, 450);
  }

  tilt(card, card, 3.5);
}

/* ------------------------------ خطا ------------------------------ */
function oops(msg){
  chrome();
  const c = ce('div','container');
  c.innerHTML = `
    <div style="padding:160px 0 120px;text-align:center">
      <h1 style="font-size:24px">${esc(msg)}</h1>
      <p style="margin-top:12px;color:var(--muted)">ممکن است آدرس صفحه تغییر کرده باشد.</p>
      <a class="back-strip" style="max-width:260px;margin:24px auto 0" href="index.html">${I.home}<span>بازگشت به صفحه اصلی</span></a>
    </div>`;
  document.body.appendChild(c);
}
