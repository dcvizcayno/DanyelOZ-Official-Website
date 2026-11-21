# Monitor baseline — r-20261121-1250-sync-readiness

Taken: 2026-11-21, before wave 1 product changes. Node v26.13.1. All commands run from the private repo root
with `env -u GITHUB_TOKEN -u GH_TOKEN`. Durations are wall clock (ms) from one run; unit tests were run
twice with identical results. `apps-script/Sync.gs` and `tests/unit/test_sync.js` did not exist at capture
time and are not part of this baseline.

## Checks

| # | Check | Command | Result | Duration |
|---|---|---|---|---|
| U1 | Songs | `node tests/unit/test_songs.js apps-script/Code.gs` | exit 0, `ALL TESTS PASSED` | 131 ms |
| U2 | Features | `node tests/unit/test_features.js apps-script/Code.gs` | exit 0, `ALL FEATURE TESTS PASSED` | 125 ms |
| U3 | Highlights | `node tests/unit/test_highlights.js apps-script/Code.gs` | exit 0, `ALL HIGHLIGHT TESTS PASSED` | 134 ms |
| U4 | Panels | `node tests/unit/test_panels.js apps-script/Code.gs` | exit 0, `ALL PANEL TESTS PASSED` | 128 ms |
| U5 | Shorts/X | `node tests/unit/test_shorts.js apps-script` | exit 0, `ALL SHORTS + X TESTS PASSED` | 153 ms |
| U6 | Maker | `node tests/unit/test_maker.js apps-script` | exit 0, `ALL SHORTS MAKER TESTS PASSED` | 150 ms |
| U7 | Singles | `node tests/unit/test_singles.js apps-script` | exit 0, last line `EP NO-THEME TEST PASSED` | 127 ms |
| U8 | Albums/EPs | `node tests/unit/test_albums.js apps-script` | exit 0, `ALL ALBUMS TESTS PASSED` | 149 ms |
| U9 | Tracks | `node tests/unit/test_tracks.js apps-script` | exit 0, `tracks tests passed` | 145 ms |
| U10 | TikTok | `node tests/unit/test_tiktok.js apps-script` | exit 0, `ALL TIKTOK TESTS PASSED` | 132 ms |
| U11 | Spotify backfill | `node tests/unit/test_spotify_backfill.js` | exit 0, 45 lines, ends `All done.` / `saved: {}`; no PASSED line and no assertions (see note 1) | 121 ms |
| B1 | UI build | `node tests/ui/build.js` | exit 0, `built 305996` (bytes of page.html) | 130 ms |
| S1 | Screens open | `node tests/ui/sg.js` | exit 0; all 4 screens show their view; `errors` = 3x `console: Failed to load resource: net::ERR_FAILED` (pre-existing, see note 2) | 9331 ms |
| S2 | Tracks | `node tests/ui/tk.js` | exit 0; scrollW 1400/1400, phone 390/390; `errors []` | 10659 ms |
| S3 | Tracks album mode | `node tests/ui/tk2.js` | exit 0; `nav gone 0`; `errors []` | 3018 ms |
| S4 | EPs Page | `node tests/ui/ep.js` | exit 0; scrollWidth 1400, phone 390; `errors []` | 3633 ms |
| S5 | X Posts | `node tests/ui/xp.js` | exit 0; scrollWidth 1400, phone 390; `errors []` | 5066 ms |
| S6 | TikTok tab | `node tests/ui/tt.js` | exit 0; scrollWidth 1400, phone 390; `errors []` (the "Didn't post" line is a scripted failure scenario, expected) | 10845 ms |
| T1 | Team validator | `node scripts/validate.mjs` | exit 0, `PASS — roles, 12 skills, agent preloads, contracts, envelope accept/reject, charter cross-references` (roles 7, skills 12, contracts 3) | 393 ms |
| T2 | Team tests | `node --test scripts/tests/` | exit 0; tests 22, pass 22, fail 0, skipped 0, todo 0 | 6684 ms |

Totals: unit 11/11 exit 0 (~1.5 s); screens 7/7 exit 0 (~42 s); team checks 2/2 green.

Notes
1. U11 has no assertions or non-zero exit path; exit 0 plus the `Would fill 2 Spotify links (5 songs checked
   this run).` summary is the only signal. tests/README.md's "each prints a PASSED line" is not true for it.
2. The Playwright scripts do not assert: they print state and an `errors` array and always exit 0. The real
   signals are the printed `errors` array and the `scrollWidth`/`scrollW` values. S1's 3 `ERR_FAILED`
   console entries are baseline (external resource loads under the mock); they are not attributable to this run.

## Git state

| Repo | Branch | HEAD | Working tree |
|---|---|---|---|
| Private (`E:/Projects/Danyel OZ Official Website`) | `admin-shorts-x` | `ab89d97` | ` M CLAUDE.md`; untracked: `.claude/agents/team-{executor,monitor,planner,qa,researcher,security}.md`, `.claude/skills/team-protocol/`, `team-run/`, `team-supervisor/`, `.gitattributes`, `runs/`, `scripts/`, `team/` (team pack install, C-7) |
| Public (`E:/Projects/danyeloz-embeds`) | `main` | `9765c75` (2026-11-16, "Handbook: TikTok posting for Shorts") | clean |

No `apps-script/`, `Form*.html`, or `tests/` file is modified at baseline.

## Thresholds for checkpoints and G4

| Signal | Green | Amber | Red |
|---|---|---|---|
| Unit tests U1–U11 | all exit 0 with their PASSED line | duration of any test > 3x baseline | any exit non-zero or PASSED line missing (any previously green test failing) |
| New tests (test_sync.js, new screen test) | present, exit 0 | present but not in tests/README.md | missing, or failing |
| Screen errors | `errors []` (S1: exactly the 3 baseline ERR_FAILED) | new console warnings | any new entry in an `errors` array (page error or new console error) |
| Sideways scroll | scrollWidth == viewport (1400 / 390) | — | any scrollWidth over viewport, at any size |
| Screen coverage | all 6 screens print their expected views | a screen run > 30% slower | build.js fails, or a screen loses its view |
| Team checks T1/T2 | validator PASS, 22+/22+ pass | test count drops with no stated reason | any failure |
| Public repo | only new/declared widget files (`sync.html`, `sync-one-sheet.html`, shared settings) | extra files under declared paths | edits to existing widgets nobody declared, or anything committed/pushed without approval |
| Private repo scope | writes in declared task scopes | extra files under `runs/` | product files outside every declared scope; CLAUDE.md edits beyond C-7 |
| Residue | clean | new TODOs/console.log in touched files | temp files, commented-out code, any email other than the charter-approved one, secrets/tokens in diff |
