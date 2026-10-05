/* ===================================================================
   هیرو سینمایی صفحه‌ی اول
   - صحنه‌ی sticky با پیشرفت (progress) وابسته به اسکرول واقعی (بدون دست‌بردن در اسکرول)
   - میرایی (damping) نرم برای حس دوربین، بدون هیچ کتابخانه‌ی بیرونی
   - داده‌ها از SITE_DATA خوانده می‌شود؛ با ویرایش js/data.js فصل‌ها خودکار به‌روز می‌شوند
=================================================================== */
const Cinema = (() => {
  const REDUCED_ = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const smooth = t => t * t * (3 - 2 * t);
  const fa = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

  /* رنگ هر حوزه روی زمینه‌ی تیره (نسخه‌ی روشن‌تر رنگ‌های برند) */
  const ACCENTS = { game: '#ff8a4c', cinema: '#4f8cff', '2d': '#c85bd8', '3d': '#18c8e8' };
  const ACCENT_FALLBACK = ['#ff8a4c', '#4f8cff', '#c85bd8', '#18c8e8'];
  const BASE = '#ff8a4c';

  /* زمان‌بندی روی محور پیشرفت (۰ تا ۱) */
  const CH0 = 0.17, CHW = 0.16;              // شروع و پهنای هر فصل
  const TITLE_OUT = [0.05, 0.16];             // محو شدن عنوان
  const OUTRO_IN = [0.81, 0.89];              // ورود جمع‌بندی
  const SHRINK_AT = 0.94;                     // شروع کوچک شدن قاب در پایان
  const FILM_SECONDS = 52;                    // برای تایم‌کد نمایشی

  function chapterWeight(tt) {
    if (tt <= 0 || tt >= 1) return { w: 0, enter: 0, exit: 1 };
    const enter = smooth(clamp(tt / 0.26));
    const exit = 1 - smooth(clamp((tt - 0.74) / 0.26));
    return { w: enter * exit, enter, exit };
  }

  /* درون‌یابی کلیدفریم‌ها برای حرکت دوربین/کره */
  function sample(kfs, p) {
    if (p <= kfs[0][0]) return kfs[0][1];
    for (let i = 1; i < kfs.length; i++) {
      if (p <= kfs[i][0]) {
        const [p0, a] = kfs[i - 1], [p1, b] = kfs[i];
        const t = smooth(clamp((p - p0) / (p1 - p0)));
        const o = {};
        for (const k in a) o[k] = lerp(a[k], b[k], t);
        return o;
      }
    }
    return kfs[kfs.length - 1][1];
  }

  function mount(D, info, before) {
    const chapters = (D.menu || []).filter(m => m.id !== 'projects').map((m, i) => ({
      id: m.id,
      short: String(m.label || '').split(' ')[0].toUpperCase(),
      fa: m.labelFa || m.label,
      team: (D.teams || {})[m.id] || {},
      color: ACCENTS[m.id] || ACCENT_FALLBACK[i % 4]
    }));
    if (!chapters.length) return null;
    const N = chapters.length;

    const words = String(D.site.headline || D.site.title || '').split(/\s+/).filter(Boolean);
    const root = document.createElement('section');
    root.className = 'cine';
    root.setAttribute('aria-label', 'معرفی سینمایی مرکز');

    const chHTML = chapters.map((c, i) => {
      const st = (c.team.stats || []).slice(0, 3);
      const faWords = String(c.fa).split(' ');
      const last = faWords.pop();
      const title = (faWords.length ? esc(faWords.join(' ')) + ' ' : '') + `<em>${esc(last)}</em>`;
      return `
      <article class="cine-ch" data-i="${i}" style="--c:${c.color}">
        <div class="ch-en" aria-hidden="true">${esc(c.short)}</div>
        <div class="ch-in">
          <div class="ch-num"><span>0${i + 1}</span><i></i><span>0${N}</span></div>
          <h2 class="ch-fa">${title}</h2>
          <p class="ch-sub">${esc(c.team.subtitle || '')}</p>
          <ul class="ch-stats">
            ${st.map((s, j) => {
              const v = String(s.value == null ? '' : s.value);
              const isNum = /^\d+$/.test(v.trim());
              return `<li style="--i:${j}"><b ${isNum ? `data-n="${esc(v.trim())}"` : ''}>${isNum ? '۰' : esc(v)}</b><span>${esc(s.label)}</span></li>`;
            }).join('')}
          </ul>
          <a class="ch-link" href="team.html?id=${esc(c.id)}" tabindex="-1">ورود به حوزه‌ی ${esc(c.fa)} <span>←</span></a>
        </div>
      </article>`;
    }).join('');

    root.innerHTML = `
    <div class="cine-stage">
      <canvas class="cine-canvas" aria-hidden="true"></canvas>
      <div class="cine-wash" aria-hidden="true"></div>

      <div class="cine-orb" aria-hidden="true">
        <span class="orb-glow"></span>
        <div class="orb-3d">
          <span class="orb-ring r1"></span><span class="orb-ring r2"></span><span class="orb-ring r3"></span>
        </div>
        <span class="orb-core"><b>پارک</b><small>علم و فناوری</small></span>
        ${chapters.map((c, i) => `<span class="orb-node" style="--c:${c.color}">${esc(c.short)}</span>`).join('')}
      </div>
      <div class="cine-flare" aria-hidden="true"></div>

      <header class="cine-brand">
        <a href="index.html" aria-label="صفحه اصلی">
          <span class="bm">پارک<br>علم</span>
          <span><b>${esc(D.site.name)}</b><small>${esc(D.site.nameLatin || '')}</small></span>
        </a>
      </header>

      <div class="cine-title">
        <div class="cine-kicker"><i></i>${esc(D.site.nameLatin || 'پارک علم و فناوری')}<i></i></div>
        <h1>${words.map((w, i) => `<span class="w"><span style="--wi:${i}">${esc(w)}</span></span>`).join(' ')}</h1>
        <p class="cine-lead">${esc(D.site.lead || '')}</p>
      </div>

      ${chHTML}

      <div class="cine-outro">
        <div class="outro-eyebrow"><span class="live"></span>LIVE OVERVIEW</div>
        <h2>نمای کلی مرکز، همین امروز</h2>
        <div class="outro-stats">
          <div><strong data-n="${info.teams}">۰</strong><span>حوزه فعال</span></div>
          <div><strong data-n="${info.people}">۰</strong><span>عضو و مجموعه</span></div>
          <div><strong data-n="${info.projects}">۰</strong><span>پروژه</span></div>
          <div><strong data-n="${info.avg}" data-suffix="٪">۰٪</strong><span>میانگین پیشرفت</span></div>
        </div>
        <div class="outro-cta">
          <a class="cta-p" href="projects.html" tabindex="-1">مشاهده وضعیت پروژه‌ها <span>←</span></a>
          <a class="cta-s" href="#domains" tabindex="-1">مرور حوزه‌ها</a>
        </div>
      </div>

      <div class="cine-hud">
        <div class="hud-tc"><i class="rec"></i><span class="tc">TC 00:00:00</span></div>
        <div class="hud-track" role="group" aria-label="فصل‌های معرفی">
          <div class="hud-fill"></div>
          ${chapters.map((c, i) => `<button class="hud-tick" type="button" style="--c:${c.color};left:${(CH0 + (i + .5) * CHW) * 100}%" aria-label="رفتن به ${esc(c.fa)}"><span>${esc(c.fa)}</span></button>`).join('')}
        </div>
        <div class="hud-end">
          <div class="hud-scroll"><i></i>SCROLL</div>
          <button class="hud-skip" type="button">رد شدن از معرفی</button>
        </div>
      </div>

      <div class="cine-vignette" aria-hidden="true"></div>
      <div class="cine-grain" aria-hidden="true"></div>
      <div class="cine-bars" aria-hidden="true"><i></i><i></i></div>
      <div class="cine-intro" aria-hidden="true">
        <div class="intro-in">
          <div class="intro-count"><span class="ic">000</span><sup>%</sup></div>
          <div class="intro-line"><i></i></div>
          <div class="intro-tag">PARK · GAME &amp; ANIMATION CENTER</div>
        </div>
      </div>
    </div>`;

    before.parentNode.insertBefore(root, before);

    const stage = root.querySelector('.cine-stage');
    const q = s => root.querySelector(s);
    const qa = s => Array.from(root.querySelectorAll(s));

    /* ------------------- حالت بدون حرکت (prefers-reduced-motion) ------------------- */
    if (REDUCED_) {
      root.classList.add('cine--static', 'is-ready', 'is-done');
      qa('.outro-stats strong').forEach(el => { el.textContent = fa(el.dataset.n) + (el.dataset.suffix || ''); });
      return root;
    }

    const titleEl = q('.cine-title');
    const orbEl = q('.cine-orb');
    const orb3d = q('.orb-3d');
    const rings = qa('.orb-ring');
    const nodes = qa('.orb-node');
    const flare = q('.cine-flare');
    const chEls = qa('.cine-ch');
    const outro = q('.cine-outro');
    const ticks = qa('.hud-tick');
    const fill = q('.hud-fill');
    const tcEl = q('.tc');
    const scrollHint = q('.hud-scroll');
    const canvas = q('.cine-canvas');
    const ctx = canvas.getContext('2d');
    const accRGB = chapters.map(c => hex(c.color));
    const baseRGB = hex(BASE);

    let W = 0, H = 0, DPR = 1, narrow = false;
    let particles = [], bokeh = [];

    function resize() {
      narrow = window.innerWidth <= 820;
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = stage.clientWidth; H = stage.clientHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      stage.style.setProperty('--bar', narrow ? '3vh' : '5.5vh');
      const n = narrow ? 120 : 230;
      if (particles.length !== n) {
        particles = Array.from({ length: n }, () => ({
          x: (Math.random() * 2 - 1), y: (Math.random() * 2 - 1),
          z: Math.random(), a: Math.random() < .28
        }));
        bokeh = Array.from({ length: narrow ? 6 : 12 }, () => ({
          x: Math.random(), y: Math.random(), r: 40 + Math.random() * 110,
          d: .3 + Math.random() * .9, a: Math.random() < .5
        }));
      }
    }
    resize();
    window.addEventListener('resize', resize);

    /* ------------------- ماوس: پارالاکس ظریف ------------------- */
    let tx = 0, ty = 0, px = 0, py = 0;
    if (!window.matchMedia('(hover: none)').matches) {
      stage.addEventListener('pointermove', e => {
        tx = (e.clientX / W - .5) * 2; ty = (e.clientY / H - .5) * 2;
      });
      stage.addEventListener('pointerleave', () => { tx = ty = 0; });
    }

    /* ------------------- پیش‌بار + ورود ------------------- */
    function intro() {
      let seen = false;
      try { seen = sessionStorage.getItem('cine-seen') === '1'; } catch (e) {}
      if (window.scrollY > 40 || seen) {
        root.classList.add('is-ready', 'is-opening', 'is-done');
        return;
      }
      const ic = q('.ic'), line = q('.intro-line i');
      const DUR = 1300, t0 = performance.now();
      (function tick(now) {
        const t = clamp((now - t0) / DUR);
        const e = 1 - Math.pow(1 - t, 3);
        ic.textContent = String(Math.round(e * 100)).padStart(3, '0');
        line.style.transform = `scaleX(${e})`;
        if (t < 1) return requestAnimationFrame(tick);
        root.classList.add('is-opening', 'is-ready');
        setTimeout(() => root.classList.add('is-done'), 1300);
        try { sessionStorage.setItem('cine-seen', '1'); } catch (e) {}
      })(t0);
    }
    intro();

    /* ------------------- کنترل‌های HUD ------------------- */
    function runwayMetrics() {
      const r = root.getBoundingClientRect();
      return { top: window.scrollY + r.top, span: Math.max(1, r.height - stage.clientHeight) };
    }
    ticks.forEach((tk, i) => tk.addEventListener('click', () => {
      const m = runwayMetrics();
      window.scrollTo({ top: m.top + (CH0 + (i + .5) * CHW) * m.span, behavior: 'smooth' });
    }));
    q('.hud-skip').addEventListener('click', () => {
      const m = runwayMetrics();
      window.scrollTo({ top: m.top + m.span + stage.clientHeight * .55, behavior: 'smooth' });
    });
    /* لینک‌های فصل/جمع‌بندی فقط وقتی دیده می‌شوند قابل Tab هستند */
    function setFocusable(el, on) {
      el.querySelectorAll('a').forEach(a => a.tabIndex = on ? 0 : -1);
    }

    /* ------------------- کلیدفریم‌های حرکت کره ------------------- */
    const KF = () => narrow ? [
      [0,    { x: 0, y: .00, s: 1.7,  o: .55 }],
      [.10,  { x: 0, y: .00, s: 1.7,  o: .55 }],
      [.19,  { x: 0, y: -.22, s: .95, o: 1 }],
      [.80,  { x: 0, y: -.22, s: 1.02, o: 1 }],
      [.89,  { x: 0, y: 0,   s: 1.9,  o: .32 }],
      [1,    { x: 0, y: 0,   s: 2.1,  o: .26 }]
    ] : [
      [0,    { x: 0,    y: 0, s: 1.7,  o: .6 }],
      [.10,  { x: 0,    y: 0, s: 1.7,  o: .6 }],
      [.19,  { x: -.24, y: 0, s: 1,    o: 1 }],
      [.80,  { x: -.24, y: 0, s: 1.06, o: 1 }],
      [.89,  { x: 0,    y: 0, s: 2.0,  o: .34 }],
      [1,    { x: 0,    y: 0, s: 2.25, o: .28 }]
    ];

    /* ------------------- رندر هر فریم ------------------- */
    const cache = { acc: '', tc: '', k: {} };

    function drawField(p, vel, t, acc) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const cx = W / 2 + px * -26, cy = H / 2 + py * -18;
      const f = H * .95;

      /* حباب‌های نور (عمق میدان) */
      ctx.globalCompositeOperation = 'lighter';
      for (const b of bokeh) {
        const bx = (b.x * 1.2 - .1) * W + px * -40 * b.d;
        const by = (((b.y - p * .9 * b.d) % 1 + 1) % 1) * H * 1.2 - H * .1;
        const g = ctx.createRadialGradient(bx, by, 0, bx, by, b.r);
        const col = b.a ? acc : '255,255,255';
        g.addColorStop(0, `rgba(${col},${b.a ? .10 : .05})`);
        g.addColorStop(1, `rgba(${col},0)`);
        ctx.fillStyle = g; ctx.fillRect(bx - b.r, by - b.r, b.r * 2, b.r * 2);
      }

      /* ستاره‌های پرواز — حرکت دوربین با اسکرول */
      const travel = p * 3.4 + t * .012;
      const trail = .003 + clamp(vel * .06, 0, .09);
      ctx.lineCap = 'round';
      const cap = 8 + clamp(vel * 300, 0, 150);
      for (const s of particles) {
        const z = (((s.z - travel) % 1) + 1) % 1;
        if (z < .06) continue;
        const z0 = Math.min(1.3, z + trail);
        const sx = cx + s.x * f * .21 / z, sy = cy + s.y * f * .21 / z;
        let sx0 = cx + s.x * f * .21 / z0, sy0 = cy + s.y * f * .21 / z0;
        if (sx < -50 || sx > W + 50 || sy < -50 || sy > H + 50) continue;
        const dx = sx0 - sx, dy = sy0 - sy, len = Math.hypot(dx, dy);
        if (len > cap) { sx0 = sx + dx / len * cap; sy0 = sy + dy / len * cap; }
        const k = 1 - z;
        ctx.strokeStyle = `rgba(${s.a ? acc : '225,238,255'},${(.1 + k * .75).toFixed(3)})`;
        ctx.lineWidth = .35 + k * 1.7;
        ctx.beginPath(); ctx.moveTo(sx0, sy0); ctx.lineTo(sx, sy); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    function render(p, vel, t) {
      /* وزن فصل‌ها */
      const cw = chapters.map((_, i) => chapterWeight((p - (CH0 + i * CHW)) / CHW));
      const wt = 1 - smooth(clamp((p - TITLE_OUT[0]) / (TITLE_OUT[1] - TITLE_OUT[0])));
      const wo = smooth(clamp((p - OUTRO_IN[0]) / (OUTRO_IN[1] - OUTRO_IN[0])));
      const sumW = cw.reduce((a, c) => a + c.w, 0);
      const baseW = clamp(1 - sumW);

      /* رنگ تاکیدی ترکیبی */
      let r = baseRGB[0] * baseW, g = baseRGB[1] * baseW, b = baseRGB[2] * baseW;
      cw.forEach((c, i) => { r += accRGB[i][0] * c.w; g += accRGB[i][1] * c.w; b += accRGB[i][2] * c.w; });
      const accStr = `${Math.round(r)},${Math.round(g)},${Math.round(b)}`;
      if (accStr !== cache.acc) { cache.acc = accStr; stage.style.setProperty('--acc', `rgb(${accStr})`); }

      /* کره: حرکت دوربین + چرخش حلقه‌ها + گره‌های مداری */
      const kf = sample(KF(), p);
      const pulse = 1 + sumW * .0;
      orbEl.style.opacity = kf.o.toFixed(3);
      orbEl.style.setProperty('--ct', (smooth(clamp((p - .07) / .12)) * (1 - wo)).toFixed(3));
      orbEl.style.transform =
        `translate3d(${(kf.x * W + px * 14).toFixed(1)}px,${(kf.y * H + py * 10).toFixed(1)}px,0) scale(${(kf.s * pulse).toFixed(4)})`;
      orb3d.style.transform = `rotateX(${(py * -8).toFixed(2)}deg) rotateY(${(px * 10 + Math.sin(p * 7) * 14).toFixed(2)}deg)`;
      rings[0].style.transform = `rotateX(72deg) rotateZ(${(p * 260 + t * 8).toFixed(1)}deg)`;
      rings[1].style.transform = `rotateY(68deg) rotateZ(${(-p * 200 - t * 6).toFixed(1)}deg)`;
      rings[2].style.transform = `rotateX(58deg) rotateY(18deg) rotateZ(${(p * 120 + t * 3).toFixed(1)}deg)`;

      const orbPx = orbEl.clientWidth || 300;
      const Rx = orbPx * .86, Ry = orbPx * .26, tilt = -.26;
      nodes.forEach((n, i) => {
        const a = i * (Math.PI * 2 / N) + p * 3.1 + t * .14;
        const ex = Math.cos(a) * Rx, ey = Math.sin(a) * Ry;
        const nx = ex * Math.cos(tilt) - ey * Math.sin(tilt), ny = ex * Math.sin(tilt) + ey * Math.cos(tilt);
        const depth = (Math.sin(a) + 1) / 2;
        n.style.transform = `translate(-50%,-50%) translate(${nx.toFixed(1)}px,${ny.toFixed(1)}px) scale(${(.82 + depth * .3).toFixed(3)})`;
        n.style.opacity = ((.35 + depth * .65) * (1 - wo)).toFixed(3);
        n.style.zIndex = depth > .5 ? 3 : 1;
        const on = cw[i].w > .5;
        if (on !== (n.dataset.on === '1')) { n.dataset.on = on ? '1' : '0'; n.classList.toggle('on', on); }
      });

      /* هاله‌ی افقی لنز: با سرعت اسکرول و گذار فصل‌ها قوی‌تر می‌شود */
      const edge = cw.reduce((m, c, i) => Math.max(m, Math.sin(Math.PI * clamp((p - (CH0 + i * CHW) + .02) / .06)) * (1 - clamp((p - (CH0 + i * CHW) - .04) / .03))), 0);
      const fl = clamp(.22 + vel * 3.2 + edge * .5, 0, 1);
      flare.style.opacity = (fl * (1 - wo * .6)).toFixed(3);
      flare.style.transform = `translate3d(${px * 20}px,${(kf.y * H).toFixed(1)}px,0) scaleX(${(.55 + fl * .7).toFixed(3)})`;

      /* عنوان آغازین */
      const tHidden = wt < .01;
      titleEl.style.visibility = tHidden ? 'hidden' : 'visible';
      if (!tHidden) {
        titleEl.style.opacity = wt.toFixed(3);
        titleEl.style.transform = `translate3d(${(px * 8).toFixed(1)}px,${((1 - wt) * -70).toFixed(1)}px,0) scale(${(1 + (1 - wt) * .14).toFixed(4)})`;
        titleEl.style.filter = wt > .985 ? 'none' : `blur(${((1 - wt) * 12).toFixed(1)}px)`;
      }

      /* فصل‌ها */
      chEls.forEach((el, i) => {
        const c = cw[i], tt = (p - (CH0 + i * CHW)) / CHW;
        const vis = c.w > .01;
        el.style.visibility = vis ? 'visible' : 'hidden';
        if (!vis) { if (el.classList.contains('is-active')) { el.classList.remove('is-active'); setFocusable(el, false); } return; }
        el.style.opacity = c.w.toFixed(3);
        const inner = el.firstElementChild.nextElementSibling; // .ch-in
        inner.style.transform = `translate3d(${(px * -10).toFixed(1)}px,${((1 - c.enter) * 56 - (1 - c.exit) * 40).toFixed(1)}px,0)`;
        inner.style.filter = c.w > .985 ? 'none' : `blur(${((1 - c.w) * 7).toFixed(1)}px)`;
        el.firstElementChild.style.transform = `translate3d(${((tt - .5) * -22).toFixed(2)}vw,0,0)`;
        el.style.setProperty('--k', c.enter.toFixed(3));
        const active = c.w > .5;
        if (active !== el.classList.contains('is-active')) { el.classList.toggle('is-active', active); setFocusable(el, active); }
        /* عددهای آمار فصل: شمارش تا مقدار واقعی */
        el.querySelectorAll('.ch-stats b[data-n]').forEach(b => {
          const v = Math.round(Number(b.dataset.n) * smooth(clamp(c.enter * 1.25)));
          if (b._v !== v) { b._v = v; b.textContent = fa(v); }
        });
      });

      /* جمع‌بندی */
      const oHidden = wo < .01;
      outro.style.visibility = oHidden ? 'hidden' : 'visible';
      if (!oHidden) {
        outro.style.opacity = wo.toFixed(3);
        outro.style.transform = `translate3d(0,${((1 - wo) * 50).toFixed(1)}px,0)`;
        const on = wo > .6;
        if (on !== outro.classList.contains('is-active')) { outro.classList.toggle('is-active', on); setFocusable(outro, on); }
        const k = smooth(clamp((p - .84) / .1));
        outro.querySelectorAll('.outro-stats strong').forEach(s => {
          const v = Math.round(Number(s.dataset.n) * k);
          if (s._v !== v) { s._v = v; s.textContent = fa(v) + (s.dataset.suffix || ''); }
        });
      }

      /* HUD */
      fill.style.transform = `scaleX(${p.toFixed(4)})`;
      ticks.forEach((tk, i) => {
        const mid = CH0 + (i + .5) * CHW;
        tk.classList.toggle('done', p > mid + .005);
        tk.classList.toggle('on', cw[i].w > .5);
      });
      const sec = Math.floor(p * FILM_SECONDS), fr = Math.floor(((p * FILM_SECONDS) % 1) * 24);
      const tc = `TC 00:${String(sec).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
      if (tc !== cache.tc) { cache.tc = tc; tcEl.textContent = tc; }
      scrollHint.style.opacity = (1 - clamp(p / .04)).toFixed(2);

      /* میله‌های سینمایی و کوچک شدن قاب در پایان */
      const sh = smooth(clamp((p - SHRINK_AT) / (1 - SHRINK_AT)));
      const barBase = narrow ? 3 : 5.5;
      stage.style.setProperty('--bar', `${(barBase * (1 - smooth(clamp((p - .9) / .08)))).toFixed(2)}vh`);
      stage.style.transform = sh > 0 ? `scale(${(1 - .07 * sh).toFixed(4)})` : '';
      stage.style.borderRadius = sh > 0 ? `${(40 * sh).toFixed(1)}px` : '';

      drawField(p, vel, t, accStr);
    }

    /* ------------------- حلقه‌ی اصلی ------------------- */
    let cur = 0, vel = 0, last = performance.now(), first = true;
    function frame(now) {
      const dt = Math.min(.05, (now - last) / 1000) || .016; last = now;
      const rect = root.getBoundingClientRect();
      const span = Math.max(1, rect.height - stage.clientHeight);
      const target = clamp(-rect.top / span);
      const prev = cur;
      cur = first ? target : cur + (target - cur) * (1 - Math.exp(-dt * 7.5));
      if (Math.abs(target - cur) < 1e-4) cur = target;
      vel += (Math.abs(cur - prev) / dt - vel) * (1 - Math.exp(-dt * 6));
      px += (tx - px) * (1 - Math.exp(-dt * 5)); py += (ty - py) * (1 - Math.exp(-dt * 5));
      if (rect.bottom > 0 && rect.top < window.innerHeight) { render(cur, vel, now / 1000); first = false; }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    /* اگر فونت یا چیدمان بعداً تغییر کرد */
    window.addEventListener('load', resize);
    return root;
  }

  return { mount };
})();
