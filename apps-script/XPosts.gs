/**
 * Danyel OZ admin: X Posts screen (server side).
 * Add to the same Apps Script project as Code.gs, as a new script file named "XPosts".
 *
 * The X agent keeps running on GitHub exactly as before. This file only reads its drafts and
 * log, and ticks Post or Revise on the approval Issue for you, which is the same as ticking it on GitHub.
 *
 * Setup (Project Settings > Script Properties)
 *   GITHUB_TOKEN  a fine-grained GitHub token for the repo that runs the X agent, with
 *                 Issues: Read and write, Actions: Read and write, Contents: Read.
 *   X_REPO        optional, defaults to dcvizcayno/danyeloz-embeds. Change it after the
 *                 agent moves to the private repo.
 */

const X_DEFAULT_REPO = 'dcvizcayno/danyeloz-embeds';
const X_MARK_START = '<!-- post:start -->';
const X_MARK_END = '<!-- post:end -->';
const X_DRAFT_WORKFLOW = 'x-draft.yml';

function xRepo_() { return props_().getProperty('X_REPO') || X_DEFAULT_REPO; }
function xToken_() { return props_().getProperty('GITHUB_TOKEN') || ''; }

function gh_(method, path, body) {
  const token = xToken_();
  if (!token) throw new Error('Add GITHUB_TOKEN in Project Settings > Script Properties to use the X Posts screen.');
  const opt = {
    method: method, muteHttpExceptions: true,
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
  };
  if (body !== undefined) { opt.contentType = 'application/json'; opt.payload = JSON.stringify(body); }
  const res = UrlFetchApp.fetch('https://api.github.com' + path, opt);
  const code = res.getResponseCode();
  if (code === 204) return null;
  if (code === 401) throw new Error('GitHub didn’t accept the token. It may have expired: make a new one and update GITHUB_TOKEN.');
  if (code === 403 || code === 404) throw new Error('The GitHub token can’t reach ' + xRepo_() + ' (' + code + '). Check its repo and permissions.');
  if (code >= 300) throw new Error('GitHub said ' + code + ': ' + res.getContentText().slice(0, 160));
  return JSON.parse(res.getContentText() || 'null');
}

/* Reads a JSON file from the agent's repo: through the API with the token, or the public raw link without one. */
function xRepoFile_(path, fallback) {
  try {
    if (xToken_()) {
      const f = gh_('GET', '/repos/' + xRepo_() + '/contents/' + path);
      return JSON.parse(Utilities.newBlob(Utilities.base64Decode(String(f.content).replace(/\s/g, ''))).getDataAsString());
    }
    const res = UrlFetchApp.fetch('https://raw.githubusercontent.com/' + xRepo_() + '/main/' + path, { muteHttpExceptions: true });
    return res.getResponseCode() === 200 ? JSON.parse(res.getContentText()) : fallback;
  } catch (e) {
    console.log('xRepoFile_ ' + path + ': ' + e.message);
    return fallback;
  }
}

function parseXIssue_(body) {
  body = String(body || '');
  const m = body.match(/<!-- meta:(\{.*?\}) -->/);
  let meta = {};
  try { meta = m ? JSON.parse(m[1]) : {}; } catch (e) { meta = {}; }
  const i = body.indexOf(X_MARK_START), j = body.indexOf(X_MARK_END);
  return {
    meta: meta,
    text: i >= 0 && j > i ? body.slice(i + X_MARK_START.length, j).trim() : '',
    testMode: /Test mode:/i.test(body),
    post: /- \[[xX]\] Post\b/.test(body),
    revise: /- \[[xX]\] Revise\b/.test(body)
  };
}

/* X counts every link as 23 characters. */
function xLength_(text) {
  return String(text || '').replace(/https?:\/\/\S+/g, new Array(24).join('x')).length;
}

function xEligibleSongs_() {
  return getSongs().songs.filter(function (s) { return /bandcamp\.com\/EmbeddedPlayer/i.test(s.bandcamp_embed); });
}

function getXData() {
  const repo = xRepo_();
  const config = xRepoFile_('x-agent/config.json', {});
  const playbook = xRepoFile_('x-agent/playbook.json', {});
  const log = xRepoFile_('data/x-posts.json', []) || [];
  const out = { connected: !!xToken_(), repo: repo, error: '', draft: null, drafts: 0, workflow: '', report: '',
                posts: [], rotation: {}, approaches: [], minSamples: config.min_samples || 3,
                exploreRate: config.explore_rate || 0.2 };

  if (out.connected) {
    try {
      const issues = gh_('GET', '/repos/' + repo + '/issues?labels=x-draft&state=open&per_page=5');
      out.drafts = issues.length;
      if (issues.length) {
        const it = issues[issues.length - 1];   // oldest waiting draft first
        const p = parseXIssue_(it.body);
        out.draft = { number: it.number, url: it.html_url, title: it.title, created: it.created_at,
                      song: p.meta.song || it.title.replace(/^X draft:\s*/, ''), hook: p.meta.hook || '',
                      link: p.meta.link || '', version: p.meta.version || 1, text: p.text,
                      length: xLength_(p.text), testMode: p.testMode };
      }
      const wf = gh_('GET', '/repos/' + repo + '/actions/workflows/' + X_DRAFT_WORKFLOW);
      out.workflow = wf && wf.state || '';
      const reports = gh_('GET', '/repos/' + repo + '/issues?labels=x-report&state=all&per_page=1');
      out.report = reports.length ? reports[0].html_url : '';
    } catch (e) { out.error = e.message; }
  }

  // Song rotation: every song with a Bandcamp code gets a turn before any repeats (same rule as the agent).
  const eligible = xEligibleSongs_();
  const posted = log.filter(function (p) { return p.status === 'posted'; }).map(function (p) { return p.song; });
  const cycle = posted.length % Math.max(1, eligible.length);
  const recent = {};
  (cycle ? posted.slice(-cycle) : []).forEach(function (t) { recent[t] = true; });
  out.rotation = {
    eligible: eligible.length,
    postedThisRound: cycle,
    noStory: eligible.filter(function (s) { return !String(s.song_description).trim(); }).map(function (s) { return s.song_title; }),
    notYet: eligible.filter(function (s) { return !recent[s.song_title]; }).slice(0, 8).map(function (s) {
      return { title: s.song_title, hasStory: !!String(s.song_description).trim() };
    })
  };

  const hooks = (config.experiments && config.experiments.hook) || ['question', 'story', 'invite', 'behind'];
  out.approaches = hooks.map(function (h) {
    const st = (playbook.hook || {})[h] || {};
    return { name: h, tries: st.n || 0, score: st.score == null ? null : st.score };
  });

  out.posts = log.filter(function (p) { return p.status === 'posted'; }).reverse().slice(0, 30).map(function (p) {
    const m = p.metrics || {};
    return { song: p.song, posted_at: p.posted_at, hook: p.hook, test: !!p.test,
             url: p.test ? '' : 'https://x.com/i/web/status/' + p.id,
             views: m.impression_count, likes: m.like_count, replies: m.reply_count, clicks: m.url_link_clicks };
  });
  return out;
}

/* Loads the issue fresh and checks it's still a waiting draft. */
function xDraftIssue_(num) {
  num = Number(num);
  if (!num) throw new Error('No draft selected.');
  const it = gh_('GET', '/repos/' + xRepo_() + '/issues/' + num);
  const labels = (it.labels || []).map(function (l) { return l.name; });
  if (it.state !== 'open' || labels.indexOf('x-draft') < 0) throw new Error('That draft is no longer waiting. Reload the screen.');
  const p = parseXIssue_(it.body);
  if (p.post || p.revise) throw new Error('This draft is already being handled on GitHub. Give it a minute, then reload.');
  return it;
}

function xWithText_(body, text) {
  text = String(text || '').split(X_MARK_START).join('').split(X_MARK_END).join('').trim();
  if (!text) throw new Error('The post is empty.');
  if (xLength_(text) > 280) throw new Error('The post is ' + xLength_(text) + ' characters. X allows 280 (each link counts as 23).');
  const i = body.indexOf(X_MARK_START), j = body.indexOf(X_MARK_END);
  if (i < 0 || j < i) throw new Error('This Issue doesn’t look like an X draft.');
  return body.slice(0, i + X_MARK_START.length) + '\n' + text + '\n' + body.slice(j);
}

function saveXText(num, text) {
  const it = xDraftIssue_(num);
  gh_('PATCH', '/repos/' + xRepo_() + '/issues/' + it.number, { body: xWithText_(it.body, text) });
  return { saved: true };
}

/* Same as editing the text on GitHub and ticking Post. The agent posts within a minute or two. */
function xPost(num, text) {
  const it = xDraftIssue_(num);
  if (parseXIssue_(it.body).testMode) {
    throw new Error('This draft was written in test mode, before your X keys were added. Click Revise once to refresh it, then Post.');
  }
  const body = xWithText_(it.body, text).replace('- [ ] Post', '- [x] Post');
  gh_('PATCH', '/repos/' + xRepo_() + '/issues/' + it.number, { body: body });
  return { queued: true, url: it.html_url };
}

/* Same as commenting a note and ticking Revise on GitHub. */
function xRevise(num, note) {
  const it = xDraftIssue_(num);
  note = String(note || '').trim().slice(0, 500);
  if (note) gh_('POST', '/repos/' + xRepo_() + '/issues/' + it.number + '/comments', { body: note });
  gh_('PATCH', '/repos/' + xRepo_() + '/issues/' + it.number, { body: it.body.replace('- [ ] Revise', '- [x] Revise') });
  return { queued: true, url: it.html_url };
}

/* Turns the daily 7:07 PM draft on or off (the GitHub workflow itself). */
function setXDraftsPaused(paused) {
  gh_('PUT', '/repos/' + xRepo_() + '/actions/workflows/' + X_DRAFT_WORKFLOW + '/' + (paused ? 'disable' : 'enable'));
  return { paused: !!paused };
}

/* Asks the agent for a draft right now instead of waiting for 7:07 PM. */
function xDraftNow() {
  const open = gh_('GET', '/repos/' + xRepo_() + '/issues?labels=x-draft&state=open&per_page=1');
  if (open.length) throw new Error('A draft is already waiting. Post or revise it first.');
  gh_('POST', '/repos/' + xRepo_() + '/actions/workflows/' + X_DRAFT_WORKFLOW + '/dispatches', { ref: 'main' });
  return { requested: true };
}
