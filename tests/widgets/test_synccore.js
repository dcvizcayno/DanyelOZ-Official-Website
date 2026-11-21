// Unit test for danyeloz-embeds/sync-core.js (window.OZSync) in a Node vm, no browser, no network.
// Run from the repo root: node tests/widgets/test_synccore.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const mock = require('./mock-sheet');

const SRC = fs.readFileSync(mock.CORE_FILE, 'utf8');
const NOW = '2026-11-21';
const j = v => JSON.stringify(v);
const eq = (a, b, msg) => assert.strictEqual(j(a), j(b), msg);
let count = 0;
function ok(cond, msg) { assert.ok(cond, msg); count++; }
function same(a, b, msg) { eq(a, b, msg); count++; }

function load(tabs, log) {
  const made = [];
  const ctx = { URL, console, fetch: mock.fetchStub(tabs, log),
    document: { createElement: tag => { const e = { tagName: tag, className: '', textContent: '' }; made.push(e); return e; } } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'sync-core.js' });
  return { Z: ctx.OZSync, made };
}
// isTop: window.top === window at top level; a throwing getter (cross-origin parent) counts as framed.
function isTopCheck() {
  const t = { URL, console };
  t.window = t; t.top = t;
  vm.createContext(t); vm.runInContext(SRC, t);
  const top = t.OZSync.isTop();
  const c = { URL, console };
  c.window = c;
  Object.defineProperty(c, 'top', { get() { throw new Error('cross-origin'); } });
  vm.createContext(c); vm.runInContext(SRC, c);
  return top === true && c.OZSync.isTop() === false;
}
const tab = file =>load().Z.parseCsv(fs.readFileSync(path.join(mock.FIXTURES, file), 'utf8'));

(async () => {
  const { Z, made } = load();

  // ---- banned sinks (SR-01) ----
  ok(!/insertAdjacentHTML|outerHTML|document\.write|\beval\(|new Function|setAttribute\(\s*['"]on|innerHTML/.test(SRC), 'no HTML sinks in sync-core.js');
  ok(!/RegExp\(/.test(SRC), 'no RegExp built from input');
  const e = Z.el('b', 'x', '<img src=x onerror=1>');
  ok(e.textContent === '<img src=x onerror=1>' && e.className === 'x' && !('innerHTML' in e) && made.length === 1, 'el sets textContent only');

  // ---- lists equal Sync.gs ----
  const gs = fs.readFileSync(path.join(__dirname, '..', '..', 'apps-script', 'Sync.gs'), 'utf8');
  const list = n => vm.runInNewContext(gs.match(new RegExp('const ' + n + ' = (\\[[\\s\\S]*?\\]);'))[1]);
  same(Z.MOODS, list('SY_MOODS'), 'moods'); same(Z.GENRES, list('SY_GENRES'), 'genres');
  same(Z.VOCALS, list('SY_VOCALS'), 'vocals'); same(Z.KEYS, list('SY_KEYS'), 'keys');
  same(Z.VOCALS, ['Solo vocal', 'Duet', 'Instrumental only', 'Mixed'], 'D-9 vocals');
  ok(Z.MOODS.length === 20 && Z.GENRES.length === 12 && Z.KEYS.length === 24, 'list sizes');

  // ---- parseCsv ----
  const p = Z.parseCsv('A, B \r\n"x,1","say ""hi"""\n\n , \n"multi\nline",z');
  same(p.head, ['a', 'b'], 'headers trimmed and lower-cased');
  same(p.rows, [{ a: 'x,1', b: 'say "hi"' }, { a: 'multi\nline', b: 'z' }], 'quotes, blank rows, newlines');
  same(Z.parseCsv('').rows, [], 'empty text');

  // ---- fetchTab + header guard (SR-08) ----
  const log = [];
  const L = load({}, log).Z;
  const t1 = await L.fetchTab('tracks');
  ok(t1.ok && t1.rows.length === 17, 'tracks tab read');
  ok(log[0] === Z.BASE + '&sheet=tracks', 'gviz URL by sheet=');
  ok((await L.fetchTab('Sheet1')).ok && log[1] === Z.BASE + '&gid=0', 'Sheet1 by gid=0');
  ok((await L.fetchTab('sync_settings')).ok, 'settings tab read');
  const M = load({ sync_settings: null, tracks: null }).Z;
  const ms = await M.fetchTab('sync_settings'), mt = await M.fetchTab('tracks');
  ok(!ms.ok && ms.rows.length === 0 && !mt.ok && mt.rows.length === 0, 'missing tab (Sheet1 returned) is ignored');
  ok(!(await load({ tracks: 'tracks_nosync.csv' }).Z.fetchTab('tracks')).ok, 'tracks without sync_bpm is ignored');
  const F = (() => { const c = { URL, console, fetch: () => Promise.reject(new Error('net')) }; c.window = c; vm.createContext(c); vm.runInContext(SRC, c); return c.OZSync; })();
  ok(!(await F.fetchTab('tracks')).ok, 'network failure gives empty');

  // ---- values ----
  ok(Z.released({ first_release: '2026-11-21' }, NOW) && !Z.released({ first_release: '2026-11-22' }, NOW) && !Z.released({ first_release: '' }, NOW) && !Z.released({ first_release: '21/11/2026' }, NOW), 'released by SGT date');
  ok(/^\d{4}-\d{2}-\d{2}$/.test(Z.today()), 'today is ISO');
  ok(Z.flag('TRUE') && Z.flag('yes') && Z.flag(' x ') && !Z.flag('') && !Z.flag('FALSE') && !Z.flag('no'), 'flag parse');
  same(Z.moodList('Happy, <script>x</script>, Bogus, Sad, Dark, Epic'), ['Happy', 'Sad', 'Dark'], 'moods filtered and capped');
  ok(Z.inList('H major', Z.KEYS) === '' && Z.inList(' A minor ', Z.KEYS) === 'A minor', 'fixed-list values only');
  ok(Z.bpmOf('120') === 120 && Z.bpmOf('120abc') === null && Z.bpmOf('39') === null && Z.bpmOf('221') === null && Z.bpmOf('120.5') === null, 'bpm parse');
  same(['', 89, 90, 120, 121].map(b => Z.tempoOf(b === '' ? null : b)), ['', 'Slow', 'Medium', 'Medium', 'Fast'], 'tempo buckets');

  // ---- safeUrl / safeLink (SR-02) ----
  ['javascript:alert(1)', 'JaVaScRiPt:x', ' javascript:x', 'data:text/html,x', 'vbscript:x', 'http://open.spotify.com/x',
    'https://open.spotify.com.evil.io/', 'https://open.spotify.com@evil.io/', 'https://evil.io/?u=https://open.spotify.com/',
    'https://evilbandcamp.com/', 'https://bandcamp.com.evil.io/', 'https://open.spotify.com:8443/', '//open.spotify.com/',
    'https://bandcamp.com/x', 'https://a.b.bandcamp.com/x', 'https://.bandcamp.com/x', 'https://user:pw@open.spotify.com/', '', null, undefined,
    'https://drive.google.com/x', 'https://docs.google.com/forms/x'
  ].forEach(u => ok(Z.safeLink(u) === '', 'reject ' + j(u)));
  ['https://open.spotify.com/track/x', 'https://artist.bandcamp.com/track/y', 'https://music.apple.com/us/album/a', 'https://youtube.com/watch?v=1',
    'https://www.youtube.com/watch?v=1', 'https://music.youtube.com/watch?v=1', 'https://www.danyeloz.info/home', 'https://dcvizcayno.github.io/danyeloz-embeds/sync.html',
    'HTTPS://OPEN.SPOTIFY.COM/track/x'
  ].forEach(u => ok(/^https:\/\//.test(Z.safeLink(u)), 'accept ' + u));
  same(Z.safeLink('https://open.spotify.com/track/x'), 'https://open.spotify.com/track/x', 'href kept');

  // ---- covers (SR-11) ----
  ok(Z.coverUrl('https://evil.io/p.gif') === '' && Z.coverUrl('http://i.scdn.co/image/a') === '' && Z.coverUrl('javascript:x') === '', 'cover rejects');
  same(Z.coverUrl('https://drive.google.com/file/d/AbC_12-3/view?usp=sharing'), 'https://drive.google.com/thumbnail?id=AbC_12-3&sz=w1000', 'drive thumbnail');
  same(Z.coverUrl('https://drive.google.com/open?id=Zz9'), 'https://drive.google.com/thumbnail?id=Zz9&sz=w1000', 'drive id= link');
  ok(Z.coverUrl('https://drive.google.com/drive/folders') === '', 'drive without file id');
  ['https://i.scdn.co/image/a', 'https://lh3.googleusercontent.com/a', 'https://f4.bcbits.com/img/a.jpg', 'https://is1-ssl.mzstatic.com/a.jpg', 'https://is5-ssl.mzstatic.com/a.jpg']
    .forEach(u => ok(Z.coverUrl(u) === u, 'cover accept ' + u));

  // ---- email and contact (SR-04, D-10) ----
  ['a@b.co?bcc=x@evil.io', 'a@b.co,x@evil.io', 'a@b.co%0Abcc:x@evil.io', 'a b@c.co', 'javascript:x@y.co', 'a@b', 'a@b.c', '', 'a@b.co\nbcc:x@y.co', 'x'.repeat(250) + '@b.co',
    'x%40evil.io%2Cdaniel@gmail.com', 'a%0Ab@c.co', 'a%0Abcc%3Ax%40evil.io@b.co']   // N-1: no percent sign in the local part
    .forEach(m => ok(!Z.validEmail(m), 'email reject ' + j(m)));
  ok(Z.validEmail('daniel.vizkaino@gmail.com') && Z.validEmail(' first.last+tag@sub.example.org '), 'email accept');
  const href = Z.contactHref({ contact_email: 'daniel.vizkaino@gmail.com' }, 'A&B?cc=x');
  same(href, 'mailto:daniel.vizkaino@gmail.com?subject=' + encodeURIComponent('License request: A&B?cc=x'), 'mailto subject only');
  ok(href.split('?').length === 2 && /%26/.test(href) && /%3F/.test(href), 'only ? precedes subject=, & and ? encoded');
  ok(Z.contactHref({ contact_email: 'a@b.co?bcc=x@evil.io' }, 'T') === '', 'bad email gives no link');
  same(Z.contactHref({ contact_url: 'https://forms.gle/abc', contact_email: 'a@b.co' }, 'T'), 'https://forms.gle/abc', 'contact_url preferred');
  same(Z.contactHref({ contact_url: 'https://docs.google.com/forms/d/e/x/viewform' }, 'T'), 'https://docs.google.com/forms/d/e/x/viewform', 'google form');
  same(Z.contactUrl('https://www.danyeloz.info/contact'), 'https://www.danyeloz.info/contact', 'site contact page');
  ['https://evil.io/', 'https://docs.google.com/spreadsheets/d/x', 'http://forms.gle/a', 'javascript:x', 'https://forms.gle.evil.io/',
   'https://docs.google.com/forms/../spreadsheets/d/x', 'https://docs.google.com/forms/%2e%2e/document/d/x', 'https://docs.google.com/forms/%2E%2E/x',
   'https://www.danyeloz.info/contact/../../x', 'https://forms.gle/./abc', 'https://forms.gle/abc/..', 'https://docs.google.com/forms\\..\\spreadsheets/d/x']   // N-2
    .forEach(u => ok(Z.contactHref({ contact_url: u, contact_email: 'daniel.vizkaino@gmail.com' }, 'T').indexOf('mailto:') === 0, 'contact_url rejected, mailto fallback ' + u));
  ok(Z.contactHref(null, 'T') === '', 'no settings, no link');
  // mailtoHref: the panel's "Open in your email app" link ignores contact_url, same encoded-subject-only shape (T-001).
  same(Z.mailtoHref({ contact_url: 'https://forms.gle/abc', contact_email: 'daniel.vizkaino@gmail.com' }, 'A&B?cc=x'),
    'mailto:daniel.vizkaino@gmail.com?subject=' + encodeURIComponent('License request: A&B?cc=x'), 'mailtoHref ignores contact_url');
  ok(Z.mailtoHref({ contact_email: 'a@b.co?bcc=x@evil.io' }, 'T') === '' && Z.mailtoHref(null, 'T') === '', 'mailtoHref: bad or no email gives no link');
  ['requestPanel', 'openRequest', 'renderOneSheet', 'isTop'].forEach(n => ok(typeof Z[n] === 'function', 'exports ' + n));
  same(Z.INCLUDE.join('|'), 'The song|Your project (title and a short description)|The media (film, TV, ad, game, online video)|The territory|The term|Your timeline', 'request checklist (C-1)');
  ok(Z.CATALOGUE_URL === Z.safeLink(Z.CATALOGUE_URL) && Z.ONE_SHEET_URL === Z.safeLink(Z.ONE_SHEET_URL), 'page URLs pass safeLink');
  ok(!/—/.test(SRC) && !/\b(he|his|him|she|her|hers)\b/i.test(SRC.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replace(/[a-z]+(he|her)[a-z]*/gi, '')), 'no em dash or gendered pronoun in sync-core.js');
  ok(isTopCheck(), 'isTop is true at top level and false when window.top throws');

  // ---- settings, rights and process wording (C-5, SR-08) ----
  const D = Z.settings(null);
  ok(D.rights_holder === 'Danyel OZ, LLC' && D.one_stop === true && D.contact_email === 'daniel.vizkaino@gmail.com' && D.turnaround === '3 business days' && D.pro_name === '' && !D.from_sheet, 'D-5 defaults');
  const RD = 'One-stop clearance. Danyel OZ, LLC owns 100% of the master recordings and 100% of the publishing, so one agreement clears both sides. Songs are registered with a performing rights organization.';
  same(Z.rightsText(D), RD, 'default rights text'); same(Z.rightsText(), RD, 'rightsText() uses defaults');
  same(Z.rightsText(Z.settings(tab('sync_settings.csv'))), RD, 'sheet settings, blank PRO');
  same(Z.rightsText(Z.settings(tab('sheet1.csv'))), RD, 'Sheet1-shaped settings tab gives defaults');
  ok(Z.rightsText(Z.settings(tab('sheet1.csv'))).indexOf('Sheet1') < 0, 'no Sheet1 text in rights');
  same(Z.rightsText({ rights_holder: 'X LLC', one_stop: false }), 'X LLC owns 100% of the master recordings and 100% of the publishing. Songs are registered with a performing rights organization.', 'not one-stop');
  same(Z.rightsText({ one_stop: 'TRUE', pro_name: 'ASCAP' }), RD.replace('a performing rights organization', 'ASCAP'), 'PRO named');
  const P = Z.settings(tab('sync_settings_pro.csv'));
  same(Z.rightsText(P), 'Custom rights line. Songs are registered with BMI.', 'rights_line replaces main sentences, never the PRO sentence');
  ok(P.rights_holder === 'Danyel OZ, LLC' && P.one_stop === false && P.contact_url === 'https://forms.gle/abc123' && P.from_sheet, 'first row only');
  same(Z.processText(D), 'To license a song, send a request with the song, your project, the media, the territory and the term. You get a quote within 3 business days. We sign a simple license, and the files are delivered after signing: WAV plus instrumental, clean, stems or cutdowns where available.', 'process text');
  ok(/within 2 business days\. .* Student films welcome\.$/.test(Z.processText(P)), 'turnaround and process_note');
  ok(!/same[- ]day|today|immediately/i.test(Z.processText(D) + Z.rightsText(D)), 'no same-day promise');
  const B = Z.settings(tab('sync_settings_bad.csv'));
  ok(B.contact_email === 'daniel.vizkaino@gmail.com' && B.contact_url === '' && B.turnaround === '3 business days', 'bad settings fall back');
  ok(Z.contactHref(B, 'T').indexOf('mailto:daniel.vizkaino@gmail.com?subject=') === 0, 'bad contact_url renders the mailto');
  ok(Z.rightsText(B).indexOf('<img src=x onerror=window.__pwn=4>') >= 0, 'sheet text passed through as plain text (rendered via textContent)');

  // ---- songs: released filter, join, sanitising ----
  const S = Z.songs(tab('tracks.csv'), tab('sheet1.csv'), NOW);
  ok(S.length === 15, 'released songs only (unreleased and undated dropped): ' + S.length);
  ok(!S.some(s => s.title === 'Unreleased Featured' || s.title === 'No Date'), 'unreleased hidden');
  ok(S[0].title === 'Complete Newest' && S.every((s, i) => !i || S[i - 1].release >= s.release), 'newest first');
  const by = t => S.find(s => s.title === t);
  const x = S.find(s => s.isrc === 'QZRP42500001');
  ok(x.title === '<img src=x onerror=window.__pwn=1>' && x.listen === '' && x.cover === '' && j(x.links) === j({ spotify: '', apple: '', youtube: '', bandcamp: '' }), 'javascript:, look-alike and evil cover dropped');
  same(S.find(s => s.isrc === 'QZRP42500002').cover, 'https://drive.google.com/thumbnail?id=AbC_12-3&sz=w1000', 'join by upc, drive cover');
  const s3 = S.find(s => s.isrc === 'QZRP42500003');
  ok(s3.cover === '' && s3.links.spotify === '' && s3.listen === 'https://music.apple.com/us/album/a03', 'http links dropped, next link used');
  const s4 = S.find(s => s.isrc === 'QZRP42500004');
  ok(s4.links.bandcamp === 'https://danyeloz.bandcamp.com/track/t04' && s4.listen === 'https://open.spotify.com/track/s04' && s4.cover === 'https://i.scdn.co/image/c04', 'bandcamp page from embed');
  same(s4.badges, ['Instrumental', 'Stems', '30 s'], 'badges');
  ok(s4.bpm === 94 && s4.tempo === 'Medium' && s4.key === 'A minor' && s4.complete && s4.featured, 'song fields');
  const bv = by('Bad Values');
  ok(bv.bpm === null && bv.key === '' && bv.genre === '' && bv.vocal === '' && j(bv.moods) === j(['Happy', 'Sad', 'Dark']) && !bv.complete, 'unknown list values dropped');
  ok(!by('Incomplete No Writers').complete && by('Complete Older').complete, 'D-4 completeness');
  const noJoin = Z.songs(tab('tracks.csv'), tab('sync_settings.csv'), NOW);
  ok(noJoin.length === 15 && noJoin.every(s => s.listen === '' && s.cover === ''), 'Sheet1 without song_upc is ignored');
  same(Z.songs(tab('tracks_nosync.csv'), tab('sheet1.csv'), NOW), [], 'tracks without sync columns gives no songs');
  same(Z.songs(tab('sheet1.csv'), tab('sheet1.csv'), NOW), [], 'Sheet1-shaped tracks gives no songs');
  ok(Z.songs(tab('tracks.csv'), tab('sheet1.csv')).length >= 15, 'songs() defaults to today');

  // ---- filters ----
  ok(Z.filter(S, {}).length === 15 && Z.filter(S, { tempo: 'Any' }).length === 15, 'no filter');
  same(Z.filter(S, { mood: 'Sad' }).map(s => s.title).sort(), ['Bad Values', 'Song 03'], 'mood');
  same(Z.filter(S, { genre: 'Soul' }).map(s => s.title), ['Song 03'], 'genre');
  ok(Z.filter(S, { genre: 'R&B' }).length === 14, 'second genre matches');
  same(Z.filter(S, { vocal: 'Duet' }).map(s => s.title), ['Song 03'], 'vocal');
  ok(Z.filter(S, { tempo: 'Slow' }).every(s => s.bpm < 90) && Z.filter(S, { tempo: 'Slow' }).length === 3, 'slow');
  ok(Z.filter(S, { tempo: 'Fast' }).every(s => s.bpm > 120) && Z.filter(S, { tempo: 'Medium' }).every(s => s.bpm >= 90 && s.bpm <= 120), 'fast/medium');
  ok(Z.filter(S, { mood: 'Bogus' }).length === 15 && Z.filter(S, { tempo: 'Warp' }).length === 15, 'unknown filter values ignored');
  same(Z.filter(S, { q: '  complete   NEWEST ' }).map(s => s.title), ['Complete Newest'], 'search');
  ok(Z.filter(S, { q: '(a+)+$' }).length === 0 && Z.filter(S, { q: 'x'.repeat(500) }).length === 0, 'search is plain text');
  ok(Z.filter(S, { has: ['stems', 'instrumental'] }).length === 15 && Z.filter(S, { has: ['clean'] }).length === 0, 'availability');
  ok(Z.filter(S, { key: 'A minor', language: 'english' }).length === 14, 'key and language');

  // ---- one-sheet selection (C-4) ----
  const one = Z.pickOneSheet(S);
  ok(one.length === 10 && one.every(s => s.featured && s.released), '11 featured -> max 10');
  same(one.map(s => s.isrc.slice(-2)), ['11', '10', '09', '08', '07', '06', '05', '04', '03', '02'], 'newest featured first');
  const few = Z.pickOneSheet(Z.songs(tab('tracks_few.csv'), tab('sheet1.csv'), NOW));
  same(few.map(s => s.title), ['Song 03', 'Song 02', 'Song 01', 'Song 10', 'Song 09', 'Song 08', 'Song 07', 'Song 06'], '3 featured topped up to 8 with newest complete');
  ok(!few.some(s => s.title === 'Few Incomplete' || s.title === 'Few Unreleased'), 'top-up skips incomplete and unreleased');
  same(Z.pickOneSheet(S.filter(s => !s.featured && s.complete)).length, 2, 'fewer than 8 available shows what exists');

  // ---- load() ----
  const all = await load({}).Z.load();
  ok(all.ok && all.songs.length >= 15 && all.settings.from_sheet, 'load reads all tabs');
  const miss = await load({ tracks: null, sync_settings: null }).Z.load();
  ok(!miss.ok && miss.songs.length === 0 && !miss.settings.from_sheet && miss.settings.rights_holder === 'Danyel OZ, LLC', 'load with missing tabs: fallback + defaults');

  // ---- mock routing ----
  ok(mock.resolve(mock.CORE_URL).body === SRC && mock.resolve('https://evil.io/') === null, 'mock routes sync-core.js, nothing else');

  console.log('test_synccore: ' + count + ' checks');
  console.log('PASSED');
})().catch(err => { console.error(err && err.stack || err); process.exit(1); });
