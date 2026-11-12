---
name: song-database
description: How to read, check and change the Danyel OZ Song Database (Google Sheet) safely, including filling store details (UPC, ISRC, Apple links, covers) from Deezer and Apple. Use for any data question, cleanup, backfill or bulk edit of the sheet.
---

# Song Database

Google Sheet `1WD98RYgWPURqwtczPYEblCOOPFutAIO1jf42oSfbzPw`. The single source of truth for the site. Shared "Anyone with the link: Viewer", so **every tab is public**. Columns and tabs are listed in `CLAUDE.md` section 3.

## Reading

- Fastest exact copy: `https://docs.google.com/spreadsheets/d/<ID>/export?format=csv&gid=0` (keeps values as typed).
- Widgets use gviz CSV (`/gviz/tq?tqx=out:csv&gid=0` or `&sheet=<name>`). gviz picks one type per column and **drops cells of the minority type**, so mixed number/text columns lose values there. Keep each column one type.
- Always read by header name, never by column position.

## Before any write

1. **Back up**: save the export CSV with today's date and send it to Daniel.
2. **Blank cells only** unless he asks otherwise. Where the stores disagree with the sheet, keep the sheet and list the disagreement for him.
3. Check the header row and row count still match what you planned against.

## Writing (Google Sheets connector)

- `update_values` uses "user entered" input: numbers become numbers, `2025-07-28` becomes a date. Send `null` for cells to skip.
- **UPC must stay text**: write `'199516428375` (leading apostrophe; stored as text, apostrophe hidden).
- Dates in `release_date` are real dates formatted yyyy-mm-dd; writing `2025-07-28` matches them.
- After writing, export again and diff against the backup: every changed cell must be one you meant to change.

## Fill from the stores (UPC, ISRC, Apple link and ID, label, missing releases)

1. Deezer (free, no key): artists `229950385` (Danyel OZ) and `289172811` (M4RCU$ H33R0). `/artist/<id>/albums?limit=500`, `/album/<id>` (upc, label, release_date, cover_xl, tracks), `/track/<id>` (isrc). Throttle about 8 requests a second.
2. Match rows by UPC, then ISRC, then normalized title plus exact date, then title within a few days. A title-only match goes on the review list, not into the sheet.
3. Apple by UPC: `https://itunes.apple.com/lookup?entity=album&upc=<a,b,c>` (batches of 20, about 3 seconds apart). Short link form `https://music.apple.com/us/album/<collectionId>`. Songs Apple dropped from the artist page are usually still found by UPC.
4. ISRC only for single-track releases (an EP or album has one per track).
5. New releases go in as new rows (title, date, type, genre from Apple, ISRC, UPC as text, label, Apple link and ID). Existing rows keep their values.
6. Covers: don't upload through the connector one by one. Use `tools/CoverBackfill.gs` (Daniel runs it once from the Apps Script editor; it saves covers to "Danyel OZ Song Art", shares them, fills blank `song_arts`).
7. Not available for free: Amazon links (closed API). Spotify needs Daniel's own developer app (Premium required since Feb 2026).

## Other sources

`Personal/ISRC` on Daniel's OneDrive (Microsoft 365 connector): `Song-Catalog-ISRC-Update-2025.xlsx` and ISRC CSVs. It's his full recording history, including old versions and drafts. Old UPCs there are from his previous distributor; never copy them over the live ones.
