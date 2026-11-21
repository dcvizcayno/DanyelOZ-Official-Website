// QA T-009 independent probe of apps-script/FormsSetup.gs (own mocks, no reuse of tests/unit).
const fs = require('fs'), vm = require('vm'), path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '../../../apps-script/FormsSetup.gs'), 'utf8');
const AP = String.fromCharCode(39);
let fails = 0; const out = [];
function check(name, ok, info) { out.push((ok ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? ' :: ' + JSON.stringify(info) : '')); if (!ok) fails++; }

function world() {
  const W = { props: {}, logs: [], mails: [], triggers: [], forms: {}, books: {}, quota: 100, created: { forms: 0, books: 0, items: 0, triggers: 0 }, setDest: [] };
  let nid = 1;
  const ACTIVE = 'SONGDB_ACTIVE_ID_000';
  W.books[ACTIVE] = { getId: () => ACTIVE };
  function mkItem(type) {
    const it = { id: 5000 + nid++, type, title: '', req: false, help: '', choices: [], other: false };
    const api = {
      getId: () => it.id, getType: () => it.type, getTitle: () => it.title, setTitle: t => { it.title = t; return api; },
      isRequired: () => it.req, setRequired: r => { it.req = r; return api; }, getHelpText: () => it.help, setHelpText: h => { it.help = h; return api; },
      getChoices: () => it.choices.map(v => ({ getValue: () => v })), setChoiceValues: c => { it.choices = c.slice(); return api; },
      hasOtherOption: () => it.other, showOtherOption: b => { it.other = b; return api; },
      createResponse: v => ({ itemId: it.id, v }),
    };
    api.asTextItem = api.asParagraphTextItem = api.asMultipleChoiceItem = () => api;
    return api;
  }
  function mkForm(title) {
    const id = 'FORMID' + String(nid++).padStart(12, '0');
    const f = { id, title, items: [], dest: '', s: { ce: true, edit: true, one: true, sum: true, again: true, acc: false, conf: '' } };
    const add = type => () => { const i = mkItem(type); f.items.push(i); W.created.items++; return i; };
    const api = {
      getId: () => id, getTitle: () => f.title, getItems: () => f.items.slice(),
      getItemById: x => f.items.find(i => String(i.getId()) === String(x)) || null,
      addTextItem: add('TEXT'), addParagraphTextItem: add('PARAGRAPH_TEXT'), addMultipleChoiceItem: add('MULTIPLE_CHOICE'),
      getDestinationId: () => { if (!f.dest) throw new Error('no dest'); return f.dest; },
      setDestination: (t, d) => { W.setDest.push([id, d]); f.dest = d; return api; },
      collectsEmail: () => f.s.ce, setCollectEmail: b => { f.s.ce = b; }, canEditResponse: () => f.s.edit, setAllowResponseEdits: b => { f.s.edit = b; },
      hasLimitOneResponsePerUser: () => f.s.one, setLimitOneResponsePerUser: b => { f.s.one = b; },
      isPublishingSummary: () => f.s.sum, setPublishingSummary: b => { f.s.sum = b; },
      hasRespondAgainLink: () => f.s.again, setShowLinkToRespondAgain: b => { f.s.again = b; },
      isAcceptingResponses: () => f.s.acc, setAcceptingResponses: b => { f.s.acc = b; },
      getConfirmationMessage: () => f.s.conf, setConfirmationMessage: m => { f.s.conf = m; },
      getPublishedUrl: () => 'https://docs.google.com/forms/d/e/1FAIpQLS' + id + 'PUB/viewform',
      createResponse: () => ({ withItemResponse: r => ({ toPrefilledUrl: () => 'https://docs.google.com/forms/d/e/x/viewform?usp=pp_url&entry.' + (900000 + r.itemId) + '=' + encodeURIComponent(r.v) }) }),
      _f: f,
    };
    W.forms[id] = api; W.created.forms++;
    return api;
  }
  const props = {
    getProperty: k => (k in W.props ? W.props[k] : null), setProperty: (k, v) => { W.props[k] = String(v); },
    getKeys: () => Object.keys(W.props), deleteProperty: k => { delete W.props[k]; },
  };
  const ctx = {
    Logger: { log: m => W.logs.push(String(m)) }, console: { log: m => W.logs.push('CONSOLE ' + m), error: m => W.logs.push('CONSOLE ' + m) },
    PropertiesService: { getScriptProperties: () => props },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => W.books[ACTIVE],
      openById: id => { if (!W.books[id]) throw new Error('nf'); return W.books[id]; },
      create: name => { const id = 'INBOX' + nid++; W.created.books++; W.books[id] = { name, getId: () => id, getUrl: () => 'https://sheet/' + id, getEditors: () => [], getViewers: () => [] }; return W.books[id]; },
    },
    FormApp: {
      DestinationType: { SPREADSHEET: 'SPREADSHEET' }, ItemType: { TEXT: 'TEXT', PARAGRAPH_TEXT: 'PARAGRAPH_TEXT', MULTIPLE_CHOICE: 'MULTIPLE_CHOICE' },
      create: t => mkForm(t), openById: id => { if (!W.forms[id]) throw new Error('nf'); return W.forms[id]; },
      openByUrl: u => { const m = /\/d\/([^/]+)/.exec(u); return ctx.FormApp.openById(m[1]); },
    },
    ScriptApp: {
      getProjectTriggers: () => W.triggers.slice(), deleteTrigger: t => { W.triggers = W.triggers.filter(x => x !== t); },
      newTrigger: h => ({ forSpreadsheet: s => ({ onFormSubmit: () => ({ create: () => { W.created.triggers++; const t = { getHandlerFunction: () => h, getTriggerSourceId: () => s }; W.triggers.push(t); return t; } }) }) }),
    },
    MailApp: { getRemainingDailyQuota: () => W.quota, sendEmail: m => { W.mails.push(m); } },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    Utilities: { formatDate: (d, tz, f) => f === 'yyyy-MM-dd' ? '2026-11-21' : '2026-11-21 20:00' },
  };
  vm.createContext(ctx); vm.runInContext(SRC, ctx);
  W.ctx = ctx; W.ACTIVE = ACTIVE;
  W.run = code => vm.runInContext(code, ctx);
  return W;
}

const A = world();
const cfg1 = A.run('setupDanyelOzForms()');
check('first run: 2 forms', A.created.forms === 2, A.created);
check('first run: 1 inbox named Danyel OZ Inbox (private)', A.created.books === 1 && Object.values(A.books).some(b => b.name === 'Danyel OZ Inbox (private)'));
check('first run: FS_SONG_DB_ID stored = container (FI-1)', A.props.FS_SONG_DB_ID === A.ACTIVE);
check('first run: 1 trigger on inbox, handler fsOnFormSubmit', A.triggers.length === 1 && A.triggers[0].getHandlerFunction() === 'fsOnFormSubmit' && A.triggers[0].getTriggerSourceId() === A.props.FS_INBOX_SHEET_ID);
check('first run: field counts 6 + 11, items 17', Object.keys(cfg1.forms.contact.fields).length === 6 && Object.keys(cfg1.forms.sync.fields).length === 11 && A.created.items === 17);
const actRe = /^https:\/\/docs\.google\.com\/forms\/d\/e\/[A-Za-z0-9_-]{20,120}\/formResponse$/;
check('first run: action URLs are formResponse', actRe.test(cfg1.forms.contact.action) && actRe.test(cfg1.forms.sync.action));
const allEntries = Object.values(cfg1.forms.contact.fields).concat(Object.values(cfg1.forms.sync.fields));
check('first run: entry ids entry.N unique', allEntries.every(e => /^entry\.\d{4,12}$/.test(e)) && new Set(allEntries).size === 17);
const bi = A.logs.indexOf('FORMS_JSON_BEGIN'), ei = A.logs.indexOf('FORMS_JSON_END');
check('first run: JSON block between markers parses to config', bi >= 0 && ei === bi + 2 && JSON.stringify(JSON.parse(A.logs[bi + 1])) === JSON.stringify(cfg1));
const cf = A.forms[A.props.FS_CONTACT_FORM_ID]._f;
const AMP = String.fromCharCode(38), EQ = String.fromCharCode(61);
const topicWant = ['Fan Contact', 'Music Collaborations', 'Beat Licensing ' + AMP + ' Instrumentals', 'Sync ' + AMP + ' Licensing', 'Media ' + AMP + ' Business Inquiries', 'General Inquiries'];
check('contact: topic choices, Sync after Beat (D-3)', JSON.stringify(cf.items[3].getChoices().map(c => c.getValue())) === JSON.stringify(topicWant));
check('contact: all required, message help', cf.items.every(i => i.isRequired()) && cf.items[5].getHelpText() === 'Tell me how I can help.');
check('forms: no email collect, accepting, dest = inbox', Object.values(A.forms).every(f => !f._f.s.ce && f._f.s.acc && f._f.dest === A.props.FS_INBOX_SHEET_ID));
const before = JSON.stringify(A.created);
const cfg2 = A.run('setupDanyelOzForms()');
check('re-run: no new forms/items/inbox/trigger, same config', JSON.stringify(A.created) === before && A.triggers.length === 1 && JSON.stringify(cfg2) === JSON.stringify(cfg1), A.created);
cf.items[4].setTitle('Subj (renamed)');
const cfg3 = A.run('setupDanyelOzForms()');
check('re-run after rename: restored, same entry ids', cf.items[4].getTitle() === 'Subject' && JSON.stringify(cfg3) === JSON.stringify(cfg1) && JSON.stringify(A.created) === before);
const B = world(); B.props.FS_INBOX_SHEET_ID = B.ACTIVE;
let err = ''; try { B.run('setupDanyelOzForms()'); } catch (e) { err = e.message; }
check('guard: stored inbox = Song Database throws, no forms', /Song Database/.test(err) && B.created.forms === 0, err);
const C = world(); C.run('setupDanyelOzForms()');
C.forms[C.props.FS_SYNC_FORM_ID]._f.dest = C.ACTIVE; C.setDest.length = 0;
err = ''; try { C.run('setupDanyelOzForms()'); } catch (e) { err = e.message; }
check('guard: form linked to Song Database throws before any setDestination', /Song Database/.test(err) && C.setDest.length === 0, err);

function submitWorld(activeIsInbox) { const W = world(); W.run('setupDanyelOzForms()'); W.logs.length = 0;
  if (activeIsInbox) W.ctx.SpreadsheetApp.getActiveSpreadsheet = () => W.books[W.props.FS_INBOX_SHEET_ID]; return W; }
const HEAD = ['Timestamp', 'First name', 'Last name', 'Email', 'What would you like to contact me about?', 'Subject', 'Message'];
const SHEAD = ['Timestamp', 'Name', 'Email', 'Company or production', 'Song or songs', 'Project', 'Media type', 'Territory', 'Term', 'Timeline', 'Budget range', 'Notes'];
function event(W, row, formulas, formKey, bookOverride) {
  const inbox = bookOverride || W.books[W.props.FS_INBOX_SHEET_ID]; const writes = [];
  const fid = W.props[formKey === 'sync' ? 'FS_SYNC_FORM_ID' : 'FS_CONTACT_FORM_ID'];
  const head = formKey === 'sync' ? SHEAD : HEAD;
  const sheet = { getParent: () => inbox, getFormUrl: () => 'https://docs.google.com/forms/d/' + fid + '/edit', getRange: () => ({ getValues: () => [head] }) };
  const range = { getSheet: () => sheet, getColumn: () => 1, getValues: () => [row], getFormulas: () => [formulas || row.map(() => '')], getCell: (r, c) => ({ setValue: v => writes.push([c, v]) }) };
  W.ctx.__e = { range }; W.run('fsOnFormSubmit(__e)');
  return writes;
}
const OK = ['ts', 'A', 'B', 'a@b.co', 'Fan Contact', 'S', 'M'];
const SECRET = 'QA-SECRET-MARKER', HYP = EQ + 'HYPERLINK("http://evil","x")', IMX = EQ + 'IMPORTXML("x")';
for (const live of [false, true]) {
  const tag = live ? '[active=inbox] ' : '[active=container] ';
  let W = submitWorld(live);
  let writes = event(W, ['ts', 'Ana ' + SECRET, 'Ruiz', 'ana@example.com', 'Sync ' + AMP + ' Licensing', HYP, 'Hi\nFrom: fake@x.com\n+1 call me'], null);
  check(tag + 'formula text rewritten with apostrophe, plain text untouched', writes.length === 1 && writes[0][0] === 6 && writes[0][1] === AP + HYP, writes);
  let m = W.mails[0] || {};
  check(tag + 'one mail to daniel only, plain, Reply-To sender', W.mails.length === 1 && m.to === 'daniel.vizkaino@gmail.com' && !m.htmlBody && !m.cc && !m.bcc && !m.attachments && m.replyTo === 'ana@example.com', Object.keys(m));
  if (!live) {
    check('subject = prefix + topic | subject, one line', m.subject === 'Website message: Sync ' + AMP + ' Licensing | ' + HYP, m.subject);
    const lines = String(m.body).split('\n'); const sep = lines.indexOf('---- Message as sent (unverified) ----');
    check('body: heading, Sent, Reply-To set: yes, separator', lines[0] === 'New message from the Danyel OZ contact form' && /^Sent: /.test(lines[1]) && lines[2] === 'Reply-To set: yes' && sep > 0, lines.slice(0, 5));
    check('body: every visitor line quoted', lines.slice(sep + 1).every(l => l.startsWith('  | ')) && lines.includes('  |     From: fake@x.com'));
    check('body: no inbox link', !/INBOX|sheet\//.test(m.body));
    check('logs: no visitor values', !W.logs.some(l => l.includes(SECRET) || l.includes('ana@') || l.includes('HYPERLINK')), W.logs);
  }
  W = submitWorld(live);
  writes = event(W, OK, ['', '', '', '', '', IMX, '']);
  check(tag + 'real formula cell rewritten as text, mail sent', writes.some(w => w[0] === 6 && w[1] === AP + IMX) && W.mails.length === 1, writes);
}
let W = submitWorld(true); delete W.props.FS_SONG_DB_ID;
let writes = event(W, ['ts', 'A', 'B', 'a@b.co', 'Fan Contact', EQ + '1+1', 'M']);
check('FI-1 fail safe: FS_SONG_DB_ID missing -> no mail, cell still neutralized', W.mails.length === 0 && writes.length === 1 && W.logs.some(l => /Song Database id missing/.test(l)), W.logs);
W = submitWorld(false);
event(W, ['ts', 'Eve', 'X', 'eve@example.com\r\nBcc: victim@example.com', 'Fan Contact', 'S ' + SECRET, 'M']);
check('header-injection email (CRLF): no mail (D-8), nothing in logs', W.mails.length === 0 && !W.logs.some(l => l.includes('victim') || l.includes(SECRET)), W.logs);
W = submitWorld(false); event(W, ['ts', 'Eve', 'X', 'eve@example.com\nBcc: v@x.com', 'Fan Contact', 'S', 'M']);
check('header-injection email (LF): no mail', W.mails.length === 0);
W = submitWorld(false); event(W, ['ts', 'A', 'B', 'a@b.co', 'Fan Contact', 'Hello\r\nBcc: x@y.com', 'M']);
check('subject newline stripped', W.mails.length === 1 && !/[\r\n]/.test(W.mails[0].subject));
W = submitWorld(false); event(W, ['ts', 'A\u202E', 'B\u2066', 'a@b.co', 'Fan Contact', 'gpj.\u202Eexe', 'line\u202Dtwo\u200B']);
check('bidi/zero-width stripped from subject and body', W.mails.length === 1 && !/[\u202A-\u202E\u2066-\u2069\u200B]/.test(W.mails[0].subject + W.mails[0].body));
W = submitWorld(false); event(W, ['ts', 'A', 'B', 'a@b.co', 'Hacker topic', 'S', 'M']);
check('unknown topic: no mail', W.mails.length === 0);
W = submitWorld(false); W.props['FS_MAIL_COUNT_2026-11-20'] = '7'; W.props['FS_MAIL_COUNT_2026-11-21'] = '39';
event(W, OK); check('40th mail normal; yesterday counter removed', W.mails.length === 1 && /^Website message/.test(W.mails[0].subject) && !('FS_MAIL_COUNT_2026-11-20' in W.props));
event(W, OK); check('41st: one limit notice, no Reply-To', W.mails.length === 2 && /limit/.test(W.mails[1].subject) && !W.mails[1].replyTo, W.mails[1] && W.mails[1].subject);
event(W, OK); check('42nd: nothing', W.mails.length === 2);
W = submitWorld(false); W.quota = 4; event(W, OK);
check('quota 4 (<5): no mail, not counted', W.mails.length === 0 && !W.props['FS_MAIL_COUNT_2026-11-21']);
W.quota = 5; event(W, OK); check('quota 5: mail', W.mails.length === 1);
W = submitWorld(false);
event(W, ['ts', 'Sam', 's@studio.tv', 'Studio', 'Song A, Song B', 'Ep 3 montage', 'Film', 'Worldwide', '1 year', 'March', '', ''], null, 'sync');
check('sync reply: subject songs | company, budget (none)', W.mails.length === 1 && W.mails[0].subject === 'Sync license request: Song A, Song B | Studio' && /Budget range: \(none\)/.test(W.mails[0].body));
W = submitWorld(false); W.run('fsOnFormSubmit()'); W.run('fsOnFormSubmit({})');
check('no event / empty event: nothing', W.mails.length === 0);
W = submitWorld(false);
writes = event(W, [EQ + 'SUM(A1)', '+x', 'plain'], null, 'contact', W.books[W.ACTIVE]);
check('event whose range is in the Song Database: no mail', W.mails.length === 0);
check('event whose range is in the Song Database: no cell rewritten (defense in depth)', writes.length === 0, writes);
check('no console output', !W.logs.some(l => l.startsWith('CONSOLE')));
console.log(out.join('\n'));
console.log(fails ? 'PROBE FAILED: ' + fails : 'PROBE PASSED (' + out.length + ' checks)');
process.exitCode = fails ? 1 : 0;
