# One-time setups

Everything you set up once and then forget about. Keys and tokens go only where this page says (Script Properties or GitHub Secrets), never in the Song Database and never in chat.

## 1. The admin app (Apps Script)

1. Open the Song Database, then **Extensions > Apps Script**.
2. Make sure all fifteen files are there, with these exact names:
   - Scripts: `Code`, `Shorts`, `XPosts`, `Singles`, `Albums`, `ShortsMaker`
   - HTML: `Form`, `ShortsViews`, `ShortsApp`, `SinglesViews`, `SinglesApp`, `AlbumsViews`, `AlbumsApp`, `ShortsMakerViews`, `ShortsMakerApp`
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

## 7. Google Sites embeds

Insert > Embed > **By URL**: `https://dcvizcayno.github.io/danyeloz-embeds/<widget>.html`. A By URL embed updates itself about 10 minutes after a push. A pasted-code embed does not. Set the box height in the editor; an embed can't resize its own box.

## 8. Commits

Commits go out as **Danyel OZ <daniel.vizcayno@gmail.com>**. Don't rewrite or force-push history.
