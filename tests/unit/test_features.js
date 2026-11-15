const fs = require('fs'), vm = require('vm'), assert = require('assert');

function makeSheet(name, data) {
  return {
    name, data, formats: [],
    getName() { return this.name; },
    getLastRow() { return this.data.length; },
    getLastColumn() { return this.data.length ? this.data[0].length : 0; },
    getRange(r, c, nr = 1, nc = 1) {
      const sh = this;
      if (typeof r === 'string') return { setNumberFormat() { return this; } };
      return {
        getValues() { return sh.data.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc)); },
        getValue() { return sh.data[r - 1][c - 1]; },
        setValues(v) { v.forEach((row, i) => { if (!sh.data[r - 1 + i]) sh.data[r - 1 + i] = []; row.forEach((x, j) => { sh.data[r - 1 + i][c - 1 + j] = x; }); }); return this; },
        setValue(x) { sh.data[r - 1][c - 1] = x; return this; },
        setNumberFormat(f) { sh.formats.push([r, c, f]); return this; },
        getNumberFormats() { return Array.from({length: nr}, () => new Array(nc).fill('')); },
        setNumberFormats(m) { m.forEach((row, i) => row.forEach((f, j) => { if (f) sh.formats.push([r + i, c + j, f]); })); return this; },
        setFontWeight() { return this; },
        copyTo() { return this; },
        sort(spec) {
          const rows = sh.data.slice(r - 1, r - 1 + nr);
          rows.sort((a, b) => { for (const s of spec) { const x = a[s.column - 1], y = b[s.column - 1]; if (x < y) return -1; if (x > y) return 1; } return 0; });
          sh.data.splice(r - 1, nr, ...rows); return this;
        },
      };
    },
    deleteRow(r) { this.data.splice(r - 1, 1); },
    setFrozenRows() {},
    insertRowsAfter(after, n) { const w = this.data[0].length; for (let i = 0; i < n; i++) this.data.splice(after, 0, new Array(w).fill('')); },
  };
}

const songs = makeSheet('songs', [['song_id', 'song_title', 'release_date', 'release_type', 'song_genre', 'song_description', 'song_ISRC', 'song_qr']]);
const tabs = [songs];
const ss = {
  getSheets: () => tabs,
  getSheetByName: n => tabs.find(t => t.name === n) || null,
  insertSheet: n => { const t = makeSheet(n, []); tabs.push(t); return t; },
};
const ctx = {
  console, Number, String, Date, JSON, Array, Object, isNaN, Math,
  SpreadsheetApp: { getActiveSpreadsheet: () => ss, CopyPasteType: { PASTE_FORMAT: 'f' } },
  Session: { getScriptTimeZone: () => 'Asia/Singapore' },
  Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM' ? d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') : d.toISOString().slice(0, 10) },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);

// First call creates the tab with headers
let f = ctx.getFeatures();
assert.deepStrictEqual(JSON.parse(JSON.stringify(f)), {});
const ft = tabs.find(t => t.name === 'features');
assert.ok(ft); assert.deepStrictEqual(ft.data[0], ['month', 'slot', 'song_id', 'yt_video_link', 'title', 'description']);

// Save December (3 slots) and November (2 slots, one blank)
let r = ctx.saveFeaturesMonth('2026-12', [
  { song_id: '7100000001', yt_video_link: 'https://youtu.be/xwqruJhnGFU', title: 'Kareena', description: 'Lead\n\nMore' },
  { song_id: '', yt_video_link: 'https://www.youtube.com/shorts/abcdefghijk', title: 'Studio clip', description: '=not a formula' },
  { song_id: '6799528420', yt_video_link: 'https://www.youtube.com/watch?v=ZZZZZZZZZZZ&t=3', title: 'Carmen', description: '' },
]);
assert.strictEqual(r.saved, 3);
r = ctx.saveFeaturesMonth('2026-11', [{ yt_video_link: 'https://youtu.be/AAAAAAAAAAA', title: 'Back to December' }, {}, { title: 'Only a title' }]);
assert.strictEqual(r.saved, 2);
f = ctx.getFeatures();
assert.strictEqual(f['2026-12'].filter(Boolean).length, 3);
assert.strictEqual(f['2026-12'][1].description, "'=not a formula");     // escaped, not run as formula
assert.strictEqual(f['2026-11'][1], null);                               // blank slot stays empty
assert.strictEqual(f['2026-11'][2].title, 'Only a title');
assert.strictEqual(ft.data[1][0], '2026-11');                            // sorted by month
assert.strictEqual(f['2026-12'][0].song_id, '7100000001');

// Re-saving a month replaces it (no duplicates)
r = ctx.saveFeaturesMonth('2026-12', [{ yt_video_link: 'https://youtu.be/BBBBBBBBBBB', title: 'Replaced' }]);
f = ctx.getFeatures();
assert.strictEqual(f['2026-12'].filter(Boolean).length, 1);
assert.strictEqual(f['2026-12'][0].title, 'Replaced');
assert.strictEqual(ft.data.length, 1 + 2 + 1);

// A month typed by hand as a date in the sheet is still understood
ft.data.push([new Date(2027, 0, 1), 1, '', 'https://youtu.be/CCCCCCCCCCC', 'Typed by hand', '']);
f = ctx.getFeatures();
assert.strictEqual(f['2027-01'][0].title, 'Typed by hand');

// Bad YouTube link is rejected and nothing changes
const before = JSON.stringify(ft.data);
assert.throws(() => ctx.saveFeaturesMonth('2026-12', [{ yt_video_link: 'https://example.com/video' }]), /YouTube/);
assert.strictEqual(JSON.stringify(ft.data), before);

// The songs tab is still the one the song tools use
assert.strictEqual(ctx.getSongs().songs.length, 0);
console.log('ALL FEATURE TESTS PASSED');
