---
name: admin-app
description: Change, test and hand over the private Apps Script admin app (Song Database data entry app) in apps-script/. Use for any new screen, fix or feature in the app, and when Daniel asks how to paste or deploy.
---

# Admin app (Apps Script)

Bound to the Song Database. Files and screens: `CLAUDE.md` section 4. Deployed as a web app, Execute as **Me**, Who has access **Only myself**.

## How the code is laid out

- Each feature is `X.gs` (server) + `XViews.html` (layout, a hidden `<section id="viewX">`) + `XApp.html` (behavior).
- `Form.html` holds the nav (`data-view` buttons), the list of views, and `<?!= include('XViews') ?>` in main and `<?!= include('XApp') ?>` before `</body>`.
- `XApp.html` chains `window.onAdminView` (`var prev = window.onAdminView`) and loads on first view.
- Shared helpers in `Code.gs` (`getSongs`, `norm_`, `safeText_`, `lock_`, `timer_`), `Singles.gs` (`namedTab_`, `readNamed_`, `writeNamed_`), `Shorts.gs` (`shortsSheet_`, `readShorts_`, `writeShort_`, `captions_`, `folder_`).
- Saves take `lock_()` and fail fast with a clear message. Text written to sheets goes through `safeText_` (blocks formulas).
- Private data (Shorts schedule, series) lives in the private book "Danyel OZ Shorts (private)", never the public Song Database.
- Secrets only in Script Properties.

## Testing

1. Node `vm` with mocks of SpreadsheetApp, DriveApp, UrlFetchApp, PropertiesService, LockService, Utilities (see existing `test_*.js` patterns). Compare with JSON, not `deepStrictEqual` (cross-realm).
2. UI: build one page from `Form.html` with includes inlined and a `google.script.run` mock, then Playwright at 1400 and 390 px, clicking through the new flow.
3. Run the older tests too, so nothing else broke.
4. Anything that talks to GitHub: run with `env -u GITHUB_TOKEN -u GH_TOKEN`.

## Handing over

1. Commit on branch `admin-shorts-x` (or the current feature branch) as Danyel OZ, push.
2. Send Daniel the changed files and say exactly which to add or replace in Apps Script (file type and name).
3. Remind: **Deploy > Manage deployments > pencil > New version > Deploy**.
4. If a new Google service or scope is involved, give the permission steps (run a function in the editor, Advanced > Go to … (unsafe) > Allow).
5. Update the handbook (all three copies).

The `app-reviewer` agent can check a change against these rules before handover.
