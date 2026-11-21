# Charter — r-20261121-2308-inbox-autoreply-digest

## Goal
Give Daniel an Inbox screen in the admin app for the new form replies, an automatic reply about 20 minutes
after each message (one of 5 replies in Daniel's voice, picked at random), and a 9 am Manila to-do event on
Daniel's Google Calendar every day, because Daniel is busy and may miss messages.

## Facts from Daniel (Nov 21, 2026)
- Wants: Inbox screen (yes), auto-reply within about 20 minutes with 5 different random replies, a calendar
  to-do list every day at 9 am Manila time.
- Replies live in the private inbox spreadsheet created by FormsSetup.gs (Script Property FS_INBOX_SHEET_ID),
  one tab per form; contact fields first_name, last_name, email, topic, subject, message; sync fields name,
  email, company, songs, project, media, territory, term, timeline, budget, notes (see FormsSetup.gs FS_FORMS).
- Notifications: FormsSetup.gs sends Daniel up to 40 alerts a day; MailApp consumer quota about 100/day.

## Acceptance criteria
- C-1 Inbox screen: new nav button "Inbox" in Form.html with InboxViews.html + InboxApp.html (pattern of the
  other screens), reading only the private inbox (never the Song Database): combined list of contact and sync
  messages, newest first; filters (type, topic, status) and search; message detail; status New / Replied / Done
  stored in an extra "status" column (and "auto_reply_at") on each response tab, added by header name; a Reply
  button that opens a mailto to the sender's validated address with "Re: <subject>" in a new tab; text-only DOM.
- C-2 Retention helper: "Older than 1 year" shows a count and, after a confirm, deletes those rows from the
  inbox sheet only; the screen says the Google Forms responses and Gmail copies still need the manual steps.
- C-3 Auto-reply: 5 reply templates in Daniel's voice (one set for contact, the sync set says a quote comes
  within 3 business days), first name only as personalisation, never quoting any submitted text; a 10-minute
  time trigger sends to rows at least 20 and at most 72 hours old that have no auto_reply_at, picked at random;
  safety: master switch OFF by default (Script Property), valid email only (same strict regex as FormsSetup),
  one auto-reply per address per 30 days, daily cap 30 auto-replies that also leaves a floor in the MailApp
  quota for Daniel's alerts, no replies to rows flagged invalid by FormsSetup checks, plain text only, sender
  name "Danyel OZ", replyTo daniel.vizkaino@gmail.com, records auto_reply_at and the template number; the
  Inbox screen shows the switch, previews all 5 templates and a "send me a test" button that sends one to
  daniel.vizkaino@gmail.com.
- C-4 Daily 9 am digest: a daily trigger at 9 am Asia/Manila creates one 15-minute event on Daniel's default
  calendar titled like "To-do: 3 messages, 1 release" with a plain description listing open messages (type,
  first name, topic or song, age; no email addresses or message text) and Song Database releases in the next
  7 days; no event when there is nothing; never two events on the same day; a switch in the Inbox screen.
- C-5 Setup: one function Daniel runs (or buttons in the Inbox screen) installs/removes the 10-minute and
  9 am triggers idempotently; new permissions (Gmail send already granted; Calendar is new) explained in
  SETUP.md; unit tests with mocks (SpreadsheetApp, MailApp, CalendarApp, ScriptApp, PropertiesService,
  LockService, Utilities) and a Playwright screen test at 1400 and 390.
- C-6 Docs: CLAUDE.md = HANDOFF.md, SETUP.md, tests/README.md, privacy policy mentions the automatic
  confirmation reply.

## Constraints
Admin app rules (.claude/skills/admin-app/SKILL.md): lock_, safeText_, unique global prefix (ib*/IB_*),
grep for clashes; only daniel.vizkaino@gmail.com as Daniel's address; voice rules; no gendered pronouns for
Daniel; no PII in logs; nothing pushed until QA and security pass. The auto-reply stays OFF until Daniel
approves the 5 templates.

## Non-goals
Replying with AI-written personal answers; reading Gmail; Google Tasks API; changing the public widgets.

## Tier
T2: sends email to addresses typed by the public, reads personal data, writes to Daniel's calendar.
Planner skipped (design fixed above from Daniel's requests and the previous run); recorded as a deviation.

## Roles and gates
Supervisor, security (design + implementation), executor x3, qa. G1 = this charter + security design review.

## Budget
Security 15 min; executors 30 min each; QA 25 min; security 15 min.

## G1 (Nov 21): security design review PASS_WITH_CONDITIONS; all IR-01..IR-17 conditions are done-criteria.
Fixed server API (so the two build tasks can run in parallel), file Inbox.gs, prefix ib*/IB_*:
- getInboxData() -> {items:[{type:'contact'|'sync', row, rowKey, date, firstName, name, email, emailOk,
  topic, subject, songs, company, project, media, territory, term, timeline, budget, message, notes,
  status, autoReplyAt, autoReplyTemplate}], counts, oldCount, settings:{autoReply, digest, capPerDay,
  sentToday, paused}, templates:{contact:[5 x {subject, body}], sync:[5 x {subject, body}]}, triggers:{autoReply, digest}}
- setInboxStatus(type, row, rowKey, status) status in New|Replied|Done
- previewOldRows() -> {count, token}; deleteOldRows(token, count)
- setAutoReply(on) ; setDigest(on) ; sendAutoReplyTest(type, n) (to daniel.vizkaino@gmail.com only)
- installInboxTriggers() ; removeInboxTriggers()
- trigger handlers: ibAutoReplyTick (every 10 min), ibDailyDigest (daily 9 am Asia/Manila)
All server functions the screen calls check the effective user is the script owner (IR-08).
