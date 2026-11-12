/**
 * Danyel OZ admin: Albums Page and EPs Page screens (server side). One engine for both pages.
 * Add to the same Apps Script project as Code.gs, as a new script file named "Albums".
 *
 * page 'album' (default): releases marked Album in the Song Database.
 * page 'ep': releases marked EP, plus any album you sorted as "became an EP".
 * A row's kind decides where it shows: main (Albums page), ep (EPs page), installment (inside its album's sleeve,
 * and on the Albums page if switched on there), single (nowhere).
 *
 * Tabs it keeps in the Song Database (public, so only public info):
 *   albums             one row per release you have sorted: what it really is (kind), part_of,
 *                      show, collection, position, accent, hook, tracks, bonus, store_url, featured.
 *   album_collections  slot, name, tagline, alias (another stage name), visible, page (album or ep; blank = album).
 * Your songs' release_type is never changed. The website widget reads both tabs by name.
 */

const ALBUMS_TAB = 'albums';
const ALBUM_COLUMNS = ['song_id', 'song_title', 'kind', 'part_of', 'show', 'collection', 'position',
  'accent', 'hook', 'tracks', 'bonus', 'store_url', 'featured'];
const COLLECTIONS_TAB = 'album_collections';
const COLLECTION_COLUMNS = ['slot', 'name', 'tagline', 'alias', 'visible', 'page'];
const ALBUM_KINDS = ['unsorted', 'main', 'installment', 'ep', 'single'];
const EP_KINDS = ['unsorted', 'ep', 'installment', 'single'];
const MAX_COLLECTIONS = 8;

/* First-time setup: your current Albums page, so you start from what fans see today. */
const DEFAULT_COLLECTIONS = [
  ['Love, Romance & Relationships', ''], ['Heartbreak, Reflection & Closure', ''],
  ['Growth, Healing & New Beginnings', ''], ['Experimental & Distinctive Concepts', ''],
  ['Marcus Heero Collections', 'Marcus Heero']
];
const DEFAULT_ALBUMS = [   // title, collection, accent (taken from each cover), tracks, bonus
  ['LOVEROO', 0, '#3ED2DE', 14, ''], ['secret lover', 0, '#FF1EA7', 11, ''], ['CHAOTIC LOVE', 0, '#F45729', 13, ''],
  ['DRAMA (Chaotic Love 2)', 0, '#D24B58', 15, ''], ['GAME OVER or is it?', 1, '#E13B3E', 17, ''],
  ["She's A Puzzle", 1, '#EBB531', 17, 5], ['PRESS START', 2, '#D2B04B', 15, ''], ['NOTE TO SELF', 2, '#D58148', 12, ''],
  ['Midnight Struggles', 2, '#4B9FD2', 17, ''], ['BAKED FRESH', 3, '#EA6832', 15, '']
];

function isAlbumType_(t) { return /^\s*album\s*$/i.test(String(t || '')); }
function isEpType_(t) { return /^\s*ep\s*$/i.test(String(t || '')); }
function albumPage_(p) { return p === 'ep' ? 'ep' : 'album'; }
function colPage_(c) { return String(c.page || '').trim().toLowerCase() === 'ep' ? 'ep' : 'album'; }
/* Does a saved row belong to this page's set (for featured and collections)? */
function rowOnPage_(r, page) { return page === 'ep' ? r.kind === 'ep' : r.kind !== 'ep'; }
function albumKey_(o) { return String(o.song_id || '').trim() ? 'id:' + String(o.song_id).trim() : 't:' + norm_(o.song_title); }
function bool_v_(v) { return v === true || /^(true|yes|1|x)$/i.test(String(v).trim()); }

function albumTabs_() {
  const a = namedTab_(ALBUMS_TAB, ALBUM_COLUMNS);
  const c = namedTab_(COLLECTIONS_TAB, COLLECTION_COLUMNS);
  if (c.sh.getLastRow() < 2 && a.sh.getLastRow() < 2) seedAlbums_(a, c);
  return { a: a, c: c };
}

function seedAlbums_(a, c) {
  writeNamed_(c, COLLECTION_COLUMNS, DEFAULT_COLLECTIONS.map(function (x, i) {
    return { slot: i + 1, name: x[0], tagline: '', alias: x[1], visible: 'TRUE' };
  }));
  const songs = getSongs().songs;
  const rows = [];
  const pos = {};
  DEFAULT_ALBUMS.forEach(function (d) {
    const s = songs.filter(function (x) { return isAlbumType_(x.release_type) && norm_(x.song_title) === norm_(d[0]); })[0];
    if (!s) return;
    const col = DEFAULT_COLLECTIONS[d[1]][0];
    pos[col] = (pos[col] || 0) + 1;
    rows.push({ song_id: s.song_id, song_title: s.song_title, kind: 'main', part_of: '', show: 'TRUE', collection: col,
                position: pos[col], accent: d[2], hook: '', tracks: d[3], bonus: d[4], store_url: '', featured: '' });
  });
  writeNamed_(a, ALBUM_COLUMNS, rows);
}

function readAlbums_(t) {
  return readNamed_(t, ALBUM_COLUMNS).filter(function (r) { return r.song_id || r.song_title; });
}

function checkHex_(v, what) {
  v = String(v || '').trim();
  if (v && !/^#[0-9a-f]{6}$/i.test(v)) throw new Error(what + ' must be a color like #E3122A.');
  return v.toUpperCase();
}
function checkUrl_(v, what) {
  v = String(v || '').trim();
  if (v && !/^https:\/\/[^\s<>"']+$/i.test(v)) throw new Error(what + ' must start with https://');
  return v;
}

/* ---------- Load ---------- */

function getAlbumsAdmin(page) {
  page = albumPage_(page);
  const kinds = page === 'ep' ? EP_KINDS : ALBUM_KINDS;
  const t = albumTabs_();
  const songs = getSongs().songs;
  const saved = {};
  const rows = readAlbums_(t.a);
  rows.forEach(function (r) { saved[albumKey_(r)] = r; saved['t:' + norm_(r.song_title)] = saved['t:' + norm_(r.song_title)] || r; });
  const savedFor = function (s) { return saved[albumKey_(s)] || saved['t:' + norm_(s.song_title)] || {}; };
  const library = songs.filter(function (s) {
    if (page === 'album') return isAlbumType_(s.release_type);
    return isEpType_(s.release_type) || (isAlbumType_(s.release_type) && savedFor(s).kind === 'ep');
  }).map(function (s) {
    const r = savedFor(s);
    return {
      song_id: s.song_id, song_title: s.song_title, release_date: s.release_date, type: isEpType_(s.release_type) ? 'EP' : 'Album',
      bandcamp: /bandcamp\.com\/EmbeddedPlayer/i.test(s.bandcamp_embed), story: !!String(s.song_description).trim(),
      cover: s.song_arts || '',
      kind: kinds.indexOf(r.kind) >= 0 ? r.kind : (r.kind === 'main' && page === 'ep' ? 'ep' : 'unsorted'), part_of: r.part_of || '', show: bool_v_(r.show),
      collection: r.collection || '', position: Number(r.position) || 0, accent: r.accent || '', hook: r.hook || '',
      tracks: r.tracks || '', bonus: r.bonus || '', store_url: r.store_url || '', featured: bool_v_(r.featured)
    };
  }).sort(function (a, b) { return String(b.release_date).localeCompare(String(a.release_date)); });
  const collections = readNamed_(t.c, COLLECTION_COLUMNS).filter(function (c) { return c.name && colPage_(c) === page; })
    .sort(function (a, b) { return (Number(a.slot) || 99) - (Number(b.slot) || 99); })
    .map(function (c) { return { name: c.name, tagline: c.tagline, alias: c.alias, visible: !/^(false|no|0|hide|hidden)$/i.test(c.visible) }; });
  // Main albums an installment can belong to (the EPs page needs them too).
  const mainAlbums = rows.filter(function (r) { return r.kind === 'main'; }).map(function (r) { return r.song_title; })
    .filter(function (v, i, a) { return v && a.indexOf(v) === i; }).sort();
  return { page: page, library: library, collections: collections, kinds: kinds, mainAlbums: mainAlbums, maxCollections: MAX_COLLECTIONS };
}

/* ---------- Save ---------- */

/* Upserts album rows by song_id (or title), changing only the fields given. */
function upsertAlbums_(changes) {
  const t = albumTabs_();
  const rows = readAlbums_(t.a);
  const songs = getSongs().songs;
  changes.forEach(function (c) {
    const s = songs.filter(function (x) { return (c.song_id && String(x.song_id) === String(c.song_id)) || norm_(x.song_title) === norm_(c.song_title); })[0];
    if (!s) throw new Error('"' + (c.song_title || c.song_id) + '" is no longer in your Song Database.');
    let r = rows.filter(function (x) { return albumKey_(x) === albumKey_(s) || norm_(x.song_title) === norm_(s.song_title); })[0];
    if (!r) { r = { song_id: s.song_id, song_title: s.song_title, kind: 'unsorted', show: 'FALSE' }; rows.push(r); }
    r.song_id = s.song_id; r.song_title = s.song_title;
    Object.keys(c).forEach(function (k) { if (k !== 'song_id' && k !== 'song_title' && ALBUM_COLUMNS.indexOf(k) >= 0) r[k] = c[k]; });
  });
  writeNamed_(t.a, ALBUM_COLUMNS, rows);
  return rows.length;
}

/* list: [{song_id, song_title, kind, part_of, show}] from the Album library. */
function saveAlbumLibrary(list, page) {
  page = albumPage_(page);
  const kinds = page === 'ep' ? EP_KINDS : ALBUM_KINDS;
  const where = page === 'ep' ? 'the EPs page' : 'the Albums page';
  list = list || [];
  const lock = lock_();
  try {
    const changes = list.map(function (x) {
      const kind = kinds.indexOf(x.kind) >= 0 ? x.kind : 'unsorted';
      if (x.show && kind === 'single') throw new Error('"' + x.song_title + '" is marked as really a single, so it can’t show on ' + where + '.');
      if (x.show && page === 'ep' && kind === 'installment') throw new Error('"' + x.song_title + '" is marked as part of an album, so it shows inside that album on the Albums page, not on the EPs page.');
      const c = { song_id: x.song_id, song_title: x.song_title, kind: kind, part_of: kind === 'installment' ? String(x.part_of || '').trim() : '' };
      // On the Albums page an album sorted as "became an EP" is switched on or off from the EPs page instead.
      if (!(page === 'album' && kind === 'ep')) c.show = x.show ? 'TRUE' : 'FALSE';
      return c;
    });
    upsertAlbums_(changes);
    return { saved: changes.length };
  } finally { lock.releaseLock(); }
}

/* One album's look and details. */
function saveAlbumDetails(d) {
  d = d || {};
  const tracks = String(d.tracks || '').trim(), bonus = String(d.bonus || '').trim();
  if (tracks && !/^\d{1,3}$/.test(tracks)) throw new Error('Tracks must be a number.');
  if (bonus && !/^\d{1,3}$/.test(bonus)) throw new Error('Bonus tracks must be a number.');
  const hook = String(d.hook || '').replace(/\s+/g, ' ').trim();
  if (hook.length > 120) throw new Error('The hook is longer than 120 characters.');
  const lock = lock_();
  try {
    upsertAlbums_([{ song_id: d.song_id, song_title: d.song_title, collection: String(d.collection || '').trim(),
      accent: checkHex_(d.accent, 'Album color'), hook: hook, tracks: tracks, bonus: bonus,
      store_url: checkUrl_(d.store_url, 'Store link') }]);
    return { saved: true };
  } finally { lock.releaseLock(); }
}

/* order: {collectionName: [{song_id, song_title}, ...]} in display order. */
function saveAlbumOrder(order) {
  const lock = lock_();
  try {
    const changes = [];
    Object.keys(order || {}).forEach(function (col) {
      (order[col] || []).forEach(function (x, i) { changes.push({ song_id: x.song_id, song_title: x.song_title, collection: col, position: i + 1 }); });
    });
    if (changes.length) upsertAlbums_(changes);
    return { saved: changes.length };
  } finally { lock.releaseLock(); }
}

/* key: {song_id, song_title} of the album to feature, or null for "newest automatically". */
function setFeaturedAlbum(key, page) {
  page = albumPage_(page);
  const lock = lock_();
  try {
    const t = albumTabs_();
    const rows = readAlbums_(t.a);
    rows.forEach(function (r) { if (rowOnPage_(r, page)) r.featured = ''; });   // only this page's pick changes
    writeNamed_(t.a, ALBUM_COLUMNS, rows);
    if (key) upsertAlbums_([{ song_id: key.song_id, song_title: key.song_title, featured: 'TRUE' }]);
    return { featured: key ? key.song_title : 'auto' };
  } finally { lock.releaseLock(); }
}

/* list: [{name, tagline, alias, visible, was}] in order; renames carry over to their albums. */
function saveAlbumCollections(list, page) {
  page = albumPage_(page);
  list = (list || []).filter(function (c) { return c && (String(c.name || '').trim() || c.was); });
  const keep = list.filter(function (c) { return String(c.name || '').trim(); });
  if (keep.length > MAX_COLLECTIONS) throw new Error('Up to ' + MAX_COLLECTIONS + ' collections.');
  const seen = {};
  const rows = keep.map(function (c, i) {
    const name = String(c.name).replace(/\s+/g, ' ').trim();
    if (name.length > 48) throw new Error('"' + name + '" is longer than 48 characters.');
    if (seen[name.toLowerCase()]) throw new Error('Two collections are called "' + name + '".');
    seen[name.toLowerCase()] = true;
    return { slot: i + 1, name: name, tagline: String(c.tagline || '').replace(/\s+/g, ' ').trim().slice(0, 80),
             alias: String(c.alias || '').replace(/\s+/g, ' ').trim().slice(0, 40), visible: c.visible === false ? 'FALSE' : 'TRUE',
             page: page === 'ep' ? 'ep' : '' };
  });
  const map = {};
  list.forEach(function (c) {
    if (!c.was) return;
    const now = String(c.name || '').replace(/\s+/g, ' ').trim();
    if (String(c.was).trim() !== now) map[String(c.was).trim().toLowerCase()] = now;
  });
  const lock = lock_();
  try {
    const t = albumTabs_();
    const others = readNamed_(t.c, COLLECTION_COLUMNS).filter(function (c) { return c.name && colPage_(c) !== page; });
    writeNamed_(t.c, COLLECTION_COLUMNS, others.concat(rows));   // the other page's collections stay as they are
    let moved = 0;
    if (Object.keys(map).length) {
      const albums = readAlbums_(t.a);
      albums.forEach(function (r) {
        if (!rowOnPage_(r, page)) return;
        const k = String(r.collection || '').trim().toLowerCase();
        if (k in map) { r.collection = map[k]; moved++; }
      });
      writeNamed_(t.a, ALBUM_COLUMNS, albums);
    }
    return { saved: rows.length, albumsMoved: moved };
  } finally { lock.releaseLock(); }
}
