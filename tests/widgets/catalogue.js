// Playwright test for danyeloz-embeds/sync.html (sync licensing catalogue). Sheet mocked from tests/widgets/fixtures/.
//   env -u GITHUB_TOKEN -u GH_TOKEN node tests/widgets/catalogue.js
// Runs at 1400 and 390 px. Screenshots go to tests/ui/out/catalogue-<width>.png.
// T-001: "Request a license" buttons open the in-page panel; "Get the one-sheet" shows the one-sheet in this page.
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');
const mock = require('./mock-sheet');

const EMBEDS = process.env.EMBEDS_DIR || 'E:/Projects/danyeloz-embeds';
const PAGE = 'file:///' + path.join(EMBEDS, 'sync.html').replace(/\\/g, '/').replace(/^\/+/, '');
const OUT = path.join(__dirname, '..', 'ui', 'out');
const LINK_HOSTS = /^https:\/\/(open\.spotify\.com|music\.apple\.com|[a-z0-9-]+\.bandcamp\.com|(www\.|music\.)?youtube\.com|www\.danyeloz\.info|dcvizcayno\.github\.io)\//;
const IMG_HOSTS = /^https:\/\/(drive\.google\.com|lh3\.googleusercontent\.com|f4\.bcbits\.com|is[1-5]-ssl\.mzstatic\.com|i\.scdn\.co)\//;
let checks = 0;
function ok(cond, msg) { assert.ok(cond, msg); checks++; }
function eq(a, b, msg) { assert.deepStrictEqual(a, b, msg); checks++; }

// Same routing as mock.route, plus the CORS header the live gviz endpoint sends (the page is a file:// origin).
async function routeSheet(page, tabs) {
  await page.route(/^https?:\/\//, r => {
    const res = mock.resolve(r.request().url(), tabs);
    if (!res) return r.abort();
    return r.fulfill({ status: res.status, contentType: res.contentType, body: res.body, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
}

async function open(browser, width, tabs) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await routeSheet(page, tabs);
  await page.goto(PAGE);
  await page.waitForSelector('#sy .sy-how', { timeout: 10000 });
  return { page, errors };
}

const count = page => page.$$eval('#sy .sy-card', c => c.length);

async function common(page, errors, width, label) {
  eq(errors, [], label + ': no page errors');
  const w = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok(w.sw <= w.cw && w.cw === width, label + ': no horizontal scroll ' + JSON.stringify(w));
  const pwn = await page.evaluate(() => window.__pwn);
  eq(pwn, undefined, label + ': planted script did not run');
  const bad = await page.evaluate(() => ({
    onAttr: Array.from(document.querySelectorAll('#sy *')).filter(e => Array.from(e.attributes).some(a => /^on/i.test(a.name))).length,
    tags: document.querySelectorAll('#sy script, #sy svg, #sy b, #sy iframe').length,
    scripts: document.querySelectorAll('script').length
  }));
  eq(bad, { onAttr: 0, tags: 0, scripts: 2 }, label + ': no element injected from sheet text');
  const links = await page.$$eval('#sy a', as => as.map(a => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), rel: a.getAttribute('rel') })));
  eq(await page.$$eval('#sy .sy-hero button.sy-btn.solid, #sy .sy-how button.sy-btn.solid', b => b.map(x => x.textContent)), ['Request a license', 'Request a license'], label + ': request buttons in hero and how');
  for (const l of links) {
    ok(!/^\s*javascript:/i.test(l.href), label + ': no javascript: href ' + l.href);
    if (l.href.startsWith('mailto:')) ok(l.target === null && /^mailto:daniel\.vizkaino@gmail\.com\?subject=[^&?]*$/.test(l.href), label + ': mailto shape ' + l.href);
    else ok(LINK_HOSTS.test(l.href) || /^https:\/\/forms\.gle\//.test(l.href), label + ': allowed host ' + l.href),
      ok(l.target === '_blank' && l.rel === 'noopener noreferrer', label + ': new tab and rel ' + l.href);
  }
  const imgs = await page.$$eval('#sy img', is => is.map(i => ({ src: i.getAttribute('src'), rp: i.getAttribute('referrerpolicy') })));
  for (const i of imgs) ok(IMG_HOSTS.test(i.src) && i.rp === 'no-referrer', label + ': safe cover ' + JSON.stringify(i));
  const text = await page.textContent('#sy');
  ok(text.indexOf('Other versions (TV mix, a cappella) on request.') >= 0, label + ': other versions text');
  eq(await page.$$eval('#sy .sy-hero .sy-open-sheet, #sy .sy-how .sy-open-sheet', b => b.map(x => x.tagName + ':' + x.textContent)),
    ['BUTTON:Get the one-sheet', 'BUTTON:Get the one-sheet'], label + ': one-sheet buttons (no link, no new tab)');
  eq(await page.$$eval('#sy a[href*="danyeloz-embeds/sync"]', a => a.length), 0, label + ': no link between the two pages on the catalogue view');
  ok(!/\u2014/.test(text), label + ': no em dash');
  return text;
}

const songReq = (page, title) => page.locator('#sy .sy-card', { has: page.locator('.sy-ct', { hasText: new RegExp('^' + title + '$') }) }).locator('.sy-req');

// Clicks a request button and returns what the panel shows. Checks dialog semantics, focus and layout.
async function openPanel(page, label, button) {
  const before = page.url();
  await button.click();
  await page.waitForSelector('.ozr[role="dialog"]');
  const p = await page.$eval('.ozr', d => {
    const a = q => d.querySelector(q);
    return { modal: d.getAttribute('aria-modal'), label: (document.getElementById(d.getAttribute('aria-labelledby')) || {}).textContent,
      mail: a('.ozr-mail').textContent, text: d.textContent, focus: d.contains(document.activeElement),
      mailto: a('.ozr-mailto') && a('.ozr-mailto').getAttribute('href'), mailtoTarget: a('.ozr-mailto') && a('.ozr-mailto').getAttribute('target'),
      form: a('.ozr-form') && [a('.ozr-form').getAttribute('href'), a('.ozr-form').target, a('.ozr-form').rel, a('.ozr-form').textContent],
      markup: d.querySelectorAll('script, img, iframe, [onclick], [onerror]').length };
  });
  eq([p.modal, p.label, p.mail, p.focus, p.markup], ['true', 'Request a license', 'daniel.vizkaino@gmail.com', true, 0], label + ': panel dialog, label, email, focus');
  ok(['song', 'project', 'media', 'territory', 'term', 'timeline'].every(w => p.text.toLowerCase().indexOf(w) >= 0) && /You get a quote within [^.]+\./.test(p.text), label + ': checklist and turnaround');
  eq(page.url(), before, label + ': no navigation');
  const box = await page.$eval('.ozr', d => { const r = d.getBoundingClientRect(); return [r.left, r.right, window.innerWidth]; });
  ok(box[0] >= 0 && box[1] <= box[2], label + ': panel fits the width ' + JSON.stringify(box));
  return p;
}

// One-sheet view inside the catalogue, then back. Nothing opens a window here.
async function sheetView(page, width) {
  const before = page.url();
  await page.click('#sy .sy-hero .sy-open-sheet');
  ok(await page.isVisible('#sy .sy-sheet #os .os-table') && !(await page.isVisible('#sy .sy-main')), width + ': one-sheet view shown in place of the catalogue');
  eq(await page.$$eval('#sy .sy-sheet #os .os-table tbody tr', r => r.length), 10, width + ': one-sheet rows');
  ok(await page.evaluate(() => document.activeElement === document.querySelector('#sy .sy-back')), width + ': focus moves to Back');
  const pr = await page.$$eval('#sy .sy-sheet a', as => as.filter(a => /danyeloz-embeds\/sync/.test(a.href)).map(a => [a.getAttribute('href'), a.target, a.rel, a.textContent]));
  eq(pr, [['https://dcvizcayno.github.io/danyeloz-embeds/sync-one-sheet.html', '', '', 'Print or save as PDF']], width + ': top-level: print link is the only link and stays in the tab (D-1)');
  ok(/Licensing catalogue: https:\/\/dcvizcayno\.github\.io\/danyeloz-embeds\/sync\.html/.test(await page.textContent('#sy .sy-sheet .os-contact')), width + ': catalogue address as text in the view');
  const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  ok(w[0] <= w[1], width + ': one-sheet view has no sideways scroll ' + w);
  await page.screenshot({ path: path.join(OUT, 'catalogue-sheet-' + width + '.png'), fullPage: true });
  await page.click('#sy .sy-sheet .os-req');
  ok(await page.isVisible('.ozr[role="dialog"]'), width + ': request panel from the one-sheet view');
  await page.keyboard.press('Escape');
  await page.click('#sy .sy-back');
  ok(await page.isVisible('#sy .sy-main') && !(await page.isVisible('#sy .sy-sheet')), width + ': Back to the catalogue');
  ok(await page.evaluate(() => document.activeElement === document.querySelector('#sy .sy-hero .sy-open-sheet')), width + ': focus returns to Get the one-sheet');
  eq(page.url(), before, width + ': no navigation for the view');
}

async function run(browser, width) {
  // 1. Full catalogue with planted data.
  let { page, errors } = await open(browser, width, {});
  await page.waitForSelector('#sy .sy-card');
  const text = await common(page, errors, width, width + ' main');
  const total = await count(page);
  eq(total, 15, width + ': released songs only (15 of 17 rows)');
  ok(text.indexOf('Unreleased Featured') < 0 && text.indexOf('No Date') < 0, width + ': unreleased and undated hidden');
  ok(await page.$('#sy .sy-ct:text-is("<img src=x onerror=window.__pwn=1>")'), width + ': HTML title shown as text');
  const rights = await page.evaluate(() => [document.querySelector('#sy .sy-rights').textContent, OZSync.rightsText(OZSync.settings(null))]);
  eq(rights[0], rights[1], width + ': rights text from OZSync.rightsText');
  ok(text.indexOf(await page.evaluate(() => OZSync.processText(OZSync.settings(null)))) >= 0, width + ': process text and turnaround');
  ok(text.indexOf('15 songs') >= 0, width + ': visible count');
  const reqs = await page.$$eval('#sy .sy-card .sy-req', bs => bs.map(b => b.tagName + ':' + b.getAttribute('type') + ':' + b.textContent));
  ok(reqs.length === 15 && reqs.every(r => r === 'BUTTON:button:Request a license'), width + ': per-song request buttons');
  const panel = await openPanel(page, width + ' Song 03', songReq(page, 'Song 03'));
  ok(/Song: Song 03/.test(panel.text), width + ': song title shown in panel');
  ok(/quote within 3 business days\./.test(panel.text), width + ': default 3 business days in panel');
  eq(panel.mailto, 'mailto:daniel.vizkaino@gmail.com?subject=' + encodeURIComponent('License request: Song 03'), width + ': song title prefilled in subject');
  eq(panel.form, null, width + ': no form button without contact_url');
  await page.click('.ozr .ozr-close');
  ok(!(await page.$('.ozr')) && await songReq(page, 'Song 03').evaluate(b => b === document.activeElement), width + ': Close returns focus to the song button');
  const general = await openPanel(page, width + ' hero', page.locator('#sy .sy-hero button.sy-btn.solid'));
  eq(general.mailto, 'mailto:daniel.vizkaino@gmail.com?subject=' + encodeURIComponent('License request: Danyel OZ catalogue'), width + ': general request subject');
  await page.keyboard.press('Escape');
  ok(!(await page.$('.ozr')), width + ': Escape closes the panel');
  await sheetView(page, width);
  ok(!(await page.$('#sy a[href*="evil"]')) && !(await page.$('#sy img[src*="evil"]')), width + ': no evil host link or cover');
  ok(await page.$('#sy a[href="https://open.spotify.com/track/s02"]'), width + ': safe listen link kept');
  await page.screenshot({ path: path.join(OUT, 'catalogue-' + width + '.png'), fullPage: true });

  const filters = [['mood', 'Sad', 2], ['genre', 'Soul', 1], ['tempo', 'Slow', 3], ['tempo', 'Fast', 6], ['key', 'A minor', 14], ['vocal', 'Duet', 1]];
  for (const [f, v, n] of filters) {
    await page.selectOption('#sy select[data-f="' + f + '"]', v);
    const c = await count(page);
    ok(c < total && c === n, width + ': filter ' + f + '=' + v + ' gives ' + c + ' (want ' + n + ')');
    ok((await page.textContent('#sy .sy-count')) === c + ' of 15 songs', width + ': count text for ' + f);
    await page.click('#sy .sy-clear');
    eq(await count(page), total, width + ': clear resets after ' + f);
  }
  await page.fill('#sy input[data-f="q"]', 'song 0');
  ok((await count(page)) === 7, width + ': search narrows to Song 03..09');
  await page.fill('#sy input[data-f="q"]', 'soul');
  ok((await count(page)) === 1, width + ': search over genre');
  await page.click('#sy .sy-clear');
  await page.click('#sy button[data-has="instrumental"]');
  eq(await count(page), total, width + ': instrumental is on every fixture song');
  await page.click('#sy button[data-has="clean"]');
  eq(await count(page), 0, width + ': availability Clean narrows to none');
  ok(await page.isVisible('#sy .sy-empty'), width + ': empty-result message');
  await page.click('#sy .sy-clear');
  ok(!(await page.isVisible('#sy .sy-empty')), width + ': empty message hidden again');
  await page.close();

  // 2. Fallbacks: tracks before the first Sync save, tracks tab missing (gviz returns Sheet1).
  for (const [label, tabs] of [['nosync', { tracks: 'tracks_nosync.csv' }], ['missing', { tracks: null, sync_settings: null }]]) {
    ({ page, errors } = await open(browser, width, tabs));
    await common(page, errors, width, width + ' ' + label);
    eq(await count(page), 0, width + ' ' + label + ': no cards');
    ok(await page.isVisible('#sy .sy-fallback'), width + ' ' + label + ': fallback shown');
    const r = await page.evaluate(() => document.querySelector('#sy .sy-rights').textContent);
    ok(r.indexOf('Danyel OZ, LLC') >= 0 && r.indexOf('performing rights organization') >= 0, width + ' ' + label + ': default rights');
    if (label === 'missing') await page.screenshot({ path: path.join(OUT, 'catalogue-fallback-' + width + '.png'), fullPage: true });
    await page.close();
  }

  // 3. Bad settings: markup in rights fields stays text, bad email and contact_url fall back to the default mailto.
  ({ page, errors } = await open(browser, width, { sync_settings: 'sync_settings_bad.csv' }));
  await page.waitForSelector('#sy .sy-card');
  await common(page, errors, width, width + ' badsettings');
  const r = await page.evaluate(() => document.querySelector('#sy .sy-rights').textContent);
  ok(r.indexOf('<img src=x onerror=window.__pwn=4>') >= 0 && r.indexOf('<b>PRO</b>') >= 0, width + ': bad settings shown as text');
  await page.close();

  // 4. PRO settings: forms.gle contact_url used for request links.
  ({ page, errors } = await open(browser, width, { sync_settings: 'sync_settings_pro.csv' }));
  await page.waitForSelector('#sy .sy-card');
  await common(page, errors, width, width + ' pro');
  const pro = await openPanel(page, width + ' pro', songReq(page, 'Song 03'));
  ok(/^https:\/\/forms\.gle\//.test(pro.form[0]) && pro.form[1] === '_blank' && pro.form[2] === 'noopener noreferrer' && pro.form[3] === 'Fill out the request form', width + ': contact_url gives the form button');
  ok(/^mailto:daniel\.vizkaino@gmail\.com\?subject=/.test(pro.mailto) && pro.mailtoTarget === '_blank', width + ': email app link kept as second option');
  await page.keyboard.press('Escape');
  ok((await page.textContent('#sy .sy-rights')).indexOf('BMI') >= 0, width + ': PRO named');
  await page.close();
  console.log(width + ' px: ok');
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const w of [1400, 390]) await run(browser, w);
  } finally { await browser.close(); }
  console.log('catalogue: ' + checks + ' checks');
  console.log('screenshots: ' + OUT);
  console.log('PASSED');
})().catch(e => { console.error(e); process.exit(1); });
