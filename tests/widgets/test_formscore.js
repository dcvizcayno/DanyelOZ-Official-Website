// Unit test for danyeloz-embeds/forms-core.js (window.OZForms): pure functions in a Node vm without a DOM, then a
// short Playwright smoke of OZForms.render against the mock (fixture config, empty config). No network.
// Run from the repo root: env -u GITHUB_TOKEN -u GH_TOKEN node tests/widgets/test_formscore.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const mock = require('./mock-sheet');

const SRC = fs.readFileSync(mock.FORMS_CORE_FILE, 'utf8');
const SYNC_SRC = fs.readFileSync(mock.CORE_FILE, 'utf8');
const GS = path.join(__dirname, '..', '..', 'apps-script', 'FormsSetup.gs');
const FIXTURE = JSON.parse(fs.readFileSync(mock.FORMS_FIXTURE, 'utf8'));
const j = v => JSON.stringify(v);
let count = 0;
function ok(cond, msg) { assert.ok(cond, msg); count++; }
function same(a, b, msg) { assert.strictEqual(j(a), j(b), msg); count++; }
const clone = v => JSON.parse(JSON.stringify(v));

function load(opts, log, fetchImpl) {
  const ctx = { URL, URLSearchParams, AbortController, setTimeout, clearTimeout, Promise,
    fetch: fetchImpl || mock.fetchStub({}, log, opts) };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'forms-core.js' });
  return ctx.OZForms;
}

const CONTACT_OK = { first_name: 'Ana', last_name: 'Cruz', email: 'ana.cruz+band@example.com', topic: 'Sync & Licensing',
  subject: 'Hello', message: 'Line one\nLine two' };
const SYNC_OK = { name: 'Lee Park', email: 'lee@studio.example.org', company: 'North Pictures', songs: 'Song 03',
  project: 'Short film, end credits', media: 'Film', territory: 'Worldwide', term: '1 year', timeline: 'March',
  budget: '', notes: '' };

(async () => {
  const Z = load();

  // ---- source rules (C-4, FR-04b, FR-10, FR-11) ----
  ok(!/innerHTML|insertAdjacentHTML|outerHTML|document\.write|\beval\b|new Function|setAttribute\(\s*['"]on/.test(SRC), 'no HTML sinks or eval');
  ok(!/—/.test(SRC), 'no em dash');
  ok(!/\b(he|him|his|she|her|hers)\b/i.test(SRC), 'no gendered pronoun');
  const emails = SRC.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [];
  ok(emails.length > 0 && emails.every(e => e === 'daniel.vizkaino@gmail.com'), 'only daniel.vizkaino@gmail.com ' + emails);
  ok(!/console\.|\blocation\b|localStorage|sessionStorage|addEventListener\(\s*['"]message|postMessage/.test(SRC), 'no console, no URL override channel');
  ok(!/createElement\(\s*['"](script|link|iframe|img)|fonts\.googleapis|@import|@font-face/.test(SRC), 'loads no other script or font');
  ok(!/RegExp\(/.test(SRC), 'no RegExp built at run time');
  const reOf = s => s.match(/EMAIL_RE = (\/.*\/);/)[1];
  same(reOf(SRC), reOf(SYNC_SRC), 'email regex identical to sync-core.js (FR-02a)');

  // ---- constants ----
  same([Z.CONFIG_URL, Z.PRIVACY_URL, Z.EMAIL, Z.MIN_FILL_MS, Z.HONEYPOT],
    ['https://dcvizcayno.github.io/danyeloz-embeds/data/forms.json', 'https://www.danyeloz.info/about/privacy',
      'daniel.vizkaino@gmail.com', 3000, 'website'], 'constants (PRIVACY_URL per D-2)');
  ok(Object.isFrozen(Z.FIELDS) && Object.isFrozen(Z.FIELDS.contact[3].choices), 'FIELDS frozen');

  // ---- FIELDS = plan.md section 4 ----
  const row = f => [f.key, f.label, f.type, f.required, f.max, f.help || '', f.choices ? f.choices.join(';') : '', f.control || ''];
  same(Z.FIELDS.contact.map(row), [
    ['first_name', 'First name', 'text', true, 60, '', '', ''],
    ['last_name', 'Last name', 'text', true, 60, '', '', ''],
    ['email', 'Email', 'email', true, 254, '', '', ''],
    ['topic', 'What would you like to contact me about?', 'choice', true, 0, '', 'Fan Contact;Music Collaborations;Beat Licensing & Instrumentals;Sync & Licensing;Media & Business Inquiries;General Inquiries', 'radio'],
    ['subject', 'Subject', 'text', true, 120, '', '', ''],
    ['message', 'Message', 'long', true, 4000, 'Tell me how I can help.', '', '']], 'contact fields');
  same(Z.FIELDS.sync.map(row), [
    ['name', 'Name', 'text', true, 120, '', '', ''],
    ['email', 'Email', 'email', true, 254, '', '', ''],
    ['company', 'Company or production', 'text', true, 120, '', '', ''],
    ['songs', 'Song or songs', 'text', true, 500, '', '', ''],
    ['project', 'Project', 'long', true, 1500, 'Title and a short description of the scene or use.', '', ''],
    ['media', 'Media type', 'choice', true, 0, '', 'Film;TV or streaming series;Advertising or commercial;Trailer or promo;Video game;Online video or social media;Podcast;Corporate or event;Other', 'select'],
    ['territory', 'Territory', 'text', true, 120, 'For example: Worldwide, or US only.', '', ''],
    ['term', 'Term', 'text', true, 120, 'For example: 1 year, or perpetual.', '', ''],
    ['timeline', 'Timeline', 'text', true, 120, 'When you need the license.', '', ''],
    ['budget', 'Budget range', 'choice', false, 0, '', 'Under $500;$500 to $2,000;$2,000 to $10,000;Over $10,000;Not sure yet', 'select'],
    ['notes', 'Notes', 'long', false, 2000, '', '', '']], 'sync fields');

  // ---- validConfig (C-4, FR-04a) ----
  const c = Z.validConfig(FIXTURE, 'contact'), s = Z.validConfig(FIXTURE, 'sync');
  same(c, { action: FIXTURE.forms.contact.action, fields: FIXTURE.forms.contact.fields }, 'fixture contact accepted');
  same(s, { action: FIXTURE.forms.sync.action, fields: FIXTURE.forms.sync.fields }, 'fixture sync accepted');
  const ID = '1FAIpQLSfTESTcontactFORMid0000000000';
  const withAction = a => { const x = clone(FIXTURE); x.forms.contact.action = a; return x; };
  const badActions = {
    http: 'http://docs.google.com/forms/d/e/' + ID + '/formResponse',
    otherHost: 'https://docs.google.com.evil.io/forms/d/e/' + ID + '/formResponse',
    userinfo: 'https://docs.google.com@evil.io/forms/d/e/' + ID + '/formResponse',
    userinfo2: 'https://x@docs.google.com/forms/d/e/' + ID + '/formResponse',
    viewform: 'https://docs.google.com/forms/d/e/' + ID + '/viewform',
    query: 'https://docs.google.com/forms/d/e/' + ID + '/formResponse?x=1',
    hash: 'https://docs.google.com/forms/d/e/' + ID + '/formResponse#x',
    port: 'https://docs.google.com:443/forms/d/e/' + ID + '/formResponse',
    noE: 'https://docs.google.com/forms/d/' + ID + '/formResponse',
    shortId: 'https://docs.google.com/forms/d/e/abc123/formResponse',
    longId: 'https://docs.google.com/forms/d/e/' + 'a'.repeat(121) + '/formResponse',
    badIdChar: 'https://docs.google.com/forms/d/e/' + ID + '%2e/formResponse',
    dotSegment: 'https://docs.google.com/forms/d/e/../e/' + ID + '/formResponse',
    upperHost: 'https://DOCS.google.com/forms/d/e/' + ID + '/formResponse',
    js: 'javascript:alert(1)//docs.google.com/forms/d/e/' + ID + '/formResponse',
    trailingSpace: 'https://docs.google.com/forms/d/e/' + ID + '/formResponse ',
    newline: 'https://docs.google.com/forms/d/e/' + ID + '/formResponse\n',
    notString: 42
  };
  Object.keys(badActions).forEach(k => {
    ok(Z.validConfig(withAction(badActions[k]), 'contact') === null, 'rejects action ' + k);
    ok(Z.validAction(badActions[k]) === false, 'validAction rejects ' + k);
  });
  ok(Z.validAction('https://docs.google.com/forms/d/e/' + 'a'.repeat(120) + '/formResponse'), '120-char id accepted');
  const mutate = fn => { const x = clone(FIXTURE); fn(x); return x; };
  const badCfg = {
    missingKey: mutate(x => { delete x.forms.contact.fields.subject; }),
    entryShort: mutate(x => { x.forms.contact.fields.email = 'entry.123'; }),
    entryLong: mutate(x => { x.forms.contact.fields.email = 'entry.1234567890123'; }),
    entryWord: mutate(x => { x.forms.contact.fields.email = 'email'; }),
    entrySuffix: mutate(x => { x.forms.contact.fields.email = 'entry.1000000003_sentinel'; }),
    entryNumber: mutate(x => { x.forms.contact.fields.email = 1000000003; }),
    duplicate: mutate(x => { x.forms.contact.fields.last_name = x.forms.contact.fields.first_name; }),
    version2: mutate(x => { x.version = 2; }),
    versionString: mutate(x => { x.version = '1'; }),
    fieldsArray: mutate(x => { x.forms.contact.fields = Object.values(x.forms.contact.fields); }),
    noForms: { version: 1 },
    formsArray: { version: 1, forms: [] },
    empty: {}, array: [], nul: null, str: '{"version":1}', num: 1
  };
  Object.keys(badCfg).forEach(k => ok(Z.validConfig(badCfg[k], 'contact') === null, 'rejects config ' + k));
  ok(Z.validConfig(FIXTURE, 'other') === null && Z.validConfig(FIXTURE, 'constructor') === null && Z.validConfig(FIXTURE, '__proto__') === null, 'unknown form keys rejected');
  const halfBad = mutate(x => { x.forms.sync.action = badActions.viewform; });
  ok(Z.validConfig(halfBad, 'sync') === null && j(Z.validConfig(halfBad, 'contact')) === j(c), 'a bad sync block does not void contact');
  const halfBad2 = mutate(x => { delete x.forms.contact; });
  ok(Z.validConfig(halfBad2, 'contact') === null && j(Z.validConfig(halfBad2, 'sync')) === j(s), 'a missing contact block does not void sync');
  const extra = mutate(x => { x.forms.contact.fields.website = 'entry.9999999999'; x.forms.contact.fields.cc = 'entry.8888888888'; x.extra = 'y'; });
  same(Z.validConfig(extra, 'contact'), c, 'extra keys ignored and dropped');

  // ---- validate (C-4) ----
  same(Z.validate('contact', CONTACT_OK), { ok: true, errors: {} }, 'valid contact');
  same(Z.validate('sync', SYNC_OK), { ok: true, errors: {} }, 'valid sync, optional empty');
  same(Z.validate('contact', {}).errors, { first_name: 'Please fill this in.', last_name: 'Please fill this in.', email: 'Please fill this in.',
    topic: 'Please choose one.', subject: 'Please fill this in.', message: 'Please fill this in.' }, 'all required errors');
  same(Z.validate('contact', Object.assign({}, CONTACT_OK, { first_name: '   ' })).errors, { first_name: 'Please fill this in.' }, 'whitespace only is empty');
  ['a@b', 'a b@c.com', '"x"@y.com', '<a@b.com>', 'a@b.com\nBcc: x@evil.io', 'a%40b.com', 'a@b.c', 'a(b)@c.com', 'a@b..com'].forEach(e =>
    same(Z.validate('contact', Object.assign({}, CONTACT_OK, { email: e })).errors, { email: 'Please enter a valid email address.' }, 'invalid email ' + j(e)));
  ok(Z.validate('contact', Object.assign({}, CONTACT_OK, { email: '  ana@example.com  ' })).ok, 'email trimmed');
  same(Z.validate('contact', Object.assign({}, CONTACT_OK, { topic: 'Fan Contact\nX' })).errors, { topic: 'Please choose one.' }, 'choice not in list');
  same(Z.validate('contact', Object.assign({}, CONTACT_OK, { topic: 'fan contact' })).errors, { topic: 'Please choose one.' }, 'choice is case exact');
  same(Z.validate('sync', Object.assign({}, SYNC_OK, { budget: 'A lot' })).errors, { budget: 'Please choose one.' }, 'optional choice must be in list');
  ok(Z.validate('sync', Object.assign({}, SYNC_OK, { budget: '$500 to $2,000', media: 'Other' })).ok, 'valid optional choice');
  ['contact', 'sync'].forEach(k => Z.FIELDS[k].filter(f => f.max).forEach(f => {
    const base = k === 'contact' ? CONTACT_OK : SYNC_OK;
    const at = f.type === 'email' ? 'a'.repeat(f.max - 12) + '@example.com' : 'x'.repeat(f.max);
    const over = f.type === 'email' ? 'a'.repeat(f.max - 11) + '@example.com' : 'x'.repeat(f.max + 1);
    ok(Z.validate(k, Object.assign({}, base, { [f.key]: at })).ok, k + '.' + f.key + ' at max ' + f.max + ' ok');
    same(Z.validate(k, Object.assign({}, base, { [f.key]: over })).errors, { [f.key]: 'Please keep this under ' + f.max + ' characters.' }, k + '.' + f.key + ' over max');
  }));
  same(Z.validate('nope', CONTACT_OK).ok, false, 'unknown form invalid');

  // ---- encode (C-4) ----
  const pc = Z.encode('contact', c, Object.assign({ website: 'spam', extra: 'x' }, CONTACT_OK, { subject: '  Hello  ' }));
  same([...pc.entries()], [['entry.1000000001', 'Ana'], ['entry.1000000002', 'Cruz'], ['entry.1000000003', 'ana.cruz+band@example.com'],
    ['entry.1000000004', 'Sync & Licensing'], ['entry.1000000005', 'Hello'], ['entry.1000000006', 'Line one\nLine two']], 'contact encode: mapped ids only, trimmed');
  const ps = Z.encode('sync', s, Object.assign({ website: 'x' }, SYNC_OK));
  same([...ps.keys()], ['entry.2000000001', 'entry.2000000002', 'entry.2000000003', 'entry.2000000004', 'entry.2000000005',
    'entry.2000000006', 'entry.2000000007', 'entry.2000000008', 'entry.2000000009'], 'sync encode: empty optionals not sent');
  ok(!/website|spam/.test(ps.toString() + pc.toString()), 'honeypot never encoded');
  const pAll = Z.encode('sync', s, Object.assign({}, SYNC_OK, { budget: 'Not sure yet', notes: 'n' }));
  same([...pAll.keys()].length, 11, 'all 11 sync entry ids when optionals filled');
  same(Z.encode('sync', Z.validConfig(extra, 'contact'), SYNC_OK).toString(), 'entry.1000000003=lee%40studio.example.org', 'cfg without a mapping for a field never sends it (only the shared email key maps)');
  same(Z.encode('contact', { fields: { first_name: 'name=x&y', last_name: 'entry.1000000002' } }, CONTACT_OK).toString(), 'entry.1000000002=Cruz', 'a malformed entry id is never sent');
  ok(Z.encode('contact', c, { first_name: '<img src=x onerror=alert(1)>' }).get('entry.1000000001') === '<img src=x onerror=alert(1)>', 'planted HTML encoded as literal text');

  // ---- submit (C-4, FR-11) ----
  let calls = 0;
  const Zc = load(null, null, () => { calls++; return Promise.resolve({}); });
  for (const k of Object.keys(badActions)) {
    let refused = false;
    await Zc.submit(badActions[k], new URLSearchParams('a=1')).catch(() => { refused = true; });
    ok(refused, 'submit refuses ' + k);
  }
  same(calls, 0, 'submit never calls fetch for a refused action');
  const log = [];
  const Zs = load({}, log);
  same(await Zs.submit(c.action, pc), true, 'submit resolves when sent');
  same(log.posts.length, 1, 'one POST');
  const init = log.posts[0].init;
  same([log.posts[0].url, init.method, init.mode, init.credentials, init.referrerPolicy, log.posts[0].body],
    [c.action, 'POST', 'no-cors', 'omit', 'no-referrer', pc.toString()], 'POST options and body');
  ok(!('headers' in init), 'no custom headers');
  let failed = false;
  await load(null, null, () => Promise.reject(new TypeError('Failed to fetch'))).submit(c.action, pc).catch(() => { failed = true; });
  ok(failed, 'submit rejects when fetch fails');

  // ---- loadConfig ----
  const cfgCalls = [];
  const Zl = load('fixture', null, (u, i) => { cfgCalls.push([u, i]); return mock.fetchStub({}, null, { forms: 'fixture' })(u, i); });
  const raw = await Zl.loadConfig();
  same(raw, FIXTURE, 'loadConfig returns the fixture');
  await Zl.loadConfig();
  same(cfgCalls.length, 1, 'config fetched once per page');
  same([cfgCalls[0][0], cfgCalls[0][1].cache, cfgCalls[0][1].credentials], [Z.CONFIG_URL, 'no-store', 'omit'], 'config fetch options');
  same(await load({ forms: 404 }).loadConfig(), null, '404 -> null');
  same(await load({}).loadConfig(), {}, 'default mock {} -> {} (invalid for validConfig)');
  same(Z.validConfig({}, 'contact'), null, '{} invalid');
  same(await load(null, null, () => Promise.reject(new Error('offline'))).loadConfig(), null, 'network error -> null');
  same(await load(null, null, () => Promise.resolve({ ok: true, json: () => Promise.reject(new SyntaxError('bad')) })).loadConfig(), null, 'bad JSON -> null');
  same(await load(null, null, () => Promise.resolve({ ok: true, json: () => Promise.resolve([1]) })).loadConfig(), null, 'array -> null');

  // ---- mock harness ----
  same([mock.resolve(mock.FORMS_CONFIG_URL).status, mock.resolve(mock.FORMS_CONFIG_URL).body], [200, '{}'], 'mock default config 200 {}');
  same(JSON.parse(mock.resolve(mock.FORMS_CONFIG_URL, {}, { forms: 'fixture' }).body), FIXTURE, 'mock fixture config');
  same(mock.resolve(mock.FORMS_CONFIG_URL, {}, { forms: 404 }).status, 404, 'mock 404 config');
  same(JSON.parse(mock.resolve(mock.FORMS_CONFIG_URL, {}, { forms: { version: 2 } }).body), { version: 2 }, 'mock object config');
  same(mock.resolve(mock.FORMS_CORE_URL).body, SRC, 'mock serves forms-core.js');
  ok(typeof mock.sandboxPage === 'function', 'mock exports sandboxPage');

  // ---- FIELDS vs FormsSetup.gs FS_FORMS (when T-003 has landed) ----
  if (!fs.existsSync(GS)) console.log('NOTICE: apps-script/FormsSetup.gs not found; FIELDS vs FS_FORMS cross-check skipped (rerun after T-003).');
  else {
    const gs = fs.readFileSync(GS, 'utf8');
    ok(/^const FS_FORMS = /m.test(gs), 'FormsSetup.gs declares FS_FORMS');
    const gctx = vm.createContext({});
    vm.runInContext(gs, gctx, { filename: 'FormsSetup.gs' });   // top level only declares constants and functions
    const spec = vm.runInContext('FS_FORMS', gctx);
    for (const k of ['contact', 'sync']) {
      const list = spec[k] && spec[k].fields;
      ok(Array.isArray(list), 'FS_FORMS.' + k + '.fields is a list');
      const norm = f => [f.key, f.label, f.type, !!f.required, (f.choices || []).join(';'), f.max || 0, f.help || ''];
      same(list.map(norm), Z.FIELDS[k].map(f => [f.key, f.label, f.type, f.required, (f.choices || []).join(';'), f.max, f.help || '']), 'FIELDS.' + k + ' equals FS_FORMS.' + k);
    }
  }

  // ---- browser smoke of render (Playwright, mock only) ----
  const { chromium } = require('playwright');
  const browser = await chromium.launch();
  try {
    const PAGE = mock.ORIGIN + 'ozf-smoke.html';
    const open = async (forms, script) => {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      page.on('dialog', d => { errors.push('dialog ' + d.message()); d.dismiss(); });
      const plog = await mock.route(page, {}, { forms });
      await page.route(PAGE, r => r.fulfill({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><html><head>' +
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div>' +
        '<script src="' + mock.FORMS_CORE_URL + '"></script><script>' + script + '</script></body></html>' }));
      await page.goto(PAGE);
      return { ctx, page, errors, plog };
    };
    // contact with the fixture: errors, fill time, valid send
    let t = await open('fixture', "window.h = OZForms.render(document.getElementById('root'), 'contact');");
    await t.page.waitForSelector('.ozf form');
    const shape = await t.page.evaluate(() => ({ h: document.querySelector('.ozf-h').textContent, n: document.querySelectorAll('.ozf-f').length,
      priv: [document.querySelector('.ozf-privacy a').getAttribute('href'), document.querySelector('.ozf-privacy a').getAttribute('rel')],
      hp: [document.querySelector('.ozf-hp').getAttribute('aria-hidden'), document.querySelector('input[name=website]').getAttribute('tabindex')],
      radios: document.querySelectorAll('input[type=radio]').length, wide: document.documentElement.scrollWidth <= document.documentElement.clientWidth }));
    same(shape, { h: 'Contact & Collaborations', n: 6, priv: ['https://www.danyeloz.info/about/privacy', 'noopener noreferrer'], hp: ['true', '-1'], radios: 6, wide: true }, 'render: heading, 6 fields, privacy link, honeypot, no sideways scroll at 390');
    await t.page.click('.ozf-send');
    same(await t.page.$$eval('.ozf-err', es => es.map(e => e.textContent).filter(Boolean).length), 6, 'empty submit: 6 errors');
    ok(await t.page.evaluate(() => document.activeElement.name === 'first_name'), 'focus on first invalid field');
    const PLANT = '<img src=x onerror=alert(1)>';
    for (const k of ['first_name', 'last_name', 'subject', 'message']) await t.page.fill('[name=' + k + ']', PLANT);
    await t.page.fill('[name=email]', 'ana@example.com');
    await t.page.check('input[type=radio][value="Sync & Licensing"]');
    await t.page.click('.ozf-send');
    same(await t.page.textContent('.ozf-status'), 'Please take a moment to check your message, then press Send again.', 'under 3 s: fill-time status');
    same(t.plog.posts.length, 0, 'under 3 s: no POST');
    await t.page.waitForTimeout(3100);
    await t.page.click('.ozf-send');
    await t.page.waitForSelector('.ozf-ok');
    same(await t.page.textContent('.ozf-ok'), 'Thank you. Your message is on its way, and I will reply to the email you gave me.', 'success text');
    same(t.plog.posts.length, 1, 'one POST');
    const body = new URLSearchParams(t.plog.posts[0].body);
    same([t.plog.posts[0].url, body.get('entry.1000000001'), body.get('entry.1000000004'), [...body.keys()].length],
      [FIXTURE.forms.contact.action, PLANT, 'Sync & Licensing', 6], 'POST body: literal planted text, 6 ids');
    ok(!t.plog.posts[0].headers.cookie && !t.plog.posts[0].headers.referer, 'no cookie, no referer on the POST');
    same(await t.page.$$('img'), [], 'planted HTML never became an element');
    same(t.errors, [], 'no page errors or dialogs');
    await t.ctx.close();
    // honeypot: success, no POST
    t = await open('fixture', "OZForms.render(document.getElementById('root'), 'contact');");
    await t.page.waitForSelector('.ozf form');
    await t.page.fill('[name=first_name]', 'A'); await t.page.fill('[name=last_name]', 'B'); await t.page.fill('[name=email]', 'a@b.co');
    await t.page.check('input[type=radio][value="Fan Contact"]'); await t.page.fill('[name=subject]', 'S'); await t.page.fill('[name=message]', 'M');
    await t.page.evaluate(() => { document.querySelector('input[name=website]').value = 'http://spam'; });
    await t.page.click('.ozf-send');
    await t.page.waitForSelector('.ozf-ok');
    same(t.plog.posts.length, 0, 'honeypot: success shown, no POST');
    await t.ctx.close();
    // default mock ({}): email fallback
    t = await open(undefined, "OZForms.render(document.getElementById('root'), 'contact');");
    await t.page.waitForSelector('.ozf-fallback');
    same(await t.page.evaluate(() => [document.querySelector('.ozf-fallback p').textContent, document.querySelector('.ozf-mail').textContent,
      document.querySelector('.ozf-copy').textContent, !!document.querySelector('.ozf form')]),
    ['The form is not available right now. Please email me at', 'daniel.vizkaino@gmail.com', 'Copy email', false], 'invalid config: email fallback');
    same(t.plog.posts.length, 0, 'fallback: no POST');
    await t.ctx.close();
    // sync: onUnavailable, then prefill with the fixture
    t = await open(404, "window.un = 0; OZForms.render(document.getElementById('root'), 'sync', {onUnavailable: function () { window.un++; }});");
    await t.page.waitForFunction(() => window.un === 1);
    same(await t.page.$$('.ozf'), [], 'onUnavailable: node removed, no fallback drawn');
    await t.ctx.close();
    t = await open('fixture', "OZForms.render(document.getElementById('root'), 'sync', {prefill: {songs: 'Song <b>03</b>', website: 'x'}, turnaround: '5 days'});");
    await t.page.waitForSelector('.ozf form');
    same(await t.page.evaluate(() => [document.querySelector('[name=songs]').value, document.querySelector('[name=website]').value,
      document.querySelector('[name=budget]').options[0].textContent, document.querySelector('label[for$="-budget"]').textContent]),
    ['Song <b>03</b>', '', 'Choose one', 'Budget range (optional)'], 'sync: prefill as text, honeypot not prefillable, select, optional label');
    await t.ctx.close();
  } finally { await browser.close(); }

  console.log('test_formscore: ' + count + ' checks');
  console.log('PASSED');
})().catch(e => { console.error(e); process.exit(1); });
