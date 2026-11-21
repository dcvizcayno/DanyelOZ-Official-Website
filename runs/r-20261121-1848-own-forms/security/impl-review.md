# Security implementation review (pre-G4) - r-20261121-1848-own-forms, T-008

Reviewer: security. Tier T2 (personal data). Subject: the real code, not receipts.
Read: apps-script/FormsSetup.gs (all 406 lines), docs/SETUP.md (own-forms section), CLAUDE.md:94,129-132,
docs/legal/privacy-policy.md (diff), tests/unit/test_formssetup.js (harness), danyeloz-embeds forms-core.js
(validation, config load, submit, privacy link), contact.html, git diff of sync-core.js and sync.html.
Measured against security/design-review.md FR-01..FR-14 and charter D-4..D-9.

## G4 security verdict: PASS_WITH_CONDITIONS

No open Critical or High. Two new Medium findings (FI-1, FI-2) and one Medium partial (FR-03 live check)
are conditions with owners. FI-1 should be fixed before forms.json is pushed; it is a small change.

## Executed evidence

| Command | Result |
|---|---|
| env -u GITHUB_TOKEN -u GH_TOKEN node tests/unit/test_formssetup.js apps-script | 12 .gs files checked; PASSED |
| node tests/widgets/test_formscore.js | 186 checks, PASSED |
| node tests/widgets/contact.js | 200 checks, PASSED |
| node tests/widgets/sync_form.js | 138 checks, PASSED |
| node tests/widgets/sandbox.js | 84 checks, PASSED |
| Own probe (vm, stub globals; written under security/, run, deleted) | results below |

Probe results (FormsSetup.gs functions called directly):
- fsCheck_(email): "a@b.co CR LF Bcc: x@evil.io" -> null; quoted local part with ">" -> null; "a%40evil@b.co" -> null; "a@b.co" + LF -> "a@b.co" (trimmed, safe).
- fsCheck_(choice): "Fan Contact" + LF + "X", "Fan Contact" + U+200B, "Buy now" -> all null (no mail, row kept).
- fsCheck_(text): U+202E and U+2066 stripped; U+0085, U+2028, CR removed or collapsed to one space; 4001 chars -> null.
- fsBuildMail_: trusted lines first, separator, every user line behind "  | "; planted "All replies: https://evil" and
  "Reply to this email to answer." appear only as quoted lines. Subject keeps its fixed prefix.
- fsNeutralize_: IMAGE formula, "+63 912", " =1+1", "@x", TAB + "-2", NBSP + "=1" -> each rewritten with a leading
  apostrophe; "ok" untouched.
- fsOnFormSubmit with getActiveSpreadsheet() returning the inbox id -> logs "inbox guard", 0 cell rewrites, 0 mail (FI-1).
- Grep FormsSetup.gs: no GmailApp, UrlFetchApp, DriveApp, addEditor, addViewer, setSharing, console, htmlBody, cc, bcc;
  one MailApp.sendEmail (fsMail_, :405, to = FS_NOTIFY constant); one newTrigger (:243, setup path only).
  No appsscript.json change. Grep forms-core.js: no location, localStorage, message listener, postMessage,
  innerHTML/outerHTML/insertAdjacentHTML/document.write/eval/Function, console.

## Per-risk status

| ID | Design sev | Status | Evidence | Residual / condition |
|---|---|---|---|---|
| FR-01 flooding / quota | High | closed | FormsSetup.gs:376-398: quota floor 5, ScriptLock, Manila date key, cap 40 + one notice, old keys deleted; invalid replies return before counting (:271-275). Unit test :284-287 (41 -> 40 + notice). | Spam rows still pile up (accepted residual; no CAPTCHA by charter). |
| FR-02 untrusted text in mail | High | closed | Strict regex :30 equals forms-core.js:19; FS_STRIP_RE :33 adds U+2028/2029 to the design list; fsCheck_ :333-347 exact choice and length; fsBuildMail_ :351-369 trusted-first + quoted lines; fsMail_ :401-406 fixed to, no cc/bcc/html. Probe above. | none |
| FR-03 formula injection | High | partial (now Medium) | Spreadsheet-level trigger (:236-246, D-7) and fsNeutralize_ :283-293 work (probe). Gaps: (1) the neutralizer sits behind the guard that FI-1 can trip, so it may never run live; (2) SETUP.md step 7 has no "=1+1" answer and no "cell shows as text" check (design FR-03 verification). | Closed when FI-1 is fixed and SETUP step 7 adds the "=1+1" check. Owner: executor. |
| FR-04 tampered forms.json | Medium | closed in code; supervisor condition open | forms-core.js:89-96 regex + URL parse (href equality, host, no user/pass/port/search/hash), checked in validConfig :101 and submit :168; CONFIG_URL constant :9, no override paths (grep). D-6: no pinned ids. | Supervisor pre-push: compare forms.json ids with the FORMS_JSON block; grep -c spreadsheets data/forms.json = 0. Residual: repo push credential (SR-13, inherited). |
| FR-05 inbox URL in replies | Medium | closed | No inbox URL in fsBuildMail_; logged once outside the markers :113; SETUP step 4 bookmark. | none |
| FR-06 inbox public / Song DB | Medium | partial | Setup guards :95-101, :122, :133 correct (editor run: active = container). No sharing calls (grep). Editor/viewer count logged :114. SETUP step 5 Restricted check. Trigger-side guard uses getActiveSpreadsheet() (:263-264): see FI-1. | Closed with FI-1. |
| FR-07 form editors / drift | Medium | closed | fsApplySettings_ :150-160 re-applies 7 settings and logs names; destination reset :89-92; item ids stored :213; "Other answer" fallback :315-318. SETUP 5 and 10, CLAUDE.md:132. | none |
| FR-08 bound-script editors | Medium | accepted (D-4, human) | Warning text at CLAUDE.md:130 and SETUP.md:101. | Any Song DB Editor can read or redirect all replies, for as long as the script stays bound. |
| FR-09 public entry points | Low | closed | :258 requires e.range.getSheet to be a function (not serialisable through google.script.run); setup returns the public config only. | none |
| FR-10 PII in logs | Low | closed | Every Logger.log carries a fixed text + form key; catch :278-280 logs no error text. | Inbox URL in the setup log is visible to project editors (covered by D-4). |
| FR-11 widget DOM / transport | Low | closed | credentials omit, no-referrer, no-cors (forms-core.js:159,171); privacy link noopener noreferrer :238-243; planted-HTML probe contact.js:20; cookie/referer assertions in contact.js and sync_form.js; all suites pass. | contact.html loads Google Fonts (the page, not the core), as the existing embeds do. |
| FR-12 privacy wording | Low | partial | PRIVACY_URL = /about/privacy (forms-core.js:10); policy lists fields, Google storage, use, no sale, 1 year (D-5). | Retention gap, see FI-2. |
| FR-13 silent loss | Low | closed | SETUP step 7 live test, step 10 re-run, step 11 monthly test. | Accepted residual (opaque no-cors). |
| FR-14 least privilege | Low | closed | Grep above; MailApp only; one trigger site. | D-4 keeps Forms/Mail scopes in the admin project (accepted). |

## New findings

### FI-1 (Medium, B4/B5) - trigger-side guard can switch off FR-03 and all notifications
- Where: FormsSetup.gs:263-264. fsOnFormSubmit compares the inbox id with SpreadsheetApp.getActiveSpreadsheet().
- Path: when an installable spreadsheet trigger fires on a different spreadsheet, Apps Script is commonly reported to
  return the triggering spreadsheet (the inbox) as the active one. The unit harness always returns the container
  (test_formssetup.js:76), so the suite cannot detect it. If live behaviour matches, the guard fires on every reply:
  no notification is sent and fsNeutralize_ never runs, so a planted IMAGE or HYPERLINK formula stays live in the inbox.
  Fail-closed for mail, fail-open for FR-03. Once forms.json is pushed the sync form on sync.html is live at once,
  before the SETUP step-7 test. Unverified live (no account access); the probe confirms the code path.
- Mitigation: in setup, store the container id while it is known (Script Property FS_SONG_DB_ID from fsActiveId_()
  in the editor run); in fsOnFormSubmit compare the inbox id with that stored id, not getActiveSpreadsheet(). Run
  fsNeutralize_ as soon as the event's spreadsheet id equals the inbox id, before any other early return. Add a unit
  case where getActiveSpreadsheet returns the inbox: mail sent, cells rewritten.
- Owner: executor (FormsSetup.gs follow-up), before the forms.json push.

### FI-2 (Medium, privacy) - 1-year retention does not cover the copy inside Google Forms
- Where: docs/legal/privacy-policy.md (retention paragraph), docs/SETUP.md step 11.
- Path: the policy says replies are stored in Google Forms and in the private sheet, and promises deletion after 1 year
  from the sheet and the email copies. Step 11 deletes only inbox rows and emails. Responses stay in each form's
  Responses tab indefinitely and come back if a destination is re-linked, so the published retention promise for
  personal data would be false (Philippines DPA exposure).
- Mitigation: SETUP step 11 also deletes responses older than 1 year in each form (Forms > Responses), or an
  editor-run helper using FormResponse.getTimestamp() and form.deleteResponse(id); or reword the policy to match.
- Owner: executor (docs) and Daniel.

### FI-3 (Low, B5) - flood can skip a real notification
- The cap is per project while the MailApp quota is shared (the floor at :376 protects other mail). During a flood a
  call can wait up to 20 s for the ScriptLock and skip its notification; the row is still saved. Accepted residual.

## Conditions for G4

1. FI-1 fixed and unit-tested before data/forms.json is pushed. If the supervisor pushes first, the step-7 live test
   must show both the email and an "=1+1" answer rendered as text; on failure, revert forms.json.
2. SETUP.md step 7 adds an "=1+1" answer and the check that the inbox cell shows it as text (FR-03).
3. FI-2: retention step or policy wording aligned before the privacy page is published (SETUP step 6).
4. Supervisor pre-push forms.json check (FR-04d, D-6).

Residual risk and exposure window: replies can be read or redirected by any Song DB Editor for as long as
FormsSetup.gs stays in the bound project (D-4, human-accepted); forms.json integrity rests on the danyeloz-embeds push
credential for as long as that token can write (SR-13); if FI-1 ships unfixed and live behaviour is as described,
formula cells stay live and notifications stop from the forms.json push until the fix lands.

## Not reviewed

Live Google behaviour (getActiveSpreadsheet in a cross-spreadsheet trigger, formula parsing of Forms-written cells,
unknown-choice rejection), by rule no account access. forms-core.js render/DOM code beyond the sink grep and the
privacy link (covered by the passing Playwright suites, run but not read line by line). sync-core.js beyond the diff;
HANDOFF.md; diffs of tests/widgets/catalogue.js, mock-sheet.js, sandbox.js; exec receipts T-003..T-007 (code reviewed
instead).
