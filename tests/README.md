# Tests

Run these after any change, from the repo root. They need Node 18+; the screen tests also need Playwright (`npm i -D playwright`, then `npx playwright install chromium`).
Nothing here touches the real Song Database, Drive, YouTube, Spotify or GitHub: every Google service is a mock.

## Server code (Apps Script, Node mocks)

| Command | Covers |
|---|---|
| `node tests/unit/test_songs.js apps-script/Code.gs` | Songs screen: reading, saving, checks |
| `node tests/unit/test_features.js apps-script/Code.gs` | Monthly Features |
| `node tests/unit/test_highlights.js apps-script/Code.gs` | Music Highlights |
| `node tests/unit/test_panels.js apps-script/Code.gs` | Explore Panels |
| `node tests/unit/test_shorts.js apps-script` | Shorts, X Posts, Analytics |
| `node tests/unit/test_maker.js apps-script` | Shorts Maker (planning, cutting, series) |
| `node tests/unit/test_singles.js apps-script` | Singles Page, themes |
| `node tests/unit/test_albums.js apps-script` | Albums Page and EPs Page |
| `node tests/unit/test_tracks.js apps-script` | Tracks screen: tracklists, lyrics and scores (public only once out), private Song Vault, ISRC fixes |
| `node tests/unit/test_tiktok.js apps-script` | TikTok posting: connect, TikTok's posting rules, post, status, 19-digit IDs, token refresh, Auto-post |
| `node tests/unit/test_spotify_backfill.js` | `tools/SpotifyBackfill.gs`: blank cells only, artist check, 429 pause, resume |

Each prints a "PASSED" line at the end; any failure stops with the line that broke.

## Screens (Playwright, mocked server)

```
node tests/ui/build.js        # builds tests/ui/page.html from Form.html and every included file, with mock.js as the server
node tests/ui/sg.js           # every admin screen opens (Singles, Albums, EPs, Tracks)
node tests/ui/tk.js           # Tracks screen at desktop and phone size (score preview loads abcjs from cdnjs)
node tests/ui/tk2.js          # Tracks album mode: song by song, Previous and Next
node tests/ui/ep.js           # EPs Page
node tests/ui/xp.js           # X Posts: pick a song from Song rotation to draft
node tests/ui/tt.js           # Shorts > TikTok tab: connect, posting choices, approve, post, status
```

Screenshots land in `tests/ui/out/` (ignored by git). Add a mock for any new server function in `tests/ui/mock.js` (the `H` object).

## Website widgets

Widgets live in the public repo danyeloz-embeds. Test them with the `widget-tester` agent: mocked sheet CSVs, desktop and 390 px phone, planted bad data (a song not out yet, HTML pasted into text, missing cover), no page errors, no sideways scroll.
