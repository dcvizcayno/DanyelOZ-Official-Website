# Security design review (G1) - r-20261121-2308-inbox-autoreply-digest, RUN

Reviewer: security. Subject: charter.md C-1..C-6 and the code it builds on: apps-script/FormsSetup.gs (FS_EMAIL_RE :31,
FS_STRIP_RE :34, fsOnFormSubmit :252-280, fsCheck_ :347-360, fsSendCapped_ :384-403, fsMail_ :406-410), Code.gs
(doGet :26, safeText_ :119, lock_ :203), TracksApp.html (text-only `el()` helper), CLAUDE.md:96/129 (deployment modes).
Consistency: runs/r-20261121-1848-own-forms/security/design-review.md (FR-01..FR-14) and impl-review.md (FI-1..FI-3).

**G1 verdict: PASS_WITH_CONDITIONS.** No Critical. Five risks are High *if built as the charter reads today*
(IR-01, IR-02, IR-03, IR-05, IR-06). Each has a concrete control below; they are conditions on the executor tasks,
not reasons to hold the start. One residual (IR-01) needs a **human acceptance line in report.md before the switch
is turned ON** (not before coding).

## Facts that change the design

1. **The server cannot check bots.** The honeypot and the 3 s fill time live only in forms-core.js and are never
   posted (tests/widgets/test_formscore.js:163 "honeypot never encoded"). The formResponse address is public in
   data/forms.json. Anyone can create a row with **any email address and any first name**, without a browser.
   An auto-reply is therefore mail **from the Gmail account of Daniel to an address a stranger chose**.
2. **No "invalid" flag exists in the inbox.** fsOnFormSubmit only *skips the alert* for a reply that fails
   fsCheck_ (:272); nothing is written to the row. "No replies to rows flagged invalid" has nothing to read unless
   the auto-reply runs the checks again (IR-07).
3. **The first name is submitted text.** "First name only, never quoting submitted text" contradicts itself:
   the first name is 60 free characters chosen by the sender (IR-02).
4. **fsSendCapped_ waits only 20 s for the ScriptLock** (:387) and then drops the alert. An auto-reply run
   that holds the same lock while sending silently removes alerts (IR-03).
5. Form.html already has 29 `innerHTML` uses; the screen pairs (TracksApp etc.) have 0. The Inbox follows the
   pairs, not Form.html.
6. The project time zone is not in the repo (no appsscript.json); never rely on it.

## 1. Assets

| Asset | Class |
|---|---|
| Inbox rows: names, emails, message text, sync company/budget | confidential (PII) |
| Gmail sending identity and reputation of daniel.vizkaino@gmail.com | confidential (integrity/availability) |
| MailApp daily quota (about 100 recipients/day), shared with the 40 alerts | internal (availability) |
| Default Google Calendar (possibly shared with others) | confidential |
| Admin web app origin (Song DB writes, publishing, the new switch, delete) | XSS here = full admin |
| Script Properties (switches, counters, FS_* ids) | internal |

## 2. Trust boundaries

- B1 Public internet -> Google Form formResponse -> inbox row (anonymous, unbounded, every field attacker-chosen).
- B2 Inbox row -> 10-minute trigger -> MailApp -> third-party mailbox (runs as Daniel).
- B3 Inbox row -> server ib* functions -> Inbox screen DOM (admin origin).
- B4 Inbox screen -> mailto link (leaves the app).
- B5 Inbox row + Song DB -> 9 am trigger -> calendar (may be shared).
- B6 Browser (google.script.run) -> ib* server functions that change state (switches, triggers, delete, test send).
- B7 Bound-script editors (FR-08, accepted) -> code that now also holds Calendar scope and mails strangers.

## 3. Risk register

| ID | Sev | Boundary | Risk (exploit path) | Condition (what to build) | Owner | How QA verifies |
|---|---|---|---|---|---|---|
| IR-01 | High | B1/B2 | **Daniel's Gmail as a mailer to third parties.** A script POSTs rows with victim addresses (fact 1). Each valid row gets one message 20 min later. With cap 30/day: 30 strangers/day, about 900/month, who never wrote; their spam reports land on daniel.vizkaino@gmail.com and Google can limit or suspend sending for the whole account. Plus-aliases (`v+1@x`, `v+2@x`) and Gmail dots defeat a naive 30-day rule, so one victim can be bombed. | (a) **Address key** for the 30-day rule: lower-case; strip `+tag` for every domain; for gmail.com/googlemail.com also drop dots and map googlemail.com to gmail.com. The rule scans **both** response tabs (auto_reply_at + email) so it does not depend on properties. (b) **Skip list**: FS_NOTIFY; any domain containing `danyeloz`; local parts `noreply`, `no-reply`, `donotreply`, `mailer-daemon`, `postmaster`, `abuse`, `bounce*`; an address key seen in more than 3 rows in 24 h. (c) **Burst breaker**: more than 10 new rows in the last 60 min (both tabs) -> no auto-replies for the rest of the Manila day, `IB_AR_PAUSED_<date>` set, **one** notice to Daniel through fsSendCapped_ (counts in its 40). (d) **Per-run cap 5**; daily cap 30 in `IB_AR_COUNT_<yyyy-MM-dd Manila>` (old keys deleted, counted under the lock). (e) Only rows whose Timestamp is after the moment the switch was last turned ON (`IB_AR_ON_SINCE`) and 20 min <= age <= 72 h. (f) Footer in every template, plain text: "You get this one-time note because this address was entered on the form at danyeloz.info. If that was not you, you can ignore it; no more messages will follow." (g) Switch OFF by default; ON only after Daniel approves the templates and the residual (section 5). | exec (auto-reply); supervisor (human line) | Unit (mocks): `v+1@gmail.com`, `V.1@googlemail.com`, `v1@gmail.com` -> 1 send in 30 days; FS_NOTIFY, `x@danyeloz.info`, `noreply@x.io` -> 0; 11 rows in 60 min -> 0 sends, 1 notice to FS_NOTIFY, paused key set; 12 eligible rows -> 5 per run; 31st of the day -> 0; row before IB_AR_ON_SINCE -> 0; 19 min and 73 h -> 0. Grep: footer text in all 10 templates. |
| IR-02 | High | B1/B2/B5 | **First name as a payload.** first_name (60 chars) or the sync `name` is echoed: "Hi Win a prize at evil.example call +1...," arrives from Daniel and Gmail auto-links the domain. This turns IR-01 from a nuisance into phishing carried by Daniel's identity. The same string reaches the calendar (IR-11). | One shared `ibFirstName_(raw)`: fsClean_, take the first whitespace token (sync: first token of `name`), accept only `/^\p{L}[\p{L}'-]{0,23}$/u` (letters, apostrophe, hyphen; no digits, dots, `@`, `/`, `:`); otherwise greet without a name ("Hi,"). Never use last_name, subject, message, company, songs or any other field in the mail. | exec | Unit: `Ana` -> "Hi Ana,"; `José-Luis` kept; `evil.example`, `Win$`, `a@b`, `http://x`, `Ana123`, 25 letters, empty -> "Hi,"; U+202E+`Ana` -> stripped then "Hi Ana,". Unit: body contains none of the row subject/message/company/songs strings. |
| IR-03 | High | B2 | **Duplicate sends and alert starvation.** Overlapping runs (slow run past 10 min, a manual run, a doubled trigger) read the same row before either writes auto_reply_at -> two replies. A run holding the ScriptLock while sending blocks fsOnFormSubmit past its 20 s wait (fact 4) -> alerts dropped. A successful send followed by a failed write -> resend every run. | **Claim, then send, at most once**: under `LockService.getScriptLock().tryLock(5000)` (on failure log "busy" and return; never throw from a trigger) pick up to 5 rows, re-read each and confirm Timestamp + email unchanged, write `auto_reply_at = "sending <ISO>"`, `SpreadsheetApp.flush()`, release. Send **outside** the lock. Re-lock, write the final ISO time and template number (`#1`..`#5`). A row with any non-empty auto_reply_at (including "sending") is never picked again. Lock held only for sheet reads/writes (target < 5 s). | exec | Unit: two interleaved runs over the same 3 rows -> 3 sends total; MailApp mock throws on row 2 -> row 2 stays "sending", next run sends 0 to it; tryLock false -> 0 sends, no throw; the lock is free while sends run (mock records lock state at each sendEmail). |
| IR-04 | Medium | B2 | **Quota starvation.** Auto-replies share the ~100/day with the 40 alerts. | Send only if `MailApp.getRemainingDailyQuota() >= 46` (FS_MAX_MAIL_PER_DAY 40 + 1 cap notice + FS_MIN_QUOTA 5), checked before **each** send; the test send obeys it too. | exec | Unit: remaining 46 -> sends; 45 -> 0, log "quota floor"; remaining 47 then 45 mid-run -> stops after 1. |
| IR-05 | High | B3 | **Stored XSS into the admin app.** Every inbox field is attacker text. One `innerHTML` with `<img src=x onerror=...>` runs in the admin origin, which can call every google.script.run function as Daniel (Song DB writes, publishing, the switch, delete). | InboxViews/InboxApp: text-only DOM (`createElement` + `textContent`, TracksApp `el()` pattern); **zero** `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`, `eval`, `new Function`, string `setTimeout`, data-built `on*=` attributes. Server returns plain strings after fsClean_ (strips bidi/zero-width), each cut to its FS_FORMS max. Long text with CSS `white-space: pre-wrap`. | exec (screen) | Grep InboxApp.html + InboxViews.html: 0 hits for the sink list. Playwright: rows with `<img src=x onerror=window.__x=1>`, `<script>`, `"><svg onload=...>`, U+202E -> `window.__x` undefined, text shown literally, no U+202E in DOM text. |
| IR-06 | High | B4 | **mailto injection.** A hostile email or subject adds `?cc=`, `&bcc=`, `&body=` or a `javascript:` href, so Daniel's reply goes to extra people or carries planted text. | Reply button only when the email passes **FS_EMAIL_RE and length <= 254 on the server and again in the client** (the regex admits no `? & % , ; :`). href = `"mailto:" + addr + "?subject=" + encodeURIComponent("Re: " + subjectOneLine.slice(0, 150))`; no body, no cc. Subject = fsClean_ one-line value. `target="_blank" rel="noopener noreferrer"`. Invalid email -> no button, text "No valid email". | exec | Unit/Playwright: `a@b.co?cc=x@evil.io`, `a@b.co%0Abcc:x`, `"a"@b.co`, `javascript:alert(1)` -> no button; subject `x&bcc=e@v.io` -> href contains `x%26bcc%3De%40v.io`; every href matches `^mailto:[^?]+\?subject=[^&]*$`. |
| IR-07 | Medium | B1/B2 | **Replying to invalid rows** (fact 2): bad choice, oversize text, a tab that is not a form tab. | Before claiming, run the **existing** fsCheck_ over every FS_FORMS field (reuse, no copy); skip on any null. Read only tabs that fsFormOfSheet_ maps to a stored form id; inbox id must equal FS_INBOX_SHEET_ID and differ from FS_SONG_DB_ID (same guard as :262). Find columns by header name on every run. | exec | Unit: topic "Fan Contact\nX", message 4001 chars, bad email, tab without form URL, inbox id == Song DB id -> 0 sends; reordered columns -> right cells. |
| IR-08 | Medium | B6/B7 | **State-changing server functions without an owner check.** Every top-level ib* function is callable via google.script.run. In the documented helper mode (CLAUDE.md:129: "User accessing", "Anyone with Google account") any signed-in Google user could load the app and call ibSetAutoReply(true) or ibInstallTriggers; Script Properties are shared and the trigger then sends **as Daniel**. | Every public ib* function starts with `ibOwner_()`: `Session.getActiveUser().getEmail() === FS_NOTIFY`, else throw "Not allowed" (default deny). Trigger handlers re-check their switch property on **every** run, so OFF stops sends even with triggers installed. Test send takes no address; always FS_NOTIFY; at most 5 a day. | exec | Unit: Session mock `x@gmail.com` -> each public ib* (grep `^function ib[A-Za-z]*\(` without `_`) throws and writes nothing; switch OFF + trigger fires -> 0 sends; test send with an argument -> `to === FS_NOTIFY`; 6th test -> refused. |
| IR-09 | Medium | B6 | **Irreversible delete goes too far.** Wrong date column, wrong spreadsheet, a stale count or a parse failure deletes real or recent rows permanently. | Server only: cutoff = now - 365 days from the **Timestamp** column found by header; unparsable timestamp -> keep; header row never deleted; form tabs of the guarded inbox only (IR-07 guard); delete bottom-up under lock_(). Two steps: `ibRetentionPreview()` -> `{count, cutoffIso}`; `ibRetentionDelete(cutoffIso, count)` recomputes and **refuses** if the count differs. The confirm shows the count. The screen says the Forms responses and Gmail copies need the manual steps (C-2, FI-2). | exec | Unit: rows 366 d, 364 d, blank, "abc" -> only 366 d deleted; Song DB guard -> throws, 0 deletes; preview 3 then a 4th row ages in -> refused; header intact. |
| IR-10 | Medium | B3/B6 | **Row identity drift.** Status and auto_reply_at writes address rows by number; a delete, a sort or a filter in the sheet shifts rows, so "Done" or auto_reply_at lands on another message (double reply or none). | Each row write carries `(tab, row, timestampIso, emailKey)`; the server re-reads and writes only on a match, else "List changed, reload". Status only `New`, `Replied`, `Done`, written with safeText_. All writes under the same ScriptLock as retention. | exec | Unit: delete row 2 then update "row 3" with its old timestamp -> refused; status `=HYPERLINK(...)` -> rejected; `Done` -> written. |
| IR-11 | Medium | B5 | **Calendar privacy.** Default calendars are often shared (family, assistant, "see all event details", public free/busy). Names, topics and free-text song names leak PII; free text can carry URLs that Calendar auto-links; guests would be emailed. | `createEvent(title, 09:00, 09:15 Manila, {description})` with **no guests, no sendInvites, no location**; then `setVisibility(CalendarApp.Visibility.PRIVATE)`. Lines only from type (Contact/Sync), ibFirstName_ (IR-02), topic from the fixed choice list, age in days; sync rows show "Sync request" without songs/company/project; releases from the Song Database (title + date). No email, last name, subject, message, budget, URL. At most 20 lines, then "+N more". Title holds counts only. | exec (digest) | Unit (CalendarApp mock): no guests/sendInvites/location; setVisibility(PRIVATE) called; description has no `@`, no `http`, none of the row subject/message/company/songs strings; 25 open rows -> 20 lines + "+5 more". |
| IR-12 | Medium | B5 | **Duplicate or wrong-day events.** Retries, a second trigger, or a non-Manila project time zone. | Day key = `Utilities.formatDate(now, "Asia/Manila", "yyyy-MM-dd")`; under the ScriptLock: if `IB_DIGEST_DONE_<day>` is set **or** the default calendar has an event that day tagged `ibDigest=<day>` (setTag), do nothing; else create, tag, set the property. Nothing open -> no event. Trigger `.atHour(9).everyDays(1).inTimezone("Asia/Manila")`; start computed in Manila. Digest switch re-checked every run. | exec | Unit: two runs same day -> 1 createEvent; property missing but tagged event present -> 0; nothing open -> 0; clock 01:05 UTC -> start 09:00 Manila. |
| IR-13 | Medium | B6 | **Trigger install breaks other triggers or piles up** (deletes fsOnFormSubmit/TikTok, or 3 x 10-minute triggers multiply IR-03). | `ibInstallTriggers()` under lock_(): delete only triggers whose handler is `ibAutoReplyTick` or `ibDigestTick`, then create exactly one each. `ibRemoveTriggers()` deletes only those two. Screen shows the count per handler. | exec | Unit (ScriptApp mock with fsOnFormSubmit, TikTok, 2 old ib triggers): install twice -> exactly 1 per ib handler, others untouched; remove -> 0 ib, others untouched. |
| IR-14 | Low | B2 | **Template and header content.** Editable templates, an echoed subject ("Re: <their subject>") or links become spam/phishing channels and hurt deliverability. | 10 templates (5 contact, 5 sync) are **constants in code**; constant subject per set; **no links**, the site named as plain text in the footer only. One send site `ibMail_`: `MailApp.sendEmail({to, subject, body, name: "Danyel OZ", replyTo: FS_NOTIFY})`; no htmlBody, cc, bcc, attachments, inlineImages; `to` is one validated address. | exec | Grep: one `MailApp.sendEmail` in Inbox code; templates contain no `http`, `www.`, subject placeholder. Unit: message keys exactly {to, subject, body, name, replyTo}. |
| IR-15 | Low | B7 | **Least privilege.** CalendarApp needs the full Calendar scope, held by a bound script Song DB editors can change (FR-08, accepted). | Use only `getDefaultCalendar`, `createEvent`, `getEventsForDay`, `setTag`/`getTag`, `setVisibility`. SETUP.md explains the new permission and extends the FR-08 warning (a Song DB editor could now also use the calendar and mail strangers). No GmailApp, no DriveApp. | exec (docs) | Grep: CalendarApp calls only from that list; no GmailApp/DriveApp. QA reads SETUP.md. |
| IR-16 | Low | all | **PII in logs and errors.** | Logs: counts, template numbers, form key, reason codes only; no email, name, subject, row text, description. Catch blocks log a fixed string; errors to the screen are generic. | exec | Unit: capture Logger.log over a full run with marker strings in every field -> no marker logged. |
| IR-17 | Low | B1 | **New columns leak into alerts.** fsReadAnswers_ (:328) turns any non-empty unmatched column into an "Other answer". | Add status/auto_reply_at after the last form column, by header name; FormsSetup.gs logic unchanged. | exec, qa | Unit: e.range spanning the two empty new columns -> no "Other answer (status" or "(auto_reply_at" in the alert. |

## 4. Answers to the focus questions

1. **Is the charter rule set enough?** No. It leaves three gaps: alias bypass (IR-01a), the first-name payload
   (IR-02), no reaction to a flood (IR-01c). Never auto-reply to Daniel's own address or domains: **required**
   (IR-01b; also prevents loops). Disposable-domain lists: **not required** (stale, low value); the burst breaker
   covers the abuse that matters. "Skip when honeypot/fill time could not be checked server side" is **always** true
   (fact 1), so as a rule it means never replying; the controls above replace it, the residual goes to the human.
2. **Templates**: no links; site named in plain text in the footer; constant subject; first name via ibFirstName_.
3. **Inbox screen**: IR-05, IR-06, IR-08 (owner check on top of "Only myself"). The 1-year delete removes inbox rows
   only; the Google Forms copy and Gmail copies stay (FI-2), and the screen says so (IR-09).
4. **Calendar**: IR-11, IR-12. 5. **Triggers**: IR-03, IR-08, IR-12, IR-13, IR-15. 6. **Logs**: IR-16.

## 5. Residual risk (human line in report.md before the switch goes ON)

With every condition met, a stranger who scripts the public form can still make Daniel's Gmail send **one fixed,
link-free, honestly worded note to each of up to 30 addresses a day** (fewer once the burst breaker trips), for as
long as the switch is ON; turning it OFF ends the exposure within 10 minutes. Rating after controls: Medium.
Inherited/accepted: full Calendar scope (IR-15) and FR-08 (bound script), now extended to calendar and outbound mail.

## 6. Not reviewed

Implementation (none exists yet); Google row insertion when a form question is added (header lookup mitigates);
Gmail spam thresholds; the Playwright harness; privacy-policy wording beyond mentioning the automatic note.
