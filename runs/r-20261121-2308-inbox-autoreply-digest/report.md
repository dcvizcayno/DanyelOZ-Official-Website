# Report — r-20261121-2308-inbox-autoreply-digest

Outcome: Inbox screen in the admin app (list, filters, statuses, Reply, 1-year cleanup), an auto-reply engine
(5 contact + 5 sync templates, about 20 minutes after a message, OFF by default) and a 9 am Manila calendar
to-do (private event, open messages + releases in the next 7 days, OFF by default).
Tier T2. Roles: security (design + implementation), executor x3 (+ fixes: owner check twice, NF-02), qa.
Gates: G1 security PASS_WITH_CONDITIONS; G3 QA PASS_WITH_CONDITIONS, re-verified after NF-01/NF-02
(probes 215/215); G4 accepted by supervisor: security's two G4 conditions (NF-01 fix, NF-02) verified by QA
re-run instead of a second security pass (deviation, recorded).
Not verified live: getOwner() on the real Song Database (null on a Shared Drive would lock Daniel out, fails
closed), real trigger events, Calendar, Gmail delivery and quotas.
Residual risk to be accepted by Daniel before Auto-reply ON (security impl-review.md): while ON, a stranger can
make Daniel's Gmail send one fixed, link-free note to each of up to 30 addresses a day; switching OFF stops it
within 10 minutes. Daniel's acceptance: ACCEPTED in chat on Nov 21, 2026 ("Approve and accept"), together with approval of all 10 templates as written. Daniel may now switch Auto-reply ON after setup.
Follow-ups: NF-03 look-alike names (Low), NF-04 digest lock (Low), SETUP section 1 file count (S4).

## Post-release bug (Nov 22): "Couldn't load the inbox: Error: Not allowed"
Evidence from Daniel's editor run: active user, effective user and Song Database owner are all
daniel.vizkaino@gmail.com. The web app (Execute as Me) evidently gives the script a blank active user, so the
NF-01 check (active == owner, blank refused) locks the owner out. Decision D-12: owner check becomes
effective user == Song DB owner AND (active == owner OR active blank); helper mode (execute as the visitor) stays
refused because effective != owner. Residual: if the web app were ever redeployed as "Execute as Me + Anyone",
strangers would pass; SETUP must say the admin app must stay "Only myself". Error messages name the failing part
(no addresses).
