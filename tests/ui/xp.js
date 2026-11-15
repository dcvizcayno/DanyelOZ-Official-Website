// X Posts: pick a song from Song rotation to draft (desktop and phone).
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
 for (const vp of [{width:1400,height:1000,n:'xp'},{width:390,height:844,n:'xp_phone'}]) {
  const p=await b.newPage({viewport:vp});p.on('pageerror',e=>errs.push(e.message));
    await p.route(/^https?:\/\//,r=>r.abort());await p.goto('file://'+__dirname+'/page.html');await p.waitForTimeout(300);
  await p.evaluate(()=>{window.__dialogs=[];window.__answer=false;window.confirm=function(m){window.__dialogs.push(m);return window.__answer;};});
  await p.click('[data-view="x"]');await p.waitForTimeout(500);
  const rows=()=>p.$$eval('.sx-rot-item .t',x=>x.map(e=>e.textContent));
  console.log(vp.n,'rows',(await rows()).length,'| groups',await p.$$eval('.sx-rot-list > .sx-note',x=>x.map(e=>e.textContent)));
  console.log('html kept as text:',await p.$$eval('.sx-rot-item .t',x=>x.some(e=>e.textContent.startsWith('<b>Bold</b>'))&&!document.querySelector('.sx-rot-item b')));
  console.log('header mode:',await p.textContent('#xBody .mode'));
  await p.fill('.sx-rot-find','real');await p.waitForTimeout(100);console.log('search real:',await rows());
  await p.fill('.sx-rot-find','zzz');await p.waitForTimeout(100);console.log('search zzz:',await p.textContent('.sx-rot-list'));
  await p.fill('.sx-rot-find','');await p.waitForTimeout(100);
  // a draft is waiting: cancel the confirm, nothing is asked
  await p.click('.sx-rot-item:has-text("Carmen") button');await p.waitForTimeout(150);
  console.log('confirm:',JSON.stringify(await p.evaluate(()=>window.__dialogs.pop())),'| asked after cancel:',await p.evaluate(()=>window.__xPick||null));
  // error path: buttons come back
  await p.evaluate(()=>{window.__answer=true;});await p.click('.sx-rot-item:has-text("Aubrey") button');await p.waitForTimeout(300);
  console.log('error:',await p.textContent('#xPickStatus'),'| buttons on:',await p.$$eval('.sx-rot-item button',x=>x.every(e=>!e.disabled)));
  // accept: replace the waiting draft with The Realization
  await p.click('.sx-rot-item:has-text("The Realization") button');await p.waitForTimeout(300);
  console.log('asked:',JSON.stringify(await p.evaluate(()=>window.__xPick)),'|',await p.textContent('#xPickStatus'),'| btn:',await p.textContent('.sx-rot-item.sel button'),
    '| others off:',await p.$$eval('.sx-rot-item button',x=>x.filter(e=>e.disabled).length));
  console.log(vp.n,'scrollWidth',await p.evaluate(()=>document.documentElement.scrollWidth));
  await p.locator('.sx-rot-list').scrollIntoViewIfNeeded();await p.screenshot({path:__dirname+'/out/'+vp.n+'.png',fullPage:vp.n==='xp_phone'?false:false});
  await p.close();
 }
 console.log('errors',errs);await b.close();})();
