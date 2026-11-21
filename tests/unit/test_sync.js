const fs = require('fs'), vm = require('vm'), assert = require('assert');
const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), (m || "mismatch") + ": " + JSON.stringify(a));
const DIR = process.argv[2];
const TODAY = '2026-11-21';
let unformatted = 0;  // data cells written before their column got the @ text format
let writes = 0;                       // every sheet write the mock sees (values, headers, new tabs, new books)
function makeSheet(name, data) {
  return { name, data, frozen: 0, maxRows: 1000, fmt: new Set(),
    getName() { return this.name; }, setName(n) { writes++; this.name = n; }, setFrozenRows(n) { writes++; this.frozen = n; },
    getMaxRows() { return Math.max(this.maxRows, this.data.length); }, insertRowsAfter(a, n) { writes++; this.maxRows += n; },
    getLastRow() { let n = this.data.length; while (n && !this.data[n-1].some(v => v !== '' && v != null)) n--; return n; },
    getLastColumn() { return this.data.length ? Math.max(...this.data.map(r => r.length)) : 0; },
    getRange(r, c, nr = 1, nc = 1) { const sh = this; return {
      getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((sh.data[r-1+i] || [])[c-1+j] ?? ''))); },
      setValues(v) { writes++; if (r > 1) for (let j = 0; j < nc; j++) if (!sh.fmt.has(c + j)) unformatted++; assert.strictEqual(v.length, nr); v.forEach((row, i) => { assert.strictEqual(row.length, nc); while (sh.data.length < r + i) sh.data.push([]); row.forEach((x, j) => { sh.data[r-1+i][c-1+j] = x; }); }); return this; },
      setValue(x) { writes++; if (r > 1 && !sh.fmt.has(c)) unformatted++; while (sh.data.length < r) sh.data.push([]); sh.data[r-1][c-1] = x; return this; },
      clearContent() { writes++; for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (sh.data[r-1+i]) sh.data[r-1+i][c-1+j] = ''; return this; },
      setNumberFormat(f) { writes++; if (f === '@') for (let j = 0; j < nc; j++) sh.fmt.add(c + j); return this; }, setFontWeight() { writes++; return this; } }; } };
}
function makeBook(sheets) { return { sheets, id: 'B' + Math.random(), getId() { return this.id; }, getSheets() { return this.sheets; },
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }, insertSheet(n) { writes++; const s = makeSheet(n, []); this.sheets.push(s); return s; } }; }

const TRACK_HEAD = ['isrc','track_title','artist','duration','explicit','first_release','first_upc','releases','language','lyrics','abc'];
const tracks = makeSheet('tracks', [TRACK_HEAD.slice(),
  ['QZRP42414262','Today','Danyel OZ','3:02',false,'2024-01-05','111111111111',2,'English','la la','X:1'],
  ['QZK6L2424380','My Girl','Danyel OZ','3:10',true,'2024-03-01','333333333333',2,'Spanish','',''],
  ['QZAAA2500001','No List Yet','Danyel OZ','2:59',false,'2025-01-01','444444444444',1,'','','']]);
const songs = makeSheet('Sheet1', [['song_id','song_title','release_date','release_type','song_genre','song_description','song_ISRC','song_qr','song_upc','song_arts']]);
const book = makeBook([songs, tracks]);
const vault = makeBook([makeSheet('track_notes', [['isrc','bpm','key','time_signature','chords','draft_lyrics','draft_abc','notes','updated'],
  ['QZK6L2424380','92','A minor','4/4','','','','','']])]);
const props = { VAULT_SHEET_ID: vault.id };
const ctx = vm.createContext({ console: { log() {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => book, getActive: () => book,
    create: () => { writes++; throw new Error('no new books in this test'); },
    openById: id => { if (id !== vault.id) throw new Error('nope'); return vault; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { writes++; props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? TODAY : TODAY + 'T10:00' }, Session: { getScriptTimeZone: () => 'Asia/Manila' },
  DriveApp: {} });
['Code.gs','Shorts.gs','Singles.gs','Tracks.gs','Sync.gs'].forEach(f => vm.runInContext(fs.readFileSync(DIR + '/' + f, 'utf8'), ctx, { filename: f }));
const G = n => vm.runInContext(n, ctx);
const snap = () => JSON.stringify([tracks.data, book.sheets.map(s => s.name), vault.sheets[0].data]);
const L = ctx.getSyncAdmin().lists;

// lists and constants
eq([L.moods.length, L.genres.length, L.vocals.length, L.keys.length, L.max_featured, L.max_moods], [20, 12, 4, 24, 10, 3]);
eq(L.vocals, ['Solo vocal', 'Duet', 'Instrumental only', 'Mixed'], 'D-9 vocal list');
eq(G("SY_SETTINGS_TAB"), 'sync_settings');
eq(Array.from(G("SY_TRACK_COLUMNS")), ['sync_bpm','sync_key','sync_moods','sync_genre','sync_genre_2','sync_vocal','sync_writers',
  'sync_producers','sync_instrumental','sync_clean','sync_stems','sync_cut60','sync_cut30','sync_featured']);

// reading never writes: no sync columns, no settings tab yet
let before = snap(); writes = 0;
let d = ctx.getSyncAdmin();
eq(writes, 0, 'getSyncAdmin made zero writes'); eq(snap(), before, 'sheets unchanged by reading');
eq([d.readiness.complete, d.readiness.total], [0, 3]);
eq(d.readiness.missing[0], { isrc: 'QZRP42414262', title: 'Today', fields: ['sync_bpm','sync_key','sync_moods','sync_genre','sync_vocal','sync_writers'] });
eq(d.settings, { rights_holder: 'Danyel OZ, LLC', rights_line: '', one_stop: 'TRUE', pro_name: '', contact_email: 'daniel.vizkaino@gmail.com',
  contact_url: '', turnaround: '3 business days', process_note: '', updated: '' }, 'defaults when tab is missing');
eq(d.settings_saved, false);
eq(d.hints, { QZK6L2424380: { bpm: '92', key: 'A minor' } }, 'studio-note hints: only bpm and key (SR-05b)');
eq([d.tracks[1].explicit, d.tracks[1].language, d.tracks[1].sync_moods, d.tracks[1].sync_featured], [true, 'Spanish', [], false]);

// rejections: each throws and leaves the tab exactly as it was
const good = { sync_bpm: '96', sync_key: 'A minor', sync_moods: ['Romantic', 'Smooth'], sync_genre: 'R&B', sync_genre_2: 'Soul',
  sync_vocal: 'Solo vocal', sync_writers: 'Danyel OZ', sync_producers: 'Danyel OZ', sync_instrumental: true, sync_clean: false,
  sync_stems: 'TRUE', sync_cut60: '', sync_cut30: true, sync_featured: true };
const bad = (patch, re, m) => { before = snap(); assert.throws(() => ctx.saveTrackSync('QZRP42414262', Object.assign({}, good, patch)), re, m); eq(snap(), before, m + ': nothing written'); };
bad({ sync_bpm: '39' }, /BPM/, 'bpm 39'); bad({ sync_bpm: '221' }, /BPM/, 'bpm 221'); bad({ sync_bpm: '120.5' }, /BPM/, 'bpm 120.5');
bad({ sync_bpm: 'fast' }, /BPM/, 'bpm text'); bad({ sync_bpm: 1200 }, /BPM/, 'bpm 1200');
bad({ sync_key: 'H major' }, /key/, 'key'); bad({ sync_key: 'a minor' }, /key/, 'key is exact');
bad({ sync_genre: 'Metal' }, /genre/, 'genre'); bad({ sync_genre_2: 'Metal' }, /second genre/, 'genre 2');
bad({ sync_vocal: 'Male vocal' }, /vocal/, 'old vocal label');
bad({ sync_moods: ['Happy', 'Angry'] }, /Angry/, 'unknown mood');
bad({ sync_moods: ['Happy', 'Sad', 'Dark', 'Epic'] }, /up to 3/, '4th mood'); bad({ sync_moods: 'Happy, Sad, Dark, Epic' }, /up to 3/, '4th mood as text');
bad({ sync_writers: 'x'.repeat(201) }, /Writers/, 'writers 201'); bad({ sync_producers: 'x'.repeat(201) }, /Producers/, 'producers 201');
// SR-07: every C-2 rule on the server
bad({ sync_bpm: '120abc' }, /BPM/, 'bpm 120abc'); bad({ sync_genre_2: 'R&B' }, /second genre/, 'genre 2 equal to genre');
bad({ sync_cut30: 'yes' }, /cut30/, 'flag not boolean'); bad({ sync_featured: 'maybe' }, /featured/, 'featured not boolean');
// SR-05: no links, emails, IPI/CAE or long numbers in public free text
bad({ sync_writers: 'Danyel OZ IPI 123456789' }, /long numbers|IPI/, 'writers IPI'); bad({ sync_writers: 'Danyel OZ (CAE)' }, /IPI or CAE/, 'writers CAE word');
bad({ sync_writers: 'see https://drive.google.com/x' }, /link/, 'writers url'); bad({ sync_producers: 'www.stems.com' }, /link/, 'producers www');
bad({ sync_producers: 'drive.google.com/file/x' }, /link/, 'producers drive'); bad({ sync_writers: 'me@x.com' }, /email/, 'writers email');
bad({ sync_producers: 'call 0917123456789' }, /long numbers/, 'producers phone');
bad({ sync_writers: 'Danyel\u0000 OZ' + 'x'.repeat(200) }, /Writers/, 'writers too long after cleaning');
before = snap(); assert.throws(() => ctx.saveTrackSync('QZXXX2599999', good), /No song/); eq(snap(), before, 'unknown ISRC');
assert.throws(() => ctx.saveTrackSync('bad', good), /ISRC/);

// first save: columns appended after abc, earlier cells byte-equal, only this row's sync cells written
const old = JSON.stringify(tracks.data.map(r => r.slice(0, 11)));
ctx.saveTrackSync('qzrp4-2414262', good);
eq(tracks.data[0].slice(0, 11), TRACK_HEAD); eq(tracks.data[0].slice(11), Array.from(G("SY_TRACK_COLUMNS")), 'sync columns after abc');
eq(JSON.stringify(tracks.data.map(r => r.slice(0, 11))), old, 'existing cells unchanged');
eq(tracks.data[1].slice(11), ['96','A minor','Romantic, Smooth','R&B','Soul','Solo vocal','Danyel OZ','Danyel OZ','TRUE','','TRUE','','TRUE','TRUE']);
assert.ok(tracks.data[2].slice(11).every(v => v === '' || v == null), 'other rows untouched');
eq(typeof tracks.data[1][11], 'string', 'BPM stored as text');
ctx.saveTrackSync('QZRP42414262', Object.assign({}, good, { sync_bpm: 40 })); eq(tracks.data[1][11], '40', 'BPM 40 allowed');
ctx.saveTrackSync('QZRP42414262', Object.assign({}, good, { sync_bpm: '220' })); eq(tracks.data[1][11], '220', 'BPM 220 allowed');
ctx.saveTrackSync('QZK6L2424380', { sync_bpm: '', sync_writers: '' });
eq(tracks.data[0].length, 25, 'no duplicate columns on later saves');

// readiness after save; reading still writes nothing
writes = 0; d = ctx.getSyncAdmin(); eq(writes, 0, 'zero writes once columns exist');
eq([d.readiness.complete, d.readiness.total, d.readiness.missing.map(x => x.isrc)], [1, 3, ['QZK6L2424380', 'QZAAA2500001']]);
const t0 = d.tracks[0];
eq([t0.sync_moods, t0.sync_instrumental, t0.sync_clean, t0.sync_featured, t0.complete], [['Romantic', 'Smooth'], true, false, true, true]);
ctx.saveTrackSync('QZK6L2424380', Object.assign({}, good, { sync_moods: 'Sad', sync_writers: '' }));
eq(ctx.getSyncAdmin().readiness.missing[0].fields, ['sync_writers'], 'missing writers only');

// formula-prefix escaping
ctx.saveTrackSync('QZAAA2500001', Object.assign({}, good, { sync_featured: false, sync_writers: '=HYPERLINK("x")', sync_producers: '+1 Producer' }));
eq([tracks.data[3][17], tracks.data[3][18]], ["'=HYPERLINK(\"x\")", "'+1 Producer"], 'formula text neutralised');
eq(ctx.getSyncAdmin().tracks[2].sync_writers, '=HYPERLINK("x")', 'read back as typed');
// SR-06: control characters stripped and trimmed before the formula guard; @ format set before the first value
ctx.saveTrackSync('QZAAA2500001', Object.assign({}, good, { sync_featured: false, sync_writers: '\t=1+1', sync_producers: ' =HYPERLINK(1)' }));
eq([tracks.data[3][17], tracks.data[3][18]], ["'=1+1", "'=HYPERLINK(1)"], 'tab and space before = still neutralised');
ctx.saveTrackSync('QZAAA2500001', Object.assign({}, good, { sync_featured: false, sync_writers: '@SUM(A1)', sync_producers: 'Danyel\u0007 OZ\r\n' }));
eq([tracks.data[3][17], tracks.data[3][18]], ["'@SUM(A1)", 'Danyel OZ'], '@ neutralised; control characters removed');
eq(unformatted, 0, 'no data cell written before its column was formatted @');
// SR-05a: unknown keys never become columns or cells
const width = tracks.data[0].length;
ctx.saveTrackSync('QZAAA2500001', Object.assign({}, good, { sync_featured: false, stems_link: 'https://drive.google.com/x', fee: '500', isrc: 'X', track_title: 'Hacked' }));
eq(tracks.data[0].length, width, 'stems_link adds no column'); eq(tracks.data[3][1], 'No List Yet', 'title untouched');
assert.ok(!JSON.stringify(tracks.data).includes('drive.google'), 'unknown values not stored');

// featured cap across the tab: 2 featured now; add 8 more rows already featured = 10
for (let i = 0; i < 8; i++) { const r = new Array(25).fill(''); r[0] = 'QZFEA250000' + i; r[1] = 'Feat ' + i; r[24] = 'TRUE'; tracks.data.push(r); }
eq(ctx.getSyncAdmin().tracks.filter(x => x.sync_featured).length, 10);
before = snap(); assert.throws(() => ctx.saveTrackSync('QZAAA2500001', Object.assign({}, good, { sync_featured: true })), /10 featured/, '11th featured');
eq(snap(), before, '11th featured: nothing written');
ctx.saveTrackSync('QZRP42414262', good);  // re-saving a song already featured is fine
ctx.saveTrackSync('QZRP42414262', Object.assign({}, good, { sync_featured: false })); eq(tracks.data[1][24], '', 'unfeature');
ctx.saveTrackSync('QZAAA2500001', Object.assign({}, good, { sync_featured: true })); eq(tracks.data[3][24], 'TRUE', 'room again after unfeature');

// settings: validation, first save creates the tab, round trip, one row only
const sgood = { rights_holder: 'Danyel OZ, LLC', rights_line: '', one_stop: true, pro_name: '', contact_email: 'daniel.vizkaino@gmail.com',
  contact_url: '', turnaround: '3 business days', process_note: '' };
const sbad = (patch, re, m) => { before = snap(); assert.throws(() => ctx.saveSyncSettings(Object.assign({}, sgood, patch)), re, m); eq(snap(), before, m + ': nothing written'); };
sbad({ contact_email: 'not an email' }, /email/, 'bad email'); sbad({ contact_email: '' }, /email/, 'blank email');
sbad({ contact_email: 'a@b.com?subject=x' }, /email/, 'email with query');
// SR-04 parity: the app saves exactly the emails sync-core.js accepts (inputs copied from tests/widgets/test_synccore.js)
const EMAIL_BAD = ['a@b.co?bcc=x@evil.io', 'a@b.co,x@evil.io', 'a@b.co%0Abcc:x@evil.io', 'a b@c.co', 'javascript:x@y.co', 'a@b', 'a@b.c', '', 'a@b.co\nbcc:x@y.co', 'x'.repeat(250) + '@b.co',
  'a?b@c.co', 'a&b@c.co', 'a\u0007b@c.co', 'a@b.co\u0000',
  'x%40evil.io%2Cdaniel@gmail.com', 'a%0Ab@c.co', 'a%0Abcc%3Ax%40evil.io@b.co'];   // N-1: no percent sign in the local part
EMAIL_BAD.forEach(m => sbad({ contact_email: m }, /email/, 'email reject ' + JSON.stringify(m)));
const appEmail = m => ctx.syEmail_(m);
['daniel.vizkaino@gmail.com', ' first.last+tag@sub.example.org ', 'x'.repeat(248) + '@b.co'].forEach(m => assert.ok(appEmail(m), 'email accept ' + m));
eq(String(G('SY_EMAIL_RE')), '/^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)*\\.[A-Za-z]{2,}$/', 'same pattern text as OZSync.EMAIL_RE');
const CORE = require('path').join(__dirname, '..', '..', '..', 'danyeloz-embeds', 'sync-core.js');
if (fs.existsSync(CORE)) {         // sibling checkout present: compare verdicts with the real widget core
  const cc = { URL, console: { log() {} }, document: { createElement: () => ({}) } }; cc.window = cc; vm.createContext(cc);
  vm.runInContext(fs.readFileSync(CORE, 'utf8'), cc, { filename: 'sync-core.js' });
  EMAIL_BAD.concat(['daniel.vizkaino@gmail.com', ' first.last+tag@sub.example.org ', 'x'.repeat(248) + '@b.co', 'x'.repeat(249) + '@b.co'])
    .forEach(m => eq(appEmail(m), cc.OZSync.validEmail(m), 'app and widget agree on ' + JSON.stringify(m)));
  eq(String(G('SY_EMAIL_RE')), String(cc.OZSync.EMAIL_RE), 'pattern identical to sync-core.js');
}
sbad({ contact_url: 'http://example.com' }, /https/, 'http url'); sbad({ contact_url: 'javascript:alert(1)' }, /https/, 'javascript url');
sbad({ rights_holder: '  ' }, /rights holder/, 'blank holder');
// SR-05, SR-07, SR-09: settings free text and limits
sbad({ rights_line: 'x'.repeat(401) }, /too long/, 'rights_line 401'); sbad({ rights_holder: 'x'.repeat(121) }, /too long/, 'holder 121');
sbad({ pro_name: 'x'.repeat(81) }, /too long/, 'pro 81'); sbad({ turnaround: 'x'.repeat(41) }, /too long/, 'turnaround 41');
sbad({ process_note: 'x'.repeat(601) }, /too long/, 'process_note 601'); sbad({ contact_url: 'https://forms.gle/' + 'x'.repeat(490) }, /too long/, 'url 501');
sbad({ contact_email: 'a'.repeat(249) + '@x.com' }, /too long/, 'email 255');
sbad({ pro_name: 'BMI IPI 123456789' }, /long numbers|IPI/, 'pro IPI'); sbad({ rights_line: 'Stems at https://drive.google.com/x' }, /link/, 'rights_line url');
sbad({ process_note: 'Write to other@x.com' }, /email/, 'other email'); sbad({ rights_holder: 'Danyel OZ, LLC (CAE)' }, /IPI or CAE/, 'holder CAE');
sbad({ turnaround: 'see docs.google.com/x' }, /link/, 'turnaround url'); sbad({ one_stop: 'sure' }, /One-stop/, 'one_stop not boolean');
// D-10: contact_url host allowlist
['https://evil.io/form', 'http://forms.gle/x', 'https://forms.gle.evil.io/x', 'https://www.danyeloz.info@evil.io/', 'https://user:pw@forms.gle/x',
 'https://www.danyeloz.info:8443/contact', 'https://docs.google.com/document/d/x', 'https://danyeloz.info/contact', 'javascript:alert(1)',
 'https://www.danyeloz.info\@evil.io', '//forms.gle/x', 'https://evil.io/?u=https://forms.gle/x', 'https://cognitoforms.com/x',
 'https://docs.google.com/forms/../spreadsheets/d/x', 'https://docs.google.com/forms/%2e%2e/document/d/x', 'https://docs.google.com/forms/%2E%2E/x',
 'https://www.danyeloz.info/contact/../../x', 'https://forms.gle/./abc', 'https://forms.gle/abc/..']   // N-2: dot segments
  .forEach(u => sbad({ contact_url: u }, /contact link/, 'contact_url ' + u));
assert.ok(!book.getSheetByName('sync_settings'), 'no tab until a good save');
let r = ctx.saveSyncSettings(Object.assign({}, sgood, { pro_name: 'BMI', contact_url: 'https://www.danyeloz.info/contact', rights_line: '=IMPORTXML("x")', one_stop: false }));
eq(r, { ok: true, updated: TODAY + 'T10:00' });
const st = book.getSheetByName('sync_settings');
eq(st.data[0], Array.from(G("SY_SETTING_COLUMNS")), 'header row');
eq(st.data[1][1], "'=IMPORTXML(\"x\")", 'settings formula text neutralised');
d = ctx.getSyncAdmin();
eq(d.settings, { rights_holder: 'Danyel OZ, LLC', rights_line: '=IMPORTXML("x")', one_stop: '', pro_name: 'BMI', contact_email: 'daniel.vizkaino@gmail.com',
  contact_url: 'https://www.danyeloz.info/contact', turnaround: '3 business days', process_note: '', updated: TODAY + 'T10:00' }, 'round trip');
eq(d.settings_saved, true);
ctx.saveSyncSettings(sgood);
eq(st.getLastRow(), 2, 'still one row');
eq(ctx.getSyncAdmin().settings, Object.assign({}, sgood, { one_stop: 'TRUE', updated: TODAY + 'T10:00' }), 'blank PRO saved as blank');
['https://forms.gle/abc123', 'https://docs.google.com/forms/d/e/x/viewform', 'https://www.cognitoforms.com/DanyelOZ/License', 'HTTPS://WWW.DANYELOZ.INFO/contact']
  .forEach(u => { ctx.saveSyncSettings(Object.assign({}, sgood, { contact_url: u })); assert.ok(/^https:\/\/(forms\.gle|docs\.google\.com|www\.cognitoforms\.com|www\.danyeloz\.info)\//.test(st.data[1][5]), 'accepts ' + u); });
r = ctx.saveSyncSettings(Object.assign({}, sgood, { process_note: 'Questions: daniel.vizkaino@gmail.com.', updated: '1999-01-01', stems_folder: 'x' }));
eq([st.data[1][7], st.data[1][8], st.data[0].length], ['Questions: daniel.vizkaino@gmail.com.', TODAY + 'T10:00', 9], 'contact email allowed; updated set by server; no extra column');
eq(unformatted, 0, 'settings cells formatted @ before writing');
d = ctx.getSyncAdmin(); assert.ok(!/BMI/.test(JSON.stringify(d.settings)), 'blank PRO leaves no PRO name');

console.log('test_sync: PASSED');
