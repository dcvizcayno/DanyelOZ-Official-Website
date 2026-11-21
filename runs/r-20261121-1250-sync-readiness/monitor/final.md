# Monitor final (G4): r-20261121-1250-sync-readiness

Taken 2026-11-21 ~13:05, from the private repo root, every command with `env -u GITHUB_TOKEN -u GH_TOKEN`.
Compared against monitor/baseline.md using the thresholds set there. sy.js ran last, after a fresh build.

## Checks

| # | Check | Baseline | Now | Status |
|---|---|---|---|---|
| U1 | test_songs | exit 0, ALL TESTS PASSED, 131 ms | exit 0, same line, 140 ms | green |
| U2 | test_features | exit 0, PASSED, 125 ms | exit 0, PASSED, 140 ms | green |
| U3 | test_highlights | exit 0, PASSED, 134 ms | exit 0, PASSED, 144 ms | green |
| U4 | test_panels | exit 0, PASSED, 128 ms | exit 0, PASSED, 140 ms | green |
| U5 | test_shorts | exit 0, PASSED, 153 ms | exit 0, PASSED, 150 ms | green |
| U6 | test_maker | exit 0, PASSED, 150 ms | exit 0, PASSED, 153 ms | green |
| U7 | test_singles | exit 0, EP NO-THEME TEST PASSED, 127 ms | exit 0, same 3 PASSED lines, 147 ms | green |
| U8 | test_albums | exit 0, PASSED, 149 ms | exit 0, PASSED, 166 ms | green |
| U9 | test_tracks | exit 0, tracks tests passed, 145 ms | exit 0, same, 166 ms | green |
| U10 | test_tiktok | exit 0, PASSED, 132 ms | exit 0, PASSED, 154 ms | green |
| U11 | test_spotify_backfill | exit 0, 45 lines, All done. / saved: {} | exit 0, 45 lines, same ending, 137 ms | green |
| N1 | test_sync.js (new) | n/a | exit 0, `test_sync: PASSED`, 159 ms; listed in tests/README.md:20 | green |
| N2 | test_synccore.js (new) | n/a | exit 0, PASSED, 196 ms; listed README:49 | green |
| N3 | catalogue.js (new) | n/a | exit 0, PASSED, 3700 ms; listed README:50 | green |
| N4 | one_sheet.js (new) | n/a | exit 0, `A4=1 Letter=1`, PASSED, 2355 ms; listed README:51 | green |
| N5 | sy.js (new, run last) | n/a | exit 0; scrollWidth 1400/1400 and 390/390; `dialogs []`; `errors []`; planted markup `{"pwn":"undefined","els":0}`; 8169 ms; listed README:35 | green |
| B1 | build.js | exit 0, built 305996 | exit 0, built 324625 (+18.6 KB from T-006 Sync tab), 144 ms | green |
| S1 | sg.js | exit 0, 4 views, 3x baseline ERR_FAILED, 9331 ms | exit 0, 4 views, exactly the 3 baseline ERR_FAILED, 3693 ms | green |
| S2 | tk.js | exit 0, scrollW 1400/1400 390/390, errors [], 10659 ms | run 1: **exit 1**, `page.textContent: Timeout 30000ms exceeded` (31941 ms). Runs 2-4 with no file change: exit 0, scrollW 1400/1400 390/390, errors [], ~6.2 s | **amber (flaky, 1 of 4)** |
| S3 | tk2.js | exit 0, nav gone 0, errors [], 3018 ms | same, 3033 ms | green |
| S4 | ep.js | exit 0, 1400/390, errors [], 3633 ms | same, 3572 ms | green |
| S5 | xp.js | exit 0, 1400/390, errors [], 5066 ms | same, 5029 ms | green |
| S6 | tt.js | exit 0, 1400/390, errors [], 10845 ms | same (scripted "Didn't post" line expected), 9868 ms | green |
| T1 | validate.mjs | PASS, 393 ms | PASS (same line), 400 ms | green |
| T2 | node --test scripts/tests/ | 22/22, 6684 ms | 22/22, fail 0, skipped 0, 5741 ms | green |
| G1 | Private HEAD | ab89d97 | ab89d97; origin/admin-shorts-x ab89d97 | green |
| G2 | Public HEAD | 9765c75, clean | 9765c75; origin/main 9765c75; nothing committed or pushed | green |
| R1 | Emails in new public content | n/a | public sync*.html / sync-core.js / HANDOFF diff: only daniel.vizkaino@gmail.com | green |
| R2 | Emails in private new files/diff | n/a | daniel.vizkaino@gmail.com plus test-input addresses in tests/ only (a@b.co, x@evil.io, example.org, ...). Commit-author address appears only in pre-existing doc lines (CLAUDE.md:25, docs/SETUP.md:83 hunk context, HANDOFF.md:25), not in any added line | green |
| R3 | Secrets/tokens | none | no gh*_/github_pat_/AIza/sk-/AKIA/PEM/ya29/credential-assignment hits in new files or diffs | green |
| R4 | TODO/FIXME/debugger/console.log | none | none in sync.html, sync-core.js, sync-one-sheet.html, Sync.gs, sync-contact-copy.md or added lines of the apps-script and public diffs | green |
| R5 | Commented-out code | none | none found in added lines or new product files | green |
| R6 | Temp files | none | none in either repo. Ignored: node_modules/, tests/ui/out/, tests/ui/page.html (build outputs, pre-existing ignore rules). runs/.../qa/logs/*.log are QA artifacts inside QA's scope | green |

## Drift list (git status vs declared scopes)

Private repo, modified: CLAUDE.md (T-010, C-7), apps-script/TracksApp.html and TracksViews.html (T-006), docs/SETUP.md (T-010),
tests/README.md (T-010), tests/ui/mock.js (T-006).
Private repo, new: apps-script/Sync.gs and tests/unit/test_sync.js (T-004), tests/ui/sy.js (T-006), docs/sync-contact-copy.md (T-009),
tests/widgets/{test_synccore.js, mock-sheet.js, fixtures/*.csv} (T-005), tests/widgets/catalogue.js (T-007), tests/widgets/one_sheet.js (T-008),
plus the team pack (.claude/agents/team-*, .claude/skills/team-*, .gitattributes, scripts/, team/) and runs/.
Public repo, modified: HANDOFF.md (T-010). New: sync-core.js (T-005, plus the N-1/N-2 fix approved in exec/T-004.md), sync.html (T-007), sync-one-sheet.html (T-008).

Every file falls inside a declared write scope. No existing public widget is edited. No undeclared product file.

Observation, outside the thresholds: the TracksApp.html contact_email input is capped at 120 characters (TracksApp.html settings `inp(..., 120)`), but the server and core accept 254 since the SR-04 follow-up. Not a regression, just a UI/server mismatch. QA or the supervisor can decide whether it matters.

## Overall: AMBER

All 25 deterministic checks are green: no new failures, no new screen errors, no sideways scroll, nothing committed or pushed, no scope
drift, no residue, and no unapproved email. The only non-green signal is a one-off tk.js timeout on run 1. It waited 30 s on a
`page.textContent` call. Under the baseline threshold a non-zero exit is red, but it did not reproduce in 3 reruns with identical
inputs (page.html 324625 bytes before and after, no product file changed). That makes it flakiness, not a regression from this run, so it is
reported as amber instead of red. It may line up with the concurrent hint-text edit or with machine load.

Recommended action: the supervisor accepts G4 with the condition noted ("tk.js flaked once, 3/3 reruns green"). If an extra check is
wanted, QA runs `node tests/ui/build.js && node tests/ui/tk.js` once more after the final hint edit. No product change is needed.
