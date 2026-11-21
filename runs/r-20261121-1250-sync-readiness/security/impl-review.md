# Security implementation review (pre-G4, T2): r-20261121-1250-sync-readiness

Reviewer: security. Date: 2026-11-21. Baseline: security/design-review.md (SR-01..SR-14), charter D-1..D-12.
Code read: apps-script/Sync.gs (all 227 lines), git diff of apps-script/TracksApp.html + TracksViews.html (sink grep + Sync pane hunks),
apps-script/Code.gs:119-122 (safeText_), Tracks.gs:48-56,107-115 (trPublicTab_, trPutRow_), Singles.gs:55-66 (writeNamed_),
danyeloz-embeds/sync-core.js (all 239 lines), sync.html:105-175 + sink grep, sync-one-sheet.html:95-151 + sink grep, CLAUDE.md:77-78,110.

**G4 security verdict: PASS_WITH_CONDITIONS.** All five design-level Highs (SR-01, SR-02, SR-05, SR-07, SR-14) are closed, with
code and test evidence. No Critical/High is open. One Medium is still partly open (SR-04: the percent sign is allowed in the email
local part, see N-1). Two new Lows.

## 1. Commands run (all from the repo root, 2026-11-21)

| Command | Result |
|---|---|
| env -u GITHUB_TOKEN -u GH_TOKEN node tests/unit/test_sync.js apps-script | "test_sync: PASSED", exit 0 |
| node tests/widgets/test_synccore.js | "140 checks PASSED" |
| node tests/widgets/catalogue.js | "1400 px: ok", "390 px: ok", "1492 checks PASSED" |
| node tests/widgets/one_sheet.js | "A4=1 Letter=1 pages", "49 checks PASSED" |
| node tests/ui/build.js && node tests/ui/sy.js | planted markup: {"pwn":"undefined","els":0}; server error shown as text; errors []; dialogs [] |
| Sink grep (innerHTML, insertAdjacentHTML, outerHTML, document.write, eval(, new Function, setAttribute on*, string setTimeout, RegExp(, location.search, URLSearchParams) over sync-core.js, sync.html, sync-one-sheet.html | zero hits |
| Same grep over the added lines of the TracksApp/TracksViews diff | zero hits |
| git status --short in danyeloz-embeds | only the three new untracked files; no package.json or dependency change |
| Own probe (throwaway node script under security/, deleted): 17 safeUrl, 4 contactUrl, 13 syContactUrl_, 4 email vectors, CSV with quotes/newlines/markup/unterminated quote, 5 BPM, 7 public-text | results in sections 2 and 3 |

## 2. Per-risk status

| Id | Sev (G1) | Status | Evidence |
|---|---|---|---|
| SR-01 | High | **Closed** | All DOM text goes through OZSync.el -> textContent (sync-core.js:35); zero banned sinks in the three files; badge/mood/key/genre/vocal values pass inList against fixed lists (sync-core.js:72-75,167-168); no sheet-derived style values. Planted-markup tests in catalogue/one_sheet/sy pass. Probe: a CSV title with an img-onerror tag, and a HYPERLINK formula with an embedded newline and doubled quotes, parse into plain strings. |
| SR-02 | High | **Closed** | safeUrl (sync-core.js:95-101): new URL, https only, no user/password/port, exact host or single-label *.bandcamp.com (hostOk :84-93). Every href/src goes through safeLink/coverUrl/contactHref (sync.html:109-117,150-158; sync-one-sheet.html:97-101,128,149). External links get target=_blank rel=noopener noreferrer; mailto gets none. Probe: trailing-dot host, %2eevil.io, @evil.io, %00.evil.io, Cyrillic look-alike, a.b.bandcamp.com, .bandcamp.com all rejected; backslash and slashless https forms, fullwidth letters and :443 normalise to the genuine host (safe: the returned href is the normalised p.href). |
| SR-03 | Med | **Closed (widget); Low gap (server, N-2)** | Widget contactUrl (sync-core.js:116-120) and server syContactUrl_ (Sync.gs:74-83) both enforce D-10 hosts. Server probe rejects user@, :port, look-alike hosts, %2f, backslash, whitespace, U+2028, javascript:. |
| SR-04 | Med | **Partly closed** | The href is exactly mailto: + email + ?subject= + encodeURIComponent(...) (sync-core.js:127). Probe title "A&B?cc=x" CR LF "Bcc: e@v.io" encodes to %26, %3F, %0D%0A; a single "?". Server and widget share one regex (Sync.gs:30, sync-core.js:31), so the D-12 drift is resolved. Still open: N-1. |
| SR-05 | High | **Closed** | (a) Only SY_TRACK_COLUMNS / SY_SETTING_COLUMNS are written; the payload is copied into explicit fields/row objects (Sync.gs:184-186, 210-215), so unknown keys never become columns. (b) The vault read is limited to isrc,bpm,key (Sync.gs:117); hints are re-validated on save. (c) syPublicText_ (Sync.gs:61-70) rejects links, emails (except the configured contact email), 9+ digit runs and IPI/CAE in writers, producers and all public settings text. (d) No stem, fee or request column exists. (e) getSyncAdmin writes nothing (Sync.gs:135-160). (f) CLAUDE.md:77 states the sync_bpm/sync_key exception. Residual: N-3. |
| SR-06 | Low | **Closed** | syText_ replaces U+0000-001F/007F and trims before safeText_ (Sync.gs:54-58; Code.gs:119-122). Probe: TAB + "=1+1" + NBSP -> "=1+1", which gets the formula-guard prefix at write (trPutRow_ Tracks.gs:107-113; writeNamed_ Singles.gs:62). Text format @ is set on the columns before the write (trPublicTab_ Tracks.gs:48-56, called at Sync.gs:196 and 223). Flags stored as TRUE or empty (Sync.gs:44-50). |
| SR-07 | High | **Closed** | Every C-2 rule enforced server-side before any write (Sync.gs:164-186, 205-219): BPM 2-3 digits, 40-220; key/genre/genre2/vocal from fixed lists; genre2 differs from genre; moods from the 20, at most 3 (0 allowed per D-11); strict flags; length caps refuse rather than clip; the ISRC must already exist (no row creation). Featured count and write share one lock_() section (Sync.gs:187-199). test_sync passes the G1 vectors. |
| SR-08 | Low | **Closed** | NEED header guards (sync-core.js:32, 53-65); settings use the first row only, and only if rights_holder and contact_email exist (:132-142); songs requires isrc and sync_bpm (:187). |
| SR-09 | Med | **Closed** | Rights and PRO text pass the SR-05(c) filter and caps; blank PRO gives the generic sentence (sync-core.js:150); updated is always set server-side (Sync.gs:222); the admin settings card previews syRights(values()) via textContent (TracksApp diff, added lines 192/198). |
| SR-10 | Med | **Closed** | No location, location.search or URLSearchParams in sync.html, sync-one-sheet.html or sync-core.js (grep: zero hits). No parameter can change contact, rights, links or text; no date preview parameter. |
| SR-11 | Low | **Closed** | coverUrl limits covers to IMAGE_HOSTS (sync-core.js:28-29, 104-110); referrerpolicy=no-referrer set (sync.html:153-154). |
| SR-12 | Low | **Closed** | Search is norm(...).indexOf(q) with q capped at 100 (sync-core.js:202-206); input maxLength=100 (sync.html:219); no RegExp built from input. |
| SR-13 | Low | **Closed (inherited token risk recorded)** | Only external resources: Google Fonts stylesheet and the github.io sync-core.js (sync.html:14,91; sync-one-sheet.html:16,81). No dependency added. The XPosts.gs push-token risk to the shared trust root is inherited and unchanged. |
| SR-14 | High | **Closed** | The diff adds no innerHTML/insertAdjacentHTML; DOM built with h()/textContent; server errors via say(msg, e.message) as text (diff added line 144). sy.js plants markup in titles, writers and every settings field: pwn undefined, els 0. |

## 3. New findings

| Id | Sev | Finding and exploit path | Mitigation (location) | Owner |
|---|---|---|---|---|
| N-1 | Medium | EMAIL_RE / SY_EMAIL_RE allow the percent sign in the local part (sync-core.js:31, Sync.gs:30; the pattern I specified in SR-04). Probe: "x%40evil.io%2Cdaniel@gmail.com" and "a%0Abcc%3Ax%40evil.io@b.co" pass both validEmail and syEmail_ and produce "mailto:x%40evil.io%2Cdaniel@gmail.com?subject=...". RFC 6068 clients percent-decode the to part into "x@evil.io,daniel@gmail.com", so license requests also go to the attacker; the %0A form is a header-injection vector in older clients. Needs write access to sync_settings (the admin app or a sheet Editor), so the gain over setting a wrong address outright is stealth, but it defeats the SR-04 intent of a single visible recipient. | Drop the percent sign from the local-part class in both regexes: /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/ at sync-core.js:31 and Sync.gs:30. Add both probe strings as rejected vectors in tests/widgets/test_synccore.js and tests/unit/test_sync.js. | T-004/T-005 executor; before the embeds push |
| N-2 | Low | syContactUrl_ accepts dot-segments: "https://docs.google.com/forms/../spreadsheets/d/x" and "/forms/%2e%2e/document/..." are saved, as is "www.danyeloz.info/contact/../../x". The widget (new URL) normalises and rejects the docs.google ones (mailto fallback), so nothing is exposed, but the admin shows Saved for a link the site will not use. | In Sync.gs:76-81 refuse paths containing "/../", "/./" or "%2e" (case-insensitive) or ending in "/.."; add the two vectors to test_sync.js. | T-004 executor; follow-up |
| N-3 | Low | syPublicText_ catches mistakes but is not an adversarial filter: spaced digits ("123 456 789") and obfuscated emails ("me [at] x.com") pass. Acceptable while the only writer is Daniel; recorded so nobody relies on it as a guarantee. | Optional: strip separators before the digit-run test (Sync.gs:67). | follow-up, no deadline |

Also noted (not security): admin textareas allow 600/1000 characters for rights_line/process_note while the server caps 400/600 (TracksApp diff, added lines 188-189); the server refuses with a clear message.

## 4. Conditions for G4

1. N-1 (Medium) fixed, with the two new rejected vectors, before sync-core.js, sync.html and sync-one-sheet.html are pushed to danyeloz-embeds. Owner: T-004/T-005 executor. If shipped unfixed, the residual risk is a hidden extra recipient on licensing requests, reachable only by someone with write access to the public Song Database, for as long as it takes to push the regex fix.
2. Daniel confirms the Song Database link sharing is Viewer, not Editor (carried over from design-review section 6). If it is Editor, SR-01..SR-04 and N-1 become Critical and the verdict changes to FAIL.
3. N-2 and N-3 are follow-ups with no gate effect.

## 5. Not reviewed

TracksApp.html beyond the Sync hunks and the sink grep; test fixtures line by line (only pass/fail and presence of the vectors);
the live sheet, the deployed web-app access setting and appsscript.json; XPosts.gs token handling; behaviour in real mail clients
(the N-1 decoding follows RFC 6068 and was not tested against a client); docs/sync-contact-copy.md (copy only, no code).
