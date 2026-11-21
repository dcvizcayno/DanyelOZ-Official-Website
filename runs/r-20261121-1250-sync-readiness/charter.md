# Charter — r-20261121-1250-sync-readiness

## Goal
Make the Danyel OZ catalogue sync-ready for music supervisors, closing the seven gaps in the sync
manager's review (Nov 18, 2026, score 22.5%): per-track metadata, a licensing catalogue, instrumental and
clean versions, stems and cutdowns, rights clarity, a stated licensing process, and a supervisor one-sheet.
Data is entered in the private admin app (Apps Script), stored in the Song Database, and shown on
danyeloz.info through widgets in the public repo danyeloz-embeds.

## Facts from Daniel (Nov 21, 2026)
- Owns 100% of masters and publishing; one-stop (one signature clears both). The site footer shows
  "Danyel OZ, LLC." (entity name to confirm).
- Registered with a PRO other than FILSCAP; name not given yet (must be a setting, blank-safe).
- Some songs have instrumentals or stems; marked per song.
- Licensing reply promise: within 3 business days.
- daniel.vizkaino@gmail.com on the contact page is Daniel's correct second email (confirmed Nov 21); use it as
  the licensing contact. Never use or publish any other address.

## Intake: live contact page (danyeloz.info/about/contact-collaborations, read Nov 21)
Sections: Let's Connect; Music Collaborations; Beats Licensing & Instrumentals; Media & Business Inquiries
(lists sync licensing); General Inquiries; Get in Touch (Email: daniel.vizkaino@gmail.com, YouTube, Spotify,
Apple Music, Amazon Music, Deezer links). No rights statement, no turnaround, no process, no one-sheet.
ABOUT menu already has Terms and Privacy pages.

## Acceptance criteria
- C-1 Metadata: each song in the `tracks` tab can carry public sync fields: BPM, key, moods (from a fixed
  list), sync genre, writers, producers, vocal type, explicit, and availability flags (instrumental, clean,
  stems, 30 s cutdown, 60 s cutdown) plus a "featured on one-sheet" flag. Missing columns are added by
  header name, never by position, and existing data is untouched.
- C-2 Admin app: the Tracks screen (or a new Sync screen) lets Daniel view and edit those fields per song,
  validates them (BPM 40–220 whole number, key from a fixed list, moods from the fixed list, max 10
  featured), saves through `lock_()`/`safeText_`, and shows a readiness count (songs complete vs missing).
  Unit tests (Node mocks) and a Playwright screen test at 1400 and 390 px pass.
- C-3 Catalogue widget: a new `sync.html` in danyeloz-embeds lists released songs (first_release today or
  earlier) with title, cover, mood, genre, BPM, key, vocal, explicit, availability badges and a listen link;
  filters by mood, genre, tempo range, key, vocal and availability, plus search; a "Request a license" link;
  text-only DOM, https-only links on allowed domains, fallback when the sheet fails, no sideways scroll at
  390 px; tested with mocked CSV including planted bad data.
- C-4 One-sheet: a new `sync-one-sheet.html` shows the rights line, contact and turnaround, and 8–10
  featured songs with mood, genre, BPM, key and availability; it prints to one A4/Letter page (print CSS)
  and falls back to the newest complete songs when fewer than 8 are featured.
- C-5 Rights clarity: the catalogue, the one-sheet and the contact page state master and publishing
  ownership (100%, one-stop) and PRO registration from one shared settings source; nothing claims a PRO
  name until Daniel sets it.
- C-6 Licensing contact and process: replacement copy for the contact page adds a "Sync & Licensing"
  section: the rights statement, what to send, the 3-business-day reply promise, the steps (request, quote,
  agreement, delivery of files), and links to the catalogue and one-sheet. Delivered as paste-ready text
  plus the embed code; edits made in the Sites editor as a draft only.
- C-7 Workflow: the multi-agent team pack is installed in the private repo, its validator and tests are
  green, and the handbook (CLAUDE.md and the HANDOFF.md copy) says when to use `/team-run`.

## Constraints
- Daniel publishes Google Sites himself; nothing is published, and no public page goes live, without his
  explicit yes. Widgets are pushed to GitHub Pages only after his OK.
- The Song Database is public: only data safe for anyone to read goes there (no stem file links, no
  private notes). Stem and instrumental files stay private and are sent on request.
- Widget rules (CLAUDE.md section 5): read by header name, text-only DOM, https links on the platform's own
  domain, `#RRGGBB` colours, always a fallback, size to the box, test at 390 px with planted bad data.
- Apps Script globals are shared across files: prefix new helpers (`sy…`), grep for duplicates.
- Bulk writes to the sheet need a preview and counts first. No sheet writes in this run except adding
  empty columns through the app on first use.
- Voice: simple, honest, light humour, no em dashes, none of narrator/delve/tapestry/foster.
- Commits as Danyel OZ <daniel.vizcayno@gmail.com>; tests run with `env -u GITHUB_TOKEN -u GH_TOKEN`.

## Non-goals
- Producing stems, instrumentals or cutdowns; pitching to supervisors; contracts or pricing.
- Automatic BPM/key detection from audio (possible follow-up).
- Filling the metadata for every song (Daniel enters it; the app makes it fast).
- Changing the email shown on the contact page (confirmed correct).

## Tier
T2 — rationale: public website content with legal-weight rights statements, a public data schema change,
and new public pages; no auth or money. Publishing is a human-approval step (G0 for that action).

## Roles and gates
Supervisor (main session), researcher x2, planner, executor (one per task), qa, security, monitor.
Gates G0 (this charter, Daniel's answers above), G1 plan, G2 per task, G3 QA, G4 release (QA pass,
security no open High, monitor green) before anything is pushed or published.

## Budget
One session; waves of at most 4 workers; 20 min / 25 tool calls per task; stop-loss at 2x.

## Assumptions
- A-1 Sync fields live in the public `tracks` tab (one row per ISRC), since one song appears on several
  releases; release-level data stays in Sheet1.
- A-2 A shared settings block (rights line, PRO name, licensing email or form link, turnaround) lives in
  one place readable by both widgets (a `sync_settings` tab or a JSON file in danyeloz-embeds), edited
  from the admin app.
- A-3 The fixed mood list follows common library taxonomies (researcher to confirm, 15–25 moods).
- A-4 Confirmed by Daniel (Nov 21): the rights holder named in the statement is "Danyel OZ, LLC" (owns 100%
  of masters and publishing). Kept as an editable setting.

## Supervisor decisions after recon (Nov 21, from research T-001 and T-002)
- D-1 Sync fields are new header-matched columns in the public `tracks` tab, added only by a new `Sync.gs`
  (`sy*` / `SY_*` names), never via `TRACK_COLUMNS` and never on `release_tracks`. Names use a `sync_`
  prefix: sync_bpm, sync_key, sync_moods, sync_genre, sync_genre_2, sync_vocal, sync_writers,
  sync_producers, sync_instrumental, sync_clean, sync_stems, sync_cut60, sync_cut30, sync_featured.
  Existing `explicit` and `language` are reused. Text format `@`; flags written as 'TRUE' or ''.
- D-2 Public sync BPM/key stay separate from the private studio-note BPM/key; the Sync tab offers a
  "copy from studio notes" button.
- D-3 Lists from T-002: 20 moods (1–3 per song), 12 genres (primary + optional second), vocal type
  (Male vocal, Duet, Instrumental only, Mixed), keys = 24 major/minor names. Public badges: Instrumental,
  Clean, Stems, 60 s, 30 s; TV Mix and A Cappella only as "other versions on request".
- D-4 A song counts as sync-complete when it has sync_bpm, sync_key, at least one mood, sync_genre,
  sync_vocal and sync_writers.
- D-5 Shared settings: a public one-row `sync_settings` tab (rights_holder, rights_line, one_stop,
  pro_name, contact_email, contact_url, turnaround, process_note, updated), edited from a settings card in
  the Tracks screen. Defaults: rights_holder "Danyel OZ, LLC", one_stop TRUE, contact_email
  daniel.vizkaino@gmail.com, turnaround "3 business days", pro_name blank (PRO sentence becomes generic).
- D-6 Contact links: widgets may use `mailto:` only for the configured contact_email (validated email
  pattern) and https only for contact_url; nothing else. This is a supervisor-approved exception to the
  https-only widget rule.
- D-7 No promise of same-day file delivery; process wording promises only the 3-business-day reply.
- D-8 IPI/CAE numbers are not published.
- D-9 (G1 amendment, overrides plan.md "vocals"): vocal list is `Solo vocal, Duet, Instrumental only, Mixed`.
  No gendered labels for the artist's voice.
- G1 accepted Nov 21 with D-9; security design review runs before T-005 starts.
- D-10 (security SR-03, accepted): contact_url must be https on www.danyeloz.info, docs.google.com (/forms
  paths), forms.gle or www.cognitoforms.com; enforced on save (Sync.gs) and in the widgets.
- G1 security conditions (design-review.md) folded in: T-004 reopened for SR-05, SR-06, SR-07, SR-09;
  T-005 must meet SR-01, SR-02, SR-04, SR-08, SR-11 (+ D-10); T-006 SR-14; T-007/T-008 SR-01, SR-10, SR-12;
  T-010 SR-05(f) (fix CLAUDE.md BPM/key note); T-011 uses the review's test inputs. Open for Daniel before G4:
  confirm the Song Database is shared as Viewer, not Editor.
- D-11: saveTrackSync allows 0-3 moods (readiness requires 1+); D-10 hand parser in Apps Script accepted (exact host match, tested with 13 bad URLs).
- D-12: process_note appended as last sentence accepted. Email pattern drift: Sync.gs SY_EMAIL_RE to be aligned with the strict SR-04 pattern in sync-core.js (follow-up for the T-004 executor once a wave slot is free).
- Email drift closed: SY_EMAIL_RE identical to OZSync.EMAIL_RE (test asserts it).
