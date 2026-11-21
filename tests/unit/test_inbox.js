// Inbox.gs: Inbox screen server, auto-reply engine and 9 am digest, against IR-01..IR-17 of
// runs/r-20261121-2308-inbox-autoreply-digest/security/design-review.md. Usage: node tests/unit/test_inbox.js apps-script
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), (m || 'mismatch') + ': ' + JSON.stringify(a));
const DIR = process.argv[2] || 'apps-script';
const read = f => fs.readFileSync(path.join(DIR, f), 'utf8');
const SRC = read('Inbox.gs');

/* ---------- clock ---------- */
const H = 3600000, MIN = 60000, DAY = 86400000;
let NOW = Date.parse('2026-11-21T02:00:00.000Z');                      // 10:00 Manila
class FDate extends Date { constructor(...a) { if (a.length === 0) super(NOW); else super(...a); } static now() { return NOW; } }
const ago = ms => new FDate(NOW - ms);

/* ---------- mocks ---------- */
let props, mails, logs, triggers, events, user, effective, ownerFails = false, uidSeq = 0, owner = 'owner.account@gmail.com', quota, lockHeld, lockFail, onSend, sendFail, songs, books, rnd;
const CONTACT_HEADS = ['Timestamp', 'First name', 'Last name', 'Email', 'What would you like to contact me about?', 'Subject', 'Message'];
const SYNC_HEADS = ['Timestamp', 'Name', 'Email', 'Company or production', 'Song or songs', 'Project', 'Media type', 'Territory',
  'Term', 'Timeline', 'Budget range', 'Notes'];
const C_ID = 'FORMCONTACTabcdefghij', S_ID = 'FORMSYNCabcdefghijkl';
function makeSheet(formId, heads, rows) {
  const sh = { data: [heads.slice()].concat(rows.map(r => r.slice())), parent: null,
    getParent() { return this.parent; },
    getFormUrl() { return formId ? 'https://docs.google.com/forms/d/' + formId + '/edit' : null; },
    getLastRow() { return this.data.length; },
    getLastColumn() { return Math.max(0, ...this.data.map(r => r.length)); },
    getRange(r, c, nr, nc) {
      nr = nr || 1; nc = nc || 1;
      return { getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (sh.data[r - 1 + i] || [])[c - 1 + j]; row.push(v == null ? '' : v); } out.push(row); } return out; },
        setValue(v) { assert.ok(nr === 1 && nc === 1, 'single cell'); const row = sh.data[r - 1]; while (row.length < c) row.push(''); row[c - 1] = v; } };
    },
    deleteRow(r) { assert.ok(r >= 2, 'header never deleted'); sh.data.splice(r - 1, 1); } };
  return sh;
}
function makeBook(id, sheets) { const b = { getId: () => id, getSheets: () => sheets.slice(), sheets }; sheets.forEach(s => { s.parent = b; }); books[id] = b; return b; }
const cRow = o => [o.ts === undefined ? ago(30 * MIN) : o.ts, o.first == null ? 'Ana' : o.first, o.last || 'Lopez', o.email || 'ana@example.com',
  o.topic || 'Fan Contact', o.subject || 'Hello there', o.message || 'I love the songs'];
const sRow = o => [o.ts === undefined ? ago(30 * MIN) : o.ts, o.name || 'Ben Cruz', o.email || 'ben@studio.io', o.company || 'Big Studio',
  o.songs || 'Song A', o.project || 'A film', o.media || 'Film', 'Worldwide', '1 year', 'Soon', '', ''];
function reset(cRows, sRows, extraSheets) {
  props = { FS_CONTACT_FORM_ID: C_ID, FS_SYNC_FORM_ID: S_ID, FS_INBOX_SHEET_ID: 'INBOX_ID', FS_SONG_DB_ID: 'SONGDB_ID',
    IB_AUTO_REPLY: 'on', IB_AR_ON_SINCE: String(NOW - 100 * H) };
  mails = []; logs = []; triggers = []; events = []; user = owner; effective = owner; ownerFails = false; quota = () => 100;
  lockHeld = false; lockFail = false; onSend = null; sendFail = null; songs = []; books = {};
  const c = makeSheet(C_ID, CONTACT_HEADS, (cRows || []).map(cRow)), s = makeSheet(S_ID, SYNC_HEADS, (sRows || []).map(sRow));
  makeBook('INBOX_ID', [c, s].concat(extraSheets || []));
  return { c, s };
}
let seed = 7;
rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const lock = { tryLock() { if (lockFail || lockHeld) return false; lockHeld = true; return true; }, releaseLock() { lockHeld = false; } };
const mkTrigger = (fn, cfg) => { const uid = 'uid' + (++uidSeq), t = { fn, cfg, getHandlerFunction: () => fn, getUniqueId: () => uid }; triggers.push(t); return t; };
const fire = name => ctx[name]({ triggerUid: mkTrigger(name, {}).getUniqueId(), authMode: 'FULL' });
const ctx = vm.createContext({
  JSON, Number, String, Object, Array, Error, RegExp, isNaN, Date: FDate,
  Math: Object.assign(Object.create(Math), { random: () => rnd() }),
  console: { log() {} },
  Session: { getActiveUser: () => ({ getEmail: () => user }), getEffectiveUser: () => ({ getEmail: () => effective }), getScriptTimeZone: () => 'Etc/UTC' },
  SpreadsheetApp: { getActiveSpreadsheet: () => ({ getId: () => 'SONGDB_ID', getOwner: () => { if (ownerFails) throw new Error('no access'); return owner === null ? null : { getEmail: () => owner }; } }), flush() {},
    openById: id => { if (!books[id]) throw new Error('missing'); return books[id]; } },
  FormApp: { openById: () => { throw new Error('no form'); }, openByUrl: () => { throw new Error('bad url'); } },
  MailApp: { getRemainingDailyQuota: () => quota(), sendEmail: m => {
    assert.strictEqual(typeof m, 'object', 'object form only');
    mails.push({ m, lockHeld });
    if (sendFail && sendFail(m)) throw new Error('send failed');
    if (onSend) { const f = onSend; onSend = null; f(m); } } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
    getKeys: () => Object.keys(props), deleteProperty: k => { delete props[k]; } }) },
  LockService: { getScriptLock: () => lock },
  Logger: { log: s => logs.push(String(s)) },
  Utilities: { formatDate: (d, tz, f) => { assert.strictEqual(tz, 'Asia/Manila'); const iso = new Date(d.getTime() + 8 * H).toISOString(); return f === 'yyyy-MM-dd' ? iso.slice(0, 10) : iso.slice(0, 16).replace('T', ' '); } },
  CalendarApp: { Visibility: { PRIVATE: 'PRIVATE', DEFAULT: 'DEFAULT' }, getDefaultCalendar: () => ({
    getEventsForDay: () => events.slice(),
    createEvent: (title, start, end, opts) => { const ev = { title, start, end, opts, vis: 'DEFAULT', tags: {},
      setVisibility(v) { this.vis = v; return this; }, setTag(k, v) { this.tags[k] = v; return this; }, getTag(k) { return this.tags[k] || null; } };
      events.push(ev); return ev; } }) },
  ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => { triggers.splice(triggers.indexOf(t), 1); },
    newTrigger: fn => ({ timeBased: () => ({
      everyMinutes: n => ({ create: () => mkTrigger(fn, { everyMinutes: n }) }),
      atHour: h => ({ everyDays: d => ({ inTimezone: tz => ({ create: () => mkTrigger(fn, { atHour: h, everyDays: d, tz }) }) }) }) }) }) },
  __songs: () => ({ songs })
});
for (const f of ['Code.gs', 'FormsSetup.gs', 'Inbox.gs']) vm.runInContext(read(f), ctx, { filename: f });
vm.runInContext('getSongs = function () { return __songs(); };', ctx);
const G = n => vm.runInContext(n, ctx);
const tick = () => G('ibAutoReplyRun_(new Date())');
const autoCol = sh => sh.data[0].indexOf('auto_reply_at');
const sent = () => mails.filter(x => x.m.name === 'Danyel OZ');
const to = () => sent().map(x => x.m.to);

/* ---------- constants and templates (IR-01f, IR-14, voice) ---------- */
eq(G('IB_QUOTA_FLOOR'), G('FS_MAX_MAIL_PER_DAY') + 1 + G('FS_MIN_QUOTA'), 'quota floor 46');
eq([G('IB_CAP_PER_DAY'), G('IB_PER_RUN')], [30, 5]);
const T = JSON.parse(JSON.stringify(G('IB_TEMPLATES')));
eq([T.contact.length, T.sync.length], [5, 5], '5 + 5 templates');
const FOOTER = 'You get this one-time note because this address was entered on the form at danyeloz.info. If that was not you, you can ignore it; no more messages will follow.';
for (const key of ['contact', 'sync']) {
  eq(new Set(T[key].map(t => t.subject)).size, 1, key + ' one subject per set');
  T[key].forEach((t, i) => {
    const all = t.subject + '\n' + t.body, tag = key + ' #' + (i + 1);
    assert.ok(!/http|www\.|<|>|\{|\}/i.test(all), tag + ' no links or placeholders');
    assert.ok(!/[–—]/.test(all), tag + ' no dashes');
    assert.ok(!/\b(delve|tapestry|foster|narrator|he|she|his|her|him)\b/i.test(all), tag + ' voice words');
    assert.ok(/\bI\b/.test(t.body) && /read every|read each|read everything/.test(t.body), tag + ' reads every message');
    assert.ok(t.body.endsWith('\nDanyel OZ'), tag + ' signed');
    if (key === 'sync') assert.ok(t.body.includes('within 3 business days'), tag + ' quote promise');
    const m = JSON.parse(JSON.stringify(G('ibCompose_')(key, i + 1, 'Ana')));
    assert.ok(m.body.startsWith('Hi Ana,\n\n') && m.body.endsWith('\n\n' + FOOTER), tag + ' greeting and footer');
    assert.ok(G('ibCompose_')(key, i + 1, '').body.startsWith('Hi,\n\n'), tag + ' nameless greeting');
  });
}
assert.strictEqual((SRC.match(/MailApp\.sendEmail/g) || []).length, 1, 'one send site');
assert.ok(!/GmailApp|DriveApp/.test(SRC), 'no Gmail or Drive');
eq([...new Set(SRC.match(/\.(getDefaultCalendar|createEvent|getEventsForDay|setTag|getTag|setVisibility|[a-zA-Z]+)\(/g)
  .filter(s => /Calendar|Event|Tag|Visibility|Guest|Invite|Location/.test(s)))].sort(),
  ['.createEvent(', '.getDefaultCalendar(', '.getEventsForDay(', '.getTag(', '.setTag(', '.setVisibility('], 'calendar calls');

/* ---------- first name filter (IR-02) ---------- */
const fn = s => G('ibFirstName_')(s);
eq([fn('Ana'), fn('Ana Maria'), fn('José-Luis'), fn("O'Neil"), fn('‮Ana'), fn('José')], ['Ana', 'Ana', 'José-Luis', "O'Neil", 'Ana', 'José']);
eq(['evil.example', 'Win$', 'a@b', 'http://x', 'Ana123', 'A'.repeat(25), '', '  ', '-Ana'].map(fn), Array(9).fill(''), 'rejected names');

/* ---------- address key and skip list (IR-01a/b) ---------- */
const ak = s => G('ibAddrKey_')(s);
eq([ak('v1+a@gmail.com'), ak('V.1@googlemail.com'), ak('v1@gmail.com'), ak('A.B+x@Other.io')], ['v1@gmail.com', 'v1@gmail.com', 'v1@gmail.com', 'a.b@other.io']);
const sk = s => G('ibSkipAddr_')(s);
eq(['daniel.vizkaino@gmail.com', 'Daniel.Vizkaino+x@googlemail.com', 'x@danyeloz.info', 'a@mail.danyeloz.com', 'noreply@x.io', 'no-reply@x.io',
  'mailer-daemon@x.io', 'bounces+1@x.io', 'postmaster@x.io', 'abuse@x.io', 'donotreply@x.io'].map(sk), Array(11).fill(true));
eq(['ana@example.com', 'bouncy@x.io'].map(sk), [false, false]);

/* ---------- owner check (IR-08) ---------- */
const PUBLIC = [...SRC.matchAll(/^function ([A-Za-z]+)\(/gm)].map(m => m[1]);
eq(PUBLIC.sort(), ['deleteOldRows', 'getInboxData', 'ibAutoReplyTick', 'ibDailyDigest', 'installInboxTriggers', 'previewOldRows',
  'removeInboxTriggers', 'sendAutoReplyTest', 'setAutoReply', 'setDigest', 'setInboxStatus'], 'public functions');
for (const [who, eff] of [['x@gmail.com', 'owner.account@gmail.com'], ['', 'owner.account@gmail.com'], ['helper@gmail.com', 'helper@gmail.com']]) {
  const { c } = reset([{}]); effective = eff;   // stranger, blank, helper mode (Execute as user accessing)
  props.IB_AUTO_REPLY = 'off';
  triggers.push({ getHandlerFunction: () => 'ibAutoReplyTick' });
  user = who;
  const before = JSON.stringify([props, c.data, triggers.length]);
  const args = { setInboxStatus: ['contact', 2, 'k', 'Done'], deleteOldRows: [new FDate().toISOString(), 1], setAutoReply: [true], setDigest: [true],
    sendAutoReplyTest: ['contact', 1] };
  PUBLIC.filter(n => !/^ib/.test(n)).forEach(n => assert.throws(() => ctx[n](...(args[n] || [])), /Not allowed/, n + ' as ' + JSON.stringify(who)));
  eq(JSON.stringify([props, c.data, triggers.length]), before, 'nothing written by a stranger');
  eq(mails.length, 0, 'no mail by a stranger');
}
for (const [o, u] of [['', ''], ['', 'x@x.io'], [null, 'x@x.io'], [undefined, 'owner.account@gmail.com']]) {   // blank or unknown owner: refused
  reset([{}]); user = u; owner = o === undefined ? 'owner.account@gmail.com' : o; ownerFails = o === undefined;
  assert.throws(() => ctx.getInboxData(), /Not allowed/, 'owner ' + JSON.stringify(o) + ' user ' + JSON.stringify(u));
}
owner = 'owner.account@gmail.com';
reset([]); user = 'OWNER.Account@gmail.com'; eq(Object.keys(ctx.getInboxData()).length, 6, 'owner (not FS_NOTIFY, any case) allowed');
eq(ctx.installInboxTriggers(), { autoReply: 1, digest: 1 }, 'owner may install');
reset([{}]); user = 'daniel.vizkaino@gmail.com'; assert.throws(() => ctx.setAutoReply(true), /Not allowed/, 'FS_NOTIFY is not the owner here');
/* NF-02: handlers act only on an event of their own installed trigger */
for (const ev of [undefined, {}, { triggerUid: '' }, { triggerUid: 'guess' }]) {
  reset([{}]); props.IB_DIGEST = 'on'; mkTrigger('ibAutoReplyTick', {}); mkTrigger('ibDailyDigest', {});
  ctx.ibAutoReplyTick(ev); ctx.ibDailyDigest(ev); eq([mails.length, events.length], [0, 0], 'no trigger event ' + JSON.stringify(ev));
  eq(logs, ['ibAutoReplyTick: not called by its trigger, nothing done', 'ibDailyDigest: not called by its trigger, nothing done'], 'fixed log lines');
}
reset([{}]); props.IB_DIGEST = 'on';
const tDig = mkTrigger('ibDailyDigest', {}), tTick = mkTrigger('ibAutoReplyTick', {});
ctx.ibAutoReplyTick({ triggerUid: tDig.getUniqueId() }); ctx.ibDailyDigest({ triggerUid: tTick.getUniqueId() });
eq([mails.length, events.length], [0, 0], 'uid of the other handler refused');
ctx.ibAutoReplyTick({ triggerUid: tTick.getUniqueId() }); eq(sent().length, 1, 'real tick trigger runs');
ctx.ibDailyDigest({ triggerUid: tDig.getUniqueId() }); eq(events.length, 1, 'real digest trigger runs');
reset([{}]); user = 'x@gmail.com'; effective = 'x@gmail.com'; ctx.ibAutoReplyTick(); eq(mails.length, 0, 'page call by a helper does nothing');

/* ---------- switch, since, age window (IR-01e, IR-08) ---------- */
let sh = reset([{ ts: ago(30 * MIN) }]);
props.IB_AUTO_REPLY = 'off'; fire('ibAutoReplyTick'); eq(mails.length, 0, 'switch off');
delete props.IB_AR_ON_SINCE; props.IB_AUTO_REPLY = 'on'; tick(); eq(mails.length, 0, 'no on-since');
props.IB_AUTO_REPLY = 'off'; eq(ctx.setAutoReply(true).autoReply, true); eq(props.IB_AR_ON_SINCE, String(NOW), 'on-since set at switch on');
NOW += 1000; ctx.setAutoReply(true); eq(props.IB_AR_ON_SINCE, String(NOW - 1000), 'already on keeps on-since'); NOW -= 1000;
tick(); eq(mails.length, 0, 'row before switch-on');
eq(ctx.setAutoReply(false).autoReply, false); eq(props.IB_AUTO_REPLY, 'off');
for (const [age, want] of [[19 * MIN, 0], [21 * MIN, 1], [71 * H, 1], [73 * H, 0]]) {
  reset([{ ts: ago(age) }]); tick(); eq(sent().length, want, 'age ' + age / MIN + ' min');
}

/* ---------- one send, recorded, plain message (IR-02, IR-03, IR-14, IR-16, IR-17) ---------- */
const MARK = { first: 'Ana', last: 'MARKlast', email: 'markmail@example.com', subject: 'MARKsubject', message: 'MARKmessage body' };
sh = reset([MARK], [{ name: 'Ben MARKname', email: 'markben@studio.io', company: 'MARKcompany', songs: 'MARKsongs', project: 'MARKproject', ts: ago(25 * MIN) }]);
eq(tick(), 'sent 2');
eq(sent().map(x => Object.keys(x.m).sort()), [['body', 'name', 'replyTo', 'subject', 'to'], ['body', 'name', 'replyTo', 'subject', 'to']], 'message keys');
sent().forEach(x => {
  eq([x.m.name, x.m.replyTo, x.lockHeld], ['Danyel OZ', 'daniel.vizkaino@gmail.com', false], 'sender, reply-to, lock free while sending');
  assert.ok(!/MARK/.test(x.m.subject + x.m.body), 'nothing from the row in the mail');
  assert.ok(x.m.body.endsWith(FOOTER));
});
eq(to().sort(), ['markben@studio.io', 'markmail@example.com']);
assert.ok(sent().some(x => x.m.body.startsWith('Hi Ana,')) && sent().some(x => x.m.body.startsWith('Hi Ben,')), 'first names');
assert.ok(!logs.join('\n').match(/MARK|mark|@/i), 'no PII in logs: ' + logs.join(' | '));
eq(sh.c.data[0].slice(-2), ['Message', 'auto_reply_at'], 'column added after the last form column, by name');
assert.ok(/^2026-11-21T02:00:00\.000Z #[1-5]$/.test(sh.c.data[1][autoCol(sh.c)]), 'recorded time and template: ' + sh.c.data[1][autoCol(sh.c)]);
eq(props['IB_AR_COUNT_2026-11-21'], '2', 'daily count');
mails = []; tick(); eq(mails.length, 0, 'never twice');
sh.c.data[1][1] = 'evil.example win a prize'; sh.c.data[1][autoCol(sh.c)] = ''; sh.c.data[1][3] = 'other@example.com';
tick(); assert.ok(sent()[0].m.body.startsWith('Hi,\n'), 'hostile first name -> Hi,');
// IR-17: fsOnFormSubmit over a range that spans the two empty Inbox columns adds no "Other answer"
sh = reset([{}]); vm.runInContext('ibWrite_(ibTabs_(ibInbox_(PropertiesService.getScriptProperties(), true), PropertiesService.getScriptProperties())[0], 2, "status", "")', ctx);
sh.c.data[0].push('auto_reply_at'); sh.c.data[1].push(''); mails = [];
const vals = sh.c.data[1].slice();
ctx.fsOnFormSubmit({ range: { getSheet: () => sh.c, getColumn: () => 1, getValues: () => [vals], getFormulas: () => [vals.map(() => '')], getCell: () => ({ setValue() {} }) } });
eq(mails.length, 1, 'alert sent'); assert.ok(!/Other answer/.test(mails[0].m.body), 'no Other answer for status/auto_reply_at');

/* ---------- aliases, skip list, repeats (IR-01a/b) ---------- */
reset([{ email: 'v1+a@gmail.com' }, { email: 'V.1@googlemail.com' }, { email: 'v1@gmail.com' }]);
tick(); tick(); tick(); eq(sent().length, 1, 'one send per address key');
NOW += 29 * DAY; reset([{ email: 'v1@gmail.com', ts: ago(30 * MIN) }]);
books.INBOX_ID.sheets[1].data.push(sRow({ email: 'v.1+z@gmail.com', ts: ago(29 * DAY) }).slice(0, 12).concat([]));
books.INBOX_ID.sheets[1].data[0].push('auto_reply_at'); books.INBOX_ID.sheets[1].data[1][12] = new Date(NOW - 29 * DAY).toISOString() + ' #2';
tick(); eq(sent().length, 0, '30-day rule across both tabs');
books.INBOX_ID.sheets[1].data[1][12] = new Date(NOW - 31 * DAY).toISOString() + ' #2'; tick(); eq(sent().length, 1, 'after 30 days');
NOW -= 29 * DAY;
reset([{ email: 'daniel.vizkaino@gmail.com' }, { email: 'x@danyeloz.info' }, { email: 'noreply@x.io' }]); tick(); eq(mails.length, 0, 'skip list');
reset([{ email: 'r@x.io', ts: ago(30 * MIN) }, { email: 'r+a@x.io', ts: ago(2 * H) }, { email: 'r+b@x.io', ts: ago(3 * H) }, { email: 'R@x.io', ts: ago(4 * H) }]);
tick(); eq(mails.length, 0, 'address seen in more than 3 rows in 24 h');
reset([{ status: 1 }]); books.INBOX_ID.sheets[0].data[0].push('status'); books.INBOX_ID.sheets[0].data[1].push('Done'); tick(); eq(mails.length, 0, 'already Done');

/* ---------- burst breaker, per-run and daily caps, quota floor (IR-01c/d, IR-04) ---------- */
reset(Array.from({ length: 11 }, (_, i) => ({ email: 'b' + i + '@x.io', ts: ago((25 + i * 3) * MIN) })));
eq(tick(), 'burst'); eq(sent().length, 0, 'burst: no replies');
eq(mails.map(x => [x.m.to, x.m.name]), [['daniel.vizkaino@gmail.com', 'Danyel OZ website']], 'one notice through fsSendCapped_');
assert.ok(props['IB_AR_PAUSED_2026-11-21']); eq(props['FS_MAIL_COUNT_2026-11-21'], '1', 'notice counts in the 40');
eq(tick(), 'paused'); eq(mails.length, 1, 'no second notice');
eq(ctx.getInboxData().settings.paused, true);
const twelve = Array.from({ length: 12 }, (_, i) => ({ email: 'p' + i + '@x.io', ts: ago((25 + i * 6) * MIN) }));
reset(twelve); tick(); eq(sent().length, 5, 'per run 5'); tick(); eq(sent().length, 10); tick(); eq(sent().length, 12);
reset(twelve); props['IB_AR_COUNT_2026-11-21'] = '29'; props['IB_AR_COUNT_2026-11-20'] = '9';
tick(); eq(sent().length, 1, '30th of the day'); tick(); eq(sent().length, 1, '31st refused');
assert.ok(!('IB_AR_COUNT_2026-11-20' in props), 'old count key removed');
reset([{}]); quota = () => 46; tick(); eq(sent().length, 1, 'quota 46 sends');
reset([{}]); quota = () => 45; tick(); eq(sent().length, 0, 'quota 45'); assert.ok(logs.some(l => /quota floor/.test(l)));
reset([{ email: 'q1@x.io' }, { email: 'q2@x.io' }, { email: 'q3@x.io' }]); let qs = [47, 47, 45, 45]; quota = () => qs.length > 1 ? qs.shift() : qs[0];
sh = { c: books.INBOX_ID.sheets[0] }; tick(); eq(sent().length, 1, 'stops when the floor is reached mid-run');
eq(props['IB_AR_COUNT_2026-11-21'], '1', 'unsent claims given back');
eq(sh.c.data.slice(1).map(r => r[autoCol(sh.c)] === '' ? 'empty' : 'set').sort(), ['empty', 'empty', 'set'], 'unsent rows released');

/* ---------- invalid rows and guards (IR-07) ---------- */
const BAD = [{ topic: 'Fan Contact\nX' }, { message: 'x'.repeat(4001) }, { email: 'a@b.co?cc=x@evil.io' }, { email: '"a"@b.co' }, { first: '' }];
reset(BAD); tick(); eq(mails.length, 0, 'invalid rows');
reset([], [], [makeSheet(null, CONTACT_HEADS, [cRow({})])]); tick(); eq(mails.length, 0, 'tab without a form');
reset([{}]); props.FS_INBOX_SHEET_ID = 'SONGDB_ID'; books.SONGDB_ID = books.INBOX_ID; fire('ibAutoReplyTick'); eq(mails.length, 0, 'inbox == Song DB');
assert.ok(logs.includes('ibAutoReplyTick: could not finish'));
reset([{}]); delete props.FS_SONG_DB_ID; fire('ibAutoReplyTick'); eq(mails.length, 0, 'Song DB id missing');
reset([]); const re = books.INBOX_ID.sheets[0];
re.data = [['Email', 'Message', 'Timestamp', 'Subject', 'What would you like to contact me about?', 'Last name', 'First name'],
  ['moved@x.io', 'hi', ago(30 * MIN), 'Sub', 'Fan Contact', 'L', 'Mo']];
tick(); eq([to(), sent()[0].m.body.slice(0, 7)], [['moved@x.io'], 'Hi Mo,\n'], 'columns found by header name');

/* ---------- claim, send outside the lock, at most once (IR-03) ---------- */
reset([{ email: 'i1@x.io' }, { email: 'i2@x.io' }, { email: 'i3@x.io' }]);
let inner = null; onSend = () => { inner = G('ibAutoReplyRun_(new Date())'); };
tick(); eq([sent().length, inner], [3, 'none'], 'overlapping run sends nothing more');
assert.ok(mails.every(x => !x.lockHeld), 'lock free during sends');
sh = reset([{ email: 'f1@x.io' }, { email: 'f2@x.io' }, { email: 'f3@x.io' }]);
sendFail = m => m.to === 'f2@x.io'; tick();
const f2 = sh.c.data.find(r => r[3] === 'f2@x.io'); assert.ok(/^sending /.test(f2[autoCol(sh.c)]), 'failed send stays "sending"');
sendFail = null; mails = []; tick(); eq(mails.length, 0, 'never resent');
reset([{}]); lockFail = true; assert.doesNotThrow(() => fire('ibAutoReplyTick')); eq(mails.length, 0, 'tryLock false'); assert.ok(logs.includes('ibAutoReplyTick: busy'));

/* ---------- screen data, status, row identity (C-1, IR-10) ---------- */
sh = reset([{ ts: ago(2 * H), first: 'Ana' }, { ts: ago(1 * H), first: 'Cy', subject: '<img src=x onerror=1>‮' }], [{ ts: ago(3 * H) }]);
sh.c.data.push(['', '', '', '', '', '', '']);
let d = JSON.parse(JSON.stringify(ctx.getInboxData()));
eq(Object.keys(d), ['items', 'counts', 'oldCount', 'settings', 'templates', 'triggers']);
eq(Object.keys(d.items[0]), ['type', 'row', 'rowKey', 'date', 'firstName', 'name', 'email', 'emailOk', 'topic', 'subject', 'songs', 'company',
  'project', 'media', 'territory', 'term', 'timeline', 'budget', 'message', 'notes', 'status', 'autoReplyAt', 'autoReplyTemplate']);
eq(d.items.map(i => [i.type, i.firstName, i.status]), [['contact', 'Cy', 'New'], ['contact', 'Ana', 'New'], ['sync', 'Ben', 'New']], 'newest first, blank row skipped');
eq(d.items[0].subject, '<img src=x onerror=1>', 'plain string, bidi stripped');
eq([d.counts.total, d.counts.contact, d.counts.sync, d.counts.New], [3, 2, 1, 3]);
eq([d.templates.contact.length, d.templates.sync.length, d.settings, d.triggers],
  [5, 5, { autoReply: true, digest: false, capPerDay: 30, sentToday: 0, paused: false }, { autoReply: 0, digest: 0 }]);
assert.ok(d.templates.sync[0].body.startsWith('Hi <first name>,'));
const ana = d.items[1];
eq(ctx.setInboxStatus('contact', ana.row, ana.rowKey, 'Done').status, 'Done');
eq(sh.c.data[ana.row - 1][sh.c.data[0].indexOf('status')], 'Done');
assert.throws(() => ctx.setInboxStatus('contact', ana.row, ana.rowKey, '=HYPERLINK("x")'), /Unknown status/);
assert.throws(() => ctx.setInboxStatus('contact; x', ana.row, ana.rowKey, 'Done'), /Unknown form/);
const cy = d.items[0]; sh.c.data.splice(1, 1);                              // row 2 deleted in the sheet; Cy moves up
assert.throws(() => ctx.setInboxStatus('contact', cy.row, cy.rowKey, 'Replied'), /List changed, reload/);
eq(ctx.setInboxStatus('contact', 2, cy.rowKey, 'Replied').status, 'Replied');
d = ctx.getInboxData(); eq(d.items.find(i => i.firstName === 'Cy').status, 'Replied');
reset([{ email: 'mail@x.io' }]); tick(); d = ctx.getInboxData();
assert.ok(d.items[0].autoReplyAt === '2026-11-21T02:00:00.000Z' && d.items[0].autoReplyTemplate >= 1 && d.items[0].autoReplyTemplate <= 5);
eq(d.settings.sentToday, 1);

/* ---------- retention (C-2, IR-09) ---------- */
sh = reset([{ ts: ago(366 * DAY), email: 'old@x.io' }, { ts: ago(364 * DAY) }, { ts: '' }, { ts: 'abc' }]);
let pv = ctx.previewOldRows(); eq(pv.count, 1);
assert.throws(() => ctx.deleteOldRows(pv.token, 2), /changed/); eq(sh.c.data.length, 5, 'count mismatch deletes nothing');
assert.throws(() => ctx.deleteOldRows('2026-01-01', 1), /Check the old messages again/);
NOW += 16 * MIN; assert.throws(() => ctx.deleteOldRows(pv.token, 1), /Check the old messages again/, 'stale token'); NOW -= 16 * MIN;
eq(ctx.deleteOldRows(pv.token, 1).deleted, 1);
eq([sh.c.data[0][0], sh.c.data.length, sh.c.data.some(r => r[3] === 'old@x.io')], ['Timestamp', 4, false], 'only the 366-day row');
sh = reset([{ ts: ago(366 * DAY) }, { ts: ago(367 * DAY) }, { ts: ago(368 * DAY) }, { ts: ago(365 * DAY - 2 * MIN) }]);
pv = ctx.previewOldRows(); eq(pv.count, 3); NOW += 5 * MIN;
assert.throws(() => ctx.deleteOldRows(pv.token, 3), /changed/, 'a 4th row aged in'); eq(sh.c.data.length, 5);
sh = reset([{ ts: ago(400 * DAY) }]); props.FS_INBOX_SHEET_ID = 'SONGDB_ID'; books.SONGDB_ID = books.INBOX_ID;
assert.throws(() => ctx.previewOldRows(), /Song Database/); assert.throws(() => ctx.deleteOldRows(new FDate().toISOString(), 1), /Song Database/);
eq(sh.c.data.length, 2, 'Song DB guard deletes nothing');

/* ---------- daily digest (C-4, IR-11, IR-12) ---------- */
NOW = Date.parse('2026-11-21T01:05:00.000Z');
sh = reset([{ ts: ago(2 * DAY), first: 'Ana', last: 'MARKlast', email: 'ana@mark.io', subject: 'MARKsubj', message: 'MARKmsg http://x' },
  { ts: ago(3 * H), first: 'evil.example' }, { ts: ago(DAY), first: 'Done' }],
  [{ ts: ago(5 * DAY), name: 'Ben', company: 'MARKco', songs: 'MARKsong', project: 'MARKproj' }]);
sh.c.data[0].push('status'); sh.c.data[3].push('Done');
songs = [{ song_title: 'Next Song', release_date: '2026-11-25' }, { song_title: 'Far Song', release_date: '2026-12-05' },
  { song_title: 'Past Song', release_date: '2026-11-20' }, { song_title: 'No Date', release_date: '' }];
props.IB_DIGEST = 'off'; fire('ibDailyDigest'); eq(events.length, 0, 'digest switch off');
eq(ctx.setDigest(true).digest, true);
eq(G('ibDigestRun_(new Date())'), 'created'); eq(G('ibDigestRun_(new Date())'), 'done'); eq(events.length, 1, 'one event a day');
const ev = events[0];
eq([ev.title, ev.start.toISOString(), ev.end.toISOString(), Object.keys(ev.opts), ev.vis, ev.tags.ibDigest],
  ['To-do: 3 messages, 1 release', '2026-11-21T01:00:00.000Z', '2026-11-21T01:15:00.000Z', ['description'], 'PRIVATE', '2026-11-21'],
  'event: 09:00-09:15 Manila, description only, private, tagged');
const desc = ev.opts.description;
assert.ok(!/@|http|MARK/.test(desc), 'no address, link or row text: ' + desc);
eq(desc.split('\n').filter(l => l.startsWith('- ')),
  ['- Sync request, Ben, 5 days old', '- Contact, Ana, Fan Contact, 2 days old', '- Contact, no name, Fan Contact, today', '- Next Song, 2026-11-25']);
delete props['IB_DIGEST_DONE_2026-11-21']; eq(G('ibDigestRun_(new Date())'), 'done', 'tagged event already there');
eq(events.length, 1);
NOW += DAY; events = []; sh = reset([], []); props.IB_DIGEST = 'on'; props['IB_DIGEST_DONE_2026-11-21'] = '1'; eq(G('ibDigestRun_(new Date())'), 'empty'); eq(events.length, 0, 'nothing open');
assert.ok(!Object.keys(props).some(k => k.startsWith('IB_DIGEST_DONE_2026-11-21')), 'old digest key removed');
reset(Array.from({ length: 25 }, (_, i) => ({ ts: ago((i + 1) * H), email: 'n' + i + '@x.io' }))); props.IB_DIGEST = 'on';
G('ibDigestRun_(new Date())');
eq([events[0].title, events[0].opts.description.split('\n').filter(l => l.startsWith('- ')).length, events[0].opts.description.includes('\n+5 more\n')],
  ['To-do: 25 messages', 20, true], '20 lines then +5 more');
reset([]); props.IB_DIGEST = 'on'; lockFail = true; assert.doesNotThrow(() => fire('ibDailyDigest')); eq(events.length, 0, 'digest busy');

/* ---------- triggers (C-5, IR-13) ---------- */
reset([]);
const other = [mkTrigger('fsOnFormSubmit', {}), mkTrigger('tiktokTick', {}), mkTrigger('ibAutoReplyTick', {}), mkTrigger('ibDailyDigest', {})];
eq(ctx.installInboxTriggers(), { autoReply: 1, digest: 1 }); eq(ctx.installInboxTriggers(), { autoReply: 1, digest: 1 }, 'idempotent');
eq(triggers.map(t => [t.fn, t.cfg]), [['fsOnFormSubmit', {}], ['tiktokTick', {}], ['ibAutoReplyTick', { everyMinutes: 10 }],
  ['ibDailyDigest', { atHour: 9, everyDays: 1, tz: 'Asia/Manila' }]]);
eq(ctx.removeInboxTriggers(), { autoReply: 0, digest: 0 }); eq(triggers.map(t => t.fn), ['fsOnFormSubmit', 'tiktokTick'], 'others untouched');
assert.ok(other.length === 4);

/* ---------- test send (C-3, IR-04, IR-08) ---------- */
reset([]); props.IB_AUTO_REPLY = 'off';
eq(ctx.sendAutoReplyTest('sync', 2, 'evil@x.io').to, 'daniel.vizkaino@gmail.com');
eq([mails[0].m.to, mails[0].m.subject, mails[0].m.body.slice(0, 10)], ['daniel.vizkaino@gmail.com', 'Test: Thanks for your sync request', 'Hi Daniel,']);
for (let i = 0; i < 4; i++) ctx.sendAutoReplyTest('contact', 1 + i);
assert.throws(() => ctx.sendAutoReplyTest('contact', 1), /Test limit/); eq(mails.length, 5, '6th test refused');
reset([]); quota = () => 45; assert.throws(() => ctx.sendAutoReplyTest('contact', 1), /quota/); eq(mails.length, 0);
reset([]); assert.throws(() => ctx.sendAutoReplyTest('contact', 6), /Unknown template/); assert.throws(() => ctx.sendAutoReplyTest('x', 1), /Unknown form/);

/* ---------- no name clashes across the Apps Script project ---------- */
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.gs')).map(f => path.join(DIR, f))
  .concat(fs.existsSync('tools') ? fs.readdirSync('tools').filter(f => f.endsWith('.gs')).map(f => path.join('tools', f)) : []);
const seen = {};
files.forEach(f => [...fs.readFileSync(f, 'utf8').matchAll(/^(?:function|const|let|var)\s+([A-Za-z0-9_$]+)/gm)].forEach(m => {
  (seen[m[1]] = seen[m[1]] || []).push(path.basename(f));
}));
const mine = [...SRC.matchAll(/^(?:function|const)\s+([A-Za-z0-9_$]+)/gm)].map(m => m[1]);
eq(mine.filter(n => seen[n].length > 1).map(n => n + ' in ' + seen[n].join(',')), [], 'Inbox.gs names unique in the project');
assert.ok(mine.every(n => /^(ib|IB_)/.test(n) || PUBLIC.includes(n)), 'prefix ib / IB_');
const all = vm.createContext({});
assert.doesNotThrow(() => files.forEach(f => vm.runInContext(fs.readFileSync(f, 'utf8'), all, { filename: f })), 'all .gs files load together');

console.log('test_inbox: all checks passed (' + files.length + ' .gs files checked for clashes)');
