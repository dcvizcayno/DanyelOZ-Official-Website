// QA T-011 independent probe of apps-script/Sync.gs (Node vm, own mocks and fixtures). Usage: node probe_syncgs.js <apps-script dir>
const fs = require('fs'), vm = require('vm');
const DIR = process.argv[2];
let pass = 0, fail = 0; const out = [];
const ok = (c, m) => { if (c) pass++; else { fail++; out.push('FAIL ' + m); } };
let writes = 0, unformatted = 0;
function makeSheet(name, data) {
  return { name, data, fmt: new Set(), maxRows: 1000,
    getName() { return this.name; }, setFrozenRows() { writes++; }, getMaxRows() { return Math.max(this.maxRows, this.data.length); },
    insertRowsAfter(a, n) { this.maxRows += n; },
    getLastRow() { let n = this.data.length; while (n && !this.data[n-1].some(v => v !== '' && v != null)) n--; return n; },
    getLastColumn() { return this.data.length ? Math.max(...this.data.map(r => r.length)) : 0; },
    getRange(r, c, nr = 1, nc = 1) { const sh = this; return {
      getValues() { return Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => ((sh.data[r-1+i] || [])[c-1+j] ?? ''))); },
      setValues(v) { writes++; if (r > 1) for (let j = 0; j < nc; j++) if (!sh.fmt.has(c+j)) unformatted++; v.forEach((row, i) => { while (sh.data.length < r+i) sh.data.push([]); row.forEach((x, j) => { sh.data[r-1+i][c-1+j] = x; }); }); return this; },
      setValue(x) { writes++; if (r > 1 && !sh.fmt.has(c)) unformatted++; while (sh.data.length < r) sh.data.push([]); sh.data[r-1][c-1] = x; return this; },
      clearContent() { writes++; for (let i = 0; i < nr; i++) for (let j = 0; j < nc; j++) if (sh.data[r-1+i]) sh.data[r-1+i][c-1+j] = ''; return this; },
      setNumberFormat(f) { writes++; if (f === '@') for (let j = 0; j < nc; j++) sh.fmt.add(c+j); return this; }, setFontWeight() { return this; } }; } };
}
function makeBook(sheets) { return { sheets, id: 'B' + Math.random(), getId() { return this.id; }, getSheets() { return this.sheets; },
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }, insertSheet(n) { writes++; const s = makeSheet(n, []); this.sheets.push(s); return s; } }; }
// Planted tracks tab: hand-added sync_bpm (mixed types, a stray formula-looking text) and an unrelated hand column, in odd positions.
const Q = String.fromCharCode(39);
const HEAD = ['isrc','track_title','artist','my_note','duration','explicit','first_release','first_upc','releases','language','sync_bpm','lyrics','abc'];
const rows = [HEAD.slice()];
const isrcs = [];
for (let i = 1; i <= 12; i++) { const id = 'QZQAA' + String(2600000 + i); isrcs.push(id);
  rows.push([id, i === 1 ? '<img src=x onerror=window.__pwn=1>' : 'Song ' + i, 'Danyel OZ', 'hand note ' + i, '3:0' + (i % 10), i % 2 === 0, i === 12 ? '2027-03-01' : '2025-0' + ((i % 9) + 1) + '-01',
    '1111111111' + String(i).padStart(2, '0'), 1, 'English', i === 2 ? 95 : i === 3 ? Q + '=1+1' : i === 4 ? '120' : '', 'lyr', '']); }
const tracks = makeSheet('tracks', rows);
const original = JSON.parse(JSON.stringify(rows));
const book = makeBook([makeSheet('Sheet1', [['song_id','song_title']]), tracks]);
const vault = makeBook([makeSheet('track_notes', [['isrc','bpm','key','time_signature','chords','draft_lyrics','draft_abc','notes','updated'],
  [isrcs[5], '101', 'A minor', '4/4', 'Am F C G', 'secret lyric', '', 'PRIVATE NOTE', '']])]);
const props = { VAULT_SHEET_ID: vault.id };
const ctx = vm.createContext({ console: { log() {} },
  SpreadsheetApp: { getActiveSpreadsheet: () => book, getActive: () => book, create: () => { throw new Error('no create'); },
    openById: id => { if (id !== vault.id) throw new Error('nope'); return vault; } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock() {}, releaseLock() {} }) },
  Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? '2026-11-21' : '2026-11-21 10:00' }, Session: { getScriptTimeZone: () => 'Asia/Manila' }, DriveApp: {} });
['Code.gs','Shorts.gs','Singles.gs','Tracks.gs','Sync.gs'].forEach(f => vm.runInContext(fs.readFileSync(DIR + '/' + f, 'utf8'), ctx, { filename: f }));
const snap = () => JSON.stringify(book.sheets.map(s => [s.name, s.data]));
const throws = (fn, m) => { const b = snap(); let t = false; try { fn(); } catch (e) { t = true; } ok(t, 'should throw: ' + m); ok(snap() === b, 'sheet unchanged after reject: ' + m); };
const good = { sync_bpm: '120', sync_key: 'A minor', sync_moods: ['Happy', 'Hopeful'], sync_genre: 'Pop', sync_vocal: 'Solo vocal', sync_writers: 'Danyel OZ' };
const S = (i, d) => ctx.saveTrackSync(isrcs[i], Object.assign({}, good, d));
writes = 0; const a0 = ctx.getSyncAdmin(); ok(writes === 0, 'getSyncAdmin writes nothing');
ok(a0.tracks.find(t => t.isrc === isrcs[1]).sync_bpm === '95', 'hand-added numeric sync_bpm read');
ok(JSON.stringify(a0.hints).indexOf('PRIVATE') < 0 && JSON.stringify(a0.hints).indexOf('Am F') < 0, 'hints carry only bpm/key: ' + JSON.stringify(a0.hints));
['39', '221', '120.5', '120abc', '-50', '1e2', '0x50'].forEach(b => throws(() => S(0, { sync_bpm: b }), 'BPM ' + b));
throws(() => S(0, { sync_key: 'H major' }), 'key H major');
throws(() => S(0, { sync_moods: ['Happy', 'Hopeful', 'Romantic', 'Smooth'] }), '4 moods');
throws(() => S(0, { sync_moods: ['Grumpy'] }), 'unknown mood');
throws(() => S(0, { sync_moods: 'Happy,<b>x</b>' }), 'markup mood');
throws(() => S(0, { sync_vocal: 'Male vocal' }), 'vocal Male vocal');
throws(() => S(0, { sync_genre: 'Polka' }), 'genre Polka');
throws(() => S(0, { sync_genre_2: 'Pop' }), 'genre_2 == genre');
throws(() => S(0, { sync_stems: 'yes' }), 'flag yes');
throws(() => ctx.saveTrackSync('QZZZZ9999999', good), 'unknown ISRC');
throws(() => ctx.saveTrackSync('<script>', good), 'bad ISRC');
throws(() => S(0, { sync_writers: 'Danyel OZ IPI 123456789' }), 'IPI');
throws(() => S(0, { sync_writers: 'see https://drive.google.com/x' }), 'drive link');
throws(() => S(0, { sync_producers: 'me@x.com' }), 'email in producers');
throws(() => S(0, { sync_writers: 'x'.repeat(201) }), '201-char writers');
throws(() => S(0, { sync_writers: 'Danyel cae 12' }), 'CAE word');
const col = n => tracks.data[0].indexOf(n);
S(1, { sync_bpm: '40' }); ok(tracks.data[2][col('sync_bpm')] === '40', 'BPM 40 stored');
S(1, { sync_bpm: '220' }); ok(tracks.data[2][col('sync_bpm')] === '220', 'BPM 220 stored');
ok(col('sync_bpm') === HEAD.indexOf('sync_bpm'), 'hand-added sync_bpm reused in place');
ok(tracks.data[0].filter(h => h === 'sync_bpm').length === 1, 'single sync_bpm header');
S(0, { sync_writers: '<img src=x onerror=window.__pwn=1>', sync_producers: '\u0009=1+1', sync_moods: [] });
ok(tracks.data[1][col('sync_writers')] === '<img src=x onerror=window.__pwn=1>', 'markup stored verbatim as text');
ok(tracks.data[1][col('sync_producers')] === Q + '=1+1', 'TAB+formula neutralised: ' + JSON.stringify(tracks.data[1][col('sync_producers')]));
S(4, { sync_producers: ' =HYPERLINK(1)', stems_link: 'https://drive.google.com/secret', sync_instrumental: true });
ok(tracks.data[5][col('sync_producers')] === Q + '=HYPERLINK(1)', 'space+formula neutralised');
ok(col('stems_link') < 0, 'unknown key adds no column');
ok(tracks.data[5][col('sync_instrumental')] === 'TRUE', 'flag stored as string TRUE');
ok(unformatted === 0, 'every data write after @ format (' + unformatted + ')');
const syncCols = tracks.data[0].filter(h => /^sync_/.test(h));
ok(syncCols.length === 14, 'exactly 14 sync columns: ' + syncCols.join(','));
const diffs = [];
original.forEach((r, i) => r.forEach((v, j) => { const saved = [2, 1, 5].includes(i) && HEAD[j] === 'sync_bpm'; if (!saved && JSON.stringify(tracks.data[i][j]) !== JSON.stringify(v)) diffs.push(i + ':' + HEAD[j]); }));
ok(diffs.length === 0, 'original cells byte-equal; diffs=' + diffs.join(' '));
ok(tracks.data[3][col('sync_bpm')] === Q + '=1+1' && tracks.data[4][col('sync_bpm')] === '120', 'earlier hand cells in sync_bpm untouched');
for (let i = 0; i < 10; i++) S(i, { sync_featured: true });
throws(() => S(10, { sync_featured: true }), '11th featured');
S(3, { sync_featured: true });
const a1 = ctx.getSyncAdmin(); ok(a1.readiness.total === 12, 'readiness total 12');
ok(a1.readiness.complete === a1.tracks.filter(t => t.complete).length && a1.readiness.complete === 10, 'readiness count: ' + a1.readiness.complete);
const set = { rights_holder: 'Danyel OZ, LLC', rights_line: '', one_stop: true, pro_name: '', contact_email: 'daniel.vizkaino@gmail.com', contact_url: '', turnaround: '3 business days', process_note: '' };
const T = d => ctx.saveSyncSettings(Object.assign({}, set, d));
['https://evil.io/form', 'http://forms.gle/x', 'javascript:alert(1)', 'data:text/html,x', 'https://forms.gle.evil.io/x', 'https://forms.gle@evil.io/x',
 'https://forms.gle:8443/x', 'https://docs.google.com/document/d/x', '//forms.gle/x', 'https://www.danyeloz.info.evil.io/', 'https://danyeloz.info/x',
 ' javascript:x', 'https://evil.io/?u=https://forms.gle/'].forEach(u => throws(() => T({ contact_url: u }), 'contact_url ' + u));
['a@b.co?bcc=x@evil.io', 'a@b.co,x@evil.io', 'a@b.co%0Abcc:x@evil.io', 'a b@c.co', 'javascript:x@y.co', '', 'x@evil.io\u000abcc:y@z.io'].forEach(e => throws(() => T({ contact_email: e }), 'email ' + JSON.stringify(e)));
throws(() => T({ rights_line: 'x'.repeat(401) }), '401-char rights_line');
throws(() => T({ pro_name: 'ASCAP IPI 00123456789' }), 'IPI in pro_name');
throws(() => T({ rights_holder: '' }), 'blank rights_holder');
throws(() => T({ process_note: 'mail other@evil.io' }), 'other email in process_note');
const r = T({ contact_url: 'https://forms.gle/abc', updated: '1999-01-01', rights_holder: 'Danyel OZ, LLC <b>x</b>', extra_col: 'leak' });
const st = book.getSheetByName('sync_settings');
ok(st && st.data[0].join() === 'rights_holder,rights_line,one_stop,pro_name,contact_email,contact_url,turnaround,process_note,updated', 'settings headers: ' + (st && st.data[0].join()));
ok(st.data[1][8] === r.updated && st.data[1][8] !== '1999-01-01', 'updated set server-side');
ok(st.data[1][5] === 'https://forms.gle/abc', 'forms.gle accepted');
T({ contact_url: 'https://docs.google.com/forms/d/e/x/viewform' }); ok(st.data[1][5].indexOf('docs.google.com/forms/') > 0, 'google form accepted');
ok(ctx.getSyncAdmin().settings.pro_name === '', 'pro_name stays blank');
console.log(out.join('\n'));
console.log('probe_syncgs: ' + pass + ' pass, ' + fail + ' fail');
process.exit(fail ? 1 : 0);
