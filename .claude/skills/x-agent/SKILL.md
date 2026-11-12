---
name: x-agent
description: Operate, change or debug the X (Twitter) post agent for @danyeloz1554: daily drafts with Post or Revise approval, automatic release posts, weekly metrics. Use for anything about X posts.
---

# X agent

Lives in the public repo **dcvizcayno/danyeloz-embeds**: `x-agent/agent.py`, `x-agent/config.json`, `data/x-posts.json`, `x-dashboard.html`, workflows `x-draft.yml`, `x-release.yml`, `x-metrics.yml`, `x-check.yml`. (Planned move to the private repo, see Pending in `CLAUDE.md`.)

## What it does

- **Daily draft, 7:07 PM Manila**: picks a song with a Bandcamp code (each song gets a turn before repeats), opens a GitHub Issue assigned to Daniel. He ticks **Post** or **Revise** (a comment first steers the rewrite), or edits the text then ticks Post. The admin app's X Posts screen does the same. Only the repo owner's ticks count. No new draft while one is waiting.
- **Release posts, about 1 AM Manila, automatic**: "coming soon" when a song is 1 to 7 days out, "out now" on release day, linking to the Bandcamp page. One per night, "out now" first; each song gets each post once; a missed night is not made up. No Bandcamp code means an `x-release-skipped` Issue.
- **Weekly report, Monday 9:23 AM Manila**: views, likes, replies, reposts, link clicks; updates `playbook.json` (each approach tried at least 3 times, then mostly the winners, 20% experiments).
- Every post ends with "Want more? Check my Official Site https://www.danyeloz.info/home" (`site_line`, `site_url` in `config.json`). The story line shortens first so the post fits 280 (links count as 23).

## Safe testing

- Run locally only with `env -u GITHUB_TOKEN -u GH_TOKEN`, or a test can open real Issues.
- On GitHub, run `x-release.yml` by hand with **dry run** ticked to preview.
- Cost: about $0.20 per post with a link (X Pay Per Use).

## Voice

Rules in `config.json` match the handbook: simple, honest, show don't tell, light humor, no em dashes, no narrator, delve, tapestry, foster. Optional `ANTHROPIC_API_KEY` secret makes Claude write the drafts.

## Keys

GitHub Secrets `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`. Never in code or chat.
