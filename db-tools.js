'use strict';
/* ابزار خط فرمان دیتابیس
   node db-tools.js import   ← وارد کردن js/data.js به دیتابیس (جایگزین همه‌ی داده‌های فعلی)
   node db-tools.js export   ← ساخت دوباره‌ی js/data.js از روی دیتابیس
   node db-tools.js backup   ← ساخت نسخه‌ی پشتیبان در پوشه‌ی backups/ */
const fs = require('fs');
const path = require('path');
const db = require('./db');

const cmd = process.argv[2];
try{
  if(cmd !== 'import') db.initFromDataJsIfEmpty();   // دیتابیس تازه را قبل از خروجی/پشتیبان از data.js پر می‌کند
  if(cmd === 'import'){
    db.replaceAll(db.readDataJs());
    db.exportDataJs();
    console.log('js/data.js وارد دیتابیس شد (' + db.DRIVER + ').');
  }else if(cmd === 'export'){
    db.exportDataJs();
    console.log('js/data.js از روی دیتابیس ساخته شد.');
  }else if(cmd === 'backup'){
    const dir = path.join(__dirname, 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
    const file = path.join(dir, 'park-' + stamp + '.sqlite');
    db.backupTo(file);
    console.log('پشتیبان ساخته شد: ' + path.relative(__dirname, file));
  }else{
    console.log('استفاده:  node db-tools.js import | export | backup');
    process.exitCode = 1;
  }
}catch(e){
  console.error(e.message);
  process.exitCode = 1;
}finally{
  db.close();
}
