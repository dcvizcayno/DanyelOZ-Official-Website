/* Danyel OZ admin: the Inbox screen (server), the automatic reply and the 9 am Manila to-do event.
   Reads only the private inbox spreadsheet made by FormsSetup.gs (Script Property FS_INBOX_SHEET_ID), never the Song
   Database. Every function the screen calls first checks that the user is Daniel (ibOwner_). Two time triggers:
   ibAutoReplyTick (every 10 minutes) sends at most IB_PER_RUN replies a run, and ibDailyDigest (9 am Asia/Manila)
   adds one private 15-minute event a day. Both switches are OFF until Daniel turns them on in the Inbox screen.
   Logs hold counts, template numbers and reason codes only, never a name, address or message.
   Top-level constants here never read constants of other files (file load order is not guaranteed). */

const IB_SENDER_NAME = 'Danyel OZ';
const IB_TICK_HANDLER = 'ibAutoReplyTick';
const IB_DIGEST_HANDLER = 'ibDailyDigest';
const IB_PROP_AUTO = 'IB_AUTO_REPLY';             // 'on' or 'off' (missing = off)
const IB_PROP_ON_SINCE = 'IB_AR_ON_SINCE';        // ms when the auto-reply was last turned on
const IB_PROP_DIGEST = 'IB_DIGEST';               // 'on' or 'off' (missing = off)
const IB_AR_COUNT = 'IB_AR_COUNT_';               // + yyyy-MM-dd (Manila): auto-replies claimed that day
const IB_AR_PAUSED = 'IB_AR_PAUSED_';             // + yyyy-MM-dd (Manila): burst breaker tripped that day
const IB_TEST_COUNT = 'IB_TEST_COUNT_';           // + yyyy-MM-dd (Manila): test sends that day
const IB_DIGEST_DONE = 'IB_DIGEST_DONE_';         // + yyyy-MM-dd (Manila): digest event made that day
const IB_DIGEST_TAG = 'ibDigest';
const IB_COL_STATUS = 'status';
const IB_COL_AUTO = 'auto_reply_at';
const IB_STATUSES = ['New', 'Replied', 'Done'];
const IB_CAP_PER_DAY = 30;
const IB_PER_RUN = 5;
const IB_TEST_PER_DAY = 5;
const IB_QUOTA_FLOOR = 46;                        // FS_MAX_MAIL_PER_DAY 40 + 1 cap notice + FS_MIN_QUOTA 5 (checked by the test)
const IB_MIN_AGE_MS = 20 * 60 * 1000;
const IB_MAX_AGE_MS = 72 * 3600 * 1000;
const IB_REPEAT_MS = 30 * 86400000;
const IB_BURST_ROWS = 10;
const IB_BURST_MS = 3600 * 1000;
const IB_SAME_ADDR_ROWS = 3;
const IB_DAY_MS = 86400000;
const IB_KEEP_MS = 365 * 86400000;
const IB_TOKEN_MS = 15 * 60 * 1000;
const IB_DIGEST_LINES = 20;
const IB_LOCK_MS = 5000;
const IB_NAME_RE = /^\p{L}[\p{L}'-]{0,23}$/u;
const IB_SKIP_LOCAL_RE = /^(noreply|no-reply|donotreply|mailer-daemon|postmaster|abuse|bounce.*)$/;
const IB_ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z/;
const IB_SENDING = 'sending ';

/* The reply templates (Daniel approves them before the switch goes on). One subject per set, no links, nothing from
   the message. The greeting ("Hi <first name>," or "Hi,") goes above the body and IB_FOOTER below it. */
const IB_FOOTER = 'You get this one-time note because this address was entered on the form at danyeloz.info. ' +
  'If that was not you, you can ignore it; no more messages will follow.';
const IB_SUBJECT_CONTACT = 'Thanks for your message';
const IB_SUBJECT_SYNC = 'Thanks for your sync request';
const IB_TEMPLATES = {
  contact: [
    { subject: IB_SUBJECT_CONTACT, body: 'Thank you for writing to me. Your message arrived safely.\n\n' +
      'I read every message myself, and I answer personally whenever I can. Sometimes that takes a few days, ' +
      'because music keeps me busy, but your note is on my list.\n\nHave a great day,\nDanyel OZ' },
    { subject: IB_SUBJECT_CONTACT, body: 'Thanks so much for reaching out. I just wanted you to know your message got here.\n\n' +
      'This little note is automatic, but I read every message myself and write back personally when I can. ' +
      'The real answer comes from me, usually with a cup of coffee next to the keyboard.\n\nTalk soon,\nDanyel OZ' },
    { subject: IB_SUBJECT_CONTACT, body: 'Thank you for your message. It means a lot that you took the time to write.\n\n' +
      'This note is automatic, but the reading is not: I read every message myself and answer personally when possible.\n\n' +
      'With thanks,\nDanyel OZ' },
    { subject: IB_SUBJECT_CONTACT, body: 'Your message made it to my inbox, and I\'m glad it did. Thank you.\n\n' +
      'I read everything that comes in, and I reply myself whenever I can. If it takes a little while, ' +
      'it means I\'m in the studio, not that I forgot you.\n\nAll the best,\nDanyel OZ' },
    { subject: IB_SUBJECT_CONTACT, body: 'Thanks for getting in touch. I really appreciate it.\n\n' +
      'Just so you know, I read every message personally, and I answer when I can. Good things take a bit of time, ' +
      'like a song that needs one more mix.\n\nTake care,\nDanyel OZ' }
  ],
  sync: [
    { subject: IB_SUBJECT_SYNC, body: 'Thank you for your sync license request. It arrived safely.\n\n' +
      'I read every request myself and answer personally. You can expect a quote from me within 3 business days.\n\n' +
      'Thanks again for thinking of my music,\nDanyel OZ' },
    { subject: IB_SUBJECT_SYNC, body: 'Thanks so much for considering my music for your project. That really makes my day.\n\n' +
      'I read every request myself and answer personally, so you\'ll get a quote from me within 3 business days.\n\nBest,\nDanyel OZ' },
    { subject: IB_SUBJECT_SYNC, body: 'Your sync request is in, thank you.\n\n' +
      'This note is automatic, but the quote will not be: I read every request myself and will get back to you ' +
      'with a quote within 3 business days.\n\nKind regards,\nDanyel OZ' },
    { subject: IB_SUBJECT_SYNC, body: 'Thank you for reaching out about licensing my music. I\'m happy you found a song that might fit.\n\n' +
      'I read each request myself and answer personally. Look out for a quote from me within 3 business days.\n\n' +
      'All the best,\nDanyel OZ' },
    { subject: IB_SUBJECT_SYNC, body: 'Thanks for your request. It\'s always exciting to hear a song might find a new home on screen.\n\n' +
      'I read every request personally, and you\'ll get a quote within 3 business days. ' +
      'I promise it won\'t take as long as a director\'s cut.\n\nCheers,\nDanyel OZ' }
  ]
};

/* ---------- Screen API (every function starts with the owner check) ---------- */

function getInboxData() {
  ibOwner_();
  const p = PropertiesService.getScriptProperties(), now = new Date();
  const tabs = ibTabs_(ibInbox_(p, false), p);
  const items = [], counts = { total: 0, contact: 0, sync: 0, New: 0, Replied: 0, Done: 0 };
  tabs.forEach(function (t) {
    t.rows.forEach(function (r) {
      if (r.blank) return;
      const it = ibItem_(t, r);
      items.push(it);
      counts.total++; counts[t.key]++; counts[it.status]++;
    });
  });
  items.sort(function (a, b) { return a.date < b.date ? 1 : a.date > b.date ? -1 : 0; });
  return { items: items, counts: counts, oldCount: ibOldRows_(tabs, now.getTime() - IB_KEEP_MS).length,
    settings: ibSettings_(p, now), templates: ibPreviews_(), triggers: ibTriggerCounts_() };
}

function setInboxStatus(type, row, rowKey, status) {
  ibOwner_();
  if (!ibIsForm_(type)) throw new Error('Unknown form');
  if (IB_STATUSES.indexOf(status) < 0) throw new Error('Unknown status');
  const n = Number(row);
  if (!Number.isInteger(n) || n < 2) throw new Error('List changed, reload');
  const p = PropertiesService.getScriptProperties(), lock = lock_();
  try {
    const t = ibTabs_(ibInbox_(p, false), p).filter(function (x) { return x.key === type; })[0];
    if (!t || !ibFresh_(t, n, String(rowKey == null ? '' : rowKey))) throw new Error('List changed, reload');
    ibWrite_(t, n, IB_COL_STATUS, status);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return { ok: true, status: status };
}

function previewOldRows() {
  ibOwner_();
  const p = PropertiesService.getScriptProperties(), now = new Date();
  const tabs = ibTabs_(ibInbox_(p, false), p);
  return { count: ibOldRows_(tabs, now.getTime() - IB_KEEP_MS).length, token: now.toISOString(),
    cutoffIso: new Date(now.getTime() - IB_KEEP_MS).toISOString() };
}

/* Deletes inbox rows older than a year, only when a fresh count still equals the count Daniel confirmed. */
function deleteOldRows(token, count) {
  ibOwner_();
  const now = new Date(), tok = String(token == null ? '' : token), issued = Date.parse(tok), want = Number(count);
  if (!IB_ISO_RE.test(tok) || isNaN(issued) || now.getTime() - issued < 0 || now.getTime() - issued > IB_TOKEN_MS) {
    throw new Error('Check the old messages again, then delete.');
  }
  if (!Number.isInteger(want) || want < 1) throw new Error('Nothing to delete.');
  const p = PropertiesService.getScriptProperties(), lock = lock_();
  let deleted = 0;
  try {
    const tabs = ibTabs_(ibInbox_(p, false), p), old = ibOldRows_(tabs, now.getTime() - IB_KEEP_MS);
    if (old.length !== want) throw new Error('The number of old messages changed. Check again.');
    tabs.forEach(function (t) {
      old.filter(function (o) { return o.t === t; }).map(function (o) { return o.r.row; })
        .sort(function (a, b) { return b - a; })
        .forEach(function (r) { if (r >= 2) { t.sheet.deleteRow(r); deleted++; } });
    });
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  Logger.log('deleteOldRows: deleted ' + deleted);
  return { deleted: deleted };
}

function setAutoReply(on) {
  ibOwner_();
  const p = PropertiesService.getScriptProperties(), lock = lock_();
  try {
    if (on === true) {
      if (p.getProperty(IB_PROP_AUTO) !== 'on') { p.setProperty(IB_PROP_ON_SINCE, String(Date.now())); p.setProperty(IB_PROP_AUTO, 'on'); }
    } else {
      p.setProperty(IB_PROP_AUTO, 'off');
    }
  } finally {
    lock.releaseLock();
  }
  Logger.log('setAutoReply: ' + (on === true ? 'on' : 'off'));
  return ibSettings_(p, new Date());
}

function setDigest(on) {
  ibOwner_();
  const p = PropertiesService.getScriptProperties(), lock = lock_();
  try {
    p.setProperty(IB_PROP_DIGEST, on === true ? 'on' : 'off');
  } finally {
    lock.releaseLock();
  }
  Logger.log('setDigest: ' + (on === true ? 'on' : 'off'));
  return ibSettings_(p, new Date());
}

/* Sends one template to Daniel only (never to another address), at most IB_TEST_PER_DAY a day. */
function sendAutoReplyTest(type, n) {
  ibOwner_();
  if (!ibIsForm_(type)) throw new Error('Unknown form');
  const k = Number(n);
  if (!Number.isInteger(k) || k < 1 || k > IB_TEMPLATES[type].length) throw new Error('Unknown template');
  if (MailApp.getRemainingDailyQuota() < IB_QUOTA_FLOOR) throw new Error('Not enough email quota left today. Try again tomorrow.');
  const p = PropertiesService.getScriptProperties(), day = ibDay_(new Date()), lock = lock_();
  let used = 0;
  try {
    ibDropOld_(p, IB_TEST_COUNT, day);
    used = Number(p.getProperty(IB_TEST_COUNT + day)) || 0;
    if (used >= IB_TEST_PER_DAY) throw new Error('Test limit reached for today.');
    p.setProperty(IB_TEST_COUNT + day, String(used + 1));
  } finally {
    lock.releaseLock();
  }
  const mail = ibCompose_(type, k, ibFirstName_('Daniel'));
  ibMail_(FS_NOTIFY, { subject: 'Test: ' + mail.subject, body: mail.body });
  Logger.log('sendAutoReplyTest: ' + type + ' #' + k);
  return { sent: true, to: FS_NOTIFY, left: IB_TEST_PER_DAY - used - 1 };
}

/* Safe to run again: removes only the two Inbox triggers, then makes exactly one of each. */
function installInboxTriggers() {
  ibOwner_();
  const lock = lock_();
  try {
    ibDeleteTriggers_();
    ScriptApp.newTrigger(IB_TICK_HANDLER).timeBased().everyMinutes(10).create();
    ScriptApp.newTrigger(IB_DIGEST_HANDLER).timeBased().atHour(9).everyDays(1).inTimezone(FS_TZ).create();
  } finally {
    lock.releaseLock();
  }
  Logger.log('installInboxTriggers: done');
  return ibTriggerCounts_();
}

function removeInboxTriggers() {
  ibOwner_();
  const lock = lock_();
  try {
    ibDeleteTriggers_();
  } finally {
    lock.releaseLock();
  }
  Logger.log('removeInboxTriggers: done');
  return ibTriggerCounts_();
}

/* ---------- Trigger handlers (never throw; the switch is checked on every run) ---------- */

function ibAutoReplyTick(e) {
  if (!ibFromTrigger_(e, IB_TICK_HANDLER)) { Logger.log('ibAutoReplyTick: not called by its trigger, nothing done'); return; }
  try { ibAutoReplyRun_(new Date()); } catch (err) { Logger.log('ibAutoReplyTick: could not finish'); }
}

function ibDailyDigest(e) {
  if (!ibFromTrigger_(e, IB_DIGEST_HANDLER)) { Logger.log('ibDailyDigest: not called by its trigger, nothing done'); return; }
  try { ibDigestRun_(new Date()); } catch (err) { Logger.log('ibDailyDigest: could not finish'); }
}

/* Claim under the lock (auto_reply_at = "sending <ISO>"), send outside it, then record "<ISO> #n" under the lock.
   A row with any auto_reply_at is never picked again, so a failed write never leads to a second email. */
function ibAutoReplyRun_(now) {
  const p = PropertiesService.getScriptProperties();
  const since = Number(p.getProperty(IB_PROP_ON_SINCE)) || 0;
  if (p.getProperty(IB_PROP_AUTO) !== 'on' || !since) return 'off';
  const day = ibDay_(now), nowMs = now.getTime();
  if (p.getProperty(IB_AR_PAUSED + day)) { Logger.log('ibAutoReplyTick: paused today'); return 'paused'; }
  if (MailApp.getRemainingDailyQuota() < IB_QUOTA_FLOOR) { Logger.log('ibAutoReplyTick: quota floor'); return 'quota'; }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(IB_LOCK_MS)) { Logger.log('ibAutoReplyTick: busy'); return 'busy'; }
  let claims = [], burst = false;
  try {
    ibDropOld_(p, IB_AR_COUNT, day);
    ibDropOld_(p, IB_AR_PAUSED, day);
    const all = [];
    ibTabs_(ibInbox_(p, true), p).forEach(function (t) { t.rows.forEach(function (r) { all.push({ t: t, r: r }); }); });
    const recent = all.filter(function (x) { return x.r.ts && nowMs - x.r.ts.getTime() <= IB_BURST_MS && x.r.ts.getTime() <= nowMs; });
    if (recent.length > IB_BURST_ROWS) {
      p.setProperty(IB_AR_PAUSED + day, String(nowMs));
      burst = true;
    } else {
      const sent = Number(p.getProperty(IB_AR_COUNT + day)) || 0, room = Math.min(IB_PER_RUN, IB_CAP_PER_DAY - sent);
      if (room > 0) {
        const stamp = IB_SENDING + now.toISOString();
        claims = ibPick_(all, nowMs, since, room).filter(function (c) {
          c.key = ibRowKey_(c.r);
          const f = ibFresh_(c.t, c.r.row, c.key);
          if (!f || f.auto !== '') return false;
          ibWrite_(c.t, c.r.row, IB_COL_AUTO, stamp);
          c.stamp = stamp;
          return true;
        });
        if (claims.length) { SpreadsheetApp.flush(); p.setProperty(IB_AR_COUNT + day, String(sent + claims.length)); }
      }
    }
  } finally {
    lock.releaseLock();
  }
  if (burst) {
    Logger.log('ibAutoReplyTick: burst, paused today');
    fsSendCapped_(p, 'inbox', { subject: 'Danyel OZ inbox: automatic replies paused today',
      body: 'More than ' + IB_BURST_ROWS + ' new form replies arrived within one hour, so automatic replies are paused ' +
        'until tomorrow (Manila time). The replies are saved in the inbox. Open the Inbox screen to check them.', replyTo: '' });
    return 'burst';
  }
  if (!claims.length) return 'none';
  const done = [], undo = [];
  claims.forEach(function (c) {
    if (undo.length || MailApp.getRemainingDailyQuota() < IB_QUOTA_FLOOR) { undo.push(c); return; }
    const n = 1 + Math.floor(Math.random() * IB_TEMPLATES[c.t.key].length);
    try {
      ibMail_(String(c.r.raw.email).trim(), ibCompose_(c.t.key, n, ibFirstNameOf_(c.t.key, c.r.raw)));
      c.n = n;
      done.push(c);
    } catch (err) {
      Logger.log('ibAutoReplyTick: send failed, template #' + n);
    }
  });
  if (undo.length) Logger.log('ibAutoReplyTick: quota floor, ' + undo.length + ' left for later');
  const lock2 = LockService.getScriptLock();
  if (!lock2.tryLock(IB_LOCK_MS)) { Logger.log('ibAutoReplyTick: busy after sending ' + done.length); return 'unrecorded'; }
  try {
    done.forEach(function (c) {
      const f = ibFresh_(c.t, c.r.row, c.key);
      if (f && f.auto === c.stamp) ibWrite_(c.t, c.r.row, IB_COL_AUTO, now.toISOString() + ' #' + c.n);
    });
    undo.forEach(function (c) {
      const f = ibFresh_(c.t, c.r.row, c.key);
      if (f && f.auto === c.stamp) ibWrite_(c.t, c.r.row, IB_COL_AUTO, '');
    });
    if (undo.length) {
      const k = IB_AR_COUNT + day;
      p.setProperty(k, String(Math.max(0, (Number(p.getProperty(k)) || 0) - undo.length)));
    }
    SpreadsheetApp.flush();
  } finally {
    lock2.releaseLock();
  }
  Logger.log('ibAutoReplyTick: sent ' + done.length + (done.length ? ', templates ' + done.map(function (c) { return '#' + c.n; }).join(' ') : ''));
  return 'sent ' + done.length;
}

/* Eligible rows, shuffled, one per address key, at most `room`. */
function ibPick_(all, nowMs, since, room) {
  const last = {}, seen = {};
  all.forEach(function (x) {
    const k = ibAddrKey_(x.r.raw.email);
    if (x.r.auto !== '') {
      const m = IB_ISO_RE.exec(x.r.auto), at = m ? Date.parse(m[0]) : nowMs;
      if (!last[k] || at > last[k]) last[k] = at;
    }
    if (x.r.ts && Math.abs(nowMs - x.r.ts.getTime()) <= IB_DAY_MS) seen[k] = (seen[k] || 0) + 1;
  });
  const ok = all.filter(function (x) {
    const r = x.r;
    if (r.auto !== '' || !r.ts || r.status === 'Replied' || r.status === 'Done') return false;
    const at = r.ts.getTime(), age = nowMs - at;
    if (at <= since || age < IB_MIN_AGE_MS || age > IB_MAX_AGE_MS) return false;
    if (!ibValidRow_(x.t.key, r)) return false;
    const k = ibAddrKey_(r.raw.email);
    if (ibSkipAddr_(r.raw.email) || (seen[k] || 0) > IB_SAME_ADDR_ROWS) return false;
    return !(last[k] && nowMs - last[k] < IB_REPEAT_MS);
  });
  for (let i = ok.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)), tmp = ok[i]; ok[i] = ok[j]; ok[j] = tmp; }
  const picked = [], keys = {};
  for (let i = 0; i < ok.length && picked.length < room; i++) {
    const k = ibAddrKey_(ok[i].r.raw.email);
    if (keys[k]) continue;
    keys[k] = true;
    picked.push({ t: ok[i].t, r: ok[i].r });
  }
  return picked;
}

/* One private event a Manila day: no guests, no invites, no location, no address or message text. */
function ibDigestRun_(now) {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty(IB_PROP_DIGEST) !== 'on') return 'off';
  const day = ibDay_(now);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(IB_LOCK_MS)) { Logger.log('ibDailyDigest: busy'); return 'busy'; }
  try {
    ibDropOld_(p, IB_DIGEST_DONE, day);
    if (p.getProperty(IB_DIGEST_DONE + day)) return 'done';
    const start = new Date(day + 'T09:00:00+08:00'), end = new Date(start.getTime() + 15 * 60 * 1000);
    const cal = CalendarApp.getDefaultCalendar();
    const tagged = cal.getEventsForDay(start).some(function (ev) { return ev.getTag(IB_DIGEST_TAG) === day; });
    if (tagged) { p.setProperty(IB_DIGEST_DONE + day, '1'); return 'done'; }
    const open = ibOpenRows_(p), rel = ibReleases_(now, day);
    if (!open.length && !rel.length) { Logger.log('ibDailyDigest: nothing open'); return 'empty'; }
    const title = 'To-do: ' + [open.length ? ibPlural_(open.length, 'message') : '', rel.length ? ibPlural_(rel.length, 'release') : '']
      .filter(String).join(', ');
    const ev = cal.createEvent(title, start, end, { description: ibDigestText_(open, rel, now) });
    ev.setVisibility(CalendarApp.Visibility.PRIVATE);
    ev.setTag(IB_DIGEST_TAG, day);
    p.setProperty(IB_DIGEST_DONE + day, '1');
    Logger.log('ibDailyDigest: event with ' + open.length + ' messages, ' + rel.length + ' releases');
    return 'created';
  } finally {
    lock.releaseLock();
  }
}

function ibOpenRows_(p) {
  let tabs = [];
  try { tabs = ibTabs_(ibInbox_(p, false), p); } catch (err) { Logger.log('ibDailyDigest: inbox not readable'); return []; }
  const open = [];
  tabs.forEach(function (t) {
    t.rows.forEach(function (r) { if (!r.blank && r.ts && r.status !== 'Replied' && r.status !== 'Done') open.push({ key: t.key, r: r }); });
  });
  return open.sort(function (a, b) { return a.r.ts.getTime() - b.r.ts.getTime(); });
}

function ibReleases_(now, day) {
  let songs = [];
  try { songs = getSongs().songs || []; } catch (err) { Logger.log('ibDailyDigest: Song Database not readable'); return []; }
  const lastDay = ibDay_(new Date(now.getTime() + 7 * IB_DAY_MS));
  return songs.filter(function (s) { const d = String(s.release_date || ''); return /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= day && d <= lastDay; })
    .sort(function (a, b) { return a.release_date < b.release_date ? -1 : a.release_date > b.release_date ? 1 : 0; })
    .map(function (s) { return { title: fsClean_(s.song_title, true).slice(0, 80), date: s.release_date }; });
}

function ibDigestText_(open, rel, now) {
  const lines = [], cap = function (list, fmt) {
    list.slice(0, IB_DIGEST_LINES).forEach(function (x) { lines.push('- ' + fmt(x)); });
    if (list.length > IB_DIGEST_LINES) lines.push('+' + (list.length - IB_DIGEST_LINES) + ' more');
  };
  if (open.length) {
    lines.push('Open messages (' + open.length + '):');
    cap(open, function (o) {
      const days = Math.max(0, Math.floor((now.getTime() - o.r.ts.getTime()) / IB_DAY_MS));
      const age = days === 0 ? 'today' : ibPlural_(days, 'day') + ' old';
      const name = ibFirstNameOf_(o.key, o.r.raw) || 'no name';
      if (o.key === 'sync') return 'Sync request, ' + name + ', ' + age;
      const topic = fsCheck_(FS_FORMS.contact.fields[3], o.r.raw.topic);
      return ['Contact', name, topic || '', age].filter(String).join(', ');
    });
  }
  if (rel.length) {
    if (lines.length) lines.push('');
    lines.push('Releases in the next 7 days (' + rel.length + '):');
    cap(rel, function (s) { return s.title + ', ' + s.date; });
  }
  lines.push('', 'Details are in the Inbox screen of the admin app.');
  return lines.join('\n');
}

/* ---------- Helpers ---------- */

/* Default deny (IR-08, NF-01, D-12): the script must run as the owner of the bound Song Database (deployment
   "Execute as: Me"), and the signed-in user is either blank (what the web app reports under "Only myself") or that
   same owner. A helper (Execute as user accessing) is not the owner and is refused. No address is hardcoded, and the
   messages name the failed part without any address. */
function ibOwner_() {
  const mail = function (get) { try { const u = get(); return u ? String(u.getEmail() || '').trim().toLowerCase() : ''; } catch (err) { return ''; } };
  const owner = mail(function () { return SpreadsheetApp.getActiveSpreadsheet().getOwner(); });
  const effective = mail(function () { return Session.getEffectiveUser(); });
  const active = mail(function () { return Session.getActiveUser(); });
  if (!owner) throw new Error('Not allowed: the Song Database owner could not be read (is it on a Shared Drive?)');
  if (!effective || effective !== owner) throw new Error('Not allowed: the admin app must be deployed as Execute as: Me');
  if (active !== '' && active !== owner) throw new Error('Not allowed: you are signed in as a different Google account than the Song Database owner');
}

/* NF-02: a handler runs only for an event from one of this project's own triggers for that handler. A call from the
   page has no event, or a uid it cannot know. */
function ibFromTrigger_(e, handler) {
  if (!e || typeof e !== 'object' || e.triggerUid == null || String(e.triggerUid) === '') return false;
  const uid = String(e.triggerUid);
  try {
    return ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === handler && String(t.getUniqueId()) === uid; });
  } catch (err) {
    return false;
  }
}

function ibIsForm_(type) {
  return typeof type === 'string' && Object.prototype.hasOwnProperty.call(IB_TEMPLATES, type) &&
    Object.prototype.hasOwnProperty.call(FS_FORMS, type);
}

/* The private inbox only: stored id, never the Song Database (same guard as fsOnFormSubmit). */
function ibInbox_(p, needSongDb) {
  const id = p.getProperty(FS_PROP_INBOX) || '', songDb = p.getProperty(FS_PROP_SONG_DB) || '';
  if (!id) throw new Error('The inbox is not set up yet. Run setupDanyelOzForms first.');
  if (id === songDb || id === fsActiveId_()) throw new Error('Inbox must not be the Song Database');
  if (needSongDb && !songDb) throw new Error('Song Database id missing. Run setupDanyelOzForms first.');
  const book = SpreadsheetApp.openById(id);
  if (!book || book.getId() !== id) throw new Error('Inbox not found');
  return book;
}

/* Only tabs that belong to one of the two stored forms; columns found by header name on every call. */
function ibTabs_(book, p) {
  const out = [];
  book.getSheets().forEach(function (sh) {
    const found = fsFormOfSheet_(sh, p);
    if (found) out.push(ibReadTab_(sh, found.key));
  });
  return out;
}

function ibReadTab_(sh, key) {
  const t = { key: key, sheet: sh, heads: [], rows: [] };
  const lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow >= 1 && lastCol >= 1) {
    const data = sh.getRange(1, 1, lastRow, lastCol).getValues();
    t.heads = data[0].map(function (h) { return String(h == null ? '' : h).trim(); });
    ibMapCols_(t);
    for (let i = 1; i < data.length; i++) t.rows.push(ibRowOf_(t, data[i], i + 1));
  } else {
    ibMapCols_(t);
  }
  return t;
}

function ibMapCols_(t) {
  const h = t.heads, labels = FS_FORMS[t.key].fields.map(function (f) { return f.label; });
  t.col = {};
  FS_FORMS[t.key].fields.forEach(function (f) { t.col[f.key] = h.indexOf(f.label); });
  t.statusCol = h.indexOf(IB_COL_STATUS);
  t.autoCol = h.indexOf(IB_COL_AUTO);
  t.tsCol = h.indexOf('Timestamp');
  if (t.tsCol < 0 && h.length && h[0] && labels.indexOf(h[0]) < 0 && h[0] !== IB_COL_STATUS && h[0] !== IB_COL_AUTO) t.tsCol = 0;
}

function ibRowOf_(t, r, rowNum) {
  const raw = {};
  let blank = true;
  FS_FORMS[t.key].fields.forEach(function (f) {
    const j = t.col[f.key];
    raw[f.key] = j >= 0 && r[j] != null ? String(r[j]) : '';
    if (raw[f.key].trim() !== '') blank = false;
  });
  const ts = t.tsCol >= 0 ? ibTime_(r[t.tsCol]) : null;
  return { row: rowNum, ts: ts, raw: raw, blank: blank && !ts,
    status: t.statusCol >= 0 ? fsClean_(r[t.statusCol], true) : '',
    auto: t.autoCol >= 0 ? fsClean_(r[t.autoCol], true) : '' };
}

function ibTime_(v) {
  if (v == null || v === '') return null;
  const d = Object.prototype.toString.call(v) === '[object Date]' ? new Date(v.getTime()) : new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function ibRowKey_(r) {
  return (r.ts ? r.ts.toISOString() : '') + '|' + ibAddrKey_(r.raw.email);
}

/* Re-reads one row; returns it only when Timestamp and address key still match (IR-10). */
function ibFresh_(t, rowNum, rowKey) {
  const sh = t.sheet;
  if (rowNum < 2 || rowNum > sh.getLastRow()) return null;
  const r = sh.getRange(rowNum, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  const row = ibRowOf_(t, r, rowNum);
  return ibRowKey_(row) === rowKey ? row : null;
}

/* Adds the column by header name after the last column when missing (IR-17), then writes one cell as text. */
function ibWrite_(t, rowNum, name, value) {
  let j = t.heads.indexOf(name);
  if (j < 0) {
    j = Math.max(t.sheet.getLastColumn(), t.heads.length);
    while (t.heads.length < j) t.heads.push('');
    t.heads.push(name);
    t.sheet.getRange(1, j + 1).setValue(name);
    ibMapCols_(t);
  }
  t.sheet.getRange(rowNum, j + 1).setValue(safeText_(value));
}

function ibItem_(t, r) {
  const v = {};
  FS_FORMS[t.key].fields.forEach(function (f) { v[f.key] = fsClean_(r.raw[f.key], f.type !== 'long').slice(0, f.max || 200); });
  const iso = IB_ISO_RE.exec(r.auto), tpl = /#([1-5])$/.exec(r.auto);
  return {
    type: t.key, row: r.row, rowKey: ibRowKey_(r), date: r.ts ? r.ts.toISOString() : '',
    firstName: ibFirstNameOf_(t.key, r.raw),
    name: t.key === 'contact' ? (v.first_name + ' ' + v.last_name).trim() : v.name,
    email: v.email, emailOk: fsValidEmail_(r.raw.email) && fsClean_(r.raw.email, true) === String(r.raw.email).trim(),
    topic: v.topic || '', subject: v.subject || '', songs: v.songs || '', company: v.company || '', project: v.project || '',
    media: v.media || '', territory: v.territory || '', term: v.term || '', timeline: v.timeline || '', budget: v.budget || '',
    message: v.message || '', notes: v.notes || '',
    status: IB_STATUSES.indexOf(r.status) >= 0 ? r.status : 'New',
    autoReplyAt: r.auto === '' ? '' : r.auto.indexOf(IB_SENDING) === 0 ? 'sending' : iso ? iso[0] : r.auto.slice(0, 40),
    autoReplyTemplate: tpl && iso ? Number(tpl[1]) : ''
  };
}

function ibOldRows_(tabs, cutoffMs) {
  const out = [];
  tabs.forEach(function (t) { t.rows.forEach(function (r) { if (r.ts && r.ts.getTime() < cutoffMs) out.push({ t: t, r: r }); }); });
  return out;
}

/* Every answer must pass the same checks as fsOnFormSubmit (IR-07). */
function ibValidRow_(key, r) {
  return FS_FORMS[key].fields.every(function (f) { return fsCheck_(f, r.raw[f.key]) !== null; });
}

/* Address key for the 30-day rule: lower case, no +tag, Gmail dots and googlemail.com folded (IR-01a). */
function ibAddrKey_(email) {
  const s = String(email == null ? '' : email).trim().toLowerCase(), at = s.lastIndexOf('@');
  if (at < 1) return s;
  let local = s.slice(0, at), domain = s.slice(at + 1);
  const plus = local.indexOf('+');
  if (plus >= 0) local = local.slice(0, plus);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  if (domain === 'gmail.com') local = local.replace(/\./g, '');
  return local + '@' + domain;
}

/* Never reply to Daniel, the site's own domains, or robot mailboxes (IR-01b). */
function ibSkipAddr_(email) {
  const k = ibAddrKey_(email), at = k.lastIndexOf('@');
  const local = k.slice(0, at), domain = k.slice(at + 1);
  return at < 1 || k === ibAddrKey_(FS_NOTIFY) || domain.indexOf('danyeloz') >= 0 || IB_SKIP_LOCAL_RE.test(local);
}

/* First name for greetings and the digest: first word, letters, apostrophe and hyphen only, else '' (IR-02). */
function ibFirstName_(raw) {
  const first = fsClean_(raw, true).normalize('NFC').split(' ')[0] || '';
  return IB_NAME_RE.test(first) ? first : '';
}

function ibFirstNameOf_(key, raw) {
  return ibFirstName_(key === 'contact' ? raw.first_name : raw.name);
}

function ibCompose_(key, n, firstName) {
  const t = IB_TEMPLATES[key][n - 1];
  return { subject: t.subject, body: (firstName ? 'Hi ' + firstName + ',' : 'Hi,') + '\n\n' + t.body + '\n\n' + IB_FOOTER };
}

function ibPreviews_() {
  const out = {};
  Object.keys(IB_TEMPLATES).forEach(function (key) {
    out[key] = IB_TEMPLATES[key].map(function (t, i) { return ibCompose_(key, i + 1, '<first name>'); });
  });
  return out;
}

/* The only place in this file that sends mail: one validated address, plain text, fixed name and reply-to (IR-14). */
function ibMail_(to, mail) {
  if (!fsValidEmail_(to)) throw new Error('Bad address');
  MailApp.sendEmail({ to: to, subject: mail.subject, body: mail.body, name: IB_SENDER_NAME, replyTo: FS_NOTIFY });
}

function ibSettings_(p, now) {
  const day = ibDay_(now);
  return { autoReply: p.getProperty(IB_PROP_AUTO) === 'on', digest: p.getProperty(IB_PROP_DIGEST) === 'on',
    capPerDay: IB_CAP_PER_DAY, sentToday: Number(p.getProperty(IB_AR_COUNT + day)) || 0, paused: !!p.getProperty(IB_AR_PAUSED + day) };
}

function ibTriggerCounts_() {
  const out = { autoReply: 0, digest: 0 };
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const h = t.getHandlerFunction();
    if (h === IB_TICK_HANDLER) out.autoReply++;
    if (h === IB_DIGEST_HANDLER) out.digest++;
  });
  return out;
}

function ibDeleteTriggers_() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    const h = t.getHandlerFunction();
    if (h === IB_TICK_HANDLER || h === IB_DIGEST_HANDLER) ScriptApp.deleteTrigger(t);
  });
}

function ibDay_(d) {
  return Utilities.formatDate(d, FS_TZ, 'yyyy-MM-dd');
}

function ibDropOld_(p, prefix, day) {
  p.getKeys().forEach(function (k) { if (k.indexOf(prefix) === 0 && k !== prefix + day) p.deleteProperty(k); });
}

function ibPlural_(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}
