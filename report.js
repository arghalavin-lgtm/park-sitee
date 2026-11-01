'use strict';
/* ===================================================================
   گزارش اکسل پروژه‌ها (مخصوص مدیر)
   - بدون هیچ پکیج اضافه: فایل .xlsx با ماژول‌های داخلی Node ساخته می‌شود.
   - شیت‌ها: نمای کلی | در دست انجام | برنامه‌ریزی شده | اتمام شده | مالی
   - همه‌ی شیت‌ها راست‌به‌چپ (RTL) هستند.
   - واحد پول گزارش را همین‌جا عوض کنید:
=================================================================== */
const zlib = require('zlib');

const CURRENCY = 'تومان';

/* ----------------------------- دسته‌بندی پروژه‌ها -----------------------------
   اتمام شده     : مرحله‌ی آخر (تکمیل‌شده) یا پیشرفت ۱۰۰٪
   در دست انجام  : مرحله‌ی «در حال تولید» به بعد، یا هر پروژه‌ای که پیشرفتش بیشتر از صفر است
   برنامه‌ریزی شده: بقیه (هنوز شروع نشده / در مرحله‌ی برنامه‌ریزی و پیشرفت صفر) */
const CATS = [
  { key: 'active',  label: 'در دست انجام',    header: 'hdrActive',  tab: 'FFE97132' },
  { key: 'planned', label: 'برنامه‌ریزی شده', header: 'hdrPlanned', tab: 'FF0F9ED5' },
  { key: 'done',    label: 'اتمام شده',       header: 'hdrDone',    tab: 'FF2E7D32' }
];
const CAT_LABEL = Object.fromEntries(CATS.map(c => [c.key, c.label]));

function progressOf(p){
  const v = Number(p.progress != null ? p.progress : Number(p.stage || 0) * 25);
  return Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
}
function categoryOf(p, lastStage){
  const pr = progressOf(p), st = Number(p.stage || 0);
  if(st >= lastStage || pr >= 100) return 'done';
  if(st >= 2 || pr > 0) return 'active';
  return 'planned';
}

/* ----------------------------- تاریخ شمسی ----------------------------- */
let jf = null;
try{ jf = new Intl.DateTimeFormat('fa-IR-u-ca-persian-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'UTC' }); }catch(e){}
function jalali(date){
  if(!date || Number.isNaN(date.getTime())) return '';
  if(!jf) return date.toISOString().slice(0, 10);
  const o = {}; jf.formatToParts(date).forEach(x => { o[x.type] = x.value; });
  return o.year + '/' + o.month + '/' + o.day;
}
function isoToJalali(s){
  if(!s) return '';
  const d = new Date(String(s).slice(0, 10) + 'T12:00:00Z');
  return Number.isNaN(d.getTime()) ? String(s) : jalali(d);
}

/* ----------------------------- ساخت ZIP (برای xlsx) ----------------------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for(let n = 0; n < 256; n++){ let c = n; for(let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c; }
  return t;
})();
function crc32(buf){ let c = -1; for(let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }

function zip(files){
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [], central = [];
  let offset = 0;
  files.forEach(f => {
    const name = Buffer.from(f.name, 'utf8');
    const data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data, 'utf8');
    const comp = zlib.deflateRawSync(data);
    const crc = crc32(data);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0800, 6); lh.writeUInt16LE(8, 8);
    lh.writeUInt16LE(dosTime, 10); lh.writeUInt16LE(dosDate, 12); lh.writeUInt32LE(crc, 14);
    lh.writeUInt32LE(comp.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    parts.push(lh, name, comp);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0800, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt16LE(dosTime, 12); ch.writeUInt16LE(dosDate, 14); ch.writeUInt32LE(crc, 16);
    ch.writeUInt32LE(comp.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(name.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, name);
    offset += lh.length + name.length + comp.length;
  });
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

/* ----------------------------- استایل‌ها ----------------------------- */
const FONTS = [
  { sz: 10, b: 0, i: 0, color: 'FF1F2933' },   // 0 معمولی
  { sz: 10, b: 1, i: 0, color: 'FF1F2933' },   // 1 توپر
  { sz: 10, b: 1, i: 0, color: 'FFFFFFFF' },   // 2 سفید توپر (سرستون)
  { sz: 16, b: 1, i: 0, color: 'FFFFFFFF' },   // 3 عنوان
  { sz: 9,  b: 0, i: 1, color: 'FF6B7785' },   // 4 زیرعنوان
  { sz: 12, b: 1, i: 0, color: 'FF156082' }    // 5 عنوان بخش
];
const FILLS = [null, 'gray125', 'FF156082', 'FFE97132', 'FF0F9ED5', 'FF2E7D32', 'FFF2F6F9'];
const MONEY_FMT = 164;
// نام: [فونت، پس‌زمینه، کادر، قالب عدد، تراز افقی، شکستن خط]
const STYLE_DEFS = {
  base:       [0, 0, 0, 0, null, 0],
  title:      [3, 2, 0, 0, 'center', 0],
  sub:        [4, 0, 0, 0, 'right', 0],
  section:    [5, 0, 0, 0, 'right', 0],
  hdrNavy:    [2, 2, 1, 0, 'center', 1],
  hdrActive:  [2, 3, 1, 0, 'center', 1],
  hdrPlanned: [2, 4, 1, 0, 'center', 1],
  hdrDone:    [2, 5, 1, 0, 'center', 1],
  txt:        [0, 0, 1, 0, 'right', 1],
  ctr:        [0, 0, 1, 0, 'center', 1],
  int:        [0, 0, 1, 3, 'center', 0],
  money:      [0, 0, 1, MONEY_FMT, 'center', 0],
  pct:        [0, 0, 1, 9, 'center', 0],
  totLbl:     [1, 6, 1, 0, 'right', 0],
  totInt:     [1, 6, 1, 3, 'center', 0],
  totMoney:   [1, 6, 1, MONEY_FMT, 'center', 0],
  totPct:     [1, 6, 1, 9, 'center', 0],
  totBlank:   [1, 6, 1, 0, 'center', 0]
};
const STYLE_KEYS = Object.keys(STYLE_DEFS);
const SI = Object.fromEntries(STYLE_KEYS.map((k, i) => [k, i]));

function stylesXml(){
  const fonts = FONTS.map(f => `<font>${f.b ? '<b/>' : ''}${f.i ? '<i/>' : ''}<sz val="${f.sz}"/><color rgb="${f.color}"/><name val="Tahoma"/><family val="2"/></font>`).join('');
  const fills = FILLS.map(f => !f ? '<fill><patternFill patternType="none"/></fill>'
    : f === 'gray125' ? '<fill><patternFill patternType="gray125"/></fill>'
    : `<fill><patternFill patternType="solid"><fgColor rgb="${f}"/><bgColor indexed="64"/></patternFill></fill>`).join('');
  const edge = n => `<${n} style="thin"><color rgb="FFCBD5DD"/></${n}>`;
  const borders = '<border><left/><right/><top/><bottom/><diagonal/></border>'
    + `<border>${edge('left')}${edge('right')}${edge('top')}${edge('bottom')}<diagonal/></border>`;
  const xfs = STYLE_KEYS.map(k => {
    const [font, fill, border, fmt, h, wrap] = STYLE_DEFS[k];
    const align = `<alignment${h ? ` horizontal="${h}"` : ''} vertical="center" readingOrder="2"${wrap ? ' wrapText="1"' : ''}/>`;
    return `<xf numFmtId="${fmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`;
  }).join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<numFmts count="1"><numFmt numFmtId="${MONEY_FMT}" formatCode="#,##0;[Red]\\-#,##0"/></numFmts>`
    + `<fonts count="${FONTS.length}">${fonts}</fonts><fills count="${FILLS.length}">${fills}</fills><borders count="2">${borders}</borders>`
    + '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
    + `<cellXfs count="${STYLE_KEYS.length}">${xfs}</cellXfs>`
    + '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
}

/* ----------------------------- سلول‌ها و شیت‌ها ----------------------------- */
const T = (v, s = 'txt') => ({ t: 's', v: v == null ? '' : String(v), s });
const N = (v, s = 'int') => (v == null || Number.isNaN(v)) ? { t: 'b', s } : { t: 'n', v: Number(v), s };
const F = (f, v, s = 'int') => ({ t: 'f', f, v: Number(v) || 0, s });
const B = (s = 'txt') => ({ t: 'b', s });

function colName(i){ let s = ''; i++; while(i > 0){ const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function esc(s){
  return String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function cellXml(c, ref){
  if(!c) return '';
  const s = SI[c.s] != null ? SI[c.s] : 0;
  if(c.t === 'b') return `<c r="${ref}" s="${s}"/>`;
  if(c.t === 'n') return `<c r="${ref}" s="${s}"><v>${c.v}</v></c>`;
  if(c.t === 'f') return `<c r="${ref}" s="${s}"><f>${esc(c.f)}</f><v>${c.v}</v></c>`;
  return `<c r="${ref}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${esc(c.v)}</t></is></c>`;
}

function sheetXml(sh, selected){
  const rows = sh.rows;
  const widths = sh.widths || [];
  const lastCol = Math.max(widths.length, ...rows.map(r => r.length), 1);
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  const data = rows.map((r, ri) => {
    const cells = r.map((c, ci) => cellXml(c, colName(ci) + (ri + 1))).join('');
    const ht = sh.heights && sh.heights[ri + 1];
    return `<row r="${ri + 1}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>${cells}</row>`;
  }).join('');
  const pane = sh.freezeRows
    ? `<pane ySplit="${sh.freezeRows}" topLeftCell="A${sh.freezeRows + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>` : '';
  const merges = (sh.merges || []).length
    ? `<mergeCells count="${sh.merges.length}">${sh.merges.map(m => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>` : '';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + `<sheetPr><tabColor rgb="${sh.tab || 'FF156082'}"/><pageSetUpPr fitToPage="1"/></sheetPr>`
    + `<dimension ref="A1:${colName(lastCol - 1)}${Math.max(rows.length, 1)}"/>`
    + `<sheetViews><sheetView rightToLeft="1" workbookViewId="0"${selected ? ' tabSelected="1"' : ''}>${pane}</sheetView></sheetViews>`
    + '<sheetFormatPr defaultRowHeight="20"/>'
    + (cols ? `<cols>${cols}</cols>` : '')
    + `<sheetData>${data}</sheetData>`
    + (sh.filter ? `<autoFilter ref="${sh.filter}"/>` : '')
    + merges
    + '<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>'
    + '<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
    + '</worksheet>';
}

function workbookBuffer(sheets){
  const files = [];
  files.push({ name: '[Content_Types].xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')
    + '</Types>' });
  files.push({ name: '_rels/.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>' });
  files.push({ name: 'xl/workbook.xml', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    + '<bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12000" activeTab="0"/></bookViews>'
    + '<sheets>' + sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets>'
    + '<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>' });
  files.push({ name: 'xl/_rels/workbook.xml.rels', data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')
    + `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
    + '</Relationships>' });
  files.push({ name: 'xl/styles.xml', data: stylesXml() });
  sheets.forEach((s, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: sheetXml(s, i === 0) }));
  return zip(files);
}

/* ----------------------------- جمع‌آوری داده‌ی گزارش ----------------------------- */
function collect(data, finance, opts){
  const stages = data.stages || [];
  const lastStage = Math.max(1, stages.length - 1);
  const teamIds = Object.keys(data.teams || {});
  const teamOrder = Object.fromEntries(teamIds.map((id, i) => [id, i]));
  let list = Object.values(data.projects || {}).map(p => {
    const person = (data.people || {})[p.personId] || {};
    const team = (data.teams || {})[person.team] || {};
    const fin = (finance || {})[p.id] || {};
    const hasBudget = fin.budget != null, hasSpent = fin.spent != null;
    const budget = hasBudget ? Number(fin.budget) : null;
    const spent = hasSpent ? Number(fin.spent) : null;
    return {
      id: p.id, title: p.title || 'پروژه بدون عنوان', person: person.name || p.personId || '',
      type: person.type === 'company' ? 'شرکت / گروه' : 'کارآموز',
      teamId: person.team || '', team: team.titleFa || person.team || '—',
      stage: stages[p.stage] || '', progress: progressOf(p), cat: categoryOf(p, lastStage),
      start: p.start || '', end: p.end || '', days: p.daysWorked != null ? Number(p.daysWorked) : null,
      hours: p.hoursWorked != null ? Number(p.hoursWorked) : null,
      updated: p.updatedAt || '', note: p.note || '',
      budget, spent, hasFin: hasBudget || hasSpent,
      remaining: (hasBudget || hasSpent) ? (budget || 0) - (spent || 0) : null,
      funder: fin.funder || '', finNote: fin.note || ''
    };
  });
  if(opts.team) list = list.filter(x => x.teamId === opts.team);
  // «آخرین پروژه‌ها» اول: جدیدترین به‌روزرسانی، بعد حوزه، بعد عنوان
  list.sort((a, b) => (b.updated || '').localeCompare(a.updated || '')
    || ((teamOrder[a.teamId] ?? 99) - (teamOrder[b.teamId] ?? 99))
    || a.title.localeCompare(b.title, 'fa'));
  return { list, teamIds, teamOrder };
}
const sum = (arr, k) => arr.reduce((a, x) => a + (Number(x[k]) || 0), 0);
const avgProgress = arr => arr.length ? arr.reduce((a, x) => a + x.progress, 0) / arr.length / 100 : 0;

/* ----------------------------- شیت ۱: نمای کلی ----------------------------- */
function summarySheet(data, rep, opts){
  const { list } = rep;
  const teams = data.teams || {};
  const teamName = opts.team ? ((teams[opts.team] || {}).titleFa || opts.team) : 'همه حوزه‌ها';
  const W = 8;
  const rows = [], merges = [], heights = {};
  const pad = (arr) => { while(arr.length < W) arr.push(B('base')); return arr; };

  rows.push(pad([T('گزارش پروژه‌های ' + ((data.site && data.site.name) || 'مرکز'), 'title')]));
  for(let i = 1; i < W; i++) rows[0][i] = B('title');
  merges.push('A1:H1'); heights[1] = 34;
  rows.push(pad([T('تاریخ گزارش: ' + jalali(new Date()) + '     |     حوزه: ' + teamName + '     |     واحد مبلغ: ' + CURRENCY, 'sub')]));
  merges.push('A2:H2');
  rows.push(pad([]));

  // --- جدول وضعیت ---
  rows.push(pad([T('خلاصه‌ی وضعیت پروژه‌ها', 'section')])); merges.push('A4:H4');
  rows.push(pad(['وضعیت', 'تعداد', 'سهم از کل', 'میانگین پیشرفت', 'بودجه (' + CURRENCY + ')', 'هزینه‌شده (' + CURRENCY + ')', 'باقی‌مانده (' + CURRENCY + ')'].map(h => T(h, 'hdrNavy')))); heights[5] = 32;
  const first = rows.length + 1;
  CATS.forEach((c, i) => {
    const sub = list.filter(x => x.cat === c.key);
    const r = first + i;
    rows.push(pad([
      T(c.label, 'txt'), N(sub.length), F(`IF($B$${first + 3}=0,0,B${r}/$B$${first + 3})`, list.length ? sub.length / list.length : 0, 'pct'),
      N(avgProgress(sub), 'pct'), N(sum(sub, 'budget'), 'money'), N(sum(sub, 'spent'), 'money'),
      F(`E${r}-F${r}`, sum(sub, 'budget') - sum(sub, 'spent'), 'money')
    ]));
  });
  const tr = first + 3;
  rows.push(pad([
    T('جمع کل', 'totLbl'), F(`SUM(B${first}:B${first + 2})`, list.length, 'totInt'),
    F(`SUM(C${first}:C${first + 2})`, list.length ? 1 : 0, 'totPct'), N(avgProgress(list), 'totPct'),
    F(`SUM(E${first}:E${first + 2})`, sum(list, 'budget'), 'totMoney'), F(`SUM(F${first}:F${first + 2})`, sum(list, 'spent'), 'totMoney'),
    F(`E${tr}-F${tr}`, sum(list, 'budget') - sum(list, 'spent'), 'totMoney')
  ]));
  rows.push(pad([]));

  // --- جدول به تفکیک حوزه ---
  const secRow = rows.length + 1;
  rows.push(pad([T('تفکیک بر اساس حوزه (تیم)', 'section')])); merges.push(`A${secRow}:H${secRow}`);
  rows.push(pad(['حوزه', 'در دست انجام', 'برنامه‌ریزی شده', 'اتمام شده', 'جمع پروژه‌ها', 'بودجه (' + CURRENCY + ')', 'هزینه‌شده (' + CURRENCY + ')', 'باقی‌مانده (' + CURRENCY + ')'].map(h => T(h, 'hdrNavy')))); heights[rows.length] = 32;
  const shown = (opts.team ? [opts.team] : rep.teamIds).filter(id => teams[id]);
  const tFirst = rows.length + 1;
  shown.forEach((id, i) => {
    const sub = list.filter(x => x.teamId === id), r = tFirst + i;
    const cnt = k => sub.filter(x => x.cat === k).length;
    rows.push([
      T(teams[id].titleFa || id, 'txt'), N(cnt('active')), N(cnt('planned')), N(cnt('done')),
      F(`SUM(B${r}:D${r})`, sub.length), N(sum(sub, 'budget'), 'money'), N(sum(sub, 'spent'), 'money'),
      F(`F${r}-G${r}`, sum(sub, 'budget') - sum(sub, 'spent'), 'money')
    ]);
  });
  if(shown.length){
    const tl = tFirst + shown.length - 1, tt = tl + 1;
    const col = (L, k, st) => F(`SUM(${L}${tFirst}:${L}${tl})`, k, st);
    rows.push([
      T('جمع کل', 'totLbl'),
      col('B', list.filter(x => x.cat === 'active').length, 'totInt'), col('C', list.filter(x => x.cat === 'planned').length, 'totInt'),
      col('D', list.filter(x => x.cat === 'done').length, 'totInt'), col('E', list.length, 'totInt'),
      col('F', sum(list, 'budget'), 'totMoney'), col('G', sum(list, 'spent'), 'totMoney'),
      F(`F${tt}-G${tt}`, sum(list, 'budget') - sum(list, 'spent'), 'totMoney')
    ]);
  }
  rows.push(pad([]));
  rows.push(pad([T('دسته‌بندی: «اتمام شده» = مرحله‌ی تکمیل یا پیشرفت ۱۰۰٪ ؛ «در دست انجام» = مرحله‌ی تولید به بعد یا پیشرفت بیشتر از صفر ؛ «برنامه‌ریزی شده» = بقیه.', 'sub')]));
  merges.push(`A${rows.length}:H${rows.length}`);
  return { name: 'نمای کلی', tab: 'FF156082', widths: [26, 16, 16, 16, 20, 20, 20, 20], rows, merges, heights };
}

/* ----------------------------- شیت‌های دسته‌ها ----------------------------- */
const DETAIL_HEAD = ['ردیف', 'عنوان پروژه', 'مسئول (فرد / شرکت)', 'نوع', 'حوزه / تیم', 'مرحله', 'پیشرفت', 'تاریخ شروع', 'تاریخ پایان',
  'روز کارکرد', 'ساعت کارکرد', 'آخرین به‌روزرسانی', 'بودجه (' + CURRENCY + ')', 'هزینه‌شده (' + CURRENCY + ')', 'باقی‌مانده (' + CURRENCY + ')', 'توضیحات'];
const DETAIL_W = [6, 30, 24, 13, 18, 16, 10, 13, 13, 11, 11, 15, 18, 18, 18, 40];

function categorySheet(cat, rep){
  const sub = rep.list.filter(x => x.cat === cat.key);
  const L = DETAIL_HEAD.length;
  const rows = [], merges = ['A1:' + colName(L - 1) + '1', 'A2:' + colName(L - 1) + '2'];
  const fillRow = (r, st) => { while(r.length < L) r.push(B(st)); return r; };
  rows.push(fillRow([T('پروژه‌های ' + cat.label, 'title')], 'title'));
  rows.push(fillRow([T('تعداد: ' + sub.length + '     |     تاریخ گزارش: ' + jalali(new Date()), 'sub')], 'base'));
  rows.push(DETAIL_HEAD.map(h => T(h, cat.header)));
  sub.forEach((x, i) => {
    const r = rows.length + 1;
    rows.push([
      N(i + 1, 'int'), T(x.title), T(x.person), T(x.type, 'ctr'), T(x.team, 'ctr'), T(x.stage, 'ctr'), N(x.progress / 100, 'pct'),
      T(x.start, 'ctr'), T(x.end, 'ctr'), N(x.days), N(x.hours), T(isoToJalali(x.updated), 'ctr'),
      N(x.budget, 'money'), N(x.spent, 'money'),
      x.hasFin ? F(`M${r}-N${r}`, x.remaining, 'money') : B('money'), T(x.note)
    ]);
  });
  const dataFirst = 4, dataLast = 3 + sub.length;
  if(!sub.length){
    rows.push(fillRow([T('پروژه‌ای در این دسته ثبت نشده است.', 'ctr')], 'ctr'));
    merges.push('A4:' + colName(L - 1) + '4');
  }else{
    rows.push([]);
    const tr = rows.length + 1;
    const tot = fillRow([T('جمع', 'totLbl'), B('totBlank')], 'totBlank');
    tot[1] = T(sub.length + ' پروژه', 'totLbl');
    tot[6] = N(avgProgress(sub), 'totPct');
    tot[9] = F(`SUM(J${dataFirst}:J${dataLast})`, sum(sub, 'days'), 'totInt');
    tot[10] = F(`SUM(K${dataFirst}:K${dataLast})`, sum(sub, 'hours'), 'totInt');
    tot[12] = F(`SUM(M${dataFirst}:M${dataLast})`, sum(sub, 'budget'), 'totMoney');
    tot[13] = F(`SUM(N${dataFirst}:N${dataLast})`, sum(sub, 'spent'), 'totMoney');
    tot[14] = F(`M${tr}-N${tr}`, sum(sub, 'budget') - sum(sub, 'spent'), 'totMoney');
    rows.push(tot);
  }
  return { name: cat.label, tab: cat.tab, widths: DETAIL_W, rows, merges, heights: { 1: 34, 3: 32 }, freezeRows: 3,
    filter: sub.length ? `A3:${colName(L - 1)}${dataLast}` : null };
}

/* ----------------------------- شیت مالی ----------------------------- */
function financeSheet(data, rep, opts){
  const { list } = rep;
  const head = ['ردیف', 'عنوان پروژه', 'مسئول (فرد / شرکت)', 'حوزه / تیم', 'وضعیت', 'بودجه (' + CURRENCY + ')', 'هزینه‌شده (' + CURRENCY + ')',
    'باقی‌مانده (' + CURRENCY + ')', 'درصد مصرف', 'منبع تأمین مالی', 'توضیحات مالی'];
  const L = head.length;
  const rows = [], merges = ['A1:' + colName(L - 1) + '1', 'A2:' + colName(L - 1) + '2'];
  const fillRow = (r, st) => { while(r.length < L) r.push(B(st)); return r; };
  const withFin = list.filter(x => x.hasFin).length;
  rows.push(fillRow([T('گزارش مالی پروژه‌ها', 'title')], 'title'));
  rows.push(fillRow([T('پروژه‌های دارای اطلاعات مالی: ' + withFin + ' از ' + list.length + '     |     واحد مبلغ: ' + CURRENCY + '     |     تاریخ گزارش: ' + jalali(new Date()), 'sub')], 'base'));
  rows.push(head.map(h => T(h, 'hdrNavy')));
  list.forEach((x, i) => {
    const r = rows.length + 1;
    rows.push([
      N(i + 1, 'int'), T(x.title), T(x.person), T(x.team, 'ctr'), T(CAT_LABEL[x.cat], 'ctr'),
      N(x.budget, 'money'), N(x.spent, 'money'),
      x.hasFin ? F(`F${r}-G${r}`, x.remaining, 'money') : B('money'),
      (x.budget > 0) ? F(`IF(F${r}=0,0,G${r}/F${r})`, (x.spent || 0) / x.budget, 'pct') : B('pct'),
      T(x.funder), T(x.finNote)
    ]);
  });
  const dataFirst = 4, dataLast = 3 + list.length;
  if(!list.length){
    rows.push(fillRow([T('پروژه‌ای ثبت نشده است.', 'ctr')], 'ctr'));
    merges.push('A4:' + colName(L - 1) + '4');
  }else{
    rows.push([]);
    const tr = rows.length + 1;
    const tot = fillRow([T('جمع کل', 'totLbl')], 'totBlank');
    const b = sum(list, 'budget'), s = sum(list, 'spent');
    tot[5] = F(`SUM(F${dataFirst}:F${dataLast})`, b, 'totMoney');
    tot[6] = F(`SUM(G${dataFirst}:G${dataLast})`, s, 'totMoney');
    tot[7] = F(`F${tr}-G${tr}`, b - s, 'totMoney');
    tot[8] = F(`IF(F${tr}=0,0,G${tr}/F${tr})`, b > 0 ? s / b : 0, 'totPct');
    rows.push(tot);

    // جمع مالی به تفکیک حوزه
    rows.push([]);
    const secRow = rows.length + 1;
    rows.push(fillRow([T('جمع مالی به تفکیک حوزه', 'section')], 'base')); merges.push(`A${secRow}:${colName(L - 1)}${secRow}`);
    rows.push(fillRow([T('حوزه / تیم', 'hdrNavy'), B('hdrNavy'), B('hdrNavy'), B('hdrNavy'), T('تعداد پروژه', 'hdrNavy'),
      T('بودجه (' + CURRENCY + ')', 'hdrNavy'), T('هزینه‌شده (' + CURRENCY + ')', 'hdrNavy'), T('باقی‌مانده (' + CURRENCY + ')', 'hdrNavy'), T('درصد مصرف', 'hdrNavy')], 'base'));
    merges.push(`A${rows.length}:D${rows.length}`);
    const shown = (opts.team ? [opts.team] : rep.teamIds).filter(id => (data.teams || {})[id]);
    shown.forEach(id => {
      const sub = list.filter(x => x.teamId === id), r = rows.length + 1;
      const bb = sum(sub, 'budget'), ss = sum(sub, 'spent');
      rows.push(fillRow([T(data.teams[id].titleFa || id, 'txt'), B('txt'), B('txt'), B('txt'), N(sub.length), N(bb, 'money'), N(ss, 'money'),
        F(`F${r}-G${r}`, bb - ss, 'money'),
        bb > 0 ? F(`IF(F${r}=0,0,G${r}/F${r})`, ss / bb, 'pct') : B('pct')], 'base'));
      merges.push(`A${r}:D${r}`);
    });
  }
  return { name: 'مالی', tab: 'FF7A3E9D', widths: [6, 30, 24, 18, 16, 18, 18, 18, 12, 24, 36], rows, merges, heights: { 1: 34, 3: 32 }, freezeRows: 3,
    filter: list.length ? `A3:${colName(L - 1)}${dataLast}` : null };
}

/* ----------------------------- ورودی اصلی ----------------------------- */
/* data: خروجی db.loadData() ؛ finance: خروجی db.getAllFinance() ؛ opts.team: شناسه‌ی حوزه (اختیاری) */
function buildProjectsReport(data, finance, opts = {}){
  const rep = collect(data, finance, opts);
  const sheets = [summarySheet(data, rep, opts), ...CATS.map(c => categorySheet(c, rep)), financeSheet(data, rep, opts)];
  return workbookBuffer(sheets);
}

module.exports = { buildProjectsReport, categoryOf, CATS, CURRENCY };
