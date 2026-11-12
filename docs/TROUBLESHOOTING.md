# Troubleshooting

Problems we've actually hit, what they meant, and the fix. Newest first.

## Admin app

**"You do not have permission to call youtube.videos.insert"**
The YouTube service is on but you never gave the app permission. Run **authorizeYouTube** in the Apps Script editor, allow "Manage your YouTube account", deploy a new version. (`docs/SETUP.md` section 4.)

**"This video is 229 MB. Drop it in the Drive folder instead"**
You clicked **Upload from computer** (it takes files up to 30 MB). For a video already in the Drive folder, just pick it from the list. Long lyric videos belong in the **Shorts Maker**, not the Shorts screen.

**Shorts Maker stuck on "Planning"**
The page checks every 15 seconds and again when you come back to its tab; there's also a **Check now** button. If it stays stuck, open the run link it shows. A red run on GitHub usually means the token or setup, see the next item.

**"The GitHub token can't start the Shorts Maker" (403 or 404)**
The token lacks **Actions: Read and write** on `DanyelOZ-Official-Website`, or the workflow isn't on `main`. Fix the token (`docs/SETUP.md` section 3).

**"The GitHub token can't reach dcvizcayno/danyeloz-embeds (403)"** (X Posts)
Same cause for the public repo: the token needs Issues and Actions Read and write there.

**A screen doesn't show up after pasting new files**
A file is missing or misnamed (`Form` includes the others by exact name), or you didn't deploy a new version.

**"Google hasn't verified this app"**
Normal for a private script. Advanced > Go to … (unsafe) > Allow.

**Linked apps page doesn't list the script**
Check which Google account you're signed into (the script owner is daniel.vizcayno@gmail.com). Re-running a function in the editor is easier than revoking access there.

## Shorts Maker editor (GitHub run)

**"Node.js 20 is deprecated" / "ubuntu-latest will migrate"**
Notices, not errors. Already handled: actions updated, runner pinned to `ubuntu-24.04`.

**"No sung lines were found in this video"**
Whisper heard no singing (silent video, or the voice is buried under the music). Possible next step: separate vocals before transcribing.

**"One stretch of the song runs N seconds without a pause"**
A long instrumental or a run-on verse is longer than one part. Plan again with 90 second parts, or ask for a time-based cut for that stretch.

## Website

**Page looks old after a change**
GitHub Pages takes up to about 10 minutes; Google Sites a few more after Publish. Hard refresh (Ctrl+Shift+R, or Cmd+Shift+R on the Mac).

**Latest Release shows Apple Music instead of Bandcamp**
The newest song has no `bandcamp_embed` yet. Add the Bandcamp code in the Songs screen.

**A widget is an empty box**
Every widget has a fallback, so an empty box usually means the embed points at an old pasted copy instead of the By URL address.

## GitHub

**Stop hook says commits are "Unverified"**
They're unsigned, that's all. The handbook says commits go out as Danyel OZ, so we don't rewrite history or force-push `main` to change it.

**A test created real GitHub Issues**
Tests must run with `env -u GITHUB_TOKEN -u GH_TOKEN` so nothing reaches the real repo.

## YouTube

**Copyright claim on your own song**
Usually your own DistroKid Content ID. Ask DistroKid to allowlist @danyeloz1554; a dispute letter is the fallback.
