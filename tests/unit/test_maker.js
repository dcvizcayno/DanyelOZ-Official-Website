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
  ['song_id', 'song_title', 'release_date', 'release_type', 'song_genre', 'song_description', 'song_ISRC', 'song_qr', 'bandcamp_embed', 'song_arts', 'yt_video_link'],
  ['111', 'Carmen', '2026-10-26', 'Single', 'Alternative Pop', 'She danced like the floor owed her money.\n\nSecond part.', '', '',
   '<iframe src="https://bandcamp.com/EmbeddedPlayer/album=2/"><a href="https://danyeloz.bandcamp.com/album/carmen">x</a></iframe>', '', 'https://youtu.be/x'],
]);
const shortsDefault = makeSheet('Sheet1', []);
const book = { getId: () => 'BOOK1', getUrl: () => 'u', sheets: [shortsDefault], getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; },
  getSheets() { return this.sheets; }, insertSheet(n) { const s = makeSheet(n, []); this.sheets.push(s); return s; } };
const props = { GITHUB_TOKEN: 'TOK' };
const files = {};
function makeFile(id, name, mime, content) {
  return files[id] = { id, name, content: content || '', getId: () => id, getName: () => name, getMimeType: () => mime, getSize: () => 30 * 1048576,
    getLastUpdated: () => new Date(2026, 10, 9), getBlob() { const f = this; return { getDataAsString: () => f.content }; }, setContent(c) { this.content = c; return this; } };
}
makeFile('VID1', 'Carmen lyric video 9x16.mp4', 'video/mp4');
makeFile('OLD1', 'Carmen - Part 1 of 3.mp4', 'video/mp4');
let n = 0;
const jobs = { getId: () => 'JOBS', getFiles: () => ({ hasNext: () => false }), createFile(name, content, mime) { return makeFile('JOB' + (++n), name, mime, content); } };
const folder = { getId: () => 'FOLDER', getUrl: () => 'https://drive.google.com/drive/folders/F',
  getFiles() { const l = Object.values(files).filter(f => f.id.startsWith('VID') || f.id.startsWith('OLD')); let i = 0; return { hasNext: () => i < l.length, next: () => l[i++] }; },
  getFoldersByName: () => { let d = false; return { hasNext: () => false, next: () => jobs }; }, createFolder: () => jobs };
const dispatches = [];
let runs = [];
const resp = (code, body) => ({ getResponseCode: () => code, getContentText: () => typeof body === 'string' ? body : JSON.stringify(body) });
const UrlFetchApp = { fetch(url, opt) {
  assert.strictEqual(opt.headers.Authorization, 'Bearer TOK');
  if (url.endsWith('/repos/dcvizcayno/DanyelOZ-Official-Website/actions/workflows/shorts-maker.yml/dispatches')) { dispatches.push(JSON.parse(opt.payload)); return resp(204, ''); }
  if (url.includes('/actions/workflows/shorts-maker.yml/runs')) return resp(200, { workflow_runs: runs });
  throw new Error('unexpected ' + url);
} };
const pad = x => String(x).padStart(2, '0');
const ctx = vm.createContext({
  console: { log() {} }, UrlFetchApp,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => [songsSheet], getSheetByName: n => n === 'Sheet1' ? songsSheet : null }),
    create() { return book; }, openById() { return book; } },
  DriveApp: { getFoldersByName: () => { let d = false; return { hasNext: () => !d, next: () => { d = true; return folder; } }; }, createFolder: () => folder,
    getFileById(id) { if (!files[id]) throw new Error('no file'); return files[id]; } },
  ScriptApp: { getOAuthToken: () => 'DRIVE-TOKEN' },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Utilities: { formatDate(d, tz, f) { const m = new Date(d.getTime() + 8 * 3600000); const day = m.getUTCFullYear() + '-' + pad(m.getUTCMonth() + 1) + '-' + pad(m.getUTCDate());
    return f === 'yyyy-MM-dd' ? day : day + 'T' + pad(m.getUTCHours()) + ':' + pad(m.getUTCMinutes()); } },
  Session: { getScriptTimeZone: () => 'Asia/Manila' },
});
['Code.gs', 'Shorts.gs', 'ShortsMaker.gs'].forEach(f => vm.runInContext(fs.readFileSync(DIR + '/' + f, 'utf8'), ctx, { filename: f }));

let d = ctx.getMakerData();
eq(d.videos.map(v => v.name), ['Carmen lyric video 9x16.mp4'], 'finished parts are not offered as long videos');
eq(d.series, []);
assert.ok(book.getSheetByName('series'), 'series tab made in the private book, not the public Song Database');

assert.throws(() => ctx.planSeries({ song_title: 'Nope', file_id: 'VID1' }), /Pick a song/);
assert.throws(() => ctx.planSeries({ song_title: 'Carmen' }), /video first/);
makeFile('EMPTY', 'Carmen.mp4', 'video/mp4'); files.EMPTY.getSize = () => 0;
assert.throws(() => ctx.planSeries({ song_id: '111', file_id: 'EMPTY' }), /0 MB in Drive, so it’s probably still uploading/);
delete files.EMPTY;
let v = ctx.planSeries({ song_id: '111', file_id: 'VID1', max: 59, endcard: true });
assert.strictEqual(v.status, 'Planning');
assert.strictEqual(dispatches.length, 1);
const di = dispatches[0];
eq([di.ref, di.inputs.mode, di.inputs.file_id, di.inputs.token], ['main', 'plan', 'VID1', 'DRIVE-TOKEN']);
eq(JSON.parse(di.inputs.settings), { max: 59, endcard: true, model: 'small' });
const job = files[di.inputs.job_file_id];
eq(JSON.parse(job.content).status, 'queued');
const id = v.series_id;

// still queued, the run died on GitHub before writing anything
runs = [{ display_title: 'Shorts plan ' + id, status: 'completed', conclusion: 'failure', html_url: 'https://github.com/run/1' }];
v = ctx.getSeries(id);
eq([v.status, v.run_url], ['Failed', 'https://github.com/run/1']);
assert.ok(/before it started/.test(v.message));
v = ctx.replanSeries(id, 59); assert.strictEqual(v.status, 'Planning'); assert.strictEqual(dispatches.length, 2); runs = [];

// the editor reports progress, then the plan
job.setContent(JSON.stringify({ status: 'planning', message: 'Listening for the lyrics' }));
v = ctx.getSeries(id); eq([v.status, v.message], ['Planning', 'Listening for the lyrics']);
const lines = []; let t = 6;
for (let i = 0; i < 30; i++) { lines.push({ s: t, e: t + 4, t: 'line ' + (i + 1) }); t += 4 + (i % 5 === 4 ? 2.5 : 0.6); }
const dur = t + 5;
job.setContent(JSON.stringify({ status: 'planned', lines, duration: dur, bounds: [0, 10, 20], effective_max: 57, language: 'en' }));
v = ctx.getSeries(id);
assert.strictEqual(v.status, 'Planned');
eq(v.bounds, [0, 10, 20]);
assert.strictEqual(v.times[0].start, 3.5, 'part 1 starts 2.5 s before the first line');
assert.ok(v.times.every((p, k) => k === 0 || p.start === v.times[k - 1].end), 'parts touch');
assert.strictEqual(v.times[2].end, Math.round((lines[29].e + 3) * 100) / 100, 'last part ends 3 s after the last line');
assert.ok(v.times[1].start > lines[9].e && v.times[1].start < lines[10].s, 'cut sits between lines');

// nudges
assert.throws(() => ctx.saveSeriesBounds(id, [1, 10, 20]), /first line/);
assert.throws(() => ctx.saveSeriesBounds(id, [0, 10, 10]), /at least one line/);
assert.throws(() => ctx.saveSeriesBounds(id, [0, 10, 40]), /isn’t there/);
v = ctx.saveSeriesBounds(id, [0, 11, 20]); eq(v.bounds, [0, 11, 20]);
// a part that is too long blocks the cut
v = ctx.saveSeriesBounds(id, [0, 20]);
assert.ok(v.times[0].len > 57);
assert.throws(() => ctx.cutSeries(id, {}), /Part 1 is \d+ seconds, over the 57 second limit/);
v = ctx.saveSeriesBounds(id, [0, 10, 20]);

// cut
assert.throws(() => ctx.cutSeries(id, { start_date: '11/20/2026' }), /./);
v = ctx.cutSeries(id, { start_date: '2026-11-20', cadence: 1, time: '19:30', yt: true, tt: true, ig: false });
assert.strictEqual(v.status, 'Cutting');
const cut = dispatches[dispatches.length - 1];
assert.strictEqual(cut.inputs.mode, 'cut'); assert.strictEqual(cut.inputs.out_folder_id, 'FOLDER');
const cs = JSON.parse(cut.inputs.settings);
eq([cs.parts.length, cs.title, cs.next_when, cs.endcard, cs.site], [3, 'Carmen', 'tomorrow', true, 'danyeloz.info']);
assert.throws(() => ctx.saveSeriesBounds(id, [0, 5]), /Only a planned series/);

job.setContent(JSON.stringify({ status: 'cut', clips: [3, 1, 2].map(k => ({ part: k, file_id: 'CLIP' + k, name: 'Carmen - Part ' + k + ' of 3.mp4', size_mb: 25.1, len: 56 })) }));
v = ctx.getSeries(id);
assert.strictEqual(v.status, 'Ready');
eq(v.parts.map(p => [p.part, p.drive_file_id, p.scheduled_date, p.scheduled_time, p.status, p.yt, p.tt, p.ig]),
   [['1/3', 'CLIP1', '2026-11-20', '19:30', 'Scheduled', true, true, false], ['2/3', 'CLIP2', '2026-11-21', '19:30', 'Scheduled', true, true, false],
    ['3/3', 'CLIP3', '2026-11-22', '19:30', 'Scheduled', true, true, false]]);
const p1 = v.parts[0], p3 = v.parts[2];
assert.ok(p1.yt_title.startsWith('Carmen · Part 1 of 3') && p1.yt_title.length <= 100, p1.yt_title);
assert.ok(/Part 2 tomorrow/.test(p1.tt_caption), p1.tt_caption);
assert.ok(/Full song: danyeloz.info/.test(p3.tt_caption), p3.tt_caption);
assert.ok(/bandcamp.com\/album\/carmen/.test(p1.yt_description));
// reading again does not make the parts twice
v = ctx.getSeries(id); assert.strictEqual(ctx.readShorts_(ctx.shortsSheet_()).length, 3);
// the parts are normal Shorts: the existing caption editor works on them
const saved = ctx.saveShort({ short_id: p1.short_id, tt_caption: 'New caption', tt_tags: '#a #b' });
eq([saved.tt_caption, saved.series_id, saved.part], ['New caption', id, '1/3']);
d = ctx.getMakerData();
eq([d.series.length, d.series[0].status, d.series[0].parts.length], [1, 'Ready', 3]);
// all on one day
const id2 = ctx.planSeries({ song_id: '111', file_id: 'VID1', max: 90 }).series_id;
eq(JSON.parse(dispatches[dispatches.length - 1].inputs.settings).max, 90);
const job2 = files[dispatches[dispatches.length - 1].inputs.job_file_id];
job2.setContent(JSON.stringify({ status: 'failed', message: 'No sung lines were found in this video.' }));
v = ctx.getSeries(id2); eq([v.status, v.message], ['Failed', 'No sung lines were found in this video.']);
ctx.deleteSeries(id2); eq(ctx.getMakerData().series.length, 1);
// Song Database untouched
assert.strictEqual(songsSheet.data.length, 2);
assert.ok(!songsSheet.data[0].includes('series_id'));
console.log('ALL SHORTS MAKER TESTS PASSED');
