// Tracks > Sync tab, Sync readiness card and Licensing settings card (desktop and phone).
// The mock plants img onerror, script and svg onload markup in a title, writers and every settings field: it must stay text.
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
 for (const vp of [{width:1400,height:1000,n:'sy'},{width:390,height:844,n:'sy_phone'}]) {
  const p=await b.newPage({viewport:vp});const dialogs=[];
  p.on('pageerror',e=>errs.push(vp.n+': '+e.message));p.on('dialog',d=>{dialogs.push(d.message());d.accept();});
  await p.route(/^https?:\/\//,r=>r.abort());
  await p.goto('file://'+__dirname+'/page.html');await p.waitForTimeout(400);
  await p.click('[data-view="tracks"]');await p.waitForTimeout(600);
  const txt=s=>p.textContent(s), st='.sy-pane .sx-status', bpm='.sy-pane input[aria-label=BPM]', save='.sy-pane button:has-text("Save sync info")';
  const planted=()=>p.evaluate(()=>({pwn:window.__pwn===undefined?'undefined':window.__pwn,
    els:document.querySelectorAll('#viewTracks img, #viewTracks script, #viewTracks svg, [onerror], [onload]').length}));

  console.log(vp.n,'readiness:',await txt('#syReady .sy-sum'));
  console.log('missing:',JSON.stringify(await p.$$eval('#syReady li',x=>x.map(e=>e.textContent))));
  await p.click('#syReady li a:text-is("Today")');await p.waitForTimeout(400);
  console.log('editor:',await txt('.tk-edit h3'),'| tab:',await txt('.tk-edit .tabs .on'),'|',await txt('.sy-pane .sy-state'));
  await p.click('.sy-pane button:has-text("Copy from studio notes")');
  console.log('copied:',await p.inputValue(bpm),await p.inputValue('.sy-pane select[aria-label=Key]'),'|',await txt(st));
  await p.fill(bpm,'221');await p.click(save);await p.waitForTimeout(100);
  console.log('bpm 221:',await txt(st),'| sent:',await p.evaluate(()=>window.__sySave||null));
  await p.fill(bpm,'96');
  for (const m of ['Hopeful','Dreamy','Nostalgic','Sad']) await p.check(`.sy-moods label:has-text("${m}") input`);
  console.log('4th mood (tick):',await txt(st));
  await p.click(save);await p.waitForTimeout(100);
  console.log('4th mood (save):',await txt(st),'| sent:',await p.evaluate(()=>window.__sySave||null));
  await p.uncheck('.sy-moods label:has-text("Sad") input');
  await p.selectOption('.sy-pane select[aria-label=Genre]','Pop');await p.selectOption('.sy-pane select[aria-label="Second genre"]','Acoustic');
  await p.selectOption('.sy-pane select[aria-label=Vocal]','Solo vocal');await p.fill('.sy-pane input[aria-label=Writers]','Daniel Vizcayno');
  await p.check('.sy-flags label:has-text("Stems") input');
  await p.click(save);await p.waitForTimeout(200);
  console.log('saved:',await txt(st),'|',await txt('.sy-pane .sy-state'),'| sent:',JSON.stringify(await p.evaluate(()=>window.__sySave)));
  console.log('readiness after:',await txt('#syReady .sy-sum'));
  await p.click('#syReady li a:text-is("Dahlia")');await p.waitForTimeout(400);
  console.log('writers stays text:',JSON.stringify(await p.inputValue('.sy-pane input[aria-label=Writers]')));

  console.log('settings:',await txt('#sySet .sy-saved'),'|',await txt('#sySet .sy-pro'));
  console.log('preview (planted):',JSON.stringify(await txt('#sySet .tk-pub')));
  await p.fill('#sySet [aria-label="Rights holder"]','Danyel OZ, LLC');await p.fill('#sySet [aria-label=PRO]','');
  await p.fill('#sySet [aria-label="Reply time"]','2 business days');await p.fill('#sySet [aria-label="Process note"]','');
  console.log('preview:',await txt('#sySet .tk-pub'));
  await p.uncheck('#sySet label.sy-chk input');console.log('preview, not one-stop:',await txt('#sySet .tk-pub'));await p.check('#sySet label.sy-chk input');
  const sset='#sySet button:has-text("Save settings")', sst='#sySet .sx-status';
  await p.fill('#sySet [aria-label="Contact form link"]','https://evil.io/form');await p.click(sset);await p.waitForTimeout(100);
  console.log('bad link:',await txt(sst),'| sent:',await p.evaluate(()=>window.__sySettings||null));
  await p.fill('#sySet [aria-label="Contact form link"]','https://docs.google.com/document/d/1');await p.click(sset);await p.waitForTimeout(100);
  console.log('docs not forms:',await txt(sst));
  await p.fill('#sySet [aria-label="Contact form link"]','https://forms.gle/abc123');await p.click(sset);await p.waitForTimeout(200);
  console.log('settings saved:',await txt(sst),'|',await txt('#sySet .sy-saved'),'| sent:',JSON.stringify(await p.evaluate(()=>window.__sySettings)));
  await p.fill('#sySet [aria-label="Contact email"]','not-an-email');await p.click(sset);await p.waitForTimeout(200);
  console.log('server error shown:',await txt(sst));

  console.log('planted markup:',JSON.stringify(await planted()));
  console.log(vp.n,'scrollWidth',await p.evaluate(()=>document.documentElement.scrollWidth),'clientWidth',await p.evaluate(()=>document.documentElement.clientWidth));
  await p.screenshot({path:__dirname+'/out/'+vp.n+'.png',fullPage:true});
  console.log('dialogs',JSON.stringify(dialogs));
  await p.close();
 }
 console.log('errors',errs);await b.close();})();
