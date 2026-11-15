# Claude agents and skills for Danyel OZ

_November 16, 2026. 5 agents, 9 skills. They live in this repo under `.claude/`, so any Claude Code session that opens this repo gets them._

## How to move them

- **Same project, new computer or new session:** clone this repo (`git clone https://github.com/dcvizcayno/DanyelOZ-Official-Website`) and open Claude Code in it. `CLAUDE.md` and everything in `.claude/` load on their own. Nothing to install.
- **Your Mac copy:** `cd ~/"DanyelOZ_Official WebSite" && git pull`.
- **Keep them project-level.** They are written for this site, this sheet and these rules (Song Database ID, Bandcamp first, Manila time, the voice rules). Copying them into your user-level `~/.claude/` would make them fire in unrelated projects. Your general framework (multi-agent-claude) is the place for project-free agents; these two can live side by side.
- **Using them from another repo** (for example danyeloz-embeds): copy the `.claude/` folder and `CLAUDE.md` into that repo's root, or open Claude Code in this repo and point it at the other one.

## Agents (helpers that do one job and report back)

| Agent | File | Tools | Use it for |
|---|---|---|---|
| sheets-engineer | `.claude/agents/sheets-engineer.md` | Bash, Read, Write, Edit, Grep, Glob | Turning a plain request into a sheet change or Apps Script code: new tabs, backfills, API bridges (Spotify, Deezer, Apple, song.link). Reports before anything permanent. |
| app-reviewer | `.claude/agents/app-reviewer.md` | Read, Grep, Glob, Bash (read-only) | Safety review of an admin app or Shorts Maker change before it goes to Daniel. |
| data-auditor | `.claude/agents/data-auditor.md` | Bash, Read, Write (never writes to the sheet) | Song Database health: gaps, mixed column types, duplicates, odd dates, thin rows. |
| widget-tester | `.claude/agents/widget-tester.md` | Bash, Read, Write, Glob, Grep | Browser tests of a website widget with mocked sheet data, desktop and phone, plus planted bad data. |
| voice-editor | `.claude/agents/voice-editor.md` | Read, Grep | Checking fan-facing text against the voice rules (no em dashes, simple words, show don't tell). |

## Skills (routines Claude follows for a kind of task)

| Skill | Folder | Use it for |
|---|---|---|
| release-day | `.claude/skills/release-day/` | The every-2-weeks checklist: Song Database, site, X, Shorts, then tracklist, Spotify link and lyrics once the song is out. |
| song-database | `.claude/skills/song-database/` | Reading and safely changing the Song Database; store details, Spotify links, tracklists (`tracks`, `release_tracks`), lyrics rules. |
| sheets-integration | `.claude/skills/sheets-integration/` | Exact ranges from headers, batch writes with the lock, secured `doPost` webhooks, keeping column types steady. |
| admin-app | `.claude/skills/admin-app/` | Changing, testing and handing over the Apps Script admin app. |
| widget-work | `.claude/skills/widget-work/` | Building or changing a website widget: theme, safety rules, tests. |
| shorts-maker | `.claude/skills/shorts-maker/` | Running or fixing the Shorts Maker. |
| x-agent | `.claude/skills/x-agent/` | Running, changing or debugging the X post agent. |
| systematic-debugging | `.claude/skills/systematic-debugging/` | Finding the real cause before fixing anything (adapted from obra/superpowers, MIT). |
| verify-before-done | `.claude/skills/verify-before-done/` | Fresh proof before saying done, and naming what only Daniel can check (adapted from obra/superpowers, MIT). |

## What goes with them

| File | Why the next session needs it |
|---|---|
| `CLAUDE.md` | The handbook: rules, where everything lives, every tab and screen. Read first. |
| `docs/SESSION-HANDOFF.md` | Where the work stands right now and what's open. |
| `docs/SETUP.md`, `docs/TROUBLESHOOTING.md` | One-time setups and errors already solved. |
| `tests/` | Mocked tests for the app and tools (`tests/README.md` has the commands). |
