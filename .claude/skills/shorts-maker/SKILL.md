---
name: shorts-maker
description: Run, explain or fix the Shorts Maker, which turns a long 9:16 lyric video into a series of Shorts cut between sung lines (admin screen + GitHub Actions editor). Use when Daniel wants Shorts from a song, or a Shorts Maker run fails.
---

# Shorts Maker

## The flow

1. Admin app > **Shorts Maker** > New series: pick the song and its long 9:16 video from the Drive folder "Danyel OZ Shorts". Choose 59 s (default) or 90 s parts, end card on or off.
2. **Plan series** starts `shorts-maker.yml` (mode `plan`) in the private repo. The editor downloads the video with a short-lived Drive token from the app, times every sung line with Whisper (`small`, cached), and splits the song into the fewest parts that fit, as even as possible, cutting at pauses between lines. Results go into a job file in "Danyel OZ Shorts/Shorts Maker jobs".
3. Daniel adjusts: move a part's end one whole line, split a part, join with the next. Part 1 always starts at the first line, the last part always ends after the last line. A part over the limit blocks cutting.
4. **Cut and schedule** (mode `cut`): ffmpeg cuts each part (fades, 2 s end card "Part 2 tomorrow / danyeloz.info"), uploads `<Song> - Part k of n.mp4` to the Drive folder.
5. Each part becomes a normal Shorts row (`series_id`, `part`) with "Part k of n" captions and one date per part. Then: edit captions, Upload to YouTube (private), copy TikTok and Instagram captions.

## Timing rules (keep these identical in `maker.py`, `ShortsMaker.gs` and `ShortsMakerApp.html`)

LEAD 2.5 s before the first line, TAIL 3.0 s after the last, a cut lands 0.35 s before the next line (never inside the previous one), end card 2.0 s (so a 59 s part holds 57 s of song).

## Testing changes

- `python shorts-maker/maker.py selftest` (planner on made-up songs).
- Cut a synthetic video: `ffmpeg -f lavfi -i testsrc2=s=1080x1920:r=30:d=70 -f lavfi -i sine=...` then `make_clip`, check length and look at a frame of the end card.
- Parity: run the same random songs through Python `part_times` and JS `partTimes_`; zero mismatches.
- Node mocks for `ShortsMaker.gs`, Playwright for the screen.

## When a run fails

- Open the run link on the series. Red before "Run" usually means setup (token, workflow not on `main`).
- "No sung lines were found": the vocals are buried; next step would be separating vocals (for example Demucs) before Whisper.
- A stretch longer than one part: plan again with 90 s parts.
- The workflow must stay in the **private** repo: run details are visible to anyone who can see the repo.

## Not built yet

Posting straight to TikTok (drafts only until TikTok reviews the app) and Instagram (needs a Business or Creator account linked to a Facebook Page, plus Meta review).
