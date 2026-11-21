// Playwright test for danyeloz-embeds/contact.html (Contact & Collaborations form on forms-core.js).
//   env -u GITHUB_TOKEN -u GH_TOKEN node tests/widgets/contact.js
// At 1400 and 390 px: page loads only forms-core.js and shows the 6 fields, heading, intro and privacy link; empty
// submit shows 6 errors; invalid email; planted HTML in every text field is posted and shown as text; a valid submit
// posts each fixture entry id once (no cookie, no referer) and shows the thank-you text; honeypot and too-fast submits
// post nothing; an aborted POST shows the failure text with the email and keeps the values; config 404, {} and an
// http action show the email fallback; inside the Google Sites sandbox the submit works with no navigation and no
// popup. No page errors, no sideways scroll. No network: mock-sheet.js. Screenshots: tests/ui/out/contact-<w>.png.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const mock = require('./mock-sheet');

const OUT = path.join(__dirname, '..', 'ui', 'out');
const FIXTURE = JSON.parse(fs.readFileSync(mock.FORMS_FIXTURE, 'utf8'));
const CFG = FIXTURE.forms.contact;
const EMAIL = 'daniel.vizkaino@gmail.com';
const PRIVACY = 'https://www.danyeloz.info/about/privacy';
const PLANT = '<img src=x onerror=window.__pwn=1>';
const OK_TEXT = 'Thank you. Your message is on its way, and I will reply to the email you gave me.';
const TOO_FAST = 'Please take a moment to check your message, then press Send again.';
const FAILURE = 'Your message could not be sent. Please email me at ' + EMAIL + '.';
const LABELS = ['First name', 'Last name', 'Email', 'What would you like to contact me about?', 'Subject', 'Message'];
const TOPICS = ['Fan Contact', 'Music Collaborations', 'Beat Licensing & Instrumentals', 'Sync & Licensing',
  'Media & Business Inquiries', 'General Inquiries'];
const FILL_WAIT = 3200;

let checks = 0;
function ok(cond, msg) { assert.ok(cond, msg); checks++; }
function eq(a, b, msg) { assert.deepStrictEqual(a, b, msg); checks++; }
const sleep = ms => new Promise(r => setTimeout(r, ms));

const VALID = {
  first_name: PLANT, last_name: PLANT + ' Lastname', email: 'fan.test@example.com', topic: 'Sync & Licensing',
  subject: PLANT + ' subject', message: PLANT + '\nA longer message line.'
};

// Direct page at its real URL (no iframe).
async function open(browser, width, forms, abortPost) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const page = await ctx.newPage();
  const errors = [], dialogs = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  page.on('dialog', d => { dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  const log = await mock.route(page, null, { forms });
  if (abortPost) await page.route(mock.FORM_POST, r => r.abort());
  await page.goto(mock.CONTACT_URL);
  await page.waitForSelector('#ozc .ozf-form, #ozc .ozf-fallback', { timeout: 10000 });
  return { ctx, page, target: page, errors, dialogs, log, shown: Date.now() };
}

async function fill(t, v) {
  for (const k of ['first_name', 'last_name', 'email', 'subject', 'message']) await t.fill('#ozc [name="' + k + '"]', v[k]);
  if (v.topic) await t.check('#ozc input[type=radio][value="' + v.topic + '"]');
}
const send = t => t.click('#ozc .ozf-send');
const errs = t => t.$$eval('#ozc .ozf-err', ps => ps.map(p => p.textContent));
const noSideways = t => t.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
async function waitFill(o) { const left = FILL_WAIT - (Date.now() - o.shown); if (left > 0) await sleep(left); }

function checkPost(post, v, where) {
  eq(post.url, CFG.action, where + ': POST goes to the fixture action');
  const p = new URLSearchParams(post.body);
  eq([...p.keys()].sort(), Object.values(CFG.fields).sort(), where + ': body has exactly the 6 entry ids');
  for (const k of Object.keys(CFG.fields)) eq(p.get(CFG.fields[k]), v[k], where + ': ' + k + ' sent as literal text');
  ok(!p.has('website'), where + ': honeypot not sent');
  ok(!post.headers.cookie, where + ': no cookie header');
  ok(!post.headers.referer, where + ': no referer header');
}

async function noPlantRan(t, where) {
  eq(await t.evaluate(() => window.__pwn), undefined, where + ': planted handler did not run');
  eq(await t.$$eval('#ozc img', a => a.length), 0, where + ': no img element created');
}

async function main(browser, w) {
  fs.mkdirSync(OUT, { recursive: true });

  // 1. Layout, empty submit, invalid email, then a valid submit with planted HTML.
  {
    const o = await open(browser, w, 'fixture');
    const t = o.target;
    eq(await t.$$eval('script[src]', s => s.map(x => x.src)), [mock.FORMS_CORE_URL], w + ': only forms-core.js is loaded');
    eq(await t.$$eval('#ozc h2.ozf-h', a => a.map(x => x.textContent)), ['Contact & Collaborations'], w + ': one heading');
    eq(await t.$$eval('#ozc p.ozf-intro', a => a.length), 1, w + ': one intro');
    eq(await t.$$eval('#ozc .ozf-form > .ozf-f', a => a.length), 6, w + ': 6 fields');
    eq(await t.$$eval('#ozc .ozf-form .ozf-l', a => a.map(x => x.textContent)), LABELS, w + ': field labels');
    eq(await t.$$eval('#ozc input[type=radio]', a => a.map(x => x.value)), TOPICS, w + ': topic choices');
    eq(await t.$eval('#ozc .ozf-help', e => e.textContent), 'Tell me how I can help.', w + ': message help');
    const link = await t.$eval('#ozc p.ozf-privacy a', a => [a.getAttribute('href'), a.getAttribute('target'), a.getAttribute('rel')]);
    eq(link, [PRIVACY, '_blank', 'noopener noreferrer'], w + ': privacy link opens the Privacy page in a new tab');
    ok(await noSideways(t), w + ': no sideways scroll (form)');
    await t.screenshot({ path: path.join(OUT, 'contact-' + w + '.png'), fullPage: true });

    await send(t);
    const e1 = await errs(t);
    eq(e1.length, 6, w + ': 6 error slots');
    ok(e1.every(x => x.length > 0), w + ': empty submit shows 6 errors');
    eq(e1[3], 'Please choose one.', w + ': topic error');
    ok(await noSideways(t), w + ': no sideways scroll (errors)');
    await t.screenshot({ path: path.join(OUT, 'contact-errors-' + w + '.png'), fullPage: true });

    await fill(t, Object.assign({}, VALID, { email: 'not-an-email' }));
    await send(t);
    const e2 = await errs(t);
    eq(e2[2], 'Please enter a valid email address.', w + ': invalid email message');
    eq(e2.filter(x => x).length, 1, w + ': only the email error left');
    eq(o.log.posts.length, 0, w + ': nothing posted before a valid submit');

    await t.fill('#ozc [name="email"]', VALID.email);
    await waitFill(o);
    await send(t);
    await t.waitForSelector('#ozc p.ozf-ok', { timeout: 10000 });
    eq(await t.$eval('#ozc p.ozf-ok', e => e.textContent), OK_TEXT, w + ': thank-you text');
    await sleep(300);
    eq(o.log.posts.length, 1, w + ': exactly one POST');
    checkPost(o.log.posts[0], VALID, w);
    await noPlantRan(t, w);
    eq(o.dialogs, [], w + ': no dialog');
    eq(t.url(), mock.CONTACT_URL, w + ': page did not navigate');
    ok(await noSideways(t), w + ': no sideways scroll (thanks)');
    await t.screenshot({ path: path.join(OUT, 'contact-thanks-' + w + '.png'), fullPage: true });
    eq(o.errors, [], w + ': no page errors (main)');
    await o.ctx.close();
  }

  // 2. Too fast: nothing posted, fill-time status.
  {
    const o = await open(browser, w, 'fixture');
    await fill(o.target, VALID);
    await send(o.target);
    ok(Date.now() - o.shown < 3000, w + ': too-fast submit happened inside 3 s');
    eq(await o.target.$eval('#ozc .ozf-form .ozf-status', e => e.textContent), TOO_FAST, w + ': fill-time status');
    await sleep(300);
    eq(o.log.posts.length, 0, w + ': too-fast submit not posted');
    eq(o.errors, [], w + ': no page errors (too fast)');
    await o.ctx.close();
  }

  // 3. Honeypot filled: thank-you text, nothing posted.
  {
    const o = await open(browser, w, 'fixture');
    await fill(o.target, VALID);
    await o.target.$eval('#ozc .ozf-hp input[name=website]', i => { i.value = 'http://spam.example'; });
    await waitFill(o);
    await send(o.target);
    await o.target.waitForSelector('#ozc p.ozf-ok', { timeout: 10000 });
    await sleep(300);
    eq(o.log.posts.length, 0, w + ': honeypot submit not posted');
    eq(o.errors, [], w + ': no page errors (honeypot)');
    await o.ctx.close();
  }

  // 4. POST aborted: failure text with the email, values kept, button usable again.
  {
    const o = await open(browser, w, 'fixture', true);
    await fill(o.target, VALID);
    await waitFill(o);
    await send(o.target);
    await o.target.waitForFunction(() => /could not be sent/.test(document.querySelector('#ozc .ozf-form .ozf-status').textContent), null, { timeout: 10000 });
    eq(await o.target.$eval('#ozc .ozf-form .ozf-status', e => e.textContent), FAILURE, w + ': failure text with the email');
    for (const k of ['first_name', 'last_name', 'email', 'subject', 'message']) {
      eq(await o.target.$eval('#ozc [name="' + k + '"]', i => i.value), VALID[k], w + ': ' + k + ' kept after failure');
    }
    ok(await o.target.$eval('#ozc input[type=radio][value="' + VALID.topic + '"]', i => i.checked), w + ': topic kept after failure');
    ok(await o.target.$eval('#ozc .ozf-send', b => !b.disabled), w + ': button enabled again');
    eq(o.log.posts.length, 0, w + ': aborted POST not fulfilled');
    await noPlantRan(o.target, w + ' failure');
    eq(o.errors, [], w + ': no page errors (abort)');
    await o.ctx.close();
  }

  // 5. Missing or invalid config: email fallback as text, Copy email, zero POSTs.
  const httpCfg = JSON.parse(JSON.stringify(FIXTURE));
  httpCfg.forms.contact.action = CFG.action.replace('https://', 'http://');
  for (const [name, forms] of [['404', 404], ['{}', {}], ['http action', httpCfg]]) {
    const o = await open(browser, w, forms);
    const t = o.target;
    eq(await t.$$eval('#ozc .ozf-form', a => a.length), 0, w + ' ' + name + ': no form');
    eq(await t.$eval('#ozc .ozf-fallback .ozf-mail', e => e.textContent), EMAIL, w + ' ' + name + ': email shown as text');
    eq(await t.$$eval('#ozc .ozf-fallback a[href^="mailto:"]', a => a.length), 0, w + ' ' + name + ': no mailto link');
    eq(await t.$eval('#ozc .ozf-fallback button.ozf-copy', b => b.textContent), 'Copy email', w + ' ' + name + ': Copy email button');
    eq(await t.$eval('#ozc p.ozf-privacy a', a => a.getAttribute('href')), PRIVACY, w + ' ' + name + ': privacy link');
    ok(await noSideways(t), w + ' ' + name + ': no sideways scroll');
    if (name === '404') await t.screenshot({ path: path.join(OUT, 'contact-fallback-' + w + '.png'), fullPage: true });
    eq(o.log.posts.length, 0, w + ' ' + name + ': zero POSTs');
    eq(o.errors, [], w + ' ' + name + ': no page errors');
    await o.ctx.close();
  }

  // 6. Google Sites sandbox: same valid submit, no navigation, no popup.
  {
    const s = await mock.sandboxPage(browser, w, 'contact.html', { forms: 'fixture' });
    const f = s.frame;
    await f.waitForSelector('#ozc .ozf-form', { timeout: 10000 });
    const o = { shown: Date.now() };
    const navs = s.navs.length;
    await fill(f, VALID);
    await waitFill(o);
    await send(f);
    await f.waitForSelector('#ozc p.ozf-ok', { timeout: 10000 });
    eq(await f.$eval('#ozc p.ozf-ok', e => e.textContent), OK_TEXT, w + ' sandbox: thank-you text');
    await sleep(300);
    eq(s.log.posts.length, 1, w + ' sandbox: exactly one POST');
    checkPost(s.log.posts[0], VALID, w + ' sandbox');
    await noPlantRan(f, w + ' sandbox');
    eq(s.navs.length, navs, w + ' sandbox: frame did not navigate');
    eq(f.url(), mock.CONTACT_URL, w + ' sandbox: frame still on contact.html');
    eq(s.popups.length, 0, w + ' sandbox: no popup');
    ok(await noSideways(f), w + ' sandbox: no sideways scroll');
    await s.page.screenshot({ path: path.join(OUT, 'contact-sandbox-' + w + '.png') });
    eq(s.errors, [], w + ' sandbox: no page errors');
    await s.ctx.close();
  }
  {
    const s = await mock.sandboxPage(browser, w, 'contact.html', { forms: 404 });
    await s.frame.waitForSelector('#ozc .ozf-fallback', { timeout: 10000 });
    eq(await s.frame.$eval('#ozc .ozf-mail', e => e.textContent), EMAIL, w + ' sandbox 404: email fallback');
    eq(s.log.posts.length, 0, w + ' sandbox 404: zero POSTs');
    eq(s.errors, [], w + ' sandbox 404: no page errors');
    await s.ctx.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    for (const w of [1400, 390]) await main(browser, w);
    console.log('contact: ' + checks + ' checks / PASSED');
  } catch (e) {
    console.error('contact: FAILED after ' + checks + ' checks\n' + (e && e.stack || e));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
