// Shorts > TikTok tab: set up, connect, TikTok's posting choices, approve, post, status (desktop and phone).
const { chromium } = require('playwright');
(async()=>{const b=await chromium.launch();const errs=[];
 for (const vp of [{width:1400,height:1000,n:'tt'},{width:390,height:844,n:'tt_phone'}]) {
  const p=await b.newPage({viewport:vp});p.on('pageerror',e=>errs.push(e.message));
  await p.route(/^https?:\/\//,r=>r.abort());await p.goto('file://'+__dirname+'/page.html');await p.waitForTimeout(300);
  await p.evaluate(()=>{window.__confirms=[];window.confirm=function(m){window.__confirms.push(m);return true;};window.open=function(u){window.__opened=u;};});
  const open=async(mode)=>{await p.evaluate(m=>{window.__ttMode=m;},mode);await p.click('[data-view="shorts"]');await p.waitForTimeout(300);
    await p.click('.sx-item:has-text("Carmen")');await p.waitForTimeout(200);await p.click('.tabs button:has-text("TikTok")');await p.waitForTimeout(300);};
  const txt=s=>p.textContent(s);

  await open('unset');
  console.log(vp.n,'unset:',(await txt('#sxTtPanel')).includes('TIKTOK_CLIENT_KEY'),'| redirect shown:',(await txt('#sxTtPanel code')));
  await p.evaluate(()=>{window.__ttMode='disconnected';});await p.click('.tabs button:has-text("YouTube")');await p.click('.tabs button:has-text("TikTok")');await p.waitForTimeout(300);
  await p.click('#sxTtPanel button:has-text("Connect TikTok")');await p.waitForTimeout(200);
  console.log('connect opens:',await p.evaluate(()=>window.__opened));

  await p.evaluate(()=>{window.__ttMode='connected';});await p.click('.tabs button:has-text("YouTube")');await p.click('.tabs button:has-text("TikTok")');await p.waitForTimeout(300);
  console.log('posting as:',await txt('#sxTtPanel .sx-note'));
  console.log('privacy default:',JSON.stringify(await p.inputValue('#sxTtPanel select')),'| options',await p.$$eval('#sxTtPanel select option',x=>x.map(o=>o.textContent)));
  console.log('interactions on by default:',await p.$$eval('#sxTtPanel .sx-tt-row input',x=>x.filter(i=>i.checked).length),'| duet off:',await p.isDisabled('#sxTtPanel label:has-text("Duet") input'));
  const appr='#sxTtPanel button:has-text("Approve")';
  console.log('approve before choice disabled:',await p.isDisabled(appr),'|',await txt('#sxTtPanel .sx-tt-row .sx-note'));
  await p.selectOption('#sxTtPanel select','SELF_ONLY');
  await p.check('#sxTtPanel input[aria-label^="This video promotes"]');
  console.log('commercial on, none picked disabled:',await p.isDisabled(appr),'|',await txt('#sxTtPanel .sx-tt-row .sx-note'));
  await p.check('#sxTtPanel label:has-text("Branded content") input');
  console.log('branded: only-me blocked:',await p.$eval('#sxTtPanel select option[value="SELF_ONLY"]',o=>o.disabled),'| privacy reset:',JSON.stringify(await p.inputValue('#sxTtPanel select')),
    '| declaration:',(await txt('#sxTtPanel .sx-tt-decl')));
  await p.selectOption('#sxTtPanel select','PUBLIC_TO_EVERYONE');await p.check('#sxTtPanel label:has-text("Comments") input');
  await p.click(appr);await p.waitForTimeout(300);
  console.log('approved with:',JSON.stringify(await p.evaluate(()=>window.__ttApprove)));
  console.log('state:',await txt('#sxTtPanel .sx-tt-state'),'| status:',await txt('#sxTtStatus'));
  await p.check('#sxTtPanel input[aria-label^="Auto-post"]');await p.waitForTimeout(150);console.log('auto:',await txt('#sxTtAuto'));
  await p.click('#sxTtPanel button:has-text("Post now")');await p.waitForTimeout(300);
  console.log('confirm:',await p.evaluate(()=>window.__confirms.pop()),'| state:',await txt('#sxTtPanel .sx-tt-state'),'| locked:',await p.isDisabled('#sxTtPanel select'));
  await p.click('#sxTtPanel button:has-text("Check status")');await p.waitForTimeout(300);
  console.log('posted:',await txt('#sxTtPanel .sx-tt-state'),'| link:',await p.getAttribute('#sxTtPanel .sx-tt-state a','href'));
  console.log(vp.n,'scrollWidth',await p.evaluate(()=>document.documentElement.scrollWidth));
  await p.locator('#sxTtPanel').scrollIntoViewIfNeeded();await p.screenshot({path:__dirname+'/out/'+vp.n+'.png'});
  // a failure shows TikTok's reason and a Try again button
  await p.evaluate(()=>{window.__ttPosts={};window.__ttFail=true;});await p.click('.tabs button:has-text("YouTube")');await p.click('.tabs button:has-text("TikTok")');await p.waitForTimeout(300);
  await p.selectOption('#sxTtPanel select','SELF_ONLY');await p.click(appr);await p.waitForTimeout(300);await p.click('#sxTtPanel button:has-text("Post now")');await p.waitForTimeout(300);
  console.log('failed:',await txt('#sxTtPanel .sx-tt-state'),'| try again:',await p.isVisible('#sxTtPanel button:has-text("Try again now")'));
  await p.evaluate(()=>{window.__ttFail=false;});
  await p.close();
 }
 console.log('errors',errs);await b.close();})();
