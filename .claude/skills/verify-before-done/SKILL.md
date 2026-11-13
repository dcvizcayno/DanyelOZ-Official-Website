---
name: verify-before-done
description: Use before telling Daniel anything is done, fixed, working or ready (a widget, an app screen, a script, a sheet change, a commit or push), and before trusting a helper agent's "success". Evidence first, then the claim.
---

# Verify before saying done

Adapted from the verification-before-completion skill in [obra/superpowers](https://github.com/obra/superpowers) by Jesse Vincent (MIT License, see the notice at the end), rewritten for this project.

**The rule: no "done" without fresh proof from this session.** If you didn't just run it, you can't say it works.

## The check, every time
1. **Name the proof.** What run would show the claim is true?
2. **Run all of it,** fresh.
3. **Read the whole output:** errors, warnings, counts, exit code.
4. **Does it prove the claim?** If yes, say so with the proof ("17 checks passed, no page errors, no sideways scroll at 390 px"). If no, say what's actually true.

## What counts as proof here

| Claim | Proof | Not proof |
|---|---|---|
| Widget works | Playwright with mocked sheet data at desktop **and** 390 px phone: no page errors, `scrollWidth` equals the width, a screenshot you looked at, plus planted bad data | "The code looks right" |
| App screen works | The UI mock test of that screen, with the server calls it makes recorded and checked | It loaded once |
| Apps Script function works | Node mock of SpreadsheetApp, UrlFetchApp and PropertiesService covering bad input, rate limits and a stopped-then-resumed run | One happy run |
| Script that calls an outside service is safe | Its pace (calls per minute) worked out and within the service's limit, and a 429 test that stops cleanly | "It has retries" |
| Sheet change is right | Read it back after writing and count the cells changed against the plan | The write returned no error |
| Pushed and live | `git status` clean and `git log origin/<branch>` shows the commit; for widgets, Pages updates in about 10 minutes | "Pushed" without checking |
| Bug fixed | The original symptom tested again and gone | Code changed |
| Helper agent finished | Its diff read and its test re-run yourself | The agent said "success" |

## Be honest about what you couldn't check
Some things can only be checked on Daniel's side: the real Bandcamp player inside Google Sites, Apps Script after he pastes and deploys, YouTube and Spotify with his keys. Say exactly which part was tested here and which part he should look at ("tested with mocked data; the real Spotify run is the part to watch"). Never word an untested part as if it were tested.

## Stop signs
- "Should work now", "probably", "looks good" before a run.
- "Done!" or "Perfect!" before the proof.
- About to commit, push or hand files to Daniel with no fresh run.
- Trusting an agent's report, or a test from before the last edit.

---
Based on obra/superpowers. MIT License, Copyright (c) 2025 Jesse Vincent. Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED.
