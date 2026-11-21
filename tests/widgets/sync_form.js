// Playwright test for the inline "Sync license request" form in the sync catalogue's request panel (T-007, C-3).
//   env -u GITHUB_TOKEN -u GH_TOKEN node tests/widgets/sync_form.js
// sync.html runs inside the Google Sites style sandboxed iframe from mock.sandboxPage (allow-scripts allow-popups
// allow-forms allow-same-origin, other origin) at 1400 and 390 px. The forms config is mocked (fixture, '{}', 404) and
// formResponse POSTs are captured in log.posts. Checks: per-song prefill reaches the songs entry id; the hero button
// starts empty; required fields; planted HTML stays text; honeypot and too-fast submits send nothing; success in place
// with the turnaround; email row kept; Tab trap skips the honeypot; backdrop keeps a typed form; Escape and Close
// return focus; missing or invalid config gives today's email-only panel; no navigation, no popup, no page errors,
// no sideways scroll.
const assert = require('assert');
const { chromium } = require('playwright');
const mock = require('./mock-sheet');

const FIXTURE = require('./fixtures/forms.json').forms.sync;
const IDS = FIXTURE.fields;
const EMAIL = 'daniel.vizkaino@gmail.com';
const PLANT = '<img src=x onerror=window.__pwn=9>';
const PLANTED_TITLE = '<img src=x onerror=window.__pwn=1>';
const PRIVACY = 'https://www.danyeloz.info/about/privacy';
let checks = 0;
function ok(cond, msg) { assert.ok(cond, msg); checks++; }
function eq(a, b, msg) { assert.deepStrictEqual(a, b, msg); checks++; }

const card = (frame, title) => frame.locator('#sy .sy-card', { has: frame.locator('.sy-ct', { hasText: new RegExp('^' + title + '$') }) }).locator('.sy-req');
const HERO = '#sy .sy-hero button.sy-btn.solid';

async function open(browser, width, forms) {
  const s = await mock.sandboxPage(browser, width, 'sync.html', { forms });
  await s.frame.waitForSelector('#sy .sy-how', { timeout: 10000 });
  return s;
}

// Clicks a request button and waits for the form (or, with expectForm false, for the email-only panel).
async function openPanel(frame, clickFn, expectForm) {
  await clickFn();
  await frame.waitForSelector('.ozr[role="dialog"]');
  if (expectForm) await frame.waitForSelector('.ozr .ozf-form', { timeout: 10000 });
  else await frame.waitForFunction(() => !document.querySelector('.ozr .ozr-fbox'), null, { timeout: 10000 });
}

async function fillValid(frame, extra) {
  const v = Object.assign({ name: PLANT, email: 'buyer@example.com', company: 'Example Films ' + PLANT, project: 'Scene ' + PLANT,
    territory: 'Worldwide', term: '1 year', timeline: 'Next month' }, extra || {});
  for (const k of ['name', 'email', 'company', 'songs', 'territory', 'term', 'timeline']) if (k in v) await frame.fill('.ozr [name="' + k + '"]', v[k]);
  await frame.fill('.ozr textarea[name="project"]', v.project);
  await frame.selectOption('.ozr select[name="media"]', 'Film');
  if (v.budget) await frame.selectOption('.ozr select[name="budget"]', v.budget);
  if (v.notes) await frame.fill('.ozr textarea[name="notes"]', v.notes);
  return v;
}

async function common(s, label) {
  eq(s.errors, [], label + ': no page errors');
  eq(s.navs.filter(u => !/^https:\/\/dcvizcayno\.github\.io\/danyeloz-embeds\/sync\.html/.test(u)), [], label + ': frame never navigated');
  eq(s.popups.length, 0, label + ': no popup');
  eq(await s.frame.evaluate(() => window.__pwn), undefined, label + ': planted script did not run');
  const w = await s.frame.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  ok(w.sw <= w.cw, label + ': no horizontal scroll ' + JSON.stringify(w));
}

async function withForm(browser, width) {
  const L = width + ' px fixture';
  const s = await open(browser, width, 'fixture');
  const { frame, log } = s;

  // 1. Per-song button with a planted title: prefilled as text, form first, email row kept, checklist hidden.
  const planted = await frame.evaluate(t => Array.from(document.querySelectorAll('#sy .sy-card')).some(c => c.querySelector('.sy-ct').textContent === t), PLANTED_TITLE);
  ok(planted, L + ': fixture card with planted title present');
  await openPanel(frame, () => frame.evaluate(t => Array.from(document.querySelectorAll('#sy .sy-card'))
    .find(c => c.querySelector('.sy-ct').textContent === t).querySelector('.sy-req').click(), PLANTED_TITLE), true);
  const p = await frame.$eval('.ozr', d => {
    const q = x => d.querySelector(x), vis = n => !!n && n.offsetParent !== null;
    const ps = Array.from(d.children).filter(n => n.tagName === 'P').map(n => n.textContent);
    return { fh: q('.ozr-fh') && q('.ozr-fh').textContent, songs: q('input[name="songs"]').value, mail: q('.ozr-mail').textContent,
      copy: vis(q('.ozr-copy')), mailto: q('.ozr-mailto') && q('.ozr-mailto').getAttribute('href'), ps,
      checklist: vis(q('ul')) || ps.indexOf('Include in your request:') < 0 ? 'bad' : vis(Array.from(d.children).find(n => n.textContent === 'Include in your request:')),
      privacy: q('.ozf-privacy a') && [q('.ozf-privacy a').getAttribute('href'), q('.ozf-privacy a').getAttribute('rel')],
      formFirst: !!(q('.ozr-fbox').compareDocumentPosition(q('.ozr-row')) & Node.DOCUMENT_POSITION_FOLLOWING),
      markup: d.querySelectorAll('img, script, iframe, [onerror]').length, label: q('.ozr-h').textContent };
  });
  eq([p.label, p.fh, p.songs, p.mail, p.copy], ['Request a license', 'Sync license request', PLANTED_TITLE, EMAIL, true], L + ': panel shows form with the song prefilled as text');
  ok(/^mailto:daniel\.vizkaino@gmail\.com\?subject=/.test(p.mailto), L + ': Open in your email app kept');
  ok(p.ps.indexOf('Prefer email? Send your request to:') >= 0, L + ': email intro becomes the fallback row');
  eq(p.checklist, false, L + ': checklist hidden while the form shows');
  eq(p.privacy, [PRIVACY, 'noopener noreferrer'], L + ': privacy link');
  eq([p.formFirst, p.markup], [true, 0], L + ': form before the email row, no markup from the title');
  const shown = Date.now();

  // 2. Tab trap: inputs, select and textarea are stops; the honeypot never is; focus never leaves the panel.
  await frame.focus('.ozr .ozr-close');
  const seen = [];
  for (let i = 0; i < 24; i++) {
    await frame.press('.ozr', 'Tab');
    seen.push(await frame.evaluate(() => { const a = document.activeElement; return [!!a.closest('.ozr'), a.getAttribute('name') || a.tagName]; }));
  }
  ok(seen.every(x => x[0]), L + ': Tab stays in the panel');
  ok(!seen.some(x => x[1] === 'website'), L + ': honeypot skipped');
  ok(['name', 'media', 'project'].every(n => seen.some(x => x[1] === n)), L + ': fields are Tab stops');
  await frame.focus('.ozr [name="name"]');
  await frame.press('.ozr', 'Shift+Tab');
  ok(await frame.evaluate(() => document.activeElement === document.querySelector('.ozr .ozr-close')), L + ': Shift+Tab from the first field wraps to Close');

  // 3. Required fields: nothing sent, every required field flagged, focus on the first.
  await frame.fill('.ozr input[name="songs"]', '');
  await frame.click('.ozr .ozf-send');
  const req = await frame.$$eval('.ozr [aria-invalid="true"]', n => n.map(x => x.getAttribute('name')));
  eq(req, ['name', 'email', 'company', 'songs', 'project', 'media', 'territory', 'term', 'timeline'], L + ': required fields flagged');
  eq(await frame.evaluate(() => document.activeElement.getAttribute('name')), 'name', L + ': focus on the first invalid field');
  eq(log.posts.length, 0, L + ': invalid form sends nothing');

  // 4. Backdrop keeps a typed form.
  const v = await fillValid(frame, { songs: PLANTED_TITLE, budget: 'Under $500', notes: 'Notes ' + PLANT });
  await frame.click('.ozr-back', { position: { x: 4, y: 4 } });
  ok(!!(await frame.$('.ozr')), L + ': backdrop click does not close a typed form');

  // 5. Valid submit after the minimum fill time: one POST, all 11 entry ids, literal text, no cookie or referer.
  const wait = 3200 - (Date.now() - shown);
  if (wait > 0) await frame.waitForTimeout(wait);
  await frame.click('.ozr .ozf-send');
  await frame.waitForSelector('.ozr .ozf-ok', { timeout: 10000 });
  eq(log.posts.length, 1, L + ': one POST');
  const post = log.posts[0], body = new URLSearchParams(post.body);
  eq(post.url, FIXTURE.action, L + ': POST to the sync formResponse URL');
  eq(Array.from(body.keys()).sort(), Object.values(IDS).sort(), L + ': all 11 sync entry ids');
  eq([body.get(IDS.songs), body.get(IDS.name), body.get(IDS.media), body.get(IDS.budget), body.get(IDS.notes)],
    [PLANTED_TITLE, v.name, 'Film', 'Under $500', v.notes], L + ': song prefill reaches the songs entry id; planted text literal');
  ok(!post.headers.cookie && !post.headers.referer, L + ': no cookie, no referer');
  const okText = await frame.$eval('.ozr .ozf-ok', n => n.textContent);
  ok(/^Thank you\. Your request is in\. You get a quote within [^.]+\.$/.test(okText), L + ': success with turnaround: ' + okText);
  ok(await frame.isVisible('.ozr .ozr-mail') && await frame.isVisible('.ozr .ozr-close'), L + ': panel stays open in place, email row kept');
  await frame.press('.ozr', 'Escape');
  ok(!(await frame.$('.ozr')), L + ': Escape closes after success');

  // 6. Hero button: empty songs, required; optional budget and notes left out of the POST; Close returns focus.
  await openPanel(frame, () => frame.click(HERO), true);
  const shown2 = Date.now();
  eq(await frame.$eval('.ozr input[name="songs"]', n => n.value), '', L + ': hero request starts with no song');
  ok(!(await frame.$('.ozr .ozr-song')), L + ': no song line for a general request');
  await fillValid(frame, { songs: 'Song 01, Song 02' });
  const w2 = 3200 - (Date.now() - shown2);
  if (w2 > 0) await frame.waitForTimeout(w2);
  await frame.click('.ozr .ozf-send');
  await frame.waitForSelector('.ozr .ozf-ok', { timeout: 10000 });
  eq(log.posts.length, 2, L + ': second POST');
  const b2 = new URLSearchParams(log.posts[1].body);
  eq([b2.get(IDS.songs), b2.has(IDS.budget), b2.has(IDS.notes), Array.from(b2.keys()).length], ['Song 01, Song 02', false, false, 9], L + ': empty optional fields not sent');
  await frame.click('.ozr .ozr-close');
  ok(!(await frame.$('.ozr')) && await frame.evaluate(h => document.activeElement === document.querySelector(h), HERO), L + ': Close returns focus to the hero button');

  // 7. Bot: honeypot filled -> success shown, nothing sent.
  await openPanel(frame, () => card(frame, 'Song 03').click(), true);
  const shown3 = Date.now();
  eq(await frame.$eval('.ozr input[name="songs"]', n => n.value), 'Song 03', L + ': Song 03 prefilled');
  await fillValid(frame, {});
  await frame.evaluate(() => { document.querySelector('.ozr input[name="website"]').value = 'http://spam.example'; });
  const w3 = 3200 - (Date.now() - shown3);
  if (w3 > 0) await frame.waitForTimeout(w3);
  await frame.click('.ozr .ozf-send');
  await frame.waitForSelector('.ozr .ozf-ok', { timeout: 10000 });
  eq(log.posts.length, 2, L + ': honeypot submit not posted');
  await frame.press('.ozr', 'Escape');

  // 8. Bot: submit within the minimum fill time -> nothing sent, a hint shows.
  await openPanel(frame, () => card(frame, 'Song 03').click(), true);
  await frame.evaluate(() => {
    const set = (n, v) => { const e = document.querySelector('.ozr [name="' + n + '"]'); e.value = v; };
    [['name', 'A'], ['email', 'a@example.com'], ['company', 'B'], ['project', 'C'], ['territory', 'D'], ['term', 'E'], ['timeline', 'F'], ['media', 'Film']].forEach(x => set(x[0], x[1]));
    document.querySelector('.ozr .ozf-send').click();
  });
  const st = await frame.$eval('.ozr .ozf-status', n => n.textContent);
  eq(st, 'Please take a moment to check your message, then press Send again.', L + ': too-fast submit held');
  eq(log.posts.length, 2, L + ': too-fast submit not posted');
  await frame.press('.ozr', 'Escape');

  // 9. Backdrop closes an untouched panel (prefilled song only) and focus returns to the button.
  await openPanel(frame, () => card(frame, 'Song 03').click(), true);
  await frame.click('.ozr-back', { position: { x: 4, y: 4 } });
  ok(!(await frame.$('.ozr')), L + ': backdrop closes an untouched panel');
  ok(await card(frame, 'Song 03').evaluate(b => b === document.activeElement), L + ': focus back on the song button');

  await common(s, L);
  await s.ctx.close();
}

// Missing or invalid config: the panel must equal the panel built without forms-core at all.
async function withoutForm(browser, width, forms) {
  const L = width + ' px config ' + JSON.stringify(forms === undefined ? '{}' : forms);
  const s = await open(browser, width, forms);
  const { frame, log } = s;
  for (const which of ['song', 'hero']) {
    const click = which === 'song' ? () => card(frame, 'Song 03').click() : () => frame.click(HERO);
    await openPanel(frame, click, false);
    const got = await frame.$eval('.ozr', d => d.outerHTML.replace(/ozr-title-\d+/g, 'ID'));
    await frame.press('.ozr', 'Escape');
    const sel = which === 'song' ? null : HERO;
    const base = await frame.evaluate(h => {
      const F = window.OZForms;
      window.OZForms = undefined;
      try {
        const b = h ? document.querySelector(h) : Array.from(document.querySelectorAll('#sy .sy-card')).find(c => c.querySelector('.sy-ct').textContent === 'Song 03').querySelector('.sy-req');
        b.click();
        const html = document.querySelector('.ozr').outerHTML.replace(/ozr-title-\d+/g, 'ID');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        return html;
      } finally { window.OZForms = F; }
    }, sel);
    eq(got, base, L + ' ' + which + ': panel identical to the email-only panel');
    ok(base.indexOf('Send your request by email to:') >= 0 && base.indexOf('Include in your request:') >= 0 && base.indexOf('ozf') < 0, L + ' ' + which + ': email, checklist, no form');
  }
  eq(log.posts.length, 0, L + ': nothing posted');
  await common(s, L);
  await s.ctx.close();
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const width of [1400, 390]) {
      await withForm(browser, width);
      await withoutForm(browser, width, undefined);
      await withoutForm(browser, width, 404);
      await withoutForm(browser, width, { version: 1, forms: { sync: { action: 'https://evil.example/formResponse', fields: IDS } } });
      console.log(width + ' px: ok');
    }
  } finally { await browser.close(); }
  console.log('sync_form: ' + checks + ' checks');
  console.log('PASSED');
})().catch(e => { console.error(e); process.exit(1); });
