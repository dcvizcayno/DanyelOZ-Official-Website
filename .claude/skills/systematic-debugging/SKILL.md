---
name: systematic-debugging
description: Use when anything in the Danyel OZ project breaks or acts strangely (an app error, a widget showing the wrong thing, a failed Shorts Maker run, an X post that didn't go out, an outside API refusing) and before proposing any fix. Find the real cause first.
---

# Systematic debugging

Adapted from the systematic-debugging skill in [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent (MIT License, see the notice at the end), rewritten for this project.

**The rule: no fix until you can say what caused it and why.** A fix for the symptom just moves the bug.

## 1. Find the cause
1. **Read the whole error.** Daniel's screenshot or log usually holds the answer: "moov atom not found" plus "0 MB" meant the video was still uploading, not that ffmpeg was broken.
2. **Make it happen again.** Same song, same steps, same data. If it won't repeat, gather more evidence; don't guess.
3. **Check what changed.** `git log` in both repos, the last app paste and deploy, new sheet columns, the date (release day, the 1st of the month and midnight Manila change what widgets show).
4. **Follow the data across each hand-off.** This project is a chain: sheet → gviz CSV → widget → Google Sites box, or app screen → Apps Script → GitHub Actions → Drive. Log what goes in and comes out at each step and run once to see **where** it breaks before deciding **why**.
5. **For outside services, check the pace and the limits first.** How many calls per minute? What does a 429, 401 or 403 say? (Nov 12: the Spotify script fired several lookups a second with retries, and Spotify paused the app for 23 hours. Asking "how fast are we hitting it?" first would have caught it.)

## 2. Compare with something that works
Find a widget, screen or script in this project that does the same thing correctly (another share menu, another backfill, another Bandcamp player) and list every difference, however small. Usual suspects here: a column read by position instead of header name, a mixed-type column that gviz drops, a missing `&sheet=`, a missing `sort=recent` on Apple lookups, a helper name that clashes with one in another `.gs` file, a Sites box too short, Bandcamp code pasted as HTML.

## 3. One idea, one test
Say it plainly: "I think X causes this because Y." Make the smallest change that tests only that. If it doesn't fix it, undo it and form a new idea; don't stack fixes.

## 4. Fix it for good
1. Write the smallest test that shows the bug (Node mock or Playwright with mocked sheet data, as in CLAUDE.md section 5) and see it fail.
2. Make **one** fix at the cause. No "while I'm here" extras.
3. See the test pass and the old tests still pass (use the `verify-before-done` skill).
4. Add a plain message for Daniel if the cause can come back (for example "This video is 0 MB, it may still be uploading").
5. Add the error and fix to `docs/TROUBLESHOOTING.md`.

**Three failed fixes means stop.** The design is probably wrong, not the details. Explain what you tried and talk it through with Daniel before a fourth.

## Stop signs
- "Quick fix now, look later." "Let me just try…" "It's probably…"
- Several changes at once, then running the test.
- Proposing a fix before you've traced the data.
- Daniel asking "is that not happening?" or "are we stuck?": go back to step 1.

When the cause really is outside our control (a store's outage, Google Sites caching), say so, add a friendly fallback and a log line, and note it in TROUBLESHOOTING.md.

---
Based on obra/superpowers. MIT License, Copyright (c) 2025 Jesse Vincent. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
