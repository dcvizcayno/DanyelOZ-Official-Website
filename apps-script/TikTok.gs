/**
 * Danyel OZ admin: TikTok posting for Shorts (server side).
 * Add to the same Apps Script project as Code.gs and Shorts.gs, as a new script file named "TikTok".
 *
 * How it works
 *   1. Connect TikTok once (TikTok's own sign-in page). The app keeps the login in Script Properties
 *      and refreshes it on its own (TikTok asks for a new sign-in after 180 days without use).
 *   2. On a Short's TikTok tab you choose who can see it, comments, Duet, Stitch and the
 *      commercial content settings, then Approve. Nothing posts without that approval.
 *   3. Auto-post (a 15-minute timer) posts each approved Short at its date and time (Manila).
 *      "Post now" posts right away.
 * Settings and results live in a "tiktok" tab of the private "Danyel OZ Shorts (private)" sheet.
 *
 * Setup (Project Settings > Script Properties)
 *   TIKTOK_CLIENT_KEY      from your app on developers.tiktok.com
 *   TIKTOK_CLIENT_SECRET   same place. Never share it.
 * In the TikTok app settings, the Redirect URI is this web app's address (the TikTok tab shows it).
 *
 * Until TikTok approves the app (its audit), TikTok only accepts posts to a PRIVATE account,
 * visible only to you. The app explains this if TikTok refuses a post.
 */

const TT_API = 'https://open.tiktokapis.com';
const TT_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TT_SCOPES = 'user.info.basic,video.publish';
const TT_TAB = 'tiktok';
const TT_COLUMNS = ['short_id', 'privacy', 'allow_comment', 'allow_duet', 'allow_stitch', 'brand_organic', 'brand_content',
  'approved_at', 'status', 'publish_id', 'post_id', 'username', 'error', 'sent_at', 'updated_at'];
const TT_LIMIT_MB = 50;            // the most Apps Script can send in one go
const TT_CAPTION_MAX = 2200;
const TT_PER_RUN = 2;              // TikTok allows 6 post requests a minute; stay well under
const TT_TRIGGER_FN = 'ttAutoPost';
const TT_PRIVACY_LABELS = {
  PUBLIC_TO_EVERYONE: 'Everyone', MUTUAL_FOLLOW_FRIENDS: 'Friends', FOLLOWER_OF_CREATOR: 'Followers', SELF_ONLY: 'Only me'
};
const TT_ERRORS = {
  unaudited_client_can_only_post_to_private_accounts: 'TikTok hasn’t approved this app yet, so it only posts to a private account. Either set your TikTok account to private while testing, or wait for TikTok’s app review.',
  spam_risk_too_many_posts: 'TikTok says you’ve posted a lot today. It will take posts again tomorrow.',
  spam_risk_user_banned_from_posting: 'TikTok has paused posting on this account. Check the TikTok app.',
  reached_active_user_cap: 'TikTok’s daily limit for this app is used up. Try again tomorrow.',
  privacy_level_option_mismatch: 'That “Who can see it” choice isn’t available on your account any more. Pick another one and approve again.',
  access_token_invalid: 'TikTok signed the app out. Connect TikTok again.',
  scope_not_authorized: 'TikTok didn’t give the app permission to post. Connect TikTok again and allow posting.',
  url_ownership_unverified: 'TikTok refused the video link.',
  rate_limit_exceeded: 'TikTok asked the app to slow down. The next run tries again.'
};

/* ---------- settings and tokens ---------- */

function ttKey_() { return props_().getProperty('TIKTOK_CLIENT_KEY') || ''; }
function ttSecret_() { return props_().getProperty('TIKTOK_CLIENT_SECRET') || ''; }
function ttRedirect_() { return ScriptApp.getService().getUrl() || ''; }

function ttTokens_() {
  try { return JSON.parse(props_().getProperty('TIKTOK_TOKENS') || 'null'); } catch (e) { return null; }
}
function ttSaveTokens_(r) {
  const now = Date.now();
  props_().setProperty('TIKTOK_TOKENS', JSON.stringify({
    access: r.access_token, access_exp: now + Number(r.expires_in || 0) * 1000,
    refresh: r.refresh_token, refresh_exp: now + Number(r.refresh_expires_in || 0) * 1000,
    open_id: r.open_id || '', scope: r.scope || ''
  }));
}

function ttTokenCall_(form) {
  const body = Object.keys(form).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(form[k]); }).join('&');
  const res = UrlFetchApp.fetch(TT_API + '/v2/oauth/token/', {
    method: 'post', muteHttpExceptions: true, contentType: 'application/x-www-form-urlencoded', payload: body,
    headers: { 'Cache-Control': 'no-cache' }
  });
  let r = {};
  try { r = JSON.parse(res.getContentText() || '{}'); } catch (e) { r = {}; }
  if (res.getResponseCode() >= 300 || r.error || !r.access_token) {
    throw new Error('TikTok sign-in failed: ' + (r.error_description || r.error || ('HTTP ' + res.getResponseCode())) + '. Connect TikTok again.');
  }
  return r;
}

/* A working access token, refreshed when it has under 5 minutes left. TikTok hands back a new refresh token each time. */
function ttAccess_() {
  const t = ttTokens_();
  if (!t || !t.refresh) throw new Error('Connect TikTok first (TikTok tab of a Short).');
  if (t.access && t.access_exp - Date.now() > 5 * 60000) return t.access;
  if (t.refresh_exp && t.refresh_exp < Date.now()) throw new Error('The TikTok sign-in expired. Connect TikTok again.');
  const r = ttTokenCall_({ client_key: ttKey_(), client_secret: ttSecret_(), grant_type: 'refresh_token', refresh_token: t.refresh });
  ttSaveTokens_(r);
  return r.access_token;
}

/* Calls TikTok's API. TikTok answers { data, error: { code, message, log_id } }; code "ok" means it worked. */
function ttApi_(path, body, method, wantRaw) {
  const res = UrlFetchApp.fetch(TT_API + path, {
    method: method || 'post', muteHttpExceptions: true, contentType: 'application/json; charset=UTF-8',
    headers: { Authorization: 'Bearer ' + ttAccess_() },
    payload: body === undefined ? undefined : JSON.stringify(body)
  });
  const raw = res.getContentText() || '{}';
  let r = {};
  try { r = JSON.parse(raw); } catch (e) { r = {}; }
  const err = r.error || {};
  if (res.getResponseCode() >= 300 || (err.code && err.code !== 'ok')) {
    const code = err.code || ('http_' + res.getResponseCode());
    console.log('TikTok ' + path + ' failed: ' + code + ' ' + (err.message || '') + ' log ' + (err.log_id || ''));
    const e = new Error(TT_ERRORS[code] || ('TikTok said: ' + (err.message || code) + '.'));
    e.ttCode = code;
    throw e;
  }
  return wantRaw ? { data: r.data || {}, raw: raw } : (r.data || {});
}

/* ---------- connect ---------- */

/* The link to TikTok's sign-in page. TikTok sends you back to this web app (doGet) with a code. */
function tiktokAuthUrl() {
  if (!ttKey_() || !ttSecret_()) throw new Error('Add TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET in Project Settings > Script Properties first.');
  const redirect = ttRedirect_();
  if (!redirect) throw new Error('Deploy the app as a web app first (Deploy > Manage deployments), then try again.');
  const state = Utilities.getUuid();
  CacheService.getScriptCache().put('tt_state_' + state, '1', 900);
  return TT_AUTH_URL + '?client_key=' + encodeURIComponent(ttKey_()) + '&scope=' + encodeURIComponent(TT_SCOPES) +
    '&response_type=code&redirect_uri=' + encodeURIComponent(redirect) + '&state=' + encodeURIComponent(state);
}

/* doGet in Code.gs hands TikTok's return here. */
function tiktokCallback_(p) {
  // Every message is escaped: TikTok's words go in as text, never HTML.
  const page = function (title, msg) {
    return HtmlService.createHtmlOutput('<div style="font:16px/1.5 sans-serif;max-width:520px;margin:48px auto;padding:0 16px"><h2>' +
      ttEsc_(title) + '</h2><p>' + ttEsc_(msg) + '</p></div>').setTitle('TikTok · Danyel OZ');
  };
  const cache = CacheService.getScriptCache();
  if (!p.state || !cache.get('tt_state_' + p.state)) return page('That link expired', 'Go back to the app and click Connect TikTok again.');
  cache.remove('tt_state_' + p.state);
  if (p.error || !p.code) return page('TikTok wasn’t connected', 'TikTok said: ' + (p.error_description || p.error || 'no code') + '. You can try again from the app.');
  try {
    const r = ttTokenCall_({ client_key: ttKey_(), client_secret: ttSecret_(), code: p.code, grant_type: 'authorization_code', redirect_uri: ttRedirect_() });
    const scopes = String(r.scope || '').split(',');
    ttSaveTokens_(r);
    if (scopes.indexOf('video.publish') < 0) return page('Almost there', 'TikTok connected, but posting wasn’t allowed. Connect again and leave “post content” ticked.');
    return page('TikTok is connected', 'You can close this tab and reload the app.');
  } catch (e) {
    return page('TikTok wasn’t connected', e.message);
  }
}

function ttEsc_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
}

function disconnectTikTok() {
  props_().deleteProperty('TIKTOK_TOKENS');
  setTikTokAutoPost(false);
  return { connected: false };
}

/* ---------- the tiktok tab ---------- */

function ttSheet_() {
  const book = shortsSheet_().getParent();
  let sh = book.getSheetByName(TT_TAB);
  if (!sh) sh = book.insertSheet(TT_TAB);
  if (sh.getLastRow() === 0) {
    sh.getRange(1, 1, 1000, TT_COLUMNS.length).setNumberFormat('@');
    sh.getRange(1, 1, 1, TT_COLUMNS.length).setValues([TT_COLUMNS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function ttIdx_(sh) {
  const width = Math.max(sh.getLastColumn(), 1);
  const head = sh.getRange(1, 1, 1, width).getValues()[0].map(function (h) { return String(h).trim(); });
  const idx = {};
  head.forEach(function (h, i) { if (h) idx[h] = i; });
  let next = head.filter(String).length ? width : 0;
  TT_COLUMNS.forEach(function (c) { if (idx[c] == null) { sh.getRange(1, next + 1).setValue(c); idx[c] = next; next++; } });
  return idx;
}

function ttRows_(sh) {
  const idx = ttIdx_(sh);
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, sh.getLastColumn()).getValues().map(function (r, i) {
    const o = { row: i + 2 };
    TT_COLUMNS.forEach(function (c) { o[c] = cell_(r[idx[c]]); });
    ['allow_comment', 'allow_duet', 'allow_stitch', 'brand_organic', 'brand_content'].forEach(function (k) { o[k] = bool_(o[k]); });
    return o;
  }).filter(function (o) { return o.short_id; });
}

function ttRow_(sh, id) {
  return ttRows_(sh).filter(function (o) { return o.short_id === String(id); })[0] || null;
}

function ttWrite_(sh, o) {
  const idx = ttIdx_(sh);
  const width = sh.getLastColumn();
  const row = new Array(width).fill('');
  if (o.row) sh.getRange(o.row, 1, 1, width).getValues()[0].forEach(function (v, i) { row[i] = v; });
  o.updated_at = manilaNow_();
  TT_COLUMNS.forEach(function (c) {
    let v = o[c];
    if (typeof v === 'boolean') v = v ? 'TRUE' : 'FALSE';
    row[idx[c]] = safeText_(v == null ? '' : v);
  });
  if (!o.row) o.row = Math.max(sh.getLastRow(), 1) + 1;
  sh.getRange(o.row, 1, 1, width).setNumberFormat('@').setValues([row]);
  return o;
}

function ttPublic_(o) {
  if (!o) return null;
  const c = {};
  TT_COLUMNS.forEach(function (k) { c[k] = o[k]; });
  c.url = o.post_id && /^\d+$/.test(o.post_id) && /^[\w.]+$/.test(o.username || '') ? 'https://www.tiktok.com/@' + o.username + '/video/' + o.post_id : '';
  return c;
}

/* ---------- what the TikTok tab shows ---------- */

function ttCreator_() {
  const c = ttApi_('/v2/post/publish/creator_info/query/', {});
  return {
    nickname: c.creator_nickname || '', username: c.creator_username || '', avatar: c.creator_avatar_url || '',
    privacy: (c.privacy_level_options || []).map(function (k) { return { value: k, label: TT_PRIVACY_LABELS[k] || k }; }),
    commentOff: !!c.comment_disabled, duetOff: !!c.duet_disabled, stitchOff: !!c.stitch_disabled,
    maxSeconds: c.max_video_post_duration_sec || 0
  };
}

function getTikTokPanel(shortId) {
  const out = { configured: !!(ttKey_() && ttSecret_()), connected: !!(ttTokens_() || {}).refresh, redirect: '', creator: null,
                autoPost: ttTriggerOn_(), post: null, error: '', limitMb: TT_LIMIT_MB };
  try { out.redirect = ttRedirect_(); } catch (e) { out.redirect = ''; }
  if (shortId) out.post = ttPublic_(ttRow_(ttSheet_(), shortId));
  if (out.connected) {
    try { out.creator = ttCreator_(); } catch (e) { out.error = e.message; if (e.ttCode === 'access_token_invalid') out.connected = false; }
  }
  return out;
}

/* ---------- approve, cancel ---------- */

function ttCheckChoices_(d, creator) {
  if (!d.privacy) throw new Error('Choose who can see it on TikTok.');
  if (!creator.privacy.some(function (p) { return p.value === d.privacy; })) throw new Error('That “Who can see it” choice isn’t available on your account. Reload and pick again.');
  if (d.brand_content && d.privacy === 'SELF_ONLY') throw new Error('Branded content can’t be private. Choose who can see it, or turn off Branded content.');
  if (d.commercial && !d.brand_organic && !d.brand_content) throw new Error('You turned on commercial content: choose Your brand, Branded content, or both.');
}

/* Your OK for this Short: TikTok posts it at its scheduled time (or now with Post now). */
function approveTikTok(shortId, d) {
  d = d || {};
  const short = findShort_(shortsSheet_(), shortId);
  if (!short.tt) throw new Error('Tick TikTok for this Short first, then Save.');
  if (!String(short.tt_caption || '').trim()) throw new Error('Add a TikTok caption first, then Save.');
  const creator = ttCreator_();
  ttCheckChoices_(d, creator);
  const lock = lock_();
  try {
    const sh = ttSheet_();
    const o = ttRow_(sh, shortId) || { short_id: String(shortId) };
    if (o.status === 'Sending' || o.status === 'Processing' || o.status === 'Posted') throw new Error('This Short is already ' + o.status.toLowerCase() + ' on TikTok.');
    o.privacy = d.privacy;
    o.allow_comment = !!d.allow_comment && !creator.commentOff;
    o.allow_duet = !!d.allow_duet && !creator.duetOff;
    o.allow_stitch = !!d.allow_stitch && !creator.stitchOff;
    o.brand_organic = !!(d.commercial && d.brand_organic);
    o.brand_content = !!(d.commercial && d.brand_content);
    o.approved_at = manilaNow_();
    o.status = 'Approved'; o.error = ''; o.publish_id = ''; o.post_id = ''; o.sent_at = '';
    return ttPublic_(ttWrite_(sh, o));
  } finally { lock.releaseLock(); }
}

function cancelTikTok(shortId) {
  const lock = lock_();
  try {
    const sh = ttSheet_();
    const o = ttRow_(sh, shortId);
    if (!o || o.status !== 'Approved') throw new Error('Only a Short waiting to post can be cancelled.');
    o.status = 'Cancelled'; o.approved_at = '';
    return ttPublic_(ttWrite_(sh, o));
  } finally { lock.releaseLock(); }
}

/* ---------- posting ---------- */

function postTikTokNow(shortId) {
  const sh = ttSheet_();
  const o = ttRow_(sh, shortId);
  if (!o || (o.status !== 'Approved' && o.status !== 'Failed')) throw new Error('Approve this Short for TikTok first.');
  if (o.status === 'Failed') { o.status = 'Approved'; o.error = ''; ttWrite_(sh, o); }
  return ttPublic_(ttSend_(shortId));
}

/* Claims the row (so the timer and a click can't both post it), then sends the video. */
function ttSend_(shortId) {
  const sh = ttSheet_();
  let o;
  const lock = lock_();
  try {
    o = ttRow_(sh, shortId);
    if (!o || o.status !== 'Approved') throw new Error('This Short isn’t waiting to post any more. Reload.');
    o.status = 'Sending'; o.sent_at = manilaNow_(); o.error = '';
    ttWrite_(sh, o);
  } finally { lock.releaseLock(); }
  try {
    const short = findShort_(shortsSheet_(), shortId);
    const creator = ttCreator_();   // TikTok asks apps to check this right before each post
    ttCheckChoices_({ privacy: o.privacy, brand_organic: o.brand_organic, brand_content: o.brand_content,
                      commercial: o.brand_organic || o.brand_content }, creator);
    o.username = creator.username;
    const file = DriveApp.getFileById(short.drive_file_id);
    const size = file.getSize();
    if (!size) throw new Error('This video is 0 MB in Drive. It may still be uploading; try again in a few minutes.');
    if (size > TT_LIMIT_MB * 1048576) throw new Error('This video is ' + Math.round(size / 1048576) + ' MB. The app can send up to ' + TT_LIMIT_MB + ' MB to TikTok; post this one in the TikTok app.');
    const caption = (String(short.tt_caption || '').trim() + (short.tt_tags ? '\n\n' + short.tt_tags : '')).slice(0, TT_CAPTION_MAX);
    const init = ttApi_('/v2/post/publish/video/init/', {
      post_info: {
        title: caption, privacy_level: o.privacy,
        disable_comment: !o.allow_comment, disable_duet: !o.allow_duet, disable_stitch: !o.allow_stitch,
        brand_organic_toggle: !!o.brand_organic, brand_content_toggle: !!o.brand_content
      },
      source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: size, total_chunk_count: 1 }
    });
    const put = UrlFetchApp.fetch(init.upload_url, {
      method: 'put', muteHttpExceptions: true, contentType: file.getMimeType() || 'video/mp4',
      headers: { 'Content-Range': 'bytes 0-' + (size - 1) + '/' + size },
      payload: file.getBlob().getBytes()
    });
    if (put.getResponseCode() >= 300) throw new Error('TikTok didn’t take the video file (HTTP ' + put.getResponseCode() + '). Try again.');
    o.publish_id = init.publish_id; o.status = 'Processing';
  } catch (e) {
    o.status = 'Failed'; o.error = e.message;
  }
  const lock2 = lock_();
  try { return ttWrite_(sh, o); } finally { lock2.releaseLock(); }
}

/* Asks TikTok how a sent post is doing. */
function ttStatus_(o) {
  const res = ttApi_('/v2/post/publish/status/fetch/', { publish_id: o.publish_id }, 'post', true);
  const s = res.data;
  if (s.status === 'PUBLISH_COMPLETE') {
    o.status = 'Posted';
    // Post IDs are 19-digit numbers, too big for JavaScript numbers, so read them from the raw text.
    // (TikTok spells the field "publicaly"; the second spelling is in case they fix it.)
    const m = res.raw.match(/"publi\w*_available_post_id"\s*:\s*\[\s*"?(\d+)/);
    o.post_id = m ? m[1] : '';
  } else if (s.status === 'FAILED') {
    o.status = 'Failed'; o.error = 'TikTok couldn’t post it: ' + (s.fail_reason || 'no reason given') + '.';
  }
  return o;
}

function checkTikTok(shortId) {
  const sh = ttSheet_();
  const o = ttRow_(sh, shortId);
  if (!o || !o.publish_id) throw new Error('Nothing sent to TikTok for this Short yet.');
  if (o.status !== 'Processing') return ttPublic_(o);
  ttStatus_(o);
  const lock = lock_();
  try { return ttPublic_(ttWrite_(sh, o)); } finally { lock.releaseLock(); }
}

/* ---------- auto-post timer ---------- */

function ttDue_(short, nowMs) {
  if (!short.scheduled_date) return false;
  const when = new Date(short.scheduled_date + 'T' + (short.scheduled_time || '19:00') + ':00+08:00').getTime();
  return !isNaN(when) && when <= nowMs;
}

/* Runs every 15 minutes once Auto-post is on: posts approved Shorts whose time has come, then checks sent ones. */
function ttAutoPost() {
  if (!(ttTokens_() || {}).refresh) return { posted: 0, note: 'not connected' };
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return { posted: 0, note: 'busy' };
  let rows, shorts;
  try { rows = ttRows_(ttSheet_()); shorts = readShorts_(shortsSheet_()); } finally { lock.releaseLock(); }
  const byId = {};
  shorts.forEach(function (s) { byId[s.short_id] = s; });
  const now = Date.now();
  let sent = 0;
  const log = [];
  rows.forEach(function (o) {
    if (o.status === 'Processing') {
      try { const sh = ttSheet_(); ttStatus_(o); const l = lock_(); try { ttWrite_(sh, o); } finally { l.releaseLock(); } }
      catch (e) { log.push(o.short_id + ' status: ' + e.message); }
    }
  });
  rows.forEach(function (o) {
    const s = byId[o.short_id];
    if (o.status !== 'Approved' || !s || !s.tt || !ttDue_(s, now) || sent >= TT_PER_RUN) return;
    const r = ttSend_(o.short_id);
    sent++;
    log.push(s.song_title + ': ' + r.status + (r.error ? ' (' + r.error + ')' : ''));
  });
  if (log.length) console.log('TikTok auto-post: ' + log.join(' | '));
  return { posted: sent, log: log };
}

function ttTriggerOn_() {
  try {
    return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === TT_TRIGGER_FN; });
  } catch (e) { return false; }
}

function setTikTokAutoPost(on) {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === TT_TRIGGER_FN) ScriptApp.deleteTrigger(t); });
  if (on) ScriptApp.newTrigger(TT_TRIGGER_FN).timeBased().everyMinutes(15).create();
  return { autoPost: !!on };
}
