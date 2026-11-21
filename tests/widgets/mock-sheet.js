// Mock Song Database for the sync widgets. Routes gviz CSV requests by sheet= / gid= to tests/widgets/fixtures/
// and the production sync-core.js URL to the local danyeloz-embeds file. A tab mapped to null (or absent) behaves
// like gviz does for a missing tab: it returns Sheet1.
//   const mock = require('./mock-sheet');
//   mock.resolve(url, tabs)        -> {status, contentType, body} or null (not routed)
//   mock.fetchStub(tabs, log)      -> fetch() replacement for Node (vm) tests
//   await mock.route(page, tabs)   -> Playwright: installs routes, aborts everything else, returns the request log
const fs = require('fs');
const path = require('path');

const FIXTURES = path.join(__dirname, 'fixtures');
const EMBEDS = process.env.EMBEDS_DIR || 'E:/Projects/danyeloz-embeds';
const CORE_URL = 'https://dcvizcayno.github.io/danyeloz-embeds/sync-core.js';
const CORE_FILE = path.join(EMBEDS, 'sync-core.js');
const GVIZ = /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/gviz\/tq\?/;
const DEFAULT_TABS = { Sheet1: 'sheet1.csv', tracks: 'tracks.csv', sync_settings: 'sync_settings.csv' };

function read(file) { return fs.readFileSync(path.join(FIXTURES, file), 'utf8'); }

function resolve(url, tabs) {
  tabs = Object.assign({}, DEFAULT_TABS, tabs || {});
  if (url.split('?')[0] === CORE_URL) return { status: 200, contentType: 'application/javascript', body: fs.readFileSync(CORE_FILE, 'utf8') };
  if (!GVIZ.test(url)) return null;
  const p = new URL(url).searchParams;
  const name = p.get('sheet') || 'Sheet1';
  const file = tabs[name] || tabs.Sheet1;           // missing tab -> Sheet1, as gviz does
  return { status: 200, contentType: 'text/csv', body: read(file) };
}

function fetchStub(tabs, log) {
  return function (url) {
    if (log) log.push(String(url));
    const r = resolve(String(url), tabs);
    if (!r) return Promise.reject(new TypeError('un-routed request ' + url));
    return Promise.resolve({ ok: r.status === 200, status: r.status, text: () => Promise.resolve(r.body) });
  };
}

async function route(page, tabs) {
  const log = [];
  await page.route(/^https?:\/\//, r => {
    const url = r.request().url(); log.push(url);
    const res = resolve(url, tabs);
    if (res) return r.fulfill({ status: res.status, contentType: res.contentType, body: res.body });
    return r.abort();                                // fonts and everything else: no network in tests
  });
  return log;
}

module.exports = { FIXTURES, CORE_URL, CORE_FILE, DEFAULT_TABS, resolve, fetchStub, route };
