/* Danyel OZ admin: the website's own forms (Google Forms backend).
   setupDanyelOzForms()  Daniel runs it once from the editor (safe to run again: it reuses the stored forms, inbox and
                         trigger, and repairs any setting someone changed). It makes two Google Forms, "Danyel OZ contact"
                         and "Sync license request", links both to one private spreadsheet "Danyel OZ Inbox (private)"
                         (never the public Song Database), installs one submit trigger on that inbox and logs the JSON
                         for danyeloz-embeds/data/forms.json between FORMS_JSON_BEGIN and FORMS_JSON_END.
   fsOnFormSubmit(e)     runs on every new reply: rewrites formula-looking cells of the new row as text, checks every
                         answer again on the server, then emails daniel.vizkaino@gmail.com a plain-text summary
                         (at most FS_MAX_MAIL_PER_DAY a day). Answers are never written to the logs. */

const FS_NOTIFY = 'daniel.vizkaino@gmail.com';
const FS_INBOX_NAME = 'Danyel OZ Inbox (private)';
const FS_PROP_CONTACT = 'FS_CONTACT_FORM_ID';
const FS_PROP_SYNC = 'FS_SYNC_FORM_ID';
const FS_PROP_INBOX = 'FS_INBOX_SHEET_ID';
const FS_PROP_SONG_DB = 'FS_SONG_DB_ID';           // the container (Song Database) id, stored by setup for the trigger guard
const FS_PROP_ITEMS = 'FS_ITEMS_';                 // + form key: JSON {field key: item id}, for repair after a rename
const FS_MAIL_COUNT = 'FS_MAIL_COUNT_';            // + yyyy-MM-dd (Manila): emails sent that day
const FS_MAX_MAIL_PER_DAY = 40;
const FS_MIN_QUOTA = 5;                            // keep the last few MailApp sends for the rest of the project
const FS_TZ = 'Asia/Manila';
const FS_HANDLER = 'fsOnFormSubmit';
const FS_SENDER_NAME = 'Danyel OZ website';
const FS_CONFIRMATION = 'Thank you. Your message is sent.';
const FS_SEPARATOR = '---- Message as sent (unverified) ----';
const FS_QUOTE = '  | ';
const FS_SUBJECT_MAX = 150;
const FS_BODY_MAX = 10000;
const FS_OTHER_MAX = 2000;
const FS_EMAIL_MAX = 254;
const FS_EMAIL_RE = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;   // same as SY_EMAIL_RE and OZSync.EMAIL_RE (N-1)
const FS_ACTION_RE = /^https:\/\/docs\.google\.com\/forms\/d\/e\/[A-Za-z0-9_-]{20,120}\/formResponse$/;
const FS_ENTRY_RE = /[?&]entry\.(\d+)=/;
const FS_STRIP_RE = /[\u0000-\u0008\u000B-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2060-\u2069\uFEFF]/g;
const FS_FORMULA_RE = /^\s*[=+\-@]/;

/* The single field spec for setup and email. Same labels, choices, required flags and limits as OZForms.FIELDS. */
const FS_FORMS = {
  contact: {
    title: 'Danyel OZ contact', prop: FS_PROP_CONTACT, heading: 'New message from the Danyel OZ contact form',
    subject: { prefix: 'Website message: ', parts: ['topic', 'subject'] },
    fields: [
      { key: 'first_name', label: 'First name', type: 'text', required: true, max: 60 },
      { key: 'last_name', label: 'Last name', type: 'text', required: true, max: 60 },
      { key: 'email', label: 'Email', type: 'email', required: true, max: 254 },
      { key: 'topic', label: 'What would you like to contact me about?', type: 'choice', required: true,
        choices: ['Fan Contact', 'Music Collaborations', 'Beat Licensing & Instrumentals', 'Sync & Licensing',
          'Media & Business Inquiries', 'General Inquiries'] },
      { key: 'subject', label: 'Subject', type: 'text', required: true, max: 120 },
      { key: 'message', label: 'Message', type: 'long', required: true, max: 4000, help: 'Tell me how I can help.' }
    ]
  },
  sync: {
    title: 'Sync license request', prop: FS_PROP_SYNC, heading: 'New sync license request',
    subject: { prefix: 'Sync license request: ', parts: ['songs', 'company'] },
    fields: [
      { key: 'name', label: 'Name', type: 'text', required: true, max: 120 },
      { key: 'email', label: 'Email', type: 'email', required: true, max: 254 },
      { key: 'company', label: 'Company or production', type: 'text', required: true, max: 120 },
      { key: 'songs', label: 'Song or songs', type: 'text', required: true, max: 500 },
      { key: 'project', label: 'Project', type: 'long', required: true, max: 1500,
        help: 'Title and a short description of the scene or use.' },
      { key: 'media', label: 'Media type', type: 'choice', required: true,
        choices: ['Film', 'TV or streaming series', 'Advertising or commercial', 'Trailer or promo', 'Video game',
          'Online video or social media', 'Podcast', 'Corporate or event', 'Other'] },
      { key: 'territory', label: 'Territory', type: 'text', required: true, max: 120, help: 'For example: Worldwide, or US only.' },
      { key: 'term', label: 'Term', type: 'text', required: true, max: 120, help: 'For example: 1 year, or perpetual.' },
      { key: 'timeline', label: 'Timeline', type: 'text', required: true, max: 120, help: 'When you need the license.' },
      { key: 'budget', label: 'Budget range', type: 'choice', required: false,
        choices: ['Under $500', '$500 to $2,000', '$2,000 to $10,000', 'Over $10,000', 'Not sure yet'] },
      { key: 'notes', label: 'Notes', type: 'long', required: false, max: 2000 }
    ]
  }
};

/* ---------- Setup (Daniel runs this once from the editor) ---------- */

function setupDanyelOzForms() {
  const p = PropertiesService.getScriptProperties();
  const activeId = fsActiveId_() || p.getProperty(FS_PROP_SONG_DB) || '';   // run from the editor: the Song Database
  if (activeId && p.getProperty(FS_PROP_SONG_DB) !== activeId) p.setProperty(FS_PROP_SONG_DB, activeId);
  const inbox = fsOpenInbox_(p, activeId);
  const inboxId = inbox.getId();
  const opened = {};
  Object.keys(FS_FORMS).forEach(function (key) { opened[key] = fsEnsureForm_(p, key); });
  Object.keys(opened).forEach(function (key) {                          // check every form before changing any
    const dest = fsDestinationId_(opened[key].form);
    if (dest && activeId && dest === activeId) {
      throw new Error('The form "' + FS_FORMS[key].title + '" sends its replies to the Song Database. Unlink it ' +
        '(form > Responses > three-dot menu > Unlink form), then run setupDanyelOzForms again.');
    }
  });
  const config = { version: 1, forms: {} };
  Object.keys(opened).forEach(function (key) {
    const form = opened[key].form, isNew = opened[key].created;
    fsApplySettings_(form, key, isNew);
    const items = fsEnsureItems_(p, form, key, isNew);
    if (fsDestinationId_(form) !== inboxId) {
      form.setDestination(FormApp.DestinationType.SPREADSHEET, inboxId);
      if (!isNew) Logger.log('fs setup: ' + key + ' corrected destination');
    }
    const fields = {}, seen = {};
    FS_FORMS[key].fields.forEach(function (f) {
      const entry = fsEntryId_(form, items[f.key], f);
      if (seen[entry]) throw new Error('Two questions of "' + FS_FORMS[key].title + '" share one entry id.');
      seen[entry] = true;
      fields[f.key] = entry;
    });
    config.forms[key] = { action: fsActionUrl_(form), fields: fields };
  });
  fsEnsureTrigger_(inboxId);
  Logger.log('FORMS_JSON_BEGIN');
  Logger.log(JSON.stringify(config, null, 2));
  Logger.log('FORMS_JSON_END');
  Logger.log('Inbox (private, bookmark it): ' + inbox.getUrl());
  Logger.log('Inbox people besides the owner: ' + inbox.getEditors().length + ' editors, ' + inbox.getViewers().length + ' viewers');
  return config;
}

function fsActiveId_() {
  try { const a = SpreadsheetApp.getActiveSpreadsheet(); return a ? a.getId() : ''; } catch (err) { return ''; }
}

function fsOpenInbox_(p, activeId) {
  const stored = p.getProperty(FS_PROP_INBOX);
  if (stored && activeId && stored === activeId) throw new Error('Inbox must not be the Song Database');
  let book = null;
  if (stored) { try { book = SpreadsheetApp.openById(stored); } catch (err) { book = null; } }
  if (!book) {
    book = SpreadsheetApp.create(FS_INBOX_NAME);
    p.setProperty(FS_PROP_INBOX, book.getId());
    Logger.log('fs setup: created the inbox spreadsheet');
  }
  if (activeId && book.getId() === activeId) throw new Error('Inbox must not be the Song Database');
  return book;
}

function fsEnsureForm_(p, key) {
  const spec = FS_FORMS[key], stored = p.getProperty(spec.prop);
  if (stored) {
    try { const f = FormApp.openById(stored); if (f) return { form: f, created: false }; } catch (err) { /* recreated below */ }
  }
  const form = FormApp.create(spec.title);
  p.setProperty(spec.prop, form.getId());
  Logger.log('fs setup: created form ' + key);
  return { form: form, created: true };
}

function fsDestinationId_(form) {
  try { return form.getDestinationId() || ''; } catch (err) { return ''; }
}

/* Every setting is applied on each run; a changed one is logged by name (repair tool, FR-07). */
function fsApplySettings_(form, key, isNew) {
  const fix = function (name, ok, apply) { if (!ok) { apply(); if (!isNew) Logger.log('fs setup: ' + key + ' corrected ' + name); } };
  fix('collect email', form.collectsEmail() === false, function () { form.setCollectEmail(false); });
  fix('response edits', form.canEditResponse() === false, function () { form.setAllowResponseEdits(false); });
  fix('one response per user', form.hasLimitOneResponsePerUser() === false, function () { form.setLimitOneResponsePerUser(false); });
  fix('publishing summary', form.isPublishingSummary() === false, function () { form.setPublishingSummary(false); });
  fix('respond again link', form.hasRespondAgainLink() === false, function () { form.setShowLinkToRespondAgain(false); });
  fix('accepting responses', form.isAcceptingResponses() === true, function () { form.setAcceptingResponses(true); });
  fix('confirmation message', form.getConfirmationMessage() === FS_CONFIRMATION, function () { form.setConfirmationMessage(FS_CONFIRMATION); });
  if (typeof form.setRequireLogin === 'function') { try { form.setRequireLogin(false); } catch (err) { /* consumer account */ } }
  if (typeof form.setPublished === 'function') { try { form.setPublished(true); } catch (err) { /* older form */ } }
}

function fsItemType_(type) {
  if (type === 'long') return FormApp.ItemType.PARAGRAPH_TEXT;
  if (type === 'choice') return FormApp.ItemType.MULTIPLE_CHOICE;
  return FormApp.ItemType.TEXT;
}

function fsTyped_(item, type) {
  if (!item || item.getType() !== fsItemType_(type)) return null;
  if (type === 'long') return item.asParagraphTextItem();
  if (type === 'choice') return item.asMultipleChoiceItem();
  return item.asTextItem();
}

/* Items are found by the id stored at the last run, then by exact title; missing ones are added at the end.
   Nothing is deleted or reordered, so entry ids stay stable. */
function fsEnsureItems_(p, form, key, isNew) {
  let stored = {};
  try { stored = JSON.parse(p.getProperty(FS_PROP_ITEMS + key) || '{}') || {}; } catch (err) { stored = {}; }
  const all = form.getItems(), used = {}, out = {}, ids = {};
  FS_FORMS[key].fields.forEach(function (f) {
    let typed = null, added = false;
    if (stored[f.key]) {
      let byId = null;
      try { byId = form.getItemById(stored[f.key]); } catch (err) { byId = null; }
      typed = fsTyped_(byId, f.type);
    }
    if (!typed) {
      for (let i = 0; i < all.length && !typed; i++) {
        if (!used[all[i].getId()] && all[i].getTitle() === f.label) typed = fsTyped_(all[i], f.type);
      }
    }
    if (!typed) {
      typed = f.type === 'long' ? form.addParagraphTextItem() : f.type === 'choice' ? form.addMultipleChoiceItem() : form.addTextItem();
      added = true;
    }
    used[typed.getId()] = true;
    const fix = function (name, ok, apply) { if (!ok) { apply(); if (!isNew && !added) Logger.log('fs setup: ' + key + ' corrected ' + f.key + ' ' + name); } };
    fix('title', typed.getTitle() === f.label, function () { typed.setTitle(f.label); });
    fix('required', typed.isRequired() === f.required, function () { typed.setRequired(f.required); });
    fix('help text', (typed.getHelpText() || '') === (f.help || ''), function () { typed.setHelpText(f.help || ''); });
    if (f.type === 'choice') {
      const now = typed.getChoices().map(function (c) { return c.getValue(); });
      fix('choices', JSON.stringify(now) === JSON.stringify(f.choices), function () { typed.setChoiceValues(f.choices); });
      fix('other option', !typed.hasOtherOption(), function () { typed.showOtherOption(false); });
    }
    out[f.key] = typed;
    ids[f.key] = String(typed.getId());
  });
  p.setProperty(FS_PROP_ITEMS + key, JSON.stringify(ids));
  return out;
}

/* One prefilled URL per item, so the entry id never depends on item order. */
function fsEntryId_(form, typed, f) {
  const sample = f.type === 'choice' ? f.choices[0] : 'x';
  const url = form.createResponse().withItemResponse(typed.createResponse(sample)).toPrefilledUrl();
  const m = FS_ENTRY_RE.exec(String(url));
  if (!m) throw new Error('Could not read the entry id of "' + f.label + '".');
  return 'entry.' + m[1];
}

function fsActionUrl_(form) {
  const action = String(form.getPublishedUrl()).replace(/\/viewform(\?.*)?$/, '/formResponse');
  if (!FS_ACTION_RE.test(action)) throw new Error('The published address of "' + form.getTitle() + '" has an unexpected shape.');
  return action;
}

/* One submit trigger on the inbox spreadsheet covers both forms (D-7). Triggers of this handler on anything else
   (an older inbox, or a form-level trigger) are removed. */
function fsEnsureTrigger_(inboxId) {
  let have = false;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() !== FS_HANDLER) return;
    if (!have && t.getTriggerSourceId() === inboxId) { have = true; return; }
    ScriptApp.deleteTrigger(t);
    Logger.log('fs setup: removed an old submit trigger');
  });
  if (!have) {
    ScriptApp.newTrigger(FS_HANDLER).forSpreadsheet(inboxId).onFormSubmit().create();
    Logger.log('fs setup: installed the submit trigger');
  }
}

/* ---------- Submit trigger ---------- */

function fsOnFormSubmit(e) {
  if (!e || typeof e !== 'object' || !e.range || typeof e.range.getSheet !== 'function') return;   // not a real event (FR-09)
  let key = '';
  try {
    const p = PropertiesService.getScriptProperties();
    const sheet = e.range.getSheet();
    const book = sheet && typeof sheet.getParent === 'function' ? sheet.getParent() : null;
    const bookId = book ? book.getId() : '';
    const inboxId = p.getProperty(FS_PROP_INBOX) || '';
    const songDbId = p.getProperty(FS_PROP_SONG_DB) || '';               // stored by setup; never getActiveSpreadsheet() here
    if (!inboxId || !bookId || bookId !== inboxId || bookId === songDbId) { Logger.log('fsOnFormSubmit: inbox guard'); return; }   // touch nothing
    const row = fsNeutralize_(e.range);                                 // the inbox only, before any other return (FI-1, D-1)
    if (!songDbId) { Logger.log('fsOnFormSubmit: Song Database id missing, run setupDanyelOzForms; no email'); return; }
    const found = fsFormOfSheet_(sheet, p);
    if (!found) return;
    key = found.key;
    const answers = fsReadAnswers_(sheet, e.range, row, key, found.id, p);
    const vals = {};
    for (let i = 0; i < FS_FORMS[key].fields.length; i++) {
      const f = FS_FORMS[key].fields[i], v = fsCheck_(f, answers.values[f.key]);
      if (v === null) { Logger.log('fsOnFormSubmit: reply to form ' + key + ' failed the checks, no email'); return; }
      vals[f.key] = v;
    }
    const mail = fsBuildMail_(key, vals, answers.others);
    fsSendCapped_(p, key, mail);
  } catch (err) {
    Logger.log('fsOnFormSubmit: could not finish for form ' + (key || 'unknown'));
  }
}

/* FR-03: a cell holding a formula, or text that starts with = + - @, is rewritten as text with a leading apostrophe.
   Returns what the visitor typed for each cell (the formula text where there was one). */
function fsNeutralize_(range) {
  const values = range.getValues()[0], formulas = range.getFormulas()[0], typed = [];
  for (let j = 0; j < values.length; j++) {
    const fm = formulas[j] || '', v = values[j];
    if (fm) { range.getCell(1, j + 1).setValue("'" + fm); typed.push(fm); continue; }
    if (typeof v === 'string' && FS_FORMULA_RE.test(v)) range.getCell(1, j + 1).setValue("'" + v);
    typed.push(v);
  }
  return typed;
}

function fsFormOfSheet_(sheet, p) {
  const url = typeof sheet.getFormUrl === 'function' ? sheet.getFormUrl() : null;
  if (!url) return null;
  const keys = Object.keys(FS_FORMS), m = /\/forms\/d\/(?!e\/)([A-Za-z0-9_-]{10,})/.exec(String(url));
  let id = m ? m[1] : '';
  const match = function () {
    for (let i = 0; i < keys.length; i++) { const s = p.getProperty(FS_FORMS[keys[i]].prop); if (s && s === id) return { key: keys[i], id: s }; }
    return null;
  };
  let hit = match();
  if (!hit) { try { id = FormApp.openByUrl(String(url)).getId(); hit = match(); } catch (err) { hit = null; } }
  return hit;
}

/* Answers by the item id stored at setup (current title of that item), then by the spec label. Anything left over
   is kept as an "Other answer" so a renamed question is never lost silently (FR-07). */
function fsReadAnswers_(sheet, range, row, key, formId, p) {
  const col = range.getColumn(), heads = sheet.getRange(1, col, 1, row.length).getValues()[0];
  let ids = {}, form = null;
  try { ids = JSON.parse(p.getProperty(FS_PROP_ITEMS + key) || '{}') || {}; } catch (err) { ids = {}; }
  try { form = FormApp.openById(formId); } catch (err) { form = null; }
  const used = {}, values = {}, others = [];
  if (col === 1) used[0] = true;                                       // column A is Google's Timestamp
  FS_FORMS[key].fields.forEach(function (f) {
    const titles = [];
    if (form && ids[f.key]) { try { const it = form.getItemById(ids[f.key]); if (it) titles.push(it.getTitle()); } catch (err) { /* label below */ } }
    titles.push(f.label);
    values[f.key] = '';
    for (let t = 0; t < titles.length; t++) {
      const j = heads.findIndex(function (h, i) { return !used[i] && String(h) === titles[t]; });
      if (j >= 0) { used[j] = true; values[f.key] = row[j] == null ? '' : String(row[j]); break; }
    }
  });
  heads.forEach(function (h, i) {
    if (used[i] || row[i] == null || String(row[i]).trim() === '') return;
    others.push({ label: fsClean_(h, true).slice(0, 80), value: fsClean_(row[i], false).slice(0, FS_OTHER_MAX) });
  });
  return { values: values, others: others };
}

function fsClean_(v, oneLine) {
  let s = String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(FS_STRIP_RE, '');
  if (oneLine) s = s.replace(/\s+/g, ' ');
  return s.trim();
}

function fsValidEmail_(v) {
  const s = String(v == null ? '' : v).trim();
  return s.length <= FS_EMAIL_MAX && FS_EMAIL_RE.test(s);
}

/* Server-side checks (FR-01c, FR-02). Returns the clean value, or null when the reply is not valid. */
function fsCheck_(f, raw) {
  const plain = String(raw == null ? '' : raw).trim();
  if (f.type === 'email') {
    if (plain === '') return f.required ? null : '';
    return fsValidEmail_(plain) ? plain : null;
  }
  if (f.type === 'choice') {
    if (plain === '') return f.required ? null : '';
    return f.choices.indexOf(plain) >= 0 ? plain : null;
  }
  const v = fsClean_(raw, f.type !== 'long');
  if (v === '') return f.required ? null : '';
  return v.length > f.max ? null : v;
}

/* Trusted lines first, then the visitor's words, every line behind FS_QUOTE so none can pose as a label (FR-02d).
   No inbox address in the mail (FR-05). */
function fsBuildMail_(key, vals, others) {
  const spec = FS_FORMS[key];
  const replyTo = fsValidEmail_(vals.email) ? vals.email : '';
  const lines = [spec.heading, 'Sent: ' + Utilities.formatDate(new Date(), FS_TZ, 'yyyy-MM-dd HH:mm') + ' Manila time',
    'Reply-To set: ' + (replyTo ? 'yes' : 'no')];
  if (replyTo) lines.push('Reply to this email to answer.');
  lines.push('', FS_SEPARATOR);
  const add = function (label, v, long) {
    if (!long) { lines.push(FS_QUOTE + label + ': ' + (v === '' ? '(none)' : v)); return; }
    lines.push(FS_QUOTE + label + ':');
    (v === '' ? ['(none)'] : v.split('\n')).forEach(function (l) { lines.push(FS_QUOTE + '    ' + l); });
  };
  spec.fields.forEach(function (f) { add(f.label, vals[f.key], f.type === 'long'); });
  others.forEach(function (o) { add('Other answer (' + o.label + ')', o.value, true); });
  const subject = (spec.subject.prefix + spec.subject.parts.map(function (k) { return fsClean_(vals[k], true); }).join(' | '))
    .replace(/[\r\n\t]+/g, ' ').slice(0, FS_SUBJECT_MAX);
  return { subject: subject, body: lines.join('\n').slice(0, FS_BODY_MAX), replyTo: replyTo };
}

/* FR-01: at most FS_MAX_MAIL_PER_DAY emails a Manila day, then one notice, then nothing until tomorrow. */
function fsSendCapped_(p, key, mail) {
  if (MailApp.getRemainingDailyQuota() < FS_MIN_QUOTA) { Logger.log('fsOnFormSubmit: mail quota low, no email for form ' + key); return; }
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) { Logger.log('fsOnFormSubmit: busy, no email for form ' + key); return; }
  try {
    const countKey = FS_MAIL_COUNT + Utilities.formatDate(new Date(), FS_TZ, 'yyyy-MM-dd');
    p.getKeys().forEach(function (k) { if (k.indexOf(FS_MAIL_COUNT) === 0 && k !== countKey) p.deleteProperty(k); });
    const n = Number(p.getProperty(countKey)) || 0;
    if (n > FS_MAX_MAIL_PER_DAY) return;
    if (n === FS_MAX_MAIL_PER_DAY) {
      fsMail_({ subject: 'Danyel OZ website: daily email limit reached',
        body: 'Daily email limit reached; new replies are still saved in the inbox.', replyTo: '' });
    } else {
      fsMail_(mail);
    }
    p.setProperty(countKey, String(n + 1));
  } finally {
    lock.releaseLock();
  }
}

/* The only place that sends mail: always to FS_NOTIFY, plain text, no cc, bcc, html or attachments (FR-02f). */
function fsMail_(mail) {
  const msg = { to: FS_NOTIFY, subject: mail.subject, body: mail.body, name: FS_SENDER_NAME };
  if (mail.replyTo) msg.replyTo = mail.replyTo;
  MailApp.sendEmail(msg);
}
