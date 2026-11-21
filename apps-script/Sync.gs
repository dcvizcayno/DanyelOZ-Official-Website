/* Danyel OZ admin: sync licensing data (server side).
   Public, in the Song Database (anyone with the link can read these):
     tracks          extra sync columns, matched by header name and added after the existing ones on the first
                     sync save: BPM, key, moods, genres, vocal type, writers, producers, versions on hand and
                     the one-sheet "featured" flag. Flags are stored as the text TRUE or left empty.
     sync_settings   one row of licensing settings shared by the catalogue and one-sheet pages
                     (who owns the rights, PRO, contact, reply time). Created on the first settings save.
   Reading (getSyncAdmin) never writes to any sheet; only the two save functions do. */

const SY_TRACK_COLUMNS = ['sync_bpm', 'sync_key', 'sync_moods', 'sync_genre', 'sync_genre_2', 'sync_vocal', 'sync_writers',
  'sync_producers', 'sync_instrumental', 'sync_clean', 'sync_stems', 'sync_cut60', 'sync_cut30', 'sync_featured'];
const SY_FLAG_COLUMNS = ['sync_instrumental', 'sync_clean', 'sync_stems', 'sync_cut60', 'sync_cut30', 'sync_featured'];
const SY_REQUIRED = ['sync_bpm', 'sync_key', 'sync_moods', 'sync_genre', 'sync_vocal', 'sync_writers'];
const SY_SETTINGS_TAB = 'sync_settings';
const SY_SETTING_COLUMNS = ['rights_holder', 'rights_line', 'one_stop', 'pro_name', 'contact_email', 'contact_url',
  'turnaround', 'process_note', 'updated'];
const SY_MOODS = ['Happy', 'Uplifting', 'Hopeful', 'Euphoric', 'Empowering', 'Romantic', 'Sexy', 'Smooth', 'Laid Back',
  'Dreamy', 'Peaceful', 'Sentimental', 'Nostalgic', 'Sad', 'Dark', 'Mysterious', 'Suspense', 'Restless', 'Epic', 'Quirky'];
const SY_GENRES = ['Pop', 'Alt-Pop', 'Indie Pop', 'R&B', 'Alternative R&B', 'Soul', 'Acoustic', 'Singer-Songwriter',
  'Folk Pop', 'Latin Pop', 'Electropop', 'Ballad'];
const SY_VOCALS = ['Solo vocal', 'Duet', 'Instrumental only', 'Mixed'];
const SY_KEYS = ['C major', 'C minor', 'C# major', 'C# minor', 'D major', 'D minor', 'Eb major', 'Eb minor', 'E major',
  'E minor', 'F major', 'F minor', 'F# major', 'F# minor', 'G major', 'G minor', 'Ab major', 'Ab minor', 'A major',
  'A minor', 'Bb major', 'Bb minor', 'B major', 'B minor'];
const SY_MAX_MOODS = 3;
const SY_MAX_FEATURED = 10;
const SY_NAMES_MAX = 200;            // writers, producers
const SY_SETTING_MAX = { rights_holder: 120, rights_line: 400, pro_name: 80, turnaround: 40, process_note: 600,
  contact_email: 254, contact_url: 500 };   // 254: same cap as OZSync.validEmail
const SY_EMAIL_RE = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;   // same as OZSync.EMAIL_RE (SR-04)
const SY_CONTACT_HOSTS = ['www.danyeloz.info', 'docs.google.com', 'forms.gle', 'www.cognitoforms.com'];
const SY_DEFAULTS = { rights_holder: 'Danyel OZ, LLC', rights_line: '', one_stop: 'TRUE', pro_name: '',
  contact_email: 'daniel.vizkaino@gmail.com', contact_url: '', turnaround: '3 business days', process_note: '', updated: '' };

/* ---------- Helpers ---------- */

function syFlag_(v) { return bool_(v) ? 'TRUE' : ''; }

/* contact_email: the same rule as OZSync.validEmail in sync-core.js (trim, 254 at most, SR-04 pattern), so the app
   never saves an address the widgets would refuse. Control characters are refused, not stripped. */
function syEmail_(v) { const e = String(v == null ? '' : v).trim(); return e.length <= SY_SETTING_MAX.contact_email && SY_EMAIL_RE.test(e); }

/* A flag from the app: only true/false (or the stored text TRUE/FALSE/empty) is accepted. */
function syFlagIn_(v, label) {
  if (v === true || v === false || v == null || v === '') return v === true ? 'TRUE' : '';
  const s = String(v).trim().toUpperCase();
  if (s === 'TRUE') return 'TRUE';
  if (s === 'FALSE' || s === '') return '';
  throw new Error(label + ' should be ticked or not ticked.');
}

/* Clean text for a public cell: control characters out, spaces collapsed, trimmed. Too long is refused, not cut.
   safeText_ (the formula guard) is applied by the writers, trPutRow_ and writeNamed_. */
function syText_(v, max, label) {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > max) throw new Error(label + ' is too long (' + max + ' characters at most).');
  return s;
}

/* Public free text must not carry links, email addresses, IPI/CAE numbers or long digit runs (everything here is public at once). */
function syPublicText_(s, label, okEmail) {
  if (/https?:\/\/|www\.|drive\.google|docs\.google/i.test(s)) throw new Error(label + ' can\'t contain a link. It\'s public on the website.');
  const emails = s.match(/[^\s@]+@[^\s@]+\.[^\s@]+/g) || [];
  if (emails.some(function (e) { return !okEmail || e.replace(/[.,;:)]+$/, '').toLowerCase() !== okEmail.toLowerCase(); })) {
    throw new Error(label + ' can\'t contain an email address. Use the contact email setting.');
  }
  if (/\d{9,}/.test(s)) throw new Error(label + ' can\'t contain long numbers (IPI, CAE or phone numbers stay private).');
  if (/\b(IPI|CAE)\b/i.test(s)) throw new Error(label + ' can\'t mention IPI or CAE numbers (they stay private).');
  return s;
}

/* contact_url: blank, or https on one of SY_CONTACT_HOSTS (exact host, no user, password or port; Google only /forms/).
   Apps Script has no URL class, so the authority is parsed strictly by hand. */
function syContactUrl_(u) {
  if (!u) return '';
  const m = String(u).match(/^https:\/\/([^\/?#]*)([^\s"'<>\\]*)$/i);
  if (!m) return null;
  const host = m[1].toLowerCase();
  const path = m[2];
  if (SY_CONTACT_HOSTS.indexOf(host) < 0) return null;     // also refuses user@, :port and look-alike hosts
  const pathOnly = path.split(/[?#]/)[0];                  // no dot segments, plain or encoded (N-2)
  if (/%2e/i.test(pathOnly) || /(^|\/)\.\.?(\/|$)/.test(pathOnly)) return null;
  if (host === 'docs.google.com' && !/^\/forms\//.test(path)) return null;
  return 'https://' + host + path;
}
function syMoods_(v) {
  const list = Array.isArray(v) ? v : String(v || '').split(',');
  const out = [];
  list.forEach(function (m) { m = String(m == null ? '' : m).trim(); if (m && out.indexOf(m) < 0) out.push(m); });
  return out;
}

/* Reads a tab by header name without adding anything (missing tab or column reads as empty). */
function syReadTab_(sh, cols) {
  if (!sh || sh.getLastRow() === 0) return { exists: !!sh, head: [], rows: [] };
  const width = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const last = sh.getLastRow();
  const vals = last < 2 ? [] : sh.getRange(2, 1, last - 1, width).getValues();
  const rows = vals.map(function (r, i) {
    const o = {};
    cols.forEach(function (c) { const j = head.indexOf(c); o[c] = j < 0 ? '' : cell_(r[j]).trim(); });
    return { row: i + 2, data: o };
  }).filter(function (x) { return cols.some(function (c) { return x.data[c]; }); });
  return { exists: true, head: head, rows: rows };
}
function syTracks_() {
  return syReadTab_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(TRACKS_TAB),
    ['isrc', 'track_title', 'first_release', 'explicit', 'language'].concat(SY_TRACK_COLUMNS));
}

/* Studio-note BPM and key from the private vault, only if the vault and its tab already exist. */
function syStudioHints_() {
  const hints = {};
  try {
    const id = PropertiesService.getScriptProperties().getProperty('VAULT_SHEET_ID');
    if (!id) return hints;
    const sh = SpreadsheetApp.openById(id).getSheetByName(NOTE_TAB);
    syReadTab_(sh, ['isrc', 'bpm', 'key']).rows.forEach(function (x) {
      if (x.data.bpm || x.data.key) hints[trIsrc_(x.data.isrc)] = { bpm: x.data.bpm, key: x.data.key };
    });
  } catch (e) { return {}; }
  return hints;
}

function sySettings_() {
  const t = syReadTab_(SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SY_SETTINGS_TAB), SY_SETTING_COLUMNS);
  const hit = t.rows[0];
  const out = {};
  SY_SETTING_COLUMNS.forEach(function (c) { out[c] = hit ? hit.data[c].replace(/^'/, '') : SY_DEFAULTS[c]; });
  if (hit) out.one_stop = syFlag_(out.one_stop);
  return { settings: out, saved: !!hit };
}

/* ---------- Callables ---------- */

function getSyncAdmin() {
  const t = syTracks_();
  const tracks = [];
  const missing = [];
  t.rows.forEach(function (x) {
    const d = x.data;
    const isrc = trIsrc_(d.isrc);
    if (!isrc) return;
    const s = { isrc: isrc, track_title: d.track_title, first_release: d.first_release, explicit: bool_(d.explicit), language: d.language };
    SY_TRACK_COLUMNS.forEach(function (c) { s[c] = String(d[c]).replace(/^'/, ''); });
    s.sync_moods = syMoods_(s.sync_moods);
    SY_FLAG_COLUMNS.forEach(function (c) { s[c] = bool_(s[c]); });
    const gaps = SY_REQUIRED.filter(function (c) { return c === 'sync_moods' ? !s.sync_moods.length : !s[c]; });
    s.complete = !gaps.length;
    if (gaps.length) missing.push({ isrc: isrc, title: d.track_title, fields: gaps });
    tracks.push(s);
  });
  const st = sySettings_();
  return {
    tracks: tracks,
    readiness: { complete: tracks.length - missing.length, total: tracks.length, missing: missing },
    settings: st.settings, settings_saved: st.saved,
    lists: { moods: SY_MOODS, genres: SY_GENRES, vocals: SY_VOCALS, keys: SY_KEYS, max_moods: SY_MAX_MOODS, max_featured: SY_MAX_FEATURED },
    hints: syStudioHints_()
  };
}

/* Saves every sync field of one song (blank clears it). Other columns of the row are never written. */
function saveTrackSync(isrc, d) {
  isrc = trIsrc_(isrc);
  if (!ISRC_RE.test(isrc)) throw new Error('That ISRC doesn\'t look right.');
  d = d || {};
  const bpm = syText_(d.sync_bpm, 10, 'BPM');
  if (bpm && (!/^\d{2,3}$/.test(bpm) || Number(bpm) < 40 || Number(bpm) > 220)) throw new Error('BPM should be a whole number from 40 to 220.');
  const pick = function (field, list, label) {
    const v = syText_(d[field], 40, label);
    if (v && list.indexOf(v) < 0) throw new Error('Pick the ' + label + ' from the list.');
    return v;
  };
  const key = pick('sync_key', SY_KEYS, 'key');
  const genre = pick('sync_genre', SY_GENRES, 'genre');
  const genre2 = pick('sync_genre_2', SY_GENRES, 'second genre');
  if (genre2 && genre2 === genre) throw new Error('The second genre should differ from the first (or leave it blank).');
  const vocal = pick('sync_vocal', SY_VOCALS, 'vocal type');
  const moods = syMoods_(d.sync_moods).map(function (m) { return syText_(m, 40, 'Mood'); });
  moods.forEach(function (m) { if (SY_MOODS.indexOf(m) < 0) throw new Error('"' + m + '" isn\'t one of the moods. Pick from the list.'); });
  if (moods.length > SY_MAX_MOODS) throw new Error('Pick up to ' + SY_MAX_MOODS + ' moods.');
  const writers = syPublicText_(syText_(d.sync_writers, SY_NAMES_MAX, 'Writers'), 'Writers');
  const producers = syPublicText_(syText_(d.sync_producers, SY_NAMES_MAX, 'Producers'), 'Producers');
  const fields = { sync_bpm: bpm ? String(Number(bpm)) : '', sync_key: key, sync_moods: moods.join(', '), sync_genre: genre, sync_genre_2: genre2,
    sync_vocal: vocal, sync_writers: writers, sync_producers: producers };
  SY_FLAG_COLUMNS.forEach(function (c) { fields[c] = syFlagIn_(d[c], c.replace('sync_', '')); });
  const lock = lock_();
  try {
    const rows = syTracks_().rows;
    const hit = rows.filter(function (x) { return trIsrc_(x.data.isrc) === isrc; })[0];
    if (!hit) throw new Error('No song with ISRC ' + isrc + ' in the tracks tab.');
    if (fields.sync_featured) {
      const others = rows.filter(function (x) { return trIsrc_(x.data.isrc) !== isrc && bool_(x.data.sync_featured); }).length;
      if (others >= SY_MAX_FEATURED) throw new Error('The one-sheet already has ' + SY_MAX_FEATURED + ' featured songs. Unfeature one first.');
    }
    const tt = trPublicTab_(TRACKS_TAB, TRACK_COLUMNS.concat(SY_TRACK_COLUMNS), SY_TRACK_COLUMNS);
    trPutRow_(tt, hit.row, fields);
    return { ok: true };
  } finally { lock.releaseLock(); }
}

/* Saves the one row of licensing settings (the tab is made on the first save). Only the D-5 headers are written;
   any other key in d is ignored, and updated is always set here. */
function saveSyncSettings(d) {
  d = d || {};
  const email = String(d.contact_email == null ? '' : d.contact_email).trim();
  if (email.length > SY_SETTING_MAX.contact_email) throw new Error('The contact email is too long (' + SY_SETTING_MAX.contact_email + ' characters at most).');
  if (!syEmail_(email)) throw new Error('The contact email doesn\'t look right.');
  const pub = function (field, label) { return syPublicText_(syText_(d[field], SY_SETTING_MAX[field], label), label, email); };
  const row = {
    rights_holder: pub('rights_holder', 'Rights holder'), rights_line: pub('rights_line', 'Rights statement'),
    one_stop: syFlagIn_(d.one_stop, 'One-stop'), pro_name: pub('pro_name', 'PRO name'), contact_email: email,
    contact_url: syContactUrl_(syText_(d.contact_url, SY_SETTING_MAX.contact_url, 'The contact link')),
    turnaround: pub('turnaround', 'Reply time'), process_note: pub('process_note', 'Process note')
  };
  if (!row.rights_holder) throw new Error('Add the rights holder (for example Danyel OZ, LLC).');
  if (row.contact_url === null) {
    throw new Error('The contact link must be an https link on www.danyeloz.info, a Google Form, forms.gle or www.cognitoforms.com (or leave it blank).');
  }
  const lock = lock_();
  try {
    row.updated = manilaNow_();
    const t = trPublicTab_(SY_SETTINGS_TAB, SY_SETTING_COLUMNS, SY_SETTING_COLUMNS);
    writeNamed_(t, SY_SETTING_COLUMNS, [row]);
    return { ok: true, updated: row.updated };
  } finally { lock.releaseLock(); }
}
