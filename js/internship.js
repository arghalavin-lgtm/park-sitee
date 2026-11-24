/* ===================================================================
   صفحه‌ی کارآموزی (internship.html)
   از توابع و داده‌ی js/app.js و متن‌های js/intern-info.js استفاده می‌کند.
=================================================================== */
function renderInternship(){
  const info = INTERN_INFO;
  document.title = `کارآموزی | ${D.site.name}`;
  chrome({ back:'index.html' });

  const keys = ['game','2d','3d','cinema'].filter(k => info.fields && info.fields[k]);
  const titleOf = k => (D.internTasks && D.internTasks[k] && D.internTasks[k].title) || k;
  const accOf = k => SEARCH_ACCENTS[k] || '#E97132';
  const interns = Object.values(D.people || {}).filter(p => p.team === 'intern');
  const avg = (typeof internAvg === 'function') ? internAvg() : null;

  const hasLink = !!(info.apply && info.apply.href);
  const applyHref = hasLink ? info.apply.href : '#apply';
  const applyAttr = hasLink && /^https?:/i.test(applyHref) ? ' target="_blank" rel="noopener"' : '';
  const applyLabel = hasLink ? (info.apply.label || 'ارسال درخواست') : 'مراحل ثبت‌نام';

  const c = ce('div','container ipg js-reveal');
  c.innerHTML = `
    <!-- هیرو -->
    <header class="ipg-hero">
      <span class="ipg-hero__orb ipg-hero__orb--a"></span><span class="ipg-hero__orb ipg-hero__orb--b"></span>
      <div class="ipg-hero__copy">
        <span class="ipg-badge">INTERNSHIP</span>
        <h1>برنامه‌ی کارآموزی<br>مرکز گیم و انیمیشن</h1>
        <p>${esc(info.intro || '')}</p>
        <div class="ipg-hero__actions">
          <a class="ipg-btn ipg-btn--main" href="${esc(applyHref)}"${applyAttr}>${esc(applyLabel)} <span>←</span></a>
          <a class="ipg-btn ipg-btn--ghost" href="#fields">دیدن حوزه‌ها</a>
        </div>
        <div class="ipg-hero__stats">
          <div><strong>${esc(fa(keys.length))}</strong><span>حوزه‌ی کارآموزی</span></div>
          ${interns.length ? `<div><strong>${esc(fa(interns.length))}</strong><span>کارآموز فعال</span></div>` : ''}
          ${avg !== null ? `<div><strong>${esc(fa(avg))}٪</strong><span>میانگین پیشرفت</span></div>` : ''}
        </div>
      </div>
      <div class="ipg-stack" aria-hidden="true">
        <div class="ipg-stack__scene">
          ${keys.map((k, i) => `<div class="ipg-layer" style="--ac:${accOf(k)};--i:${i}"><span class="ipg-layer__glyph">${esc(info.fields[k].glyph)}</span><b>${esc(titleOf(k))}</b></div>`).join('')}
        </div>
      </div>
    </header>

    <nav class="ipg-nav" aria-label="بخش‌های صفحه">
      <a href="#fields">حوزه‌ها</a><a href="#requirements">شرایط لازم</a><a href="#apply">مراحل ثبت‌نام</a><a href="#faq">پرسش‌ها</a>
    </nav>

    <!-- حوزه‌ها -->
    <section id="fields" class="ipg-section">
      <div class="section-intro"><div><span class="eyebrow">FIELDS</span><h2>کارآموز هر بخش چه می‌کند؟</h2></div><p>چهار حوزه‌ی کارآموزی؛ برای هر کدام، کارها، مهارت‌ها، ابزارها و مسیر آموزشی‌اش را ببینید.</p></div>
      <div class="ipg-fields">
        ${keys.map(k => {
          const f = info.fields[k];
          const tasks = (D.internTasks && D.internTasks[k] && D.internTasks[k].tasks) || [];
          const tools = ((D.teams && D.teams[k] && D.teams[k].tools) || []);
          const n = interns.filter(p => p.internField === k).length;
          const list = arr => (arr || []).map(x => `<li>${esc(x)}</li>`).join('');
          return `
          <article id="field-${esc(k)}" class="ipg-field ipg-reveal" style="--ac:${accOf(k)}">
            <div class="ipg-field__head">
              <span class="ipg-field__glyph">${esc(f.glyph)}</span>
              <div><span class="ipg-field__en">${esc(f.en)}</span><h3>کارآموزی ${esc(titleOf(k))}</h3></div>
              ${n ? `<span class="ipg-field__count"><b>${esc(fa(n))}</b> کارآموز</span>` : ''}
            </div>
            <p class="ipg-field__about">${esc(f.about)}</p>
            <div class="ipg-field__cols">
              <div class="ipg-col"><h4>کارهایی که انجام می‌دهد</h4><ul>${list(f.does)}</ul></div>
              <div class="ipg-col"><h4>آنچه یاد می‌گیرد</h4><ul>${list(f.learns)}</ul></div>
              <div class="ipg-col"><h4>خروجی دوره</h4><ul>${list(f.outputs)}</ul></div>
            </div>
            ${tools.length ? `<div class="ipg-tools"><h4>ابزارهای این حوزه</h4><div>${tools.map(g => (g.items || []).map(x => `<span>${esc(x)}</span>`).join('')).join('')}</div></div>` : ''}
            ${tasks.length ? `<details class="ipg-path"><summary>مسیر آموزشی (${esc(fa(tasks.length))} مرحله)</summary><ol>${tasks.map(t => `<li>${esc(t.title)}</li>`).join('')}</ol></details>` : ''}
            <a class="ipg-field__link" href="team.html?id=intern#intern-${esc(k)}">مشاهده کارآموزان این بخش <span>←</span></a>
          </article>`;
        }).join('')}
      </div>
    </section>

    <!-- شرایط -->
    <section id="requirements" class="ipg-section">
      <div class="section-intro"><div><span class="eyebrow">REQUIREMENTS</span><h2>شرایط لازم برای کارآموزی</h2></div><p>برای شروع، حرفه‌ای بودن لازم نیست؛ این موارد را داشته باشید.</p></div>
      <div class="ipg-reqs">
        ${(info.requirements || []).map((r, i) => `<div class="ipg-req ipg-reveal" style="--d:${i * 0.06}s"><span class="ipg-req__ic">✓</span><b>${esc(r.t)}</b><p>${esc(r.d)}</p></div>`).join('')}
      </div>
    </section>

    <!-- ثبت‌نام -->
    <section id="apply" class="ipg-section">
      <div class="section-intro"><div><span class="eyebrow">HOW TO APPLY</span><h2>مراحل ثبت‌نام</h2></div><p>از انتخاب حوزه تا دریافت حساب کاربری در پنل اعضا.</p></div>
      <div class="ipg-apply">
        <ol class="ipg-steps">
          ${(info.steps || []).map((st, i) => `<li class="ipg-reveal" style="--d:${i * 0.07}s"><span class="ipg-steps__n">${esc(fa(i + 1))}</span><div><b>${esc(st.t)}</b><p>${esc(st.d)}</p></div></li>`).join('')}
        </ol>
        <aside class="ipg-cta">
          <span class="ipg-cta__orb"></span>
          <h3>آماده‌اید شروع کنید؟</h3>
          <p>${esc((info.apply && info.apply.text) || '')}</p>
          ${hasLink ? `<a class="ipg-btn ipg-btn--main" href="${esc(applyHref)}"${applyAttr}>${esc(applyLabel)} <span>←</span></a>` : ''}
          <div class="ipg-cta__note">قبلاً پذیرفته شده‌اید؟ <a href="panel/">ورود به پنل اعضا</a></div>
        </aside>
      </div>
    </section>

    <!-- سوالات -->
    <section id="faq" class="ipg-section">
      <div class="section-intro"><div><span class="eyebrow">FAQ</span><h2>پرسش‌های پرتکرار</h2></div></div>
      <div class="ipg-faq">
        ${(info.faqs || []).map(f => `<details class="ipg-reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join('')}
      </div>
    </section>
  `;
  document.body.appendChild(c);

  /* ورود نرم هنگام اسکرول */
  const items = qsa('.ipg-reveal', c);
  if(REDUCED || !('IntersectionObserver' in window)){ items.forEach(el => el.classList.add('is-in')); }
  else {
    const io = new IntersectionObserver(es => es.forEach(e => { if(e.isIntersecting){ e.target.classList.add('is-in'); io.unobserve(e.target); } }), { threshold:.12 });
    items.forEach(el => io.observe(el));
  }

  /* چرخش سه‌بعدی کارت‌های هیرو با ماوس */
  const hero = qs('.ipg-hero', c), scene = qs('.ipg-stack__scene', c);
  if(hero && scene && !REDUCED && !window.matchMedia('(hover: none)').matches){
    hero.addEventListener('pointermove', e => {
      const r = hero.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
      scene.style.setProperty('--ry', (px * 18).toFixed(1) + 'deg');
      scene.style.setProperty('--rx', (py * -12).toFixed(1) + 'deg');
    });
    hero.addEventListener('pointerleave', () => { scene.style.setProperty('--ry', '0deg'); scene.style.setProperty('--rx', '0deg'); });
  }

  /* تیلت ملایم روی کارت حوزه‌ها */
  qsa('.ipg-field, .ipg-req', c).forEach(el => { if(!REDUCED) tilt(el, el, 1.6); });
}
