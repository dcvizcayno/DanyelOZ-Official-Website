// Node tests for Shorts.gs and XPosts.gs with mocked Apps Script services.
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
    deleteRow(r) { this.data.splice(r - 1, 1); },
    setFrozenRows() {},
    getParent() { return book; },
  };
}

const songsSheet = makeSheet('Sheet1', [
  ['song_id', 'song_title', 'release_date', 'release_type', 'song_genre', 'song_description', 'song_ISRC', 'song_qr', 'bandcamp_embed', 'song_arts'],
  ['6799528628', 'Onsra (Kareena)', '2026-11-09', 'Single', 'Pop, Alt R&B',
   'The word Onsra is from the Boro language. It means loving someone while already knowing it won’t last.\n\nI learned it on a trip to India in 2010. This song is what that word felt like.', '', '',
   '<iframe src="https://bandcamp.com/EmbeddedPlayer/album=1/"><a href="https://danyeloz.bandcamp.com/album/onsra-kareena">Onsra</a></iframe>', ''],
  ['111', 'Carmen', '2026-10-26', 'Single', 'Alternative Pop', '', '', '', '<iframe src="https://bandcamp.com/EmbeddedPlayer/album=2/"></iframe>', ''],
  ['222', 'Aubrey', '2026-09-28', 'Single', 'Pop', 'A song about notes in class.', '', '', '', ''],
]);
let created = 0;
const shortsDefault = makeSheet('Sheet1', []);
const book = { id: 'BOOK1', getId() { return this.id; }, getUrl() { return 'https://docs.google.com/spreadsheets/d/BOOK1'; },
  sheets: [shortsDefault], getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }, getSheets() { return this.sheets; },
  insertSheet(n) { const s = makeSheet(n, []); this.sheets.push(s); return s; } };
const props = {};
const files = {};
function makeFile(id, name, mime, sizeMb) {
  return files[id] = { getId: () => id, getName: () => name, getMimeType: () => mime, getSize: () => sizeMb * 1048576,
    getLastUpdated: () => new Date(2026, 10, 9), getBlob: () => ({ name }), getUrl: () => 'https://drive.google.com/file/d/' + id + '/view' };
}
makeFile('VID1', 'onsra_hook_v2.mp4', 'video/mp4', 38.2);
makeFile('VID2', 'carmen_hook.mp4', 'video/mp4', 61);
makeFile('DOC1', 'notes.txt', 'text/plain', 0.1);
const folder = { getUrl: () => 'https://drive.google.com/drive/folders/F', getFiles() { const l = Object.values(files); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
  createFile(blob, content, mime) { const n = typeof blob === 'string' ? blob : blob.name; return makeFile('NEW' + Object.keys(files).length, n, typeof blob === 'string' ? mime : blob.mime, 1); } };

let fetches = [];
const gh = { issues: [], workflow: 'active', comments: [], dispatched: 0 };
gh.issues.push({ number: 2, html_url: 'https://github.com/dcvizcayno/danyeloz-embeds/issues/2', title: 'X draft: NOTE TO SELF', created_at: '2026-11-05T11:07:00Z',
  labels: [{ name: 'x-draft' }], state: 'open',
  body: '**Song:** NOTE TO SELF\n\n> 🧪 **Test mode:** X keys are not set yet.\n\n### Draft post\n<!-- post:start -->\nOld text https://danyeloz.bandcamp.com/track/x\n<!-- post:end -->\n\n### Your call (tick one)\n- [ ] Post\n- [ ] Revise\n\n<!-- meta:{"song": "NOTE TO SELF", "hook": "question", "link": "bandcamp", "version": 1} -->\n' });
const xlog = [{ id: '1', song: 'Carmen', hook: 'story', status: 'posted', test: true, posted_at: '2026-11-01T19:10+08:00', metrics: {} },
              { id: '99', song: 'Onsra (Kareena)', hook: 'question', status: 'posted', test: false, posted_at: '2026-11-08T19:20+08:00', metrics: { impression_count: 120, like_count: 4, reply_count: 1, url_link_clicks: 3 } }];
let geminiMode = 'ok';
function resp(code, body) { return { getResponseCode: () => code, getContentText: () => typeof body === 'string' ? body : JSON.stringify(body) }; }
const UrlFetchApp = { fetch(url, opt = {}) {
  fetches.push([opt.method || 'get', url, opt.payload]);
  if (url.includes('generativelanguage')) {
    if (geminiMode === 'down') return resp(503, { error: { message: 'overloaded' } });
    const p = JSON.parse(opt.payload); assert.ok(p.contents[0].parts[0].text.includes('Onsra'));
    assert.strictEqual(opt.headers['x-goog-api-key'], 'GKEY');
    return resp(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({
      yt_title: 'Loving someone you already know you will lose — Onsra', yt_description: 'Onsra is a Boro word.\n\nI heard it in India in 2010.',
      yt_tags: ['Shorts', 'DanyelOZ', '#Onsra', 'AltPop', 'AltPop', 'RnB'], tt_caption: 'POV: you love someone and you already know how it ends',
      tt_tags: ['#LoveSong', 'fyp'], ig_caption: 'A word for a feeling.\n\nFull song: link in bio (danyeloz.info)', ig_tags: ['music'] }) }] } }] });
  }
  if (url.includes('raw.githubusercontent.com')) return url.includes('x-posts') ? resp(200, xlog) : resp(404, '');
  const u = url.replace('https://api.github.com', '');
  assert.ok(opt.headers.Authorization === 'Bearer TOK', 'token sent');
  const m = opt.method;
  if (u.startsWith('/repos/dcvizcayno/danyeloz-embeds/contents/')) {
    const path = u.split('/contents/')[1];
    const obj = path === 'data/x-posts.json' ? xlog : path === 'x-agent/config.json' ? { experiments: { hook: ['question', 'story', 'invite', 'behind'] }, min_samples: 3, explore_rate: 0.2 } : { hook: { story: { n: 1, score: 2.5 } } };
    return resp(200, { content: Buffer.from(JSON.stringify(obj)).toString('base64').replace(/(.{60})/g, '$1\n') });
  }
  if (u.includes('/issues?labels=x-draft')) return resp(200, gh.issues.filter(i => i.state === 'open'));
  if (u.includes('/issues?labels=x-report')) return resp(200, [{ html_url: 'https://github.com/r/issues/5' }]);
  let mm;
  if ((mm = u.match(/\/issues\/(\d+)$/))) {
    const it = gh.issues.find(i => i.number == mm[1]);
    if (m === 'PATCH') { Object.assign(it, JSON.parse(opt.payload)); return resp(200, it); }
    return resp(200, it);
  }
  if (u.match(/\/issues\/\d+\/comments$/)) { gh.comments.push(JSON.parse(opt.payload).body); return resp(201, {}); }
  if (u.endsWith('/actions/workflows/x-draft.yml')) return resp(200, { state: gh.workflow });
  if (u.endsWith('/disable')) { gh.workflow = 'disabled_manually'; return resp(204, ''); }
  if (u.endsWith('/enable')) { gh.workflow = 'active'; return resp(204, ''); }
  if (u.endsWith('/dispatches')) { gh.dispatched++; return resp(204, ''); }
  throw new Error('unexpected fetch ' + url);
} };

const uploads = [];
const ctx = vm.createContext({
  console: { log() {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => [songsSheet], getSheetByName: n => n === 'Sheet1' ? songsSheet : null }),
    create(n) { created++; book.name = n; return book; }, openById(id) { if (id !== 'BOOK1') throw new Error('gone'); return book; } },
  DriveApp: { getFoldersByName: () => { let d = false; return { hasNext: () => !d, next: () => { d = true; return folder; } }; }, createFolder: () => folder,
    getFileById(id) { if (!files[id]) throw new Error('no file'); return files[id]; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? '2026-11-09' : (f.includes('MMMM') ? 'November 9, 2026' : '2026-11-09T13:30'),
    base64Decode: s => Buffer.from(s, 'base64'), newBlob: (bytes, mime, name) => ({ name, mime, getDataAsString: () => Buffer.from(bytes).toString('utf8') }) },
  Session: { getScriptTimeZone: () => 'Asia/Manila' },
  MimeType: { CSV: 'text/csv', PLAIN_TEXT: 'text/plain' },
  UrlFetchApp,
});
['Code.gs', 'Shorts.gs', 'XPosts.gs'].forEach(f => vm.runInContext(fs.readFileSync(DIR + '/' + f, 'utf8'), ctx, { filename: f }));

/* ----- Shorts: first load creates the private book ----- */
let d = ctx.getShortsData();
assert.strictEqual(created, 1); assert.strictEqual(props.SHORTS_SHEET_ID, 'BOOK1');
assert.strictEqual(shortsDefault.name, 'shorts');
eq(shortsDefault.data[0].slice(0, 3), ['short_id', 'song_id', 'song_title']);
assert.strictEqual(d.songs.length, 3); assert.strictEqual(d.ai, false); assert.strictEqual(d.youtube, false);
assert.strictEqual(d.songs.find(s => s.song_title === 'Carmen').hasStory, false);
ctx.getShortsData(); assert.strictEqual(created, 1, 'opens the same book next time');

const fl = ctx.listShortFiles();
eq(fl.map(f => f.name).sort(), ['carmen_hook.mp4', 'onsra_hook_v2.mp4']);

/* ----- add with template captions ----- */
let r = ctx.addShort({ song_id: '6799528628', drive_file_id: 'VID1', scheduled_date: '2026-11-12', scheduled_time: '19:30', angle: 'story' });
let s = r.short;
assert.strictEqual(r.source, 'template'); assert.strictEqual(s.status, 'Scheduled'); assert.strictEqual(s.yt, true); assert.strictEqual(s.ig, false);
assert.ok(s.yt_title.endsWith(' #Shorts') && s.yt_title.length <= 100, s.yt_title);
assert.ok(s.yt_description.includes('https://danyeloz.bandcamp.com/album/onsra-kareena'), 'bandcamp link from the embed');
assert.ok(s.yt_description.startsWith('The word Onsra is from the Boro language.'));
assert.ok(s.yt_tags.startsWith('#Shorts #DanyelOZ #Onsra'), s.yt_tags);
assert.ok(s.yt_tags.includes('#AltRB') || s.yt_tags.includes('#Pop'));
assert.ok(!/[—]/.test(JSON.stringify(s)), 'no em dashes');
assert.strictEqual(shortsDefault.data.length, 2);
assert.strictEqual(shortsDefault.data[1][shortsDefault.data[0].indexOf('yt')], 'TRUE');

// Song with no story: captions claim nothing
r = ctx.addShort({ song_title: 'Carmen', drive_file_id: 'VID2', angle: 'vocal', ig: true });
assert.strictEqual(r.short.status, 'Draft'); assert.strictEqual(r.short.ig, true);
assert.ok(r.short.yt_description.startsWith('Full song on Bandcamp: https://danyeloz.bandcamp.com/'), r.short.yt_description);
assert.ok(r.short.tt_caption.includes('Carmen'));
const carmenId = r.short.short_id;

assert.throws(() => ctx.addShort({ song_title: 'Nope', drive_file_id: 'VID1' }), /Pick a song/);
assert.throws(() => ctx.addShort({ song_title: 'Carmen' }), /video/);
assert.throws(() => ctx.addShort({ song_title: 'Carmen', drive_file_id: 'NOPE' }), /Drive/);
assert.throws(() => ctx.addShort({ song_title: 'Carmen', drive_file_id: 'VID1', scheduled_date: '12/11/2026' }), /yyyy-mm-dd/);
assert.throws(() => ctx.addShort({ song_title: 'Carmen', drive_file_id: 'VID1', scheduled_time: '7pm' }), /HH:MM/);

/* ----- Gemini ----- */
props.GEMINI_API_KEY = 'GKEY';
r = ctx.generateCaptions(s.short_id, 'hook', 'shorter');
assert.strictEqual(r.source, 'ai'); assert.strictEqual(r.warning, '');
assert.ok(!r.short.yt_title.includes('—'), 'em dash removed: ' + r.short.yt_title);
assert.ok(r.short.yt_title.endsWith('#Shorts'));
assert.strictEqual(r.short.yt_tags.split(' ').filter(t => t === '#AltPop').length, 1, 'tags deduped');
assert.ok(r.short.yt_description.includes('Full song on Bandcamp: https://danyeloz.bandcamp.com/album/onsra-kareena'), 'link added when missing');
assert.ok(r.short.tt_tags.startsWith('#DanyelOZ #Onsra'));
assert.strictEqual(r.short.angle, 'hook');
geminiMode = 'down';
r = ctx.generateCaptions(s.short_id, 'story');
assert.strictEqual(r.source, 'template'); assert.ok(/Gemini didn’t answer \(error 503: overloaded\)/.test(r.warning), r.warning);
delete props.GEMINI_API_KEY;

/* ----- edit and validation ----- */
let saved = ctx.saveShort({ short_id: s.short_id, yt_title: '=HYPERLINK("x") title', tt_tags: 'fyp, #Love  love song', ig: true, status: 'Ready to post' });
assert.strictEqual(saved.status, 'Ready to post'); assert.strictEqual(saved.ig, true);
assert.strictEqual(saved.tt_tags, '#fyp #Love #song');
const row = shortsDefault.data.find(x => x[0] === s.short_id);
assert.strictEqual(row[shortsDefault.data[0].indexOf('yt_title')], "'=HYPERLINK(\"x\") title", 'formula guard');
const snapshot = JSON.stringify(shortsDefault.data);
assert.throws(() => ctx.saveShort({ short_id: s.short_id, status: 'Viral' }), /Unknown status/);
assert.throws(() => ctx.saveShort({ short_id: s.short_id, yt_title: 'x'.repeat(101) }), /over 100/);
assert.throws(() => ctx.saveShort({ short_id: 'S404', yt_title: 'x' }), /no longer/);
assert.strictEqual(JSON.stringify(shortsDefault.data), snapshot, 'failed saves change nothing');

/* ----- batch ----- */
eq(ctx.batchDates_('2026-11-12', 'mwf', 4), ['2026-11-13', '2026-11-16', '2026-11-18', '2026-11-20']);
eq(ctx.batchDates_('2026-11-30', '2days', 2), ['2026-11-30', '2026-12-02']);
r = ctx.applyBatch([carmenId, s.short_id], { start: '2026-11-12', cadence: 'daily', time: '20:00', ig: 'off' });
eq(r, { scheduled: 2, skipped: 0 });
let list = ctx.getShortsData().shorts;
const c2 = list.find(x => x.short_id === carmenId);
assert.strictEqual(c2.scheduled_date, '2026-11-12'); assert.strictEqual(c2.scheduled_time, '20:00'); assert.strictEqual(c2.ig, false); assert.strictEqual(c2.status, 'Scheduled');
assert.strictEqual(list.find(x => x.short_id === s.short_id).scheduled_date, '2026-11-13');
assert.throws(() => ctx.applyBatch([], { start: '2026-11-12' }), /Select/);
assert.throws(() => ctx.applyBatch([carmenId], { start: '2026-11-12', cadence: 'hourly' }), /cadence/);

/* ----- YouTube ----- */
assert.throws(() => ctx.uploadShortToYouTube(s.short_id), /YouTube Data API v3/);
ctx.YouTube = {
  Videos: { insert(res, parts, blob) { uploads.push({ res, parts, blob }); return { id: 'YT' + uploads.length }; },
            list() { return { items: [{ id: 'YT1', statistics: { viewCount: '250', likeCount: '20', commentCount: '2' }, status: { privacyStatus: 'private' } }] }; } },
  Channels: { list: () => ({ items: [{ snippet: { title: 'Danyel OZ' } }] }) }
};
r = ctx.uploadShortToYouTube(s.short_id);
assert.strictEqual(uploads[0].res.status.privacyStatus, 'private');
assert.strictEqual(uploads[0].res.snippet.categoryId, '10');
assert.ok(!uploads[0].res.snippet.title.includes('<'));
assert.ok(uploads[0].res.snippet.description.includes('#Shorts'));
assert.strictEqual(uploads[0].res.snippet.tags[0], 'Shorts');
assert.strictEqual(r.short.status, 'Uploaded (private)'); assert.strictEqual(r.short.yt_video_id, 'YT1');
assert.throws(() => ctx.uploadShortToYouTube(s.short_id), /already on YouTube/);
assert.throws(() => ctx.uploadShortToYouTube(carmenId), /61 MB/);
r = ctx.applyBatch([s.short_id], { start: '2026-12-01', cadence: 'daily' });
eq(r, { scheduled: 0, skipped: 1 }, 'uploaded ones are not rescheduled');
r = ctx.publishSelected([s.short_id, carmenId]);
eq(r.uploaded, []); assert.strictEqual(r.skipped.length, 1); assert.ok(/61 MB/.test(r.failed[0]));

/* ----- analytics ----- */
let a = ctx.getAnalytics();
assert.strictEqual(a.youtube.connected, true); assert.strictEqual(a.totals.ytViews, 250);
assert.strictEqual(a.x.connected, true); assert.strictEqual(a.totals.xPosts, 1, 'test posts left out'); assert.strictEqual(a.totals.xClicks, 3);
assert.ok(a.hashtags.length && a.hashtags[0].avg === 250);
let ex = ctx.exportAnalyticsCsv(); assert.ok(/\.csv$/.test(ex.name));
const csv = Object.values(files).find(f => f.getName() === ex.name);
assert.ok(csv);
ex = ctx.exportSummary(); assert.ok(ex.text.includes('250 views')); assert.ok(!/—/.test(ex.text));

/* ----- delete ----- */
r = ctx.deleteShort(carmenId); assert.strictEqual(r.file, 'carmen_hook.mp4');
assert.strictEqual(ctx.getShortsData().shorts.length, 1);
assert.ok(files.VID2, 'video stays in Drive');

/* ----- X: without a token ----- */
let x = ctx.getXData();
assert.strictEqual(x.connected, false); assert.strictEqual(x.draft, null);
assert.strictEqual(x.posts.length, 2, 'log read from the public raw file');
assert.strictEqual(x.rotation.eligible, 2);
eq(x.rotation.noStory, ['Carmen']);
assert.throws(() => ctx.saveXText(2, 'hi'), /GITHUB_TOKEN/);

/* ----- X: with a token ----- */
props.GITHUB_TOKEN = 'TOK';
x = ctx.getXData();
assert.strictEqual(x.connected, true); assert.strictEqual(x.error, '');
assert.strictEqual(x.draft.number, 2); assert.strictEqual(x.draft.testMode, true); assert.strictEqual(x.draft.song, 'NOTE TO SELF');
assert.strictEqual(x.draft.text, 'Old text https://danyeloz.bandcamp.com/track/x'); assert.strictEqual(x.draft.length, 9 + 23);
assert.strictEqual(x.workflow, 'active'); assert.strictEqual(x.report, 'https://github.com/r/issues/5');
assert.strictEqual(x.approaches.find(p => p.name === 'story').tries, 1);
assert.strictEqual(x.rotation.postedThisRound, 0, '2 posts over 2 songs = new round');

ctx.xPost(2, 'New text'); assert.ok(gh.issues[0].body.includes('- [x] Post')); gh.issues[0].body = gh.issues[0].body.replace('- [x] Post', '- [ ] Post');
ctx.saveXText(2, 'Edited <!-- post:end --> text');
assert.ok(gh.issues[0].body.includes('<!-- post:start -->\nEdited  text\n<!-- post:end -->'), 'markers stripped from text');
assert.ok(gh.issues[0].body.includes('- [ ] Post'));
assert.throws(() => ctx.saveXText(2, 'x'.repeat(281)), /281 characters/);
assert.ok(ctx.xLength_('a'.repeat(250) + ' https://danyeloz.bandcamp.com/track/a-very-long-name-here') <= 280);

ctx.xRevise(2, 'shorter please');
eq(gh.comments, ['shorter please']);
assert.ok(gh.issues[0].body.includes('- [x] Revise'));
assert.throws(() => ctx.xRevise(2, ''), /already being handled/);

// agent rewrote it (no test mode now), then Post
gh.issues[0].body = gh.issues[0].body.replace('- [x] Revise', '- [ ] Revise').replace(/> 🧪.*\n/, '');
ctx.xPost(2, 'Is there a word for loving someone when you already know how it ends? https://danyeloz.bandcamp.com/track/onsra');
assert.ok(gh.issues[0].body.includes('- [x] Post')); assert.ok(gh.issues[0].body.includes('Is there a word'));
gh.issues[0].state = 'closed';
assert.throws(() => ctx.xPost(2, 'again'), /no longer waiting/);

ctx.setXDraftsPaused(true); assert.strictEqual(gh.workflow, 'disabled_manually');
assert.strictEqual(ctx.getXData().workflow, 'disabled_manually');
ctx.setXDraftsPaused(false); assert.strictEqual(gh.workflow, 'active');
ctx.xDraftNow(); assert.strictEqual(gh.dispatched, 1);
gh.issues[0].state = 'open';
assert.throws(() => ctx.xDraftNow(), /already waiting/);

console.log('ALL SHORTS + X TESTS PASSED');
