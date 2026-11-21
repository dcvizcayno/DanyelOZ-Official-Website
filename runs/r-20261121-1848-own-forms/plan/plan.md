# Plan: r-20261121-1848-own-forms (T-001)

Paths: PRIV = `E:/Projects/Danyel OZ Official Website`, EMB = `E:/Projects/danyeloz-embeds`.
Every command runs from PRIV with `env -u GITHUB_TOKEN -u GH_TOKEN`. Nothing is committed or pushed.

## 1. Strategy

Three independent pieces meet at one contract, `EMB/data/forms.json`: the Apps Script setup prints it, the
shared core `EMB/forms-core.js` (window.OZForms) reads it, both widgets render through the core. Because the
contract and every field are fixed below, the setup script, the core and the docs are built in parallel
(wave 1). The two widgets follow in parallel (wave 2), each in its own files. Security and QA verify in
wave 3. The riskiest unknown (does Google accept a no-cors POST from the Sites sandbox, and can entry ids be
derived in Apps Script) is cheap to test and is pinned first in the core and setup tasks; the live check
needs Daniel's account and stays a residual risk (section 8).

## 2. Coverage matrix

| Criterion | Tasks | Verification (QA runs it, not the executor's claim) | Evidence QA demands |
|---|---|---|---|
| C-1 setup script | T-003 | `node tests/unit/test_formssetup.js apps-script` PASSED; read FormsSetup.gs against section 3 | output, field-by-field diff vs section 3, idempotency counts, global-name clash check |
| C-2 contact widget | T-004, T-006 | `node tests/widgets/contact.js` PASSED at 1400 and 390 incl. sandboxed frame | captured POST body, screenshots contact-1400/390, fallback screenshot |
| C-3 sync request form | T-004, T-007 | `node tests/widgets/sync_form.js` PASSED incl. sandbox; prefill from per-song button | captured POST with songs = clicked title; email row still in panel |
| C-4 shared safe submit | T-004 (+T-006, T-007 use it) | `node tests/widgets/test_formscore.js` PASSED; grep: no innerHTML/insertAdjacentHTML/document.write/eval/new Function, no third-party script tags | bad-config table, bot cases, length limits, single shared file loaded by both widgets |
| C-5 privacy | T-005, T-004 | read privacy-policy.md diff; Playwright asserts privacy note + link in both widgets | diff, link href = PRIVACY_URL |
| C-6 tests | T-003, T-004, T-006, T-007, T-009 | all commands in section 6 PASSED, incl. existing catalogue.js, one_sheet.js, sandbox.js, test_synccore.js, test_sync.js | full receipt list run by QA |
| C-7 handbook + setup | T-005 | read CLAUDE.md, EMB/HANDOFF.md, docs/SETUP.md, tests/README.md vs section 3 to 5 | diff; steps Daniel can follow in order |

Security design review (T-002) is the G1 prerequisite for T2; security implementation review (T-008) feeds G4.

## 3. Fixed decisions: Apps Script (T-003)

File: `PRIV/apps-script/FormsSetup.gs`. All top-level names start with `fs` (functions) or `FS_` (constants),
except the two entry points Daniel and the trigger call: `setupDanyelOzForms()` and `fsOnFormSubmit(e)`
(no trailing underscore: triggers and the Run menu need public names). Helpers end in `_` (e.g. `fsEnsureForm_`).
Constants: `FS_NOTIFY = 'daniel.vizkaino@gmail.com'`, `FS_INBOX_NAME = 'Danyel OZ Inbox (private)'`,
`FS_PROP_CONTACT = 'FS_CONTACT_FORM_ID'`, `FS_PROP_SYNC = 'FS_SYNC_FORM_ID'`, `FS_PROP_INBOX = 'FS_INBOX_SHEET_ID'`
(Script Properties), `FS_FORMS` = the field spec below (single source for setup and email).

setupDanyelOzForms(), safe to re-run:
1. Inbox: open `FS_INBOX_SHEET_ID` by id; if missing or open fails, `SpreadsheetApp.create(FS_INBOX_NAME)` and store
   the id. Throw `Inbox must not be the Song Database` if the id equals `SpreadsheetApp.getActiveSpreadsheet()`'s id
   (when there is an active one). Never touch sharing (a new file is private by default).
2. Each form: open stored id by `FormApp.openById`; if missing or it throws, `FormApp.create(title)` and store the id.
   Settings: `setCollectEmail(false)`, `setAllowResponseEdits(false)`, `setLimitOneResponsePerUser(false)`,
   `setPublishingSummary(false)`, `setShowLinkToRespondAgain(false)`, `setAcceptingResponses(true)`,
   `setConfirmationMessage('Thank you. Your message is sent.')`; `setRequireLogin(false)` and `setPublished(true)`
   each only if the method exists, inside try/catch (consumer accounts and older forms).
3. Items: matched by exact title; a missing item is added; existing items are never deleted or reordered (entry ids stay stable).
   Text = `addTextItem`, long = `addParagraphTextItem`, choice = `addMultipleChoiceItem().setChoiceValues(list)`
   (no "Other"). `setRequired` as specified; `setHelpText` where given. No Google-side text validation (a mismatch
   would drop a no-cors submit silently; the core validates).
4. Destination: `setDestination(FormApp.DestinationType.SPREADSHEET, inboxId)` only when `getDestinationId()` differs.
5. Trigger: one `ScriptApp.newTrigger('fsOnFormSubmit').forForm(form).onFormSubmit().create()` per form, only if no
   project trigger with that handler and `getTriggerSourceId() === formId` exists.
6. Entry ids: for each item, `form.createResponse().withItemResponse(<item typed>.createResponse(sample)).toPrefilledUrl()`
   (sample `x`, or the first choice), regex `/[?&]entry\.(\d+)=/`, store `'entry.' + digits`. One URL per item, so no ordering guess.
7. Action URL: `form.getPublishedUrl()` with `/viewform` replaced by `/formResponse`; must match
   `^https://docs\.google\.com/forms/d/e/[A-Za-z0-9_-]{20,}/formResponse$` or throw.
8. Output: `Logger.log` the lines `FORMS_JSON_BEGIN`, `JSON.stringify(config, null, 2)`, `FORMS_JSON_END`, plus the inbox
   URL; return the config object. The config is exactly the forms.json schema (section 4).

fsOnFormSubmit(e): find the form key by `e.source.getId()` against stored ids (unknown: return, send nothing).
Values from `e.response.getItemResponses()` by title. Each value: control characters except newline removed, trimmed,
cut to its limit. Mail: `MailApp.sendEmail({ to: FS_NOTIFY, subject, body, name: 'Danyel OZ website', replyTo? })`.
- replyTo: set only when the email answer is <= 254 chars, has no CR/LF/space/comma/semicolon and matches
  `^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$`; otherwise omitted.
- Subject (all CR/LF/tab collapsed to one space, cut to 150): contact `Website message: <topic> | <subject>`;
  sync `Sync license request: <songs> | <company>`.
- Body (plain text): first line `New message from the Danyel OZ contact form` or `New sync license request`, blank line,
  one `Label: value` line per field in form order (long answers on following lines, `(none)` for empty optional),
  blank line, `Sent: <yyyy-MM-dd HH:mm> Manila time` (Utilities.formatDate, Asia/Manila), `All replies: <inbox URL>`,
  and for a valid email `Reply to this email to answer.` Body cut to 10000 chars.

## 4. Fixed decisions: fields and forms.json

Identical labels, choices, required flags and limits in `FormsSetup.gs` (`FS_FORMS`) and `forms-core.js` (`OZForms.FIELDS`).
T-004's Node test cross-checks the two files once both exist (QA reruns it after wave 1).

Form `contact`, Google title `Danyel OZ contact`, widget heading `Contact & Collaborations`:

| key | label | type | req | max |
|---|---|---|---|---|
| first_name | First name | text | yes | 60 |
| last_name | Last name | text | yes | 60 |
| email | Email | email | yes | 254 |
| topic | What would you like to contact me about? | choice: Fan Contact; Music Collaborations; Beat Licensing & Instrumentals; Sync & Licensing; Media & Business Inquiries; General Inquiries | yes | n/a |
| subject | Subject | text | yes | 120 |
| message | Message (help: `Tell me how I can help.`) | long | yes | 4000 |

Form `sync`, Google title `Sync license request`, panel heading stays `Request a license`:

| key | label | type | req | max |
|---|---|---|---|---|
| name | Name | text | yes | 120 |
| email | Email | email | yes | 254 |
| company | Company or production | text | yes | 120 |
| songs | Song or songs (prefilled with the clicked song, editable) | text | yes | 500 |
| project | Project (help: `Title and a short description of the scene or use.`) | long | yes | 1500 |
| media | Media type | choice: Film; TV or streaming series; Advertising or commercial; Trailer or promo; Video game; Online video or social media; Podcast; Corporate or event; Other | yes | n/a |
| territory | Territory (help: `For example: Worldwide, or US only.`) | text | yes | 120 |
| term | Term (help: `For example: 1 year, or perpetual.`) | text | yes | 120 |
| timeline | Timeline (help: `When you need the license.`) | text | yes | 120 |
| budget | Budget range | choice: Under $500; $500 to $2,000; $2,000 to $10,000; Over $10,000; Not sure yet | no | n/a |
| notes | Notes | long | no | 2000 |

Widget controls: text = `input type=text`; email = `input type=email autocomplete=email`; long = `textarea`;
choice = radio group in a `fieldset` (contact topic) or `select` with an empty first option `Choose one` (sync media, budget).
Optional labels end with ` (optional)`; required fields carry `required` and `aria-required=true`; `maxlength` = max.

`EMB/data/forms.json` (written later by the supervisor from Daniel's FORMS_JSON block):

```json
{ "version": 1,
  "forms": {
    "contact": { "action": "https://docs.google.com/forms/d/e/<ID>/formResponse",
                 "fields": { "first_name": "entry.123456789", "last_name": "...", "email": "...", "topic": "...", "subject": "...", "message": "..." } },
    "sync":    { "action": "https://docs.google.com/forms/d/e/<ID>/formResponse",
                 "fields": { "name": "...", "email": "...", "company": "...", "songs": "...", "project": "...", "media": "...",
                             "territory": "...", "term": "...", "timeline": "...", "budget": "...", "notes": "..." } } } }
```

Valid only when: `version === 1`; the form's `action` matches the regex in section 3 step 7 (https, host exactly
docs.google.com, path /forms/d/e/<id>/formResponse, no query, no hash); `fields` has every key of that form, each value
matching `^entry\.[0-9]{4,12}$`, all distinct. Extra keys are ignored and never sent. Each form validates on its own
(a bad `sync` block does not break `contact`). Test fixture: `PRIV/tests/widgets/fixtures/forms.json` with fake ids.

## 5. Fixed decisions: forms-core.js and widgets

`EMB/forms-core.js` (script src `https://dcvizcayno.github.io/danyeloz-embeds/forms-core.js`) exposes `window.OZForms`
and loads in Node `vm` without a DOM for its pure functions.
- Constants: `CONFIG_URL = 'https://dcvizcayno.github.io/danyeloz-embeds/data/forms.json'`,
  `PRIVACY_URL = 'https://www.danyeloz.info/privacy'` (assumption A-1), `EMAIL = 'daniel.vizkaino@gmail.com'`,
  `MIN_FILL_MS = 3000`, `HONEYPOT = 'website'`, `FIELDS = { contact: [...], sync: [...] }` (section 4).
- `validConfig(raw, key)` returns `{action, fields}` or `null`. `loadConfig()` returns a Promise of the JSON or `null`
  (fetch CONFIG_URL with `cache: 'no-store'`, `credentials: 'omit'`, 8 s timeout; any error gives null; cached per page).
  No address-bar or attribute override of the URL.
- `validate(key, values)` returns `{ok, errors}`; values trimmed; a choice must be in its list.
- `encode(key, cfg, values)` returns `URLSearchParams` with only mapped entry ids; empty optional fields and the honeypot are never sent.
- `submit(action, params)`: re-checks `action` against the regex, then `fetch(action, {method: 'POST', mode: 'no-cors',
  credentials: 'omit', referrerPolicy: 'no-referrer', body: params})`, 15 s timeout. Resolved (opaque) = sent; rejected = failed.
- `render(root, key, opts)` returns `{node, destroy}`. opts: `prefill`, `turnaround`, `onUnavailable` (called instead of
  drawing the fallback; used by the sync panel). Shows `Loading the form…`, then the form or the fallback. Styles injected
  once as `<style>` via textContent, scoped to `.ozf`: Anton headings, Oswald labels and buttons, Open Sans inputs at 16 px,
  red `#e3122a`, deep `#b0101f`, full-width fields at 390 px.
- Text-only DOM: createElement, textContent, setAttribute. No innerHTML, insertAdjacentHTML, outerHTML, document.write,
  eval, new Function; the core loads no other script or font.
- Bots: honeypot `input name=website` labelled `Leave this empty`, wrapper `aria-hidden=true`, input `tabindex=-1
  autocomplete=off`, off-screen (`position:absolute;left:-10000px`). Filled: no POST, normal success shows. Submit within
  `MIN_FILL_MS` of the form appearing: no POST, status `Please take a moment to check your message, then press Send again.`
  One send per render; button disabled while sending.
- Errors inline under each field (`aria-describedby`, `aria-invalid=true`); focus goes to the first invalid field.
  `Please fill this in.` / `Please enter a valid email address.` / `Please choose one.` / `Please keep this under N characters.`

Wording (first person for Daniel, no em dashes, no gendered pronouns, only daniel.vizkaino@gmail.com):
- Contact intro `Tell me how I can help. I read every message.`; buttons `Send message` (contact), `Send request` (sync), `Sending…`.
- Contact success: `Thank you. Your message is on its way, and I will reply to the email you gave me.`
- Sync success: `Thank you. Your request is in. You get a quote within <turnaround>.` (default `3 business days`).
- Fallback (config missing or invalid): `The form is not available right now. Please email me at` + the address as
  selectable text + `Copy email` button (select-text fallback in the sandbox, like sync-core).
- Send failure: `Your message could not be sent. Please email me at <address>.` Typed values stay.
- Privacy note under each form: `I use what you send only to reply to you.` + link `Privacy policy` (PRIVACY_URL,
  `target=_blank rel="noopener noreferrer"`).

`EMB/contact.html` (T-006): Settings block (`FORM_KEY = 'contact'`), loads forms-core.js only, `<div id="ozc">`,
`OZForms.render`. Submitting never navigates the frame and opens no window.

Sync panel (T-007): `sync.html` loads forms-core.js before sync-core.js. In `sync-core.js` `requestPanel`, when
`window.OZForms` exists, a `.ozr-form` container after the song line gets `OZForms.render(c, 'sync', {prefill: {songs:
songTitle}, turnaround, onUnavailable})`; the `Include in your request:` list is hidden while the form shows and returns
via onUnavailable (container removed). The email row stays, introduced by `Prefer email? Send your request to:`.
`openRequest`: Tab trap covers `a[href], button, input:not([tabindex="-1"]), select, textarea`; the backdrop does not close
the panel while any field has text (Close and Escape still do). Without OZForms (sync-one-sheet.html) nothing changes.

Test harness (T-004): `tests/widgets/mock-sheet.js` also serves `.../forms-core.js` and `.../contact.html` from EMB, the
config URL per option `forms` (default: 200 `{}`, i.e. invalid, so pages show the fallback and old tests see no network
error; `'fixture'`; `404`; or an object), fulfils POSTs to `docs.google.com/forms/d/e/*/formResponse` with 200 and logs
them; exports `sandboxPage(browser, width, file, opts)` (the sandbox.js harness: other-origin page, `<iframe
sandbox="allow-scripts allow-popups allow-forms allow-same-origin">`). `sandbox.js` only switches to these routes.

## 6. Tasks and waves (detail and done-bullets in plan.json)

| Wave | Task | Owner | Write scope | Est |
|---|---|---|---|---|
| 0 | T-002 security design review of this plan | security | runs/.../security/T-002.md | 15 |
| 1 | T-003 FormsSetup.gs + test_formssetup.js | executor | PRIV/apps-script/FormsSetup.gs, PRIV/tests/unit/test_formssetup.js | 45 |
| 1 | T-004 forms-core.js + Node test + harness | executor | EMB/forms-core.js, PRIV/tests/widgets/test_formscore.js, mock-sheet.js, sandbox.js, fixtures/forms.json | 60 |
| 1 | T-005 privacy, handbook, setup docs | executor | PRIV/docs/legal/privacy-policy.md, PRIV/CLAUDE.md, EMB/HANDOFF.md, PRIV/docs/SETUP.md, PRIV/tests/README.md | 30 |
| 2 | T-006 contact.html + contact.js | executor | EMB/contact.html, PRIV/tests/widgets/contact.js | 45 |
| 2 | T-007 sync request form in panel + sync_form.js | executor | EMB/sync-core.js, EMB/sync.html, PRIV/tests/widgets/sync_form.js, PRIV/tests/widgets/test_synccore.js | 60 |
| 3 | T-008 security implementation review | security | runs/.../security/T-008.md | 15 |
| 3 | T-009 independent QA, C-1..C-7 | qa | runs/.../qa/T-009.md | 25 |

No file appears in two tasks of one wave. T-004 owns every shared harness file so T-006 and T-007 never touch them.
T-005 writes from sections 3 to 5; T-009 checks the docs against the code.

Verification commands (QA runs all of them, `env -u GITHUB_TOKEN -u GH_TOKEN`, cwd PRIV):
```
node tests/unit/test_formssetup.js apps-script
node tests/unit/test_sync.js apps-script
node tests/widgets/test_formscore.js
node tests/widgets/test_synccore.js
node tests/widgets/contact.js
node tests/widgets/sync_form.js
node tests/widgets/catalogue.js
node tests/widgets/one_sheet.js
node tests/widgets/sandbox.js
```
Plus QA's own probes: grep for unsafe DOM sinks and for any email other than daniel.vizkaino@gmail.com in EMB/forms-core.js,
contact.html, sync-core.js; grep for em dashes and he/him/his/she/her in new user-facing text; all apps-script/*.gs loaded in one
vm context without a duplicate-declaration error.

## 7. Assumptions and open questions

- A-1 Privacy page URL is `https://www.danyeloz.info/privacy`. Invalidated if Daniel's Sites page slug differs; then only
  `PRIVACY_URL` changes (one constant).
- A-2 Google accepts a urlencoded no-cors POST to /formResponse with only entry params, and new forms can be set to
  accept responses from anyone (`setPublished(true)` where it exists). Invalidated by Daniel's first live test: no row in the inbox.
- A-3 Google Sites keeps the sandbox flags of the charter and sets no CSP that blocks fetch to docs.google.com.
- A-4 The Apps Script project is bound to the Song Database (getActiveSpreadsheet is the Song Database); the inbox guard uses that.
- Q-1 Budget: the charter allows 3 executor tasks of 30 min; this plan has 5 executor tasks, about 240 min. Merging would
  break the one-file-per-wave rule or make tasks unreviewable. Supervisor to accept or cut scope (e.g. defer T-005).
- Q-2 Topic `Sync & Licensing` sits after `Beat Licensing & Instrumentals`; confirm order with Daniel if it matters.

## 8. Risks and rollback

- Live Google behaviour (A-2, A-3) cannot be proven by mocks. Mitigation: Daniel tests contact.html in a draft Sites page
  before swapping Cognito; Cognito stays live until then (charter).
- A planted entry id or action in forms.json could redirect posts. Mitigation: strict host/path regex and checked again in submit().
- Spam through the public endpoint is possible (no CAPTCHA by charter). Mitigation: honeypot, fill time, limits; the
  responses go to a private sheet and email only.
- Rollback: nothing is pushed until G4. Before push: revert the files in the write scopes (new files deleted, edited files
  restored from git). After push: delete `data/forms.json` (all widgets fall back to the email text) and revert sync.html
  to drop the forms-core script; Daniel keeps or restores the Cognito embed; in Apps Script, delete the two triggers
  (Triggers page) to stop emails. Triggered by the supervisor on a QA/security FAIL, or by Daniel.
