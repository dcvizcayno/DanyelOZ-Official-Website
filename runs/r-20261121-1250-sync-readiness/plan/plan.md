# Plan: r-20261121-1250-sync-readiness (T-003)

Machine form: `plan.json` (validates against `team/contracts/plan.schema.json`, 8 tasks, T-004..T-011).

## Strategy

Two foundations first, in parallel, then the things built on them:

| Wave | Tasks (max 4) | Why here |
|---|---|---|
| 1 | T-004 Sync.gs + unit test; T-005 sync-core.js + fixtures + unit test | Riskiest rules land first and cheaply: column add by header (C-1), Sheet1 trap, D-6 link rule, PRO-blank wording (C-5), one-sheet selection (C-4). Disjoint files. |
| 2 | T-006 Tracks UI (needs T-004); T-007 sync.html, T-008 one-sheet, T-009 contact copy (need T-005) | Consumers of a tested core. Disjoint write scopes; fixtures are T-005 output, read-only here. |
| 3 | T-010 handbooks | Names are final only after wave 2. |
| 4 | T-011 QA | Independent rerun with QA-written fixtures. |

Why a shared `sync-core.js`: C-5 demands one source for the rights wording on two pages plus the contact copy.
One function (`OZSync.rightsText`) produces it; T-009 copies its default output; widget tests and QA compare.
It is served like `lyrics.js` (`https://dcvizcayno.github.io/danyeloz-embeds/sync-core.js`); tests route
that URL to the local file.

Widget tests live in the private repo (`tests/widgets/`) so they use its `node_modules/playwright` and load
the embeds files by `file://` path. Screenshots go to `tests/ui/out/` (already git-ignored).

## Coverage matrix

| Criterion | Tasks | Verification (independent) | Evidence QA demands |
|---|---|---|---|
| C-1 metadata columns | T-004 | `node tests/unit/test_sync.js apps-script`; `test_tracks.js` unchanged and green; QA fixture with hand-added `sync_bpm` | columns after `abc`, prior cells byte-equal, zero writes from `getSyncAdmin` |
| C-2 admin app | T-004, T-006 | unit validation cases; `node tests/ui/build.js && node tests/ui/sy.js` at 1400/390; tk, tk2, sg rerun | rejected BPM 39/221/120.5, 4th mood, 11th featured; readiness text; no page errors; scrollWidth check |
| C-3 catalogue | T-005, T-007 | `node tests/widgets/catalogue.js`; QA planted rows | no injected elements, no `javascript:` href, unreleased hidden, filters narrow, fallback, 390 px no scroll |
| C-4 one-sheet | T-005, T-008 | `node tests/widgets/one_sheet.js` | PDF page count A4=1, Letter=1 with 10 long rows; 3 featured gives 8 rows |
| C-5 rights clarity | T-004 (defaults), T-005, T-007, T-008, T-009 | `test_synccore.js` blank vs set PRO; identical rights text on both widgets; QA diff of contact copy vs `rightsText(defaults)` | no PRO name anywhere while `pro_name` blank |
| C-6 contact copy | T-009 | QA reads `docs/sync-contact-copy.md` against the checklist; email and wording greps | all elements present, only daniel.vizkaino@gmail.com, no same-day promise. Sites draft paste is Daniel's step, outside agent scope |
| C-7 workflow | T-010 (team pack already installed) | `node scripts/validate.mjs`; `node --test scripts/tests/`; section diff CLAUDE.md vs HANDOFF.md | both green; identical Agent team section with a when-to-use list |

No orphan tasks: T-011 is the G3 evidence task; every other task maps to at least one criterion.

## Decisions fixed by this plan (so executors make none)

- **Column names** (D-1): sync_bpm, sync_key, sync_moods, sync_genre, sync_genre_2, sync_vocal, sync_writers,
  sync_producers, sync_instrumental, sync_clean, sync_stems, sync_cut60, sync_cut30, sync_featured. Reuse
  `explicit`, `language`. All new columns `@` text; flags stored as text `TRUE` or empty.
- **Lists**: moods = T-002 R-1 (20, 1 to 3 per song); genres = T-002 R-2 (12); vocals = `Male vocal, Duet,
  Instrumental only, Mixed` (D-3); keys (24): `C major, C minor, C# major, C# minor, D major, D minor,
  Eb major, Eb minor, E major, E minor, F major, F minor, F# major, F# minor, G major, G minor, Ab major,
  Ab minor, A major, A minor, Bb major, Bb minor, B major, B minor`. Moods stored comma+space separated.
- **Readiness** (D-4): complete = sync_bpm, sync_key, 1+ mood, sync_genre, sync_vocal, sync_writers.
- **Writes**: `getSyncAdmin` never writes. `saveTrackSync` adds missing columns (first use); `saveSyncSettings`
  creates `sync_settings` on first save. Executors never run against the live sheet.
- **Rights wording** (`OZSync.rightsText`, from T-002 R-5 A): if `one_stop` TRUE: "One-stop clearance.
  {rights_holder} owns 100% of the master recordings and 100% of the publishing, so one agreement clears
  both sides." else the same without the first sentence and the "so one agreement" clause. A non-blank
  `rights_line` replaces those sentences. Then always: "Songs are registered with {pro_name}." or, when blank,
  "Songs are registered with a performing rights organization."
- **Process wording** (T-002 R-5 B edited for D-7): request with song, project, media, territory, term;
  reply with a quote within {turnaround}; sign a simple license; files delivered after signing (WAV plus
  instrumental, clean, stems or cutdowns where available). No same-day promise.
- **Links** (D-6): https only on open.spotify.com, music.apple.com, *.bandcamp.com, youtube.com,
  www.youtube.com, music.youtube.com, www.danyeloz.info, dcvizcayno.github.io; covers follow albums.html:182-184.
  `mailto:` only for a pattern-valid `contact_email`; `contact_url` must be https. Request link prefers
  `contact_url`, else mailto with subject "License request: {title}".
- **Tempo filter**: Any, Slow (under 90), Medium (90 to 120), Fast (over 120).
- **One-sheet selection**: released featured songs, newest first, max 10; if fewer than 8, top up with the
  newest released complete songs not already listed; fewer than 8 available shows what exists.
- **Missing settings**: widgets use D-5 defaults (holder Danyel OZ, LLC, one-stop, contact
  daniel.vizkaino@gmail.com, 3 business days, blank PRO).

## Tasks (summary; full done-criteria in plan.json)

| Id | Owner | Title | Deps | Write scope | Est | Risk |
|---|---|---|---|---|---|---|
| T-004 | executor | Sync.gs data layer + `tests/unit/test_sync.js` | none | apps-script/Sync.gs, tests/unit/test_sync.js | 90 | medium |
| T-005 | executor | `danyeloz-embeds/sync-core.js` + fixtures + `tests/widgets/test_synccore.js` | none | sync-core.js, tests/widgets/fixtures/, mock-sheet.js, test_synccore.js | 90 | medium |
| T-006 | executor | Tracks Sync tab, readiness card, settings card + mock + `tests/ui/sy.js` | T-004 | TracksApp.html, TracksViews.html, tests/ui/mock.js, tests/ui/sy.js | 120 | medium |
| T-007 | executor | `sync.html` catalogue + `tests/widgets/catalogue.js` | T-005 | sync.html, tests/widgets/catalogue.js | 120 | low |
| T-008 | executor | `sync-one-sheet.html` + `tests/widgets/one_sheet.js` | T-005 | sync-one-sheet.html, tests/widgets/one_sheet.js | 90 | medium |
| T-009 | executor | `docs/sync-contact-copy.md` | T-005 | docs/sync-contact-copy.md | 30 | low |
| T-010 | executor | Handbooks: CLAUDE.md, HANDOFF.md, tests/README.md, docs/SETUP.md | T-004, T-006..T-009 | those four files | 60 | low |
| T-011 | qa | Independent verification C-1..C-7 | all | runs/<run>/qa/ | 75 | low |

DAG is acyclic; no two tasks in one wave share a path. Critical path: T-005, T-007, T-010, T-011 (about 6 h of
agent time; total about 11 h across waves).

## Security and monitor (gate inputs, not plan tasks)

T2 requires a security design review at G1. Recommended: security reviews the D-6 link rule, the host
allowlist, the public-data boundary (no stem links, no IPI, D-8) and CSV-injection handling before T-005
starts, and reviews the T-004..T-008 diffs before G4. Monitor baselines: current test suite all green
before wave 1, and tk/tk2/sg output captured by T-006 before editing.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| gviz unknown `sheet=` behaviour differs from the inferred Sheet1 fallback | low | header guards handle both; T-005 records one read-only live check |
| One-sheet overflows one page with long titles or 10 rows | medium | T-008 tests PDF page count for A4 and Letter with long rows; ellipsis on title cells in print |
| Tracks screen regressions | medium | tk, tk2, sg rerun with before/after output comparison; code stays inside the IIFE |
| Lists drift between Sync.gs and sync-core.js | medium | T-011 compares them programmatically |
| A hand-added `bpm`/`key` column already in `tracks` | low | D-1 `sync_` prefix avoids the clash; QA fixture covers a pre-existing `sync_bpm` |
| Wording claims a PRO or same-day delivery | low | generated PRO sentence; greps in T-009 and T-011 |

## Assumptions

- A-P1 Unknown gviz `sheet=` returns Sheet1 (T-001 F13). Invalidated if the live check shows an error body; guards still cover it.
- A-P2 Missing settings fall back to D-5 defaults (confirmed facts). Invalidated if Daniel prefers hiding the rights block.
- A-P3 `getSyncAdmin` is read-only; the first app save creates columns and the tab (fits the "empty columns on first use" constraint).
- A-P4 `language` reuses the existing column (D-1).

## Rollback

All work is local and unpushed; nothing touches the live sheet, GitHub Pages or Sites. New files are
deleted. Edited files are restored with `git restore` (TracksApp.html, TracksViews.html, tests/ui/mock.js,
tests/README.md, docs/SETUP.md, danyeloz-embeds/HANDOFF.md). CLAUDE.md already has uncommitted team-pack
edits, so T-010 first copies it to the scratchpad and rollback restores from that copy. The Supervisor
triggers rollback on a G2 or G3 fail.

## Open questions

1. Security G1 review timing (before T-005) is for the Supervisor to schedule.
2. Which Sites pages host the catalogue and one-sheet? Until named, contact copy links to the github.io pages.
3. One-sheet bio (drafted in T-008) needs Daniel's approval.
4. Commit locally after G3 (as Danyel OZ) or leave uncommitted? Nothing is pushed either way.

## Residual risk

The Sites draft edit (C-6, last sentence) and publishing are human steps, so G3 can only verify the
paste-ready text, not the live page. The mood and genre lists are medium-confidence (T-002) and may need
edits after Daniel uses them; they are constants in two files, cheap to change.
