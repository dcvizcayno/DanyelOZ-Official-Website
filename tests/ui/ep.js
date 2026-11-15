const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
 for (const vp of [{width:1400,height:1000,n:'ep'},{width:390,height:844,n:'ep_phone'}]) {
 const p=await b.newPage({viewport:vp});p.on('pageerror',e=>errs.push(e.message));p.on('dialog',d=>d.accept());
 await p.route(/^https?:\/\//,r=>r.abort());await p.goto('file://'+__dirname+'/page.html');await p.waitForTimeout(300);
 await p.click('[data-view="eps"]');await p.waitForTimeout(400);
 console.log(vp.n,'visible:',await p.isVisible('#viewAlbums'),'| page asked:',await p.evaluate(()=>window.__page));
 if (vp.n==='ep'){
  console.log('heads:', await p.$$eval('#viewAlbums h2',x=>x.map(h=>h.textContent.trim().replace(/\s+/g,' '))));
  const row=t=>p.locator('#alLib .al-row',{has:p.locator('.t[title="'+t+'"]')});
  console.log('kinds:', await row('Mixed Signals').locator('select').first().locator('option').allTextContents());
  await row('Mixed Signals').locator('select').first().selectOption('installment');
  console.log('part options:', await row('Mixed Signals').locator('select').nth(1).locator('option').allTextContents());
  await row('Mixed Signals').locator('select').nth(1).selectOption("She's A Puzzle");
  console.log('installment show disabled:', await row('Mixed Signals').locator('input[type=checkbox]').isDisabled(), await row('Mixed Signals').locator('label').textContent());
  await row('Kareena').locator('select').first().selectOption('ep'); await row('Kareena').locator('input[type=checkbox]').check();
  await p.click('#alSaveLib');await p.waitForTimeout(200);
  console.log('save', await p.evaluate(()=>window.__libPage), JSON.stringify(await p.evaluate(()=>window.__lib)));
  console.log('featured options:', await p.$$eval('#alFeatured option',o=>o.map(x=>x.textContent)));
  await p.click('#alSaveFeat');await p.waitForTimeout(100);console.log('feat page', await p.evaluate(()=>window.__featPage));
  console.log('next:', await p.textContent('#alNext'));
  await p.click('#alAddCol');await p.click('#alSaveCols');await p.waitForTimeout(200);console.log('cols page', await p.evaluate(()=>window.__colsPage));
  await p.screenshot({path:__dirname+'/out/ep.png',fullPage:true});
  // back to albums
  await p.click('[data-view="albums"]');await p.waitForTimeout(400);
  console.log('albums again:', await p.evaluate(()=>window.__page), (await p.$$eval('#viewAlbums h2',x=>x.map(h=>h.textContent.trim().replace(/\s+/g,' '))))[2]);
 }
 console.log(vp.n,'scrollWidth',await p.evaluate(()=>document.documentElement.scrollWidth));
 }
 console.log('errors',errs);await b.close();})();
