/* Danyel OZ admin: Tracks screen (server side).
   Public, in the Song Database (anyone with the link can read these):
     tracks          one row per recording (ISRC): title, artist, length, explicit, first release,
                     language, lyrics and abc (music score), both only once the song is out.
     release_tracks  one row per song on a release (UPC): disc, track number, ISRC, title, length, bonus.
   Private, in "Danyel OZ Song Vault (private)" (created on first use, ID in Script Properties VAULT_SHEET_ID):
     track_fixes     what's wrong with an ISRC and the republish plan (new ISRC, new UPC, status).
     track_notes     drafts and studio notes: BPM, key, time signature, chords, draft lyrics, draft score.
   A release has one UPC. A single holds one ISRC, an EP or album many, and one ISRC can sit on several
   releases (waterfall singles), which is why songs live once in tracks and are linked in release_tracks. */

const TRACKS_TAB = 'tracks';
const TRACK_COLUMNS = ['isrc', 'track_title', 'artist', 'duration', 'explicit', 'first_release', 'first_upc',
  'releases', 'language', 'lyrics', 'abc'];
const TRACK_TEXT_COLUMNS = ['isrc', 'track_title', 'artist', 'duration', 'first_release', 'first_upc', 'language', 'lyrics', 'abc'];
const RT_TAB = 'release_tracks';
const RT_COLUMNS = ['upc', 'release_title', 'disc', 'track_number', 'isrc', 'track_title', 'duration', 'bonus'];
const RT_TEXT_COLUMNS = ['upc', 'release_title', 'isrc', 'track_title', 'duration', 'bonus'];

const VAULT_BOOK_NAME = 'Danyel OZ Song Vault (private)';
const FIX_TAB = 'track_fixes';
const FIX_COLUMNS = ['isrc', 'issue', 'status', 'plan', 'new_isrc', 'new_upc', 'new_title', 'notes', 'updated'];
const FIX_STATUSES = ['To check', 'Keep as is', 'Republish planned', 'Sent to DistroKid', 'Republished'];
const FIX_PLANS = ['', 'New ISRC', 'New UPC', 'New ISRC and UPC', 'Fix the title only'];
const NOTE_TAB = 'track_notes';
const NOTE_COLUMNS = ['isrc', 'bpm', 'key', 'time_signature', 'chords', 'draft_lyrics', 'draft_abc', 'notes', 'updated'];

const ISRC_RE = /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/;
const UPC_RE = /^\d{12,13}$/;
const TEXT_MAX = 45000;              // a cell holds 50,000 characters; leave room
const LENGTH_GAP = 20;               // seconds; more than this between releases of one ISRC is worth a look
const ARTISTS = ['Danyel OZ', 'M4RCU$ H33R0'];

/* ---------- Helpers ---------- */

function trTodayManila_() { return Utilities.formatDate(new Date(), 'Asia/Manila', 'yyyy-MM-dd'); }
function trIsrc_(v) { return String(v || '').replace(/[\s-]/g, '').toUpperCase(); }
function trUpc_(v) { return String(v || '').replace(/^'/, '').replace(/\D/g, ''); }
function trSecs_(d) { const m = String(d || '').match(/^(\d+):([0-5]\d)$/); return m ? Number(m[1]) * 60 + Number(m[2]) : null; }
function trBase_(s) {      // the song name without version tags, for comparing titles across releases
  return String(s || '').toLowerCase()
    .replace(/\s*\((radio edit|special version|original version|english version|spanish version|live|piano|acoustic)\)/g, '')
    .replace(/[’']/g, "'").replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
}
function trClip_(s, max) { s = String(s == null ? '' : s).replace(/\r\n?/g, '\n'); return s.length > max ? s.slice(0, max) : s; }

/* A public tab of the Song Database, with its text columns kept as plain text (so "3:34" stays "3:34"). */
function trPublicTab_(name, cols, textCols) {
  const t = namedTab_(name, cols);
  trTextFormat_(t, textCols);
  return t;
}
function trTextFormat_(t, textCols) {
  const rows = Math.max(t.sh.getMaxRows(), 2);
  textCols.forEach(function (c) { t.sh.getRange(1, t.idx[c] + 1, rows, 1).setNumberFormat('@'); });
}

/* The private Song Vault spreadsheet, created on first use. */
function vaultBook_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('VAULT_SHEET_ID');
  let book = null;
  if (id) { try { book = SpreadsheetApp.openById(id); } catch (e) { book = null; } }
  if (!book) {
    book = SpreadsheetApp.create(VAULT_BOOK_NAME);
    p.setProperty('VAULT_SHEET_ID', book.getId());
  }
  return book;
}
function vaultTab_(name, cols) {
  const book = vaultBook_();
  let sh = book.getSheetByName(name);
  if (!sh) {
    const sheets = book.getSheets();
    if (sheets.length === 1 && sheets[0].getLastRow() === 0 && /^Sheet/.test(sheets[0].getName())) { sh = sheets[0]; sh.setName(name); }
    else sh = book.insertSheet(name);
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, sh.getMaxRows(), cols.length).setNumberFormat('@');   // everything stays exactly as typed
    sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  const head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const idx = {};
  let next = head.filter(String).length ? head.length : 0;
  cols.forEach(function (c) {
    let i = head.indexOf(c);
    if (i < 0) { sh.getRange(1, next + 1).setValue(c).setFontWeight('bold'); sh.getRange(1, next + 1, sh.getMaxRows(), 1).setNumberFormat('@'); i = next; next++; }
    idx[c] = i;
  });
  return { sh: sh, idx: idx };
}

/* Rows with their sheet row numbers: [{ row, data: {...} }]. Values come back as text. */
function trRows_(t, cols) {
  const last = t.sh.getLastRow();
  if (last < 2) return [];
  const width = t.sh.getLastColumn();
  return t.sh.getRange(2, 1, last - 1, width).getValues().map(function (r, i) {
    const o = {};
    cols.forEach(function (c) { o[c] = cell_(r[t.idx[c]]).trim(); });
    return { row: i + 2, data: o };
  }).filter(function (x) { return cols.some(function (c) { return x.data[c]; }); });
}

/* Writes the given fields into one row (other columns untouched). New row when row is 0. */
function trPutRow_(t, row, fields) {
  if (!row) row = Math.max(t.sh.getLastRow(), 1) + 1;
  Object.keys(fields).forEach(function (c) {
    if (t.idx[c] == null) return;
    const v = fields[c];
    t.sh.getRange(row, t.idx[c] + 1).setValue(typeof v === 'number' || typeof v === 'boolean' ? v : safeText_(v == null ? '' : v));
  });
  return row;
}

function trSongs_() {
  return getSongs().songs.map(function (s) {
    return { title: s.song_title, date: s.release_date, type: s.release_type || 'Single', upc: trUpc_(s.song_upc),
      isrc: trIsrc_(s.song_ISRC), arts: s.song_arts, row: s.row };
  });
}

/* ---------- Checks: what needs a look ---------- */

function trChecks_(songs, tracks, rts) {
  const today = trTodayManila_();
  const byUpc = {}; songs.forEach(function (s) { if (s.upc) byUpc[s.upc] = s; });
  const trackSet = {}; tracks.forEach(function (t) { trackSet[t.isrc] = t; });
  const seen = {};
  rts.forEach(function (r) { (seen[r.isrc] = seen[r.isrc] || []).push(r); });

  const reuse = [];
  Object.keys(seen).forEach(function (isrc) {
    const L = seen[isrc];
    const names = {}; L.forEach(function (r) { names[trBase_(r.track_title)] = 1; });
    const secs = L.map(function (r) { return trSecs_(r.duration); }).filter(function (x) { return x != null; });
    const why = [];
    if (Object.keys(names).length > 1) why.push('different song names');
    if (secs.length > 1 && Math.max.apply(null, secs) - Math.min.apply(null, secs) > LENGTH_GAP) {
      why.push('lengths differ by ' + (Math.max.apply(null, secs) - Math.min.apply(null, secs)) + ' s');
    }
    if (why.length) reuse.push({ isrc: isrc, issue: why.join('; ') });
  });

  const hasList = {}; rts.forEach(function (r) { hasList[r.upc] = true; });
  const noTracklist = songs.filter(function (s) { return s.upc && s.date && s.date <= today && !hasList[s.upc]; })
    .map(function (s) { return { upc: s.upc, title: s.title, date: s.date }; });
  const noUpc = songs.filter(function (s) { return !s.upc; }).map(function (s) { return { title: s.title, date: s.date }; });
  const badCodes = [];
  rts.forEach(function (r) {
    if (!ISRC_RE.test(r.isrc)) badCodes.push({ what: 'ISRC', code: r.isrc, where: r.release_title });
    if (!UPC_RE.test(r.upc)) badCodes.push({ what: 'UPC', code: r.upc, where: r.release_title });
    if (!trackSet[r.isrc]) badCodes.push({ what: 'Missing song row', code: r.isrc, where: r.release_title });
  });
  const singleMismatch = [];
  songs.forEach(function (s) {
    if (!s.upc || !s.isrc) return;
    const list = rts.filter(function (r) { return r.upc === s.upc; });
    if (list.length && !list.some(function (r) { return r.isrc === s.isrc; })) singleMismatch.push({ title: s.title, sheet: s.isrc, tracklist: list.map(function (r) { return r.isrc; }).join(', ') });
  });
  const noLyrics = tracks.filter(function (t) { return t.first_release && t.first_release <= today && !t.has_lyrics; }).length;
  return { reuse: reuse, noTracklist: noTracklist, noUpc: noUpc, badCodes: badCodes, singleMismatch: singleMismatch, noLyrics: noLyrics };
}

/* ---------- Called by the screen ---------- */

function getTracksAdmin() {
  const songs = trSongs_();
  const tt = trPublicTab_(TRACKS_TAB, TRACK_COLUMNS, TRACK_TEXT_COLUMNS);
  const rt = trPublicTab_(RT_TAB, RT_COLUMNS, RT_TEXT_COLUMNS);
  const tracks = trRows_(tt, TRACK_COLUMNS).map(function (x) {
    const d = x.data;
    return { isrc: trIsrc_(d.isrc), track_title: d.track_title, artist: d.artist, duration: d.duration, explicit: bool_(d.explicit),
      first_release: d.first_release, first_upc: trUpc_(d.first_upc), releases: Number(d.releases) || 0, language: d.language,
      has_lyrics: !!d.lyrics, has_abc: !!d.abc };
  });
  const rts = trRows_(rt, RT_COLUMNS).map(function (x) {
    const d = x.data;
    return { upc: trUpc_(d.upc), release_title: d.release_title, disc: Number(d.disc) || 1, track_number: Number(d.track_number) || 0,
      isrc: trIsrc_(d.isrc), track_title: d.track_title, duration: d.duration, bonus: bool_(d.bonus) };
  });
  const fixes = {};
  trRows_(vaultTab_(FIX_TAB, FIX_COLUMNS), FIX_COLUMNS).forEach(function (x) { fixes[trIsrc_(x.data.isrc)] = x.data; });
  const drafts = {};
  trRows_(vaultTab_(NOTE_TAB, NOTE_COLUMNS), NOTE_COLUMNS).forEach(function (x) {
    drafts[trIsrc_(x.data.isrc)] = !!(x.data.draft_lyrics || x.data.draft_abc || x.data.chords || x.data.bpm || x.data.key || x.data.notes);
  });
  return {
    today: trTodayManila_(), songs: songs, tracks: tracks, rts: rts, fixes: fixes, drafts: drafts,
    checks: trChecks_(songs, tracks, rts), statuses: FIX_STATUSES, plans: FIX_PLANS, artists: ARTISTS
  };
}

function getTrackDetail(isrc) {
  isrc = trIsrc_(isrc);
  const tt = trPublicTab_(TRACKS_TAB, TRACK_COLUMNS, TRACK_TEXT_COLUMNS);
  const hit = trRows_(tt, TRACK_COLUMNS).filter(function (x) { return trIsrc_(x.data.isrc) === isrc; })[0];
  if (!hit) throw new Error('No song with ISRC ' + isrc + ' in the tracks tab.');
  const notes = trRows_(vaultTab_(NOTE_TAB, NOTE_COLUMNS), NOTE_COLUMNS).filter(function (x) { return trIsrc_(x.data.isrc) === isrc; })[0];
  const fix = trRows_(vaultTab_(FIX_TAB, FIX_COLUMNS), FIX_COLUMNS).filter(function (x) { return trIsrc_(x.data.isrc) === isrc; })[0];
  const songs = trSongs_(); const byUpc = {}; songs.forEach(function (s) { if (s.upc) byUpc[s.upc] = s; });
  const on = trRows_(trPublicTab_(RT_TAB, RT_COLUMNS, RT_TEXT_COLUMNS), RT_COLUMNS)
    .filter(function (x) { return trIsrc_(x.data.isrc) === isrc; })
    .map(function (x) { const d = x.data; const s = byUpc[trUpc_(d.upc)] || {};
      return { upc: trUpc_(d.upc), release_title: d.release_title, date: s.date || '', type: s.type || '', track_number: d.track_number, disc: d.disc, track_title: d.track_title, duration: d.duration }; })
    .sort(function (a, b) { return String(a.date).localeCompare(String(b.date)); });
  const d = hit.data;
  return {
    track: { isrc: isrc, track_title: d.track_title, artist: d.artist, duration: d.duration, explicit: bool_(d.explicit), first_release: d.first_release,
      first_upc: trUpc_(d.first_upc), releases: Number(d.releases) || 0, language: d.language, lyrics: d.lyrics, abc: d.abc },
    released: !!d.first_release && d.first_release <= trTodayManila_(),
    notes: notes ? notes.data : null, fix: fix ? fix.data : null, on: on
  };
}

/* Public basics of a song: title, artist, language, explicit. */
function saveTrackInfo(isrc, d) {
  isrc = trIsrc_(isrc);
  const title = String(d && d.track_title || '').trim();
  if (!title) throw new Error('A song needs a title.');
  if (title.length > 200) throw new Error('That title is too long (200 characters at most).');
  const lock = lock_();
  try {
    const tt = trPublicTab_(TRACKS_TAB, TRACK_COLUMNS, TRACK_TEXT_COLUMNS);
    const hit = trRows_(tt, TRACK_COLUMNS).filter(function (x) { return trIsrc_(x.data.isrc) === isrc; })[0];
    if (!hit) throw new Error('No song with ISRC ' + isrc + '.');
    trPutRow_(tt, hit.row, { track_title: title, artist: trClip_(d.artist, 80).trim() || ARTISTS[0],
      language: trClip_(d.language, 40).trim(), explicit: !!d.explicit });
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* Private drafts and studio notes. */
function saveTrackNotes(isrc, d) {
  isrc = trIsrc_(isrc);
  if (!ISRC_RE.test(isrc)) throw new Error('That ISRC doesn\'t look right.');
  d = d || {};
  const bpm = String(d.bpm || '').trim();
  if (bpm && !/^\d{2,3}(\.\d)?$/.test(bpm)) throw new Error('BPM should be a number like 92 or 120.5.');
  const lock = lock_();
  try {
    const t = vaultTab_(NOTE_TAB, NOTE_COLUMNS);
    const hit = trRows_(t, NOTE_COLUMNS).filter(function (x) { return trIsrc_(x.data.isrc) === isrc; })[0];
    trPutRow_(t, hit ? hit.row : 0, {
      isrc: isrc, bpm: bpm, key: trClip_(d.key, 20).trim(), time_signature: trClip_(d.time_signature, 10).trim(),
      chords: trClip_(d.chords, TEXT_MAX), draft_lyrics: trClip_(d.draft_lyrics, TEXT_MAX), draft_abc: trClip_(d.draft_abc, TEXT_MAX),
      notes: trClip_(d.notes, 5000), updated: manilaNow_()
    });
    return { ok: true, updated: manilaNow_() };
  } finally { lock.releaseLock(); }
}

/* Lyrics and score go public only once the song is out. Blank text takes them off the site. */
function publishTrackText(isrc, d) {
  isrc = trIsrc_(isrc);
  d = d || {};
  const lock = lock_();
  try {
    const tt = trPublicTab_(TRACKS_TAB, TRACK_COLUMNS, TRACK_TEXT_COLUMNS);
    const hit = trRows_(tt, TRACK_COLUMNS).filter(function (x) { return trIsrc_(x.data.isrc) === isrc; })[0];
    if (!hit) throw new Error('No song with ISRC ' + isrc + '.');
    const fields = {};
    ['lyrics', 'abc'].forEach(function (k) {
      if (d[k] == null) return;
      const v = trClip_(d[k], TEXT_MAX + 1);
      if (v.length > TEXT_MAX) throw new Error('That ' + (k === 'abc' ? 'score' : 'lyric') + ' text is too long for one cell.');
      if (v.trim()) {
        const out = hit.data.first_release && hit.data.first_release <= trTodayManila_();
        if (!out) throw new Error('This song isn\'t out yet (' + (hit.data.first_release || 'no release date') + '). Keep it as a draft until release day.');
        if (k === 'abc' && !/^X:\s*\d+/m.test(v)) throw new Error('A music score in ABC starts with a line like "X:1". Check it in the preview first.');
      }
      fields[k] = v.trim() ? v : '';
    });
    trPutRow_(tt, hit.row, fields);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* Private correction plan for one ISRC. */
function saveTrackFix(isrc, d) {
  isrc = trIsrc_(isrc);
  d = d || {};
  const status = FIX_STATUSES.indexOf(d.status) >= 0 ? d.status : FIX_STATUSES[0];
  const plan = FIX_PLANS.indexOf(d.plan) >= 0 ? d.plan : '';
  const newIsrc = trIsrc_(d.new_isrc), newUpc = trUpc_(d.new_upc);
  if (newIsrc && !ISRC_RE.test(newIsrc)) throw new Error('The new ISRC should look like QZTB42330583 (12 characters).');
  if (newIsrc && newIsrc === isrc) throw new Error('The new ISRC is the same as the old one.');
  if (newUpc && !UPC_RE.test(newUpc)) throw new Error('The new UPC should be 12 or 13 digits.');
  const lock = lock_();
  try {
    const t = vaultTab_(FIX_TAB, FIX_COLUMNS);
    const hit = trRows_(t, FIX_COLUMNS).filter(function (x) { return trIsrc_(x.data.isrc) === isrc; })[0];
    trPutRow_(t, hit ? hit.row : 0, { isrc: isrc, issue: trClip_(d.issue, 300), status: status, plan: plan, new_isrc: newIsrc,
      new_upc: newUpc, new_title: trClip_(d.new_title, 200).trim(), notes: trClip_(d.notes, 5000), updated: manilaNow_() });
    return { ok: true, updated: manilaNow_() };
  } finally { lock.releaseLock(); }
}

/* Replace one release's tracklist. Songs with a new ISRC get their own row in tracks; when a row says it
   replaces an old ISRC (from_isrc), the new song starts with the old one's title, artist, language, lyrics,
   score and private notes, so nothing has to be typed twice. */
function saveReleaseTracklist(upc, list) {
  upc = trUpc_(upc);
  if (!UPC_RE.test(upc)) throw new Error('That UPC should be 12 or 13 digits.');
  const song = trSongs_().filter(function (s) { return s.upc === upc; })[0];
  if (!song) throw new Error('No release in Sheet1 has UPC ' + upc + '. Add its UPC on the Songs screen first.');
  list = (list || []).map(function (r, i) {
    return { disc: Math.max(1, Math.min(9, Number(r.disc) || 1)), track_number: Math.max(1, Math.min(99, Number(r.track_number) || i + 1)),
      isrc: trIsrc_(r.isrc), track_title: trClip_(r.track_title, 200).trim(), duration: String(r.duration || '').trim(), bonus: !!r.bonus,
      artist: String(r.artist || '').trim(), from_isrc: trIsrc_(r.from_isrc) };
  });
  if (!list.length) throw new Error('A release needs at least one song.');
  if (list.length > 60) throw new Error('That is more than 60 songs. Check the list.');
  const pos = {}, isrcs = {};
  list.forEach(function (r) {
    if (!ISRC_RE.test(r.isrc)) throw new Error('Track ' + r.track_number + ': "' + r.isrc + '" doesn\'t look like an ISRC (12 characters, like QZTB42330583).');
    if (!r.track_title) throw new Error('Track ' + r.track_number + ' needs a title.');
    if (r.duration && trSecs_(r.duration) == null) throw new Error('Track ' + r.track_number + ': write the length like 3:34.');
    const p = r.disc + '-' + r.track_number;
    if (pos[p]) throw new Error('Two songs are numbered ' + r.track_number + (r.disc > 1 ? ' on disc ' + r.disc : '') + '.');
    if (isrcs[r.isrc]) throw new Error('ISRC ' + r.isrc + ' is listed twice on this release.');
    pos[p] = isrcs[r.isrc] = 1;
  });
  const lock = lock_();
  try {
    const rt = trPublicTab_(RT_TAB, RT_COLUMNS, RT_TEXT_COLUMNS);
    const tt = trPublicTab_(TRACKS_TAB, TRACK_COLUMNS, TRACK_TEXT_COLUMNS);
    const others = trRows_(rt, RT_COLUMNS).map(function (x) { return x.data; }).filter(function (d) { return trUpc_(d.upc) !== upc; });
    const mine = list.sort(function (a, b) { return a.disc - b.disc || a.track_number - b.track_number; }).map(function (r) {
      return { upc: upc, release_title: song.title, disc: r.disc, track_number: r.track_number, isrc: r.isrc, track_title: r.track_title,
        duration: r.duration, bonus: r.bonus ? 'TRUE' : '' };
    });
    trRewrite_(rt, RT_COLUMNS, others.concat(mine), { disc: 'n', track_number: 'n' });

    // New songs get a row in tracks; carry over from the ISRC they replace.
    const trows = trRows_(tt, TRACK_COLUMNS);
    const have = {}; trows.forEach(function (x) { have[trIsrc_(x.data.isrc)] = x; });
    const notesTab = vaultTab_(NOTE_TAB, NOTE_COLUMNS);
    const noteRows = trRows_(notesTab, NOTE_COLUMNS);
    let added = 0;
    list.forEach(function (r) {
      if (have[r.isrc]) return;
      const old = r.from_isrc && have[r.from_isrc] ? have[r.from_isrc].data : null;
      trPutRow_(tt, 0, { isrc: r.isrc, track_title: r.track_title, artist: r.artist || (old && old.artist) || ARTISTS[0],
        duration: r.duration, explicit: old ? bool_(old.explicit) : false, language: old ? old.language : '',
        lyrics: old ? old.lyrics : '', abc: old ? old.abc : '' });
      if (old) {
        const n = noteRows.filter(function (x) { return trIsrc_(x.data.isrc) === r.from_isrc; })[0];
        if (n && !noteRows.some(function (x) { return trIsrc_(x.data.isrc) === r.isrc; })) {
          const copy = Object.assign({}, n.data, { isrc: r.isrc, updated: manilaNow_() });
          trPutRow_(notesTab, 0, copy);
        }
      }
      added++;
    });
    trRefreshDerived_();
    return { ok: true, added: added, count: mine.length };
  } finally { lock.releaseLock(); }
}

/* Rewrites a whole tab under its header (used for release_tracks, a few hundred short rows). */
function trRewrite_(t, cols, rows, types) {
  const width = Math.max(t.sh.getLastColumn(), cols.length);
  const last = t.sh.getLastRow();
  if (last >= 2) t.sh.getRange(2, 1, last - 1, width).clearContent();
  if (!rows.length) return;
  if (t.sh.getMaxRows() < rows.length + 1) t.sh.insertRowsAfter(t.sh.getMaxRows(), rows.length + 1 - t.sh.getMaxRows());
  const out = rows.map(function (o) {
    const r = new Array(width).fill('');
    cols.forEach(function (c) {
      const v = o[c] == null ? '' : o[c];
      r[t.idx[c]] = types && types[c] === 'n' && v !== '' ? Number(v) : safeText_(v);
    });
    return r;
  });
  t.sh.getRange(2, 1, out.length, width).setValues(out);
}

/* first_release, first_upc and releases in tracks follow release_tracks and the release dates in Sheet1. */
function trRefreshDerived_() {
  const songs = trSongs_(); const date = {}; songs.forEach(function (s) { if (s.upc) date[s.upc] = s.date; });
  const tt = trPublicTab_(TRACKS_TAB, TRACK_COLUMNS, TRACK_TEXT_COLUMNS);
  const rts = trRows_(trPublicTab_(RT_TAB, RT_COLUMNS, RT_TEXT_COLUMNS), RT_COLUMNS).map(function (x) { return x.data; });
  const on = {};
  rts.forEach(function (r) { const i = trIsrc_(r.isrc), u = trUpc_(r.upc); (on[i] = on[i] || {})[u] = date[u] || '9999-12-31'; });
  const rows = trRows_(tt, TRACK_COLUMNS);
  if (!rows.length) return;
  const cols = ['first_release', 'first_upc', 'releases'];
  const vals = tt.sh.getRange(2, 1, tt.sh.getLastRow() - 1, tt.sh.getLastColumn()).getValues();
  rows.forEach(function (x) {
    const m = on[trIsrc_(x.data.isrc)] || {};
    const ups = Object.keys(m).sort(function (a, b) { return m[a].localeCompare(m[b]); });
    const r = vals[x.row - 2];
    r[tt.idx.first_release] = ups.length && m[ups[0]] !== '9999-12-31' ? m[ups[0]] : '';
    r[tt.idx.first_upc] = ups[0] || '';
    r[tt.idx.releases] = ups.length;
  });
  cols.forEach(function (c) {
    tt.sh.getRange(2, tt.idx[c] + 1, vals.length, 1).setValues(vals.map(function (r) { return [r[tt.idx[c]]]; }));
  });
}
