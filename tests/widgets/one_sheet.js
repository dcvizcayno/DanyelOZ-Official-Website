// Playwright test for danyeloz-embeds/sync-one-sheet.html (one-sheet for music supervisors).
//   env -u GITHUB_TOKEN -u GH_TOKEN node tests/widgets/one_sheet.js
// Checks: page.pdf A4 and Letter are exactly 1 page with 10 long-title rows; 3 featured songs are topped up to 8;
// planted HTML is shown as text; rights text matches OZSync.rightsText for the same settings; URL parameters change
// nothing; fallback text when tracks fail; 390 px has no sideways scroll; no page errors. No network: mock-sheet.js.
// T-001: top-level catalogue link stays in the same tab; "Request a license" opens the in-page panel (hidden in print).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const mock = require('./mock-sheet');

const EMBEDS = process.env.EMBEDS_DIR || 'E:/Projects/danyeloz-embeds';
const PAGE = 'file:///' + path.join(EMBEDS, 'sync-one-sheet.html').replace(/\\/g, '/');
const PLANT = '<img src=x onerror=window.__pwn=1>';
let checks = 0;
function ok(cond, msg) { assert.ok(cond, msg); checks++; }
function eq(a, b, msg) { assert.deepStrictEqual(a, b, msg); checks++; }

// tracks.csv with every featured title (rows 02..11) made long; row 02 also carries planted HTML.
function longTracks() {
  return fs.readFileSync(path.join(mock.FIXTURES, 'tracks.csv'), 'utf8').split('\n').map(line => {
    const m = /^"QZRP425000(\d\d)","[^"]*"/.exec(line);
    if (!m || +m[1] < 2 || +m[1] > 11) return line;
    const title = (m[1] === '02' ? PLANT + ' ' : '') + 'A Very Long Song Title Number ' + m[1] + ' That Keeps Going Well Past Any Column Width On The Printed Page';
    return line.replace(/^("QZRP425000\d\d"),"[^"]*"/, '$1,"' + title + '"');
  }).join('\n');
}

function pdfPages(buf) { return (buf.toString('latin1').match(/\/Type\s*\/Page(?![s\w])/g) || []).length; }

async function open(browser, tabs, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::/.test(m.text())) errors.push(m.text()); });
  const log = await mock.route(page, tabs);
  if (opts.tracksBody) {
    await page.route(/gviz\/tq\?.*sheet=tracks/, r => r.fulfill({ status: 200, contentType: 'text/csv', body: opts.tracksBody }));
  }
  await page.goto(PAGE + (opts.query || ''));
  await page.waitForFunction(() => !document.querySelector('#os .os-msg') || /not available|could not load/.test(document.getElementById('os').textContent)
    , null, { timeout: 10000 });
  await page.waitForSelector('#os .os-foot, #os .os-msg', { timeout: 10000 });
  return { ctx, page, errors, log };
}

const titles = page => page.$$eval('#os .os-table tbody td.t', tds => tds.map(td => td.textContent));

(async () => {
  const browser = await chromium.launch();
  try {
    // 1. 10 long-title rows, planted HTML, PDF page counts
    {
      const { ctx, page, errors, log } = await open(browser, {}, { tracksBody: longTracks() });
      const t = await titles(page);
      eq(t.length, 10, '10 rows from 11 released featured');
      ok(t.every(x => /A Very Long Song Title Number \d\d/.test(x)), 'all rows are long titles');
      ok(t.some(x => x.indexOf(PLANT) === 0), 'planted HTML shown as literal text');
      eq(await page.$$eval('#os img', i => i.length), 0, 'planted <img> not rendered');
      eq(await page.evaluate(() => window.__pwn), undefined, 'onerror never ran');
      ok(!t.some(x => /Unreleased/.test(x)), 'unreleased featured song absent');
      const pron = (await page.$eval('#os', e => e.textContent)).match(/\b(he|his|him|she|her|hers)\b/gi);
      eq(pron, null, 'no gendered pronouns in page text');
      const ext = await page.$$eval('#os .os-table a[href^="http"]', as => as.map(a => [a.target, a.rel]));
      ok(ext.length >= 1 && ext.every(x => x[0] === '_blank' && x[1] === 'noopener noreferrer'), 'listen links: _blank + noopener noreferrer');
      const cat = await page.$$eval('#os a.os-cat', as => as.map(a => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]));
      eq(cat, [['https://dcvizcayno.github.io/danyeloz-embeds/sync.html', null, null]], 'top-level: catalogue link opens in the same tab (C-2)');
      eq(await page.$$eval('#os a[href*="danyeloz-embeds/sync"][target]', as => as.length), 0, 'no new-tab link between the two pages');
      const hrefs = await page.$$eval('#os a[href]', as => as.map(a => a.getAttribute('href')));
      ok(hrefs.every(h => /^(https:|mailto:)/.test(h)), 'only https/mailto hrefs: ' + hrefs.join(' '));
      ok(!log.some(u => !/^https:\/\/(docs\.google\.com\/spreadsheets\/|dcvizcayno\.github\.io\/danyeloz-embeds\/sync-core\.js|fonts\.googleapis\.com\/)/.test(u)), 'no unexpected requests');
      // print: request button and any open panel are hidden, so the PDF stays one page
      await page.click('#os .os-req');
      ok(await page.isVisible('.ozr[role="dialog"]'), 'request panel open before printing');
      await page.emulateMedia({ media: 'print' });
      eq(await page.evaluate(() => ['.ozr', '.ozr-back', '#os .os-req'].map(q => getComputedStyle(document.querySelector(q)).display)), ['none', 'none', 'none'], 'print: panel and request button hidden');
      ok(/daniel.vizkaino@gmail.com/.test(await page.$eval('#os .os-contact', e => e.innerText)), 'print: email stays as text');
      await page.emulateMedia({ media: null });
      const a4 = await page.pdf({ format: 'A4', printBackground: true });
      const letter = await page.pdf({ format: 'Letter', printBackground: true });
      const nA4 = pdfPages(a4), nLetter = pdfPages(letter);
      console.log('A4=' + nA4 + ' Letter=' + nLetter + ' pages (10 long-title rows)');
      eq(nA4, 1, 'A4 is exactly 1 page');
      eq(nLetter, 1, 'Letter is exactly 1 page');
      // print styles: black text on white
      await page.emulateMedia({ media: 'print' });
      const pc = await page.$eval('#os .os-rights', e => [getComputedStyle(e).color, getComputedStyle(document.querySelector('#os .os-top')).backgroundColor]);
      eq(pc[0], 'rgb(0, 0, 0)', 'print: black text');
      ok(pc[1] === 'rgba(0, 0, 0, 0)' || pc[1] === 'rgb(255, 255, 255)', 'print: no dark header background');
      eq(errors, [], 'no page errors (long rows)');
      await ctx.close();
    }
    // 2. 3 featured: topped up to 8 with newest complete released songs
    {
      const { ctx, page, errors } = await open(browser, { tracks: 'tracks_few.csv' });
      const t = await titles(page);
      eq(t.length, 8, '3 featured topped up to 8');
      ok(['Song 01', 'Song 02', 'Song 03'].every(x => t.indexOf(x) >= 0), 'featured songs present');
      ok(t.indexOf('Few Unreleased') < 0 && t.indexOf('Few Incomplete') < 0, 'no unreleased or incomplete rows');
      const expect = await page.evaluate(() => OZSync.fetchTab('tracks').then(tr => OZSync.fetchTab('Sheet1').then(s1 =>
        OZSync.pickOneSheet(OZSync.songs(tr, s1)).map(s => s.title))));
      eq(t, expect, 'rows equal OZSync.pickOneSheet order');
      eq(errors, [], 'no page errors (few)');
      await ctx.close();
    }
    // 3. rights text identical to OZSync.rightsText for each settings fixture; bad settings not rendered as HTML
    for (const file of ['sync_settings.csv', 'sync_settings_pro.csv', 'sync_settings_bad.csv']) {
      const { ctx, page, errors } = await open(browser, { sync_settings: file });
      const got = await page.$eval('#os .os-rights', e => e.textContent);
      const want = await page.evaluate(() => OZSync.fetchTab('sync_settings').then(t => OZSync.rightsText(OZSync.settings(t))));
      eq(got, want, 'rights text = OZSync.rightsText (' + file + ')');
      if (file === 'sync_settings.csv') {
        eq(got, await page.evaluate(() => OZSync.rightsText()), 'default fixture gives the D-5 default wording');
        eq(await page.$$eval('#os .os-contact a[href^="mailto:"]', a => a.length), 0, 'no raw mailto in the contact line (C-1)');
        eq(await page.$eval('#os .os-mail', e => e.textContent), 'daniel.vizkaino@gmail.com', 'email shown as text');
        ok(/Reply within 3 business days\./.test(await page.$eval('#os .os-contact', e => e.textContent)), '3 business days reply line');
        await page.click('#os .os-req');
        const panel = await page.$eval('.ozr', d => ({ role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'),
          label: document.getElementById(d.getAttribute('aria-labelledby')).textContent, mail: d.querySelector('.ozr-mail').textContent,
          mailto: d.querySelector('.ozr-mailto').getAttribute('href'), form: !!d.querySelector('.ozr-form'), text: d.textContent,
          focus: d.contains(document.activeElement) }));
        eq([panel.role, panel.modal, panel.label, panel.mail], ['dialog', 'true', 'Request a license', 'daniel.vizkaino@gmail.com'], 'panel: dialog, labelled, email');
        eq(panel.mailto, 'mailto:daniel.vizkaino@gmail.com?subject=' + encodeURIComponent('License request: Danyel OZ catalogue'), 'panel: mailto');
        ok(!panel.form && panel.focus && /3 business days/.test(panel.text) && /territory/.test(panel.text), 'panel: no form without contact_url, focus inside, turnaround, checklist');
        await page.keyboard.press('Escape');
        ok(!(await page.$('.ozr')) && await page.evaluate(() => document.activeElement === document.querySelector('#os .os-req')), 'Escape closes, focus returns');
      }
      if (file === 'sync_settings_pro.csv') {
        await page.click('#os .os-req');
        const f = await page.$eval('.ozr .ozr-form', a => [a.getAttribute('href'), a.target, a.rel, a.textContent]);
        eq(f, ['https://forms.gle/' + f[0].split('forms.gle/')[1], '_blank', 'noopener noreferrer', 'Fill out the request form'], 'pro: form button from contact_url');
        await page.click('.ozr .ozr-close');
        ok(!(await page.$('.ozr')), 'Close button closes');
      }
      if (file === 'sync_settings_pro.csv') ok(/BMI/.test(got), 'PRO named when set');
      eq(await page.$$eval('#os .os-rights *, #os .os-contact script, #os .os-contact img', e => e.length), 0, 'no markup from settings (' + file + ')');
      eq(await page.evaluate(() => window.__pwn), undefined, 'no script ran (' + file + ')');
      eq(errors, [], 'no page errors (' + file + ')');
      await ctx.close();
    }
    // 4. SR-10: URL parameters change nothing
    {
      const base = await open(browser, {});
      const before = await base.page.$eval('#os', e => e.textContent);
      const beforeLinks = await base.page.$$eval('#os a', as => as.map(a => a.getAttribute('href')));
      await base.ctx.close();
      const q = '?contact=evil%40evil.io&contact_email=evil%40evil.io&rights=Free&rights_line=Free&url=https%3A%2F%2Fevil.io&date=2030-01-01&print=1';
      const r = await open(browser, {}, { query: q });
      eq(await r.page.$eval('#os', e => e.textContent), before, 'URL params do not change text');
      eq(await r.page.$$eval('#os a', as => as.map(a => a.getAttribute('href'))), beforeLinks, 'URL params do not change links');
      eq(r.errors, [], 'no page errors (params)');
      await r.ctx.close();
    }
    // 5. fallback: tracks without sync columns, and tracks tab missing (gviz returns Sheet1)
    for (const tracks of ['tracks_nosync.csv', null]) {
      const { ctx, page, errors } = await open(browser, { tracks });
      ok(/song list is not available/.test(await page.$eval('#os', e => e.textContent)), 'fallback text (' + tracks + ')');
      eq(await page.$$eval('#os .os-table', e => e.length), 0, 'no table on fallback');
      ok((await page.$eval('#os .os-rights', e => e.textContent)).length > 50, 'rights still shown on fallback');
      eq(errors, [], 'no page errors (fallback ' + tracks + ')');
      await ctx.close();
    }
    // 6. 390 px screen: no sideways scroll with long rows
    {
      const { ctx, page, errors } = await open(browser, {}, { tracksBody: longTracks(), viewport: { width: 390, height: 844 } });
      const w = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
      ok(w[0] <= w[1], '390 px: scrollWidth ' + w[0] + ' <= clientWidth ' + w[1]);
      eq(errors, [], 'no page errors (390 px)');
      await ctx.close();
    }
    console.log('one_sheet: ' + checks + ' checks');
    console.log('PASSED');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
