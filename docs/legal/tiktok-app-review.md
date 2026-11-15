# TikTok app review: what to submit

## 1. "Explain how each product and scope works" (894 of 1000 characters)

Paste this as is:

```
Danyel OZ Studio is my private web tool (Google Apps Script) for posting my own music Shorts to my own TikTok account. Only I use it.

Login Kit, user.info.basic: I click Connect TikTok, sign in on TikTok's page and allow access. The posting screen then shows my display name and username, so I can see which account a video goes to.

Content Posting API, Direct Post, video.publish: for each video I write the caption, choose who can see it (options from creator_info, no default), turn comments, Duet and Stitch on or off, and disclose commercial content (Your brand or Branded content). The Music Usage Confirmation is shown. Nothing posts until I click Approve. The video then posts at its scheduled time, or right away with Post now. The app uploads the file (FILE_UPLOAD), checks the result with the status endpoint and shows the link to the post.

No other users' data is read or stored.
```

Before submitting, check that the app has **only** these: products **Login Kit** and **Content Posting API** (Direct Post on), scopes **user.info.basic** and **video.publish**. Remove anything else (for example `video.upload` or Display API), or TikTok delays the review.

## 2. Before recording: switch the app to the sandbox

TikTok requires a sandbox demo for an app that hasn't been approved before.

1. Developer portal > your app > **Sandbox** > create a sandbox. Add the same products and scopes.
2. Sandbox > **Target users**: add the Danyel OZ TikTok account.
3. Copy the **sandbox** Client key and Client secret into Apps Script > Project Settings > Script Properties (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`). Keep the real ones somewhere safe to put back after the review.
4. Add the web app's `/exec` address as the sandbox Redirect URI.
5. Set the TikTok account to **private** for the recording (sandbox posts only go to a private account, seen by you alone). Set it back afterwards.
6. In the admin app, open a Short's TikTok tab, click **Disconnect TikTok** if it was connected before, so the recording starts from the sign-in.

## 3. The demo video (one take, about 2 to 3 minutes, mp4 or mov, under 50 MB)

Record the browser window with the address bar visible. Go slowly and pause a second on each screen.

1. **Start**: open the admin app (address bar showing the web app address). Open **Shorts**, pick a Short with a short 9:16 video, open its **TikTok** tab.
2. **Login Kit**: click **Connect TikTok**. TikTok's sign-in page opens: sign in and click **Authorize** (the scopes are listed on that page; let them show). The "TikTok is connected" page appears. Go back and reload.
3. **user.info.basic**: show "Posting as Danyel OZ (@…)" on the TikTok tab.
4. **Caption**: show the caption and hashtags in the editor (edit a word, click **Save changes**).
5. **Posting choices**: open "Who can see this video" and show that it starts on "Choose…" with the options from TikTok. Pick **Only me**. Show Comments, Duet and Stitch (off at first), tick one. Tick "This video promotes a brand, product or service", show Your brand and Branded content and how "Only me" becomes unavailable with Branded content, then untick it again. Point at the Music Usage Confirmation line.
6. **Approve**: click **Approve for TikTok**. Show the "Approved" message.
7. **Direct Post (video.publish)**: click **Post now** and confirm. Show "Sent. TikTok is processing it". After a minute click **Check status** until it says **Posted on TikTok**.
8. **Result**: click **Open it** (or open the TikTok app) and show the video on the profile with the caption and the privacy you chose.
9. **Scheduling** (optional, a few seconds): show the **Auto-post** tick box and say approved Shorts post at their scheduled time.

## 4. One thing to check: the website address

TikTok's form says the domain in the video should match the **website URL** on your app's basic info. The admin app runs at `script.google.com`, not `danyeloz.info`. If the basic info says `https://www.danyeloz.info`, add a line to the explanation box if there is room, or to the notes field if the form has one:

> The posting tool is a private Google Apps Script web app at script.google.com, linked to danyeloz.info. The Terms and Privacy Policy on danyeloz.info describe it.

If TikTok sends it back over the domain, the fix is a hidden page on danyeloz.info that shows the admin app inside it, so the address bar reads danyeloz.info. That's a small job; ask Claude.

## 5. After approval

Put the real (production) Client key and secret back in Script Properties, connect TikTok again, set the account back to public, and tick Auto-post.
