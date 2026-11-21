# Charter — r-20261121-1746-sync-embed-fixes

## Goal
Fix two problems Daniel found after embedding the sync pages in Google Sites (Nov 21, 2026):
1. "Request a license" does nothing inside the Sites embed (Sites sandboxes embeds; mailto: links in the
   frame are blocked).
2. The catalogue (sync.html) and one-sheet (sync-one-sheet.html) link to each other, and inside an embed each
   link opens a new tab, so people end up looping and piling up tabs.

## Acceptance criteria
- C-1 Request a license always does something useful inside a sandboxed iframe (sandbox="allow-scripts
  allow-popups allow-forms allow-same-origin", no allow-top-navigation, no allow-modals): it opens an
  in-page request panel (no navigation) that shows the licensing email as selectable text, a Copy button
  with a select-the-text fallback when the clipboard is blocked, what to include in a request (song,
  project, media, territory, term, timeline), and the 3-business-day promise. If `contact_url` is set
  (D-10 hosts only), the panel's main button is "Fill out the request form" opening that https form in a
  new tab. An "Open in your email app" mailto link is offered as a secondary option. Per-song request
  buttons prefill the song title in the panel. Escape and a Close button close it; focus is managed.
- C-2 No loops: inside an embed, the catalogue shows the one-sheet without opening a new window (an
  in-frame one-sheet view or same-frame navigation that works in the sandbox), with a "Back to the
  catalogue" control. A separate, clearly labelled "Print or save as PDF" opens the printable one-sheet in
  at most one new tab. On the standalone one-sheet (top-level tab), links back to the catalogue stay in the
  same tab (no target _blank between the two pages). No link between the two pages ever opens a second
  new tab in a chain.
- C-3 Security rules from run r-20261121-1250-sync-readiness still hold: text-only DOM, OZSync helpers for
  every href, D-6/D-10 contact rules, no URL params changing content; existing tests still pass, and new
  tests cover C-1 and C-2 at 1400 and 390 px, including a sandboxed iframe harness.

## Constraints
Widget rules (CLAUDE.md section 5); voice rules; no gendered pronouns for Daniel; only
daniel.vizkaino@gmail.com; nothing pushed until QA passes (Daniel already approved pushing sync fixes).

## Non-goals
A server-side request form or storing requests (would need a new public endpoint). Creating the Google or
Cognito form itself (Daniel's step; the widget is ready for contact_url).

## Tier
T1 — rationale: scoped, reversible change to two public widgets and the shared core; no new data, auth or
secrets. Researcher skipped (facts known from the previous run's research and Daniel's screenshots); noted
as a deviation.

## Roles and gates
Supervisor, executor, qa. G1 (supervisor checks the task brief), G2, G3.

## Budget
One executor task (30 min), one QA task (25 min).
- G3 round 1: QA FAIL (D-1 S2 tab chain via popup, D-2 upgraded to S2 by supervisor: C-2 means one reusable tab, use a named window target). Sent back to executor.
