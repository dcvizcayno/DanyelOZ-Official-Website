// Sandboxed-embed harness for the sync widgets (T-001, criteria C-1 and C-2).
//   env -u GITHUB_TOKEN -u GH_TOKEN node tests/widgets/sandbox.js
// Loads each page the way Google Sites does: inside <iframe sandbox="allow-scripts allow-popups allow-forms
// allow-same-origin"> (no allow-top-navigation, no allow-modals) on another origin. The pages are served at their
// real https URLs from the local danyeloz-embeds folder; the sheet comes from mock-sheet.js. No network.
// Checks at 1400 and 390 px: the request panel opens in the frame and shows the email; Request never navigates the
// frame; the one-sheet view toggles in the frame and back; clicking every link between the two pages opens at most
// one popup and the popup has no new-tab link back (no chain); no sideways scroll; no page errors.
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');
const mock = require('./mock-sheet');

const EMBEDS = process.env.EMBEDS_DIR || 'E:/Projects/danyeloz-embeds';
const ORIGIN = 'https://dcvizcayno.github.io/danyeloz-embeds/';
const SANDBOX = 'allow-scripts allow-popups allow-forms allow-same-origin';
const OURS = /^https:\/\/dcvizcayno\.github\.io\/danyeloz-embeds\/sync(-one-sheet)?\.html/;
const EMAIL = 'daniel.vizkaino@gmail.com';
let checks = 0;
function ok(cond, msg) { assert.ok(cond, msg); checks++; }
function eq(a, b, msg) { assert.deepStrictEqual(a, b, msg); checks++; }

function harness(file) {
  return '<!DOCTYPE html><html><body style="margin:0"><iframe id="embed" sandbox="' + SANDBOX + '" src="' + ORIGIN + file +
    '" style="border:0;width:100%;height:860px;display:block"></iframe></body></html>';
}

async function open(browser, width, file) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  await ctx.route(/^https?:\/\//, r => {
    const url = r.request().url();
    if (url === 'https://harness.test/') return r.fulfill({ status: 200, contentType: 'text/html', body: harness(file) });
    const m = /^https:\/\/dcvizcayno\.github\.io\/danyeloz-embeds\/(sync(-one-sheet)?\.html)(\?.*)?$/.exec(url);
    if (m) return r.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(EMBEDS, m[1]), 'utf8') });
    const res = mock.resolve(url, {});
    if (res) return r.fulfill({ status: res.status, contentType: res.contentType, body: res.body, headers: { 'Access-Control-Allow-Origin': '*' } });
    return r.abort();
  });
  const page = await ctx.newPage();
  const errors = [], navs = [], popups = [];
  const watch = p => {
    p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  };
  watch(page);
  ctx.on('page', p => { popups.push(p); watch(p); });
  page.on('framenavigated', f => { if (f !== page.mainFrame()) navs.push(f.url()); });
  await page.goto('https://harness.test/');
  const frame = await (await page.waitForSelector('#embed')).contentFrame();
  return { ctx, page, frame, errors, navs, popups };
}

async function panelCheck(frame, label) {
  await frame.waitForSelector('.ozr[role="dialog"]', { timeout: 5000 });
  const p = await frame.$eval('.ozr', d => ({ mail: d.querySelector('.ozr-mail').textContent, modal: d.getAttribute('aria-modal'),
    focus: d.contains(document.activeElement), text: d.textContent }));
  eq([p.mail, p.modal, p.focus], [EMAIL, 'true', true], label + ': panel in the frame shows the email, focus inside');
  ok(await frame.isVisible('.ozr .ozr-mail'), label + ': email visible');
  return p;
}

async function noSideScroll(frame, label) {
  const w = await frame.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  ok(w[0] <= w[1], label + ': no sideways scroll ' + w);
}

async function catalogue(browser, width) {
  const L = width + ' sync.html';
  const { ctx, frame, errors, navs, popups } = await open(browser, width, 'sync.html');
  await frame.waitForSelector('#sy .sy-card', { timeout: 10000 });
  ok(await frame.evaluate(() => window.top !== window), L + ': page runs framed');
  const navBase = navs.length;

  // C-1: general request, copy (clipboard or select-the-text fallback), Escape.
  await frame.click('#sy .sy-hero button.sy-btn.solid');
  await panelCheck(frame, L + ' hero request');
  await frame.click('.ozr .ozr-copy');
  await frame.waitForFunction(() => document.querySelector('.ozr-status').textContent !== '', null, { timeout: 5000 });
  const copy = await frame.evaluate(() => [document.querySelector('.ozr-status').textContent, String(window.getSelection())]);
  ok(copy[0] === 'Email copied.' || (copy[0] === 'Press Ctrl+C (or Cmd+C) to copy.' && copy[1] === 'daniel.vizkaino@gmail.com'), L + ': copy works or selects the email ' + JSON.stringify(copy));
  console.log(L + ': copy result in sandbox: ' + copy[0]);
  await frame.press('.ozr', 'Escape');
  ok(!(await frame.$('.ozr')), L + ': Escape closes');

  // C-1: per-song request with the title.
  await frame.locator('#sy .sy-card', { has: frame.locator('.sy-ct', { hasText: /^Song 03$/ }) }).locator('.sy-req').click();
  const song = await panelCheck(frame, L + ' song request');
  ok(/Song: Song 03/.test(song.text), L + ': song title in the panel');
  await frame.click('.ozr .ozr-close');
  eq(navs.length, navBase, L + ': Request never navigates the frame');
  eq(popups.length, 0, L + ': Request opens no window');

  // C-2: one-sheet view in the frame and back.
  await frame.click('#sy .sy-hero .sy-open-sheet');
  ok(await frame.isVisible('#sy .sy-sheet #os .os-table') && !(await frame.isVisible('#sy .sy-main')), L + ': one-sheet view in the frame');
  await noSideScroll(frame, L + ' one-sheet view');
  await frame.click('#sy .sy-sheet .os-req');
  await panelCheck(frame, L + ' one-sheet view request');
  await frame.press('.ozr', 'Escape');
  await frame.click('#sy .sy-back');
  ok(await frame.isVisible('#sy .sy-main') && !(await frame.isVisible('#sy .sy-sheet')), L + ': back to the catalogue');
  eq(navs.length, navBase, L + ': view toggle never navigates the frame');
  eq(popups.length, 0, L + ': view toggle opens no window');
  await noSideScroll(frame, L);

  // C-2: click every link between the two pages once (catalogue view, then one-sheet view).
  const mainLinks = await frame.$$eval('#sy .sy-main a',as => as.map(a => a.href));
  eq(mainLinks.filter(h => /danyeloz-embeds\/sync/.test(h)), [], L + ': no link between the pages on the catalogue view');
  await frame.click('#sy .sy-hero .sy-open-sheet');
  const sheetLinks = await frame.$$eval('#sy .sy-sheet a', as => as.map(a => a.href).filter(h => /danyeloz-embeds\/sync/.test(h)));
  eq(sheetLinks, [ORIGIN + 'sync-one-sheet.html'], L + ': the print link is the only link between the pages');
  eq(await frame.$eval('#sy .sy-sheet a.sy-print', a => [a.getAttribute('target'), a.getAttribute('rel'), a.getAttribute('referrerpolicy')]), ['ozsync-onesheet', null, 'no-referrer'], L + ': framed print link uses the fixed named tab (D-2)');
  for (const h of sheetLinks) await frame.click('#sy .sy-sheet a[href="' + h + '"]');
  await new Promise(r => setTimeout(r, 300));
  eq(popups.length, 1, L + ': print link opens exactly one tab');
  const pop = popups[0];
  await pop.waitForSelector('#os .os-foot', { timeout: 10000 });
  ok(OURS.test(pop.url()) && /one-sheet/.test(pop.url()), L + ': popup is the printable one-sheet');
  ok(await pop.evaluate(() => window.top === window), L + ': popup is top-level');
  const popLinks = await pop.$$eval('a', as => as.map(a => [a.href, a.getAttribute('target')]).filter(x => /danyeloz-embeds\/sync/.test(x[0])));
  eq(popLinks, [[ORIGIN + 'sync.html', null]], L + ': popup links back to the catalogue in the same tab');
  await Promise.all([pop.waitForURL(ORIGIN + 'sync.html'), pop.click('#os a.os-cat')]);
  await pop.waitForSelector('#sy .sy-how', { timeout: 10000 });
  eq(popups.length, 1, L + ': following the link back opens no second tab (no chain)');

  // QA chain (T-002 D-1): the popup is now the top-level catalogue. Its one-sheet view's print link stays in the tab.
  await pop.click('#sy .sy-hero .sy-open-sheet');
  const topPrint = await pop.$eval('#sy .sy-sheet a.sy-print', a => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]);
  eq(topPrint, [ORIGIN + 'sync-one-sheet.html', null, null], L + ': top-level print link has no target (same tab)');
  await Promise.all([pop.waitForURL(ORIGIN + 'sync-one-sheet.html'), pop.click('#sy .sy-sheet a.sy-print')]);
  await pop.waitForSelector('#os .os-foot', { timeout: 10000 });
  eq(popups.length, 1, L + ': chain popup > catalogue > one-sheet > print opens no second tab');

  // QA order B (T-002 D-2): three more Print clicks from the frame reuse the one named tab.
  await frame.click('#sy .sy-back');
  await frame.click('#sy .sy-hero .sy-open-sheet');
  for (let i = 0; i < 3; i++) { await frame.click('#sy .sy-sheet a.sy-print'); await new Promise(r => setTimeout(r, 400)); }
  await pop.waitForSelector('#os .os-foot', { timeout: 10000 });
  eq(popups.length, 1, L + ': 3 repeated Print clicks from the frame keep one popup in total');
  const fromPop = [];
  for (const p of popups) if ((await p.opener()) === pop) fromPop.push(p.url());
  eq(fromPop, [], L + ': no page was opened from the popup');
  eq(navs.length, navBase, L + ': the frame itself never navigated');
  eq(errors, [], L + ': no page errors');
  await ctx.close();
}

async function oneSheet(browser, width) {
  const L = width + ' sync-one-sheet.html';
  const { ctx, frame, errors, navs, popups } = await open(browser, width, 'sync-one-sheet.html');
  await frame.waitForSelector('#os .os-foot', { timeout: 10000 });
  const navBase = navs.length;
  ok(/Licensing catalogue: https:\/\/dcvizcayno\.github\.io\/danyeloz-embeds\/sync\.html/.test(await frame.textContent('#os .os-contact')), L + ': framed: catalogue address as plain text');
  eq(await frame.$$eval('a', as => as.filter(a => /danyeloz-embeds\/sync/.test(a.href)).length), 0, L + ': framed: no link chain to the catalogue');
  eq(await frame.$$eval('#os a[href^="mailto:"]', a => a.length), 0, L + ': no raw mailto');
  await frame.click('#os .os-req');
  await panelCheck(frame, L);
  await frame.press('.ozr', 'Escape');
  ok(!(await frame.$('.ozr')), L + ': Escape closes');
  eq(navs.length, navBase, L + ': Request never navigates the frame');
  eq(popups.length, 0, L + ': no window opened');
  await noSideScroll(frame, L);
  eq(errors, [], L + ': no page errors');
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const w of [1400, 390]) { await catalogue(browser, w); await oneSheet(browser, w); console.log(w + ' px: ok'); }
  } finally { await browser.close(); }
  console.log('sandbox: ' + checks + ' checks');
  console.log('PASSED');
})().catch(e => { console.error(e); process.exit(1); });
