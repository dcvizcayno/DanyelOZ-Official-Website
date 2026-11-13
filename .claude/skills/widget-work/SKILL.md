---
name: widget-work
description: Build or change a website widget in the public repo danyeloz-embeds (Google Sites embeds served by GitHub Pages), including the theme, safety rules and the test routine. Use for any change to what fans see on danyeloz.info.
---

# Widget work

Live widgets: public repo **dcvizcayno/danyeloz-embeds**, served at `https://dcvizcayno.github.io/danyeloz-embeds/<file>.html`, embedded in Google Sites "By URL". A push shows on the site within about 10 minutes, no pasting.

## Before building something new

Make a mockup first when the change is visual or a new page (Daniel likes to see it before it's built). Use the Design artifact type when available.

## Every widget follows these rules

- A **Settings** block at the top of the script for things Daniel might tweak.
- Read the sheet by header name (gviz CSV, `&gid=` or `&sheet=`). Check the headers you need exist before using a tab.
- Build with DOM elements and `textContent`, never sheet text as HTML. Accept only `https://` links and check each platform's domain. Colors only `#RRGGBB`.
- Bandcamp: use only the `https://bandcamp.com/EmbeddedPlayer/...` address from the pasted code (and the `href` for the page link), never the pasted HTML. Ask for `bgcol=000000` and a red or accent `linkcol`.
- Always a fallback: backup data, a cover, or a friendly message. Never an empty box.
- Fit the box: Google Sites shrinks embeds on phones. No horizontal scroll at 390 px.
- Links inside an embed can only open a new tab (sandbox); internal navigation stays native Sites buttons.
- Share menus add "Want more? Check my Official Site" plus `https://www.danyeloz.info/home` after the song link (`SITE_LINE` setting); Facebook shares the link alone.

## Theme (red, white, black)

Fonts: Anton (titles), Oswald (labels, buttons), Great Vibes (script lines), Open Sans (body). Reds `#e3122a` (tags, hover) and `#b0101f` (emphasis). Buttons: white or black outline, spaced capitals, red on hover.

## Test before pushing

1. Playwright with the sheet mocked (route `docs.google.com` to fixture CSVs; abort other network).
2. Desktop (1280) and phone (390): screenshots, `document.documentElement.scrollWidth` equals the width, no page errors.
3. Planted bad data: `<img onerror>` titles, `javascript:` links, bad colors, a non-Bandcamp iframe. Nothing may execute or render as HTML.
4. Empty or missing tabs: the fallback shows.

The `widget-tester` agent can run this.

## After pushing

- List new widgets in `README.md` and `index.html` of danyeloz-embeds.
- Update the handbook (all three copies, see `CLAUDE.md` top).
- Commit as **Danyel OZ <daniel.vizcayno@gmail.com>**.
