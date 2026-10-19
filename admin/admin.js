let DATA=null,currentView='dashboard',editing=null;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fa=n=>String(n).replace(/\d/g,d=>'۰۱۲۳۴۵۶۷۸۹'[d]);
async function api(url,opt={}){const r=await fetch(url,{headers:{'Content-Type':'application/json',...(opt.headers||{})},...opt});let x={};try{x=await r.json()}catch{}if(!r.ok)throw Error(x.error||'خطا');return x}
function toast(t){$('#toast').innerHTML=`<span class="toast">${t}</span>`;setTimeout(()=>$('#toast').innerHTML='',2200)}
async function boot(){
  try{
    const me=await api('/api/me');
    if(!me.authenticated)return;
    if(me.role!=='admin'){$('#loginErr').textContent='این صفحه مخصوص مدیر است. اعضا باید از آدرس /panel/ وارد شوند.';return}
    await refresh();
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    show('dashboard');
  }catch(e){
    $('#loginErr').textContent='سرور پنل اجرا نشده است. پنل را با node server.js اجرا کنید.';
  }
}
async function refresh(){DATA=await api('/api/data')}
$('#loginForm').onsubmit=async e=>{
  e.preventDefault();
  $('#loginErr').textContent='';
  const button=e.target.querySelector('button');
  button.disabled=true;
  try{
    await api('/api/login',{method:'POST',body:JSON.stringify({username:$('#user').value.trim(),password:$('#pass').value})});
    await boot();
  }catch(x){
    $('#loginErr').textContent=x.message==='Failed to fetch'?'سرور پنل اجرا نشده است. ابتدا node server.js را اجرا کنید.':x.message;
  }finally{button.disabled=false}
}
$('#logout').onclick=async()=>{await api('/api/logout',{method:'POST'});location.reload()};
$$('nav button').forEach(b=>b.onclick=()=>show(b.dataset.view));
function show(v){currentView=v;editing=null;$$('nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===v));const titles={dashboard:'داشبورد',people:'افراد و شرکت‌ها',projects:'پروژه‌ها',teams:'حوزه‌ها',users:'حساب اعضا',site:'تنظیمات سایت'};$('#viewTitle').textContent=titles[v];({dashboard:dashboard,people:people,projects:projects,teams:teams,users:users,site:site}[v])()}
function dashboard(){
  const ps=Object.values(DATA.people||{}), prs=Object.values(DATA.projects||{});
  const done=prs.filter(p=>Number(p.progress??(Number(p.stage||0)*25))>=100).length;
  const avg=prs.length?Math.round(prs.reduce((a,p)=>a+Number(p.progress??(Number(p.stage||0)*25)),0)/prs.length):0;
  const active=prs.filter(p=>Number(p.progress??0)>0 && Number(p.progress??0)<100).length;
  const byTeam=Object.values(DATA.teams||{}).map(t=>({name:t.titleFa,count:(t.members||[]).length}));
  $('#content').innerHTML=`
    <div class="dashboard-grid">
      <div class="stat"><span class="stat-icon">◉</span><small>افراد و شرکت‌ها</small><strong>${fa(ps.length)}</strong><div class="stat-meta">اطلاعات ثبت‌شده در سیستم</div></div>
      <div class="stat"><span class="stat-icon">◇</span><small>حوزه‌ها</small><strong>${fa(Object.keys(DATA.teams||{}).length)}</strong><div class="stat-meta">شاخه‌های فعال مرکز</div></div>
      <div class="stat"><span class="stat-icon">▣</span><small>پروژه‌ها</small><strong>${fa(prs.length)}</strong><div class="stat-meta">${fa(active)} پروژه در حال انجام</div></div>
      <div class="stat"><span class="stat-icon">✓</span><small>میانگین پیشرفت</small><strong>${fa(avg)}٪</strong><div class="stat-meta">${fa(done)} پروژه تکمیل‌شده</div></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>دسترسی سریع</h2><span class="muted">ابزارهای مدیریتی</span></div>
      <div class="quick-grid">
        <button class="quick-action" onclick="editPerson()"><b>＋ افزودن فرد / شرکت</b><small>ساخت پروفایل جدید</small></button>
        <button class="quick-action" onclick="editProject()"><b>＋ افزودن پروژه</b><small>ثبت پروژه و درصد پیشرفت</small></button>
        <button class="quick-action" onclick="show('teams')"><b>◈ مدیریت حوزه‌ها</b><small>ویرایش عنوان و توضیحات</small></button>
        <button class="quick-action" onclick="downloadBackup()"><b>↓ پشتیبان‌گیری</b><small>دریافت نسخه JSON اطلاعات</small></button>
      </div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>وضعیت کلی پروژه‌ها</h2><button class="btn" onclick="show('projects')">مدیریت پروژه‌ها</button></div>
      <div class="health"><div><div class="health-line"><i style="width:${avg}%"></i></div><div class="project-meta"><span>میانگین پیشرفت <b>${fa(avg)}٪</b></span><span>فعال <b>${fa(active)}</b></span><span>تکمیل <b>${fa(done)}</b></span></div></div><strong>${fa(avg)}٪</strong></div>
    </div>
    <div class="panel">
      <div class="panel-head"><h2>پروژه‌های اخیر</h2><button class="btn" onclick="show('projects')">مشاهده همه</button></div>
      ${prs.slice(0,6).map(projectCard).join('')||'<div class="notice">هنوز پروژه‌ای ثبت نشده است.</div>'}
    </div>
  `;
}
function people(){const rows=Object.values(DATA.people);$('#content').innerHTML=`<div class="panel"><div class="panel-head"><div class="toolbar"><input id="peopleSearch" placeholder="جستجوی نام یا شناسه…" oninput="filterPeople()"></div><button class="primary" onclick="editPerson()">+ افزودن فرد / شرکت</button></div><div class="table-wrap"><table class="table"><thead><tr><th>نام</th><th>نوع</th><th>حوزه</th><th>نمونه‌کار</th><th></th></tr></thead><tbody id="peopleRows">${rows.map(personRow).join('')}</tbody></table></div></div>`}
function personRow(p){return `<tr data-search="${(p.name+' '+p.id).toLowerCase()}"><td><img class="avatar" src="${p.photo||'assets/img/placeholder.svg'}" onerror="this.src='assets/img/placeholder.svg'">${p.name}</td><td><span class="badge">${p.type==='company'?'شرکت/گروه':'کارآموز'}</span></td><td>${DATA.teams[p.team]?.titleFa||p.team}</td><td>${fa((p.samples||[]).length)}</td><td><div class="actions"><button class="btn" onclick="editPerson('${p.id}')">ویرایش</button><button class="btn danger" onclick="delPerson('${p.id}')">حذف</button></div></td></tr>`}
function filterPeople(){const q=$('#peopleSearch').value.toLowerCase();$$('#peopleRows tr').forEach(r=>r.style.display=r.dataset.search.includes(q)?'':'none')}
function nextPersonId(){const n=Object.keys(DATA.people).filter(k=>/^\d+$/.test(k)).map(Number);return String(n.length?Math.max(...n)+1:1)}
function editPerson(id){editing=id||null;const p=id?DATA.people[id]:{id:nextPersonId(),name:'',team:Object.keys(DATA.teams)[0],type:'person',photo:'',tags:[],samples:[]};$('#content').innerHTML=`<div class="panel"><div class="panel-head"><h2>${id?'ویرایش':'افزودن'} ${p.type==='company'?'شرکت':'فرد'}</h2><button class="btn" onclick="show('people')">بازگشت</button></div><form id="personForm"><div class="form-grid"><div class="field"><label>شناسه (عدد)</label><input name="id" value="${p.id}" ${id?'readonly':'inputmode="numeric" pattern="[0-9]+" title="فقط عدد"'} required>${id?'':'<small style="color:#6b7785">عدد پیشنهادی بعدی؛ در سایت نمایش داده نمی‌شود.</small>'}</div><div class="field"><label>نام</label><input name="name" value="${p.name||''}" required></div><div class="field"><label>نوع</label><select name="type"><option value="person" ${p.type==='person'?'selected':''}>فرد / کارآموز</option><option value="company" ${p.type==='company'?'selected':''}>شرکت / گروه</option></select></div><div class="field"><label>حوزه</label><select name="team">${Object.values(DATA.teams).map(t=>`<option value="${t.id}" ${p.team===t.id?'selected':''}>${t.titleFa}</option>`).join('')}</select></div><div class="field full"><label>آدرس تصویر</label><input name="photo" value="${p.photo||''}" placeholder="assets/img/name.jpg"></div><div class="field full"><label>مشخصات</label><div id="tags" class="tags">${(p.tags||[]).map(tag=>tagRow(tag)).join('')}</div><button type="button" class="btn" onclick="addTag()">+ افزودن مشخصه</button></div><div class="field full"><label>نمونه‌کارها</label><div id="samples" class="samples">${(p.samples||[]).map(sampleRow).join('')}</div><button type="button" class="btn" onclick="addSample()">+ افزودن نمونه‌کار</button></div></div><div class="form-actions"><button class="primary">ذخیره تغییرات</button><button type="button" class="btn secondary" onclick="show('people')">انصراف</button></div></form></div>`;$('#personForm').onsubmit=savePerson}
function tagRow(t={label:'',value:''}){return `<div class="tag-row"><input class="tl" placeholder="عنوان" value="${t.label||''}"><input class="tv" placeholder="مقدار" value="${t.value||''}"><button type="button" class="btn danger" onclick="this.parentElement.remove()">×</button></div>`}
function sampleRow(s={title:'',image:'',video:'',link:''}){return `<div class="sample-row"><input class="st" placeholder="عنوان" value="${s.title||''}"><input class="si" placeholder="تصویر" value="${s.image||''}"><input class="sv" placeholder="ویدیو / لینک" value="${s.video||s.link||''}"><button type="button" class="btn danger" onclick="this.parentElement.remove()">×</button></div>`}
function addTag(){ $('#tags').insertAdjacentHTML('beforeend',tagRow())} function addSample(){ $('#samples').insertAdjacentHTML('beforeend',sampleRow()) }
async function savePerson(e){e.preventDefault();const f=new FormData(e.target),p=Object.fromEntries(f.entries());if(!editing&&DATA.people[p.id]){alert('این شناسه قبلاً برای فرد دیگری استفاده شده است.');return}p.tags=$$('#tags .tag-row').map(r=>({label:r.querySelector('.tl').value,value:r.querySelector('.tv').value})).filter(x=>x.label);p.samples=$$('#samples .sample-row').map(r=>{const [title,image,media]=[...r.querySelectorAll('input')].map(x=>x.value);const s={title};if(image)s.image=image;if(media)(media.includes('aparat')||media.includes('youtube'))?s.video=media:s.link=media;return s}).filter(x=>x.title);await api('/api/people',{method:'PUT',body:JSON.stringify(p)});await refresh();toast('ذخیره شد');show('people')}
async function delPerson(id){if(!confirm('این فرد/شرکت و پروژه مرتبط حذف شود؟'))return;await api('/api/people/'+id,{method:'DELETE'});await refresh();show('people');toast('حذف شد')}
function projectProgress(p){return Math.max(0,Math.min(100,Number(p.progress ?? (Number(p.stage||0)*25))));}
function projects(){
  const rows=Object.values(DATA.projects||{});
  $('#content').innerHTML=`<div class="panel"><div class="panel-head"><h2>وضعیت پروژه‌ها</h2><div class="toolbar"><input id="projectSearch" placeholder="جستجوی پروژه یا فرد…" oninput="filterProjects()"><select id="projectTeamFilter" onchange="filterProjects()"><option value="">همه حوزه‌ها</option>${Object.values(DATA.teams||{}).map(t=>`<option value="${t.id}">${t.titleFa}</option>`).join('')}</select><select id="projectStatusFilter" onchange="filterProjects()"><option value="">همه وضعیت‌ها</option>${(DATA.stages||[]).map((x,i)=>`<option value="${i}">${x}</option>`).join('')}</select><button class="primary" onclick="editProject()">+ افزودن پروژه</button></div></div><div id="projectRows">${rows.map(projectCard).join('')||'<div class="notice">پروژه‌ای ثبت نشده است.</div>'}</div></div>`;
}
function projectCard(p){
  const q=DATA.people[p.personId]||{}, pct=projectProgress(p);
  return `<div class="project-card" data-search="${(q.name+' '+p.title+' '+p.id).toLowerCase()}" data-team="${q.team||''}" data-stage="${Number(p.stage||0)}">
    <div class="project-top"><div><b>${q.name||p.personId}</b><div class="muted">${p.title||''}</div></div><span class="badge">${DATA.stages[p.stage]||''}</span></div>
    <div style="display:grid;grid-template-columns:1fr 90px;gap:12px;align-items:center;margin-top:12px"><div class="bar"><i style="width:${pct}%"></i></div><b>${fa(pct)}٪</b></div>
    <div class="project-meta"><span>شروع: <b>${p.start||'—'}</b></span><span>پایان: <b>${p.end||'—'}</b></span><span>روز کاری: <b>${p.daysWorked??'—'}</b></span><span>ساعت: <b>${p.hoursWorked??'—'}</b></span></div>
    ${p.note?`<div class="muted" style="margin-top:8px">${p.note}</div>`:''}
    <div class="actions" style="margin-top:12px"><button class="btn" onclick="editProject('${p.id}')">ویرایش</button><button class="btn danger" onclick="delProject('${p.id}')">حذف</button></div>
  </div>`;
}
function filterProjects(){
  const q=($('#projectSearch')?.value||'').toLowerCase(), team=$('#projectTeamFilter')?.value||'', stage=$('#projectStatusFilter')?.value||'';
  $$('#projectRows .project-card').forEach(r=>r.style.display=(!q||r.dataset.search.includes(q))&&(!team||r.dataset.team===team)&&(!stage||r.dataset.stage===stage)?'':'none');
}
function editProject(id){
  const p=id?DATA.projects[id]:{id:'',personId:Object.keys(DATA.people)[0]||'',title:'پروژه جدید',stage:0,progress:0,history:[],start:'',end:'',daysWorked:'',hoursWorked:'',note:''};
  const pct=projectProgress(p);
  $('#content').innerHTML=`<div class="panel"><div class="panel-head"><h2>${id?'ویرایش پروژه':'پروژه جدید'}</h2><button class="btn" onclick="show('projects')">بازگشت</button></div>
  <form id="projectForm"><div class="form-grid">
  <div class="field"><label>شناسه</label><input name="id" value="${p.id}" required ${id?'readonly':''}></div>
  <div class="field"><label>فرد / شرکت</label><select name="personId">${Object.values(DATA.people).map(x=>`<option value="${x.id}" ${x.id===p.personId?'selected':''}>${x.name}</option>`).join('')}</select></div>
  <div class="field full"><label>عنوان پروژه</label><input name="title" value="${p.title||''}" required></div>
  <div class="field"><label>مرحله فعلی</label><select name="stage">${DATA.stages.map((x,i)=>`<option value="${i}" ${i===Number(p.stage)?'selected':''}>${x}</option>`).join('')}</select></div>
  <div class="field"><label>درصد پیشرفت واقعی / تقریبی</label><div class="progress-input"><input id="progressRange" type="range" min="0" max="100" step="1" value="${pct}"><input id="progressNumber" class="progress-number" name="progress" type="number" min="0" max="100" value="${pct}"></div></div>
  <div class="field"><label>تاریخ شروع</label><input name="start" value="${p.start||''}" placeholder="1405/01/01"></div>
  <div class="field"><label>تاریخ پایان</label><input name="end" value="${p.end||''}" placeholder="1405/06/30"></div>
  <div class="field"><label>روزهای کارکرد</label><input name="daysWorked" type="number" min="0" value="${p.daysWorked??''}"></div>
  <div class="field"><label>ساعت‌های کارکرد</label><input name="hoursWorked" type="number" min="0" value="${p.hoursWorked??''}"></div>
  <div class="field full"><label>توضیحات پروژه</label><textarea name="note" placeholder="توضیح کوتاه درباره وضعیت فعلی پروژه…">${p.note||''}</textarea></div>
  <div class="field full"><label>تاریخچه پیشرفت (JSON اختیاری)</label><textarea name="history">${JSON.stringify(p.history||[],null,2)}</textarea></div>
  </div><div class="form-actions"><button class="primary">ذخیره</button><button type="button" class="btn secondary" onclick="show('projects')">انصراف</button></div></form></div>`;
  const range=$('#progressRange'),num=$('#progressNumber'); range.oninput=()=>num.value=range.value; num.oninput=()=>{num.value=Math.max(0,Math.min(100,Number(num.value)||0));range.value=num.value};
  $('#projectForm').onsubmit=saveProject;
}
async function saveProject(e){
  e.preventDefault();const f=new FormData(e.target),p=Object.fromEntries(f.entries());
  p.stage=Number(p.stage);p.progress=Math.max(0,Math.min(100,Number(p.progress)||0));
  if(p.daysWorked!=='')p.daysWorked=Number(p.daysWorked);else delete p.daysWorked;
  if(p.hoursWorked!=='')p.hoursWorked=Number(p.hoursWorked);else delete p.hoursWorked;
  try{p.history=JSON.parse(p.history||'[]')}catch{return alert('فرمت تاریخچه JSON صحیح نیست')}
  await api('/api/projects',{method:'PUT',body:JSON.stringify(p)});await refresh();show('projects');toast('پروژه ذخیره شد');
}
async function delProject(id){if(!confirm('پروژه حذف شود؟'))return;await api('/api/projects/'+id,{method:'DELETE'});await refresh();show('projects');toast('حذف شد')}
function teams(){const ts=Object.values(DATA.teams);$('#content').innerHTML=`<div class="panel"><div class="panel-head"><h2>حوزه‌های سایت</h2><button class="primary" onclick="saveTeams()">ذخیره همه</button></div>${ts.map(t=>`<div class="project-card"><div class="form-grid"><div class="field"><label>عنوان فارسی</label><input class="team-fa" data-id="${t.id}" value="${t.titleFa||''}"></div><div class="field"><label>عنوان انگلیسی</label><input class="team-en" data-id="${t.id}" value="${t.title||''}"></div><div class="field full"><label>زیرعنوان</label><input class="team-sub" data-id="${t.id}" value="${t.subtitle||''}"></div><div class="field full"><label>ابزارهای این حوزه (هر خط یک گروه، به شکل «نام گروه: ابزار۱، ابزار۲»)</label><textarea class="team-tools" data-id="${t.id}" rows="5" placeholder="موتور بازی: Godot، Unity">${escA((t.tools||[]).map(g=>g.group+': '+(g.items||[]).join('، ')).join('\n'))}</textarea></div><div class="field full"><label>آمار این حوزه (هر خط یک مورد، به شکل «عنوان: مقدار»)</label><textarea class="team-stats" data-id="${t.id}" rows="5" placeholder="تعداد تیم‌ها: ۷">${escA((t.stats||[]).map(x=>x.label+': '+x.value).join('\n'))}</textarea></div></div></div>`).join('')}</div>`}
function escA(x){return String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function parseToolLines(txt){return String(txt||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{const i=l.search(/[:：]/);const g=i<0?'ابزارها':l.slice(0,i).trim();const rest=i<0?l:l.slice(i+1);return{group:g||'ابزارها',items:rest.split(/[,،]/).map(x=>x.trim()).filter(Boolean)}}).filter(g=>g.items.length)}
function parseStatLines(txt){return String(txt||'').split(/\r?\n/).map(l=>l.trim()).filter(Boolean).map(l=>{const i=l.search(/[:：]/);return i<0?{label:l,value:''}:{label:l.slice(0,i).trim(),value:l.slice(i+1).trim()}})}
async function saveTeams(){const teams=structuredClone(DATA.teams);Object.values(teams).forEach(t=>{t.titleFa=$('.team-fa[data-id="'+t.id+'"]')?.value||t.titleFa;t.title=$('.team-en[data-id="'+t.id+'"]')?.value||t.title;t.subtitle=$('.team-sub[data-id="'+t.id+'"]')?.value||t.subtitle;const tt=$('.team-tools[data-id="'+t.id+'"]');if(tt)t.tools=parseToolLines(tt.value);const ss=$('.team-stats[data-id="'+t.id+'"]');if(ss)t.stats=parseStatLines(ss.value)});await api('/api/teams',{method:'PUT',body:JSON.stringify({teams})});await refresh();toast('حوزه‌ها ذخیره شدند')}
function site(){const s=DATA.site;$('#content').innerHTML=`<div class="panel"><div class="panel-head"><h2>متن‌های سایت</h2><button class="primary" onclick="saveSite()">ذخیره</button></div><form id="siteForm"><div class="form-grid">${[['name','نام مرکز'],['nameLatin','نام لاتین'],['title','عنوان'],['headline','تیتر'],['lead','متن معرفی'],['aboutTitle','عنوان درباره'],['aboutText','متن درباره'],['toolsTitle','عنوان ابزارها'],['toolsText','متن ابزارها'],['footText','متن فوتر']].map(([k,l])=>`<div class="field ${['lead','aboutText','toolsText','footText'].includes(k)?'full':''}"><label>${l}</label><textarea name="${k}">${s[k]||''}</textarea></div>`).join('')}</div></form></div>${momPanel()}`}
async function saveSite(){const f=new FormData($('#siteForm')),s=Object.fromEntries(f.entries());s.tools=DATA.site.tools||[];s.memberOfMonth=readMOM();await api('/api/site',{method:'PUT',body:JSON.stringify(s)});await refresh();toast('تنظیمات ذخیره شد')}
boot();

/* === Professional utilities === */
function downloadBackup(){
  const blob=new Blob([JSON.stringify(DATA,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='gac-backup-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  toast('نسخه پشتیبان دانلود شد');
}
function openCommandPalette(){
  const m=$('#commandPalette');m.classList.remove('hidden');m.setAttribute('aria-hidden','false');$('#commandInput').value='';renderCommandResults('');setTimeout(()=>$('#commandInput').focus(),30);
}
function closeCommandPalette(){const m=$('#commandPalette');m.classList.add('hidden');m.setAttribute('aria-hidden','true')}
function renderCommandResults(q){
  q=(q||'').trim().toLowerCase();
  const items=[
    ...Object.values(DATA.people||{}).map(x=>({title:x.name,sub:'فرد / شرکت',action:()=>{closeCommandPalette();show('people');setTimeout(()=>{const i=$('#peopleSearch');if(i){i.value=x.name.toLowerCase();filterPeople()}},20)}})),
    ...Object.values(DATA.projects||{}).map(x=>({title:x.title||x.id,sub:'پروژه',action:()=>{closeCommandPalette();show('projects');setTimeout(()=>{const i=$('#projectSearch');if(i){i.value=(x.title||'').toLowerCase();filterProjects()}},20)}})),
    ...Object.values(DATA.teams||{}).map(x=>({title:x.titleFa,sub:'حوزه',action:()=>{closeCommandPalette();show('teams')}}))
  ];
  const filtered=items.filter(x=>(x.title+' '+x.sub).toLowerCase().includes(q)).slice(0,12);
  $('#commandResults').innerHTML=filtered.map((x,i)=>`<div class="command-item ${i===0?'active':''}" data-index="${i}"><span>${x.title}</span><small>${x.sub}</small></div>`).join('')||'<div class="notice">نتیجه‌ای پیدا نشد.</div>';
  $$('#commandResults .command-item').forEach((el,i)=>el.onclick=()=>filtered[i].action());
}
$('#globalSearchBtn')?.addEventListener('click',openCommandPalette);
$('#refreshBtn')?.addEventListener('click',async()=>{await refresh();show(currentView);toast('اطلاعات به‌روزرسانی شد')});
$('#commandInput')?.addEventListener('input',e=>renderCommandResults(e.target.value));
$$('[data-close]').forEach(x=>x.addEventListener('click',closeCommandPalette));
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openCommandPalette()}
  if(e.key==='Escape')closeCommandPalette();
});

function momPanel(){const m=DATA.site.memberOfMonth||{},ppl=Object.values(DATA.people||{});return `<div class="panel" style="margin-top:18px"><div class="panel-head"><h2>کاربر برتر ماه</h2><button class="primary" onclick="saveSite()">ذخیره</button></div><form id="momForm"><div class="form-grid"><div class="field"><label>فرد یا شرکت</label><select name="personId"><option value="">— بدون انتخاب (مخفی) —</option>${ppl.map(p=>`<option value="${p.id}" ${p.id===m.personId?'selected':''}>${p.name}</option>`).join('')}</select></div><div class="field"><label>ماه</label><input name="month" value="${m.month||''}" placeholder="مثلاً مهر ۱۴۰۵"></div><div class="field full"><label>دلیل انتخاب (یک جمله)</label><textarea name="headline">${m.headline||''}</textarea></div><div class="field full"><label>جمله‌ی نقل‌قول</label><textarea name="quote">${m.quote||''}</textarea></div><div class="field full"><label>دستاوردها (هر خط یک مورد)</label><textarea name="reasons" rows="4">${(m.reasons||[]).join('\n')}</textarea></div></div></form><p style="color:#7c8995;font-size:12px;margin-top:10px">عکس و پروژه‌ی نمایش‌داده‌شده خودکار از پروفایل و پروژه‌ی همان فرد خوانده می‌شود.</p></div>`}
function readMOM(){const f=document.querySelector('#momForm');if(!f)return DATA.site.memberOfMonth;const v=Object.fromEntries(new FormData(f).entries());v.reasons=(v.reasons||'').split('\n').map(x=>x.trim()).filter(Boolean);return v}


/* ===================== حساب اعضا و سرگروه‌ها ===================== */
let USERS=[];
const eh=x=>String(x==null?'':x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const fdate=s=>s?new Date(s).toLocaleDateString('fa-IR'):'—';
async function users(){
  $('#content').innerHTML='<div class="panel"><div class="muted">در حال بارگذاری…</div></div>';
  try{USERS=(await api('/api/users')).users}catch(e){$('#content').innerHTML='<div class="notice">'+eh(e.message)+'</div>';return}
  const withAcc=new Set(USERS.map(u=>u.personId));
  const missing=Object.values(DATA.people).filter(p=>!withAcc.has(p.id));
  const origin=location.origin+'/panel/';
  $('#content').innerHTML=`
  <div class="panel"><div class="panel-head"><h2>ورود اعضا به پنل</h2></div>
    <div class="notice">اعضا از آدرس <b dir="ltr">${eh(origin)}</b> وارد می‌شوند. رمزها فقط همان لحظه‌ی ساخت یا بازنشانی نمایش داده می‌شوند؛ آن را برای عضو بفرستید. عضو در اولین ورود مجبور به تعویض رمز می‌شود.</div>
    <div class="toolbar" style="margin-top:14px">
      <button class="primary" onclick="newUserForm()">+ حساب جدید</button>
      <button class="btn" onclick="bulkUsers()" ${missing.length?'':'disabled'}>ساخت حساب برای همه‌ی بدون‌حساب‌ها (${fa(missing.length)} نفر)</button>
    </div><div id="userForm"></div><div id="credBox"></div></div>
  <div class="panel"><div class="panel-head"><h2>حساب‌های ساخته‌شده (${fa(USERS.length)})</h2></div>
    <div class="table-wrap"><table class="table"><thead><tr><th>فرد / شرکت</th><th>نام کاربری</th><th>نقش</th><th>آخرین ورود</th><th>وضعیت</th><th></th></tr></thead>
    <tbody>${USERS.map(u=>`<tr><td>${eh(u.personName)}</td><td dir="ltr" style="text-align:right">${eh(u.username)}</td>
      <td><select onchange="setUserRole(${u.id},this.value)"><option value="member" ${u.role==='member'?'selected':''}>عضو</option><option value="lead" ${u.role==='lead'?'selected':''}>سرگروه حوزه</option></select></td>
      <td>${fdate(u.lastLogin)}</td>
      <td>${u.disabled?'<span class="badge" style="background:#fdecec;color:#c33">غیرفعال</span>':(u.mustChange?'<span class="badge">رمز اولیه</span>':'<span class="badge" style="background:#e8f7f0;color:#1f9d6b">فعال</span>')}</td>
      <td><div class="actions"><button class="btn" onclick="resetUserPw(${u.id})">رمز جدید</button><button class="btn" onclick="toggleUser(${u.id},${!u.disabled})">${u.disabled?'فعال‌سازی':'غیرفعال'}</button><button class="btn danger" onclick="delUser(${u.id})">حذف</button></div></td></tr>`).join('')||'<tr><td colspan="6" class="empty">هنوز حسابی ساخته نشده است.</td></tr>'}</tbody></table></div></div>`;
}
function newUserForm(){
  const withAcc=new Set(USERS.map(u=>u.personId));
  const opts=Object.values(DATA.people).filter(p=>!withAcc.has(p.id)).map(p=>`<option value="${eh(p.id)}">${eh(p.name)} — ${eh(DATA.teams[p.team]?.titleFa||p.team)}</option>`).join('');
  if(!opts){toast('همه‌ی افراد حساب دارند');return}
  $('#userForm').innerHTML=`<form class="form-grid" style="margin-top:16px" onsubmit="createUserSubmit(event)">
    <div class="field"><label>فرد / شرکت</label><select name="personId">${opts}</select></div>
    <div class="field"><label>نام کاربری (انگلیسی)</label><input name="username" dir="ltr" pattern="[A-Za-z0-9._-]{3,32}" required placeholder="مثلاً ali.rezaei"></div>
    <div class="field"><label>نقش</label><select name="role"><option value="member">عضو (فقط پروفایل خودش)</option><option value="lead">سرگروه (همه‌ی اعضای حوزه‌اش)</option></select></div>
    <div class="field"><label>رمز (خالی = ساخت خودکار)</label><input name="password" dir="ltr" minlength="8" placeholder="حداقل ۸ نویسه"></div>
    <div class="form-actions"><button class="primary">ساخت حساب</button></div></form>`;
}
function showCreds(list){
  const rows=list.map(c=>`${c.name}\t${c.username}\t${c.password}`).join('\n');
  $('#credBox').innerHTML=`<div class="notice" style="margin-top:16px"><b>این رمزها دیگر نمایش داده نمی‌شوند.</b> همین حالا کپی کنید و برای هر نفر بفرستید.
    <table class="table" style="margin-top:10px"><thead><tr><th>نام</th><th>نام کاربری</th><th>رمز</th></tr></thead><tbody>${list.map(c=>`<tr><td>${eh(c.name)}</td><td dir="ltr" style="text-align:right">${eh(c.username)}</td><td dir="ltr" style="text-align:right"><b>${eh(c.password)}</b></td></tr>`).join('')}</tbody></table>
    <button class="btn" style="margin-top:10px" id="copyCreds">کپی همه</button></div>`;
  $('#copyCreds').onclick=()=>navigator.clipboard.writeText(rows).then(()=>toast('کپی شد'),()=>toast('کپی نشد؛ دستی انتخاب کنید'));
}
async function createUserSubmit(e){
  e.preventDefault();const b=Object.fromEntries(new FormData(e.target).entries());
  try{const r=await api('/api/users',{method:'POST',body:JSON.stringify(b)});const name=DATA.people[b.personId]?.name||b.personId;await users();showCreds([{name,username:r.username,password:r.password}])}
  catch(x){alert(x.message)}
}
async function bulkUsers(){
  if(!confirm('برای همه‌ی افرادی که هنوز حساب ندارند، حساب با رمز تصادفی ساخته شود؟'))return;
  try{const r=await api('/api/users/bulk',{method:'POST'});await users();showCreds(r.created)}catch(x){alert(x.message)}
}
async function resetUserPw(id){
  if(!confirm('رمز جدید ساخته شود؟ رمز قبلی از کار می‌افتد.'))return;
  try{const r=await api('/api/users/'+id,{method:'PUT',body:JSON.stringify({resetPassword:true})});const u=USERS.find(x=>x.id===id);await users();showCreds([{name:u.personName,username:u.username,password:r.password}])}catch(x){alert(x.message)}
}
async function setUserRole(id,role){try{await api('/api/users/'+id,{method:'PUT',body:JSON.stringify({role})});toast('نقش تغییر کرد')}catch(x){alert(x.message)}}
async function toggleUser(id,disabled){try{await api('/api/users/'+id,{method:'PUT',body:JSON.stringify({disabled})});await users();toast(disabled?'حساب غیرفعال شد':'حساب فعال شد')}catch(x){alert(x.message)}}
async function delUser(id){if(!confirm('این حساب حذف شود؟ (پروفایل فرد حذف نمی‌شود)'))return;try{await api('/api/users/'+id,{method:'DELETE'});await users();toast('حساب حذف شد')}catch(x){alert(x.message)}}
