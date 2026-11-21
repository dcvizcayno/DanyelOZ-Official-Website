// Inbox screen: list, filters, search, detail, Reply mailto, status, switches, test send, triggers, 1-year delete (desktop and phone).
// The mock plants img onerror, script, svg onload and U+202E in names, subjects, messages and notes: they must stay text.
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
 for (const vp of [{width:1400,height:1000,n:'ib'},{width:390,height:844,n:'ib_phone'}]) {
  const p=await b.newPage({viewport:vp});p.on('pageerror',e=>errs.push(vp.n+': '+e.message));
  await p.route(/^https?:\/\//,r=>r.abort());await p.goto('file://'+__dirname+'/page.html');await p.waitForTimeout(300);
  await p.evaluate(()=>{window.__conf=[];window.__ok=true;window.confirm=function(m){window.__conf.push(m);return window.__ok;};});
  const txt=s=>p.textContent(s), ev=f=>p.evaluate(f), names=()=>p.$$eval('#ibList .ib-item strong',x=>x.map(e=>e.textContent));
  const pick=async s=>{await p.click('#ibList .ib-item:has-text("'+s+'")');await p.waitForTimeout(50);};
  const confirmAs=v=>ev(`window.__ok=${v}`);
  await p.click('[data-view="inbox"]');await p.waitForTimeout(300);

  console.log(vp.n,'tiles:',JSON.stringify(await p.$$eval('#ibTiles .ib-tile',x=>x.map(e=>e.textContent))));
  console.log('newest first:',JSON.stringify((await names()).map(n=>n.slice(0,10))));
  await p.selectOption('#ibType','sync');console.log('type sync:',(await names()).length);await p.selectOption('#ibType','');
  await p.selectOption('#ibTopic','Press');console.log('topic Press:',JSON.stringify(await names()));await p.selectOption('#ibTopic','');
  await p.selectOption('#ibStat','Done');console.log('status Done:',JSON.stringify(await names()));await p.selectOption('#ibStat','');
  await p.fill('#ibSearch','stems');console.log('search stems:',JSON.stringify(await names()));
  await p.fill('#ibSearch','zzz');console.log('search none:',await txt('#ibList'));await p.fill('#ibSearch','');

  const planted=()=>ev(()=>({ibx:window.__ibx===undefined?'undefined':window.__ibx,
    els:document.querySelectorAll('#viewInbox img, #viewInbox script, #viewInbox svg, [onerror], [onload]').length,
    rlo:document.getElementById('viewInbox').textContent.indexOf('‮')>=0}));
  for (const who of ['<img','Q <img']) {
    await pick(who);
    console.log('planted',JSON.stringify(who),'shown as text:',(await txt('#ibDetail dl')).includes('<svg onload='),'| reply:',await p.$('#ibReply')!==null,'|',JSON.stringify(await planted()));
  }
  for (const who of ['Old Fan','Joy']) { await p.selectOption('#ibStat','');await pick(who);
    console.log('reply for',who,':',await p.$('#ibReply')!==null,'|',await txt('#ibDetail .ib-actions .ib-note')); }

  await pick('Ana Cruz');
  const href=await p.getAttribute('#ibReply','href');
  console.log('mailto:',href,'| ok:',href==='mailto:ana@example.com?subject='+encodeURIComponent('Re: Show in Manila x&bcc=e@v.io')&&/^mailto:[^?]+\?subject=[^&]*$/.test(href),
    '| target:',await p.getAttribute('#ibReply','target'),'| rel:',await p.getAttribute('#ibReply','rel'));
  await p.click('#ibDetail button[data-status="Replied"]');await p.waitForTimeout(150);
  console.log('status call:',JSON.stringify(await ev(()=>window.__ibStatus)),'|',await txt('#ibDetailStatus'),'| pill:',await txt('#ibDetail .ib-pill'),
    '| tiles:',JSON.stringify(await p.$$eval('#ibTiles .ib-tile',x=>x.slice(0,3).map(e=>e.textContent))));

  await confirmAs(false);await p.click('#ibArSwitch');await p.waitForTimeout(150);
  console.log('auto-reply cancel: checked',await p.isChecked('#ibArSwitch'),'| server',JSON.stringify(await ev(()=>window.__ibAr===undefined?'not called':window.__ibAr)));
  console.log('confirm text:',JSON.stringify((await ev(()=>window.__conf)).slice(-1)[0]));
  await confirmAs(true);await p.click('#ibArSwitch');await p.waitForTimeout(250);
  console.log('auto-reply on: checked',await p.isChecked('#ibArSwitch'),'| server',await ev(()=>window.__ibAr),'|',await txt('#ibArStatus'),'|',await txt('#ibArInfo'));
  console.log('templates:',await p.$$eval('#ibTpls .ib-tpl',x=>x.length));
  await p.click('#ibTpls button[data-type="sync"][data-n="3"]');await p.waitForTimeout(150);
  console.log('test send:',JSON.stringify(await ev(()=>window.__ibTest)),'|',await txt('#ibArStatus'));
  await p.click('#ibDgSwitch');await p.waitForTimeout(250);
  console.log('digest on:',await p.isChecked('#ibDgSwitch'),'| server',await ev(()=>window.__ibDg),'| tile:',await txt('#ibTiles .ib-tile:last-child'),'| confirms',(await ev(()=>window.__conf)).length);

  console.log('triggers before:',await txt('#ibTrState'));
  await p.click('#ibTrInstall');await p.waitForTimeout(250);console.log('install:',await txt('#ibTrStatus'),'|',await txt('#ibTrState'));
  await p.click('#ibTrRemove');await p.waitForTimeout(250);console.log('remove:',await txt('#ibTrState'));

  console.log('delete hidden before count:',await p.isHidden('#ibOldDelete'));
  await p.click('#ibOldCheck');await p.waitForTimeout(150);
  console.log('count:',await txt('#ibOldStatus'),'| button:',await txt('#ibOldDelete'));
  await confirmAs(false);await p.click('#ibOldDelete');await p.waitForTimeout(150);
  console.log('delete cancel: server',JSON.stringify(await ev(()=>window.__ibDel||'not called')));
  await confirmAs(true);await p.click('#ibOldDelete');await p.waitForTimeout(250);
  console.log('delete:',JSON.stringify(await ev(()=>window.__ibDel)),'|',await txt('#ibOldStatus'),'| confirm:',JSON.stringify((await ev(()=>window.__conf)).slice(-1)[0]));

  console.log('planted end:',JSON.stringify(await planted()));
  console.log(vp.n,'scrollWidth',await ev(()=>document.documentElement.scrollWidth),'clientWidth',await ev(()=>document.documentElement.clientWidth));
  await p.screenshot({path:__dirname+'/out/'+vp.n+'.png',fullPage:true});
  await p.close();
 }
 console.log('errors',errs);await b.close();})();
