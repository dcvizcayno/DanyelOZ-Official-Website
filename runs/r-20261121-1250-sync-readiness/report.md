# Report — r-20261121-1250-sync-readiness

**Outcome:** the sync-readiness build is done and verified locally: per-song sync metadata and licensing
settings in the admin app (Sync.gs + Tracks screen), a licensing catalogue (sync.html), a one-page sync
one-sheet (sync-one-sheet.html), paste-ready contact copy, updated handbooks, and the agent team installed.
Nothing is committed, pushed or published.

**Tier:** T2 (public pages, rights statements, public data schema). Roles: researcher x2, planner, executor
x6 tasks (+ rework), qa, security (design + implementation), monitor (baseline + final).

## Gates
| Gate | Owner | Result |
|---|---|---|
| G0 charter | supervisor + Daniel | Facts confirmed: 100% owned by Danyel OZ, LLC, one-stop; another PRO (name to set); some stems; 3 business days; contact daniel.vizkaino@gmail.com |
| G1 plan | supervisor + security design review | Accepted with D-9 (no gendered vocal label) and security conditions folded in (PASS_WITH_CONDITIONS) |
| G2 tasks | supervisor | T-004..T-010 accepted after re-running each task's tests; G2 script scope flags were the pre-run team-pack install only |
| G3 QA | qa | PASS_WITH_CONDITIONS: C-1..C-7 verified with own probes (Sync.gs 117/117, widgets 131/131); D-1 (S4) fixed after |
| G4 release | supervisor + security + monitor | Security PASS_WITH_CONDITIONS (N-1 Medium and N-2 Low fixed and re-verified; N-3 Low accepted); monitor AMBER (tk.js timed out once, 4 later runs green incl. supervisor re-run). Daniel confirmed Viewer sharing and approved commit + push (Nov 21). **G4 PASS.** |

## Changed (uncommitted)
- Private repo: apps-script/Sync.gs (new), apps-script/TracksApp.html, apps-script/TracksViews.html,
  tests/unit/test_sync.js, tests/ui/sy.js, tests/ui/mock.js, tests/widgets/* (new), docs/sync-contact-copy.md,
  CLAUDE.md, tests/README.md, docs/SETUP.md; team pack (.claude/agents/team-*, .claude/skills/team-*,
  scripts/, team/, .gitattributes); runs/.
- Public repo danyeloz-embeds: sync-core.js, sync.html, sync-one-sheet.html (new), HANDOFF.md.

## Not verified / assumptions
- Real Google Sheets and gviz behaviour (mocks only; one live read confirmed a missing tab returns Sheet1).
- The widgets will show their fallback until Daniel saves sync data for at least one song.
- Real Google Sites embedding and printing outside Chromium.
- One-sheet bio and descriptor need Daniel's approval.

## Conditions & follow-ups
- Daniel: confirm Viewer sharing (G4 blocker); approve bio; set PRO name; fill sync fields; publish Sites.
- Supervisor (after Daniel's OK): commit both repos, push danyeloz-embeds (widgets go live on GitHub Pages),
  push the private branch, then draft the contact page edit in Google Sites (Daniel publishes).
- Low: N-3 public-text filter can be bypassed by spaced digits ("[at]" emails); fine while Daniel is the
  only writer. Admin email input max 120 vs 254 accepted elsewhere (cosmetic).
- Third handbook copy in the claude.ai Project needs Daniel's paste.
