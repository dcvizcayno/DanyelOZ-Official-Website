---
name: release-day
description: Checklist for a new Danyel OZ release (every 2 weeks): get the song into the Song Database and everything that feeds the site, X and Shorts. Use when Daniel says a song is coming out, was just released, or asks what to do for a release.
---

# Release day

Daniel releases a new song every 2 weeks. Most of the site updates itself from the Song Database, so the job is mostly making sure the right cells are filled in time. Work through this in order and tell him what's done and what's still his.

## About 7 days before

1. **Song row exists** with `song_title`, `release_date` (yyyy-mm-dd), `release_type`. The Songs screen's **Import new releases from Apple Music** can add it once Apple has it; otherwise he adds it by hand.
2. **Bandcamp code** (`bandcamp_embed`). Without it there is no X "coming soon" or "out now" post (the agent opens an Issue saying so) and Listen Now falls back to Apple.
3. **Story** (`song_description`). First paragraph = intro line on the site and in X posts and Shorts captions. Blank line between paragraphs.
4. **Cover** (`song_arts`, Drive link shared "Anyone with the link").

What then happens by itself:
- **Upcoming Release** on Home shows it as the nearest future song, with a countdown in the last week.
- **X agent** posts "coming soon" around 1 AM Manila once the song is 1 to 7 days out (no approval, by Daniel's choice).
- **Albums page** "Coming next" banner, if it's album-type and not marked single or EP.

## Release day

- At midnight Manila the song moves to **Listen Now**; X posts "out now" around 1 AM.
- Check the live Home page after about 10 minutes (hard refresh).

## The week after

1. **Store details**: UPC, ISRC, Apple link and ID can be filled from the stores (see the `song-database` skill, "Fill from the stores"). Stores usually have it 1 to 3 days after release. Then add its tracklist to `tracks` and `release_tracks` (same skill, "Tracklists"), and offer to paste the lyrics into `tracks.lyrics` now that it's out.
2. **Singles page**: offer to add it to Featured Singles (Bandcamp singles only) and to give it Theme 1 (and 2).
3. **Albums**: if it's part of an album or an installment, set it in the Album library.
4. **Shorts**: if a long 9:16 lyric video exists, suggest a Shorts Maker series (see the `shorts-maker` skill).
5. **Monthly Features / Music Highlights**: suggest it for next month's slots.

## Rules

- Ask before anything permanent (publishing, deleting, moving pages). Daniel does Sites changes himself.
- Never put private information in the Song Database: every tab is public.
- Voice: simple, honest, show don't tell, no em dashes, avoid narrator, delve, tapestry, foster.
