# Danyel OZ: project handbook

_Last updated: November 13, 2026 (tracklists: `tracks` and `release_tracks` tabs added). One document for everything about danyeloz.info, the Song Database, the widgets and the X agent._

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
| `tracks` (read by name) | Tracks | nothing on the site yet; ready for tracklists, lyrics, scores, Shorts timing |
| `release_tracks` (read by name) | Tracks (Release tracklist) | nothing on the site yet; links releases to their songs |

**Song columns (Sheet1):** `song_id` (Apple collection ID), `song_title`, `release_date` (yyyy-mm-dd), `release_type` (Single, EP, Album),
`song_genre` ("Acoustic" puts a song on the Live page), `song_description` (first paragraph = intro line; blank line between paragraphs),
`song_ISRC`, `song_qr`, `song_upc` (stored as text), `record_label`, `yt_video_link`, `spotify_link`, `appl_music_link`, `amazon_link`,
`bandcamp_embed` (raw Bandcamp iframe code), `song_arts` (Google Drive share link, file shared "Anyone with the link"),
`song_theme_1` and `song_theme_2` (added at the end by the Singles Page screen; Theme 1 is required once themes exist).

**Other tabs:** `features`: month (YYYY-MM), slot 1 to 3, song_id, yt_video_link, title, description.
`explore`: order, visible, title, script, sub, text, link, image, focus.
`featured_singles`: position 1 to 10, song_id, song_title (only songs with a Bandcamp code). `seasonal` (optional, not created yet): season (christmas or valentine), position, song_title, song_id; replaces the automatic list on the Holiday Music page. `themes`: slot 1 to 5, theme, tagline, visible.
`albums`: song_id, song_title, kind (unsorted, main, installment, ep, single), part_of, show, collection, position, accent, hook, tracks, bonus, store_url, featured. It never changes a song's `release_type`. `album_collections`: slot, name, tagline, alias (another stage name), visible, page (`ep` for the EPs page, blank for Albums); up to 8 per page. A row's `kind` decides its page: `main` Albums, `ep` EPs (whatever its release_type), `installment` inside its album's sleeve (EP-type installments show on neither page), `single` nowhere. Featured is kept per page.
`tracks` (one row per recording, by ISRC): isrc, track_title, artist, duration (m:ss text), explicit, first_release, first_upc, releases, language, lyrics, abc (music score in ABC notation; added by the Tracks screen). `release_tracks` (one row per song on a release): upc, release_title, disc, track_number, isrc, track_title (as on that release), duration, bonus. A release has one UPC; a single holds one ISRC, an EP or album many, and one ISRC can sit on several releases (waterfall singles). Join Sheet1 `song_upc` to `release_tracks.upc`, then `isrc` to `tracks`. **Lyrics and scores go public only once a song is released** (the Tracks screen enforces it). Drafts, chords, key, BPM, notes and ISRC fix plans live in the private **"Danyel OZ Song Vault (private)"** sheet (`track_fixes`: isrc, issue, status, plan, new_isrc, new_upc, new_title, notes, updated; `track_notes`: isrc, bpm, key, time_signature, chords, draft_lyrics, draft_abc, notes, updated), never in the Song Database. `first_release`, `first_upc` and `releases` in `tracks` are recalculated from `release_tracks` whenever a tracklist is saved.
`music_highlights`: month, slot, actLabel, title, subtitle, catalogTag, accentHex, bandcamp_embed, coverImageUrl, and four platform links. Its "Row" and "Actions" columns are unused and left alone.

**Coverage (Nov 11, 2026, after the store backfill):** 273 releases. `song_id` 267, `song_upc` 267 (all stored as text), `appl_music_link` 266, `song_ISRC` 215 (single-track releases; EPs and albums left blank), `song_description` 44, `bandcamp_embed` 56, `song_arts` 273 (all; covers backfilled Nov 11).
**Store backfill (Nov 11, 2026):** one-time fill from Deezer (artist IDs 229950385 Danyel OZ, 289172811 M4RCU$ H33R0) plus Apple lookups by UPC. Blank cells only; 58 releases that were missing were added as new rows. Where the sheet and the stores disagreed (17 release types, 1 date, Bleeding Heart), the sheet value was kept. Backup CSV and review list were sent to Daniel. Covers: `tools/CoverBackfill.gs` ran Nov 11 and filled every row.
**Tracklists (Nov 13, 2026):** 266 released UPCs from Deezer: 340 recordings in `tracks`, 722 rows in `release_tracks`, all ISRCs and lengths filled; every single's `song_ISRC` matched. 154 recordings sit on more than one release. Kareena (EP, out Dec 14) and six releases without a UPC are upcoming and wait for release. 29 ISRCs carry different names or lengths across releases (`isrc-review-2026-11-13.csv`, sent to Daniel). **Spotify links:** `tools/SpotifyBackfill.gs`, first real run after Spotify's pause ends (Nov 13, about 9:10 PM Manila).
Some releases are under a different stage name (for example the EP "Money"); they belong in the database too.

**Apple Music:** artist ID `1706653995`. Always add `sort=recent` to catalog lookups; without it Apple returns the 200 oldest releases and misses new ones.

---

## 4. Data entry app (private)

Apps Script bound to the Song Database. Files: `Code.gs`, `Shorts.gs`, `XPosts.gs`, `Singles.gs`, `Albums.gs`, `ShortsMaker.gs`, `Tracks.gs` (scripts) and `Form`, `ShortsViews`, `ShortsApp`, `SinglesViews`, `SinglesApp`, `AlbumsViews`, `AlbumsApp`, `ShortsMakerViews`, `ShortsMakerApp`, `TracksViews`, `TracksApp` (HTML). `Form` pulls in the other ten HTML files, so all eighteen must be in the project.
**Status:** the Shorts, Shorts Maker, X Posts, Analytics, Singles Page, Albums Page, EPs Page and Tracks screens are on branch `admin-shorts-x`; merge it to `main` once they are live in Apps Script.
Deployed as a web app, **Execute as: Me**, **Who has access: Only myself**. After any code change: **Deploy > Manage deployments > pencil > New version > Deploy** (the link stays the same).

| Screen | What it does |
|---|---|
| Songs | Song list with covers, all 16 fields, cover and QR uploads (to Drive folders "Danyel OZ Song Art" and "Danyel OZ QR Codes"), **Import new releases from Apple Music** (adds new releases, links rows by title, fills blank Apple links and covers, never overwrites). **Missing info** filter with fill bars, "x of 16 fields filled" per song, a Shorts panel per song, and **Check changes before saving** (before/after list; can be switched off) |
| Monthly Features | 3 videos per month, 12 months ahead, Copy last month |
| Music Highlights | Up to 3 cards per month, pick a song to fill Bandcamp, cover and links, color picker |
| Explore Panels | The Explore the Music tiles: text, link, image upload ("Danyel OZ Site Images"), order, show or hide |
| Shorts | Pick a song and a video from the Drive folder "Danyel OZ Shorts" (or upload up to 30 MB), captions for YouTube, TikTok and Instagram from the song's story, batch scheduling, upload to YouTube as **private** (up to 50 MB). TikTok and Instagram: copy and post by hand |
| Shorts Maker | **New series**: pick a song and its long 9:16 lyric video from "Danyel OZ Shorts"; **Plan series** starts the editor (GitHub Actions), which times every sung line with Whisper and splits the song into parts in story order, each 59 s or less (or 90 s), cut only between lines. Nudge a part's end one line at a time, split or join parts; a part over the limit blocks the cut. **Cut and schedule**: ffmpeg cuts each part (fades, optional 2 s end card "Part 2 tomorrow / danyeloz.info"), uploads it to the Drive folder, and each part becomes a normal Shorts row (columns `series_id`, `part`) with "Part k of n" captions and one date per part. Then per part: edit captions, Upload to YouTube (private), Copy TikTok or Instagram caption, Open clip. **Series queue** lists every series and part. Series live in the `series` tab of the private Shorts sheet; job files in Drive "Danyel OZ Shorts/Shorts Maker jobs" |
| X Posts | The X agent's waiting draft: edit, Revise (with a note), Post, Draft one now, Pause drafts. Same as ticking boxes on the GitHub Issue |
| Singles Page | **Featured singles**: 10 slots, Bandcamp songs only, drag or arrows to reorder, fill empty slots with the newest singles. **Themes**: up to 5 (name, short line, show or hide); a rename or removal carries over to every song. **Theme your songs**: give many songs Theme 1 and 2 at once |
| Albums Page | **Now spinning** (pick the hero album or leave it automatic), **Coming next** (automatic), **Checks** (missing story or Bandcamp, unsorted). **Album library**: every row marked Album; say what it really is (main, installment of which album, became an EP, really a single) and switch it on or off for the page. **Collections**: up to 8, name, short line, other stage name; drag albums to order or move them. **Album editor**: color, hook, tracks, bonus, store link. First use seeds the 10 albums already on the page |
| EPs Page | The same screen as Albums Page for releases marked EP (plus albums sorted as "became an EP"): **A real EP** (can show), **Part of an album** (waterfall release; pick the album; listed in that album's sleeve), **Really a single**. Its own collections, now spinning and coming next |
| Tracks | **Checks** (ISRCs used for different songs or very different lengths, released without a tracklist, bad codes, a single's ISRC that differs, songs without lyrics). **Fix list** (private): per ISRC a status (To check, Keep as is, Republish planned, Sent to DistroKid, Republished), a plan (new ISRC, new UPC, both, title only), the new codes and notes. **Songs**: search and filters, basics (title, artist, language, explicit; public), the releases a song is on, and tabs for **Lyrics** and **Music score** (ABC notation with a live preview; a private draft plus **Publish to site**, which only works once the song is out, and **Take off site**), **Studio notes** (BPM, key, time signature, chords, notes; private) and **Fix plan**. **Release tracklist** (public): edit any release's songs (disc, number, ISRC, title, length, bonus); a new ISRC with **Replaces** set to the old one starts with the old song's title, lyrics, score and notes |
| Analytics | YouTube numbers for Shorts uploaded from the app, X numbers from the agent's log, hashtag ranking, Export CSV and summary (to Drive folder "Danyel OZ Reports") |

**Shorts schedule lives in a separate private sheet**, "Danyel OZ Shorts (private)", which the app creates on first use (its ID is kept in Script Properties as `SHORTS_SHEET_ID`). Nothing about Shorts goes in the public Song Database.

**Script Properties** (Project Settings > Script Properties; never in the sheet or in chat):
- `GITHUB_TOKEN`: fine-grained token for the X agent's repo with Issues and Actions (Read and write) and Contents (Read). Needed for X Posts. For the Shorts Maker it also needs **Actions: Read and write on DanyelOZ-Official-Website** (add that repo to the token).
- `SHORTS_REPO`: optional, defaults to `dcvizcayno/DanyelOZ-Official-Website`. Keep it a private repo: run details are visible to anyone who can see the repo.
- `X_REPO`: optional, defaults to `dcvizcayno/danyeloz-embeds`. Change it when the agent moves to the private repo.
- `VAULT_SHEET_ID`: set by the Tracks screen on first use; the private "Danyel OZ Song Vault (private)" sheet (tabs `track_fixes`, `track_notes`).
- `GEMINI_API_KEY`: optional; Gemini writes the captions. Without it, captions come from templates. `GEMINI_MODEL` optional (defaults to `gemini-flash-latest`).

**Shorts Maker and Drive:** each run gets the app's own Drive access token (`ScriptApp.getOAuthToken()`), which expires within an hour and is masked in the run log. No service account, nothing shared publicly. Whisper model `small`, cached between runs. Each 59 s part is about 25 to 30 MB, under the 50 MB YouTube upload limit.

**YouTube upload** needs the **YouTube Data API v3** service (Apps Script editor > Services +). Until Google approves the app, uploads stay private and Daniel makes them public in YouTube Studio.

The sheet also gets a **Danyel OZ** menu (open the form as a sidebar, import from Apple).
Saves use a lock that fails fast with a clear message, and log step timings under **Executions**.
To share the app with a helper: Execute as **User accessing the web app**, access **Anyone with Google account**, and add the helper as an Editor of the sheet.

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
| Connect | `follow-along.html`, `letter.html` (Cognito), plus the Cognito contact form embed |
| Live | `acoustic-takes.html` (songs whose genre contains "Acoustic"), plus the Songkick widget |
| Store | `available-now.html` (Bandcamp releases), `coming-soon.html` (merch waitlist, Production Vault) |
| About | `know-me.html`, `support.html` (Patreon, Buy Me a Coffee, Ko-fi, PayPal) |
| Every page | `footer.html`: LISTEN EVERYWHERE pills (Spotify, Apple Music, YouTube Music, Bandcamp) and +6 more (Amazon Music, Deezer, YouTube, Pandora, Audiomack, Boomplay) |

**How the Home widgets choose what to show**
- **Listen Now** shows the song with the newest `release_date` in the Song Database that is today or earlier, and switches at midnight Manila on release day. Same day: a song with a Bandcamp code wins. No Apple lookups for picking (Apple was unreliable). Bandcamp is the player; Apple Music only plays when a song has no Bandcamp code but has an Apple `song_id`.
- **Upcoming Release** shows the nearest song whose release date is still ahead; it moves on at midnight Manila on release day. A countdown badge shows in the last week.
- **Featured Videos** and **Music Highlights** show the current month's picks and switch at midnight on the 1st. An empty month keeps the last month that had picks.
- **Read more** in the song panels shows the first paragraph, then the rest on click.

**Rules every widget follows**
- Read the sheet by **header name**, never column position (gviz CSV with `&gid=`).
- Build the page with text and DOM elements, never by pasting sheet text in as HTML. Accept only `https://` links and check each platform's domain. Colors only as `#RRGGBB`. From Bandcamp code use only the `https://bandcamp.com/EmbeddedPlayer/...` address, never the pasted HTML.
- Always have a fallback: backup data, a cover, or a friendly message. Never an empty box.
- **Share menus** (Featured Singles, Explore by Theme, Albums) add "Want more? Check my Official Site" and the home link after the song link on X, WhatsApp, Threads, Telegram and More apps. Facebook only takes a link, so it shares the song link alone. `SITE_LINE` in each widget's Settings.
- Fit the box: Google Sites shrinks embeds on phones, so players and layouts size to the box (swipe rows, fit-to-box players).

**Tests:** logic was tested with Node mocks of SpreadsheetApp, layouts with Playwright using mocked sheet and Apple data, at desktop and phone sizes, plus planted bad data. Test the same way after changes.

---

## 6. X post agent

- **Daily draft at 7:07 PM Manila** (`x-draft.yml`). It picks a song with a `bandcamp_embed` (every song gets a turn before any repeats) and drafts a post linking to the song's Bandcamp page. No new draft while one is waiting.
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
7. **Shorts.** Shorts Maker built Nov 12, 2026 (first real run still to come; Whisper timing on sung vocals is the part to watch). TikTok and Instagram posting still by hand until their app reviews. Earlier idea: **Shorts inventory.** Build a "Shorts" tab (song_title, TikTok link, YouTube link, where the original file lives). Backfill gaps by hand from original files, not watermarked TikTok downloads. Then automate with the same Post or Revise approval. YouTube and TikTok only post publicly after an app audit, so apply early. Open question: where do the original files live (Mac, Google Drive, or only on the platforms)?
8. **Optional:** add `ANTHROPIC_API_KEY` as a GitHub secret for posts in Daniel's own voice.

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

Daniel's local copy of this repo: `~/DanyelOZ_Official WebSite` on his Mac.

