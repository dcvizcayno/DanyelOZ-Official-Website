/**
 * Danyel OZ admin: Shorts Scheduler and Analytics (server side).
 * Add to the same Apps Script project as Code.gs, as a new script file named "Shorts".
 *
 * Where things live
 *   Shorts schedule: a separate PRIVATE spreadsheet the app creates on first use
 *                    ("Danyel OZ Shorts (private)"), so drafts and Drive links never
 *                    land in the public Song Database.
 *   Videos:          Drive folder "Danyel OZ Shorts" (private, not shared).
 *   Reports:         Drive folder "Danyel OZ Reports" (private).
 *
 * Optional setup (Project Settings > Script Properties)
 *   GEMINI_API_KEY   lets Gemini write the captions. Without it, captions come from
 *                    simple templates built on the song's own story.
 *   GEMINI_MODEL     optional, defaults to gemini-flash-latest.
 * YouTube upload needs the "YouTube Data API v3" service (Editor > Services > +).
 */

const SHORTS_FOLDER_NAME = 'Danyel OZ Shorts';
const REPORTS_FOLDER_NAME = 'Danyel OZ Reports';
const SHORTS_BOOK_NAME = 'Danyel OZ Shorts (private)';
const SHORTS_TAB = 'shorts';
const SHORT_COLUMNS = ['short_id', 'song_id', 'song_title', 'drive_file_id', 'file_name', 'size_mb',
  'scheduled_date', 'scheduled_time', 'yt', 'tt', 'ig', 'status', 'angle',
  'yt_title', 'yt_description', 'yt_tags', 'tt_caption', 'tt_tags', 'ig_caption', 'ig_tags',
  'yt_video_id', 'created_at', 'updated_at'];
const SHORT_EDITABLE = ['scheduled_date', 'scheduled_time', 'yt', 'tt', 'ig', 'status',
  'yt_title', 'yt_description', 'yt_tags', 'tt_caption', 'tt_tags', 'ig_caption', 'ig_tags'];
const SHORT_STATUSES = ['Draft', 'Scheduled', 'Ready to post', 'Uploaded (private)', 'Published'];
const SHORT_ANGLES = {
  story: 'Story behind the song',
  vocal: 'Late-night vocal take',
  acoustic: 'Acoustic breakdown',
  hook: 'Chorus hook'
};
const SHORT_LIMITS = { yt_title: 100, yt_description: 5000, tt_caption: 2200, ig_caption: 2200 };
const UPLOAD_LIMIT_MB = 30;     // through the app; bigger files go straight into the Drive folder
const YOUTUBE_LIMIT_MB = 50;    // the most Apps Script can hand to YouTube in one go
const GEMINI_DEFAULT_MODEL = 'gemini-flash-latest';
const BANDCAMP_HOME = 'https://danyeloz.bandcamp.com/';
const SITE_URL = 'https://www.danyeloz.info';

/* ---------- Helpers ---------- */

function props_() { return PropertiesService.getScriptProperties(); }

function folder_(name) {
  const it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}

function bool_(v) { return v === true || /^(true|yes|1|x)$/i.test(String(v).trim()); }

function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, 'Asia/Manila', 'yyyy-MM-dd');
  return String(v == null ? '' : v);
}

function manilaNow_(fmt) { return Utilities.formatDate(new Date(), 'Asia/Manila', fmt || "yyyy-MM-dd'T'HH:mm"); }

/* Opens the private Shorts spreadsheet, creating it (and its header) the first time. */
function shortsSheet_() {
  const p = props_();
  const id = p.getProperty('SHORTS_SHEET_ID');
  let book = null;
  if (id) { try { book = SpreadsheetApp.openById(id); } catch (e) { book = null; } }
  if (!book) {
    book = SpreadsheetApp.create(SHORTS_BOOK_NAME);
    p.setProperty('SHORTS_SHEET_ID', book.getId());
  }
  let sh = book.getSheetByName(SHORTS_TAB);
  if (!sh) {
    const sheets = book.getSheets();
    if (sheets.length === 1 && sheets[0].getLastRow() === 0) { sh = sheets[0]; sh.setName(SHORTS_TAB); }
    else sh = book.insertSheet(SHORTS_TAB);
  }
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1000, SHORT_COLUMNS.length).setNumberFormat('@');   // dates and times stay as typed
    sh.getRange(1, 1, 1, SHORT_COLUMNS.length).setValues([SHORT_COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

/* Column positions by header name; adds any missing columns at the end. */
function shortIdx_(sh) {
  const width = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
  const idx = {};
  head.forEach(function (h, i) { if (h) idx[h] = i; });
  let next = head.filter(String).length ? width : 0;
  SHORT_COLUMNS.forEach(function (c) {
    if (idx[c] == null) { sh.getRange(1, next + 1).setValue(c); idx[c] = next; next++; }
  });
  return idx;
}

function readShorts_(sh) {
  const idx = shortIdx_(sh);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const vals = sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues();
  const out = [];
  vals.forEach(function (r, i) {
    const o = { row: i + 2 };
    SHORT_COLUMNS.forEach(function (c) { o[c] = cell_(r[idx[c]]); });
    if (!o.short_id) return;
    o.yt = bool_(o.yt); o.tt = bool_(o.tt); o.ig = bool_(o.ig);
    out.push(o);
  });
  return out;
}

function writeShort_(sh, s) {
  const idx = shortIdx_(sh);
  const width = sh.getLastColumn();
  const row = new Array(width).fill('');
  if (s.row) {
    const cur = sh.getRange(s.row, 1, 1, width).getValues()[0];
    cur.forEach(function (v, i) { row[i] = v; });
  }
  SHORT_COLUMNS.forEach(function (c) {
    let v = s[c];
    if (c === 'yt' || c === 'tt' || c === 'ig') v = v ? 'TRUE' : 'FALSE';
    row[idx[c]] = safeText_(v == null ? '' : v);
  });
  if (!s.row) s.row = Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(s.row, 1, 1, width).setNumberFormat('@').setValues([row]);
  return s;
}

function findShort_(sh, id) {
  const s = readShorts_(sh).filter(function (x) { return x.short_id === String(id); })[0];
  if (!s) throw new Error('That Short is no longer in the schedule. Reload and try again.');
  return s;
}

function songFor_(short) {
  const all = getSongs().songs;
  return all.filter(function (s) { return short.song_id && String(s.song_id) === String(short.song_id); })[0] ||
         all.filter(function (s) { return norm_(s.song_title) === norm_(short.song_title); })[0] || null;
}

function bandcampLink_(song) {
  const m = String(song && song.bandcamp_embed || '').match(/href="(https:\/\/[^"]*bandcamp\.com\/[^"]+)"/i);
  return m ? m[1] : BANDCAMP_HOME;
}

function checkDate_(d) {
  if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error('Dates need the form yyyy-mm-dd.');
}
function checkTime_(t) {
  if (t && !/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new Error('Times need the form HH:MM (24 hours), for example 19:30.');
}

/* ---------- Load ---------- */

function getShortsData() {
  const sh = shortsSheet_();
  const songs = getSongs().songs.map(function (s) {
    return {
      song_id: s.song_id, song_title: s.song_title, release_date: s.release_date,
      release_type: s.release_type, song_genre: s.song_genre,
      hasStory: !!String(s.song_description).trim(),
      hasBandcamp: /bandcamp\.com\/EmbeddedPlayer/i.test(s.bandcamp_embed)
    };
  });
  return {
    shorts: readShorts_(sh),
    songs: songs,
    angles: SHORT_ANGLES,
    statuses: SHORT_STATUSES,
    ai: !!props_().getProperty('GEMINI_API_KEY'),
    youtube: typeof YouTube !== 'undefined',
    sheetUrl: sh.getParent().getUrl(),
    folderUrl: folder_(SHORTS_FOLDER_NAME).getUrl(),
    uploadLimitMb: UPLOAD_LIMIT_MB,
    youtubeLimitMb: YOUTUBE_LIMIT_MB
  };
}

/* Light list for the Songs screen panel (no song lookups, so it opens fast). */
function getShortsList() {
  return readShorts_(shortsSheet_()).map(function (s) {
    return { short_id: s.short_id, song_id: s.song_id, song_title: s.song_title, file_name: s.file_name,
             scheduled_date: s.scheduled_date, scheduled_time: s.scheduled_time, status: s.status, yt: s.yt, tt: s.tt, ig: s.ig };
  });
}

/* Videos already sitting in the "Danyel OZ Shorts" Drive folder, newest first. */
function listShortFiles() {
  const it = folder_(SHORTS_FOLDER_NAME).getFiles();
  const out = [];
  while (it.hasNext() && out.length < 300) {
    const f = it.next();
    if (!/^video\//.test(f.getMimeType())) continue;
    out.push({ id: f.getId(), name: f.getName(), sizeMb: Math.round(f.getSize() / 104857.6) / 10,
               updated: f.getLastUpdated().getTime() });
  }
  out.sort(function (a, b) { return b.updated - a.updated; });
  return out.slice(0, 100);
}

function uploadShortVideo(f) {
  if (!f || !f.base64) throw new Error('No video was received.');
  if (!/^video\//.test(f.mimeType || '')) throw new Error('That file is not a video.');
  const mb = f.base64.length * 0.75 / 1048576;
  if (mb > UPLOAD_LIMIT_MB) {
    throw new Error('Videos over ' + UPLOAD_LIMIT_MB + ' MB are too big to send through the app. ' +
                    'Drop it in the Drive folder "' + SHORTS_FOLDER_NAME + '", then pick it from the list.');
  }
  const name = String(f.name || 'short.mp4').replace(/[\\/:*?"<>|]/g, '');
  const file = folder_(SHORTS_FOLDER_NAME).createFile(Utilities.newBlob(Utilities.base64Decode(f.base64), f.mimeType, name));
  return { id: file.getId(), name: file.getName(), sizeMb: Math.round(file.getSize() / 104857.6) / 10 };
}

/* ---------- Create, edit, delete ---------- */

function addShort(d) {
  const t = timer_('addShort');
  d = d || {};
  checkDate_(d.scheduled_date); checkTime_(d.scheduled_time);
  const song = getSongs().songs.filter(function (s) {
    return (d.song_id && String(s.song_id) === String(d.song_id)) || norm_(s.song_title) === norm_(d.song_title);
  })[0];
  if (!song) throw new Error('Pick a song from your Song Database first.');
  if (!d.drive_file_id) throw new Error('Pick or upload the video first.');
  let file;
  try { file = DriveApp.getFileById(d.drive_file_id); } catch (e) { throw new Error('Can’t open that video in Drive. Pick it again.'); }
  t.step('lookup');

  const angle = SHORT_ANGLES[d.angle] ? d.angle : 'story';
  const cap = captions_(song, angle, '');
  t.step('captions');

  const lock = lock_();
  try {
    const sh = shortsSheet_();
    const now = manilaNow_();
    const s = {
      short_id: 'S' + Date.now().toString(36).toUpperCase(),
      song_id: song.song_id, song_title: song.song_title,
      drive_file_id: file.getId(), file_name: file.getName(),
      size_mb: String(Math.round(file.getSize() / 104857.6) / 10),
      scheduled_date: d.scheduled_date || '', scheduled_time: d.scheduled_time || '',
      yt: d.yt !== false, tt: d.tt !== false, ig: !!d.ig,
      status: d.scheduled_date ? 'Scheduled' : 'Draft', angle: angle,
      yt_video_id: '', created_at: now, updated_at: now
    };
    applyCaptions_(s, cap);
    writeShort_(sh, s);
    t.step('write');
    return { short: s, warning: cap.warning || '', source: cap.source };
  } finally { lock.releaseLock(); t.done(); }
}

function generateCaptions(shortId, angle, note) {
  const sh = shortsSheet_();
  const s = findShort_(sh, shortId);
  const song = songFor_(s);
  if (!song) throw new Error('The song for this Short is no longer in your Song Database.');
  const a = SHORT_ANGLES[angle] ? angle : (s.angle || 'story');
  const cap = captions_(song, a, String(note || '').slice(0, 300));
  const lock = lock_();
  try {
    const fresh = findShort_(sh, shortId);
    fresh.angle = a;
    applyCaptions_(fresh, cap);
    fresh.updated_at = manilaNow_();
    writeShort_(sh, fresh);
    return { short: fresh, warning: cap.warning || '', source: cap.source };
  } finally { lock.releaseLock(); }
}

function saveShort(d) {
  if (!d || !d.short_id) throw new Error('Nothing to save.');
  checkDate_(d.scheduled_date); checkTime_(d.scheduled_time);
  if (d.status != null && SHORT_STATUSES.indexOf(d.status) < 0) throw new Error('Unknown status: ' + d.status);
  Object.keys(SHORT_LIMITS).forEach(function (k) {
    if (d[k] != null && String(d[k]).length > SHORT_LIMITS[k]) {
      throw new Error(k.replace('_', ' ') + ' is over ' + SHORT_LIMITS[k] + ' characters.');
    }
  });
  const lock = lock_();
  try {
    const sh = shortsSheet_();
    const s = findShort_(sh, d.short_id);
    SHORT_EDITABLE.forEach(function (k) {
      if (d[k] === undefined) return;
      s[k] = (k === 'yt' || k === 'tt' || k === 'ig') ? !!d[k] : String(d[k]);
    });
    ['yt_tags', 'tt_tags', 'ig_tags'].forEach(function (k) { if (d[k] !== undefined) s[k] = tags_(d[k], [], 30).join(' '); });
    s.updated_at = manilaNow_();
    writeShort_(sh, s);
    return s;
  } finally { lock.releaseLock(); }
}

/* Removes the Short from the schedule. The video stays in Drive. */
function deleteShort(shortId) {
  const lock = lock_();
  try {
    const sh = shortsSheet_();
    const s = findShort_(sh, shortId);
    sh.deleteRow(s.row);
    return { deleted: s.short_id, file: s.file_name };
  } finally { lock.releaseLock(); }
}

/* Spaces the selected Shorts out from a start date. Skips anything already uploaded or published. */
function applyBatch(ids, opts) {
  ids = (ids || []).map(String);
  opts = opts || {};
  checkDate_(opts.start); checkTime_(opts.time);
  if (!opts.start) throw new Error('Pick a start date.');
  if (!ids.length) throw new Error('Select at least one Short.');
  const lock = lock_();
  try {
    const sh = shortsSheet_();
    const all = readShorts_(sh);
    const dates = batchDates_(opts.start, opts.cadence || 'daily', ids.length);
    let n = 0, skipped = 0;
    ids.forEach(function (id) {
      const s = all.filter(function (x) { return x.short_id === id; })[0];
      if (!s) return;
      if (s.status === 'Uploaded (private)' || s.status === 'Published') { skipped++; return; }
      s.scheduled_date = dates[n];
      if (opts.time) s.scheduled_time = opts.time;
      if (opts.ig === 'on') s.ig = true;
      if (opts.ig === 'off') s.ig = false;
      s.status = 'Scheduled';
      s.updated_at = manilaNow_();
      writeShort_(sh, s);
      n++;
    });
    return { scheduled: n, skipped: skipped };
  } finally { lock.releaseLock(); }
}

function batchDates_(start, cadence, count) {
  const out = [];
  const d = new Date(start + 'T00:00:00Z');
  const step = { daily: 1, '2days': 2, weekly: 7 }[cadence];
  const mwf = cadence === 'mwf';
  if (!mwf && !step) throw new Error('Unknown cadence.');
  while (out.length < count) {
    if (!mwf || [1, 3, 5].indexOf(d.getUTCDay()) >= 0) {
      out.push(d.toISOString().slice(0, 10));
      d.setUTCDate(d.getUTCDate() + (mwf ? 1 : step));
    } else {
      d.setUTCDate(d.getUTCDate() + 1);
    }
  }
  return out;
}

/* ---------- YouTube ---------- */

function uploadShortToYouTube(shortId) {
  if (typeof YouTube === 'undefined') {
    throw new Error('Turn on YouTube first: in the Apps Script editor, click Services (+), pick "YouTube Data API v3", then Add.');
  }
  const sh = shortsSheet_();
  const s = findShort_(sh, shortId);
  if (s.yt_video_id) throw new Error('This Short is already on YouTube (video ' + s.yt_video_id + ').');
  if (!s.yt_title) throw new Error('Add a YouTube title first.');
  const file = DriveApp.getFileById(s.drive_file_id);
  const mb = file.getSize() / 1048576;
  if (mb > YOUTUBE_LIMIT_MB) {
    throw new Error('This video is ' + Math.round(mb) + ' MB. The app can send up to ' + YOUTUBE_LIMIT_MB +
                    ' MB to YouTube, so upload this one in YouTube Studio and paste the text from "Copy YouTube text".');
  }
  const clean = function (x) { return String(x || '').replace(/[<>]/g, ''); };
  const tags = tags_(s.yt_tags, [], 15);
  const resource = {
    snippet: {
      title: clean(s.yt_title).slice(0, 100),
      description: clean(s.yt_description + (tags.length ? '\n\n' + tags.join(' ') : '')).slice(0, 5000),
      tags: tags.map(function (x) { return x.slice(1); }),
      categoryId: '10'
    },
    status: { privacyStatus: 'private', selfDeclaredMadeForKids: false }
  };
  // If it's scheduled ahead, ask YouTube to publish then. Until Google approves the app, YouTube keeps it private anyway.
  if (s.scheduled_date) {
    const when = new Date(s.scheduled_date + 'T' + (s.scheduled_time || '19:00') + ':00+08:00');
    if (when.getTime() > Date.now() + 15 * 60000) resource.status.publishAt = when.toISOString();
  }
  const video = YouTube.Videos.insert(resource, 'snippet,status', file.getBlob());
  const lock = lock_();
  try {
    const fresh = findShort_(sh, shortId);
    fresh.yt_video_id = video.id;
    fresh.status = 'Uploaded (private)';
    fresh.updated_at = manilaNow_();
    writeShort_(sh, fresh);
    return { short: fresh, studio: 'https://studio.youtube.com/video/' + video.id + '/edit' };
  } finally { lock.releaseLock(); }
}

/* Uploads the selected Shorts that have YouTube ticked. Stops early to stay inside Apps Script's time limit. */
function publishSelected(ids) {
  const start = Date.now();
  const sh = shortsSheet_();
  const all = readShorts_(sh);
  const done = [], skipped = [], failed = [];
  (ids || []).map(String).forEach(function (id) {
    const s = all.filter(function (x) { return x.short_id === id; })[0];
    if (!s) return;
    if (!s.yt || s.yt_video_id) { skipped.push(s.song_title); return; }
    if (Date.now() - start > 4 * 60000) { skipped.push(s.song_title + ' (time ran out, run again)'); return; }
    try { uploadShortToYouTube(id); done.push(s.song_title); }
    catch (e) { failed.push(s.song_title + ': ' + e.message); }
  });
  return { uploaded: done, skipped: skipped, failed: failed };
}

/* ---------- Captions ---------- */

function applyCaptions_(s, c) {
  ['yt_title', 'yt_description', 'tt_caption', 'ig_caption'].forEach(function (k) { s[k] = c[k]; });
  s.yt_tags = c.yt_tags.join(' ');
  s.tt_tags = c.tt_tags.join(' ');
  s.ig_tags = c.ig_tags.join(' ');
}

function captions_(song, angle, note) {
  const link = bandcampLink_(song);
  const base = templateCaptions_(song, angle, link);
  if (!props_().getProperty('GEMINI_API_KEY')) return base;
  try {
    const ai = gemini_(captionPrompt_(song, angle, link, note));
    return tidyCaptions_(song, ai, link, 'ai');
  } catch (e) {
    console.log('Gemini failed: ' + e.message);
    base.warning = 'Gemini didn’t answer (' + e.message + '), so these captions came from the template.';
    return base;
  }
}

function captionPrompt_(song, angle, link, note) {
  return [
    'You write short-form video captions for the music artist Danyel OZ.',
    'Voice: simple words, honest feeling, light warmth or humor. Show what it felt like; never tell people what to think.',
    'Never invent facts about the song that are not in the story below. No hype words. No em dashes.',
    'Never use the words narrator, delve, tapestry or foster.',
    '',
    'Song: ' + song.song_title,
    'Release: ' + (song.release_type || 'Single') + ', ' + (song.release_date || ''),
    'Genre: ' + (song.song_genre || ''),
    'Story: ' + (String(song.song_description).trim() || '(no story yet: keep it about the feeling, claim nothing specific)'),
    'Video angle: ' + SHORT_ANGLES[angle],
    note ? 'Extra note from Danyel: ' + note : '',
    '',
    'Write:',
    '- yt_title: under 90 characters, ends with #Shorts.',
    '- yt_description: 2 short paragraphs from the story, then the line "Full song on Bandcamp: ' + link + '".',
    '- yt_tags: 5 to 8 hashtags, starting with #Shorts and #DanyelOZ.',
    '- tt_caption: one hook line under 100 characters that makes people stay. No link (TikTok links do not click).',
    '- tt_tags: 4 to 6 hashtags mixing niche and broad.',
    '- ig_caption: 2 or 3 short lines in the same voice, ending with "Full song: link in bio (danyeloz.info)".',
    '- ig_tags: 8 to 12 hashtags.'
  ].filter(function (x) { return x !== ''; }).join('\n');
}

function gemini_(prompt) {
  const key = props_().getProperty('GEMINI_API_KEY');
  const model = props_().getProperty('GEMINI_MODEL') || GEMINI_DEFAULT_MODEL;
  const str = { type: 'STRING' }, arr = { type: 'ARRAY', items: { type: 'STRING' } };
  const res = UrlFetchApp.fetch('https://generativelanguage.googleapis.com/v1beta/models/' +
      encodeURIComponent(model) + ':generateContent', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-goog-api-key': key },
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'OBJECT',
          properties: { yt_title: str, yt_description: str, yt_tags: arr, tt_caption: str, tt_tags: arr, ig_caption: str, ig_tags: arr },
          required: ['yt_title', 'yt_description', 'yt_tags', 'tt_caption', 'tt_tags', 'ig_caption', 'ig_tags']
        }
      }
    })
  });
  const code = res.getResponseCode();
  if (code !== 200) {
    let msg = '';
    try { msg = JSON.parse(res.getContentText()).error.message; } catch (e) { msg = res.getContentText().slice(0, 120); }
    throw new Error('error ' + code + (msg ? ': ' + msg : ''));
  }
  const body = JSON.parse(res.getContentText());
  const text = body.candidates && body.candidates[0] && body.candidates[0].content.parts[0].text;
  if (!text) throw new Error('empty answer');
  return JSON.parse(text);
}

function tidyCaptions_(song, c, link, source) {
  const clean = function (s, max) {
    s = String(s || '').replace(/\s*\u2014\s*/g, ', ').replace(/ \u2013 /g, ', ').replace(/[ \t]+\n/g, '\n').trim();
    return s.length > max ? s.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : s;
  };
  const titleTag = '#' + String(song.song_title).replace(/\(.*?\)/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  let title = clean(c.yt_title, 100).replace(/#Shorts/gi, '').trim();
  title = clean(title, 100 - 8) + ' #Shorts';
  let desc = clean(c.yt_description, 4800);
  if (desc.indexOf(link) < 0) desc += '\n\nFull song on Bandcamp: ' + link;
  return {
    yt_title: title,
    yt_description: desc,
    yt_tags: tags_(c.yt_tags, ['#Shorts', '#DanyelOZ'], 8),
    tt_caption: clean(c.tt_caption, 150),
    tt_tags: tags_(c.tt_tags, ['#DanyelOZ', titleTag], 6),
    ig_caption: clean(c.ig_caption, 1500),
    ig_tags: tags_(c.ig_tags, ['#DanyelOZ', titleTag], 12),
    source: source
  };
}

/* Captions that only use what's in the song's own row. */
function templateCaptions_(song, angle, link) {
  const title = String(song.song_title).trim();
  const paras = String(song.song_description || '').split(/\n\s*\n/).map(function (p) { return p.replace(/\s+/g, ' ').trim(); }).filter(Boolean);
  const lead = firstSentences_(paras[0] || '', 160);
  const more = firstSentences_(paras[1] || '', 220);
  const hooks = {
    story: 'The story behind ' + title,
    vocal: title + ', sung late at night',
    acoustic: title + ', stripped back',
    hook: 'The part of ' + title + ' that stays with you'
  };
  const tt = {
    story: lead ? firstSentences_(lead, 100) : 'This is what ' + title + ' felt like.',
    vocal: 'Late night, one mic, ' + title + '.',
    acoustic: title + ' with nothing but the song.',
    hook: 'Wait for the chorus. ' + title + '.'
  };
  const genres = String(song.song_genre || '').split(/[,/&]/).map(function (g) { return '#' + g.replace(/[^\p{L}\p{N}]/gu, ''); })
    .filter(function (g) { return g.length > 1; });
  const titleTag = '#' + title.replace(/\(.*?\)/g, '').replace(/[^\p{L}\p{N}]/gu, '');
  const c = {
    yt_title: hooks[angle] + ' #Shorts',
    yt_description: [lead, more].filter(Boolean).join('\n\n') + (lead ? '\n\n' : '') + 'Full song on Bandcamp: ' + link,
    yt_tags: ['#Shorts', '#DanyelOZ', titleTag].concat(genres, ['#NewMusic']),
    tt_caption: tt[angle],
    tt_tags: ['#DanyelOZ', titleTag].concat(genres, ['#NewMusic', '#SingerSongwriter']),
    ig_caption: (lead || hooks[angle] + '.') + '\n\nFull song: link in bio (danyeloz.info)',
    ig_tags: ['#DanyelOZ', titleTag].concat(genres, ['#NewMusic', '#SingerSongwriter', '#IndieMusic', '#Reels'])
  };
  const out = tidyCaptions_(song, c, link, 'template');
  return out;
}

function firstSentences_(text, limit) {
  const parts = String(text || '').split(/(?<=[.!?])\s+/);
  let out = '';
  for (let i = 0; i < parts.length; i++) {
    if ((out + ' ' + parts[i]).trim().length > limit) break;
    out = (out + ' ' + parts[i]).trim();
  }
  return out || String(text || '').slice(0, limit).replace(/\s+\S*$/, '');
}

/* Turns "a, #b c" or ['a','#b'] into ['#a', '#b', '#c'], must-haves first, no repeats. */
function tags_(v, must, max) {
  const list = (Array.isArray(v) ? v.join(' ') : String(v || '')).split(/[\s,]+/);
  const seen = {}, out = [];
  (must || []).concat(list).forEach(function (t) {
    t = String(t).replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '');
    if (!t) return;
    const k = t.toLowerCase();
    if (seen[k]) return;
    seen[k] = true; out.push('#' + t);
  });
  return out.slice(0, max || 30);
}

/* ---------- Analytics ---------- */

function getAnalytics() {
  const shorts = readShorts_(shortsSheet_());
  const out = {
    youtube: { connected: false, channel: '', error: '' },
    x: { connected: false, error: '' },
    shorts: [], xPosts: [], totals: {}, hashtags: []
  };

  // YouTube: only Shorts this app uploaded have a video ID to look up.
  if (typeof YouTube !== 'undefined') {
    try {
      const ch = YouTube.Channels.list('snippet', { mine: true });
      out.youtube.connected = !!(ch.items && ch.items.length);
      out.youtube.channel = out.youtube.connected ? ch.items[0].snippet.title : '';
    } catch (e) { out.youtube.error = e.message; }
  }
  const stats = {};
  const ids = shorts.map(function (s) { return s.yt_video_id; }).filter(String);
  if (out.youtube.connected && ids.length) {
    for (let i = 0; i < ids.length; i += 50) {
      try {
        const r = YouTube.Videos.list('statistics,status', { id: ids.slice(i, i + 50).join(',') });
        (r.items || []).forEach(function (v) {
          stats[v.id] = { views: +v.statistics.viewCount || 0, likes: +v.statistics.likeCount || 0,
                          comments: +v.statistics.commentCount || 0, privacy: v.status.privacyStatus };
        });
      } catch (e) { out.youtube.error = e.message; }
    }
  }
  out.shorts = shorts.map(function (s) {
    const st = stats[s.yt_video_id] || null;
    return { short_id: s.short_id, song_title: s.song_title, date: s.scheduled_date, status: s.status,
             yt: s.yt, tt: s.tt, ig: s.ig, yt_video_id: s.yt_video_id, tags: s.yt_tags, stats: st };
  });

  // X: read the agent's own log.
  try {
    const log = xRepoFile_('data/x-posts.json', null);
    out.x.connected = log !== null;
    out.xPosts = (log || []).filter(function (p) { return p.status === 'posted'; }).map(function (p) {
      const m = p.metrics || {};
      return { song: p.song, posted_at: p.posted_at, hook: p.hook, test: !!p.test, id: p.id,
               views: m.impression_count, likes: m.like_count, replies: m.reply_count, clicks: m.url_link_clicks };
    }).reverse();
  } catch (e) { out.x.error = e.message; }

  const sum = function (list, k) { return list.reduce(function (a, x) { return a + (+x[k] || 0); }, 0); };
  const ytStats = out.shorts.map(function (s) { return s.stats; }).filter(Boolean);
  const xReal = out.xPosts.filter(function (p) { return !p.test && p.views != null; });
  out.totals = {
    ytVideos: ytStats.length, ytViews: sum(ytStats, 'views'), ytLikes: sum(ytStats, 'likes'), ytComments: sum(ytStats, 'comments'),
    xPosts: xReal.length, xViews: sum(xReal, 'views'), xLikes: sum(xReal, 'likes'), xClicks: sum(xReal, 'clicks')
  };

  // Hashtags: average YouTube views per tag.
  const byTag = {};
  out.shorts.forEach(function (s) {
    if (!s.stats) return;
    tags_(s.tags, [], 30).forEach(function (t) {
      (byTag[t] = byTag[t] || []).push(s.stats.views);
    });
  });
  out.hashtags = Object.keys(byTag).map(function (t) {
    const v = byTag[t];
    return { tag: t, n: v.length, avg: Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length) };
  }).sort(function (a, b) { return (b.n >= 3) - (a.n >= 3) || b.avg - a.avg; }).slice(0, 12);
  return out;
}

function exportAnalyticsCsv() {
  const a = getAnalytics();
  const q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
  const rows = [['platform', 'song', 'date', 'status', 'views', 'likes', 'comments_or_replies', 'link_clicks', 'link']];
  a.shorts.forEach(function (s) {
    rows.push(['YouTube Shorts', s.song_title, s.date, s.status, s.stats ? s.stats.views : '', s.stats ? s.stats.likes : '',
               s.stats ? s.stats.comments : '', '', s.yt_video_id ? 'https://youtube.com/shorts/' + s.yt_video_id : '']);
  });
  a.xPosts.forEach(function (p) {
    rows.push(['X', p.song, p.posted_at, p.test ? 'test' : 'posted', p.views, p.likes, p.replies, p.clicks,
               p.test ? '' : 'https://x.com/i/web/status/' + p.id]);
  });
  const name = 'Danyel OZ report ' + manilaNow_('yyyy-MM-dd') + '.csv';
  const file = folder_(REPORTS_FOLDER_NAME).createFile(name, rows.map(function (r) { return r.map(q).join(','); }).join('\n'), MimeType.CSV);
  return { url: file.getUrl(), name: name };
}

function exportSummary() {
  const a = getAnalytics();
  const t = a.totals;
  const lines = ['Danyel OZ: Shorts and X summary, ' + manilaNow_('MMMM d, yyyy'), ''];
  lines.push('YouTube Shorts: ' + (a.youtube.connected ? t.ytVideos + ' uploaded by the app, ' + t.ytViews + ' views, ' + t.ytLikes + ' likes, ' + t.ytComments + ' comments.' : 'not connected yet.'));
  lines.push('X: ' + (t.xPosts ? t.xPosts + ' posts, ' + t.xViews + ' views, ' + t.xLikes + ' likes, ' + t.xClicks + ' link clicks.' : 'no real posts yet.'));
  lines.push('TikTok and Instagram: posted by hand for now, so their numbers live in each app.');
  const best = a.shorts.filter(function (s) { return s.stats; }).sort(function (x, y) { return y.stats.views - x.stats.views; })[0];
  if (best) lines.push('', 'Best Short so far: ' + best.song_title + ' (' + best.stats.views + ' views).');
  const ready = a.hashtags.filter(function (h) { return h.n >= 3; });
  if (ready.length) lines.push('Hashtags that work (3+ uses): ' + ready.slice(0, 5).map(function (h) { return h.tag + ' ' + h.avg; }).join(', '));
  const scheduled = a.shorts.filter(function (s) { return s.status === 'Scheduled'; }).length;
  lines.push('', 'Coming up: ' + scheduled + ' Shorts scheduled.');
  const name = 'Danyel OZ summary ' + manilaNow_('yyyy-MM-dd') + '.txt';
  const file = folder_(REPORTS_FOLDER_NAME).createFile(name, lines.join('\n'), MimeType.PLAIN_TEXT);
  return { url: file.getUrl(), name: name, text: lines.join('\n') };
}
