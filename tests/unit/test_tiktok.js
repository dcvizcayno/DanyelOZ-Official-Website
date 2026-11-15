// Node tests for TikTok.gs (with Code.gs and Shorts.gs) against a fake TikTok. Nothing reaches the real TikTok.
const fs = require('fs'), vm = require('vm'), assert = require('assert');
const DIR = process.argv[2];
const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);

function makeSheet(name, data) {
  return {
    name, data,
    getName() { return this.name; }, setName(n) { this.name = n; },
    getLastRow() { return this.data.filter(r => r.some(v => v !== '' && v != null)).length ? this.data.length : 0; },
    getLastColumn() { return this.data.length ? Math.max(...this.data.map(r => r.length)) : 0; },
    getRange(r, c, nr = 1, nc = 1) {
      const sh = this;
      return {
        getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((sh.data[r - 1 + i] || [])[c - 1 + j] ?? ''))); },
        setValues(v) { v.forEach((row, i) => { while (sh.data.length < r + i) sh.data.push([]); row.forEach((x, j) => { sh.data[r - 1 + i][c - 1 + j] = x; }); }); return this; },
        setValue(x) { while (sh.data.length < r) sh.data.push([]); sh.data[r - 1][c - 1] = x; return this; },
        setNumberFormat() { return this; }, setFontWeight() { return this; },
      };
    },
    setFrozenRows() {},
    getParent() { return book; },
  };
}

const SHORT_HEAD = ['short_id', 'song_id', 'song_title', 'drive_file_id', 'file_name', 'size_mb', 'scheduled_date', 'scheduled_time', 'yt', 'tt', 'ig', 'status', 'angle',
  'yt_title', 'yt_description', 'yt_tags', 'tt_caption', 'tt_tags', 'ig_caption', 'ig_tags', 'yt_video_id', 'created_at', 'updated_at', 'series_id', 'part'];
const short = (id, title, file, date, time, tt, caption) => {
  const o = { short_id: id, song_title: title, drive_file_id: file, file_name: file + '.mp4', scheduled_date: date, scheduled_time: time, tt: tt ? 'TRUE' : 'FALSE',
              yt: 'FALSE', ig: 'FALSE', status: 'Scheduled', tt_caption: caption, tt_tags: '#DanyelOZ #NewMusic' };
  return SHORT_HEAD.map(h => o[h] ?? '');
};
const shortsTab = makeSheet('shorts', [SHORT_HEAD,
  short('S1', 'Onsra', 'VID1', '2026-11-16', '18:00', true, 'A word for loving someone you know you will lose.'),
  short('S2', 'Carmen', 'VID2', '2026-11-16', '17:00', true, 'Carmen, late at night.'),
  short('S3', 'Hearts', 'VID3', '2099-01-01', '19:00', true, 'Hearts.'),
  short('S4', 'No TikTok', 'VID1', '2026-11-16', '17:00', false, 'nope'),
  short('S5', 'Big', 'BIG', '2026-11-16', '17:00', true, 'big file'),
  short('S6', 'Empty', 'ZERO', '2026-11-16', '17:00', true, 'still uploading')]);
const book = { id: 'BOOK1', getId() { return this.id; }, getUrl() { return 'https://docs.google.com/spreadsheets/d/BOOK1'; },
  sheets: [shortsTab], getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }, getSheets() { return this.sheets; },
  insertSheet(n) { const s = makeSheet(n, []); this.sheets.push(s); return s; } };
const props = { SHORTS_SHEET_ID: 'BOOK1' };
const cache = {};
let triggers = [];
const files = {};
const mkFile = (id, mb) => files[id] = { getSize: () => Math.round(mb * 1048576), getMimeType: () => 'video/mp4', getBlob: () => ({ getBytes: () => ({ len: Math.round(mb * 1048576) }) }) };
mkFile('VID1', 8.5); mkFile('VID2', 3); mkFile('VID3', 4); mkFile('BIG', 61); mkFile('ZERO', 0);

// ---- fake TikTok ----
const tk = { calls: [], creator: { creator_nickname: 'Danyel OZ', creator_username: 'danyeloz', privacy_level_options: ['PUBLIC_TO_EVERYONE', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
  comment_disabled: false, duet_disabled: true, stitch_disabled: false, max_video_post_duration_sec: 600 }, initError: null, status: 'PROCESSING_UPLOAD', refreshN: 0, nextPublish: 1 };
const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => JSON.stringify(body) });
const ok = data => resp(200, { data, error: { code: 'ok', message: '', log_id: 'L' } });
const UrlFetchApp = { fetch(url, opt = {}) {
  tk.calls.push({ url, opt });
  if (url === 'https://open.tiktokapis.com/v2/oauth/token/') {
    const f = Object.fromEntries(opt.payload.split('&').map(kv => kv.split('=').map(decodeURIComponent)));
    assert.strictEqual(f.client_key, 'CK'); assert.strictEqual(f.client_secret, 'CS');
    if (f.grant_type === 'authorization_code') {
      if (f.code !== 'GOOD') return resp(400, { error: 'invalid_grant', error_description: 'Authorization code is expired.' });
      assert.strictEqual(f.redirect_uri, 'https://script.google.com/macros/s/APP/exec');
      return resp(200, { access_token: 'A1', expires_in: 7200, refresh_token: 'R1', refresh_expires_in: 15552000, open_id: 'OID', scope: tk.scope || 'user.info.basic,video.publish' });
    }
    tk.refreshN++;
    assert.strictEqual(f.refresh_token, 'R' + tk.refreshN, 'sends the latest refresh token');
    return resp(200, { access_token: 'A' + (tk.refreshN + 1), expires_in: 7200, refresh_token: 'R' + (tk.refreshN + 1), refresh_expires_in: 15552000, open_id: 'OID', scope: 'user.info.basic,video.publish' });
  }
  if (url.startsWith('https://upload.tiktokapis.com/')) { return { getResponseCode: () => 201, getContentText: () => '' }; }
  assert.ok(/^Bearer A\d+$/.test(opt.headers.Authorization), 'bearer token');
  const body = opt.payload ? JSON.parse(opt.payload) : {};
  if (url.endsWith('/v2/post/publish/creator_info/query/')) return ok(tk.creator);
  if (url.endsWith('/v2/post/publish/video/init/')) {
    tk.lastInit = body;
    if (tk.initError) return resp(403, { data: {}, error: { code: tk.initError, message: 'nope', log_id: 'L2' } });
    const id = 'v_pub_' + tk.nextPublish++;
    return ok({ publish_id: id, upload_url: 'https://upload.tiktokapis.com/video/?upload_id=' + id });
  }
  if (url.endsWith('/v2/post/publish/status/fetch/')) {
    tk.lastStatus = body;
    // Raw text like TikTok's: a 19-digit number that JSON.parse would round.
    if (tk.status === 'PUBLISH_COMPLETE') return { getResponseCode: () => 200, getContentText: () =>
      '{"data":{"status":"PUBLISH_COMPLETE","publicaly_available_post_id":[7300000000000000001],"uploaded_bytes":1},"error":{"code":"ok","message":"","log_id":"L"}}' };
    return ok(
              tk.status === 'FAILED' ? { status: 'FAILED', fail_reason: 'file_format_check_failed' } : { status: tk.status });
  }
  throw new Error('unexpected fetch ' + url);
} };

let now = Date.parse('2026-11-16T18:30:00+08:00');
class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } }
let uuid = 0;
const logs = [];
const ctx = vm.createContext({
  console: { log(m) { logs.push(String(m)); } }, Date: FakeDate, JSON, Math, String, Number, Object, Array, Boolean, Error, RegExp, encodeURIComponent, decodeURIComponent, isNaN,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => [], getSheetByName: () => null }), openById(id) { if (id !== 'BOOK1') throw new Error('gone'); return book; }, create() { throw new Error('no create'); } },
  DriveApp: { getFileById(id) { if (!files[id]) throw new Error('no file'); return files[id]; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = String(v); }, deleteProperty: k => { delete props[k]; } }) },
  CacheService: { getScriptCache: () => ({ put: (k, v) => { cache[k] = v; }, get: k => cache[k] ?? null, remove: k => { delete cache[k]; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  ScriptApp: {
    getService: () => ({ getUrl: () => 'https://script.google.com/macros/s/APP/exec' }),
    getProjectTriggers: () => triggers.slice(),
    deleteTrigger: t => { triggers = triggers.filter(x => x !== t); },
    newTrigger: fn => ({ timeBased: () => ({ everyMinutes: m => ({ create: () => { const t = { fn, m, getHandlerFunction: () => fn }; triggers.push(t); return t; } }) }) })
  },
  HtmlService: {
    createHtmlOutput: html => ({ html, setTitle(t) { this.title = t; return this; } }),
    createTemplateFromFile: () => ({ evaluate: () => ({ page: 'Form', setTitle() { return this; }, addMetaTag() { return this; } }) })
  },
  Utilities: { getUuid: () => 'state-' + (++uuid), formatDate: () => '2026-11-16T18:30' },
  Session: { getScriptTimeZone: () => 'Asia/Manila' },
  UrlFetchApp
});
['Code.gs', 'Shorts.gs', 'TikTok.gs'].forEach(f => vm.runInContext(fs.readFileSync(DIR + '/' + f, 'utf8'), ctx, { filename: f }));
const ttTab = () => book.getSheetByName('tiktok');
const row = id => { const t = ttTab(); const h = t.data[0]; const r = t.data.find(x => x[0] === id); return r && Object.fromEntries(h.map((k, i) => [k, r[i]])); };

/* ----- not set up ----- */
let p = ctx.getTikTokPanel('S1');
assert.strictEqual(p.configured, false); assert.strictEqual(p.connected, false);
assert.strictEqual(p.redirect, 'https://script.google.com/macros/s/APP/exec');
assert.throws(() => ctx.tiktokAuthUrl(), /TIKTOK_CLIENT_KEY/);
assert.strictEqual(ctx.doGet({ parameter: {} }).page, 'Form', 'plain visits still open the app');
assert.strictEqual(ctx.doGet().page, 'Form');

/* ----- connect ----- */
props.TIKTOK_CLIENT_KEY = 'CK'; props.TIKTOK_CLIENT_SECRET = 'CS';
const url = ctx.tiktokAuthUrl();
const q = new URL(url);
assert.strictEqual(q.origin + q.pathname, 'https://www.tiktok.com/v2/auth/authorize/');
assert.strictEqual(q.searchParams.get('client_key'), 'CK');
assert.strictEqual(q.searchParams.get('scope'), 'user.info.basic,video.publish');
assert.strictEqual(q.searchParams.get('response_type'), 'code');
assert.strictEqual(q.searchParams.get('redirect_uri'), 'https://script.google.com/macros/s/APP/exec');
const state = q.searchParams.get('state');
assert.ok(cache['tt_state_' + state]);
let pg = ctx.doGet({ parameter: { state: 'forged', code: 'GOOD' } });
assert.ok(/expired/.test(pg.html)); assert.ok(!props.TIKTOK_TOKENS, 'unknown state never connects');
pg = ctx.doGet({ parameter: { state, error: 'access_denied', error_description: '<script>alert(1)</script>' } });
assert.ok(!/<script>/.test(pg.html) && /&lt;script&gt;/.test(pg.html), 'TikTok text is escaped');
const state2 = new URL(ctx.tiktokAuthUrl()).searchParams.get('state');
pg = ctx.doGet({ parameter: { state: state2, code: 'GOOD' } });
assert.ok(/TikTok is connected/.test(pg.html), pg.html);
assert.strictEqual(JSON.parse(props.TIKTOK_TOKENS).refresh, 'R1');
assert.ok(/expired/.test(ctx.doGet({ parameter: { state: state2, code: 'GOOD' } }).html), 'a state works once');

/* ----- panel ----- */
p = ctx.getTikTokPanel('S1');
assert.strictEqual(p.connected, true); assert.strictEqual(p.error, '');
eq(p.creator.privacy.map(o => o.label), ['Everyone', 'Friends', 'Only me']);
assert.strictEqual(p.creator.duetOff, true); assert.strictEqual(p.post, null); assert.strictEqual(p.autoPost, false);

/* ----- approve: TikTok's rules ----- */
assert.throws(() => ctx.approveTikTok('S1', {}), /Choose who can see it/);
assert.throws(() => ctx.approveTikTok('S1', { privacy: 'FOLLOWER_OF_CREATOR' }), /isn’t available/);
assert.throws(() => ctx.approveTikTok('S1', { privacy: 'SELF_ONLY', commercial: true, brand_content: true }), /can’t be private/);
assert.throws(() => ctx.approveTikTok('S1', { privacy: 'PUBLIC_TO_EVERYONE', commercial: true }), /Your brand, Branded content/);
assert.throws(() => ctx.approveTikTok('S4', { privacy: 'PUBLIC_TO_EVERYONE' }), /Tick TikTok/);
let a = ctx.approveTikTok('S1', { privacy: 'PUBLIC_TO_EVERYONE', allow_comment: true, allow_duet: true, allow_stitch: false, commercial: true, brand_organic: true });
assert.strictEqual(a.status, 'Approved');
assert.strictEqual(a.allow_comment, true); assert.strictEqual(a.allow_duet, false, 'duet off in creator settings stays off'); assert.strictEqual(a.brand_organic, true);
assert.strictEqual(row('S1').allow_comment, 'TRUE');
assert.throws(() => ctx.postTikTokNow('S2'), /Approve this Short/);

/* ----- post now ----- */
let r = ctx.postTikTokNow('S1');
assert.strictEqual(r.status, 'Processing', r.error); assert.strictEqual(r.publish_id, 'v_pub_1'); assert.strictEqual(r.username, 'danyeloz');
eq(tk.lastInit, { post_info: { title: 'A word for loving someone you know you will lose.\n\n#DanyelOZ #NewMusic', privacy_level: 'PUBLIC_TO_EVERYONE',
  disable_comment: false, disable_duet: true, disable_stitch: true, brand_organic_toggle: true, brand_content_toggle: false },
  source_info: { source: 'FILE_UPLOAD', video_size: 8912896, chunk_size: 8912896, total_chunk_count: 1 } });
const put = tk.calls.find(c => c.url.startsWith('https://upload.tiktokapis.com/'));
assert.strictEqual(put.opt.method, 'put'); assert.strictEqual(put.opt.headers['Content-Range'], 'bytes 0-8912895/8912896'); assert.strictEqual(put.opt.contentType, 'video/mp4');
assert.throws(() => ctx.postTikTokNow('S1'), /Approve this Short/, 'no double post');
assert.throws(() => ctx.approveTikTok('S1', { privacy: 'SELF_ONLY' }), /already processing/);
assert.throws(() => ctx.cancelTikTok('S1'), /Only a Short waiting/);

/* ----- status ----- */
r = ctx.checkTikTok('S1'); assert.strictEqual(r.status, 'Processing'); eq(tk.lastStatus, { publish_id: 'v_pub_1' });
tk.status = 'PUBLISH_COMPLETE';
r = ctx.checkTikTok('S1'); assert.strictEqual(r.status, 'Posted'); assert.strictEqual(r.url, 'https://www.tiktok.com/@danyeloz/video/7300000000000000001');
assert.throws(() => ctx.checkTikTok('S2'), /Nothing sent/);

/* ----- unaudited app, public account: clear message, then try again ----- */
ctx.approveTikTok('S2', { privacy: 'PUBLIC_TO_EVERYONE' });
tk.initError = 'unaudited_client_can_only_post_to_private_accounts';
r = ctx.postTikTokNow('S2');
assert.strictEqual(r.status, 'Failed'); assert.ok(/hasn’t approved this app yet/.test(r.error), r.error);
tk.initError = null; tk.status = 'PROCESSING_UPLOAD';
r = ctx.postTikTokNow('S2'); assert.strictEqual(r.status, 'Processing', 'Try again works after a failure');

/* ----- token refresh (2-hour access tokens, rotating refresh tokens) ----- */
const tok = JSON.parse(props.TIKTOK_TOKENS); tok.access_exp = now - 1000; props.TIKTOK_TOKENS = JSON.stringify(tok);
ctx.getTikTokPanel('S1');
assert.strictEqual(tk.refreshN, 1); assert.strictEqual(JSON.parse(props.TIKTOK_TOKENS).refresh, 'R2', 'new refresh token saved');
const tok2 = JSON.parse(props.TIKTOK_TOKENS); tok2.access_exp = 0; tok2.refresh_exp = now - 1; props.TIKTOK_TOKENS = JSON.stringify(tok2);
p = ctx.getTikTokPanel('S1'); assert.ok(/expired/.test(p.error), p.error);
tok2.refresh_exp = now + 1e9; tok2.access_exp = now + 7200e3; props.TIKTOK_TOKENS = JSON.stringify(tok2);

/* ----- files TikTok can't take ----- */
ctx.approveTikTok('S5', { privacy: 'SELF_ONLY' }); r = ctx.postTikTokNow('S5');
assert.strictEqual(r.status, 'Failed'); assert.ok(/61 MB/.test(r.error), r.error);
ctx.approveTikTok('S6', { privacy: 'SELF_ONLY' }); r = ctx.postTikTokNow('S6');
assert.ok(/0 MB/.test(r.error), r.error);

/* ----- cancel ----- */
ctx.approveTikTok('S3', { privacy: 'SELF_ONLY' });
assert.strictEqual(ctx.cancelTikTok('S3').status, 'Cancelled');
assert.throws(() => ctx.postTikTokNow('S3'), /Approve this Short/);

/* ----- auto-post timer ----- */
eq(ctx.setTikTokAutoPost(true), { autoPost: true }); assert.strictEqual(triggers.length, 1); assert.strictEqual(triggers[0].m, 15);
ctx.setTikTokAutoPost(true); assert.strictEqual(triggers.length, 1, 'never two timers');
assert.strictEqual(ctx.getTikTokPanel('S1').autoPost, true);
// S3 approved again but due in 2099; S5 re-approved and due; S2 is processing and gets a status check
ctx.approveTikTok('S3', { privacy: 'SELF_ONLY' });
mkFile('BIG', 9); ctx.approveTikTok('S5', { privacy: 'SELF_ONLY' });
tk.status = 'PUBLISH_COMPLETE';
let run = ctx.ttAutoPost();
assert.strictEqual(run.posted, 1, JSON.stringify(run));
assert.strictEqual(row('S2').status, 'Posted', 'processing post checked');
assert.strictEqual(row('S5').status, 'Processing'); assert.strictEqual(row('S3').status, 'Approved', 'future Short waits');
now = Date.parse('2099-01-01T19:05:00+08:00');
const tok3 = JSON.parse(props.TIKTOK_TOKENS); tok3.access_exp = now + 7200e3; tok3.refresh_exp = now + 1e9; props.TIKTOK_TOKENS = JSON.stringify(tok3);
run = ctx.ttAutoPost(); assert.strictEqual(row('S3').status, 'Processing', row('S3').error);
assert.strictEqual(row('S6').status, 'Failed', 'failed posts are not retried on their own');
// at most 2 posts per run
['S1', 'S2'].forEach(id => { const t = ttTab(); const h = t.data[0]; const rr = t.data.find(x => x[0] === id); rr[h.indexOf('status')] = 'Approved'; });
['S6'].forEach(id => { mkFile('ZERO', 2); ctx.approveTikTok(id, { privacy: 'SELF_ONLY' }); });
run = ctx.ttAutoPost(); assert.strictEqual(run.posted, 2, 'two per run, the rest next time');

/* ----- disconnect ----- */
ctx.disconnectTikTok();
assert.ok(!props.TIKTOK_TOKENS); assert.strictEqual(triggers.length, 0);
eq(ctx.ttAutoPost(), { posted: 0, note: 'not connected' });
p = ctx.getTikTokPanel('S6'); assert.strictEqual(p.connected, false); assert.strictEqual(p.post.status, 'Approved', 'approvals stay');

/* ----- connected without posting permission ----- */
tk.scope = 'user.info.basic';
const s3 = new URL(ctx.tiktokAuthUrl()).searchParams.get('state');
assert.ok(/posting wasn’t allowed/.test(ctx.doGet({ parameter: { state: s3, code: 'GOOD' } }).html));

console.log('ALL TIKTOK TESTS PASSED');
