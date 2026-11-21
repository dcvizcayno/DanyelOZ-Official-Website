// Mock Song Database and forms backend for the widgets. Routes gviz CSV requests by sheet= / gid= to
// tests/widgets/fixtures/, the production sync-core.js, forms-core.js and contact.html URLs to the local
// danyeloz-embeds files, and the forms config URL (data/forms.json) per the `forms` option. A tab mapped to null
// (or absent) behaves like gviz does for a missing tab: it returns Sheet1.
//   const mock = require('./mock-sheet');
//   mock.resolve(url, tabs, opts)        -> {status, contentType, body} or null (not routed)
//   mock.fetchStub(tabs, log, opts)      -> fetch() replacement for Node (vm) tests; formResponse POSTs go to log.posts
//   await mock.route(page, tabs, opts)   -> Playwright: installs routes, aborts everything else, returns the request
//                                           log (URLs); formResponse POSTs are fulfilled with 200 and kept in log.posts
//   await mock.sandboxPage(browser, width, file, opts) -> the page inside a Google Sites style sandboxed iframe on
//                                           another origin: {ctx, page, frame, errors, navs, popups, log}
// opts.forms: undefined (default) -> 200 '{}' (invalid config: widgets show the email fallback, no network error);
//             'fixture' -> fixtures/forms.json; a number (e.g. 404) -> that status, empty body; an object -> its JSON.
// opts.tabs (sandboxPage only): gviz tab map as above.
const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, 'fixtures');
const EMBEDS = process.env.EMBEDS_DIR || 'E:/Projects/danyeloz-embeds';
const ORIGIN = 'https://dcvizcayno.github.io/danyeloz-embeds/';
const CORE_URL = ORIGIN + 'sync-core.js';
const CORE_FILE = path.join(EMBEDS, 'sync-core.js');
const FORMS_CORE_URL = ORIGIN + 'forms-core.js';
const FORMS_CORE_FILE = path.join(EMBEDS, 'forms-core.js');
const CONTACT_URL = ORIGIN + 'contact.html';
const FORMS_CONFIG_URL = ORIGIN + 'data/forms.json';
const FORMS_FIXTURE = path.join(FIXTURES, 'forms.json');
const GVIZ = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/gviz\/tq\?/;
const FORM_POST = /^https:\/\/docs\.google\.com\/forms\/d\/e\/[\w-]+\/formResponse$/;
const SANDBOX = 'allow-scripts allow-popups allow-forms allow-same-origin';
const HARNESS_URL = 'https://harness.test/';
const DEFAULT_TABS = { Sheet1: 'sheet1.csv', tracks: 'tracks.csv', sync_settings: 'sync_settings.csv' };

function read(file) { return fs.readFileSync(path.join(FIXTURES, file), 'utf8'); }
function local(file, type) {
  if (!fs.existsSync(file)) return { status: 404, contentType: 'text/plain', body: '' };
  return { status: 200, contentType: type, body: fs.readFileSync(file, 'utf8') };
}
function formsConfig(forms) {
  if (forms === undefined || forms === null) return { status: 200, contentType: 'application/json', body: '{}' };
  if (forms === 'fixture') return { status: 200, contentType: 'application/json', body: fs.readFileSync(FORMS_FIXTURE, 'utf8') };
  if (typeof forms === 'number') return { status: forms, contentType: 'text/plain', body: '' };
  return { status: 200, contentType: 'application/json', body: JSON.stringify(forms) };
}

function resolve(url, tabs, opts) {
  tabs = Object.assign({}, DEFAULT_TABS, tabs || {});
  opts = opts || {};
  const bare = url.split('?')[0];
  if (bare === CORE_URL) return { status: 200, contentType: 'application/javascript', body: fs.readFileSync(CORE_FILE, 'utf8') };
  if (bare === FORMS_CORE_URL) return local(FORMS_CORE_FILE, 'application/javascript');
  if (bare === CONTACT_URL) return local(path.join(EMBEDS, 'contact.html'), 'text/html');
  if (bare === FORMS_CONFIG_URL) return formsConfig(opts.forms);
  if (!GVIZ.test(url)) return null;
  const p = new URL(url).searchParams;
  const name = p.get('sheet') || 'Sheet1';
  const file = tabs[name] || tabs.Sheet1;           // missing tab -> Sheet1, as gviz does
  return { status: 200, contentType: 'text/csv', body: read(file) };
}

function fetchStub(tabs, log, opts) {
  if (log && !log.posts) log.posts = [];
  return function (url, init) {
    url = String(url);
    if (log) log.push(url);
    if (init && init.method === 'POST' && FORM_POST.test(url)) {
      if (log) log.posts.push({ url, body: String(init.body), init });
      return Promise.resolve({ ok: false, status: 0, type: 'opaque', text: () => Promise.resolve('') });
    }
    const r = resolve(url, tabs, opts);
    if (!r) return Promise.reject(new TypeError('un-routed request ' + url));
    return Promise.resolve({ ok: r.status === 200, status: r.status, text: () => Promise.resolve(r.body),
      json: () => Promise.resolve().then(() => JSON.parse(r.body)) });
  };
}

// Fulfils a formResponse POST (logged with body and headers) or a routed GET; aborts the rest. Returns the handler.
function handler(log, tabs, opts, extra) {
  return r => {
    const req = r.request(), url = req.url();
    if (extra) { const x = extra(url); if (x) return r.fulfill(x); }
    log.push(url);
    if (req.method() === 'POST' && FORM_POST.test(url)) {
      log.posts.push({ url, body: req.postData() || '', headers: req.headers() });
      return r.fulfill({ status: 200, contentType: 'text/html', body: '<!DOCTYPE html><title>ok</title>' });
    }
    const res = resolve(url, tabs, opts);
    if (res) return r.fulfill({ status: res.status, contentType: res.contentType, body: res.body, headers: { 'Access-Control-Allow-Origin': '*' } });
    return r.abort();                                // fonts and everything else: no network in tests
  };
}

async function route(page, tabs, opts) {
  const log = [];
  log.posts = [];
  await page.route(/^https?:\/\//, handler(log, tabs, opts));
  return log;
}

function harness(file) {
  return '<!DOCTYPE html><html><body style="margin:0"><iframe id="embed" sandbox="' + SANDBOX + '" src="' + ORIGIN + file +
    '" style="border:0;width:100%;height:860px;display:block"></iframe></body></html>';
}

// The page `file` (e.g. 'sync.html', 'contact.html') served at its real https URL from the local danyeloz-embeds
// folder, inside <iframe sandbox="allow-scripts allow-popups allow-forms allow-same-origin"> (no allow-top-navigation,
// no allow-modals) on another origin, the way Google Sites embeds it. No network.
async function sandboxPage(browser, width, file, opts) {
  opts = opts || {};
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  const log = [];
  log.posts = [];
  await ctx.route(/^https?:\/\//, handler(log, opts.tabs, opts, url => {
    if (url === HARNESS_URL) return { status: 200, contentType: 'text/html', body: harness(file) };
    const m = /^https:\/\/dcvizcayno\.github\.io\/danyeloz-embeds\/([\w-]+\.html)(\?.*)?$/.exec(url);
    if (m && fs.existsSync(path.join(EMBEDS, m[1]))) return { status: 200, contentType: 'text/html', body: fs.readFileSync(path.join(EMBEDS, m[1]), 'utf8') };
    return null;
  }));
  const page = await ctx.newPage();
  const errors = [], navs = [], popups = [];
  const watch = p => {
    p.on('pageerror', e => errors.push(String(e)));
    p.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED|net::|Failed to load resource/.test(m.text())) errors.push(m.text()); });
  };
  watch(page);
  ctx.on('page', p => { popups.push(p); watch(p); });
  page.on('framenavigated', f => { if (f !== page.mainFrame()) navs.push(f.url()); });
  await page.goto(HARNESS_URL);
  const frame = await (await page.waitForSelector('#embed')).contentFrame();
  return { ctx, page, frame, errors, navs, popups, log };
}

module.exports = { FIXTURES, EMBEDS, ORIGIN, CORE_URL, CORE_FILE, FORMS_CORE_URL, FORMS_CORE_FILE, CONTACT_URL,
  FORMS_CONFIG_URL, FORMS_FIXTURE, FORM_POST, SANDBOX, DEFAULT_TABS, resolve, fetchStub, route, sandboxPage };
