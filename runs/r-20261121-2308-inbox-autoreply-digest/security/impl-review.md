# Implementation security review (pre-G4): Inbox, auto-reply, digest

Run r-20261121-2308-inbox-autoreply-digest - T2 - reviewer: security - 2026-11-21
Subject: the code on disk, not the receipts. `apps-script/Inbox.gs` (read in full), `InboxApp.html` (DOM helper, mailto, sinks),
`InboxViews.html` (sinks, CSS), `Form.html` (nav button and the two includes only), the `FormsSetup.gs` helpers it reuses
(fsFormOfSheet_, fsReadAnswers_, fsClean_, fsValidEmail_, fsCheck_, fsSendCapped_), `Code.gs` lock_/safeText_,
`docs/SETUP.md` section 11, the unit test case list.

## Executed evidence
- `env -u GITHUB_TOKEN -u GH_TOKEN node tests/unit/test_inbox.js apps-script` -> `test_inbox: all checks passed (13 .gs files checked for clashes)`.
- `node tests/ui/build.js && node tests/ui/ib.js` -> planted payloads `{"ibx":"undefined","els":0,"rlo":false}`, `errors []`; the delete confirm shows the count and the manual-steps text.
- Sink grep over InboxApp.html + InboxViews.html (innerHTML, outerHTML, insertAdjacentHTML, document.write, eval, new Function, string setTimeout, on*= attributes): 0 hits. `h()` maps `on*` keys to addEventListener; keys are code literals; data reaches only `text` and the mailto `href`.
- Throwaway probe (FormsSetup.gs + Code.gs + Inbox.gs in a vm with Session/Properties mocks; deleted afterwards): results quoted under the findings.

## Per-risk status (IR-01..IR-17)

| ID | Was | Status | Evidence |
|---|---|---|---|
| IR-01 | High | **closed (controls); residual remains, needs the human line** | (a) `ibAddrKey_` Inbox.gs:581 (probe: `V.1+a@GoogleMail.com` -> `v1@gmail.com`); 30-day rule from auto_reply_at of both tabs, `ibPick_` :331-350. (b) `ibSkipAddr_` :593 (probe: `noreply+x@x.io`, `no.reply@gmail.com`, `x@mail.danyeloz.info`, `Daniel.Vizkaino+z@googlemail.com`, `postmaster@x.io` all skipped); more than 3 rows/24 h per key :348. (c) more than 10 rows/60 min -> `IB_AR_PAUSED_<day>`, one notice via fsSendCapped_ :264-291; later runs return paused :254. (d) 5 per run, 30 per day, counted under the lock at claim :269-280, given back on quota undo :318-321. (e) `at <= since` and 20 min..72 h :345; `IB_AR_ON_SINCE` reset only on an off->on edge :162. (f) IB_FOOTER in every mail :611. (g) missing property = off :252. |
| IR-02 | High | **closed** (Low note NF-03) | `ibFirstName_` :600: fsClean_ + first token + IB_NAME_RE :38; probe: `evil.example`, `Ana123`, 25-letter phrase -> empty; U+202E/U+200B/U+2066 stripped. Body = greeting + constant template + footer only :611. |
| IR-03 | High | **closed** | tryLock(5000) else return busy :257; claim re-reads via `ibFresh_`, requires empty auto_reply_at, writes `sending <ISO>`, flush, release :272-285; send outside the lock :295-305; a failed send leaves "sending", never picked again :343; record under a second tryLock; the "unrecorded" path never resends :308. Handlers wrap in try/catch :237-245. Unit section "claim, send outside the lock" passes. |
| IR-04 | Medium | **closed** | Floor 46 before the run :255 and before each send :296 (46 sends, 45 stops); the test send obeys it :191. |
| IR-05 | High | **closed** | 0 sinks; Playwright planted `<img onerror>`/`<svg onload>`/U+202E -> `window.__x` undefined, 0 planted elements, no U+202E. Server values fsClean_ and cut to FS_FORMS max :553; `pre-wrap` CSS. |
| IR-06 | High | **closed** | Button only if server `emailOk` (FS_EMAIL_RE, max 254, raw == cleaned) :559 and client `IB_EMAIL_RE` + length InboxApp.html:44-47; href `mailto:addr?subject=encodeURIComponent(...)` only :48-51; `target=_blank rel=noopener noreferrer` :134. Probe: `a@b.co?cc=x@e.io` invalid. |
| IR-07 | Medium | **closed** | `ibValidRow_` reuses fsCheck_ on every field :576 before pick :346; tabs only via fsFormOfSheet_ :475; inbox != Song DB and != active book, Song DB id required for ticks :461-468; headers by name each call :495. |
| IR-08 | Medium | **partial**, see NF-01, NF-02 | All 9 screen functions call `ibOwner_` first; switches re-checked every run :252, :365; test send fixed to FS_NOTIFY, 5/day :186-206. The owner rule changed (T-002 "Fix: owner check") from "active == FS_NOTIFY" to "active == effective", which does not hold in the documented helper deployment. |
| IR-09 | Medium | **closed** | Cutoff now - 365 d from the Timestamp header; unparsable -> kept :519-523, :571; guarded inbox only; bottom-up under lock_ :144-148; header protected :147; count recomputed and must match :143; 15-min token :135. Rows swapped between preview and delete can only be rows older than 365 d (recomputed), which is the policy. |
| IR-10 | Medium | **closed** | `(type,row,rowKey)` re-read by `ibFresh_` (Timestamp ISO + address key) :530-536 for status and auto_reply_at writes; status allow-list :108; `safeText_` on every write :548; all under the ScriptLock. |
| IR-11 | Medium | **closed** | `createEvent(title,start,end,{description})` only, then PRIVATE :380-381; lines: type, filtered first name, choice-checked topic, age; sync shows no songs/company :417-424; 20 lines + "+N more" :411-414; title counts only :378. |
| IR-12 | Medium | **closed** | Manila day key :651; property or tagged event -> no second event, under the lock :370-375; nothing open -> none :377; trigger atHour(9).everyDays(1).inTimezone(FS_TZ) :215; start 09:00+08:00 :372. |
| IR-13 | Medium | **closed** | `ibDeleteTriggers_` touches only the two ib handlers :644-649, then one each, under lock_ :209-221; unit "triggers" (install twice) passes. |
| IR-14 | Low | **closed** | Link-free constant templates :49-83; one `MailApp.sendEmail`, keys {to,subject,body,name,replyTo} :625; `to` re-validated there. |
| IR-15 | Low | **closed** | Calendar calls limited to getDefaultCalendar/createEvent/getEventsForDay/getTag/setTag/setVisibility; no GmailApp/DriveApp. SETUP.md:122/128 explain the scope and extend FR-08 (one false sentence, see NF-01). |
| IR-16 | Low | **closed** | Every Logger.log in Inbox.gs carries counts, template numbers, form keys or fixed strings; catch blocks log fixed strings :239, :244, :303. |
| IR-17 | Low | **closed** | `ibWrite_` appends status/auto_reply_at after the last column by header name :539-549; FormsSetup.gs logic unchanged; fsReadAnswers_ reads only the `e.range` width; unit case test_inbox.js:186 passes. |

## New findings

### NF-01 Medium: the owner check admits any Google user in the documented helper deployment; SETUP.md says the opposite
- Boundary: B6/B7 (browser -> google.script.run -> Script Properties shared with the owner triggers).
- Evidence: `ibOwner_` Inbox.gs:439-442 allows when `active === effective`. CLAUDE.md:127 documents a helper mode "Execute as User accessing the web app, access Anyone with Google account". In that mode `Session.getEffectiveUser()` is the visitor, so active == effective for **every** visitor who authorizes the app.
- Probe (active = effective = helper@gmail.com): `setAutoReply(true)` returned `{"autoReply":true,...}` and wrote `IB_AUTO_REPLY=on`. Script Properties are project-wide, so the `ibAutoReplyTick` trigger that Daniel installed then mails strangers **as Daniel**, possibly before he approved the templates.
- `docs/SETUP.md:122` says anyone else who opens the app gets "Not allowed", also in the helper-sharing mode. That is false, so the FR-08 acceptance would rest on wrong facts. Unit tests mock the effective user as a fixed owner, so this case is untested.
- Exploit path: deployment switched to helper mode (as documented) -> anyone with a Google account and the /exec URL (not only the Editor helper) calls `setAutoReply(true)`, `setDigest(...)` or `setAutoReply(false)`. Impact is bounded by the IR-01 controls (at most 30 link-free notes a day as Daniel) plus switching the feature off. Delete needs inbox read access, which the visitor lacks.
- Why not High: not reachable in the current deployment (Execute as Me, Only myself: effective is always Daniel and only Daniel can load the app). An Editor helper already has equivalent power under the accepted FR-08.
- Mitigation (owner: executor; doc fix before G4, code before helper mode is ever used): pin the identity, not only equality. Add a constant `IB_OWNER` in Inbox.gs holding the script-owner account Daniel confirms, and in `ibOwner_` require `u.active === u.effective && u.effective === IB_OWNER.toLowerCase()`; unit case: active = effective = stranger -> "Not allowed", zero writes. If the code is not changed, correct SETUP.md:122 (in helper mode any signed-in visitor can change the switches; do not use helper mode while auto-reply is ON).

### NF-02 Low: trigger handlers can be called from the page; a blank active user is trusted
- Evidence: `ibAutoReplyTick` and `ibDailyDigest` are public, so `google.script.run.ibAutoReplyTick()` works for anyone who can load the app. `ibTriggerUser_` :450-453 accepts a blank active user. Probe: Execute as Me + Anyone, consumer visitor (blank active) -> `ibOwner_` refuses (correct) but `ibTriggerUser_` returns true, so that visitor can run the tick and the digest **as Daniel** on demand.
- Answer to the T-002 question: in the current deployment (Execute as Me, Only myself) only Daniel can load the app, so only Daniel can invoke them through the page (Song DB editors can through the script editor: FR-08). active == effective is sound for the screen in that deployment only (NF-01 covers the other mode). For triggers the blank-active branch is needed (time triggers often report a blank active user) but cannot tell a trigger from an anonymous page caller under Execute as Me + Anyone.
- Impact: acceleration only. Every run still obeys the switch, 5/run, 30/day, the age window, the burst breaker and the once-a-day digest key.
- Mitigation (owner: executor, follow-up): accept a run only when the event object proves a trigger: `function ibAutoReplyTick(e) { if (!ibFromTrigger_(e, IB_TICK_HANDLER)) return; ... }`, where `ibFromTrigger_` checks `e && e.triggerUid` and that `ScriptApp.getProjectTriggers()` holds a trigger with `getUniqueId() === String(e.triggerUid)` and that handler. The page cannot know the uid.

### NF-03 Low: the first-name filter admits look-alike letters
- Evidence: probe with fullwidth "Ana" (U+FF21 range), a Cyrillic/Latin mix spelling "PaypaI", and `xn--ana` all pass IB_NAME_RE. No dot, digit or colon passes, so nothing becomes a link; worst case is an odd word in "Hi <word>,".
- Mitigation (follow-up): NFKC instead of NFC in `ibFirstName_` :601, and refuse mixed scripts (all letters `\p{Script=Latin}`, or all from one other script).

### NF-04 Low: the digest holds the ScriptLock across the Song DB read and Calendar calls
- Evidence: `ibDigestRun_` :367-388 calls `getSongs()`, `getEventsForDay` and `createEvent` inside the lock. fsSendCapped_ waits 20 s; a slow run could drop one form alert (the IR-03 starvation pattern), once a day at 9 am.
- Mitigation (follow-up): set `IB_DIGEST_DONE_<day>` = "making" under the lock, release, do the reads and calendar calls, re-lock to set "1".

## Not reviewed
InboxApp.html beyond the DOM helper, mailto and sink grep; tests/ui/mock.js; unit test bodies (section titles and pass result only). Session behaviour per deployment mode comes from Apps Script documentation and the mocked probe, not a live test (no live system touched).

## Verdict
No open Critical or High. IR-08 is partial with one Medium (NF-01) under a condition. **G4 security verdict: PASS_WITH_CONDITIONS.**

Conditions:
1. NF-01 (Medium, owner executor, before G4): pin the owner identity in `ibOwner_` with its unit case, or correct SETUP.md:122. Until the code fix lands, helper mode must not be used while auto-reply can be ON.
2. Auto-reply stays OFF until Daniel records the residual sentence below in report.md (IR-01g).
3. NF-02, NF-03, NF-04: Low follow-ups.

## Residual risk sentence (Daniel must accept before switching auto-reply ON)
"I accept that, from the moment I switch automatic replies ON until I switch them OFF, anyone who submits my public forms with other people's email addresses can make my Gmail account send up to 30 short, link-free notes a day (at most one per address in 30 days, paused for the rest of the day after more than 10 forms in an hour) to strangers who never wrote to me, and that their spam reports could limit or suspend sending from daniel.vizkaino@gmail.com; I will switch it OFF in the Inbox screen if I get a burst notice, bounces or spam complaints."
