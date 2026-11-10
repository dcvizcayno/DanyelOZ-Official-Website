/**
 * Danyel OZ Song Database: data entry app
 * Paste into the sheet's Extensions > Apps Script as Code.gs.
 *
 * Required columns in row 1 (any order):
 *   song_id, song_title, release_date, release_type, song_genre, song_description, song_ISRC, song_qr
 * Optional columns (used when present):
 *   song_upc, record_label, yt_video_link, spotify_link, appl_music_link, amazon_link, bandcamp_embed, song_arts
 */

const SHEET_NAME = '';                          // blank = find the tab whose row 1 has song_id and song_title
const QR_FOLDER_NAME = 'Danyel OZ QR Codes';    // Drive folder for uploaded QR images
const ART_FOLDER_NAME = 'Danyel OZ Song Art';   // Drive folder for uploaded cover art
const APPLE_ARTIST_ID = '1706653995';           // Danyel OZ on Apple Music

const COLUMNS = ['song_id', 'song_title', 'release_date', 'release_type',
                 'song_genre', 'song_description', 'song_ISRC', 'song_qr'];
const OPTIONAL = ['song_upc', 'record_label', 'yt_video_link', 'spotify_link',
                  'appl_music_link', 'amazon_link', 'bandcamp_embed', 'song_arts',
                  'song_theme_1', 'song_theme_2'];   // themes: added by the Singles Page screen
const ALL_FIELDS = COLUMNS.concat(OPTIONAL);
const TEXT_ONLY = ['song_ISRC', 'song_upc'];    // kept as text so leading zeros and long numbers survive

/* ---------- Web page ---------- */

function doGet() {
  return page_()
    .setTitle('Danyel OZ Song Database')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* Builds the page from Form plus the extra screens (ShortsViews/ShortsApp and SinglesViews/SinglesApp files). */
function page_() {
  return HtmlService.createTemplateFromFile('Form').evaluate();
}

/* Pastes another HTML file of this project into the page. */
function include(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

/* Adds a menu inside the sheet so the form can also open from there. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Danyel OZ')
    .addItem('Open data entry', 'openSidebar_')
    .addItem('Import new releases from Apple Music', 'importFromAppleMenu_')
    .addToUi();
}

function openSidebar_() {
  const html = page_().setTitle('Song Database');
  SpreadsheetApp.getUi().showSidebar(html);
}

function importFromAppleMenu_() {
  const r = importFromApple();
  SpreadsheetApp.getUi().alert(r.message);
}

/* ---------- Helpers ---------- */

/* Finds the songs tab by its headers, so other tabs (like Form Responses) can sit anywhere. */
function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (SHEET_NAME) {
    const named = ss.getSheetByName(SHEET_NAME);
    if (!named) throw new Error('Could not find the sheet tab "' + SHEET_NAME + '".');
    return named;
  }
  const tabs = ss.getSheets();
  for (let i = 0; i < tabs.length; i++) {
    const w = tabs[i].getLastColumn();
    if (!w) continue;
    const head = tabs[i].getRange(1, 1, 1, w).getValues()[0]
      .map(function (h) { return String(h).trim().toLowerCase(); });
    if (head.indexOf('song_id') >= 0 && head.indexOf('song_title') >= 0) return tabs[i];
  }
  throw new Error('Could not find a tab with song_id and song_title in row 1.');
}

/* Column positions. Required columns must exist; optional ones are skipped if missing. */
function headers_(sh) {
  const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });
  const idx = {};
  COLUMNS.forEach(function (c) {
    const i = head.indexOf(c.toLowerCase());
    if (i < 0) throw new Error('Row 1 is missing the column "' + c + '".');
    idx[c] = i;
  });
  OPTIONAL.forEach(function (c) {
    const i = head.indexOf(c.toLowerCase());
    if (i >= 0) idx[c] = i;
  });
  return idx;
}

function norm_(s) {
  return String(s || '').toLowerCase().replace(/ - (single|ep)$/, '')
    .replace(/[’']/g, "'").replace(/\s+/g, ' ').trim();
}

function fmtDate_(v) {
  if (v instanceof Date && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(v || '');
}

function parseDate_(s) {
  const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : '';
}

/* Stops text like "=..." or "+..." from being read as a formula. */
function safeText_(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function appleArt_(rel) {
  return rel.artworkUrl100 ? rel.artworkUrl100.replace(/\/\d+x\d+bb\./, '/600x600bb.') : '';
}

function findRow_(sh, idx, id, title) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  id = String(id || '').trim();
  if (id) {
    for (let i = 0; i < vals.length; i++) {
      if (String(vals[i][idx.song_id]).trim() === id) return i + 2;
    }
  }
  const t = norm_(title);
  for (let i = 0; i < vals.length; i++) {
    if (norm_(vals[i][idx.song_title]) === t) return i + 2;
  }
  return 0;
}

/* Inserts blank rows under the header that look like the existing data rows. */
function insertTopRows_(sh, n) {
  sh.insertRowsAfter(1, n);
  const width = sh.getLastColumn();
  if (sh.getLastRow() >= n + 2) {
    sh.getRange(n + 2, 1, 1, width).copyTo(sh.getRange(2, 1, n, width),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }
}

function uploadImage_(f, folderName, fileName) {
  const folders = DriveApp.getFoldersByName(folderName);
  const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
  const ext = (String(f.name || '').match(/\.\w+$/) || ['.png'])[0];
  const name = fileName.replace(/[\\/:*?"<>|]/g, '') + ext;
  const blob = Utilities.newBlob(Utilities.base64Decode(f.base64), f.mimeType || 'image/png', name);
  const file = folder.createFile(blob);
  let warning = '';
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    warning = 'The image was saved, but Google would not make it public, so it may not show on the website. ' +
              'Open the "' + folderName + '" folder in Drive and share it as "Anyone with the link".';
  }
  return { url: 'https://drive.google.com/file/d/' + file.getId() + '/view', warning: warning };
}

/* ---------- Called by the form ---------- */

function getSongs() {
  const sh = sheet_();
  const idx = headers_(sh);
  const last = sh.getLastRow();
  const result = { columns: Object.keys(idx), songs: [] };
  if (last < 2) return result;
  const vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  vals.forEach(function (r, i) {
    const o = { row: i + 2 };
    ALL_FIELDS.forEach(function (c) {
      if (idx[c] == null) { o[c] = ''; return; }
      const v = r[idx[c]];
      o[c] = c === 'release_date' ? fmtDate_(v) : String(v == null ? '' : v);
    });
    if (o.song_title) result.songs.push(o);
  });
  return result;
}

/* Logs how long each step takes (Apps Script > Executions), so a slow save shows where it was stuck. */
function timer_(name) {
  const start = Date.now(); let last = start; const steps = [];
  return {
    step: function (label) { const now = Date.now(); steps.push(label + ' ' + (now - last) + 'ms'); last = now; },
    done: function () { console.log(name + ' took ' + (Date.now() - start) + 'ms: ' + steps.join(', ')); }
  };
}

/* Waits briefly for another save to finish; if it doesn't, fails with a clear message instead of hanging. */
function lock_() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    throw new Error('Another save or import is still running. Wait a moment, then try again.');
  }
  return lock;
}

function saveSong(data) {
  const t = timer_('saveSong');
  const lock = lock_();
  t.step('lock');
  try {
    const sh = sheet_();
    const idx = headers_(sh);
    t.step('find tab + headers');
    const title = String(data.song_title || '').trim();
    if (!title) throw new Error('Song title is required.');
    if (typeof checkSongThemes_ === 'function') checkSongThemes_(data, idx);   // Singles.gs: Theme 1 required once themes exist

    const warnings = [];
    if (data.qrFile && data.qrFile.base64) {
      const up = uploadImage_(data.qrFile, QR_FOLDER_NAME, title + ' QR');
      data.song_qr = up.url; if (up.warning) warnings.push(up.warning);
    }
    if (data.artFile && data.artFile.base64 && idx.song_arts != null) {
      const up2 = uploadImage_(data.artFile, ART_FOLDER_NAME, title + ' Cover');
      data.song_arts = up2.url; if (up2.warning) warnings.push(up2.warning);
    }
    if (data.qrFile || data.artFile) t.step('upload images');

    // Use the row the form loaded, unless the sheet has shifted since.
    let row = Number(data.row) || 0;
    if (row) {
      const there = sh.getRange(row, idx.song_title + 1).getValue();
      if (norm_(there) !== norm_(data.original_title || title)) row = 0;
    }
    if (!row) row = findRow_(sh, idx, data.song_id, title);

    const isNew = !row;
    if (isNew) { insertTopRows_(sh, 1); row = 2; }
    t.step('locate row');

    const width = sh.getLastColumn();
    const rowRange = sh.getRange(row, 1, 1, width);
    const values = rowRange.getValues()[0];
    const formats = rowRange.getNumberFormats()[0];
    t.step('read row');

    const id = String(data.song_id || '').trim();
    if (id) values[idx.song_id] = /^\d+$/.test(id) ? Number(id) : safeText_(id);  // blank keeps the existing ID
    values[idx.song_title] = safeText_(title);
    values[idx.release_date] = parseDate_(data.release_date);

    ALL_FIELDS.forEach(function (c) {
      if (['song_id', 'song_title', 'release_date'].indexOf(c) >= 0 || idx[c] == null) return;
      let v = String(data[c] == null ? '' : data[c]).replace(/\r\n/g, '\n');
      if (c !== 'song_description' && c !== 'bandcamp_embed') v = v.trim();
      if (c === 'song_ISRC') v = v.toUpperCase();
      if (c === 'song_upc') v = v.replace(/\D/g, '');
      values[idx[c]] = safeText_(v);
    });

    // Formats for the whole row in one call: ISRC/UPC as plain text (keeps leading zeros), date as yyyy-mm-dd.
    let fmtChanged = false;
    TEXT_ONLY.forEach(function (c) {
      if (idx[c] != null && formats[idx[c]] !== '@') { formats[idx[c]] = '@'; fmtChanged = true; }
    });
    if (formats[idx.release_date] !== 'yyyy-mm-dd') { formats[idx.release_date] = 'yyyy-mm-dd'; fmtChanged = true; }
    if (fmtChanged) rowRange.setNumberFormats([formats]);

    rowRange.setValues([values]);   // the whole row in a single write
    t.step('write row');
    t.done();

    return { ok: true, row: row, isNew: isNew, warning: warnings.join(' ') };
  } finally {
    lock.releaseLock();
  }
}

/* Adds any Apple Music releases that are not in the sheet yet (newest on top),
   links rows typed in by title only, and fills in blank Apple Music links and cover art. */
function importFromApple() {
  const res = UrlFetchApp.fetch('https://itunes.apple.com/lookup?id=' + APPLE_ARTIST_ID +
    '&entity=album&sort=recent&limit=200&country=us', { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Apple Music did not respond. Try again in a minute.');
  const releases = JSON.parse(res.getContentText()).results
    .filter(function (x) { return x.wrapperType === 'collection'; });

  const lock = lock_();
  try {
    const sh = sheet_();
    const idx = headers_(sh);
    const last = sh.getLastRow();
    const width = sh.getLastColumn();
    const vals = last >= 2 ? sh.getRange(2, 1, last - 1, width).getValues() : [];

    const rowById = {};
    const noIdRows = {};  // title -> index into vals, for rows without a song_id
    vals.forEach(function (r, i) {
      const id = String(r[idx.song_id]).trim();
      if (id) rowById[id] = i;
      else if (r[idx.song_title]) noIdRows[norm_(r[idx.song_title])] = i;
    });

    let linked = 0, filled = 0, changed = false;
    const missing = [];

    function fillBlanks(r, rel) {
      let did = false;
      if (idx.appl_music_link != null && !String(r[idx.appl_music_link]).trim() && rel.collectionViewUrl) {
        r[idx.appl_music_link] = rel.collectionViewUrl.replace(/[?&]uo=\d+/, ''); did = true;
      }
      if (idx.song_arts != null && !String(r[idx.song_arts]).trim() && appleArt_(rel)) {
        r[idx.song_arts] = appleArt_(rel); did = true;
      }
      return did;
    }

    releases.forEach(function (rel) {
      const id = String(rel.collectionId);
      if (rowById[id] != null) {
        if (fillBlanks(vals[rowById[id]], rel)) { filled++; changed = true; }
        return;
      }
      const name = rel.collectionName.replace(/ - (Single|EP)$/, '');
      const i = noIdRows[norm_(name)];
      if (i != null) {
        vals[i][idx.song_id] = Number(id);
        fillBlanks(vals[i], rel);
        delete noIdRows[norm_(name)];
        linked++; changed = true;
      } else {
        missing.push(rel);
      }
    });

    // Write back links/art/IDs for existing rows, but only the columns this import touches,
    // so formulas or edits elsewhere in the row are never rewritten.
    if (changed) {
      ['song_id', 'appl_music_link', 'song_arts'].forEach(function (c) {
        if (idx[c] == null) return;
        sh.getRange(2, idx[c] + 1, vals.length, 1).setValues(vals.map(function (r) { return [r[idx[c]]]; }));
      });
    }

    if (missing.length) {
      missing.sort(function (a, b) { return new Date(b.releaseDate) - new Date(a.releaseDate); });
      const rows = missing.map(function (rel) {
        const r = new Array(width).fill('');
        const d = new Date(rel.releaseDate);
        r[idx.song_id] = Number(rel.collectionId);
        r[idx.song_title] = safeText_(rel.collectionName.replace(/ - (Single|EP)$/, ''));
        r[idx.release_date] = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        r[idx.release_type] = / - EP$/.test(rel.collectionName) ? 'EP' : (rel.trackCount > 1 ? 'Album' : 'Single');
        r[idx.song_genre] = rel.primaryGenreName || '';
        fillBlanks(r, rel);
        return r;
      });
      insertTopRows_(sh, rows.length);
      sh.getRange(2, 1, rows.length, width).setValues(rows);
      sh.getRange(2, idx.release_date + 1, rows.length, 1).setNumberFormat('yyyy-mm-dd');
    }

    const titles = missing.map(function (r) { return r.collectionName.replace(/ - (Single|EP)$/, ''); });
    const parts = [];
    parts.push(missing.length
      ? 'Added ' + missing.length + ' new release' + (missing.length > 1 ? 's' : '') + ': ' + titles.join(', ') + '.'
      : 'No new releases found.');
    if (linked) parts.push('Linked ' + linked + ' row' + (linked > 1 ? 's' : '') + ' to Apple Music.');
    if (filled) parts.push('Filled in Apple Music links or cover art for ' + filled + ' song' + (filled > 1 ? 's' : '') + '.');
    return { added: missing.length, linked: linked, filled: filled, titles: titles, message: parts.join(' ') };
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================================
   Monthly features: 3 featured videos per month, planned up to 12 months ahead.
   Stored in a tab called "features" (created automatically the first time).
   Columns: month (YYYY-MM), slot (1-3), song_id, yt_video_link, title, description
   ===================================================================== */

const FEATURES_TAB = 'features';
const FEATURE_COLUMNS = ['month', 'slot', 'song_id', 'yt_video_link', 'title', 'description'];

function featuresSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(FEATURES_TAB);
  if (!sh) {
    sh = ss.insertSheet(FEATURES_TAB);
    sh.getRange(1, 1, 1, FEATURE_COLUMNS.length).setValues([FEATURE_COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('@');   // keep "2026-12" as text, not a date
  }
  return sh;
}

function featureIdx_(sh) {
  const head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });
  const idx = {};
  FEATURE_COLUMNS.forEach(function (c) {
    const i = head.indexOf(c);
    if (i < 0) throw new Error('The "' + FEATURES_TAB + '" tab is missing the column "' + c + '".');
    idx[c] = i;
  });
  return idx;
}

function monthKey_(v) {
  if (v instanceof Date && !isNaN(v)) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM');
  const m = String(v || '').match(/^(\d{4})-(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) : '';
}

function ytId_(url) {
  const m = String(url || '').match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})(?![\w-])/);
  return m ? m[1] : '';
}

/* Every scheduled feature, grouped by month: { "2026-12": [slot1, slot2, slot3], ... } */
function getFeatures() {
  const sh = featuresSheet_();
  const idx = featureIdx_(sh);
  const last = sh.getLastRow();
  const out = {};
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues().forEach(function (r) {
    const month = monthKey_(r[idx.month]);
    const slot = Number(r[idx.slot]);
    if (!month || !(slot >= 1 && slot <= 3)) return;
    out[month] = out[month] || [null, null, null];
    out[month][slot - 1] = {
      song_id: String(r[idx.song_id] == null ? '' : r[idx.song_id]),
      yt_video_link: String(r[idx.yt_video_link] || ''),
      title: String(r[idx.title] || ''),
      description: String(r[idx.description] || '')
    };
  });
  return out;
}

/* Replaces one month's 3 slots. Empty slots are simply not stored. */
function saveFeaturesMonth(month, slots) {
  month = monthKey_(month);
  if (!month) throw new Error('Pick a month first.');
  (slots || []).forEach(function (s, i) {
    if (s && s.yt_video_link && !ytId_(s.yt_video_link)) {
      throw new Error('Feature ' + (i + 1) + ': that doesn\'t look like a YouTube video link.');
    }
  });

  const lock = lock_();
  try {
    const sh = featuresSheet_();
    const idx = featureIdx_(sh);
    const width = sh.getLastColumn();

    // Remove this month's old rows (bottom-up so row numbers stay valid).
    const last = sh.getLastRow();
    if (last >= 2) {
      const months = sh.getRange(2, idx.month + 1, last - 1, 1).getValues();
      for (let i = months.length - 1; i >= 0; i--) {
        if (monthKey_(months[i][0]) === month) sh.deleteRow(i + 2);
      }
    }

    const rows = [];
    (slots || []).slice(0, 3).forEach(function (s, i) {
      if (!s || !(s.yt_video_link || s.song_id || s.title)) return;
      const r = new Array(width).fill('');
      r[idx.month] = month;
      r[idx.slot] = i + 1;
      const id = String(s.song_id || '').trim();
      r[idx.song_id] = /^\d+$/.test(id) ? Number(id) : safeText_(id);
      r[idx.yt_video_link] = safeText_(String(s.yt_video_link || '').trim());
      r[idx.title] = safeText_(String(s.title || '').trim());
      r[idx.description] = safeText_(String(s.description || '').replace(/\r\n/g, '\n'));
      rows.push(r);
    });

    if (rows.length) {
      const start = sh.getLastRow() + 1;
      sh.getRange(start, idx.month + 1, rows.length, 1).setNumberFormat('@');
      sh.getRange(start, 1, rows.length, width).setValues(rows);
    }

    // Keep the tab tidy: sorted by month, then slot.
    if (sh.getLastRow() > 2) {
      sh.getRange(2, 1, sh.getLastRow() - 1, width).sort([{ column: idx.month + 1, ascending: true }, { column: idx.slot + 1, ascending: true }]);
    }
    return { ok: true, month: month, saved: rows.length };
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================================
   Explore panels: the "Explore the Music" section on the website.
   Stored in a tab called "explore" (created with the current four panels the first time).
   ===================================================================== */

const PANELS_TAB = 'explore';
const PANEL_COLUMNS = ['order', 'visible', 'title', 'script', 'sub', 'text', 'link', 'image', 'focus'];
const SITE_IMAGES_FOLDER = 'Danyel OZ Site Images';
const DEFAULT_PANELS = [
  { title: 'Albums', script: 'Stories', sub: 'Original Music & Storytelling',
    text: 'Full-length collections of original music, connected stories, and experiences about love, life, and personal growth.',
    link: 'https://www.danyeloz.info/released/albums-original-music-stories',
    image: 'https://lh7-us.googleusercontent.com/sitesv-images-rt/AMxu72uqLBkJB68azHlTUj9_8wlFCi0z4I-PUBIRDCMNQHCClKrUO3wSc2kbIaC3Cg7o3EDrU_1AMGhp4ZvXE8AwiwX_zUoEd7aDdOb_Q9AOalceqRgaRz56OLwxDkcZ5F0fz9pVXEh4UpP5LjPY8nRuCPGYrzzTdK5uCJEqO_ZnzMEaUqCCDK1ngqspDVpJQdN0KCBG1zn9J3Wc4FZiH1y2x6Xu8Z2U4CKfNM_bndLdigo', focus: 'center 30%' },
  { title: 'Singles', script: 'New Releases', sub: 'Original Songs',
    text: 'Standalone original songs exploring relationships, emotions, self-discovery, and everyday experiences.',
    link: 'https://www.danyeloz.info/released/singles-original-songs-releases',
    image: 'https://lh7-us.googleusercontent.com/sitesv-images-rt/AMxu72u5XgqAptvUAj8QdnH5KuUYAYRRCHbslMlcR4Z7AWG85RU0JmC-Vr3BT5JEY4L2MCXFVGXTS1_17Gdh-FS3ZultE3M0sYyHNkekVgQenl4wqS8H_vQ1uTqv7Kr1fgHC1hVPAHZnd5nS1Qr38KDk2Bb7UAC8HcewnOB7wrJvLrOSlZ_I-EigH-v6AwGpYftTYhIrchw0byKNnIoUAoOnSaq-q8U6igoU-ZMn1Hkncy8', focus: 'center 25%' },
  { title: "EP's", script: 'Short Stories', sub: 'Alternative Pop',
    text: 'Small collections of songs connected by one theme, one story, or one feeling.',
    link: 'https://www.danyeloz.info/released/eps-alternative-pop-original-music',
    image: 'https://lh7-us.googleusercontent.com/sitesv-images-rt/AMxu72sHtBGGbXWkUrys1ucAxS852zsQu45BDDFvhXdMOPCfV1q3XvMNsP1axkzhUX8cLG8NG18A_g0hkinNkjqR_eNvRIz-jxPrd2nYn0ppnKdgjPU7_4zqlPNc8W6YOTZ2OZuR4gmj3TelVuO9Gj2TTZTjDzywjOu9tCq7ntdB86b2VkYsDNiOI-N0UQWsPHNxMgzwgrdZDtHSUUcrPlO8FlHMoEl5QwBMsHXEHwpyfBE', focus: 'center 30%' },
  { title: 'Holidays', script: 'Seasonal', sub: 'Songs for the Season',
    text: 'Holiday songs and year-end releases for the moments shared with family, friends, and the ones we love.',
    link: 'https://www.danyeloz.info/released/holiday-music-seasonal-songs',
    image: 'https://lh7-us.googleusercontent.com/sitesv-images-rt/AMxu72tQi29YctYbI-J9VJqyMSx6gUC4wDuSobrbsujF9TjDMnHVLd80xsbkTbx8AFS3v4kdkJOmtG65ohe1JWDD6B1v0dCy1D5-PAlvEOli-6Ku_RvETITyYZwqX4Y6GH9LcpCcsd4L2gcR8uiiiq82I8YBgvdXyIjeQ3gnMTC_i9eC6kGCjxSJtpewQ6geGj_ZMj7wnPnXSYQp--_SNi_C5-gKSrFddgbSCFR2eqyJ', focus: 'center 25%' }
];

function panelsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(PANELS_TAB);
  if (!sh) {
    sh = ss.insertSheet(PANELS_TAB);
    sh.getRange(1, 1, 1, PANEL_COLUMNS.length).setValues([PANEL_COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
    const rows = DEFAULT_PANELS.map(function (p, i) {
      return PANEL_COLUMNS.map(function (c) { return c === 'order' ? i + 1 : c === 'visible' ? 'yes' : (p[c] || ''); });
    });
    sh.getRange(2, 1, rows.length, PANEL_COLUMNS.length).setValues(rows);
  }
  return sh;
}

function panelIdx_(sh) {
  const head = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h).trim().toLowerCase(); });
  const idx = {};
  PANEL_COLUMNS.forEach(function (c) {
    const i = head.indexOf(c);
    if (i < 0) throw new Error('The "' + PANELS_TAB + '" tab is missing the column "' + c + '".');
    idx[c] = i;
  });
  return idx;
}

function getPanels() {
  const sh = panelsSheet_();
  const idx = panelIdx_(sh);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues()
    .map(function (r) {
      const o = {};
      PANEL_COLUMNS.forEach(function (c) { o[c] = String(r[idx[c]] == null ? '' : r[idx[c]]); });
      o.visible = !/^(no|false|0|hide|hidden)$/i.test(o.visible.trim());
      o.order = Number(o.order) || 999;
      return o;
    })
    .filter(function (p) { return p.title; })
    .sort(function (a, b) { return a.order - b.order; });
}

/* Replaces all panels in the order given. Each panel may carry an uploaded image (imageFile). */
function savePanels(panels) {
  if (!Array.isArray(panels)) throw new Error('Nothing to save.');
  panels.forEach(function (p, i) {
    if (!String(p.title || '').trim()) throw new Error('Panel ' + (i + 1) + ' needs a header.');
    if (p.link && !/^https:\/\//i.test(String(p.link).trim())) throw new Error('Panel ' + (i + 1) + ': the link must start with https://');
    if (p.image && !p.imageFile && !/^https:\/\//i.test(String(p.image).trim())) throw new Error('Panel ' + (i + 1) + ': the image link must start with https://');
  });

  const warnings = [];
  panels.forEach(function (p) {
    if (p.imageFile && p.imageFile.base64) {
      const up = uploadImage_(p.imageFile, SITE_IMAGES_FOLDER, 'Explore - ' + p.title);
      p.image = up.url; if (up.warning) warnings.push(up.warning);
    }
  });

  const lock = lock_();
  try {
    const sh = panelsSheet_();
    const idx = panelIdx_(sh);
    const width = sh.getLastColumn();
    const rows = panels.map(function (p, i) {
      const r = new Array(width).fill('');
      r[idx.order] = i + 1;
      r[idx.visible] = p.visible === false ? 'no' : 'yes';
      ['title', 'script', 'sub', 'text', 'link', 'image', 'focus'].forEach(function (c) {
        r[idx[c]] = safeText_(String(p[c] == null ? '' : p[c]).trim());
      });
      return r;
    });
    const last = sh.getLastRow();
    if (last >= 2) sh.getRange(2, 1, last - 1, width).clearContent();
    if (rows.length) sh.getRange(2, 1, rows.length, width).setValues(rows);
    return { ok: true, saved: rows.length, panels: getPanels(), warning: warnings.join(' ') };
  } finally {
    lock.releaseLock();
  }
}

/* =====================================================================
   Music Highlights: up to 3 cards per month, planned 12 months ahead.
   Stored in the "music_highlights" tab. Missing columns are added automatically;
   columns the app doesn't use (like "Row" or "Actions") are left alone.
   ===================================================================== */

const HIGHLIGHTS_TAB = 'music_highlights';
const HIGHLIGHT_COLUMNS = ['month', 'slot', 'actLabel', 'title', 'subtitle', 'catalogTag', 'accentHex',
  'bandcamp_embed', 'coverImageUrl', 'appleMusicUrl', 'spotifyUrl', 'youtubeMusicUrl', 'amazonMusicUrl'];

function highlightsSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(HIGHLIGHTS_TAB);
  if (!sh) {
    sh = ss.insertSheet(HIGHLIGHTS_TAB);
    sh.getRange(1, 1, 1, HIGHLIGHT_COLUMNS.length).setValues([HIGHLIGHT_COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Column positions by header (any order, any capitalization). Adds any that are missing. */
function highlightIdx_(sh) {
  const width = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim().toLowerCase(); });
  const idx = {};
  let next = head.filter(String).length ? head.length : 0;
  HIGHLIGHT_COLUMNS.forEach(function (c) {
    let i = head.indexOf(c.toLowerCase());
    if (i < 0) { i = next++; sh.getRange(1, i + 1).setValue(c).setFontWeight('bold'); }
    idx[c] = i;
  });
  return idx;
}

function getHighlights() {
  const sh = highlightsSheet_();
  const idx = highlightIdx_(sh);
  const last = sh.getLastRow();
  const out = {};
  if (last < 2) return out;
  sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues().forEach(function (r) {
    const month = monthKey_(r[idx.month]);
    const slot = Number(r[idx.slot]);
    if (!month || !(slot >= 1 && slot <= 3) || !String(r[idx.title] || '').trim()) return;
    const o = {};
    HIGHLIGHT_COLUMNS.forEach(function (c) { o[c] = String(r[idx[c]] == null ? '' : r[idx[c]]); });
    o.month = month; o.slot = slot;
    out[month] = out[month] || [null, null, null];
    out[month][slot - 1] = o;
  });
  return out;
}

/* Replaces one month's cards. Empty slots are simply not stored. */
function saveHighlightsMonth(month, slots) {
  month = monthKey_(month);
  if (!month) throw new Error('Pick a month first.');
  const linkCols = ['coverImageUrl', 'appleMusicUrl', 'spotifyUrl', 'youtubeMusicUrl', 'amazonMusicUrl'];
  (slots || []).forEach(function (s, i) {
    if (!s || !String(s.title || '').trim()) return;
    linkCols.forEach(function (c) {
      if (s[c] && !/^https:\/\//i.test(String(s[c]).trim())) throw new Error('Card ' + (i + 1) + ': the ' + c + ' link must start with https://');
    });
    if (s.accentHex && !/^#[0-9a-f]{6}$/i.test(String(s.accentHex).trim())) throw new Error('Card ' + (i + 1) + ': the color must look like #C82829.');
    if (s.bandcamp_embed && !/bandcamp\.com\/EmbeddedPlayer\//i.test(s.bandcamp_embed)) throw new Error('Card ' + (i + 1) + ': that doesn\'t look like Bandcamp embed code.');
  });

  const lock = lock_();
  try {
    const sh = highlightsSheet_();
    const idx = highlightIdx_(sh);
    const width = sh.getLastColumn();

    const last = sh.getLastRow();
    if (last >= 2) {
      const months = sh.getRange(2, idx.month + 1, last - 1, 1).getValues();
      for (let i = months.length - 1; i >= 0; i--) {
        if (monthKey_(months[i][0]) === month) sh.deleteRow(i + 2);
      }
    }

    const rows = [];
    (slots || []).slice(0, 3).forEach(function (s, i) {
      if (!s || !String(s.title || '').trim()) return;
      const r = new Array(width).fill('');
      HIGHLIGHT_COLUMNS.forEach(function (c) { r[idx[c]] = safeText_(String(s[c] == null ? '' : s[c]).trim()); });
      r[idx.month] = month;
      r[idx.slot] = i + 1;
      rows.push(r);
    });
    if (rows.length) {
      const start = sh.getLastRow() + 1;
      sh.getRange(start, idx.month + 1, rows.length, 1).setNumberFormat('@');
      sh.getRange(start, 1, rows.length, width).setValues(rows);
    }
    if (sh.getLastRow() > 2) {
      sh.getRange(2, 1, sh.getLastRow() - 1, width).sort([{ column: idx.month + 1, ascending: true }, { column: idx.slot + 1, ascending: true }]);
    }
    return { ok: true, month: month, saved: rows.length };
  } finally {
    lock.releaseLock();
  }
}
