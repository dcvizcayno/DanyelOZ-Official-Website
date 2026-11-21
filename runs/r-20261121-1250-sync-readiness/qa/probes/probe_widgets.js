// QA T-011 independent probe of sync.html / sync-one-sheet.html with own planted fixtures, pinned clock, 1400 and 390 px.
// Usage (from the private repo root): node runs/r-20261121-1250-sync-readiness/qa/probes/probe_widgets.js
const path = require('path'), fs = require('fs'), vm = require('vm');
const { chromium } = require(path.resolve('node_modules/playwright'));
const EMB = 'E:/Projects/danyeloz-embeds';
const CORE = 'https://dcvizcayno.github.io/danyeloz-embeds/sync-core.js';
let pass = 0, fail = 0; const out = [];
const ok = (c, m) => { if (c) pass++; else { fail++; out.push('FAIL ' + m); } };
const X = '<img src=x onerror=window.__pwn=1>', XS = '<script>window.__pwn=2</script>', XV = '"><svg onload=window.__pwn=3>';
const csv = rows => rows.map(r => r.map(v => '"' + String(v).replace(/"/g, '""') + '"').join(',')).join('\n') + '\n';
const p2 = n => String(n).padStart(2, '0');
const TH = ['isrc','track_title','artist','duration','explicit','first_release','first_upc','releases','language','lyrics','abc','sync_bpm','sync_key','sync_moods',
  'sync_genre','sync_genre_2','sync_vocal','sync_writers','sync_producers','sync_instrumental','sync_clean','sync_stems','sync_cut60','sync_cut30','sync_featured'];
const T = [];
function add(i, o) { const d = Object.assign({ isrc: 'QZQAB26000' + p2(i), track_title: 'Feat ' + p2(i), artist: 'Danyel OZ', duration: '3:00', explicit: 'FALSE',
  first_release: '2025-' + p2(Math.min(i, 12)) + '-01', first_upc: '19900000' + '00' + p2(i), releases: '1', language: 'English', lyrics: '', abc: '', sync_bpm: String(80 + i),
  sync_key: 'A minor', sync_moods: 'Happy, Hopeful', sync_genre: 'Pop', sync_genre_2: '', sync_vocal: 'Solo vocal', sync_writers: 'Danyel OZ', sync_producers: 'Danyel OZ',
  sync_instrumental: 'TRUE', sync_clean: '', sync_stems: '', sync_cut60: '', sync_cut30: '', sync_featured: 'TRUE' }, o); T.push(TH.map(h => d[h])); }
for (let i = 1; i <= 11; i++) add(i, i === 1 ? { track_title: X, sync_writers: XS, sync_producers: XV, sync_moods: 'Happy, ' + X, sync_key: X, sync_genre_2: XS, sync_vocal: XV }
  : i === 3 ? { track_title: 'FourMoods', sync_moods: 'Happy, Hopeful, Romantic, Smooth' } : {});
add(12, { track_title: 'UNRELEASED_SECRET', first_release: '2027-03-01' });
add(13, { track_title: 'TOMORROW_SECRET', first_release: '2026-11-22' });
add(14, { track_title: 'Bpm39', sync_bpm: '39', sync_featured: '', first_release: '2024-01-01' });
add(15, { track_title: 'Bpm221', sync_bpm: '221', sync_featured: '', first_release: '2024-01-02' });
add(16, { track_title: 'Bpm1205', sync_bpm: '120.5', sync_featured: '', first_release: '2024-01-03' });
const TRACKS = csv([TH].concat(T));
const SH = ['song_id','song_title','release_date','release_type','song_genre','song_description','song_ISRC','song_qr','song_upc','record_label','yt_video_link','spotify_link','appl_music_link','amazon_link','bandcamp_embed','song_arts'];
const BADLINK = { 1: 'javascript:window.__pwn=7', 2: 'https://open.spotify.com.evil.io/x', 3: 'https://open.spotify.com@evil.io/', 4: 'data:text/html,x', 5: 'http://open.spotify.com/track/x', 6: ' JaVaScRiPt:x', 7: 'https://open.spotify.com:8443/x' };
const S1 = [SH].concat(Array.from({ length: 16 }, (_, k) => { const i = k + 1; return [i, 'Sheet1 Title ' + i, '2025-01-01', 'Single', 'Pop', 'SHEET1_DESC', 'QZQAB26000' + p2(i), '',
  '19900000' + '00' + p2(i), '', i === 2 ? 'https://www.youtube.com.evil.io/watch' : '', BADLINK[i] || 'https://open.spotify.com/track/t' + i, i === 3 ? 'vbscript:x' : '', '',
  i === 2 ? '<a href="https://evilbandcamp.com/x">x</a>' : '', i === 1 ? 'https://evil.io/p.gif' : i === 4 ? 'data:image/png;base64,AAAA' : '']; }));
const SHEET1 = csv(S1);
const SET_HEAD = ['rights_holder','rights_line','one_stop','pro_name','contact_email','contact_url','turnaround','process_note','updated'];
const SET_CLEAN = csv([SET_HEAD, ['Danyel OZ, LLC', '', 'TRUE', '', 'daniel.vizkaino@gmail.com', '', '3 business days', '', '2026-11-21']]);
const SET_BAD = csv([SET_HEAD, [X, '', 'TRUE', XS, 'a@b.co?bcc=x@evil.io', 'javascript:alert(1)', XV, X, X]]);
const SET_EVILURL = csv([SET_HEAD, ['Danyel OZ, LLC', '', 'TRUE', '', 'daniel.vizkaino@gmail.com', 'https://evil.io/', '3 business days', '', '']]);
async function open(browser, file, width, tabs, opts) {
  opts = opts || {};
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  const errors = [], reqs = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.clock.setFixedTime(new Date(opts.now || '2026-11-21T12:00:00+08:00'));
  await page.route(/^https?:\/\//, r => {
    const u = r.request().url(); reqs.push(u);
    if (u.split('?')[0] === CORE) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(EMB + '/sync-core.js', 'utf8') });
    const m = u.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/gviz\/tq\?(.*)$/);
    if (!m) return r.abort();
    const name = new URLSearchParams(m[1]).get('sheet') || 'Sheet1';
    const body = tabs[name] != null ? tabs[name] : tabs.Sheet1;          // gviz: unknown tab answers with Sheet1
    return r.fulfill({ status: 200, contentType: 'text/csv', body, headers: { 'Access-Control-Allow-Origin': '*' } });
  });
  await page.goto('file:///' + EMB + '/' + file + (opts.qs || ''));
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => ({
    pwn: typeof window.__pwn, text: document.body.innerText, sw: document.documentElement.scrollWidth,
    links: Array.from(document.querySelectorAll('[href],[src]')).filter(e => e.tagName !== 'SCRIPT' && e.tagName !== 'LINK').map(e => e.getAttribute('href') || e.getAttribute('src')),
    scripts: Array.from(document.querySelectorAll('script[src]')).map(s => s.src),
    handlers: Array.from(document.querySelectorAll('body *')).filter(e => Array.from(e.attributes).some(a => /^on/i.test(a.name))).length,
    dataEls: document.querySelectorAll('body img[src="x"], body svg[onload], #sy script, #os script').length,
    cards: Array.from(document.querySelectorAll('.sy-card')).map(c => c.innerText),
    rights: (document.querySelector('.sy-rights, .os-rights') || {}).innerText || ''
  }));
  return { page, errors, reqs, info };
}
const LINK_OK = /^https:\/\/(open\.spotify\.com|music\.apple\.com|[a-z0-9-]+\.bandcamp\.com|(www\.|music\.)?youtube\.com|www\.danyeloz\.info|dcvizcayno\.github\.io|drive\.google\.com|lh3\.googleusercontent\.com|f4\.bcbits\.com|is[1-5]-ssl\.mzstatic\.com|i\.scdn\.co|forms\.gle|docs\.google\.com\/forms)\//;
const MAILTO_OK = /^mailto:daniel\.vizkaino@gmail\.com\?subject=[^?&]*$/;
function common(r, label, width) {
  ok(r.errors.length === 0, label + ' page errors ' + JSON.stringify(r.errors));
  ok(r.info.pwn === 'undefined', label + ' __pwn ' + r.info.pwn);
  ok(r.info.handlers === 0 && r.info.dataEls === 0, label + ' no data-built elements/handlers ' + r.info.handlers + '/' + r.info.dataEls);
  const bad = r.info.links.filter(h => h && !h.startsWith('#') && !LINK_OK.test(h) && !MAILTO_OK.test(h));
  ok(bad.length === 0, label + ' unsafe href/src: ' + JSON.stringify(bad));
  ok(!r.reqs.some(u => /evil/.test(u)), label + ' request to evil host');
  ok(r.info.sw <= width, label + ' scrollWidth ' + r.info.sw + ' > ' + width);
  ok(!/UNRELEASED_SECRET|TOMORROW_SECRET|SHEET1_DESC|Sheet1 Title/i.test(r.info.text), label + ' leaked unreleased/Sheet1 text');
  ok(r.info.scripts.every(s => s.split('?')[0] === CORE), label + ' third-party script ' + JSON.stringify(r.info.scripts));
}
// Node side: OZSync.rightsText vs the admin preview syRights (TracksApp.html) over a settings matrix, and the contact copy.
const win = {}; vm.runInNewContext(fs.readFileSync(EMB + '/sync-core.js', 'utf8'), { window: win, document: {}, URL, Intl, Date, Promise, fetch: () => Promise.reject(new Error('no')) });
const OZ = win.OZSync;
const appSrc = fs.readFileSync('apps-script/TracksApp.html', 'utf8');
const fnSrc = appSrc.match(/function syRights\(v\) \{[\s\S]*?\n  \}/)[0];
const syRights = vm.runInNewContext('(' + fnSrc + ')');
const DEF = OZ.settings(null);
const matrix = [{}, { pro_name: 'BMI' }, { one_stop: false }, { rights_line: 'Custom line.' }, { rights_holder: 'Danyel OZ, LLC', pro_name: '' }, { rights_holder: X, pro_name: XS }];
matrix.forEach((m, i) => { const s = Object.assign({}, DEF, m); ok(OZ.rightsText(s) === syRights(s), 'admin preview == widget rightsText case ' + i + ': ' + syRights(s) + ' | ' + OZ.rightsText(s)); });
const DEFAULT_RIGHTS = OZ.rightsText(DEF);
ok(/Danyel OZ, LLC/.test(DEFAULT_RIGHTS) && /100% of the master/.test(DEFAULT_RIGHTS) && /100% of the publishing/.test(DEFAULT_RIGHTS) && /One-stop/i.test(DEFAULT_RIGHTS), 'default rights wording: ' + DEFAULT_RIGHTS);
const doc = fs.readFileSync('docs/sync-contact-copy.md', 'utf8');
ok(doc.indexOf(DEFAULT_RIGHTS) >= 0, 'contact copy contains the exact default rights text');
ok(doc.indexOf(OZ.processText(DEF)) >= 0 || /3 business days/.test(doc), 'contact copy has the 3-business-day promise');
const PROS = /\b(ASCAP|BMI|SESAC|GMR|SOCAN|PRS|APRA|AMCOS|GEMA|SACEM|JASRAC|FILSCAP|KOMCA|COMPASS|MCSC|IPRS|SGAE|SIAE|STIM|TONO|KODA|BUMA)\b/;
['sync.html', 'sync-one-sheet.html', 'sync-core.js'].forEach(f => ok(!PROS.test(fs.readFileSync(EMB + '/' + f, 'utf8')), 'no PRO name in ' + f));
ok(!PROS.test(doc), 'no PRO name in contact copy');

(async () => {
  const browser = await chromium.launch();
  const ALL = { tracks: TRACKS, Sheet1: SHEET1, sync_settings: SET_BAD };
  for (const w of [1400, 390]) {
    let r = await open(browser, 'sync.html', w, ALL); common(r, 'catalogue planted ' + w, w);
    ok(r.info.text.indexOf(X) >= 0 && r.info.text.indexOf(XS) >= 0, 'catalogue ' + w + ' planted markup visible as text');
    ok(r.info.cards.length === 14, 'catalogue ' + w + ' released cards 14, got ' + r.info.cards.length);
    const c = t => r.info.cards.find(x => x.indexOf(t) >= 0) || '';
    ok(!/\b39\b/.test(c('Bpm39')) && !/\b221\b/.test(c('Bpm221')) && !/120\.5|\b120\b/.test(c('Bpm1205')), 'catalogue ' + w + ' out-of-range BPM hidden: ' + JSON.stringify([c('Bpm39'), c('Bpm221'), c('Bpm1205')]));
    ok(/Romantic/i.test(c('FourMoods')) && !/Smooth/i.test(c('FourMoods')), 'catalogue ' + w + ' 4th mood dropped: ' + c('FourMoods'));
    ok(r.info.rights === OZ.rightsText(Object.assign({}, OZ.settings({ ok: true, head: SET_HEAD, rows: [] })))  || r.info.rights.indexOf('Songs are registered with') >= 0, 'catalogue rights block present');
    const req = await r.page.$$eval('a', as => as.map(a => a.getAttribute('href')).filter(h => /^mailto:|forms|evil|javascript/i.test(h || '')));
    ok(req.length > 0 && req.every(h => MAILTO_OK.test(h)), 'catalogue ' + w + ' request links use the default mailto only: ' + JSON.stringify(req.slice(0, 3)));
    await r.page.screenshot({ path: path.resolve('runs/r-20261121-1250-sync-readiness/qa/probes/cat-' + w + '.png'), fullPage: true }); await r.page.close();
    r = await open(browser, 'sync.html', w, { tracks: TRACKS, Sheet1: SHEET1, sync_settings: null }); common(r, 'catalogue missing-settings ' + w, w);
    ok(r.info.text.indexOf(DEFAULT_RIGHTS) >= 0, 'catalogue missing tab -> default rights text');
    await r.page.close();
    r = await open(browser, 'sync.html', w, { tracks: null, Sheet1: SHEET1, sync_settings: null }); common(r, 'catalogue missing-tracks ' + w, w);
    ok(r.info.cards.length === 0 && r.info.text.trim().length > 0, 'catalogue missing tracks tab -> fallback, no cards');
    await r.page.close();
  }
  // pinned-clock proof: after 2027-03-01 the same fixture shows the row (filter is date-driven, not title-driven)
  let r = await open(browser, 'sync.html', 1400, { tracks: TRACKS, Sheet1: SHEET1, sync_settings: SET_CLEAN }, { now: '2027-03-02T12:00:00+08:00' });
  ok(/UNRELEASED_SECRET/.test(r.info.text) && /TOMORROW_SECRET/.test(r.info.text), 'clock 2027-03-02: both future rows now listed'); await r.page.close();
  r = await open(browser, 'sync.html', 1400, { tracks: TRACKS, Sheet1: SHEET1, sync_settings: SET_EVILURL });
  const hrefs = await r.page.$$eval('a', as => as.map(a => a.getAttribute('href')));
  ok(!hrefs.some(h => /evil/.test(h || '')) && hrefs.some(h => MAILTO_OK.test(h || '')), 'contact_url evil.io -> mailto fallback'); await r.page.close();
  const OS = { tracks: TRACKS, Sheet1: SHEET1, sync_settings: SET_CLEAN };
  for (const w of [1400, 390]) {
    r = await open(browser, 'sync-one-sheet.html', w, OS); common(r, 'one-sheet ' + w, w);
    const feats = ['Feat 02', 'Feat 04', 'Feat 05', 'Feat 06', 'Feat 07', 'Feat 08', 'Feat 09', 'Feat 10', 'Feat 11', 'FourMoods'];
    ok(feats.every(t => r.info.text.indexOf(t) >= 0) && r.info.text.indexOf(X) < 0, 'one-sheet ' + w + ': newest 10 of 11 featured, oldest dropped');
    ok(r.info.text.indexOf(DEFAULT_RIGHTS) >= 0, 'one-sheet ' + w + ' rights text == default rightsText');
    ok(/3 business days/.test(r.info.text) && /daniel\.vizkaino@gmail\.com/.test(r.info.text), 'one-sheet ' + w + ' contact and turnaround');
    if (w === 1400) {
      for (const fmt of ['A4', 'Letter']) { const pdf = (await r.page.pdf({ format: fmt, printBackground: true })).toString('latin1');
        const n = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length; ok(n === 1, 'one-sheet prints ' + n + ' ' + fmt + ' pages'); out.push('info ' + fmt + ' pages=' + n); }
      const base = { text: r.info.text, links: r.info.links };
      const q = '?email=x@evil.io&contact_url=https://evil.io&contact_email=x@evil.io&rights_line=' + encodeURIComponent('<b>pwn</b>') + '&date=2099-01-01&songs=' + encodeURIComponent(X) + '&pro_name=ASCAP';
      const r2 = await open(browser, 'sync-one-sheet.html', w, OS, { qs: q }); common(r2, 'one-sheet params', w);
      ok(r2.info.text === base.text && JSON.stringify(r2.info.links) === JSON.stringify(base.links), 'one-sheet ignores address-bar values'); await r2.page.close();
      const r3 = await open(browser, 'sync.html', w, OS, { qs: q });
      const r4 = await open(browser, 'sync.html', w, OS);
      ok(r3.info.text === r4.info.text && JSON.stringify(r3.info.links) === JSON.stringify(r4.info.links), 'catalogue ignores address-bar values'); await r3.page.close(); await r4.page.close();
    }
    await r.page.screenshot({ path: path.resolve('runs/r-20261121-1250-sync-readiness/qa/probes/os-' + w + '.png'), fullPage: true }); await r.page.close();
  }
  r = await open(browser, 'sync-one-sheet.html', 1400, { tracks: TRACKS, Sheet1: SHEET1, sync_settings: SET_BAD }); common(r, 'one-sheet planted settings', 1400);
  ok(r.info.text.indexOf(X) >= 0 || r.info.text.indexOf(XS) >= 0, 'one-sheet planted settings shown as text'); await r.page.close();
  r = await open(browser, 'sync-one-sheet.html', 1400, { tracks: TRACKS, Sheet1: SHEET1, sync_settings: null }); common(r, 'one-sheet missing settings', 1400);
  ok(r.info.text.indexOf(DEFAULT_RIGHTS) >= 0, 'one-sheet missing tab -> default rights'); await r.page.close();
  await browser.close();
  console.log(out.join('\n'));
  console.log('probe_widgets: ' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
