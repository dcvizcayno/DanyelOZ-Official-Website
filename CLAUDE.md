# Danyel OZ: project handbook

_Last updated: November 21, 2026 (sync licensing: Sync tab, sync_settings, catalogue and one-sheet widgets; agent team). One document for everything about danyeloz.info, the Song Database, the widgets and the X agent._

**Copies of this file** (keep them identical; update all three together):
1. `CLAUDE.md` in private repo **dcvizcayno/DanyelOZ-Official-Website** (Claude Code reads it automatically)
2. `HANDOFF.md` in public repo **dcvizcayno/danyeloz-embeds**
3. `claude/handoff-summary.md` in the claude.ai Project "Danyel OZ Official Website"

---

## 1. Owner and working rules

**Daniel, music artist Danyel OZ.** Site: https://www.danyeloz.info. YouTube and X: @danyeloz1554. Releases new music every 2 weeks.
Time zone: **Manila / Singapore (UTC+8)**. Google Sites editing happens on his **Windows** machine (the Mac has limited Sites access).
Goal of the site: get the songs out there and give fans one central place to go.

**Rules to keep**
- **Ask before anything permanent:** publishing, moving pages, changing URLs, deleting. Daniel does the Sites swaps and publishing himself.
- **No new tabs.** Players play in place; internal links are native Sites buttons or text links. Only outside sites open a new tab.
- **Bandcamp first.** It plays full songs and sells or pre-orders; Apple Music and Spotify only preview. Apple is the backup player.
- **Cover art: `song_arts` first**, then Apple artwork found by `song_id`.
- **Writing voice:** simple and honest, show don't tell, light humor, **no em dashes**. Avoid the words narrator, delve, tapestry, foster.
- **Explain decisions,** not just changes. Be honest about trade-offs and limits.
- **Commits** go out as **Danyel OZ <daniel.vizcayno@gmail.com>**.

---

## 2. Where everything lives

| What | Where |
|---|---|
| Website | Google Sites, https://www.danyeloz.info |
| Song Database (single source of truth) | Google Sheet `1WD98RYgWPURqwtczPYEblCOOPFutAIO1jf42oSfbzPw` |
| Widgets (live, canonical) | Public repo **dcvizcayno/danyeloz-embeds**, served at https://dcvizcayno.github.io/danyeloz-embeds/ |
| Widget list | `README.md` and `index.html` in danyeloz-embeds |
| Data entry app (Apps Script) | Private repo **dcvizcayno/DanyelOZ-Official-Website**, folder `apps-script/` |
| X post agent | `x-agent/`, `data/x-posts.json`, `x-dashboard.html`, `.github/workflows/x-*.yml` in danyeloz-embeds (moving to the private repo, see Pending) |
| Shorts Maker editor | Private repo: `shorts-maker/maker.py` and `.github/workflows/shorts-maker.yml` (must be on `main`; GitHub only starts workflows from there) |
| X dashboard | https://dcvizcayno.github.io/danyeloz-embeds/x-dashboard.html |
| YouTube video relay (separate Apps Script) | Project doc `claude/danyel-oz-apps-script.gs`; feeds the YouTube grid with channel stats and public uploads |
| Contact and letters | Cognito Forms (`cognitoforms.com/DanyelOZ/...`), embedded on Connect |

**Two repos, two jobs.** danyeloz-embeds is public because free GitHub Pages needs it; nothing secret goes there.
The `embeds/` folder in the private repo is an **older snapshot** of a few widgets. The live versions are in danyeloz-embeds.

---

## 3. The Song Database

Shared as **Anyone with the link: Viewer** so the widgets can read it. That means **every tab is public**: keep only public information in it. Only Editors can change it.

| Tab (gid) | Edited in app screen | Feeds |
|---|---|---|
| `Sheet1` (0), the songs | Songs | almost every widget, the X agent, Music Highlights fallback |
| `features` (546510737) | Monthly Features | Featured Videos |
| `explore` (1777896887) | Explore Panels | Explore the Music |
| `music_highlights` (1521214689) | Music Highlights | Music Highlights |
| `featured_singles` (read by name) | Singles Page | Featured Singles |
| `themes` (read by name) | Singles Page | Explore by Theme |
| `albums` (read by name) | Albums Page, EPs Page | Albums and EPs pages |
| `album_collections` (read by name) | Albums Page, EPs Page | Albums and EPs pages |
| `tracks` (read by name) | Tracks | Lyrics button (`lyrics.js`) in Listen Now, Featured Singles, the release shelves and the Albums and EPs pages; the sync catalogue and one-sheet (`sync_*` columns, Tracks > Sync tab); scores not shown yet |
| `release_tracks` (read by name) | Tracks (Release tracklist) | Lyrics button: which songs are on a release |
| `sync_settings` (read by name) | Tracks (Licensing settings) | Rights line, contact and process text on the sync catalogue and one-sheet |

**Song columns (Sheet1):** `song_id` (Apple collection ID), `song_title`, `release_date` (yyyy-mm-dd), `release_type` (Single, EP, Album),
`song_genre` ("Acoustic" puts a song on the Live page), `song_description` (first paragraph = intro line; blank line between paragraphs),
`song_ISRC`, `song_qr`, `song_upc` (stored as text), `record_label`, `yt_video_link`, `spotify_link`, `appl_music_link`, `amazon_link`,
`bandcamp_embed` (raw Bandcamp iframe code), `song_arts` (Google Drive share link, file shared "Anyone with the link"),
`song_theme_1` and `song_theme_2` (added at the end by the Singles Page screen; Theme 1 is required once themes exist).

**Other tabs:** `features`: month (YYYY-MM), slot 1 to 3, song_id, yt_video_link, title, description.
`explore`: order, visible, title, script, sub, text, link, image, focus.
`featured_singles`: position 1 to 10, song_id, song_title (only songs with a Bandcamp code). `seasonal` (optional, not created yet): season (christmas or valentine), position, song_title, song_id; replaces the automatic list on the Holiday Music page. `themes`: slot 1 to 5, theme, tagline, visible.
`albums`: song_id, song_title, kind (unsorted, main, installment, ep, single), part_of, show, collection, position, accent, hook, tracks, bonus, store_url, featured. It never changes a song's `release_type`. `album_collections`: slot, name, tagline, alias (another stage name), visible, page (`ep` for the EPs page, blank for Albums); up to 8 per page. A row's `kind` decides its page: `main` Albums, `ep` EPs (whatever its release_type), `installment` inside its album's sleeve (EP-type installments show on neither page), `single` nowhere. Featured is kept per page.
`tracks` (one row per recording, by ISRC): isrc, track_title, artist, duration (m:ss text), explicit, first_release, first_upc, releases, language, lyrics, abc (music score in ABC notation; added by the Tracks screen). `release_tracks` (one row per song on a release): upc, release_title, disc, track_number, isrc, track_title (as on that release), duration, bonus. A release has one UPC; a single holds one ISRC, an EP or album many, and one ISRC can sit on several releases (waterfall singles). Join Sheet1 `song_upc` to `release_tracks.upc`, then `isrc` to `tracks`. **Lyrics and scores go public only once a song is released** (the Tracks screen enforces it). Drafts, chords, studio-note key and BPM, notes and ISRC fix plans live in the private **"Danyel OZ Song Vault (private)"** sheet (`track_fixes`: isrc, issue, status, plan, new_isrc, new_upc, new_title, notes, updated; `track_notes`: isrc, bpm, key, time_signature, chords, draft_lyrics, draft_abc, notes, updated), never in the Song Database. The one exception is on purpose: the public `sync_bpm` and `sync_key` in `tracks` (below) are separate copies Daniel chooses to publish for licensing; the studio-note BPM and key stay private. `first_release`, `first_upc` and `releases` in `tracks` are recalculated from `release_tracks` whenever a tracklist is saved.
**Sync columns in `tracks` (Nov 21, 2026, added by `Sync.gs` on the first Sync save, matched by header name):** `sync_bpm` (whole number 40 to 220), `sync_key` (one of the 24 major and minor keys), `sync_moods` (1 to 3 of 20 moods), `sync_genre` and optional `sync_genre_2` (from 12 genres), `sync_vocal` (Solo vocal, Duet, Instrumental only, Mixed), `sync_writers`, `sync_producers`, and the flags `sync_instrumental`, `sync_clean`, `sync_stems`, `sync_cut60`, `sync_cut30`, `sync_featured` (stored as `TRUE` or blank; up to 10 featured). `explicit` and `language` are reused. A song counts as **sync-complete** when it has BPM, key, at least one mood, genre, vocal and writers. `TRACK_COLUMNS` and `release_tracks` are not touched.
**`sync_settings` (one row, created when Licensing settings is saved the first time):** rights_holder, rights_line, one_stop, pro_name, contact_email, contact_url, turnaround, process_note, updated. Defaults until then: rights holder "Danyel OZ, LLC", one-stop yes, contact daniel.vizkaino@gmail.com, reply within "3 business days", PRO name blank (the rights sentence then stays generic). `contact_url` must be https on www.danyeloz.info, docs.google.com (forms), forms.gle or www.cognitoforms.com.
**What never goes in the sync fields or `sync_settings`** (they are public the moment they are saved, and caches keep copies): stem or file links, Drive links, IPI or CAE numbers, fees, splits, phone numbers, licensing requests, private notes. The app refuses links, email addresses, long digit runs and the words IPI and CAE in the public text fields, and says why. Stems are "on request" only.
`music_highlights`: month, slot, actLabel, title, subtitle, catalogTag, accentHex, bandcamp_embed, coverImageUrl, and four platform links. Its "Row" and "Actions" columns are unused and left alone.

**Coverage (Nov 11, 2026, after the store backfill):** 273 releases. `song_id` 267, `song_upc` 267 (all stored as text), `appl_music_link` 266, `song_ISRC` 215 (single-track releases; EPs and albums left blank), `song_description` 44, `bandcamp_embed` 56, `song_arts` 273 (all; covers backfilled Nov 11).
**Store backfill (Nov 11, 2026):** one-time fill from Deezer (artist IDs 229950385 Danyel OZ, 289172811 M4RCU$ H33R0) plus Apple lookups by UPC. Blank cells only; 58 releases that were missing were added as new rows. Where the sheet and the stores disagreed (17 release types, 1 date, Bleeding Heart), the sheet value was kept. Backup CSV and review list were sent to Daniel. Covers: `tools/CoverBackfill.gs` ran Nov 11 and filled every row.
**Tracklists (Nov 13, 2026):** 266 released UPCs from Deezer: 340 recordings in `tracks`, 722 rows in `release_tracks`, all ISRCs and lengths filled; every single's `song_ISRC` matched. 154 recordings sit on more than one release. Kareena (EP, out Dec 14) and six releases without a UPC are upcoming and wait for release. 29 ISRCs carry different names or lengths across releases (`isrc-review-2026-11-13.csv`, sent to Daniel). **Spotify links:** `tools/SpotifyBackfill.gs` ran Nov 13 to 14: 266 releases have a Spotify link. Not found: upcoming releases and "Not Mine to Keep" (on Deezer and Apple, not on Spotify by its UPC). Run it again after new releases; it fills blanks only.
Some releases are under a different stage name (for example the EP "Money"); they belong in the database too.

**Apple Music:** artist ID `1706653995`. Always add `sort=recent` to catalog lookups; without it Apple returns the 200 oldest releases and misses new ones.

---

## 4. Data entry app (private)

Apps Script bound to the Song Database. Files: `Code.gs`, `Shorts.gs`, `XPosts.gs`, `Singles.gs`, `Albums.gs`, `ShortsMaker.gs`, `Tracks.gs`, `TikTok.gs`, `Sync.gs`, `FormsSetup.gs` (scripts) and `Form`, `ShortsViews`, `ShortsApp`, `SinglesViews`, `SinglesApp`, `AlbumsViews`, `AlbumsApp`, `ShortsMakerViews`, `ShortsMakerApp`, `TracksViews`, `TracksApp` (HTML). `Form` pulls in the other ten HTML files, so all twenty must be in the project.
**Status:** the Shorts, Shorts Maker, X Posts, Analytics, Singles Page, Albums Page, EPs Page and Tracks screens are on branch `admin-shorts-x`; merge it to `main` once they are live in Apps Script.
Deployed as a web app, **Execute as: Me**, **Who has access: Only myself**. After any code change: **Deploy > Manage deployments > pencil > New version > Deploy** (the link stays the same).

| Screen | What it does |
|---|---|
| Songs | Song list with covers, all 16 fields, cover and QR uploads (to Drive folders "Danyel OZ Song Art" and "Danyel OZ QR Codes"), **Import new releases from Apple Music** (adds new releases, links rows by title, fills blank Apple links and covers, never overwrites). **Missing info** filter with fill bars, "x of 16 fields filled" per song, a Shorts panel per song, and **Check changes before saving** (before/after list; can be switched off) |
| Monthly Features | 3 videos per month, 12 months ahead, Copy last month |
| Music Highlights | Up to 3 cards per month, pick a song to fill Bandcamp, cover and links, color picker |
| Explore Panels | The Explore the Music tiles: text, link, image upload ("Danyel OZ Site Images"), order, show or hide |
| Shorts | Pick a song and a video from the Drive folder "Danyel OZ Shorts" (or upload up to 30 MB), captions for YouTube, TikTok and Instagram from the song's story, batch scheduling, upload to YouTube as **private** (up to 50 MB). **TikTok** (Nov 16, 2026, `TikTok.gs`): Connect TikTok once, then on each Short's TikTok tab choose who can see it, comments, Duet, Stitch and commercial content, and **Approve**; **Auto-post** posts approved Shorts at their date and time (every 15 minutes), **Post now** right away. Until TikTok's audit it only posts to a private account (setup and audit: `docs/SETUP.md` 6b). Instagram: copy and post by hand |
| Shorts Maker | **New series**: pick a song and its long 9:16 lyric video from "Danyel OZ Shorts"; **Plan series** starts the editor (GitHub Actions), which times every sung line with Whisper and splits the song into parts in story order, each 59 s or less (or 90 s), cut only between lines. Nudge a part's end one line at a time, split or join parts; a part over the limit blocks the cut. **Cut and schedule**: ffmpeg cuts each part (fades, optional 2 s end card "Part 2 tomorrow / danyeloz.info"), uploads it to the Drive folder, and each part becomes a normal Shorts row (columns `series_id`, `part`) with "Part k of n" captions and one date per part. Then per part: edit captions, Upload to YouTube (private), Copy TikTok or Instagram caption, Open clip. **Series queue** lists every series and part. Series live in the `series` tab of the private Shorts sheet; job files in Drive "Danyel OZ Shorts/Shorts Maker jobs" |
| X Posts | The X agent's waiting draft: edit, Revise (with a note), Post, Draft one now, Pause drafts. Same as ticking boxes on the GitHub Issue. Song rotation lists every song with a Bandcamp code (search box): **Draft** next to one asks the agent for that song now; if a draft is waiting, it asks first, then closes it unposted and drafts the pick |
| Singles Page | **Featured singles**: 10 slots, Bandcamp songs only, drag or arrows to reorder, fill empty slots with the newest singles. **Themes**: up to 5 (name, short line, show or hide); a rename or removal carries over to every song. **Theme your songs**: give many songs Theme 1 and 2 at once |
| Albums Page | **Now spinning** (pick the hero album or leave it automatic), **Coming next** (automatic), **Checks** (missing story or Bandcamp, unsorted). **Album library**: every row marked Album; say what it really is (main, installment of which album, became an EP, really a single) and switch it on or off for the page. **Collections**: up to 8, name, short line, other stage name; drag albums to order or move them. **Album editor**: color, hook, tracks, bonus, store link. First use seeds the 10 albums already on the page |
| EPs Page | The same screen as Albums Page for releases marked EP (plus albums sorted as "became an EP"): **A real EP** (can show), **Part of an album** (waterfall release; pick the album; listed in that album's sleeve), **Really a single**. Its own collections, now spinning and coming next |
| Tracks | **Checks** (ISRCs used for different songs or very different lengths, released without a tracklist, bad codes, a single's ISRC that differs, songs without lyrics). **Fix list** (private): per ISRC a status (To check, Keep as is, Republish planned, Sent to DistroKid, Republished), a plan (new ISRC, new UPC, both, title only), the new codes and notes. **Songs**: search and filters, basics (title, artist, language, explicit; public), the releases a song is on, and tabs for **Lyrics** and **Music score** (ABC notation with a live preview; a private draft plus **Publish to site**, which only works once the song is out, and **Take off site**), **Studio notes** (BPM, key, time signature, chords, notes; private) and **Fix plan**. **Release tracklist** (public): edit any release's songs (disc, number, ISRC, title, length, bonus); a new ISRC with **Replaces** set to the old one starts with the old song's title, lyrics, score and notes. **Album mode**: the tracklist shows each song's lyrics status (Write, or ✓ Edit) and "lyrics for x of y songs"; **Write lyrics, song by song** opens the first song without lyrics, with Previous and Next through the release in track order. **Sync** (Nov 21, 2026, `Sync.gs`: `getSyncAdmin` reads only, `saveTrackSync` and `saveSyncSettings` save): a **Sync** tab per song (BPM, key, moods, genres, vocal, writers, producers, Instrumental, Clean, Stems, 60 s, 30 s, Featured; **Copy from studio notes** copies only BPM and key, then you check and save), a **Sync readiness** card ("x of y songs complete" and what each song still needs) and a **Licensing settings** card (rights holder, rights line, one-stop, PRO name, contact email and form link, reply time, process note, with a preview of the rights sentence). Everything saved there is public |
| Analytics | YouTube numbers for Shorts uploaded from the app, X numbers from the agent's log, hashtag ranking, Export CSV and summary (to Drive folder "Danyel OZ Reports") |

**Shorts schedule lives in a separate private sheet**, "Danyel OZ Shorts (private)", which the app creates on first use (its ID is kept in Script Properties as `SHORTS_SHEET_ID`). Nothing about Shorts goes in the public Song Database.

**Script Properties** (Project Settings > Script Properties; never in the sheet or in chat):
- `GITHUB_TOKEN`: fine-grained token for the X agent's repo with Issues and Actions (Read and write) and Contents (Read). Needed for X Posts. For the Shorts Maker it also needs **Actions: Read and write on DanyelOZ-Official-Website** (add that repo to the token).
- `SHORTS_REPO`: optional, defaults to `dcvizcayno/DanyelOZ-Official-Website`. Keep it a private repo: run details are visible to anyone who can see the repo.
- `X_REPO`: optional, defaults to `dcvizcayno/danyeloz-embeds`. Change it when the agent moves to the private repo.
- `VAULT_SHEET_ID`: set by the Tracks screen on first use; the private "Danyel OZ Song Vault (private)" sheet (tabs `track_fixes`, `track_notes`).
- `FS_CONTACT_FORM_ID`, `FS_SYNC_FORM_ID`, `FS_INBOX_SHEET_ID`, `FS_SONG_DB_ID` and the `FS_ITEMS_` entries: set by `setupDanyelOzForms` (own forms, below). Don't edit them by hand.
- `GEMINI_API_KEY`: optional; Gemini writes the captions. Without it, captions come from templates. `GEMINI_MODEL` optional (defaults to `gemini-flash-latest`).

**Shorts Maker and Drive:** each run gets the app's own Drive access token (`ScriptApp.getOAuthToken()`), which expires within an hour and is masked in the run log. No service account, nothing shared publicly. Whisper model `small`, cached between runs. Each 59 s part is about 25 to 30 MB, under the 50 MB YouTube upload limit.

**YouTube upload** needs the **YouTube Data API v3** service (Apps Script editor > Services +). Until Google approves the app, uploads stay private and Daniel makes them public in YouTube Studio.

The sheet also gets a **Danyel OZ** menu (open the form as a sidebar, import from Apple).
Saves use a lock that fails fast with a clear message, and log step timings under **Executions**.
To share the app with a helper: Execute as **User accessing the web app**, access **Anyone with Google account**, and add the helper as an Editor of the sheet.
**Warning (own forms, accepted risk, Nov 21, 2026):** an Editor of the Song Database can also edit this bound script project, including `FormsSetup.gs`, and its form trigger runs as Daniel with permission to read the forms and send email. A helper with Editor access could read or redirect every contact message and sync license request. Daniel accepted this risk when choosing to keep `FormsSetup.gs` in this project; don't give anyone Editor access to the Song Database, the forms or the inbox without accepting it again.

**Own forms (Nov 21, 2026, `FormsSetup.gs`):** replace the Cognito contact form and give the sync catalogue a real request form, with Google Forms as the free backend. Daniel runs `setupDanyelOzForms()` once from the Apps Script editor (steps: `docs/SETUP.md` 10). It is safe to re-run: it reuses the forms and the inbox by the ids in Script Properties, re-applies every form setting and logs any setting it had to put back. It creates or reuses two Google Forms, **"Danyel OZ contact"** and **"Sync license request"** (fields fixed in `FS_FORMS`, the same list as `OZForms.FIELDS` in `forms-core.js`), links both to one private sheet, **"Danyel OZ Inbox (private)"** (never the Song Database: setup and the trigger refuse it), and installs one submit trigger on the inbox spreadsheet that calls `fsOnFormSubmit`. Each reply sends a plain-text summary to daniel.vizkaino@gmail.com (Reply-To set to the sender only when the email is valid; no link to the inbox in the mail). Setup prints a `FORMS_JSON_BEGIN` ... `FORMS_JSON_END` block (each form's public `formResponse` address and its entry ids) that becomes `data/forms.json` in danyeloz-embeds; the inbox address is logged separately, for Daniel only. Re-run setup after any edit to a form and refresh `forms.json`. Nobody else gets edit access to the forms or the inbox (an editor can read every reply). Replies are kept for 1 year, then deleted from the form responses, the inbox and Gmail (privacy policy; monthly steps in `docs/SETUP.md` 10). Code names: top-level names start with `fs` or `FS_`; helpers end in `_`.

---

## 5. The widgets

All widgets live in danyeloz-embeds. Each has a **Settings** block at the top of its script.

| Page | Widgets |
|---|---|
| Home | `player.html` + `song-info.html` (Listen Now), `upcoming-player.html` + `upcoming-details.html` (Upcoming Release), `featured-videos.html`, `music-highlights.html`, `explore-music.html` |
| Released | `explore-releases.html`, `release-shelf.html?type=Single|EP|Album|Holiday`; Singles page: `featured-singles.html` (10 picks, details left, player right, 01 to 10 strip), `explore-themes.html` (theme tiles, play button opens a small player, Read more, Share) |
| EPs | `albums.html?page=ep`: the Albums design for EPs (EP tags, "Buy the EP", EP collections, Coming next for EPs). `EPS_URL` in Settings once the page address is known |
| Albums | `albums.html`: Coming next banner on top (countdown, pre-order; hidden when nothing is coming; `NEXT_ON_TOP = false` moves it to the bottom), Now spinning hero, collection rows of covers, a sleeve in the album's color opens under its row (Bandcamp album player, story, Buy or Store, Share, installments listed). Falls back to albums with Bandcamp and a story if the tabs are empty. `albums.html?only=next` is just the banner for other pages; with nothing coming it shows the latest album |
| Holiday Music | `holiday.html`: changes with the season by the date in Manila. Christmas Nov 1 to Dec 25 (snow, red and gold, countdown), New Year Dec 26 to Jan 6 (gold sparkles, Christmas songs), Valentine's Jan 25 to Feb 15 (blush, hearts, love songs), otherwise both collections and a countdown to the next season. Songs are picked automatically (Christmas: genre Holiday or a Christmas word in the title; Valentine's: romantic or love genre, or a love word in the title) unless a `seasonal` tab lists them (season, position, song_title). Preview with `?season=` or `?date=` |
| Behind the Scenes | `tiny-desk.html`, `in-progress.html` |
| Connect | `follow-along.html`, `letter.html` (Cognito), plus the Cognito contact form embed until Daniel swaps in `contact.html` (own contact form, Google Forms backend; `docs/SETUP.md` 10) |
| Live | `acoustic-takes.html` (songs whose genre contains "Acoustic"), plus the Songkick widget |
| Store | `available-now.html` (Bandcamp releases), `coming-soon.html` (merch waitlist, Production Vault) |
| About | `know-me.html`, `support.html` (Patreon, Buy Me a Coffee, Ko-fi, PayPal) |
| Sync licensing (pages not created yet) | `sync.html`: the licensing catalogue for music supervisors (rights line, Request a license, search and filters by mood, genre, tempo, key, vocal and Instrumental, Clean, Stems, 60 s, 30 s; one card per released song; How licensing works). `sync-one-sheet.html`: the one-sheet (rights, contact, short bio, featured songs topped up to 8 with complete ones); prints to exactly one A4 or Letter page. Both use `sync-core.js` |
| Every page | `footer.html`: LISTEN EVERYWHERE pills (Spotify, Apple Music, YouTube Music, Bandcamp) and +6 more (Amazon Music, Deezer, YouTube, Pandora, Audiomack, Boomplay) |

**How the Home widgets choose what to show**
- **Listen Now** shows the song with the newest `release_date` in the Song Database that is today or earlier, and switches at midnight Manila on release day. Same day: a song with a Bandcamp code wins. No Apple lookups for picking (Apple was unreliable). Bandcamp is the player; Apple Music only plays when a song has no Bandcamp code but has an Apple `song_id`.
- **Upcoming Release** shows the nearest song whose release date is still ahead; it moves on at midnight Manila on release day. A countdown badge shows in the last week.
- **Featured Videos** and **Music Highlights** show the current month's picks and switch at midnight on the 1st. An empty month keeps the last month that had picks.
- **Read more** in the song panels shows the first paragraph, then the rest on click.
- **Lyrics** (Nov 13, 2026): `lyrics.js` adds a Lyrics button to Listen Now (`song-info.html`, `SHOW.lyrics`), Featured Singles, the release shelves and the Albums and EPs pages (`albums.html`; the album player stays visible while reading), only when the release has a song whose lyrics are published and whose `first_release` is today or earlier. It swaps the panel for the lyrics (Back or Escape returns); `[Chorus]`-style lines become small red labels; an EP or album lists its songs with lyrics in track order ("1. Title"), with Previous and Next buttons and "Lyrics for x of y songs so far". Text only, never HTML.
- **Sync licensing** (Nov 21, 2026): `sync-core.js` is shared by `sync.html` and `sync-one-sheet.html`, the way `lyrics.js` is shared (`window.OZSync`: reads `tracks`, `sync_settings` and Sheet1, joins covers and links by UPC, builds the rights and process wording, checks links, picks the one-sheet songs). Only released songs show (`first_release` today or earlier). If `sync_settings` is missing, the defaults show; if `tracks` has no sync columns yet, a friendly "not available right now" message shows. Neither page reads anything from the address bar that could change contact, rights, links or text. No IPI or CAE numbers anywhere.

- **Own forms** (Nov 21, 2026): `forms-core.js` is shared by `contact.html` and the sync catalogue's request panel (`window.OZForms`). It reads `data/forms.json`, checks the fields (required, email, choice lists, length limits), and posts with `mode: 'no-cors'` (no cookies, no referrer) only to a `https://docs.google.com/forms/d/e/<id>/formResponse` address. Bots: a hidden honeypot field (`website`) and a 3 second minimum fill time; either one means nothing is sent. Text-only DOM, no third-party scripts or fonts. If `forms.json` is missing or invalid, or a send fails, the form gives way to the email address as selectable text with a Copy email button. A privacy note under each form links to https://www.danyeloz.info/about/privacy. `contact.html`: heading Contact & Collaborations; first name, last name, email, topic (Fan Contact, Music Collaborations, Beat Licensing & Instrumentals, Sync & Licensing, Media & Business Inquiries, General Inquiries), subject, message; submits in place, never opens a tab. **Sync panel:** `sync.html` loads `forms-core.js` before `sync-core.js`; Request a license then shows the inline "Sync license request" form (name, email, company or production, song or songs prefilled from the button, project, media type, territory, term, timeline, optional budget range and notes), with "Prefer email? Send your request to:" and the email below. `sync-one-sheet.html` doesn't load the form. **`data/forms.json`** (written by Claude from Daniel's setup output, ids checked against it before every push): `{"version": 1, "forms": {"contact": {"action": "https://docs.google.com/forms/d/e/<id>/formResponse", "fields": {"first_name": "entry.123", ...}}, "sync": {...}}}`. Each field value must look like `entry.` plus 4 to 12 digits, all different; each form is checked on its own, so a bad `sync` block doesn't break `contact`.

**Rules every widget follows**
- Read the sheet by **header name**, never column position (gviz CSV with `&gid=`).
- Build the page with text and DOM elements, never by pasting sheet text in as HTML. Accept only `https://` links and check each platform's domain. One exception, for the sync pages only: a `mailto:` link to the `contact_email` in `sync_settings` (checked against a strict email pattern, no extra fields), and the `contact_url` only when it is https on www.danyeloz.info, docs.google.com (forms), forms.gle or www.cognitoforms.com. Colors only as `#RRGGBB`. From Bandcamp code use only the `https://bandcamp.com/EmbeddedPlayer/...` address, never the pasted HTML.
- Always have a fallback: backup data, a cover, or a friendly message. Never an empty box.
- The form widgets (`contact.html`, the sync request panel) send only to the checked `formResponse` address in `data/forms.json`. No other widget posts anything anywhere.
- **Share menus** (Featured Singles, Explore by Theme, Albums) add "Want more? Check my Official Site" and the home link after the song link on X, WhatsApp, Threads, Telegram and More apps. Facebook only takes a link, so it shares the song link alone. `SITE_LINE` in each widget's Settings.
- Fit the box: Google Sites shrinks embeds on phones, so players and layouts size to the box (swipe rows, fit-to-box players).

**Tests:** logic was tested with Node mocks of SpreadsheetApp, layouts with Playwright using mocked sheet and Apple data, at desktop and phone sizes, plus planted bad data. Test the same way after changes. The sync pages have their own tests in the private repo (`tests/widgets/`, see `tests/README.md`), and so do the own forms (`test_formscore.js`, `contact.js`, `sync_form.js`; `FormsSetup.gs` in `tests/unit/test_formssetup.js`).

---

## 6. X post agent

- **Daily draft at 7:07 PM Manila** (`x-draft.yml`). It picks a song with a `bandcamp_embed` (every song gets a turn before any repeats) and drafts a post linking to the song's Bandcamp page. No new draft while one is waiting.
- **Pick a song yourself (Nov 16, 2026):** Draft next to a song in the admin app's Song rotation, or run `x-draft.yml` by hand with **song** filled in. The draft says "Your pick". If a draft is waiting, **replace** closes it (label `x-replaced`, nothing posted) and drafts the pick. Without a pick, the 7:07 PM rotation works as before. A picked song counts as one post in the round.
- **Approval:** each draft is a GitHub Issue assigned to Daniel. Tick **Post** to publish, or **Revise** for a new version (comment a note first to steer it). He can also edit the draft text, then tick Post. Only the repo owner's ticks count.
- **Release posts, automatic, about 1 AM Manila** (`x-release.yml`, no approval by Daniel's choice): "coming soon" once a song is 1 to 7 days from its `release_date`, and "out now" on release day, both linking to the song's Bandcamp page. At most one per night ("out now" first). Each song gets each post once; a missed night is not made up. No Bandcamp code means no post and an Issue saying so. Each post leaves a closed `x-release` Issue with the link. Release posts are left out of the song rotation and the playbook. Run it by hand with **dry run** ticked to preview.
- **Weekly report every Monday at 9:23 AM Manila** (`x-metrics.yml`): views, likes, replies, reposts, link clicks. It updates `playbook.json`, tries each approach (question, story, invite, behind) at least 3 times, then mostly uses the winners and experiments 20% of the time.
- **Account:** @danyeloz1554, X app in **Default Project (Pay Per Use)**. Key check (`x-check.yml`) passed. About **$0.20 per post** with a link.
- **Voice rules** live in `x-agent/config.json` and match section 1.
- **Site line (Nov 10, 2026):** every post (daily drafts and release posts) ends with "Want more? Check my Official Site https://www.danyeloz.info/home", to lead new fans to the site. Set in `config.json` (`site_line`, `site_url`; `site_line: ""` turns it off). The story line shortens first so the post stays within 280.
- **Keys:** GitHub Secrets `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`. Without all four it runs in test mode. Optional `ANTHROPIC_API_KEY` makes Claude write in Daniel's voice instead of templates.
- **Status:** first real post went out Nov 9, 2026 (NOTE TO SELF).

---

## 7. Google Sites: limits and tips

**Limits (don't promise otherwise)**
- Embeds are sandboxed: a link inside an embed can only open a **new tab**, and nested iframes inherit this. Same-tab navigation needs native Sites buttons or text links.
- An embed can't resize its own box. Set heights in the editor; long text scrolls inside the box.
- After Publish, the live page can take a few minutes to update. Hard refresh (Ctrl+Shift+R) if it looks stale.
- TikTok's feed embed hits TikTok's rate limit ("overload-protect"); keep a plain "Watch on TikTok" button as backup.

**Editing tips**
- Duplicate a page as "X v2" to work on it safely.
- Swap embed code with the pencil on a code embed.
- Paste text through the clipboard; typing "·" fails.
- Check focus before pressing Backspace; it can delete whole sections.
- Link Sites buttons by picking the page from the list (pasting a full address can open a new tab).

---

## 8. Pending

1. ~~First real X post~~ Done Nov 9, 2026.
2. **Store waitlist link.** `coming-soon.html` has `WAITLIST = ''`. When the Cognito "Merch waitlist" form is ready, send its public link; it gets converted to the `/f/` address and pushed.
3. **Tiny Desk video.** `tiny-desk.html` has `VIDEO = ''`. Send the YouTube link when ready.
4. **Move the X agent to the private repo** (DanyelOZ-Official-Website): `x-agent/`, `data/x-posts.json`, `x-dashboard.html` and the four `x-*.yml` workflows. Daniel re-adds the 4 X secrets there. Also remove the committed `x-agent/__pycache__/` and add a `.gitignore`.
5. **Regenerate the keys of the app in the Ads project** (DanyelOZ_Official_Websites). They were pasted in chat. Unused, so regenerating is safe.
6. **Song Database gaps.** 12 of the 50 X-eligible songs have no description, so their posts read generic: fill those first. Then add Bandcamp codes for the rest, and add releases under other stage names.
7. **Shorts.** Shorts Maker built Nov 12, 2026 (first real run still to come; Whisper timing on sung vocals is the part to watch). TikTok posting built Nov 16, 2026 (`TikTok.gs`); public posts wait for TikTok's audit, which Daniel applies for (docs/SETUP.md 6b). Instagram still by hand. Earlier idea: **Shorts inventory.** Build a "Shorts" tab (song_title, TikTok link, YouTube link, where the original file lives). Backfill gaps by hand from original files, not watermarked TikTok downloads. Then automate with the same Post or Revise approval. YouTube and TikTok only post publicly after an app audit, so apply early. Open question: where do the original files live (Mac, Google Drive, or only on the platforms)?
8. **Optional:** add `ANTHROPIC_API_KEY` as a GitHub secret for posts in Daniel's own voice.
9. **Sync licensing (built Nov 21, 2026, not live yet).** For Daniel: paste `Sync.gs` and the new `TracksApp` and `TracksViews` into Apps Script and deploy (`docs/SETUP.md` 9); open Tracks > Licensing settings, set the PRO name (or leave it blank for the generic sentence) and Save; approve the one-sheet bio; fill the Sync tab for each song (the readiness card shows what is missing); create the Sites pages and paste `docs/sync-contact-copy.md`; confirm the Song Database is shared as **Viewer**, not Editor. Nothing is published until Daniel says OK.

**Smaller items from the site QA (Nov 3)**
- Header banner photo on Home is about 1.3 MB (43% of the page); compress to about 200 KB.
- Add alt text to images (9 of 10 large Home images had none) and a site description for search.
- Text fixes: "combimation" on Fan Letter, "Check-out" in the top banner. Onsra page heading vs menu name, and EP vs Single filing.
- Keep only public info in the sheet: any new tab (for example a Form Responses tab) is readable by anyone with the link.

---

## 9. Decisions on record

- **Bandcamp** is the main player everywhere; Apple Music is the backup.
- **Explore the Music** panels are visual only; text links under them handle navigation so pages open in the same tab.
- **ISRC** is safe to show (it's public). UPC and record label are hidden by default.
- **Widgets on GitHub Pages:** edit in danyeloz-embeds and the site updates within about 10 minutes, no pasting.
- **The data entry app stays private** ("Only myself"), so one link controls the whole site's content.
- **Home theme (Nov 10, 2026): red, white and black**, matching Explore the Music. Fonts: Anton (titles), Oswald (labels, buttons), Great Vibes (script lines). Reds `#e3122a` (tags, hover) and `#b0101f` (emphasis text). Upcoming card: red-washed with the blurred cover behind it. Latest card: black with a red glow. Story panels: white, black titles, red for the first story line and labels. Streaming buttons: white outline, spaced capitals, red on hover. Bandcamp players are asked for a black background and red links. Music Highlights: site red on every card (`USE_ACCENTS = true` brings back each act's sheet color).

---

## 10. Working with Claude: skills, agents, docs

Private repo only (they describe how the project runs; nothing secret in them).

| File | Use it for |
|---|---|
| `.claude/skills/release-day/` | The every-2-weeks release checklist |
| `.claude/skills/song-database/` | Reading and safely changing the Song Database; filling store details from Deezer and Apple |
| `.claude/skills/sheets-integration/` | Turning requests into exact sheet ranges and batch writes, JSON payloads and `doPost` webhooks (secured), data cleanup |
| `.claude/skills/systematic-debugging/` | Before fixing anything that broke: find the real cause first (borrowed from obra/superpowers, MIT) |
| `.claude/skills/verify-before-done/` | Before saying anything is done: fresh proof first, and say which parts only Daniel can check (borrowed from obra/superpowers, MIT) |
| `.claude/skills/widget-work/` | Building or changing a website widget, theme, safety rules, tests |
| `.claude/skills/admin-app/` | Changing, testing and handing over the Apps Script app |
| `.claude/skills/shorts-maker/` | Running or fixing the Shorts Maker |
| `.claude/skills/x-agent/` | Operating or changing the X post agent |
| `.claude/agents/widget-tester.md` | Mocked-data browser tests of a widget, desktop and phone |
| `.claude/agents/data-auditor.md` | Read-only audit of Song Database gaps and data health |
| `.claude/agents/voice-editor.md` | Checking copy against the voice rules |
| `.claude/agents/sheets-engineer.md` | Turning a plain request into a sheet change or Apps Script code (schema, backfills, API bridges); reports before anything permanent |
| `.claude/agents/app-reviewer.md` | Safety review of an app or Shorts Maker change before handover |
| `docs/SETUP.md` | Every one-time setup: Apps Script, Script Properties, GitHub token, YouTube permission, X secrets, Shorts Maker, Sites embeds |
| `docs/TROUBLESHOOTING.md` | Errors seen so far and their fixes |
| `docs/sync-contact-copy.md` | Paste-ready Sync & Licensing text for the Contact page, and the Sites steps |
| `docs/SESSION-HANDOFF.md` | Where the work stands and what's open; read it first in a new session |
| `docs/AGENTS-AND-SKILLS.md` | Index of the agents and skills, and how to move them |
| `tests/` | Mocked tests for the app and tools; `tests/README.md` has the commands |

Daniel's local copy of this repo: `~/DanyelOZ_Official WebSite` on his Mac.

---

## 11. Agent team

The private repo carries a seven-role agent team. Its full charter lives in the `team-protocol` skill, not here, so ordinary sessions do not pay for it.

| Role | Job |
|---|---|
| Supervisor | Runs in the main session (`team-supervisor` skill): writes the charter, picks the risk tier, hands out tasks, runs the gates, reports back to Daniel |
| Researcher | Finds the facts and options a decision needs, with sources |
| Planner | Splits the work into tasks with a definition of done, tests and a way back |
| Executor | Builds exactly one task inside its allowed files, with proof (commands and results) |
| QA | Checks the work independently and gives a verdict; does not fix it |
| Security | Threat model and risk list; can stop a release on a serious risk |
| Monitor | Watches time, budget and drift against the plan |

- **Start a run only when asked:** `/team-run <task> [tier]`. Tier T0 to T3 sets how much process it gets (T0 a read-only answer, T3 irreversible or production data, which needs Daniel's approval).
- **Use it for** multi-step or public-facing work, changes across several files or both repos, anything touching the Song Database schema (new tabs or columns), public pages and rights wording, money or secrets.
- **Don't use it for** one-line fixes, one-file tweaks or questions; a normal session is faster.
- **Run records** live in `runs/<run-id>/` (charter, board, plan, research, exec, qa, security and monitor notes, final report). Anything under `runs/` follows `team-protocol`: load that skill before reading or writing there.
- Workers (`.claude/agents/team-*`) preload `team-protocol`; the Supervisor loads it through `team-supervisor`.
- **Keep the checks green.** After changing anything in `.claude/`, `team/` or `scripts/`, run both:
  - `node scripts/validate.mjs`
  - `node --test scripts/tests/`
- Text files are LF (`.gitattributes`); skill and agent frontmatter fails validation with CRLF.
- Skill scripts are Node `.mjs` with no dependencies, so they run the same on Windows and Unix.
