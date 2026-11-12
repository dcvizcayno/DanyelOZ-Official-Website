/* Danyel OZ: one-time Spotify link backfill (Nov 12, 2026).
   Finds each release on Spotify by its UPC (or ISRC when there is no UPC) and puts the Spotify link
   in spotify_link. It only fills empty cells; a link you already have is never touched.
   It only accepts a match whose artist is Danyel OZ or M4RCU$ H33R0, so a stranger's song can't slip in.

   Needs two Script Properties (Project Settings > Script Properties):
     SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET, from the Spotify developer app.

   How to run (Apps Script editor, function menu, then Run):
     1. previewSpotify   shows what it would fill, writes nothing. Read the log.
     2. backfillSpotify  fills the cells. If the log says "Run it again", click Run again.
   When the log says "All done", you can delete this file. Keep the two Script Properties if you
   want to run it again after future releases. */

const SPOTIFY_ARTISTS = /danyel\s*oz|m4rcu\$?\s*h33r0/i;   // whose releases count as a match

function previewSpotify() { spotifyRun_(false); }
function backfillSpotify() { spotifyRun_(true); }

function spotifyRun_(write) {
  const start = Date.now();
  const token = spotifyToken_();
  const sh = SpreadsheetApp.getActive().getSheetByName('Sheet1');
  const data = sh.getDataRange().getValues();
  const head = data[0].map(function (h) { return String(h).trim(); });
  const col = function (name) { return head.indexOf(name); };
  const cTitle = col('song_title'), cUpc = col('song_upc'), cIsrc = col('song_ISRC'), cLink = col('spotify_link');
  if (cTitle < 0 || cUpc < 0 || cLink < 0) throw new Error('Could not find song_title, song_upc or spotify_link in Sheet1.');

  let found = 0, left = 0;
  const missing = [], noCode = [], wrongArtist = [], titleDiff = [];
  for (let r = 1; r < data.length; r++) {
    const title = String(data[r][cTitle] || '').trim();
    if (!title || String(data[r][cLink] || '').trim()) continue;          // already has a link
    if (Date.now() - start > 5 * 60 * 1000) { left++; continue; }
    const upc = String(data[r][cUpc] || '').replace(/^'/, '').trim();
    const isrc = cIsrc >= 0 ? String(data[r][cIsrc] || '').trim().toUpperCase() : '';
    if (!upc && !isrc) { noCode.push(title); continue; }

    let hit = null;
    if (upc) {
      // Spotify sometimes stores a 12-digit UPC as 13 digits with a leading zero, so try both.
      [upc, upc.length === 12 ? '0' + upc : upc.replace(/^0/, '')].some(function (code) {
        const items = spotifySearch_(token, 'upc:' + code, 'album');
        hit = items.filter(function (a) { return SPOTIFY_ARTISTS.test((a.artists || []).map(function (x) { return x.name; }).join(', ')); })[0] || items[0] || null;
        return !!hit;
      });
    }
    if (!hit && /^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc)) hit = spotifySearch_(token, 'isrc:' + isrc, 'track')[0] || null;
    if (!hit) { missing.push(title + (upc ? ' (UPC ' + upc + ')' : ' (ISRC ' + isrc + ')')); continue; }

    const artists = (hit.artists || []).map(function (a) { return a.name; }).join(', ');
    if (!SPOTIFY_ARTISTS.test(artists)) { wrongArtist.push(title + ': Spotify says "' + hit.name + '" by ' + artists); continue; }
    const url = hit.external_urls && hit.external_urls.spotify;
    if (!/^https:\/\/open\.spotify\.com\//.test(url || '')) { missing.push(title + ' (no link returned)'); continue; }
    if (spNorm_(hit.name) !== spNorm_(title)) titleDiff.push(title + '  ->  Spotify name: "' + hit.name + '"');
    if (write) sh.getRange(r + 1, cLink + 1).setValue(url);
    found++;
    if (!write && found <= 15) Logger.log('Would fill: ' + title + '  ->  ' + url);
    Utilities.sleep(120);   // stay well under Spotify's rate limit
  }
  if (write) SpreadsheetApp.flush();

  Logger.log((write ? 'Filled ' : 'Would fill ') + found + ' Spotify links.' +
    (left ? ' ' + left + ' still to go. Run it again.' : ' All done.'));
  if (titleDiff.length) Logger.log('Filled, but the name differs on Spotify (worth a glance):\n' + titleDiff.join('\n'));
  if (missing.length) Logger.log('Not found on Spotify (' + missing.length + '):\n' + missing.join('\n'));
  if (wrongArtist.length) Logger.log('Skipped, a different artist came back (' + wrongArtist.length + '):\n' + wrongArtist.join('\n'));
  if (noCode.length) Logger.log('Skipped, no UPC or ISRC in the sheet (' + noCode.length + '):\n' + noCode.join('\n'));
}

function spotifyToken_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty('SPOTIFY_CLIENT_ID'), secret = p.getProperty('SPOTIFY_CLIENT_SECRET');
  if (!id || !secret) throw new Error('Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in Project Settings > Script Properties first.');
  const res = UrlFetchApp.fetch('https://accounts.spotify.com/api/token', {
    method: 'post', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(id.trim() + ':' + secret.trim()) },
    payload: { grant_type: 'client_credentials' }
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Spotify did not accept the app keys (HTTP ' + res.getResponseCode() + '). ' +
      'Check the two Script Properties for extra spaces, and that the app owner still has Premium.');
  }
  return JSON.parse(res.getContentText()).access_token;
}

function spotifySearch_(token, query, type) {
  const url = 'https://api.spotify.com/v1/search?type=' + type + '&limit=5&q=' + encodeURIComponent(query);
  for (let tries = 0; tries < 3; tries++) {
    const res = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true });
    const code = res.getResponseCode();
    if (code === 200) {
      const body = JSON.parse(res.getContentText());
      return ((body[type + 's'] || {}).items || []).filter(Boolean);
    }
    if (code === 429) { Utilities.sleep(1000 * Math.min(30, Number(res.getHeaders()['Retry-After']) || 3)); continue; }
    if (code === 401 || code === 403) throw new Error('Spotify refused the search (HTTP ' + code + '). The app owner may need Premium, or the keys are wrong.');
    Utilities.sleep(800);
  }
  return [];
}

function spNorm_(s) { return String(s || '').toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim(); }
