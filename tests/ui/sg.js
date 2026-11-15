const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:900}});const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
 await p.route(/^https?:\/\//,r=>r.abort());
 await p.goto('file://'+__dirname+'/page.html');await p.waitForTimeout(400);
 for (const v of ['singles','albums','eps','tracks','singles']) { await p.click('[data-view="'+v+'"]');await p.waitForTimeout(400);
  console.log(v,'visible sections:',await p.$$eval('section[id^=view]',x=>x.filter(s=>!s.hidden&&s.offsetHeight>0).map(s=>s.id))); }
 console.log('errors',errs);await b.close();})();
