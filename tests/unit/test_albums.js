const fs = require('fs'), vm = require('vm'), assert = require('assert');
const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
const DIR = process.argv[2];
function makeSheet(name, data) {
  return { name, data,
    getName() { return this.name; }, setName(n) { this.name = n; },
    getLastRow() { let n = this.data.length; while (n && !this.data[n-1].some(v => v !== '' && v != null)) n--; return n; },
    getLastColumn() { return this.data.length ? Math.max(...this.data.map(r => r.length)) : 0; },
    getRange(r, c, nr = 1, nc = 1) { const sh = this; return {
      getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((sh.data[r-1+i] || [])[c-1+j] ?? ''))); },
      setValues(v) { v.forEach((row, i) => { while (sh.data.length < r + i) sh.data.push([]); row.forEach((x, j) => { sh.data[r-1+i][c-1+j] = x; }); }); return this; },
      setValue(x) { while (sh.data.length < r) sh.data.push([]); sh.data[r-1][c-1] = x; return this; },
      getValue() { return (sh.data[r-1] || [])[c-1] ?? ''; },
      clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (sh.data[r-1+i]) sh.data[r-1+i][c-1+j] = ''; return this; },
      setNumberFormat() { return this; }, setFontWeight() { return this; }, getNumberFormats() { return [[]]; }, setNumberFormats() { return this; } }; } };
}
const BC = '<iframe src="https://bandcamp.com/EmbeddedPlayer/track=1/"></iframe>';
const songs = makeSheet('Sheet1', [
  ['song_id','song_title','release_date','release_type','song_genre','song_description','song_ISRC','song_qr','bandcamp_embed','song_arts'],
  ['10',"She's A Puzzle",'2025-03-01','Album','Pop','story','','',BC,''],
  ['11','LOVEROO','2023-02-01','Album','Pop','','','','',''],
  ['12','Puzzle Part 1','2024-12-01','Album','Pop','','','','',''],
  ['13','Really A Single','2024-01-01','Album','Pop','','','','',''],
  ['14','Some Single','2024-01-01','Single','Pop','','','','',''],
  ['20','Mixed Signals','2025-09-08','EP','Pop','','','','',''],
  ['21','The Search','2026-09-18','EP','Pop','story','','',BC,''],
  ['22','Next EP','2027-01-01','EP','Pop','','','','',''],
]);
const book = { sheets: [songs], getSheets() { return this.sheets; }, getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; },
  insertSheet(n) { const s = makeSheet(n, []); this.sheets.push(s); return s; } };
const ctx = vm.createContext({ console: { log() {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => book, getActive: () => book },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
  Utilities: { formatDate: () => '2026-11-10' }, Session: { getScriptTimeZone: () => 'Asia/Manila' } });
['Code.gs','Singles.gs','Albums.gs'].forEach(f => vm.runInContext(fs.readFileSync(DIR + '/' + f, 'utf8'), ctx, { filename: f }));

let d = ctx.getAlbumsAdmin();
assert.ok(book.getSheetByName('albums') && book.getSheetByName('album_collections'), 'tabs created');
eq(d.collections.map(c => c.name).length, 5);
eq(d.collections[4].alias, 'Marcus Heero');
eq(d.library.map(x => x.song_title), ["She's A Puzzle", 'Puzzle Part 1', 'Really A Single', 'LOVEROO'], 'albums only, newest first');
const pz = d.library[0]; eq([pz.kind, pz.show, pz.accent, String(pz.tracks), String(pz.bonus), pz.collection], ['main', true, '#EBB531', '17', '5', 'Heartbreak, Reflection & Closure']);
eq(d.library[1].kind, 'unsorted'); eq(d.library[1].show, false);
// seeding only once
ctx.getAlbumsAdmin(); eq(book.getSheetByName('albums').getLastRow(), 3);
// library
assert.throws(() => ctx.saveAlbumLibrary([{ song_id: '13', song_title: 'Really A Single', kind: 'single', show: true }]), /really a single/);
eq(ctx.saveAlbumLibrary([{ song_id: '12', song_title: 'Puzzle Part 1', kind: 'installment', part_of: " She's A Puzzle ", show: true },
  { song_id: '13', song_title: 'Really A Single', kind: 'single', show: false }, { song_id: '11', kind: 'bogus', show: false }]), { saved: 3 });
d = ctx.getAlbumsAdmin();
const by = t => d.library.find(x => x.song_title === t);
eq([by('Puzzle Part 1').kind, by('Puzzle Part 1').part_of, by('Puzzle Part 1').show], ['installment', "She's A Puzzle", true]);
eq(by('Really A Single').kind, 'single'); eq([by('LOVEROO').kind, by('LOVEROO').show], ['unsorted', false]);
eq(by('LOVEROO').accent, '#3ED2DE', 'library save keeps other fields');
assert.throws(() => ctx.saveAlbumLibrary([{ song_title: 'Ghost', kind: 'main' }]), /no longer/);
// details
assert.throws(() => ctx.saveAlbumDetails({ song_id: '10', accent: 'red' }), /color/);
assert.throws(() => ctx.saveAlbumDetails({ song_id: '10', store_url: 'javascript:alert(1)' }), /https/);
assert.throws(() => ctx.saveAlbumDetails({ song_id: '10', tracks: 'ten' }), /number/);
assert.throws(() => ctx.saveAlbumDetails({ song_id: '10', hook: 'x'.repeat(121) }), /120/);
ctx.saveAlbumDetails({ song_id: '10', song_title: "She's A Puzzle", collection: 'Heartbreak, Reflection & Closure', accent: '#abcdef', hook: ' every   piece ', tracks: '17', bonus: '5', store_url: 'https://danyeloz.bandcamp.com/album/x' });
d = ctx.getAlbumsAdmin(); eq([by("She's A Puzzle").accent, by("She's A Puzzle").hook], ['#ABCDEF', 'every piece']);
// order
ctx.saveAlbumOrder({ 'Heartbreak, Reflection & Closure': [{ song_id: '12', song_title: 'Puzzle Part 1' }, { song_id: '10', song_title: "She's A Puzzle" }] });
d = ctx.getAlbumsAdmin(); eq([by('Puzzle Part 1').position, by("She's A Puzzle").position], [1, 2]);
// featured
ctx.setFeaturedAlbum({ song_id: '12', song_title: 'Puzzle Part 1' }); ctx.setFeaturedAlbum({ song_id: '10', song_title: "She's A Puzzle" });
d = ctx.getAlbumsAdmin(); eq(d.library.filter(x => x.featured).map(x => x.song_title), ["She's A Puzzle"]);
ctx.setFeaturedAlbum(null); d = ctx.getAlbumsAdmin(); eq(d.library.filter(x => x.featured).length, 0);
// collections
assert.throws(() => ctx.saveAlbumCollections(new Array(9).fill(0).map((_, i) => ({ name: 'C' + i }))), /Up to 8/);
assert.throws(() => ctx.saveAlbumCollections([{ name: 'A' }, { name: 'a' }]), /Two collections/);
const r = ctx.saveAlbumCollections([{ name: 'Heartbreak', was: 'Heartbreak, Reflection & Closure', tagline: 'when it ends' }, { name: 'Love, Romance & Relationships', was: 'Love, Romance & Relationships', visible: false }, { name: '=cmd' }]);
eq(r, { saved: 3, albumsMoved: 2 });
d = ctx.getAlbumsAdmin(); eq(by("She's A Puzzle").collection, 'Heartbreak'); eq(d.collections.map(c => [c.name, c.visible]), [['Heartbreak', true], ['Love, Romance & Relationships', false], ["'=cmd", true]]);
assert.strictEqual(book.getSheetByName('album_collections').data[3][1], "'=cmd", 'formula guard');
eq(songs.data[1][3], 'Album', 'release types untouched');

// ---------- EPs page ----------
let e = ctx.getAlbumsAdmin('ep');
eq(e.page, 'ep'); eq(e.kinds, ['unsorted', 'ep', 'installment', 'single']);
eq(e.library.map(x => x.song_title), ['Next EP', 'The Search', 'Mixed Signals'], 'only EP rows, newest first');
eq(e.collections, [], 'the Albums collections stay on the Albums page');
assert.ok(e.mainAlbums.includes("She's A Puzzle"), 'main albums offered for "part of an album"');
assert.throws(() => ctx.saveAlbumLibrary([{ song_id: '20', song_title: 'Mixed Signals', kind: 'installment', part_of: "She's A Puzzle", show: true }], 'ep'), /part of an album/);
ctx.saveAlbumLibrary([{ song_id: '20', song_title: 'Mixed Signals', kind: 'installment', part_of: "She's A Puzzle", show: false },
                      { song_id: '21', song_title: 'The Search', kind: 'ep', show: true }], 'ep');
e = ctx.getAlbumsAdmin('ep');
const eb = t => e.library.find(x => x.song_title === t);
eq([eb('Mixed Signals').kind, eb('Mixed Signals').part_of, eb('The Search').kind, eb('The Search').show], ['installment', "She's A Puzzle", 'ep', true]);
// an album sorted as "became an EP" appears in the EP library too, and its switch belongs to the EPs page
ctx.saveAlbumLibrary([{ song_id: '13', song_title: 'Really A Single', kind: 'ep', show: true }], 'album');
assert.strictEqual(ctx.getAlbumsAdmin('ep').library.find(x => x.song_title === 'Really A Single').show, false, 'album page does not switch an EP on');
ctx.saveAlbumLibrary([{ song_id: '13', song_title: 'Really A Single', kind: 'ep', show: true }], 'ep');
e = ctx.getAlbumsAdmin('ep'); assert.strictEqual(e.library.find(x => x.song_title === 'Really A Single').show, true);
assert.strictEqual(ctx.getAlbumsAdmin('album').library.find(x => x.song_title === 'Really A Single').kind, 'ep');
// collections per page
ctx.saveAlbumCollections([{ name: 'Short stories', tagline: 'four songs at a time' }], 'ep');
eq(ctx.getAlbumsAdmin('ep').collections.map(c => c.name), ['Short stories']);
eq(ctx.getAlbumsAdmin('album').collections.map(c => c.name), ['Heartbreak', 'Love, Romance & Relationships', "'=cmd"], 'album collections untouched');
ctx.saveAlbumCollections([{ name: 'Heartbreak', was: 'Heartbreak' }, { name: 'Love, Romance & Relationships', was: 'Love, Romance & Relationships' }], 'album');
eq(ctx.getAlbumsAdmin('ep').collections.map(c => c.name), ['Short stories'], 'EP collections untouched by an album save');
// featured per page
ctx.setFeaturedAlbum({ song_id: '10', song_title: "She's A Puzzle" }, 'album');
ctx.setFeaturedAlbum({ song_id: '21', song_title: 'The Search' }, 'ep');
eq([ctx.getAlbumsAdmin('album').library.filter(x => x.featured).map(x => x.song_title), ctx.getAlbumsAdmin('ep').library.filter(x => x.featured).map(x => x.song_title)],
   [["She's A Puzzle"], ['The Search']], 'each page keeps its own pick');
ctx.setFeaturedAlbum(null, 'ep');
eq(ctx.getAlbumsAdmin('album').library.filter(x => x.featured).map(x => x.song_title), ["She's A Puzzle"]);
console.log('ALL ALBUMS TESTS PASSED');
