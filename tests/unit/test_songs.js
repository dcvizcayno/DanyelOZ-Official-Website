const fs = require('fs'), vm = require('vm'), assert = require('assert');

function makeSheet(data) {
  return {
    data, formats: [],
    getLastRow() { return this.data.length; },
    getLastColumn() { return this.data[0].length; },
    getRange(r, c, nr = 1, nc = 1) {
      const sh = this;
      return {
        getValues() { return sh.data.slice(r - 1, r - 1 + nr).map(row => row.slice(c - 1, c - 1 + nc)); },
        getValue() { return sh.data[r - 1][c - 1]; },
        setValues(v) { v.forEach((row, i) => row.forEach((x, j) => { sh.data[r - 1 + i][c - 1 + j] = x; })); return this; },
        setValue(x) { sh.data[r - 1][c - 1] = x; return this; },
        setNumberFormat(f) { sh.formats.push([r, c, f]); return this; },
        getNumberFormats() { return Array.from({length: nr}, () => new Array(nc).fill('')); },
        setNumberFormats(m) { m.forEach((row, i) => row.forEach((f, j) => { if (f) sh.formats.push([r + i, c + j, f]); })); return this; },
        copyTo() { return this; },
      };
    },
    insertRowsAfter(after, n) { const w = this.data[0].length; for (let i = 0; i < n; i++) this.data.splice(after, 0, new Array(w).fill('')); },
  };
}

const head = ['song_id','song_title','release_date','release_type','song_genre','song_description','song_ISRC','song_qr',
  'song_upc','record_label','yt_video_link','spotify_link','appl_music_link','amazon_link','bandcamp_embed','song_arts'];
const C = Object.fromEntries(head.map((h, i) => [h, i]));
const blank = () => new Array(head.length).fill('');
function row(o) { const r = blank(); Object.entries(o).forEach(([k, v]) => r[C[k]] = v); return r; }

const sheet = makeSheet([
  head.slice(),
  row({ song_title: 'Kareena', release_date: new Date(2026, 11, 14), release_type: 'EP', song_genre: 'Pop/Alt R&B' }),
  row({ song_id: 6799528420, song_title: 'Carmen', release_date: new Date(2026, 10, 2), release_type: 'Single', song_genre: 'Pop',
        spotify_link: 'https://open.spotify.com/track/keepme' }),
]);
const form = makeSheet([['Timestamp', 'Untitled Question'], ['x', 'y']]);

const created = [];
const ctx = {
  console, Number, String, Date, JSON, Array, Object, isNaN,
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => [form, sheet], getSheetByName: () => sheet }), CopyPasteType: { PASTE_FORMAT: 'f' } },
  Session: { getScriptTimeZone: () => 'Asia/Singapore' },
  Utilities: {
    formatDate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    base64Decode: b => Buffer.from(b, 'base64'), newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
  },
  LockService: { getScriptLock: () => ({ waitLock() {}, tryLock() { return true; }, releaseLock() {} }) },
  DriveApp: {
    Access: { ANYONE_WITH_LINK: 'a' }, Permission: { VIEW: 'v' },
    getFoldersByName: name => ({ hasNext: () => false, name }),
    createFolder: name => ({ createFile: blob => { created.push({ folder: name, name: blob.name }); return { getId: () => 'F' + created.length, setSharing() {} }; } }),
  },
  UrlFetchApp: { fetch: () => ({ getResponseCode: () => 200, getContentText: () => JSON.stringify({ results: [
    { wrapperType: 'collection', collectionId: 7100000001, collectionName: 'Kareena - EP', releaseDate: '2026-12-14T08:00:00Z', trackCount: 4, primaryGenreName: 'Pop',
      collectionViewUrl: 'https://music.apple.com/us/album/kareena-ep/7100000001?uo=4', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/X/100x100bb.jpg' },
    { wrapperType: 'collection', collectionId: 6799528420, collectionName: 'Carmen - Single', releaseDate: '2026-11-02T08:00:00Z', trackCount: 1, primaryGenreName: 'Pop',
      collectionViewUrl: 'https://music.apple.com/us/album/carmen-single/6799528420?uo=4', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/C/100x100bb.jpg' },
    { wrapperType: 'collection', collectionId: 7200000002, collectionName: 'Future Song - Single', releaseDate: '2026-12-28T08:00:00Z', trackCount: 1, primaryGenreName: 'Pop',
      collectionViewUrl: 'https://music.apple.com/us/album/future/7200000002?uo=4', artworkUrl100: 'https://is1-ssl.mzstatic.com/image/thumb/F/100x100bb.jpg' },
  ] }) }) },
};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(process.argv[2], 'utf8'), ctx);

// getSongs: new shape, all 16 columns visible
let res = ctx.getSongs();
assert.strictEqual(res.songs.length, 2);
assert.ok(res.columns.includes('bandcamp_embed') && res.columns.includes('appl_music_link'));
assert.strictEqual(res.songs[1].spotify_link, 'https://open.spotify.com/track/keepme');

// Save Carmen with all new fields, a leading-zero UPC, and an uploaded cover
const embed = '<iframe style="border: 0; width: 100%; height: 120px;" src="https://bandcamp.com/EmbeddedPlayer/album=123/size=large/" seamless></iframe>';
let r = ctx.saveSong({ row: 3, original_title: 'Carmen', song_id: '6799528420', song_title: 'Carmen', release_date: '2026-11-02',
  release_type: 'Single', song_genre: 'Alternative Pop', song_description: 'Lead.\n\nStory.', song_ISRC: 'qz-abc-26-00001', song_qr: '',
  song_upc: '0 12345 67890 5', record_label: 'Danyel OZ, LLC', yt_video_link: 'https://youtu.be/abc', spotify_link: 'https://open.spotify.com/album/x',
  appl_music_link: '', amazon_link: 'https://music.amazon.com/albums/B0X', bandcamp_embed: embed, song_arts: '',
  artFile: { name: 'cover.jpg', mimeType: 'image/jpeg', base64: Buffer.from('jpg').toString('base64') } });
const carmen = sheet.data[2];
assert.strictEqual(r.row, 3);
assert.strictEqual(carmen[C.song_upc], '012345678905');               // digits only, leading zero kept
assert.ok(sheet.formats.some(f => f[0] === 3 && f[1] === C.song_upc + 1 && f[2] === '@'));  // stored as text
assert.strictEqual(carmen[C.record_label], 'Danyel OZ, LLC');
assert.strictEqual(carmen[C.bandcamp_embed], embed);                  // HTML kept as-is
assert.strictEqual(carmen[C.song_arts], 'https://drive.google.com/file/d/F1/view');
assert.strictEqual(created[0].folder, 'Danyel OZ Song Art'); assert.strictEqual(created[0].name, 'Carmen Cover.jpg');
assert.strictEqual(carmen[C.song_ISRC], 'QZ-ABC-26-00001');

// Import: links Kareena by title + fills its Apple link/art, keeps Carmen's art, adds Future Song on top
r = ctx.importFromApple();
assert.strictEqual(r.added, 1, r.message); assert.strictEqual(r.linked, 1, r.message);
assert.strictEqual(sheet.data[1][C.song_title], 'Future Song');
assert.strictEqual(sheet.data[1][C.appl_music_link], 'https://music.apple.com/us/album/future/7200000002');
assert.strictEqual(sheet.data[1][C.song_arts], 'https://is1-ssl.mzstatic.com/image/thumb/F/600x600bb.jpg');
const kareena = sheet.data.find(x => x[C.song_title] === 'Kareena');
assert.strictEqual(kareena[C.song_id], 7100000001);
assert.strictEqual(kareena[C.appl_music_link], 'https://music.apple.com/us/album/kareena-ep/7100000001');
assert.strictEqual(kareena[C.song_arts], 'https://is1-ssl.mzstatic.com/image/thumb/X/600x600bb.jpg');
const carmen2 = sheet.data.find(x => x[C.song_title] === 'Carmen');
assert.strictEqual(carmen2[C.song_arts], 'https://drive.google.com/file/d/F1/view');   // uploaded art not overwritten
assert.strictEqual(carmen2[C.appl_music_link], 'https://music.apple.com/us/album/carmen-single/6799528420'); // blank got filled
assert.strictEqual(carmen2[C.bandcamp_embed], embed);                                  // untouched columns survive

// Second import changes nothing
r = ctx.importFromApple();
assert.strictEqual(r.added + r.linked + r.filled, 0, r.message);

// Older sheet without the new columns still works
const old = makeSheet([head.slice(0, 8), [1, 'Old Song', new Date(2024, 0, 1), 'Single', 'Pop', '', '', '']]);
ctx.SpreadsheetApp.getActiveSpreadsheet = () => ({ getSheets: () => [old] });
res = ctx.getSongs(); assert.strictEqual(res.songs[0].song_upc, '');
r = ctx.saveSong({ row: 2, original_title: 'Old Song', song_title: 'Old Song', release_date: '2024-01-01', song_upc: '123456789012' });
assert.strictEqual(old.data[1].length, 8);

console.log('ALL TESTS PASSED');
