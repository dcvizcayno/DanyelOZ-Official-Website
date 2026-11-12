---
name: sheets-integration
description: Query, update and automate Google Sheets and connected data through Apps Script (container-bound functions or doPost webhooks): turning a plain request into exact ranges and cell updates, building JSON payloads, and cleaning data on the way in or out. Use with the song-database skill for anything that writes to a sheet.
---

# Skill: Google Sheets & Apps Script Integration

## Purpose
Enables the agent to query, update, and automate Google Sheets and connected databases via Google Apps Script webhooks or direct container-bound functions.

## Capabilities
1. **Spreadsheet Data Mapping:** Translates natural language requests into precise A1 notation ranges and cell updates.
2. **Apps Script Payload Generation:** Formats JSON payloads to trigger `doPost` webhooks or server-side functions.
3. **Data Transformation:** Cleans, parses, and structures tabular data before sending it to or retrieving it from Google workspace tools.

## Execution Rules
- Always verify sheet names and column headers before generating read/write ranges.
- Wrap batch updates in single transactions to avoid hitting execution time limits.
- Ensure all incoming/outgoing webhooks include proper error handling and JSON validation.

## How these rules apply here (read CLAUDE.md first; it wins over anything here)

**Ranges come from headers, never fixed letters.** Columns move: the Singles Page screen adds `song_theme_1` and `song_theme_2` at the end, and new tabs gain columns on first use. So build A1 ranges at run time: read row 1, find the column with `head.indexOf('spotify_link')`, then turn that into a range (`sheet.getRange(row, col + 1)`). If a header is missing, stop with a clear message; never guess a position. Tabs are found by name (`getSheetByName`), and a missing tab is an error, not a cue to write elsewhere.

**"Single transaction" in Sheets means one batch plus a lock.** Sheets has no rollback. So:
- Read everything once with `getDataRange().getValues()`, change the copy in memory, then write back with **one** `setValues` on the smallest block that covers the changes. Avoid a `setValue` per cell in a loop for big jobs.
- Take the app's `lock_()` so two saves can't collide. It fails fast with a clear message.
- For long jobs, work in chunks of about 4 minutes, save your place in Script Properties, and say "Run it again" (see `tools/SpotifyBackfill.gs`). A crash then loses at most one chunk, and a rerun skips what's done.
- Before a big write, offer a preview that writes nothing, and keep the sheet's own value when it disagrees with an outside source.

**Keep data types steady.** gviz (which the widgets read) drops the minority type in a column, so keep each column all text or all numbers. UPCs and IDs are text: write them with a leading `'` or set the range's number format to `@` first. Dates are `yyyy-mm-dd` text. Trim whitespace, accept links only with `https://` on the platform's own domain, and colors only as `#RRGGBB`.

**Webhooks (`doPost`) need care here.** The admin app is deployed **Execute as: Me, Who has access: Only myself**, so it has no open door, and that's on purpose. A `doPost` webhook only works if the deployment allows **Anyone**, which would let anyone who finds the address write to the public Song Database. So:
- Prefer container-bound functions, time triggers, or the app screens. Use a webhook only when an outside service must push data in, and only with Daniel's OK.
- When one is needed, give it a **separate deployment** (its own small script if possible), never the admin app's.
- Require a shared secret: compare a field in the JSON body with a Script Property, and reject anything else. Apps Script can't read request headers in `doPost`, so the secret goes in the body.
- Validate the JSON before touching the sheet: parse inside `try/catch`, check the expected fields and types, cap sizes, and accept only known actions. Never pass sheet text or payload text into HTML or `eval`.
- Answer with `ContentService.createTextOutput(JSON.stringify({ ok, error })).setMimeType(ContentService.MimeType.JSON)`, and log failures with `console.error` (seen under Executions).
- Outgoing calls: `UrlFetchApp.fetch(url, { muteHttpExceptions: true })`, check the status code, parse JSON in `try/catch`, pace calls, and stop cleanly on HTTP 429.

**Public vs private.** Anything written to the Song Database is readable by anyone with its link. Keys, unreleased lyrics or chords, Shorts data and anything personal go in a private sheet, and keys only in Script Properties.

**Hand-over.** Test with Node mocks (SpreadsheetApp, UrlFetchApp, PropertiesService, ContentService), including bad input and a stopped-then-resumed run. Then tell Daniel which file to paste, which function to run, and when to redeploy, in plain words.
