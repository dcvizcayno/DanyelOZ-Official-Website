# One-time setups

Everything you set up once and then forget about. Keys and tokens go only where this page says (Script Properties or GitHub Secrets), never in the Song Database and never in chat.

## 1. The admin app (Apps Script)

1. Open the Song Database, then **Extensions > Apps Script**.
2. Make sure all twenty files are there, with these exact names:
   - Scripts: `Code`, `Shorts`, `XPosts`, `Singles`, `Albums`, `ShortsMaker`, `Tracks`, `TikTok`, `Sync`
   - HTML: `Form`, `ShortsViews`, `ShortsApp`, `SinglesViews`, `SinglesApp`, `AlbumsViews`, `AlbumsApp`, `ShortsMakerViews`, `ShortsMakerApp`, `TracksViews`, `TracksApp`
3. **Services +** (left sidebar): add **YouTube Data API v3**, name **YouTube**.
4. **Deploy > New deployment > Web app**: Execute as **Me**, Who has access **Only myself**.
5. After every code change: **Deploy > Manage deployments > pencil > New version > Deploy**. The link stays the same.

Check `appsscript.json` (Project Settings > Show manifest): `"webapp": {"executeAs": "USER_DEPLOYING", "access": "MYSELF"}`. If it says `"ANYONE"`, anyone with a Google account and the link can use the app as you.

## 2. Script Properties (Project Settings > Script Properties)

| Property | Needed for | Notes |
|---|---|---|
| `GITHUB_TOKEN` | X Posts, Shorts Maker | Fine-grained token, see section 3 |
| `X_REPO` | X Posts | Optional, defaults to `dcvizcayno/danyeloz-embeds` |
| `SHORTS_REPO` | Shorts Maker | Optional, defaults to `dcvizcayno/DanyelOZ-Official-Website`. Must stay private |
| `GEMINI_API_KEY` | Captions | Optional. Without it captions come from templates. `GEMINI_MODEL` optional |
| `SHORTS_SHEET_ID` | Shorts | Set by the app itself on first use. Don't touch |

## 3. The GitHub token

Direct link: **https://github.com/settings/personal-access-tokens** (or profile picture > Settings > Developer settings, at the very bottom > Personal access tokens > Fine-grained tokens).

- Repository access: **Only select repositories**: `danyeloz-embeds` and `DanyelOZ-Official-Website`.
- Repository permissions: **Issues** Read and write, **Actions** Read and write, **Contents** Read.
- Editing the token keeps its value, so nothing changes in Apps Script. A regenerated token must be pasted into `GITHUB_TOKEN` again.

## 4. YouTube permission

1. In the Apps Script editor pick **authorizeYouTube** and click **Run**.
2. Sign in with the account that owns **@danyeloz1554**. On "Google hasn't verified this app": **Advanced** (small, bottom left) > **Go to … (unsafe)** > **Allow**. "Unsafe" only means Google hasn't reviewed your private script.
3. The log should say `YouTube connected: <your channel>`. Then deploy a new version.

Uploads stay **private** until Google approves the app (an API audit, free but slow). Make them public in YouTube Studio meanwhile.

## 5. The X agent (public repo danyeloz-embeds)

GitHub Secrets (repo > Settings > Secrets and variables > Actions): `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`. Optional: `ANTHROPIC_API_KEY` for posts in your own voice. Without all four X keys the agent runs in test mode.

## 6. The Shorts Maker

1. GitHub token from section 3 must include `DanyelOZ-Official-Website` with Actions Read and write.
2. `.github/workflows/shorts-maker.yml` and `shorts-maker/` must be on the `main` branch.
3. Long 9:16 videos go in the Drive folder **Danyel OZ Shorts**. The editor gets a Drive token from the app for each run (expires within an hour, masked in the logs). No service account, nothing shared publicly.

## 6b. TikTok posting (Shorts)

The app posts approved Shorts to TikTok through TikTok's Content Posting API (`TikTok.gs`).

**On TikTok's side (only Daniel can do this)**
1. Sign in at developers.tiktok.com with the Danyel OZ TikTok account and create an app (Manage apps > Connect an app). Give it a name, the icon, a short description, and the links to a Terms of Service page and a Privacy Policy page on danyeloz.info (TikTok checks these).
2. Add the products **Login Kit** and **Content Posting API**. In Content Posting API, turn on **Direct Post**.
3. Scopes: `user.info.basic` and `video.publish`.
4. Login Kit > Redirect URI: the web app's address, the `https://script.google.com/macros/s/…/exec` link (the TikTok tab in the app shows it).
5. Copy the **Client key** and **Client secret**.

**In Apps Script**
1. Add the new script file **TikTok** and replace **Code**, **ShortsApp** and **ShortsViews**.
2. Project Settings > Script Properties: add `TIKTOK_CLIENT_KEY` and `TIKTOK_CLIENT_SECRET`.
3. Deploy > Manage deployments > pencil > New version > Deploy.
4. Open a Short > TikTok tab > **Connect TikTok** and allow. Google asks once for the new permissions (time triggers for Auto-post): Advanced > Go to … (unsafe) > Allow.
5. Tick **Auto-post** on the TikTok tab.

**Before TikTok's audit:** TikTok only accepts posts to a **private** account, and the posts are seen by you alone. To test, set the TikTok account to private for a moment, post one Short with "Only me", then set it back. A public account gets the message "TikTok hasn't approved this app yet".

**The audit (to post publicly):** in the developer portal, submit the app for review with a screen recording of the whole flow: Connect TikTok, the TikTok tab (who can see it, comments, Duet, Stitch, commercial content, the Music Usage Confirmation line), Approve, Post now, and the post appearing on TikTok. The TikTok tab already follows TikTok's Content Sharing Guidelines (no preset for who can see it, interactions off until turned on, branded content can't be private, the creator's name shown). Approval takes days to weeks.

**Keep in mind:** the sign-in refreshes on its own; after 180 days without use, connect again. The app sends videos up to 50 MB. TikTok allows 6 post requests a minute; Auto-post sends at most 2 per 15-minute run.

## 7. Google Sites embeds

Insert > Embed > **By URL**: `https://dcvizcayno.github.io/danyeloz-embeds/<widget>.html`. A By URL embed updates itself about 10 minutes after a push. A pasted-code embed does not. Set the box height in the editor; an embed can't resize its own box.

## 8. Commits

Commits go out as **Danyel OZ <daniel.vizcayno@gmail.com>**. Don't rewrite or force-push history.

## 9. Sync licensing

Everything saved here lands in the public Song Database. Never type stem or file links, IPI or CAE numbers, fees or private notes into it (the app refuses most of them).

1. In Apps Script, add the new script file **Sync** and replace **TracksApp** and **TracksViews** with the new versions.
2. **Deploy > Manage deployments > pencil > New version > Deploy.**
3. Open the app > **Tracks** > **Licensing settings**. Set the PRO name (leave it blank until you have joined one; the rights sentence then stays generic), check the contact email, reply time and rights line in the preview, then **Save**. The first save creates the `sync_settings` tab.
4. Fill songs: open a song > **Sync** tab > BPM, key, moods, genre, vocal, writers (Copy from studio notes fills BPM and key for you to check) > **Save**. The first Sync save adds the `sync_` columns to `tracks`. The **Sync readiness** card shows what each song still needs. Tick **Featured** on up to 10 songs for the one-sheet.
5. Check the pages before using them: `https://dcvizcayno.github.io/danyeloz-embeds/sync.html` (catalogue) and `https://dcvizcayno.github.io/danyeloz-embeds/sync-one-sheet.html` (print it once to check it fits one page).
6. Google Sites: create the catalogue page and add the Sync & Licensing section on the Contact page by following `docs/sync-contact-copy.md` (text to paste, embed steps). Publish only when you are happy with it.
7. Confirm the Song Database is shared as **Anyone with the link: Viewer**, not Editor.

## 10. Own contact and sync request forms (Google Forms)

These replace the Cognito contact form and add the "Sync license request" form to the sync catalogue. Replies are stored by Google Forms in a private sheet, **"Danyel OZ Inbox (private)"** (never the Song Database), and you get an email at daniel.vizkaino@gmail.com for each one. Cognito stays live until you swap it out in step 9.

**Accepted risk (read first).** `FormsSetup.gs` goes in the admin Apps Script project, which is bound to the Song Database. Anyone who is an Editor of the Song Database can change that script, and its form trigger runs as you, with permission to read the forms and send email. Such a person could read or redirect every contact message and sync license request. Don't give anyone Editor access to the Song Database (the helper-sharing mode in `CLAUDE.md` section 4 does that), the forms or the inbox unless you accept this.

1. Open the Song Database > **Extensions > Apps Script** (the admin project). Add a script file **FormsSetup** and paste in `apps-script/FormsSetup.gs`. Save.
2. In the function list at the top, choose **setupDanyelOzForms** > **Run**. Setup stores what it needs in Script Properties by itself: `FS_CONTACT_FORM_ID`, `FS_SYNC_FORM_ID`, `FS_INBOX_SHEET_ID`, `FS_SONG_DB_ID` (the Song Database's id, so replies can never land there) and the `FS_ITEMS_` entries. Don't edit them.
3. Approve the permissions Google asks for: Google Forms, Google Sheets, running triggers, and **sending email as you** (used only to send you the notification for each reply). If Google says the app isn't verified: **Advanced > Go to (project name)**.
4. When it finishes, open the **Execution log**. Copy everything from `FORMS_JSON_BEGIN` to `FORMS_JSON_END` and paste it to Claude. Claude writes `data/forms.json` in danyeloz-embeds, checks the form ids against your block and pushes. The log also shows the inbox sheet's address on its own line: bookmark it and keep it to yourself (it's not in the notification emails on purpose).
5. Check sharing. Open the inbox sheet and both forms (forms.google.com) > **Share**: General access must be **Restricted**, with no other editors. Never add editors: anyone who can edit a form or the inbox can read every reply.
6. Update the Privacy page on Sites (https://www.danyeloz.info/about/privacy) with the new text in `docs/legal/privacy-policy.md`, and publish it before the new forms go live.
7. **Send a test message** once Claude has pushed `forms.json`: open `https://dcvizcayno.github.io/danyeloz-embeds/contact.html`, fill in every field, put `=1+1` somewhere in the message, and press **Send message**. Within a few minutes you should see a new row in the inbox sheet and an email with the subject `Website message: <topic> | <subject>`; pressing Reply in Gmail should answer the address you typed. In the inbox sheet, the message cell must show `=1+1` as text, not `2`; if it shows `2`, stop and tell Claude. Then open `https://dcvizcayno.github.io/danyeloz-embeds/sync.html`, press **Request a license** on any song and send a test request (subject `Sync license request: ...`). If either one doesn't arrive, don't swap anything; tell Claude.
8. In Google Sites, duplicate the Connect page as "Connect v2". On the copy: **Insert > Embed > By URL**: `https://dcvizcayno.github.io/danyeloz-embeds/contact.html`. Set the box height so the whole form shows, check it in Preview at phone size, and send one test from the preview.
9. Swap: on the real Connect page, delete the Cognito contact form embed and add the `contact.html` embed in its place, then **Publish**. Retire the Cognito contact form when you're happy (letters and waitlists stay on Cognito). Tell Claude, so the handbook and the privacy page drop "while the old contact form is still live".
10. **Re-running is safe.** `setupDanyelOzForms` reuses the same forms and inbox, puts back any form setting that was changed and logs what it fixed. Re-run it after any edit to a form in Google Forms, and send the new `FORMS_JSON` block to Claude so `forms.json` stays in step. Better still, don't edit the forms by hand.
11. **Every month:** send one test message through the live contact form. A send always shows "Thank you" on the page, even when Google drops it (a closed form or a changed field), so this test is the only way to know it still works. At the same time, delete everything older than 1 year, in all three places (the privacy policy promises that):
    - **Google Forms:** open each form ("Danyel OZ contact" and "Sync license request") > **Responses**, and delete each response older than 1 year (or, once the older ones are copied out, use **Delete all responses**).
    - **Inbox sheet:** delete the rows older than 1 year.
    - **Gmail:** delete the notification emails older than 1 year (search `older_than:1y subject:("Website message" OR "Sync license request")`).
