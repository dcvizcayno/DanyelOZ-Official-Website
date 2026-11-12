/**
 * Danyel OZ admin: Shorts Maker.
 *
 * Turns one long 9:16 lyric video (in the "Danyel OZ Shorts" Drive folder) into a series of
 * Shorts that tell the song in order: Part 1, Part 2, Part 3... each 59 seconds or less and cut
 * between sung lines. The video work runs on GitHub Actions (.github/workflows/shorts-maker.yml in
 * the private repo); this file starts it, reads its results and turns the finished parts into
 * normal rows of the private Shorts schedule, where captions, YouTube upload and the TikTok and
 * Instagram copy buttons already work.
 *
 * Script Properties:
 *   GITHUB_TOKEN  the same token the X Posts screen uses; it also needs Actions (Read and write)
 *                 on the repo below.
 *   SHORTS_REPO   optional, defaults to dcvizcayno/DanyelOZ-Official-Website (keep it private).
 *
 * Drive access for the editor: each run gets this app's own access token (ScriptApp.getOAuthToken),
 * which expires within an hour and is masked in the run's logs. Nothing is shared publicly.
 */

const MAKER_DEFAULT_REPO = 'dcvizcayno/DanyelOZ-Official-Website';
const MAKER_WORKFLOW = 'shorts-maker.yml';
const MAKER_JOBS_FOLDER = 'Shorts Maker jobs';
const SERIES_TAB = 'series';
const SERIES_COLUMNS = ['series_id', 'song_id', 'song_title', 'source_file_id', 'source_name', 'status', 'message',
  'job_file_id', 'max', 'endcard', 'plan_json', 'bounds', 'schedule', 'run_url', 'created_at', 'updated_at'];
// Timing rules: the same numbers as shorts-maker/maker.py, so nudges here match its plan.
const MAKER_LEAD = 2.5, MAKER_TAIL = 3.0, MAKER_CUT_BEFORE = 0.35, MAKER_ENDCARD = 2.0;
const MAKER_SITE = 'danyeloz.info';

function makerRepo_() { return props_().getProperty('SHORTS_REPO') || MAKER_DEFAULT_REPO; }

function makerGh_(method, path, body) {
  const token = props_().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('Add GITHUB_TOKEN in Project Settings > Script Properties to use the Shorts Maker.');
  const opt = {
    method: method, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  };
  if (body !== undefined) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(body); }
  const res = UrlFetchApp.fetch('https://api.github.com' + path, opt);
  const code = res.getResponseCode();
  if (code === 204) return null;
  if (code === 401) throw new Error('GitHub didn’t accept the token. It may have expired: make a new one and update GITHUB_TOKEN.');
  if (code === 403 || code === 404) {
    throw new Error('The GitHub token can’t start the Shorts Maker in ' + makerRepo_() + ' (' + code + '). ' +
                    'Give the token Actions: Read and write on that repo, and check that the workflow is on its main branch.');
  }
  if (code >= 300) throw new Error('GitHub said ' + code + ': ' + res.getContentText().slice(0, 160));
  return JSON.parse(res.getContentText() || 'null');
}

/* ---------- The series tab (in the private Shorts spreadsheet) ---------- */

function seriesSheet_() {
  const book = shortsSheet_().getParent();
  let sh = book.getSheetByName(SERIES_TAB);
  if (!sh) {
    sh = book.insertSheet(SERIES_TAB);
    sh.getRange(1, 1, 500, SERIES_COLUMNS.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, SERIES_COLUMNS.length).setValues([SERIES_COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function seriesIdx_(sh) {
  const width = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
  const idx = {};
  head.forEach(function (h, i) { if (h) idx[h] = i; });
  let next = head.filter(String).length ? width : 0;
  SERIES_COLUMNS.forEach(function (c) { if (idx[c] == null) { sh.getRange(1, next + 1).setValue(c); idx[c] = next; next++; } });
  return idx;
}

function readSeries_(sh) {
  const idx = seriesIdx_(sh);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues().map(function (r, i) {
    const o = { row: i + 2 };
    SERIES_COLUMNS.forEach(function (c) { o[c] = cell_(r[idx[c]]); });
    return o;
  }).filter(function (o) { return o.series_id; });
}

function writeSeries_(sh, s) {
  const idx = seriesIdx_(sh);
  const width = sh.getLastColumn();
  const row = new Array(width).fill('');
  if (s.row) sh.getRange(s.row, 1, 1, width).getValues()[0].forEach(function (v, i) { row[i] = v; });
  SERIES_COLUMNS.forEach(function (c) { row[idx[c]] = safeText_(s[c] == null ? '' : s[c]); });
  if (!s.row) s.row = Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(s.row, 1, 1, width).setNumberFormat('@').setValues([row]);
  return s;
}

function findSeries_(sh, id) {
  const s = readSeries_(sh).filter(function (x) { return x.series_id === String(id); })[0];
  if (!s) throw new Error('That series is no longer in the list. Reload and try again.');
  return s;
}

function jobsFolder_() {
  const parent = folder_(SHORTS_FOLDER_NAME);
  const it = parent.getFoldersByName(MAKER_JOBS_FOLDER);
  return it.hasNext() ? it.next() : parent.createFolder(MAKER_JOBS_FOLDER);
}

function readJob_(fileId) {
  try { return JSON.parse(DriveApp.getFileById(fileId).getBlob().getDataAsString() || '{}'); }
  catch (e) { return {}; }
}

/* ---------- Timing (mirrors maker.py) ---------- */

function cutPoint_(prev, next) {
  if (next.s <= prev.e) return next.s;
  return Math.max(prev.e + 0.05, next.s - MAKER_CUT_BEFORE);
}

/* bounds[k] = index of the first lyric line of part k. Returns [{start, end, len, first, last}]. */
function partTimes_(lines, bounds, duration) {
  const n = bounds.length;
  return bounds.map(function (a, k) {
    const b = k + 1 < n ? bounds[k + 1] - 1 : lines.length - 1;
    const start = k === 0 ? Math.max(0, lines[a].s - MAKER_LEAD) : cutPoint_(lines[a - 1], lines[a]);
    const end = k === n - 1 ? Math.min(duration, lines[b].e + MAKER_TAIL) : cutPoint_(lines[b], lines[b + 1]);
    const r = function (x) { return Math.round(x * 100) / 100; };
    return { start: r(start), end: r(end), len: r(end - start), first: a, last: b };
  });
}

function checkBounds_(bounds, lineCount) {
  if (!Array.isArray(bounds) || !bounds.length) throw new Error('A series needs at least one part.');
  if (bounds[0] !== 0) throw new Error('Part 1 has to start with the first line, so the story stays whole.');
  for (let i = 0; i < bounds.length; i++) {
    const b = bounds[i];
    if (!Number.isInteger(b) || b < 0 || b >= lineCount) throw new Error('A part points at a line that isn’t there.');
    if (i && b <= bounds[i - 1]) throw new Error('Every part needs at least one line, in order.');
  }
}

/* ---------- Load ---------- */

function getMakerData() {
  const sh = seriesSheet_();
  const shorts = readShorts_(shortsSheet_());
  const songs = getSongs().songs.map(function (s) {
    return { song_id: s.song_id, song_title: s.song_title, release_date: s.release_date, release_type: s.release_type,
             hasStory: !!String(s.song_description).trim(), hasBandcamp: /bandcamp\.com\/EmbeddedPlayer/i.test(s.bandcamp_embed),
             hasVideo: /^https:\/\//.test(String(s.yt_video_link || '')), cover: s.song_arts || '' };
  });
  const videos = listShortFiles().filter(function (f) { return !/ - Part \d+ of \d+\.mp4$/i.test(f.name); });
  const series = readSeries_(sh).reverse().slice(0, 30).map(function (s) { return seriesSummary_(s, shorts); });
  return { songs: songs, videos: videos, series: series, repo: makerRepo_(), hasToken: !!props_().getProperty('GITHUB_TOKEN'),
           youtube: typeof YouTube !== 'undefined', folderUrl: folder_(SHORTS_FOLDER_NAME).getUrl() };
}

function seriesSummary_(s, shorts) {
  const parts = shorts.filter(function (x) { return x.series_id === s.series_id; })
    .sort(function (a, b) { return parseInt(a.part, 10) - parseInt(b.part, 10); });
  return { series_id: s.series_id, song_title: s.song_title, source_name: s.source_name, status: s.status, message: s.message,
           created_at: s.created_at, run_url: s.run_url, parts: parts };
}

/* ---------- 1. Plan ---------- */

function planSeries(d) {
  d = d || {};
  const song = getSongs().songs.filter(function (s) {
    return (d.song_id && String(s.song_id) === String(d.song_id)) || norm_(s.song_title) === norm_(d.song_title);
  })[0];
  if (!song) throw new Error('Pick a song from your Song Database first.');
  if (!d.file_id) throw new Error('Pick the long 9:16 video first.');
  let file;
  try { file = DriveApp.getFileById(d.file_id); } catch (e) { throw new Error('Can’t open that video in Drive. Pick it again.'); }
  if (!/^video\//.test(file.getMimeType())) throw new Error('That file is not a video.');
  if (file.getSize() < 200 * 1024) {
    throw new Error('“' + file.getName() + '” is ' + (file.getSize() ? 'almost empty' : '0 MB') + ' in Drive, so it’s probably still uploading ' +
                    'or the upload broke. Wait until Drive shows its full size (or upload it again), then reload and try.');
  }
  const max = d.max === 90 ? 90 : 59;
  const endcard = d.endcard !== false;

  const id = 'SER' + Date.now().toString(36).toUpperCase();
  const job = jobsFolder_().createFile(id + '.json', JSON.stringify({ job_id: id, status: 'queued' }), 'application/json');
  const lock = lock_();
  let s;
  try {
    const now = manilaNow_();
    s = writeSeries_(seriesSheet_(), {
      series_id: id, song_id: song.song_id, song_title: song.song_title, source_file_id: file.getId(), source_name: file.getName(),
      status: 'Planning', message: 'Waiting for the editor to start', job_file_id: job.getId(), max: String(max),
      endcard: endcard ? 'TRUE' : 'FALSE', plan_json: '', bounds: '', schedule: '', run_url: '', created_at: now, updated_at: now
    });
  } finally { lock.releaseLock(); }
  dispatch_('plan', s, { max: max, endcard: endcard, model: 'small' }, '');
  return getSeries(id);
}

function dispatch_(mode, s, settings, outFolder) {
  makerGh_('POST', '/repos/' + makerRepo_() + '/actions/workflows/' + MAKER_WORKFLOW + '/dispatches', {
    ref: 'main',
    inputs: {
      job_id: s.series_id, mode: mode, file_id: s.source_file_id, job_file_id: s.job_file_id,
      out_folder_id: outFolder || '', settings: JSON.stringify(settings), token: ScriptApp.getOAuthToken()
    }
  });
}

/* ---------- Status: reads the job file and moves the series along ---------- */

function getSeries(id) {
  const sh = seriesSheet_();
  let s = findSeries_(sh, id);
  const job = readJob_(s.job_file_id);
  let changed = false;
  const set = function (k, v) { if (s[k] !== v) { s[k] = v; changed = true; } };

  if (job.status === 'failed') {
    set('status', 'Failed'); set('message', job.message || 'The editor stopped.');
  } else if (job.status === 'planning' || job.status === 'cutting') {
    set('message', job.message || '');
  } else if (job.status === 'planned' && s.status === 'Planning') {
    set('plan_json', JSON.stringify({ lines: job.lines, duration: job.duration, effective_max: job.effective_max,
                                      language: job.language || '', warning: job.warning || '' }));
    set('bounds', JSON.stringify(job.bounds)); set('status', 'Planned'); set('message', '');
  } else if (job.status === 'cut' && s.status === 'Cutting') {
    createParts_(s, job);
    set('status', 'Ready'); set('message', '');
  }
  // A run that died before it could write to Drive (bad token, setup problem): look it up on GitHub.
  if ((s.status === 'Planning' || s.status === 'Cutting') && (!job.status || job.status === 'queued')) {
    const run = findRun_(s.series_id);
    if (run) {
      set('run_url', run.html_url);
      if (run.status === 'completed' && run.conclusion !== 'success') {
        set('status', 'Failed'); set('message', 'The editor stopped before it started (' + run.conclusion + '). Open the run on GitHub to see why.');
      }
    }
  }
  if (changed) {
    const lock = lock_();
    try { s.updated_at = manilaNow_(); writeSeries_(sh, s); } finally { lock.releaseLock(); }
  }
  return seriesView_(s);
}

function findRun_(id) {
  try {
    const res = makerGh_('GET', '/repos/' + makerRepo_() + '/actions/workflows/' + MAKER_WORKFLOW + '/runs?per_page=20');
    return (res.workflow_runs || []).filter(function (r) { return String(r.display_title || '').indexOf(id) >= 0; })[0] || null;
  } catch (e) { return null; }
}

function seriesView_(s) {
  const plan = s.plan_json ? JSON.parse(s.plan_json) : null;
  const bounds = s.bounds ? JSON.parse(s.bounds) : [];
  const shorts = readShorts_(shortsSheet_());
  const out = seriesSummary_(s, shorts);
  out.max = Number(s.max) || 59;
  out.endcard = bool_(s.endcard);
  out.schedule = s.schedule ? JSON.parse(s.schedule) : null;
  if (plan) {
    out.lines = plan.lines; out.duration = plan.duration; out.effective_max = plan.effective_max;
    out.language = plan.language; out.warning = plan.warning; out.bounds = bounds;
    out.times = partTimes_(plan.lines, bounds, plan.duration);
  }
  return out;
}

/* ---------- 2. Adjust ---------- */

/* Saves a new split. Lines move whole, so a part never starts or stops mid-word. */
function saveSeriesBounds(id, bounds) {
  const lock = lock_();
  try {
    const sh = seriesSheet_();
    const s = findSeries_(sh, id);
    if (s.status !== 'Planned') throw new Error('Only a planned series can be changed. This one is ' + s.status + '.');
    const plan = JSON.parse(s.plan_json);
    bounds = (bounds || []).map(Number);
    checkBounds_(bounds, plan.lines.length);
    s.bounds = JSON.stringify(bounds);
    s.updated_at = manilaNow_();
    writeSeries_(sh, s);
    return seriesView_(s);
  } finally { lock.releaseLock(); }
}

/* Listens again (for example with 90-second parts) without starting a new series. */
function replanSeries(id, max) {
  const sh = seriesSheet_();
  const s = findSeries_(sh, id);
  if (s.status === 'Cutting' || s.status === 'Ready') throw new Error('This series is already ' + s.status.toLowerCase() + '.');
  s.max = String(max === 90 ? 90 : 59); s.status = 'Planning'; s.message = 'Waiting for the editor to start';
  s.plan_json = ''; s.bounds = ''; s.run_url = ''; s.updated_at = manilaNow_();
  DriveApp.getFileById(s.job_file_id).setContent(JSON.stringify({ job_id: s.series_id, status: 'queued' }));
  const lock = lock_();
  try { writeSeries_(sh, s); } finally { lock.releaseLock(); }
  dispatch_('plan', s, { max: Number(s.max), endcard: bool_(s.endcard), model: 'small' }, '');
  return seriesView_(s);
}

/* ---------- 3. Cut and schedule ---------- */

function cutSeries(id, opt) {
  opt = opt || {};
  const sh = seriesSheet_();
  const s = findSeries_(sh, id);
  if (s.status !== 'Planned') throw new Error('This series is ' + s.status + ', so it can’t be cut now.');
  const plan = JSON.parse(s.plan_json);
  const bounds = JSON.parse(s.bounds);
  const times = partTimes_(plan.lines, bounds, plan.duration);
  const over = times.filter(function (t) { return t.len > plan.effective_max + 0.01; });
  if (over.length) throw new Error('Part ' + (times.indexOf(over[0]) + 1) + ' is ' + Math.round(over[0].len) + ' seconds, over the ' +
                                   Math.floor(plan.effective_max) + ' second limit. Move a line to the next part first.');
  const cadence = [0, 1, 2].indexOf(Number(opt.cadence)) >= 0 ? Number(opt.cadence) : 1;
  if (opt.start_date) checkDate_(opt.start_date);
  checkTime_(opt.time || '19:00');
  const sched = { start_date: opt.start_date || '', cadence: cadence, time: opt.time || '19:00',
                  yt: opt.yt !== false, tt: opt.tt !== false, ig: !!opt.ig };
  s.schedule = JSON.stringify(sched);
  s.status = 'Cutting'; s.message = 'Waiting for the editor to start'; s.run_url = ''; s.updated_at = manilaNow_();
  DriveApp.getFileById(s.job_file_id).setContent(JSON.stringify({ job_id: s.series_id, status: 'queued' }));
  const lock = lock_();
  try { writeSeries_(sh, s); } finally { lock.releaseLock(); }
  dispatch_('cut', s, {
    parts: times.map(function (t) { return { start: t.start, end: t.end }; }),
    title: s.song_title, endcard: bool_(s.endcard), site: MAKER_SITE,
    next_when: cadence === 1 ? 'tomorrow' : cadence === 2 ? 'in 2 days' : 'is next'
  }, folder_(SHORTS_FOLDER_NAME).getId());
  return seriesView_(s);
}

/* Each finished part becomes a normal row of the Shorts schedule, with its own captions and date. */
function createParts_(s, job) {
  const shSh = shortsSheet_();
  if (readShorts_(shSh).some(function (x) { return x.series_id === s.series_id; })) return;   // already done
  const song = getSongs().songs.filter(function (x) {
    return (s.song_id && String(x.song_id) === String(s.song_id)) || norm_(x.song_title) === norm_(s.song_title);
  })[0];
  if (!song) throw new Error('The song for this series is no longer in your Song Database.');
  const sched = s.schedule ? JSON.parse(s.schedule) : { cadence: 1, time: '19:00', yt: true, tt: true, ig: false };
  const clips = (job.clips || []).slice().sort(function (a, b) { return a.part - b.part; });
  const n = clips.length;
  const base = captions_(song, 'story', 'This is a series of ' + n + ' Shorts that tell the song in order.');
  const start = sched.start_date || Utilities.formatDate(new Date(Date.now() + 86400000), 'Asia/Manila', 'yyyy-MM-dd');
  const lock = lock_();
  try {
    clips.forEach(function (c, i) {
      const k = i + 1;
      const date = sched.cadence === 0 ? start : Utilities.formatDate(new Date(new Date(start + 'T12:00:00+08:00').getTime() + i * sched.cadence * 86400000), 'Asia/Manila', 'yyyy-MM-dd');
      const cap = partCaptions_(base, song, k, n, sched.cadence);
      const now = manilaNow_();
      const row = {
        short_id: 'S' + Date.now().toString(36).toUpperCase() + k, song_id: song.song_id, song_title: song.song_title,
        drive_file_id: c.file_id, file_name: c.name, size_mb: String(c.size_mb),
        scheduled_date: date, scheduled_time: sched.time, yt: sched.yt, tt: sched.tt, ig: sched.ig,
        status: 'Scheduled', angle: 'story', yt_video_id: '', created_at: now, updated_at: now,
        series_id: s.series_id, part: k + '/' + n
      };
      applyCaptions_(row, cap);
      writeShort_(shSh, row);
    });
  } finally { lock.releaseLock(); }
}

function partCaptions_(base, song, k, n, cadence) {
  const tag = 'Part ' + k + ' of ' + n;
  const next = k < n ? ' Part ' + (k + 1) + (cadence === 1 ? ' tomorrow.' : cadence === 2 ? ' in 2 days.' : ' is next.') : ' Full song: ' + MAKER_SITE;
  const title = String(song.song_title).trim();
  const c = {
    yt_title: (title + ' · ' + tag + ' #Shorts').slice(0, 100),
    yt_description: (tag + '.' + next + '\n\n' + base.yt_description).slice(0, 5000),
    yt_tags: (base.yt_tags || []).slice(),
    tt_caption: (tag + '. ' + base.tt_caption + next).slice(0, 2200),
    tt_tags: (base.tt_tags || []).slice(),
    ig_caption: (title + ', ' + tag + '. ' + base.ig_caption).slice(0, 2200),
    ig_tags: (base.ig_tags || []).slice()
  };
  ['yt_tags', 'tt_tags', 'ig_tags'].forEach(function (k2) { if (typeof c[k2] === 'string') c[k2] = c[k2].split(/\s+/).filter(Boolean); });
  return c;
}

/* Stops tracking a series. Its videos and any Shorts already made stay where they are. */
function deleteSeries(id) {
  const lock = lock_();
  try {
    const sh = seriesSheet_();
    const s = findSeries_(sh, id);
    sh.deleteRow(s.row);
    return { removed: s.series_id };
  } finally { lock.releaseLock(); }
}

/* Run this once from the Apps Script editor to give the app YouTube permission
   (needed before "Upload to YouTube" works). The log names the channel it connected to. */
function authorizeYouTube() {
  const ch = YouTube.Channels.list('snippet', { mine: true });
  Logger.log('YouTube connected: ' + ((ch.items || [])[0] || { snippet: { title: 'no channel found' } }).snippet.title);
}
