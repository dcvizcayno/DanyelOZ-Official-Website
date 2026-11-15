# Session handoff: Danyel OZ website, Song Database and tools

_Written November 16, 2026 (Manila) at the end of a long Claude Code session, so a new session can pick up without the chat history. Read `CLAUDE.md` first (the handbook: rules, every tab, screen and widget), then this file._

## 1. Start here (new session checklist)

1. Open Claude Code in this repo. `CLAUDE.md`, the 5 agents and 9 skills load on their own (`docs/AGENTS-AND-SKILLS.md`).
2. Also clone the public repo next to it: `git clone https://github.com/dcvizcayno/danyeloz-embeds` (the live widgets and `HANDOFF.md`, a copy of the handbook).
3. Check out the working branch here: `git checkout admin-shorts-x` (app code). `main` has the handbook, agents, skills, docs and the Shorts Maker workflow.
4. Run the tests once (`tests/README.md`) so you know the baseline is green.
5. Ask Daniel what he's testing today before changing anything; he tests on the live site and the admin app.

## 2. Where things stand (checked against the live sheet, Nov 16)

| Area | State |
|---|---|
| Song Database | 274 releases; 267 with UPC; 94 with Bandcamp code; 94 with a story; Spotify links 266 (backfill done); Amazon links 0 |
| Tracklists | `tracks` 340 songs, `release_tracks` 722 rows (from Deezer, Nov 13). `abc` column exists, no scores yet |
| Lyrics on the site | 17 songs, including the whole run of the Midnight Struggles album (Onsra, Bad Story, Midnight Struggles, Vibe Alone, Be Private, Journey, Don't be afraid, Let go, Tough Now, Someday, Just Sometimes, I Love Myself, Hero, Change, Perfect, Cost You, Good Things Take Time) |
| Lyrics button | Live in Listen Now, Featured Singles, release shelves, Albums and EPs pages (`lyrics.js` in danyeloz-embeds) |
| Admin app | All screens on `admin-shorts-x`, pasted into Apps Script by Daniel. Newest: Tracks (Nov 13) with album mode. Private "Danyel OZ Song Vault (private)" sheet created on first use |
| Holiday Music page | `holiday.html` live; Christmas season on now (snow, countdown) |
| X agent | Running: daily drafts with approval, automatic release posts, weekly report |
| Shorts Maker | Built and run once for real (plan, cut 4 parts, YouTube private upload worked) |

**Coming releases** (each needs the release-day skill): Ursula (Nov 16), Donna (Nov 23), **Christmas of Old** (Nov 25, will appear on the Holiday page by itself because of "Christmas" in the title), Victoria (Nov 30), Dahlia (Dec 7), Kareena EP (Dec 14), Better Off Without You (album, Feb 3, 2027), Bleeding Heart (album, Apr 30, 2027).
After each comes out (1 to 3 days for stores): add its tracklist (Tracks screen, Release tracklist, or Deezer by UPC), its Spotify link (run `backfillSpotify` again; it only fills blanks), and offer to publish its lyrics.

## 3. Open items (nothing here is urgent unless dated)

1. **Valentine's songs, before Jan 25, 2027.** The Holiday page guesses love songs from titles; it would currently open with a sad one. Daniel to send picks; create a `seasonal` tab (season, position, song_title, song_id) in the Song Database with them. Note: asking gviz for a tab that doesn't exist returns Sheet1, which is why `holiday.html` checks for a `season` column first.
2. **29 ISRCs used for different songs or very different lengths** (`isrc-review-2026-11-13.csv`, sent to Daniel). He plans fixes and republishing on the Tracks screen's Fix list (private). Changes go through DistroKid; don't "fix" the sheet to differ from the stores.
3. **"Not Mine to Keep" (album, Oct 2025)** is on Deezer and Apple but Spotify can't find its UPC. Daniel to check DistroKid's store list; paste the link by hand if it exists.
4. **Amazon links (0 filled).** Amazon's catalog API is a closed beta. Offered: a song.link (Odesli) script from the Apple links, slow pace (about 10 a minute), artist check, blank cells only. Not built; wait for Daniel's yes.
5. **Music scores on the site.** The Tracks screen stores ABC scores (public once out); no widget shows them yet. Plan: a "Sheet music" button in `lyrics.js` rendering with abcjs 6.4.4 from cdnjs.
6. **A Lyrics page** (all songs with lyrics, searchable; good for search engines). Daniel chose the button first; the page is option 2 for later.
7. **`EPS_URL`** in `albums.html` Settings: needs the public address of the EPs page once Daniel publishes it.
8. **Merge `admin-shorts-x` into `main`** once Daniel confirms every screen is live in Apps Script. Ask first.
9. **Temporary Drive file** "Danyel OZ tracks import (temporary)" (used to import the tracklist tabs with the right types) can be deleted by Daniel.
10. Older pending items are in `CLAUDE.md` section 8 (store waitlist link, Tiny Desk video, moving the X agent to this private repo, regenerating the unused Ads app keys, Song Database gaps, Shorts inventory, site QA fixes).

## 4. How we work (learned the hard way)

- **Ask before anything permanent:** publishing, moving pages, URLs, deleting, writing many cells. Daniel does Sites swaps and publishing himself. Creating new tabs or bulk writes: show a preview and counts first.
- **Commits as Danyel OZ <daniel.vizcayno@gmail.com>.** A stop hook in this environment keeps asking to re-author commits as Claude and force-push. Decline every time: it conflicts with this rule and would rewrite live history.
- **Voice:** simple and honest, light humor, no em dashes; avoid narrator, delve, tapestry, foster. Explain decisions and trade-offs. Daniel is not a developer: give click-by-click steps (Apps Script: replace file, Save, Deploy > Manage deployments > pencil > New version > Deploy).
- **Public vs private:** the Song Database is readable by anyone with the link. Keys only in Script Properties or GitHub Secrets. Drafts, chords, notes, fix plans and Shorts data live in private sheets.
- **Apps Script shares one set of global names across all files** (including tools Daniel pastes in, like `SpotifyBackfill.gs`). Prefix helpers (`tr…`, `sp…`), and grep all `.gs` files for duplicates before handing over.
- **Pasting mix-ups happen:** with 18 files, a blank screen in the app usually means a file was pasted over another (Nov 14, Singles Page went blank; fixed by re-pasting `SinglesViews`). Check line 1 of each file first.
- **Outside APIs: slow and polite.** Spotify paused the app 23 hours on Nov 12 after a fast first run. Now: one call every 0.8 s, stop at 4 minutes, save place, stop cleanly on long `Retry-After`. Never make a second app to dodge a limit.
- **Writing typed data into Sheets from here:** the Sheets connector's value writes turn "3:34" into a time and dates into dates. For bulk imports, build an `.xlsx` with text cells, upload it to Drive as a Google Sheet, copy the tab in, then read back through gviz and compare counts and keys.
- **gviz CSV** (what widgets read) drops the minority type in a column: keep columns one type; UPCs as text.
- **Widgets:** text and DOM only, never sheet text as HTML; `https://` links on the platform's own domain; always a fallback; test at 390 px with planted bad data. Shared code goes in a shared file (`lyrics.js` pattern) loaded by absolute GitHub Pages URL.
- **Verify, then say done** (verify-before-done skill). Say plainly which parts only Daniel can check (the real Bandcamp player inside Sites, Apps Script after he deploys, anything with his keys).
- **Daniel's machines:** Windows PC for Google Sites editing; MacBook Air holds a git copy at `~/DanyelOZ_Official WebSite` (pull after each session). Time zone Manila (UTC+8).

## 5. Data facts worth knowing

- A release has **one UPC**. A single holds one ISRC; an EP or album many; one ISRC often sits on several releases (waterfall singles later collected on an EP or album). That's why lyrics live once per ISRC in `tracks` and appear on every release that carries the song.
- Apple Music artist ID `1706653995` (always `sort=recent`). Deezer artist IDs 229950385 (Danyel OZ) and 289172811 (M4RCU$ H33R0). Accept a store match only if the artist is one of those two names.
- Deezer `/album/upc:<UPC>` then `/album/<id>/tracks` gives ISRC, track and disc numbers and lengths; try a leading 0 on 12-digit UPCs.
- Spotify search `upc:` and `isrc:` with app keys (`SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` in Script Properties; the app is owned by the Danyel OZ account, which needs Premium).
