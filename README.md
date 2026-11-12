# Danyel OZ Official Website (private)

The engine room behind [danyeloz.info](https://www.danyeloz.info/home): the data entry app, the Shorts Maker editor and the project handbook.

**Start with [`CLAUDE.md`](CLAUDE.md)**, the full handbook. Claude Code reads it automatically. The same file lives as `HANDOFF.md` in the public repo and as `claude/handoff-summary.md` in the claude.ai Project.

## What lives where

| Folder | What it is |
|---|---|
| `apps-script/` | The private admin app (Google Apps Script, bound to the Song Database). Paste these files into the sheet's Apps Script project |
| `shorts-maker/` | The Shorts Maker video editor (Python, ffmpeg, Whisper). Runs on GitHub Actions |
| `.github/workflows/` | `shorts-maker.yml`, started by the admin app. Must also be on `main` |
| `tools/` | One-time helpers, such as `CoverBackfill.gs` |
| `docs/` | `SETUP.md` (one-time setups), `TROUBLESHOOTING.md` (errors seen so far and their fixes) |
| `.claude/skills/` | Step-by-step playbooks Claude follows for recurring jobs (release day, widgets, the app, Shorts, the X agent, the Song Database) |
| `.claude/agents/` | Helper agents: widget tester, data auditor, voice editor, app reviewer |
| `embeds/` | An **older snapshot** of a few widgets. The live widgets are in the public repo **dcvizcayno/danyeloz-embeds** |

## The other repo

**dcvizcayno/danyeloz-embeds** (public) holds the live widgets served at https://dcvizcayno.github.io/danyeloz-embeds/ and the X post agent. It is public because free GitHub Pages needs that, so nothing secret goes there.

## Branches

`admin-shorts-x` has the newest app screens (Shorts, Shorts Maker, X Posts, Analytics, Singles Page, Albums Page). Merge it into `main` once you're happy everything is live in Apps Script. The Shorts Maker workflow is already on `main`, because GitHub only starts workflows from there.
