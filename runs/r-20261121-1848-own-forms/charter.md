# Charter — r-20261121-1848-own-forms

## Goal
Replace the Cognito contact form with Danyel OZ's own site-styled forms, and give the sync catalogue a real
"Sync license request" form, with Google Forms as the free backend: replies land in a private Google Sheet
and Daniel gets an email for each one.

## Facts from Daniel (Nov 21, 2026)
- Wants "own look, Google backend": site-styled form widgets embedded in Sites; submissions stored by Google
  Forms. Replace Cognito after Daniel tests the new form (Daniel swaps it in; Cognito stays live until then).
- Current Cognito form (cognitoforms.com/DanyelOZ/ContactCollaborations): Name (First, Last) required, Email
  required, "What would you like to contact me about?" required radio: Fan Contact, Music Collaborations,
  Beat Licensing & Instrumentals, Media & Business Inquiries, General Inquiries; Subject required; Message
  required ("Tell me how I can help.").
- Notifications go to daniel.vizkaino@gmail.com (the only email allowed in public content).
- Claude cannot build Google Form questions through the Drive connector; Daniel runs a one-time Apps Script
  setup function in the existing admin Apps Script project.

## Acceptance criteria
- C-1 Setup script: a new Apps Script file (prefix fs*/FS_*) with one function Daniel runs once
  (e.g. setupDanyelOzForms) that is safe to re-run (idempotent: reuses forms by stored id), creates two Google
  Forms ("Danyel OZ contact" and "Sync license request") with the fields below, links both to one private
  responses spreadsheet ("Danyel OZ Inbox (private)", never the public Song Database), installs submit
  triggers that email daniel.vizkaino@gmail.com a plain-text summary (Reply-To set to the sender only when
  their email is valid; subject stripped of newlines), and prints a JSON block with each form's public
  formResponse URL and the entry ids for every field. Unit-tested with Node mocks of FormApp,
  SpreadsheetApp, ScriptApp, MailApp, PropertiesService.
- C-2 Contact form widget: a new danyeloz-embeds/contact.html in the site's look, same fields as Cognito plus
  a "Sync & Licensing" topic, required-field checks, a success message, an error/fallback that shows the
  email address as text; works inside the Google Sites sandbox (allow-scripts allow-popups allow-forms
  allow-same-origin); no new tab needed to submit.
- C-3 Sync request form: the catalogue's request panel shows an inline "Sync license request" form (name,
  email, company or production, song or songs prefilled from the button, project, media type, territory,
  term, timeline, budget range optional, notes) that submits in place; the email fallback stays.
- C-4 Shared, safe submit code (one shared file used by both widgets): POST with mode no-cors to the Google
  formResponse endpoint read from a public config file in danyeloz-embeds (e.g. data/forms.json, written
  after Daniel runs setup), only to docs.google.com/forms/d/e/<id>/formResponse; text-only DOM; honeypot
  field and a minimum fill time against bots; length limits; no third-party scripts; if the config is
  missing or invalid the form is replaced by the email fallback.
- C-5 Privacy: docs/legal/privacy-policy.md updated (forms now go to Google Forms, stored in Daniel's private
  Google Sheet, used only to reply); widgets show a one-line privacy note linking to the site's Privacy page.
- C-6 Tests: unit (setup script, shared submit code), Playwright for both widgets at 1400 and 390 px
  including the Sites sandbox, planted HTML in inputs, bot cases (honeypot, too fast), missing config, and
  the existing sync widget tests still green.
- C-7 Handbook (CLAUDE.md and HANDOFF.md) and docs/SETUP.md describe the forms and Daniel's one-time steps.

## Constraints
Widget rules (CLAUDE.md section 5), voice rules, no gendered pronouns for Daniel, only
daniel.vizkaino@gmail.com. Apps Script globals shared across files (grep for clashes). Nothing pushed until
QA and security pass; Daniel publishes Sites and retires Cognito himself.

## Non-goals
Running the setup in Daniel's Google account (Daniel does it); a custom server; storing replies in the public
Song Database; CAPTCHA services.

## Tier
T2 — rationale: collects personal data (names, emails, messages) and sends email on Daniel's behalf.

## Roles and gates
Supervisor, planner, security (design + implementation), executor(s), qa, monitor. G1 with security design
review, G2 per task, G3 QA, G4 release.

## Budget
Planner 15 min; up to 3 executor tasks of 30 min; QA 25 min; security 2 x 15 min.

## Supervisor decisions after planning (G1 input)
- D-1 Budget raised: 5 executor tasks (~240 min agent time) accepted; docs task kept.
- D-2 Privacy page is https://www.danyeloz.info/about/privacy (checked: 200; /privacy is 404). Overrides
  plan.md's assumed /privacy. Terms page: https://www.danyeloz.info/about/terms.
- D-3 Topic order with "Sync & Licensing" right after "Beat Licensing & Instrumentals" accepted.
- D-4 (FR-08, Daniel Nov 21): FormsSetup.gs goes INSIDE the bound admin Apps Script project (option B).
  Accepted risk, documented in CLAUDE.md/SETUP: any Editor of the Song Database can change the script and
  its triggers run as Daniel; do not give Editor access without accepting this.
- D-5 (FR-12, Daniel Nov 21): form replies are kept for 1 year, then deleted. Privacy policy says so.
- D-6 (FR-04c): no pinned form ids in code; the supervisor compares forms.json ids with the setup output
  before every push, and forms-core.js bounds the id format/length and parses the URL.
- D-7 (FR-03): the submit trigger is installed on the inbox spreadsheet (onFormSubmit of the spreadsheet),
  rewriting formula-looking cells in e.range as text, and identifying the form from the sheet name/link;
  this overrides plan.md section 3 step 5.
- G1 accepted with all FR conditions from security/design-review.md section 4 as done-criteria.
- D-8: accepted T-003 deviations: one inbox-spreadsheet trigger (per D-7); invalid or header-injecting emails send no notification (row kept).
- D-9: T-007 scope widened by supervisor to tests/widgets/catalogue.js (script list check made exact).
- D-10: FI-1 fixed (FS_SONG_DB_ID guard, neutralize first), FI-2 fixed (SETUP step 7 =1+1 check, step 11 deletes Forms responses, sheet rows, Gmail copies; policy matches).
- D-11: Q-1 accepted: executor widget suites (re-run by QA and supervisor) stand as C-2/C-3 evidence; QA role has no Write tool so its browser probe could not be added. Daniel's live test (SETUP step 7) is the final check. D-1 (S3) sent to executor: neutralize only when the event spreadsheet is the stored inbox.
