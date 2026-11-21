// QA probe T-002 (independent of tests/widgets/sandbox.js). Run from the private repo root:
//   env -u GITHUB_TOKEN -u GH_TOKEN node runs/r-20261121-1746-sync-embed-fixes/qa/probe.js
// Parent page on https://parent.test/, pages framed from https://dcvizcayno.github.io (served from the local
// danyeloz-embeds folder) with sandbox="allow-scripts allow-popups allow-forms allow-same-origin". Sheet mocked.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const mock = require('../../../tests/widgets/mock-sheet');
const EMBEDS = process.env.EMBEDS_DIR || 'E:/Projects/danyeloz-embeds';
const BASE = 'https://dcvizcayno.github.io/danyeloz-embeds/';
const EMAIL = 'daniel.vizkaino@gmail.com';
const SANDBOX = 'allow-scripts allow-popups allow-forms allow-same-origin';
const HEAD = '"rights_holder","rights_line","one_stop","pro_name","contact_email","contact_url","turnaround","process_note","updated"';
const q = v => '"' + String(v).split('"').join('""') + '"';
const settingsCsv = o => HEAD + '\n' + ['Danyel OZ, LLC', o.rights_line || '', 'TRUE', '', EMAIL, o.contact_url || '', o.turnaround || '3 business days', '', '2026-11-21'].map(q).join(',') + '\n';
const results = []; let fails = 0;
function check(cond, label, detail) { results.push((cond ? 'PASS ' : 'FAIL ') + label + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); if (!cond) fails++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAGE_RE = /^https:\/\/dcvizcayno\.github\.io\/danyeloz-embeds\/(sync(-one-sheet)?\.html)(\?.*)?$/;
const inSel = (sel, text) => sel + ' :text("' + text + '")';

async function setup(browser, width, file, settings, framed = true) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const body = settingsCsv(settings || {});
  const parent = '<!DOCTYPE html><html><body style="margin:0"><h1>Parent site</h1><iframe id="f" sandbox="' + SANDBOX + '" src="' + BASE + file + '" style="border:0;width:100%;height:1600px"></iframe></body></html>';
  await ctx.route(/^https?:\/\//, r => {
    const url = r.request().url();
    if (url.startsWith('https://forms.gle/')) return r.fulfill({ status: 200, contentType: 'text/html', body: '<p>form</p>' });
    if (url === 'https://parent.test/') return r.fulfill({ status: 200, contentType: 'text/html', body: parent });
    const m = PAGE_RE.exec(url);
    if (m) return r.fulfill({ status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(EMBEDS, m[1]), 'utf8') });
    const cors = { 'Access-Control-Allow-Origin': '*' };
    if (/gviz/.test(url) && /sheet=sync_settings/.test(url)) return r.fulfill({ status: 200, contentType: 'text/csv', body, headers: cors });
    const res = mock.resolve(url, {});
    if (res) return r.fulfill({ status: res.status, contentType: res.contentType, body: res.body, headers: cors });
    return r.abort();
  });
  const errors = [], created = [];
  ctx.on('page', p => { created.push(p); p.on('pageerror', e => errors.push(String(e))); });
  const page = await ctx.newPage();
  const navs = [];
  page.on('framenavigated', f => { if (f !== page.mainFrame()) navs.push(f.url()); });
  await page.goto(framed ? 'https://parent.test/' : BASE + file);
  const frame = framed ? await (await page.waitForSelector('#f')).contentFrame() : page.mainFrame();
  await frame.waitForLoadState('load'); navs.length = 0; // baseline: the initial frame load is not a navigation by the user
  return { ctx, page, frame, errors, navs, created, extra: () => created.length - 1 };
}
const sideScroll = f => f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function panel(frame, L, songTitle, how) {
  const dlg = await frame.waitForSelector('[role="dialog"]', { timeout: 4000 }).catch(() => null);
  check(!!dlg, L + ' dialog opens');
  if (!dlg) return;
  const p = await frame.evaluate(() => { const d = document.querySelector('[role="dialog"]'); const m = d.querySelector('.ozr-mailto'); const ml = d.querySelector('.ozr-mail');
    return { text: d.innerText, mailVisible: !!ml && ml.getBoundingClientRect().width > 0, mailto: m && m.getAttribute('href'),
      focusIn: d.contains(document.activeElement), imgs: d.querySelectorAll('img,b#pwn').length }; });
  check(p.text.includes(EMAIL) && p.mailVisible, L + ' email shown as visible text');
  check(/3 business days/.test(p.text), L + ' 3-business-day promise shown');
  check(['song', 'project', 'media', 'territory', 'term', 'timeline'].every(w => p.text.toLowerCase().includes(w)), L + ' what-to-include list');
  check(p.focusIn, L + ' focus moved into dialog');
  check(p.imgs === 0, L + ' no planted elements in dialog');
  if (songTitle) {
    check(p.text.includes(songTitle), L + ' song title shown', songTitle);
    check(p.mailto === 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('License request: ' + songTitle), L + ' mailto subject encoded', p.mailto);
  }
  if (how === 'Escape') await frame.press('[role="dialog"]', 'Escape'); else await frame.click('[role="dialog"] .ozr-close');
  check(!(await frame.$('[role="dialog"]')), L + ' ' + how + ' closes');
}

async function catalogueRun(browser, w) {
  const L0 = w + ' sync.html framed';
  const s = await setup(browser, w, 'sync.html');
  const frame = s.frame;
  await frame.waitForSelector('#sy .sy-card', { timeout: 10000 });
  check(await frame.evaluate(() => window.top !== window), L0 + ' is framed');
  check((await sideScroll(frame)) <= 0, L0 + ' no sideways scroll (main)');
  const frameUrl = frame.url();
  const reqs = frame.locator('button, a', { hasText: /Request a license/i });
  const n = await reqs.count();
  check(n >= 3, L0 + ' request controls found', n);
  for (let i = 0; i < n; i++) {
    const loc = reqs.nth(i);
    const tag = await loc.evaluate(e => [e.tagName, e.getAttribute('href'), e.closest('.sy-card') ? e.closest('.sy-card').querySelector('.sy-ct').textContent : '']);
    check(tag[0] === 'BUTTON' || !/^mailto:/.test(tag[1] || ''), L0 + ' request #' + i + ' is not a raw mailto', tag);
    await loc.scrollIntoViewIfNeeded(); await loc.click();
    await panel(frame, L0 + ' request #' + i, tag[2], i % 2 ? 'Escape' : 'Close');
    if (i === 0) {
      check(await loc.evaluate(e => e === document.activeElement), L0 + ' focus returns to opener');
      await loc.click();
      await frame.click('.ozr .ozr-copy');
      await frame.waitForFunction(() => document.querySelector('.ozr-status').textContent !== '', null, { timeout: 4000 }).catch(() => {});
      const c = await frame.evaluate(() => [document.querySelector('.ozr-status').textContent, String(getSelection())]);
      check(/copied/i.test(c[0]) || (/Ctrl\+C/.test(c[0]) && c[1].trim() === EMAIL), L0 + ' copy or select fallback', c);
      check((await sideScroll(frame)) <= 0, L0 + ' no sideways scroll (panel open)');
      await frame.press('[role="dialog"]', 'Escape');
    }
  }
  check(frame.url() === frameUrl && s.navs.length === 0, L0 + ' frame never navigated by requests', s.navs);
  check(s.extra() === 0, L0 + ' requests opened no window', s.extra());
  await frame.click(inSel('#sy .sy-hero', 'Get the one-sheet'));
  check(await frame.isVisible('#os .os-table') && !(await frame.isVisible('#sy .sy-hero')), L0 + ' one-sheet shown in-frame');
  check((await sideScroll(frame)) <= 0, L0 + ' no sideways scroll (sheet view)');
  await frame.locator('#os button', { hasText: /Request a license/i }).click();
  await panel(frame, L0 + ' sheet-view request', '', 'Escape');
  await frame.click('text=Back to the catalogue');
  check(await frame.isVisible('#sy .sy-hero') && !(await frame.isVisible('#os')), L0 + ' back returns to catalogue');
  await frame.click(inSel('#sy .sy-how', 'Get the one-sheet'));
  check(await frame.isVisible('#os .os-table'), L0 + ' how-section one-sheet button works');
  check(s.navs.length === 0 && s.extra() === 0, L0 + ' view toggles: no nav, no window');
  const pr = await frame.$eval('text=Print or save as PDF', a => [a.tagName, a.href, a.getAttribute('target'), a.getAttribute('rel'), a.referrerPolicy]);
  check(pr[0] === 'A' && pr[1] === BASE + 'sync-one-sheet.html' && pr[2] === 'ozsync-onesheet' && pr[4] === 'no-referrer', L0 + ' framed print link: named target ozsync-onesheet, no-referrer, never _blank', pr);
  const [p1] = await Promise.all([s.ctx.waitForEvent('page'), frame.click('text=Print or save as PDF')]);
  await p1.waitForSelector('#os .os-foot', { timeout: 10000 });
  check(s.extra() === 1, L0 + ' print opens exactly one page', s.extra());
  const back = await p1.$$eval('a', as => as.filter(a => /danyeloz-embeds\/sync\.html/.test(a.href)).map(a => a.getAttribute('target')));
  check(back.length >= 1 && back.every(t => !t || t === '_self'), L0 + ' popup catalogue link stays in tab', back);
  await Promise.all([p1.waitForURL(BASE + 'sync.html'), p1.click('#os a.os-cat')]);
  await p1.waitForSelector('#sy .sy-hero', { timeout: 10000 });
  check(s.extra() === 1, L0 + ' following back opens no new page', s.extra());
  await p1.click(inSel('#sy .sy-hero', 'Get the one-sheet'));
  const p1print = await p1.$eval('text=Print or save as PDF', a => a.getAttribute('target'));
  check(p1print === null, L0 + ' top-level print link has no target', p1print);
  await Promise.all([p1.waitForURL(BASE + 'sync-one-sheet.html'), p1.click('text=Print or save as PDF')]); await sleep(800);
  check(/sync-one-sheet.html$/.test(p1.url()), L0 + ' top-level print stays in the same tab', p1.url());
  const chained = s.created.filter(p => p !== p1 && p !== s.page);
  const fromFirst = chained.length ? (await chained[0].opener()) === p1 : null;
  check(s.extra() <= 1, L0 + ' CHAIN popup then catalogue then print opens no second page', { pagesOpened: s.extra(), secondOpenedFromFirst: fromFirst });
  for (let k = 0; k < 3; k++) { await frame.click('text=Back to the catalogue'); await frame.click(inSel('#sy .sy-hero', 'Get the one-sheet'));
    await frame.click('text=Print or save as PDF'); await sleep(600); }
  check(s.extra() === 1, L0 + ' ORDER-B second print click from the frame opens no extra page', s.extra());
  check(s.navs.length === 0, L0 + ' frame never navigated', s.navs);
  check(s.errors.length === 0, L0 + ' no page errors', s.errors);
  await s.ctx.close();
}

async function printOnlyRun(browser, w) {
  const L = w + ' fresh embed, 3 Print clicks';
  const s = await setup(browser, w, 'sync.html');
  await s.frame.waitForSelector('#sy .sy-card', { timeout: 10000 });
  await s.frame.click(inSel('#sy .sy-hero', 'Get the one-sheet'));
  for (let k = 0; k < 3; k++) { await s.frame.click('text=Print or save as PDF'); await sleep(700); }
  check(s.extra() === 1, L + ': exactly one popup in total', s.extra());
  const pop = s.created[1];
  if (pop) { await pop.waitForSelector('#os .os-foot', { timeout: 10000 }); check(/sync-one-sheet.html$/.test(pop.url()) && await pop.evaluate(() => window.top === window), L + ': popup is the top-level one-sheet', pop.url());
    check(await pop.evaluate(() => window.name) === 'ozsync-onesheet', L + ': popup window name', await pop.evaluate(() => window.name)); }
  check(s.navs.length === 0 && s.errors.length === 0, L + ': frame not navigated, no page errors', { navs: s.navs, errors: s.errors });
  await s.ctx.close();
}

async function contactRun(browser, w) {
  const forms = 'https://forms.gle/AbCdEf123';
  let s = await setup(browser, w, 'sync.html', { contact_url: forms });
  await s.frame.waitForSelector('#sy .sy-card', { timeout: 10000 });
  await s.frame.click(inSel('#sy .sy-hero', 'Request a license'));
  const a = await s.frame.$eval('.ozr-acts', d => { const f = d.firstElementChild; return [f.tagName, f.textContent, f.getAttribute('href'), f.getAttribute('target'), f.getAttribute('rel'), f.className]; });
  check(a[0] === 'A' && /Fill out the request form/.test(a[1]) && a[2] === forms && a[3] === '_blank' && /noopener/.test(a[4]) && /solid/.test(a[5]), w + ' forms.gle main button is the https form in new tab', a);
  check(!!(await s.frame.$('.ozr-acts .ozr-mailto')), w + ' forms.gle mailto still offered as secondary');
  const [fp] = await Promise.all([s.ctx.waitForEvent('page'), s.frame.click('.ozr-form')]);
  check(fp.url().startsWith('https://forms.gle/') && s.navs.length === 0, w + ' forms.gle form opens in new tab, frame stays', fp.url());
  await s.ctx.close();
  const bad = ['https://evil.example/forms/x', 'https://forms.gle.evil.com/x', 'javascript:alert(1)', 'http://forms.gle/x'];
  for (const evil of bad) {
    s = await setup(browser, w, 'sync.html', { contact_url: evil, turnaround: '<img src=x onerror=window.__pwn2=1>', rights_line: '<b id=pwn>planted</b>' });
    await s.frame.waitForSelector('#sy .sy-card', { timeout: 10000 });
    await s.frame.click(inSel('#sy .sy-hero', 'Request a license'));
    const r = await s.frame.evaluate(e => {
      const box = document.querySelector('.ozr');
      return { form: !!document.querySelector('.ozr-form'), evilHref: Array.from(document.querySelectorAll('a')).some(a => a.getAttribute('href') === e),
        planted: document.querySelectorAll('img[src="x"], b#pwn').length, pwn: window.__pwn || window.__pwn2 || null,
        firstBtn: box.querySelector('.ozr-acts').firstElementChild.textContent, turn: box.querySelector('.ozr-turn').textContent,
        rights: (document.querySelector('.sy-rights') || {}).textContent };
    }, evil);
    check(!r.form && !r.evilHref && /email app/i.test(r.firstBtn), w + ' bad contact_url not shown: ' + evil, { form: r.form, evilHref: r.evilHref, firstBtn: r.firstBtn });
    check(r.planted === 0 && !r.pwn, w + ' planted HTML in settings stays text', { planted: r.planted, turn: r.turn, rights: r.rights });
    check(s.errors.length === 0, w + ' no page errors (' + evil + ')', s.errors);
    await s.ctx.close();
  }
}

async function oneSheetRun(browser, w) {
  const L = w + ' one-sheet framed';
  let s = await setup(browser, w, 'sync-one-sheet.html');
  await s.frame.waitForSelector('#os .os-foot', { timeout: 10000 });
  const links = await s.frame.$$eval('a', as => as.filter(a => /danyeloz-embeds\/sync/.test(a.href)).length);
  check(links === 0, L + ' no link to catalogue when framed', links);
  await s.frame.click(inSel('#os', 'Request a license')); await panel(s.frame, L + ' request', '', 'Escape');
  await s.frame.click(inSel('#os', 'Request a license')); await panel(s.frame, L + ' request again', '', 'Close');
  check(s.navs.length === 0 && s.extra() === 0, L + ' no nav, no window');
  check((await sideScroll(s.frame)) <= 0, L + ' no sideways scroll');
  check(s.errors.length === 0, L + ' no page errors', s.errors);
  await s.ctx.close();
  const L2 = w + ' one-sheet standalone';
  s = await setup(browser, w, 'sync-one-sheet.html', {}, false);
  await s.page.waitForSelector('#os .os-foot', { timeout: 10000 });
  const t = await s.page.$$eval('a', as => as.filter(a => /danyeloz-embeds\/sync\.html/.test(a.href)).map(a => a.getAttribute('target')));
  check(t.length >= 1 && t.every(x => x === null || x === '_self'), L2 + ' catalogue link has no target _blank', t);
  check((await sideScroll(s.page.mainFrame())) <= 0, L2 + ' no sideways scroll');
  if (w === 1400) {
    await s.page.emulateMedia({ media: 'print' });
    for (const format of ['A4', 'Letter']) {
      const pdf = (await s.page.pdf({ format })).toString('latin1');
      const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
      check(pages === 1, L2 + ' print ' + format + ' is 1 page', pages);
    }
    await s.page.emulateMedia({ media: 'screen' });
  }
  await Promise.all([s.page.waitForURL(BASE + 'sync.html'), s.page.click('#os a.os-cat')]);
  await s.page.waitForSelector('#sy .sy-hero', { timeout: 10000 });
  check(s.extra() === 0, L2 + ' catalogue link stays in same tab', s.extra());
  check(s.errors.length === 0, L2 + ' no page errors', s.errors);
  await s.ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try { for (const w of [1400, 390]) { await printOnlyRun(browser, w); await catalogueRun(browser, w); await contactRun(browser, w); await oneSheetRun(browser, w); } }
  catch (e) { check(false, 'probe crashed', String(e).slice(0, 500)); }
  finally { await browser.close(); }
  console.log(results.join('\n'));
  console.log('probe: ' + results.length + ' checks, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
