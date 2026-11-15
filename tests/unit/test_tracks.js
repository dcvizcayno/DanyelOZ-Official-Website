const fs = require('fs'), vm = require('vm'), assert = require('assert');
const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), m);
const DIR = process.argv[2];
let TODAY = '2026-11-13';
function makeSheet(name, data) {
  return { name, data, frozen: 0, maxRows: 1000,
    getName() { return this.name; }, setName(n) { this.name = n; }, setFrozenRows(n) { this.frozen = n; },
    getMaxRows() { return Math.max(this.maxRows, this.data.length); }, insertRowsAfter(a, n) { this.maxRows += n; },
    getLastRow() { let n = this.data.length; while (n && !this.data[n-1].some(v => v !== '' && v != null)) n--; return n; },
    getLastColumn() { return this.data.length ? Math.max(...this.data.map(r => r.length)) : 0; },
    getRange(r, c, nr = 1, nc = 1) { const sh = this; return {
      getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((sh.data[r-1+i] || [])[c-1+j] ?? ''))); },
      setValues(v) { assert.strictEqual(v.length, nr); v.forEach((row, i) => { assert.strictEqual(row.length, nc); while (sh.data.length < r + i) sh.data.push([]); row.forEach((x, j) => { sh.data[r-1+i][c-1+j] = x; }); }); return this; },
      setValue(x) { while (sh.data.length < r) sh.data.push([]); sh.data[r-1][c-1] = x; return this; },
      clearContent() { for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (sh.data[r-1+i]) sh.data[r-1+i][c-1+j] = ''; return this; },
      setNumberFormat() { return this; }, setFontWeight() { return this; } }; } };
}
function makeBook(sheets) { return { sheets, id: 'B' + Math.random(), getId() { return this.id; }, getSheets() { return this.sheets; },
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }, insertSheet(n) { const s = makeSheet(n, []); this.sheets.push(s); return s; } }; }
const S1 = ['song_id','song_title','release_date','release_type','song_genre','song_description','song_ISRC','song_qr','song_upc','song_arts'];
const songs = makeSheet('Sheet1', [S1,
  ['1','Today','2024-01-05','Single','Pop','','QZRP42414262','','111111111111',''],
  ['2','Goodbye Album','2024-06-01','Album','Pop','','','','222222222222',''],
  ['3','My Girl','2024-03-01','Single','Pop','','QZK6L2424380','','333333333333',''],
  ['4','No List Yet','2025-01-01','Single','Pop','','QZAAA2500001','','444444444444',''],
  ['5','Upcoming','2026-12-14','EP','Pop','','','','555555555555',''],
  ['6','No Code','2027-01-01','Single','Pop','','','','',''],
]);
const tracks = makeSheet('tracks', [['isrc','track_title','artist','duration','explicit','first_release','first_upc','releases','language','lyrics'],
  ['QZRP42414262','Today','Danyel OZ','3:02',false,'2024-01-05','111111111111',2,'',''],
  ['QZK6L2424380','My Girl','Danyel OZ','3:10',false,'2024-03-01','333333333333',2,'','old lyrics']]);
const rts = makeSheet('release_tracks', [['upc','release_title','disc','track_number','isrc','track_title','duration','bonus'],
  ['111111111111','Today',1,1,'QZRP42414262','Today','3:02',''],
  ['222222222222','Goodbye Album',1,1,'QZRP42414262','Goodbye','6:00',''],
  ['222222222222','Goodbye Album',1,2,'QZK6L2424380','My Girl','3:10',''],
  ['333333333333','My Girl',1,1,'QZK6L2424380','My Girl','3:11','']]);
const book = makeBook([songs, tracks, rts]);
const created = [];
const props = {};
const ctx = vm.createContext({ console: { log() {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => book, getActive: () => book,
    create: n => { const b = makeBook([makeSheet('Sheet1', [])]); b.title = n; created.push(b); return b; },
    openById: id => { const b = created.find(x => x.id === id); if (!b) throw new Error('nope'); return b; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? TODAY : TODAY + 'T10:00' }, Session: { getScriptTimeZone: () => 'Asia/Manila' },
  DriveApp: {} });
['Code.gs','Shorts.gs','Singles.gs','Tracks.gs'].forEach(f => vm.runInContext(fs.readFileSync(DIR + '/' + f, 'utf8'), ctx, { filename: f }));

let d = ctx.getTracksAdmin();
eq(tracks.data[0].slice(-1), ['abc'], 'abc column added');
eq(created.length, 1, 'vault made once'); eq(created[0].title, 'Danyel OZ Song Vault (private)');
eq(created[0].sheets.map(s => s.name).sort(), ['track_fixes', 'track_notes']);
eq(d.tracks.length, 2); eq(d.rts.length, 4);
eq(d.checks.reuse, [{ isrc: 'QZRP42414262', issue: 'different song names; lengths differ by 178 s' }]);
eq(d.checks.noTracklist.map(x => x.title), ['No List Yet'], 'released without tracklist; upcoming not counted');
eq(d.checks.noUpc.map(x => x.title), ['No Code']);
eq(d.checks.singleMismatch, []); eq(d.checks.noLyrics, 1);
ctx.getTracksAdmin(); eq(created.length, 1, 'vault reused');

// detail
let t = ctx.getTrackDetail('qzk6l2424380');
eq([t.track.track_title, t.released, t.on.length, t.track.lyrics], ['My Girl', true, 2, 'old lyrics']);
assert.throws(() => ctx.getTrackDetail('XX'), /No song/);

// notes (private)
assert.throws(() => ctx.saveTrackNotes('QZK6L2424380', { bpm: 'fast' }), /BPM/);
ctx.saveTrackNotes('QZK6L2424380', { bpm: '92', key: 'A minor', chords: 'Am F C G', draft_lyrics: 'new draft', draft_abc: 'X:1\nK:C\nCDEF|' });
ctx.saveTrackNotes('QZK6L2424380', { bpm: '93', key: 'A minor', chords: 'Am F C G', draft_lyrics: 'new draft 2' });
const notes = created[0].getSheetByName('track_notes');
eq(notes.getLastRow(), 2, 'one row per ISRC (updated in place)');
t = ctx.getTrackDetail('QZK6L2424380'); eq([t.notes.bpm, t.notes.draft_lyrics], ['93', 'new draft 2']);
assert.ok(!tracks.data.some(r => r.includes('new draft 2')), 'drafts never reach the public tab');

// publish
ctx.publishTrackText('QZK6L2424380', { lyrics: 'Line one\nLine two' });
eq(ctx.getTrackDetail('QZK6L2424380').track.lyrics, 'Line one\nLine two');
assert.throws(() => ctx.publishTrackText('QZK6L2424380', { abc: 'CDEF' }), /X:1/);
ctx.publishTrackText('QZK6L2424380', { abc: 'X:1\nT:My Girl\nK:C\nCDEF|' });
ctx.publishTrackText('QZK6L2424380', { lyrics: '' });
eq(ctx.getTrackDetail('QZK6L2424380').track.lyrics, '', 'take off site');
assert.throws(() => ctx.publishTrackText('QZK6L2424380', { lyrics: 'x'.repeat(45001) }), /too long/);
ctx.publishTrackText('QZK6L2424380', { lyrics: '=HYPERLINK("x")' });
assert.ok(tracks.data.some(r => r.includes("'=HYPERLINK(\"x\")")), 'formula text neutralised');

// fixes (private)
assert.throws(() => ctx.saveTrackFix('QZRP42414262', { new_isrc: 'bad' }), /ISRC/);
assert.throws(() => ctx.saveTrackFix('QZRP42414262', { new_isrc: 'QZRP42414262' }), /same/);
assert.throws(() => ctx.saveTrackFix('QZRP42414262', { new_upc: '12' }), /UPC/);
ctx.saveTrackFix('QZRP42414262', { status: 'Republish planned', plan: 'New ISRC', new_isrc: 'qzrp4-2500001', new_upc: '666666666666', notes: 'Goodbye is a different song' });
d = ctx.getTracksAdmin(); eq([d.fixes.QZRP42414262.status, d.fixes.QZRP42414262.new_isrc], ['Republish planned', 'QZRP42500001']);
ctx.saveTrackFix('QZRP42414262', { status: 'bogus' }); eq(ctx.getTracksAdmin().fixes.QZRP42414262.status, 'To check', 'unknown status falls back');

// tracklist: the republished release with a new ISRC replacing the old one
songs.data.push(['7','Goodbye (2027)','2026-11-20','Single','Pop','','','','666666666666','']);
assert.throws(() => ctx.saveReleaseTracklist('999999999999', [{ isrc: 'QZRP42500001', track_title: 'Goodbye' }]), /No release/);
assert.throws(() => ctx.saveReleaseTracklist('666666666666', [{ isrc: 'nope', track_title: 'Goodbye' }]), /ISRC/);
assert.throws(() => ctx.saveReleaseTracklist('666666666666', [{ isrc: 'QZRP42500001', track_title: '' }]), /title/);
assert.throws(() => ctx.saveReleaseTracklist('666666666666', [{ isrc: 'QZRP42500001', track_title: 'A', duration: '6 min' }]), /3:34/);
assert.throws(() => ctx.saveReleaseTracklist('666666666666', [{ isrc: 'QZRP42500001', track_title: 'A', track_number: 1 }, { isrc: 'QZRP42500002', track_title: 'B', track_number: 1 }]), /numbered 1/);
assert.throws(() => ctx.saveReleaseTracklist('666666666666', [{ isrc: 'QZRP42500001', track_title: 'A', track_number: 1 }, { isrc: 'QZRP42500001', track_title: 'B', track_number: 2 }]), /twice/);
ctx.saveTrackNotes('QZRP42414262', { bpm: '120', chords: 'C G' });
ctx.publishTrackText('QZRP42414262', { lyrics: 'goodbye words' });
let r = ctx.saveReleaseTracklist('666666666666', [{ disc: 1, track_number: 1, isrc: 'QZRP42500001', track_title: 'Goodbye', duration: '6:00', from_isrc: 'QZRP42414262' }]);
eq([r.added, r.count], [1, 1]);
t = ctx.getTrackDetail('QZRP42500001');
eq([t.track.track_title, t.track.lyrics, t.track.first_release, t.track.first_upc, t.track.releases, t.released], ['Goodbye', 'goodbye words', '2026-11-20', '666666666666', 1, false], 'carried over; not out yet');
eq([t.notes.bpm, t.notes.chords], ['120', 'C G'], 'private notes carried over');
assert.throws(() => ctx.publishTrackText('QZRP42500001', { lyrics: 'new' }), /isn't out yet/);
// re-save replaces, does not duplicate; other releases untouched
ctx.saveReleaseTracklist('666666666666', [{ disc: 1, track_number: 1, isrc: 'QZRP42500001', track_title: 'Goodbye (Remastered)', duration: '6:01' }]);
const rows = rts.data.slice(1).filter(x => x.some(v => v !== ''));
eq(rows.filter(x => x[0] === '666666666666').length, 1);
eq(rows.length, 5, 'four old rows plus one');
eq(rows.filter(x => x[0] === '222222222222').map(x => x[5]), ['Goodbye', 'My Girl']);
assert.strictEqual(typeof rows[0][3], 'number', 'track numbers stay numbers');
// derived counts
const trow = tracks.data.find(x => x[0] === 'QZK6L2424380'); eq([trow[5], trow[6], trow[7]], ['2024-03-01', '333333333333', 2]);
// a release with no tracklist gets one; first_release fills
ctx.saveReleaseTracklist('444444444444', [{ isrc: 'QZAAA2500001', track_title: 'No List Yet', duration: '2:59' }]);
d = ctx.getTracksAdmin(); eq(d.checks.noTracklist, []); eq(d.tracks.length, 4);
eq(d.tracks.find(x => x.isrc === 'QZAAA2500001').first_release, '2025-01-01');
// release day: the upcoming song can be published
TODAY = '2026-11-20'; ctx.publishTrackText('QZRP42500001', { lyrics: 'out now' });
console.log('tracks tests passed');
