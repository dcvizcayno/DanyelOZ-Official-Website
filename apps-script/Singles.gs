/**
 * Danyel OZ admin: Singles Page screen (server side).
 * Add to the same Apps Script project as Code.gs, as a new script file named "Singles".
 *
 * Where things live (all in the Song Database, which is public, so only public info):
 *   featured_singles tab  position 1 to 10, song_id, song_title. Only songs with a Bandcamp code.
 *   themes tab            slot 1 to 5, theme, tagline, visible.
 *   Sheet1 (songs)        two new columns, song_theme_1 (required once themes exist) and song_theme_2.
 * The widgets read these by tab name, so no gid needs copying anywhere.
 */

const FEATURED_TAB = 'featured_singles';
const FEATURED_COLUMNS = ['position', 'song_id', 'song_title'];
const THEMES_TAB = 'themes';
const THEME_COLUMNS = ['slot', 'theme', 'tagline', 'visible'];
const THEME_SONG_COLUMNS = ['song_theme_1', 'song_theme_2'];
const MAX_FEATURED = 10;
const MAX_THEMES = 5;
const THEME_NAME_MAX = 32;
const THEME_TAGLINE_MAX = 80;

/* ---------- Helpers ---------- */

function hasBandcamp_(s) { return /bandcamp\.com\/EmbeddedPlayer/i.test(String(s && s.bandcamp_embed || '')); }

/* Opens a tab of the Song Database by name, creating it (and any missing header) when needed. */
function namedTab_(name, cols) {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sh = book.getSheetByName(name);
  if (!sh) sh = book.insertSheet(name);
  const width = Math.max(sh.getLastColumn(), 1);
  const head = sh.getLastRow() ? sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); }) : [];
  const idx = {};
  let next = head.filter(String).length ? width : 0;
  cols.forEach(function (c) {
    let i = head.indexOf(c);
    if (i < 0) { sh.getRange(1, next + 1).setValue(c).setFontWeight('bold'); i = next; next++; }
    idx[c] = i;
  });
  return { sh: sh, idx: idx };
}

function readNamed_(t, cols) {
  const last = t.sh.getLastRow();
  if (last < 2) return [];
  const vals = t.sh.getRange(2, 1, last - 1, t.sh.getLastColumn()).getValues();
  return vals.map(function (r) {
    const o = {};
    cols.forEach(function (c) { const v = r[t.idx[c]]; o[c] = String(v == null ? '' : v).trim(); });
    return o;
  });
}

/* Rewrites a small tab under its header in one go (old rows are cleared). */
function writeNamed_(t, cols, rows) {
  const width = Math.max(t.sh.getLastColumn(), cols.length);
  const last = t.sh.getLastRow();
  if (last >= 2) t.sh.getRange(2, 1, last - 1, width).clearContent();
  if (!rows.length) return;
  const out = rows.map(function (o) {
    const r = new Array(width).fill('');
    cols.forEach(function (c) { r[t.idx[c]] = safeText_(o[c] == null ? '' : o[c]); });
    return r;
  });
  t.sh.getRange(2, 1, out.length, width).setValues(out);
}

/* Makes sure Sheet1 has the two theme columns (added at the end, so nothing else moves). */
function ensureThemeColumns_() {
  const sh = sheet_();
  const width = sh.getLastColumn();
  const head = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  let next = width;
  THEME_SONG_COLUMNS.forEach(function (c) {
    if (head.indexOf(c) < 0) { sh.getRange(1, next + 1).setValue(c); next++; }
  });
}

function themeNames_() {
  return readNamed_(namedTab_(THEMES_TAB, THEME_COLUMNS), THEME_COLUMNS)
    .filter(function (t) { return t.theme; })
    .map(function (t) { return t.theme; });
}

function sameName_(a, b) { return String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase(); }

/* Called by saveSong in Code.gs: once themes exist, Theme 1 is required and both must be real themes. */
function checkSongThemes_(data, idx) {
  if (idx.song_theme_1 == null) return;
  const names = themeNames_();
  if (!names.length) return;
  let t1 = String(data.song_theme_1 || '').trim(), t2 = String(data.song_theme_2 || '').trim();
  if (!t1 && t2) { t1 = t2; t2 = ''; }
  if (!t1) throw new Error('Pick a theme for this song. Theme 1 is required.');
  const match = function (t) {
    const m = names.filter(function (n) { return sameName_(n, t); })[0];
    if (!m) throw new Error('"' + t + '" is not one of your themes. Pick it from the list.');
    return m;
  };
  t1 = match(t1);
  t2 = t2 ? match(t2) : '';
  if (sameName_(t1, t2)) t2 = '';
  data.song_theme_1 = t1;
  data.song_theme_2 = t2;
}

/* ---------- Load ---------- */

function getSinglesAdmin() {
  const all = getSongs();
  const songs = all.songs;
  const themes = readNamed_(namedTab_(THEMES_TAB, THEME_COLUMNS), THEME_COLUMNS)
    .filter(function (t) { return t.theme; })
    .sort(function (a, b) { return (Number(a.slot) || 99) - (Number(b.slot) || 99); })
    .map(function (t) {
      return {
        theme: t.theme, tagline: t.tagline, visible: !/^(false|no|0|hide|hidden)$/i.test(t.visible),
        count: songs.filter(function (s) { return sameName_(s.song_theme_1, t.theme) || sameName_(s.song_theme_2, t.theme); }).length
      };
    });
  const byId = {}, byTitle = {};
  songs.forEach(function (s) {
    if (String(s.song_id).trim()) byId[String(s.song_id).trim()] = s;
    byTitle[norm_(s.song_title)] = byTitle[norm_(s.song_title)] || s;
  });
  const featured = readNamed_(namedTab_(FEATURED_TAB, FEATURED_COLUMNS), FEATURED_COLUMNS)
    .filter(function (f) { return f.song_id || f.song_title; })
    .sort(function (a, b) { return (Number(a.position) || 99) - (Number(b.position) || 99); })
    .slice(0, MAX_FEATURED)
    .map(function (f) {
      const s = (f.song_id && byId[f.song_id]) || byTitle[norm_(f.song_title)];
      return { song_id: s ? s.song_id : f.song_id, song_title: s ? s.song_title : f.song_title,
               found: !!s, bandcamp: !!(s && hasBandcamp_(s)) };
    });
  return {
    featured: featured,
    themes: themes,
    themeColumns: all.columns.indexOf('song_theme_1') >= 0,
    songs: songs.map(function (s) {
      return { row: s.row, song_id: s.song_id, song_title: s.song_title, release_date: s.release_date,
               release_type: s.release_type, bandcamp: hasBandcamp_(s), story: !!String(s.song_description).trim(),
               theme1: s.song_theme_1 || '', theme2: s.song_theme_2 || '' };
    }),
    max: { featured: MAX_FEATURED, themes: MAX_THEMES, name: THEME_NAME_MAX, tagline: THEME_TAGLINE_MAX }
  };
}

/* The theme names for the two pickers on the Songs screen. */
function getThemeNames() {
  return { names: themeNames_(), columns: sheet_().getRange(1, 1, 1, sheet_().getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); }).indexOf('song_theme_1') >= 0 };
}

/* ---------- Save ---------- */

function saveFeatured(list) {
  list = (list || []).filter(function (x) { return x && (x.song_id || x.song_title); });
  if (list.length > MAX_FEATURED) throw new Error('Up to ' + MAX_FEATURED + ' featured singles.');
  const songs = getSongs().songs;
  const seen = {};
  const rows = list.map(function (x, i) {
    const s = songs.filter(function (r) { return x.song_id && String(r.song_id) === String(x.song_id); })[0] ||
              songs.filter(function (r) { return norm_(r.song_title) === norm_(x.song_title); })[0];
    if (!s) throw new Error('Slot ' + (i + 1) + ': "' + (x.song_title || x.song_id) + '" is no longer in your Song Database.');
    if (!hasBandcamp_(s)) throw new Error('Slot ' + (i + 1) + ': "' + s.song_title + '" has no Bandcamp code, so fans could not play it. Add the code first.');
    const key = String(s.song_id || '') + '|' + norm_(s.song_title);
    if (seen[key]) throw new Error('"' + s.song_title + '" is in two slots. Each single can appear once.');
    seen[key] = true;
    return { position: i + 1, song_id: s.song_id, song_title: s.song_title };
  });
  const lock = lock_();
  try {
    writeNamed_(namedTab_(FEATURED_TAB, FEATURED_COLUMNS), FEATURED_COLUMNS, rows);
    return { saved: rows.length };
  } finally { lock.releaseLock(); }
}

/* list: [{theme, tagline, visible, was}] in display order. "was" is the name it had when loaded, so a
   rename carries over to every song that used it, and a removed theme is taken off its songs. */
function saveThemes(list) {
  list = (list || []).filter(function (t) { return t && (String(t.theme || '').trim() || t.was); });
  const keep = list.filter(function (t) { return String(t.theme || '').trim(); });
  if (keep.length > MAX_THEMES) throw new Error('Up to ' + MAX_THEMES + ' themes.');
  const seen = {};
  const rows = keep.map(function (t, i) {
    const name = String(t.theme).replace(/\s+/g, ' ').trim();
    if (name.length > THEME_NAME_MAX) throw new Error('"' + name + '" is longer than ' + THEME_NAME_MAX + ' characters.');
    if (seen[name.toLowerCase()]) throw new Error('Two themes are called "' + name + '". Each name can be used once.');
    seen[name.toLowerCase()] = true;
    const tagline = String(t.tagline || '').replace(/\s+/g, ' ').trim();
    if (tagline.length > THEME_TAGLINE_MAX) throw new Error('The line under "' + name + '" is longer than ' + THEME_TAGLINE_MAX + ' characters.');
    return { slot: i + 1, theme: name, tagline: tagline, visible: t.visible === false ? 'FALSE' : 'TRUE' };
  });

  // Old name -> new name ('' when the theme was removed).
  const map = {};
  list.forEach(function (t) {
    if (!t.was) return;
    const now = String(t.theme || '').replace(/\s+/g, ' ').trim();
    if (String(t.was).trim() !== now) map[String(t.was).trim().toLowerCase()] = now;   // includes a change of capitals
  });

  const lock = lock_();
  try {
    ensureThemeColumns_();
    writeNamed_(namedTab_(THEMES_TAB, THEME_COLUMNS), THEME_COLUMNS, rows);
    let changed = 0;
    if (Object.keys(map).length) changed = remapSongThemes_(map);
    return { saved: rows.length, songsUpdated: changed };
  } finally { lock.releaseLock(); }
}

/* Renames or clears theme names across all songs, writing only the two theme columns. */
function remapSongThemes_(map) {
  const sh = sheet_();
  const idx = headers_(sh);
  const last = sh.getLastRow();
  if (last < 2 || idx.song_theme_1 == null) return 0;
  const c1 = idx.song_theme_1, c2 = idx.song_theme_2;
  const first = Math.min(c1, c2), span = Math.abs(c2 - c1) + 1;
  const range = sh.getRange(2, first + 1, last - 1, span);
  const vals = range.getValues();
  let changed = 0;
  vals.forEach(function (r) {
    const a = c1 - first, b = c2 - first;
    let t1 = String(r[a] || '').trim(), t2 = String(r[b] || '').trim();
    const k1 = t1.toLowerCase(), k2 = t2.toLowerCase();
    if (k1 in map) t1 = map[k1];
    if (k2 in map) t2 = map[k2];
    if (!t1 && t2) { t1 = t2; t2 = ''; }
    if (sameName_(t1, t2)) t2 = '';
    if (t1 !== String(r[a] || '').trim() || t2 !== String(r[b] || '').trim()) { r[a] = t1; r[b] = t2; changed++; }
  });
  if (changed) range.setValues(vals);
  return changed;
}

/* Quick theming from the Singles Page screen: list of {row, song_title, theme1, theme2}. Only the theme columns are written. */
function saveSongThemes(list) {
  list = list || [];
  if (!list.length) return { saved: 0 };
  const names = themeNames_();
  if (!names.length) throw new Error('Create at least one theme first.');
  const lock = lock_();
  try {
    ensureThemeColumns_();
    const sh = sheet_();
    const idx = headers_(sh);
    let saved = 0;
    list.forEach(function (x) {
      const row = Number(x.row);
      if (!row || row < 2) return;
      const there = sh.getRange(row, idx.song_title + 1).getValue();
      if (norm_(there) !== norm_(x.song_title)) throw new Error('Your song list changed while you were editing ("' + x.song_title + '" moved). Reload and try again.');
      const d = { song_theme_1: x.theme1, song_theme_2: x.theme2 };
      checkSongThemes_(d, idx);
      sh.getRange(row, idx.song_theme_1 + 1).setValue(d.song_theme_1);
      sh.getRange(row, idx.song_theme_2 + 1).setValue(d.song_theme_2);
      saved++;
    });
    return { saved: saved };
  } finally { lock.releaseLock(); }
}
