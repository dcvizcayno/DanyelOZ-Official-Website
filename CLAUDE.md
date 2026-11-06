# Danyel OZ Official Website: context for Claude

Read this first. It sums up how the site was built so work can continue from here.

## Owner
Daniel, music artist **Danyel OZ**. Site: https://www.danyeloz.info/home (Google Sites).
Releases new music every 2 weeks. Times are **Singapore (Asia/Singapore)**.
Google Sites editing is done on his **Windows** machine (the Mac has limited Google Sites access).

## Writing and design preferences
- Plain, encouraging, honest tone. Explain decisions, not just changes. Light humor is fine.
- **No em dashes** in anything written for him or for the site.
- Keep fan-facing text short; let the music and stories do the work.

## Architecture
One Google Sheet, the **Song Database**, feeds everything:
`https://docs.google.com/spreadsheets/d/1WD98RYgWPURqwtczPYEblCOOPFutAIO1jf42oSfbzPw`
Shared "Anyone with the link: Viewer" so embeds can read it, so **every tab is public**. Keep only public info in it.

| Tab (gid) | Managed in app screen | Used by embed |
|---|---|---|
| `Sheet1` (0): songs, 16 columns | Songs | player, song-info, upcoming-*, highlights fallback |
| `features` (546510737) | Monthly Features | featured-videos |
| `explore` (1777896887) | Explore Panels | explore-music |
| `music_highlights` (1521214689) | Music Highlights | music-highlights |

Song columns: song_id (Apple collection ID), song_title, release_date (yyyy-mm-dd), release_type,
song_genre, song_description (first paragraph = blue intro line, blank line between paragraphs),
song_ISRC, song_qr, song_upc (text), record_label, yt_video_link, spotify_link, appl_music_link,
amazon_link, bandcamp_embed (raw iframe code), song_arts (Drive share link).

Apple Music artist ID `1706653995`. Use `sort=recent` on lookups (200+ releases).

## Code locations
- `apps-script/Code.gs` + `apps-script/Form.html`: private data entry web app (Apps Script bound to the sheet,
  Execute as Me, Only myself). Screens: Songs, Monthly Features, Music Highlights, Explore Panels.
  After edits: Deploy > Manage deployments > New version.
- `embeds/*.html`: Google Sites embeds. Also published as full pages in the public repo
  **dcvizcayno/danyeloz-embeds** for GitHub Pages (`https://dcvizcayno.github.io/danyeloz-embeds/<name>.html`),
  embedded with Insert > Embed > By URL. Keep both repos in sync.

## Rules every embed follows
- Read sheet data by **header name**, never column position (gviz CSV `...&gid=<gid>`).
- Build the page with `textContent`/DOM, never by pasting sheet text into HTML. Accept only `https://` links,
  check platform domains, accept colors only as `#RRGGBB`, and use only the `src` of Bandcamp code
  (`https://bandcamp.com/EmbeddedPlayer/...`), never the pasted HTML.
- Always have a fallback (backup data, cover image, or a friendly message). Never show an empty box.
- Settings block at the top of each script for labels and options.
- Bandcamp is the preferred player (full songs, pre-orders); Apple Music is the backup.
- Phones: Google Sites shrinks embed boxes, so layouts fit the box height (swipe rows, fit-to-box players).

## Known Google Sites limits (don't promise otherwise)
- Embeds are sandboxed: links can only open **new tabs**; nested iframes inherit this. Same-tab navigation needs
  native Sites buttons or text links (used under Explore the Music).
- Embeds can't resize their own box; set heights in the Sites editor.
- Publishing can take a few minutes to show live.

## Tests
Earlier work was tested with Node mocks of SpreadsheetApp (save/import/features/panels/highlights)
and Playwright renders with mocked sheet and Apple data. Re-test the same way after changes.

## Open items
- GitHub Pages: make `danyeloz-embeds` public, enable Pages (main, root), then swap each Sites embed to By URL.
  Checklist: Danyel-OZ-Embed-Setup-Checklist.xlsx.
- Listen Now could get a phone-friendly pass like the newer embeds.
