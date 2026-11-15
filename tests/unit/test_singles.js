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
  ['song_id','song_title','release_date','release_type','song_genre','song_description','song_ISRC','song_qr','bandcamp_embed'],
  ['1','Onsra (Kareena)','2026-11-09','Single','Pop','story','','',BC],
  ['2','Carmen','2026-11-02','Single','Pop','','','',BC],
  ['3','No Player','2026-10-02','Single','Pop','','','',''],
]);
const book = { sheets: [songs], getSheets() { return this.sheets; }, getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; },
  insertSheet(n) { const s = makeSheet(n, []); this.sheets.push(s); return s; } };
const ctx = vm.createContext({ console: { log() {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => book, getActive: () => book },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
  Utilities: { formatDate: () => '2026-11-10' }, Session: { getScriptTimeZone: () => 'Asia/Manila' } });
['Code.gs', 'Singles.gs'].forEach(f => vm.runInContext(fs.readFileSync(DIR + '/' + f, 'utf8'), ctx, { filename: f }));

let d = ctx.getSinglesAdmin();
assert.ok(book.getSheetByName('featured_singles') && book.getSheetByName('themes'), 'tabs created');
eq(d.featured, []); eq(d.themes, []); assert.strictEqual(d.themeColumns, false);
assert.strictEqual(d.songs.filter(s => s.bandcamp).length, 2);

// featured
assert.throws(() => ctx.saveFeatured([{ song_title: 'No Player' }]), /no Bandcamp code/);
assert.throws(() => ctx.saveFeatured([{ song_title: 'Carmen' }, { song_id: '2' }]), /two slots/);
assert.throws(() => ctx.saveFeatured(new Array(11).fill(0).map((_, i) => ({ song_title: 'x' + i }))), /Up to 10/);
assert.throws(() => ctx.saveFeatured([{ song_title: 'Ghost' }]), /no longer/);
eq(ctx.saveFeatured([{ song_title: 'carmen' }, { song_id: '1' }]), { saved: 2 });
eq(book.getSheetByName('featured_singles').data.slice(0, 3), [['position','song_id','song_title'], ['1','2','Carmen'], ['2','1','Onsra (Kareena)']]);
ctx.saveFeatured([{ song_id: '1' }]);
assert.strictEqual(book.getSheetByName('featured_singles').getLastRow(), 2, 'old rows cleared');
d = ctx.getSinglesAdmin(); eq(d.featured.map(f => f.song_title), ['Onsra (Kareena)']);

// themes, before columns exist a song still saves
assert.ok(ctx.saveSong({ song_title: 'Carmen', row: 3, original_title: 'Carmen', release_date: '2026-11-02' }).ok);
assert.throws(() => ctx.saveThemes([1,2,3,4,5,6].map(i => ({ theme: 'T' + i }))), /Up to 5/);
assert.throws(() => ctx.saveThemes([{ theme: 'Hope' }, { theme: 'hope' }]), /Two themes/);
assert.throws(() => ctx.saveThemes([{ theme: 'x'.repeat(33) }]), /longer than 32/);
eq(ctx.saveThemes([{ theme: '  Heartbreak ' , tagline: 'when it ends' }, { theme: 'Hope and Dreams', visible: false }]), { saved: 2, songsUpdated: 0 });
assert.ok(songs.data[0].includes('song_theme_1') && songs.data[0].includes('song_theme_2'), 'theme columns added at the end');
assert.strictEqual(songs.data[0].indexOf('song_theme_1'), 9);
d = ctx.getSinglesAdmin(); assert.strictEqual(d.themeColumns, true); eq(d.themes.map(t => [t.theme, t.visible]), [['Heartbreak', true], ['Hope and Dreams', false]]);

// theme required now
assert.throws(() => ctx.saveSong({ song_title: 'Carmen', row: 3, original_title: 'Carmen', release_date: '2026-11-02' }), /Theme 1 is required/);
assert.throws(() => ctx.saveSong({ song_title: 'Carmen', row: 3, original_title: 'Carmen', release_date: '2026-11-02', song_theme_1: 'Funk' }), /not one of your themes/);
ctx.saveSong({ song_title: 'Carmen', row: 3, original_title: 'Carmen', release_date: '2026-11-02', song_theme_1: '', song_theme_2: 'heartbreak' });
eq(songs.data[2].slice(9, 11), ['Heartbreak', ''], 'theme 2 moved up, name matched case');
ctx.saveSong({ song_title: 'Onsra (Kareena)', row: 2, original_title: 'Onsra (Kareena)', release_date: '2026-11-09', song_theme_1: 'Heartbreak', song_theme_2: 'Hope and Dreams', bandcamp_embed: BC });
eq(songs.data[1].slice(9, 11), ['Heartbreak', 'Hope and Dreams']);
d = ctx.getSinglesAdmin(); eq(d.themes.map(t => t.count), [2, 1]);

// rename and remove carry over to songs
eq(ctx.saveThemes([{ theme: 'HEARTBREAK', was: 'Heartbreak' }, { theme: '', was: 'Hope and Dreams' }, { theme: 'Late-Night Thoughts' }]), { saved: 2, songsUpdated: 2 });
eq(songs.data[1].slice(9, 11), ['HEARTBREAK', '']); eq(songs.data[2].slice(9, 11), ['HEARTBREAK', '']);
eq(book.getSheetByName('themes').data.slice(1, 3).map(r => r[1]), ['HEARTBREAK', 'Late-Night Thoughts']);

// quick theming
eq(ctx.saveSongThemes([{ row: 4, song_title: 'No Player', theme1: 'late-night thoughts', theme2: '' }]), { saved: 1 });
eq(songs.data[3].slice(9, 11), ['Late-Night Thoughts', '']);
assert.throws(() => ctx.saveSongThemes([{ row: 4, song_title: 'Wrong', theme1: 'HEARTBREAK' }]), /changed/);
assert.throws(() => ctx.saveSongThemes([{ row: 4, song_title: 'No Player', theme1: '' }]), /required/);
eq(ctx.getThemeNames(), { names: ['HEARTBREAK', 'Late-Night Thoughts'], columns: true });
// formula guard on theme text
ctx.saveThemes([{ theme: '=cmd', was: '' }, { theme: 'HEARTBREAK', was: 'HEARTBREAK' }]);
assert.strictEqual(book.getSheetByName('themes').data[1][1], "'=cmd");
console.log('ALL SINGLES TESTS PASSED');
// singles only
songs.data.push(['9','An EP','2026-10-01','EP','Pop','','','',BC]);
assert.throws(() => ctx.saveFeatured([{ song_title: 'An EP' }]), /is an EP/);
console.log('SINGLES-ONLY TEST PASSED');
// EPs and albums save without a theme; singles still need one
assert.ok(ctx.saveSong({ song_title: 'An EP', row: 5, original_title: 'An EP', release_date: '2026-10-01', release_type: 'EP' }).ok);
assert.throws(() => ctx.saveSong({ song_title: 'An EP', row: 5, original_title: 'An EP', release_date: '2026-10-01', release_type: 'Single' }), /required/);
console.log('EP NO-THEME TEST PASSED');
