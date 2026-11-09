# Danyel OZ Official Website

> **Start with `CLAUDE.md`**: the full project handbook (also `HANDOFF.md` in danyeloz-embeds).
> The live widgets are in the public repo **dcvizcayno/danyeloz-embeds**; `embeds/` here is an older snapshot.

Code behind [danyeloz.info](https://www.danyeloz.info/home): the Google Sites embeds and the
Song Database data entry app. Everything reads from one Google Sheet, so the site updates
itself when the sheet changes.

## How it fits together

```
Song Database (Google Sheet)
 ├─ songs tab      ← Songs screen in the app      → Listen Now, Upcoming Release
 ├─ features tab   ← Monthly Features screen      → Featured Videos
 ├─ music_highlights ← Music Highlights screen    → Music Highlights
 └─ explore tab    ← Explore Panels screen        → Explore the Music
Apple Music catalog → newest release for Listen Now
```

The sheet is shared as "Anyone with the link: Viewer" so the embeds can read it.
Only editors can change it. Keep only public information in it: every tab is readable.

## apps-script/ (data entry app)

Paste into the sheet's **Extensions → Apps Script**: `Code.gs`, plus an HTML file named `Form`.
Deploy as a web app (**Execute as: Me**, **Who has access: Only myself**).
After any change: **Deploy → Manage deployments → pencil → New version → Deploy**.

| Screen | What it manages |
|---|---|
| Songs | All 16 song columns, cover art and QR uploads, Import from Apple Music |
| Monthly Features | 3 featured videos per month, planned 12 months ahead |
| Music Highlights | Up to 3 cards per month (Bandcamp player first), planned 12 months ahead |
| Explore Panels | The four "Explore the Music" tiles: text, links, images, order, show/hide |

## embeds/ (Google Sites: Insert → Embed → Embed code)

| File | Section | Suggested box height |
|---|---|---|
| `player-embed.html` | Listen Now: player card (Bandcamp, Apple Music backup) | 720px |
| `song-info-embed.html` | Listen Now: song details with Read more | 520px |
| `upcoming-player-embed.html` | Upcoming Release: player card | 560px |
| `upcoming-details-embed.html` | Upcoming Release: song details | 520px |
| `featured-videos-embed.html` | Featured Videos (changes on the 1st of each month) | 380px |
| `explore-music-embed.html` | Explore the Music panels (visual; links are native Sites text links) | 460px |
| `music-highlights-embed.html` | Music Highlights (music_highlights tab, covers and previews from Apple Music) | 780px |

Each embed has a **Settings** block at the top of its script (song to show, labels, what to show).

## Known Google Sites limits

- Embeds run in a sandbox: they can't open links in the same tab, and they can't resize their own box.
- Releases switch over at midnight Singapore time (`Asia/Singapore`).
