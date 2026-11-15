const { chromium } = require('playwright'); const fs=require('fs');
(async()=>{const b=await chromium.launch();const errs=[];
 for (const vp of [{width:1400,height:1000,n:'tk'},{width:390,height:844,n:'tk_phone'}]) {
 const p=await b.newPage({viewport:vp});p.on('pageerror',e=>errs.push(vp.n+': '+e.message));p.on('dialog',d=>d.accept());
 await p.route(/^https?:\/\//,r=>/abcjs/.test(r.request().url())?r.continue():r.abort());   // the score preview loads abcjs from cdnjs
 await p.goto('file://'+__dirname+'/page.html');await p.waitForTimeout(400);
 await p.click('[data-view="tracks"]');await p.waitForTimeout(500);
 const vis=await p.$$eval('section[id^=view]',x=>x.filter(s=>!s.hidden).map(s=>s.id));
 if(vp.n==='tk'){
  console.log('visible',vis);
  console.log('checks',await p.$$eval('.tk-check',x=>x.map(e=>e.querySelector('b').textContent+' '+e.querySelector('span').textContent)));
  console.log('fix rows',await p.$$eval('#tkFixes .tk-fix:not(.head) code',x=>x.map(e=>e.textContent)), await p.textContent('#tkFixes .tk-fix:not(.head) ul'));
  const fx=p.locator('#tkFixes .tk-fix:not(.head)').first();
  await fx.locator('select').first().selectOption('Republish planned'); await fx.locator('select').nth(1).selectOption('New ISRC');
  await fx.locator('input[aria-label="New ISRC"]').fill('QZRP42500001'); await fx.locator('button',{hasText:'Save'}).click(); await p.waitForTimeout(150);
  console.log('fix saved', JSON.stringify(await p.evaluate(()=>window.__tkFix)), await fx.locator('.sx-status').textContent());
  console.log('songs',await p.$$eval('#tkSongs .tk-item b',x=>x.map(e=>e.textContent)));
  await p.fill('#tkSearch','goodbye'); await p.waitForTimeout(100); console.log('search goodbye',await p.$$eval('#tkSongs .tk-item b',x=>x.map(e=>e.textContent)));
  await p.fill('#tkSearch',''); await p.click('[data-tkf="nolyrics"]'); console.log('no lyrics',await p.$$eval('#tkSongs .tk-item b',x=>x.map(e=>e.textContent)));
  await p.click('[data-tkf="all"]');
  await p.click('#tkSongs .tk-item:has-text("My Girl")'); await p.waitForTimeout(200);
  console.log('editor',await p.textContent('.tk-edit h3'), '|', await p.textContent('.tk-meta'));
  console.log('draft shown', JSON.stringify(await p.inputValue('.tk-edit textarea')), '| public:', JSON.stringify(await p.textContent('.tk-pub')));
  await p.click('button:has-text("Save draft")'); await p.waitForTimeout(100); console.log('draft saved', JSON.stringify(await p.evaluate(()=>window.__tkNotes)));
  await p.click('button:has-text("Publish to site")'); await p.waitForTimeout(150); console.log('published', JSON.stringify(await p.evaluate(()=>window.__tkPub)));
  // abcjs comes from cdnjs, and the first download can take a few seconds: wait for the drawn score, not a fixed time
  await p.click('.tk-edit .tabs button:has-text("Music score")');
  await p.locator('#tkAbcPub svg').first().waitFor({ timeout: 15000 }).catch(()=>{});
  console.log('score svg (site)', await p.locator('#tkAbcPub svg').count());
  await p.fill('.tk-edit textarea','X:1\nT:Test\nM:3/4\nL:1/4\nK:D\nDFA|d2A|');
  await p.locator('#tkAbcDraft svg[aria-label*="Test"]').waitFor({ timeout: 15000 }).catch(()=>{});
  console.log('score svg (draft preview)', await p.locator('#tkAbcDraft svg').count());
  await p.screenshot({path:__dirname+'/out/tk_score.png',fullPage:false});
  await p.click('.tk-edit .tabs button:has-text("Studio notes")'); console.log('bpm', await p.inputValue('input[aria-label=BPM]'));
  await p.click('.tk-edit .tabs button:has-text("Fix plan")'); console.log('fix plan status', await p.inputValue('.tk-edit select[aria-label=Status]'));
  // unreleased song: publish disabled
  await p.click('#tkSongs .tk-item:has-text("Dahlia")'); await p.waitForTimeout(200); await p.click('.tk-edit .tabs button:has-text("Lyrics")');
  console.log('dahlia publish disabled', await p.isDisabled('button:has-text("Publish to site")'), '|', await p.textContent('.tk-lock'));
  // tracklist
  await p.click('.tk-check:has-text("Released, no tracklist")'); await p.waitForTimeout(100);
  await p.click('#tkCheckMore a'); await p.waitForTimeout(150);
  console.log('tracklist rows', await p.locator('#tkTracklist tbody tr').count(), await p.inputValue('#tkTracklist tbody tr input[aria-label=ISRC]'));
  await p.selectOption('#tkRel','222222222222'); await p.waitForTimeout(100);
  console.log('album rows', await p.$$eval('#tkTracklist tbody tr',x=>x.map(r=>r.querySelector('[aria-label="Title on this release"]').value+(r.querySelector('[aria-label="Bonus track"]').checked?' (bonus)':''))));
  await p.click('button:has-text("+ Add song")'); const last=p.locator('#tkTracklist tbody tr').last();
  await last.locator('[aria-label=ISRC]').fill('QZRP42500001'); await last.locator('[aria-label="Title on this release"]').fill('Goodbye'); await last.locator('[aria-label="Replaces ISRC"]').fill('QZRP42414262');
  await p.click('button:has-text("Save tracklist")'); await p.waitForTimeout(200);
  console.log('tracklist saved', JSON.stringify(await p.evaluate(()=>window.__tkTl)).slice(0,300));
  await p.screenshot({path:__dirname+'/out/tk.png',fullPage:true});
 } else { await p.click('#tkSongs .tk-item:has-text("My Girl")'); await p.waitForTimeout(300); await p.screenshot({path:__dirname+'/out/tk_phone.png',fullPage:true}); }
 console.log(vp.n,'scrollW',await p.evaluate(()=>document.documentElement.scrollWidth), vp.width);
 await p.close();}
 console.log('errors',errs);await b.close();})();
