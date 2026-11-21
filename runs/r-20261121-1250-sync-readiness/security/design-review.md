# Security design review (G1, T2): r-20261121-1250-sync-readiness

Reviewer: security. Date: 2026-11-21. Subject: charter.md (D-1..D-9), plan/plan.md, research/T-001.md,
CLAUDE.md section 5, .claude/skills/widget-work/SKILL.md. Code read for patterns: danyeloz-embeds/albums.html:155-193,
holiday.html:183-190; apps-script/Code.gs:26-33, 118-122, 203-209; apps-script/Tracks.gs:37, 45, 107-115, 218-232;
docs/SETUP.md:12-15.

**Verdict for G1: PASS_WITH_CONDITIONS.** No Critical risk and no current exposure (nothing is built or pushed).
Five High risks (SR-01, SR-02, SR-05, SR-07, SR-14) are design-level: they close only if the conditions below
become done-criteria of T-004..T-008 and QA verifies them in T-011. Any of them open at G4 means FAIL.

## 1. Assets

| Asset | Class | Where |
|---|---|---|
| Daniel's Google identity acting through the admin app (every server function, incl. the GitHub-token path in XPosts.gs and X posting) | secret (authority) | Apps Script web app, "Only myself" (docs/SETUP.md:12-15) |
| Private Song Vault: track_notes (chords, drafts, notes), track_fixes | confidential | separate private sheet |
| Stem, instrumental and cutdown files | confidential (commercial) | private, sent on request |
| IPI/CAE numbers, splits, fees, quotes, supervisor requests | confidential | never in a public store (D-8) |
| Song Database (Sheet1, tracks, new sync_settings) | public, integrity-critical | "Anyone with the link: Viewer", Editors write (CLAUDE.md:51) |
| Rights statement and licensing contact (legal weight; where requests and money go) | public, integrity-critical | sync_settings, sync-core.js defaults, contact copy |
| Visitors and supervisors (browsers; the dcvizcayno.github.io origin shared by every widget incl. x-dashboard) | internal | GitHub Pages |

## 2. Trust boundaries

- B1 Daniel's browser (admin app) -> Apps Script server functions (saveTrackSync, saveSyncSettings, getSyncAdmin).
- B2 Apps Script -> public Song Database (writes) and private Vault (read for "copy from studio notes").
- B3 Public Song Database -> gviz CSV -> sync.html / sync-one-sheet.html. Sheet text is untrusted at render
  time: it also arrives from imports (Apple/Spotify/DistroKid titles) and from any Editor.
- B4 Page URL (query string) -> one-sheet / catalogue script.
- B5 Widgets -> outbound links (mailto:, https listen links, cover images, contact_url).
- B6 Anyone on the internet -> the whole Song Database (every tab readable, incl. unreleased rows).
- B7 sync-core.js on github.io -> both widgets (same origin, absolute URL like lyrics.js).

## 3. Abuse cases

| Boundary | Actor | Abuse | Risk |
|---|---|---|---|
| B3 | anyone who gets a value into the sheet (import, Editor, mistaken paste) | `<img src=x onerror=...>` in track_title / writers / rights_line runs script on the github.io origin | SR-01 |
| B3/B5 | same | `javascript:` / `data:` / look-alike host (`open.spotify.com.evil.io`, `https://open.spotify.com@evil.io`) in a link | SR-02, SR-03 |
| B3/B5 | same | contact_email `x@evil.io?bcc=...` or a swapped address redirects every licensing request | SR-04 |
| B4 | anyone sending a link | `sync-one-sheet.html?email=attacker@...` on the official address shows an attacker contact under Daniel's rights line | SR-10 |
| B1/B2 | Daniel by mistake | pastes a stem Drive link, IPI or private note into a public field; public and cached at once | SR-05 |
| B1 | a helper if the app is shared (CLAUDE.md:124) | calls `google.script.run.saveTrackSync` directly with values the UI refuses | SR-07 |
| B1 | crafted sheet text | XSS in the admin Sync pane runs with Daniel's script authority | SR-14 |
| B2 | crafted text | `=HYPERLINK(...)` / `=IMPORTXML(...)` stored as a live formula in the public sheet | SR-06 |
| B3 | missing tab | gviz returns Sheet1 for an unknown `sheet=`; Sheet1 cells shown as rights text | SR-08 |

## 4. Risk register

| Id | Sev | Risk and exploit path | Condition (must hold) | Owner | How QA verifies |
|---|---|---|---|---|---|
| SR-01 | High | Sheet text rendered as HTML in sync.html / sync-one-sheet.html (titles, moods, genres, writers, producers, rights_holder, rights_line, pro_name, turnaround, process_note) executes script on the shared github.io origin. | All sheet- and URL-derived text reaches the DOM only via `textContent` / `createTextNode` (the `el()` pattern, albums.html:155). `innerHTML` appears only as `= ''`. No `insertAdjacentHTML`, `outerHTML`, `document.write`, `eval`, `new Function`, `setAttribute('on...')`, string `setTimeout`. Style values from the sheet only `#RRGGBB` via a `hex()` check. Mood/genre/key/vocal badges render only for values in the fixed lists (unknown values dropped). | T-005, T-007, T-008 | (a) Grep sync.html, sync-one-sheet.html, sync-core.js for the banned sinks: zero hits except `innerHTML = ''`. (b) Planted rows with `<img src=x onerror=window.__pwn=1>`, `<script>`, `"><svg onload=...>` in every text column of `tracks` and `sync_settings`: `window.__pwn` undefined, no element created from data, no page errors, raw text visible as text. |
| SR-02 | High | Unsafe schemes or look-alike hosts in listen links / covers / contact_url, or unanchored regex host checks, become clickable. | One function in sync-core.js (e.g. `OZSync.safeUrl(u, list)`) used for every `href` and `src`: parse with `new URL(u)` (reject on throw), require `protocol === 'https:'`, empty `username`/`password`/`port`, lower-case `hostname` equal to an allowlist entry; `*.bandcamp.com` means hostname ends with `.bandcamp.com` with one non-empty label before it. Allowlist exactly as plan.md "Links". Anything else returns '' and no link renders. External `<a>` get `target="_blank" rel="noopener noreferrer"`. | T-005 (function + unit test); T-007, T-008 use it | Unit vectors must reject: `javascript:alert(1)`, `JaVaScRiPt:x`, `' javascript:x'`, `data:text/html,x`, `vbscript:x`, `http://open.spotify.com/x`, `https://open.spotify.com.evil.io/`, `https://open.spotify.com@evil.io/`, `https://evil.io/?u=https://open.spotify.com/`, `https://evilbandcamp.com/`, `https://bandcamp.com.evil.io/`, `https://open.spotify.com:8443/`, `//open.spotify.com/`; accept `https://open.spotify.com/track/x`, `https://artist.bandcamp.com/track/y`. Widget test: every rendered `href`/`src` starts with `https://` or is the single allowed `mailto:`. |
| SR-03 | Medium | D-6 lets `contact_url` be any https host. A wrong or tampered value in the public settings tab sends every "Request a license" click to a third-party or phishing form, under Daniel's rights statement. | Amend D-6: contact_url must pass SR-02 against a contact allowlist `www.danyeloz.info`, `docs.google.com` (path starts `/forms/`), `forms.gle`, `www.cognitoforms.com`. Enforced in `saveSyncSettings` (clear error) and in the widget (others ignored, mailto fallback). | Supervisor (decision), T-004, T-005 | Unit: saveSyncSettings rejects `https://evil.io/form`, accepts a forms.gle URL. Widget fixture `contact_url=https://evil.io/` renders the mailto instead. |
| SR-04 | Medium | mailto header injection or swapped address: `contact_email` like `a@b.co?bcc=x@evil.io` or `%0A` sequences; subject built from an unencoded title. | contact_email matches `^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$` after trim (no `?&#,;`, whitespace, control chars), max 254 chars; checked in saveSyncSettings and in the widget (invalid -> D-5 default). href is exactly `'mailto:' + email + '?subject=' + encodeURIComponent('License request: ' + title)`; no other parameters. No `target` on mailto. | T-004, T-005 | Rejected: `a@b.co?bcc=x@evil.io`, `a@b.co,x@evil.io`, `a@b.co%0Abcc:x@evil.io`, `a b@c.co`, `javascript:x@y.co`. Title `A&B?cc=x` gives an href whose only `?` precedes `subject=` and contains `%26` and `%3F`. |
| SR-05 | High | Public-data boundary: anything written to `tracks` or `sync_settings` is world-readable at once and copied by gviz caches and scrapers (irreversible). Path: Daniel pastes a stem/instrumental Drive link, IPI, fee, phone or private note into writers, producers, process_note or rights_line; or "copy from studio notes" copies more than BPM/key. | (a) Sync.gs writes only the D-1 columns plus the 9 D-5 settings headers; unknown payload keys are ignored and never become columns. (b) Copy-from-notes reads only `bpm` and `key` and passes them through the same BPM/key validation. (c) Public free-text fields (sync_writers, sync_producers, rights_holder, rights_line, pro_name, turnaround, process_note) reject on save any URL (`https?://`, `www.`, `drive.google`, `docs.google`), any email address, runs of 9+ digits (IPI/CAE/phone shape) and the words `IPI`/`CAE`, with a message saying why. (d) No public column for stem links, file locations, fees, splits or request data; licensing requests are never stored in the Song Database. (e) getSyncAdmin returns Vault data only to the admin client and writes nothing. (f) T-010 updates CLAUDE.md:76 ("key, BPM ... never in the Song Database") to say only sync_bpm/sync_key are public by D-2. | T-004, T-006, T-010 | Unit: saveTrackSync with writers `Danyel OZ IPI 123456789`, `see https://drive.google.com/x`, `me@x.com` each throws; payload with `stems_link` adds no column; copy-from-notes on a fixture with chords/notes writes only sync_bpm/sync_key. Grep Sync.gs: no column name outside D-1 and D-5. |
| SR-06 | Low | Formula injection on app writes. `safeText_` (Code.gs:118-122) prefixes an apostrophe only for leading `= + - @`; a leading tab/CR, or a space before `=`, passes. Flags written as the text TRUE into a column not yet formatted `@` may coerce to boolean and split gviz types (badges vanish). | Sync.gs wraps writes in `syText_`: strip U+0000 to U+001F (keep newline only where multi-line is allowed), trim, clip to the field limit, then `safeText_`. New columns get `@` format before the first value (trPublicTab_ pattern, Tracks.gs:48-56). Flags written only as the string TRUE or empty. | T-004 | Unit: inputs TAB+`=1+1`, SPACE+`=HYPERLINK(1)`, `+1`, `@SUM(A1)` are stored with a leading apostrophe; mock shows `@` format set before setValue; stored flag is the string TRUE. |
| SR-07 | High | Validation only in the UI. The app is "Only myself" today, but CLAUDE.md:124 documents sharing it with a helper; then server functions accept arbitrary payloads, and the 10-featured cap is a read-count-write race. | Every C-2 rule enforced in Sync.gs: BPM whole number 40-220; key in the 24; 1-3 moods from the 20; genre and genre_2 from the 12 (genre_2 optional, not equal to genre); vocal from the D-9 list; flags boolean; writers/producers <= 200 chars; rights_holder <= 120, rights_line <= 400, pro_name <= 80, turnaround <= 40, process_note <= 600; ISRC must exist in `tracks` (no row creation). Featured count and write inside one `lock_()` section. All validation before any write. | T-004 | Direct calls with BPM 39, 221, 120.5, `120abc`; key `H major`; 4 moods; unknown mood; vocal `Male vocal` (D-9); 11th featured; unknown ISRC; 401-char rights_line: each throws and the mock sheet is unchanged. |
| SR-08 | Low | Sheet1 fallback: unknown `sheet=sync_settings` returns Sheet1 (T-001 F13); without a guard, Sheet1 cells become the rights or contact text. | Use settings only if headers contain `rights_holder` and `contact_email`; use `tracks` only if headers contain `isrc` and `sync_bpm`; else D-5 defaults / fallback message. Only the first data row of sync_settings is read. | T-005 | Fixture: settings URL returns Sheet1 CSV, defaults shown, no Sheet1 text in the rights block. |
| SR-09 | Medium | Rights statement integrity: `pro_name` or `rights_line` claims something false (a PRO not joined, another owner); legal weight, single public source. | rights_line and pro_name pass SR-05(c) and SR-07 limits and render as text; blank pro_name gives the generic sentence (C-5). `updated` is set server-side, client value ignored. Settings card previews `OZSync.rightsText` output before save. | T-004, T-006 | Unit: blank pro_name gives no PRO name anywhere; `updated` in payload replaced. UI test sees the preview text. |
| SR-10 | Medium | URL parameters. If any param can set contact, rights, links or text, a crafted link to the official github.io page shows attacker contact details (trusted-domain phishing). A `?date=` preview (as holiday.html:190) would surface hidden rows. | One-sheet and catalogue read no parameter that changes contact, rights, links or text. Any allowed param is matched against a fixed pattern (ISRC `^[A-Z]{2}[A-Z0-9]{3}\d{7}$`, filter enums); invalid values ignored; never reflected except as fixed-list values. No `?date=`. Print layout via `@media print`, not a param. | T-007, T-008 | Load with params email=x@evil.io, contact_url=https://evil.io, rights_line=(b-tag markup), date=2099-01-01, songs=(img onerror markup): DOM text and hrefs identical to no-params, no errors. Receipts list every `location.search` / `URLSearchParams` use. |
| SR-11 | Low | Covers follow albums.html:181-185, which accepts any https host; a sheet value can point a cover at a tracking host and learn when a supervisor opens or prints the one-sheet. Inherited pattern. | Cover `src` passes `safeUrl` against an image allowlist (`drive.google.com` converted to thumbnail, `lh3.googleusercontent.com`, `f4.bcbits.com`, `is1-ssl.mzstatic.com` to `is5-ssl.mzstatic.com`, `i.scdn.co`); others get the placeholder. `referrerpolicy="no-referrer"` on images. | T-005, T-007, T-008 | Fixture cover `https://evil.io/p.gif`: zero requests to evil.io in the route log, placeholder shown. |
| SR-12 | Low | Search builds a RegExp from user input: exception or catastrophic backtracking freezes the page. | Search uses normalized `indexOf`, never a RegExp from input; input capped at 100 chars. | T-006, T-007 | Grep for `RegExp(` with a variable argument: none. Typing a nested-quantifier pattern keeps the page responsive. |
| SR-13 | Low | sync-core.js is a shared trust root for both pages; a compromised push to danyeloz-embeds (e.g. via the fine-grained token used by XPosts.gs) changes both. Inherited; no new dependency. | No third-party script besides Google Fonts; no npm dependency added to danyeloz-embeds; tests abort all un-routed network. Inherited token risk recorded, not new. | T-005, T-007, T-008 | Grep script src tags: only github.io sync-core.js (and lyrics.js if used). Playwright route log: zero un-routed requests. |
| SR-14 | High | Admin-app XSS: the new Sync pane, readiness and settings cards render sheet values (import titles, writers, settings). Script there runs with Daniel's script authority (all google.script.run functions, GitHub token path, X posting). | TracksApp/TracksViews additions build DOM only with `h()` / `textContent` (TracksApp.html:9-22); select options via `createElement` from the fixed lists; no `innerHTML` with data (TracksApp.html has none today; keep it so). Server errors via `say()` as text. | T-006 | Grep the diff of TracksApp.html and TracksViews.html: no `innerHTML` / `insertAdjacentHTML` added. tests/ui/sy.js mock returns img-onerror markup setting `window.__pwn` in title, writers and every settings field: `window.__pwn` undefined, text visible. |

Not risks (so nobody adds controls for them): sync BPM/key, moods, genres, writer/producer credit names and
daniel.vizkaino@gmail.com are intended public facts. Unreleased rows are already world-readable in `tracks`
(B6); the "released only" filter is presentation, not confidentiality (inherited, accepted by the charter).

## 5. Conditions before and during execution

1. Before T-005 starts: Supervisor adds the SR-01, SR-02, SR-04, SR-08, SR-11 conditions to T-005 done-criteria
   (safeUrl and the mailto builder, with their unit vectors, live in sync-core.js and test_synccore.js).
2. Before T-004/T-005: Supervisor decides the SR-03 D-6 amendment (contact_url host allowlist). Recommended: accept.
3. SR-05, SR-06, SR-07, SR-09 into T-004; SR-14 (and SR-05 UI side) into T-006; SR-01, SR-10, SR-12 into
   T-007/T-008; SR-05(f) into T-010.
4. T-011 QA fixtures include at least the vectors above (QA writes its own).
5. Security reviews the T-004..T-008 diffs before G4 (review.md + risk-register.json).

## 6. Not reviewed

plan.json task text (plan.md read instead), research T-002, lyrics.js internals, TracksApp.html beyond an
innerHTML grep, XPosts.gs token handling, the live sheet's sharing setting and the deployed appsscript.json
(taken from CLAUDE.md:51 and docs/SETUP.md:12-15). If the Song Database were shared "Anyone with the link:
Editor", SR-01 to SR-04 become Critical; Daniel should confirm "Viewer" before G4.
