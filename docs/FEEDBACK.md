# im-dog.com: the site Worker, player feedback and the player counter

The game is served at **https://im-dog.com** by one Cloudflare Worker (`wrangler.jsonc`, decision D23), built the
same way as the owner's Adtona and Pictayo Workers: the built game (`dist/`) as static assets, the **Feedback** form's
endpoint at `/api/feedback`, and an anonymous **player counter** at `/api/ping`, all on the same origin
(`src/feedback/worker.ts`, `src/feedback/usage.ts`). The GitHub Pages copy (https://christopher-013.github.io/im-dog/)
keeps publishing until im-dog.com is live and checked; there, the Feedback button stays hidden and nothing is counted.

## Feedback

The start and pause menus have a Feedback lightbox: Name, Email and Comments, all optional (the Comments label says
they're public). As in Adtona and Pictayo, there's no bot-check widget: the Worker checks the origin, the size and shape of what
arrives and a hidden bot-trap field (a bot that fills it is quietly "accepted" and nothing is filed), and uses
Cloudflare's rate limiter (5 a minute per address). On top of that it allows three per address an hour. Then it writes
a private record and creates a public Issue in `christopher-013/im-dog`, titled "[Feedback] <first line of the
comments>". The repository is public, so nothing personal goes in the Issue.

| | What |
|---|---|
| **Public GitHub Issue** | the comments, how it was played (keyboard and mouse, touch or controller), the game build, a reference ID, the time |
| **Private D1 record** (deleted after 30 days by a daily Cron) | optional name and email, IP address, approximate country, browser (User-Agent), language, time zone, window size, input type, build, time, the Issue number |

The GitHub token exists only as an encrypted Cloudflare secret: never in the game, this repository, GitHub Actions or
a chat. Without the token, the database or the rate limiter, the form fails closed (it says it couldn't send).

Once the Worker confirms the Issue, the form gives way to **"Moke says Thank you!"** (the dog-face mark, wagging) for
`FEEDBACK.thanksSeconds` (2.5 s, `src/config/site.ts`), then the window closes by itself and the player is back on the
start or pause menu. Escape, a click outside or a tap on the thank-you closes it sooner. It doesn't link to the Issue.
If sending fails, the form stays open with the error so they can try again.

### Email notifications

The Worker files each Issue with the owner's token, so the Issues are the owner's own, and GitHub never notifies you
about your own actions. `.github/workflows/feedback-notify.yml` runs when an Issue titled "[Feedback] …" by the owner
opens: as github-actions[bot], it adds the `feedback` label (creating it the first time) and assigns the Issue to the
owner. The assignment is someone else's action, so GitHub emails it: the subject is the Issue title ("[Feedback]" and
the first line of the comments), with a link to the Issue. Any other Issue is left alone.

- It needs no secret (the workflow's own token, `issues: write`).
- The email goes where GitHub sends notifications: **Settings → Notifications** → Default notifications email, with
  **Email** ticked under "Participating, @mentions and custom" (GitHub's default).
- Try it, or catch up an older Issue: **Actions → Feedback notification → Run workflow** with the Issue number.
- The `feedback` label lists every piece of player feedback: https://github.com/christopher-013/im-dog/issues?q=label%3Afeedback

## The player counter

Like Adtona's and Pictayo's usage counters, it answers one question, "are real people playing?", and can't answer
anything narrower. On im-dog.com the game sends `open` once it has loaded (bots and link previews can do that too),
and `play` once someone has really played: pressed PLAY, moved Moke, and kept going for 30 seconds of unpaused play
(`USAGE.realPlayAfter` in `src/config/site.ts`). **Players** is the real-user figure; **visits** is everything.

The Worker keeps, in KV, one number per day per event (for about 13 months) plus a few running figures (the total,
active days, the first and best days). No name, identifier, cookie, IP address or device detail is stored: the
address is only the rate limiter's key (separate from feedback's). The figures appear in a public Issue, **"I'M DOG?
usage log"**, created the first time someone is counted: its top shows players to date, today, the last 7 and 30 days,
active days and the best day, rewritten at most once a minute; each day the Cron adds a comment with yesterday's
players and visits (days with nobody are skipped). Watching the repository gets you those by email.

## One-time setup (owner)

Everything below uses your Cloudflare login (the account that already holds im-dog.com and adtona.com) or your GitHub
account, so it's yours to run, from a terminal in the repository folder. Paste the token only at Wrangler's prompt or
into Cloudflare's page, never into a chat, a commit or a command line.

1. **Log in.** `npx wrangler login`. *(Done 2026-09-29.)*
2. **The feedback database.** `npx wrangler d1 create im-dog-feedback` *(done: its ID is in `wrangler.jsonc`)*, then
   create the table: `npx wrangler d1 migrations apply im-dog-feedback --remote`.
3. **The counter's store.** `npx wrangler kv namespace create USAGE_COUNTS_IM_DOG` *(done 2026-09-29: its ID is in
   `wrangler.jsonc`, bound as `USAGE_COUNTS`)*. Its own namespace: the one titled `USAGE_COUNTS` is Pictayo's and
   `USAGE_COUNTS_ADTONA` is Adtona's, so the three apps' counts never mix.
4. **First deploy.** `npm run build`, then `npx wrangler deploy`. This creates the `im-dog` Worker and attaches
   `im-dog.com` (Cloudflare adds the DNS record and the certificate). Open https://im-dog.com: the game should load.
5. **The GitHub token.** GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate:
   repository access **Only select repositories → im-dog**, permissions **Issues: Read and write** only, with an
   expiry date (rotate it before then). Then `npx wrangler secret put GITHUB_TOKEN` and paste it at the prompt. Both
   feedback and the usage log use it.
6. **www.im-dog.com.** *(Done 2026-09-29.)* A second, tiny Worker, `im-dog-www` (`wrangler.www.jsonc`,
   `src/redirect/www.ts`), holds www.im-dog.com and sends every request to the same path on https://im-dog.com (301).
   Deploy it with `npx wrangler deploy -c wrangler.www.jsonc`; Cloudflare made its DNS record and certificate.
7. **Automatic deploys.** `.github/workflows/deploy-cloudflare.yml` runs on every push to `main` (beside the GitHub
   Pages deploy): the tests, the build, then `wrangler deploy` for both Workers. It needs one repository secret:
   - Cloudflare dashboard → My Profile → **API Tokens** → **Create Token** → the **Edit Cloudflare Workers** template.
     Account resources: your account; zone resources: **Specific zone → im-dog.com**. Add the permission
     **Account → D1 → Edit** (the Worker is bound to the feedback database). Give it an expiry date, then create it.
   - In the repository folder: `gh secret set CLOUDFLARE_API_TOKEN --repo christopher-013/im-dog` and paste the token
     at the prompt (or GitHub → the repo → Settings → Secrets and variables → Actions → New repository secret).
   - Then GitHub → Actions → **Deploy to im-dog.com** → **Run workflow**, and check it deploys. Until the secret
     exists, the workflow skips the deploy with a notice rather than failing.
   New D1 migrations aren't applied by the workflow: run `npx wrangler d1 migrations apply im-dog-feedback --remote`
   yourself when a change adds one.
8. **Check it.** On https://im-dog.com:
   - Feedback: open it from the start menu, send a clearly labelled test, and confirm the thank-you message and link,
     one new Issue with no name, email, IP or browser in it, and one private row:
     `npx wrangler d1 execute im-dog-feedback --remote --command "SELECT id, created_at, country, input_mode, issue_number FROM feedback_private ORDER BY created_at DESC LIMIT 5"`.
     Close the test Issue.
   - The counter: press PLAY and walk Moke around for half a minute. Within a minute or so an **I'M DOG? usage log**
     Issue appears showing 1 player. Keep that Issue open: it's the running log.

After that, the GitHub Pages copy can be turned into a pointer to im-dog.com (a later, separate change).

## Operations and privacy

- The private feedback record is for replying and for stopping abuse, **not analytics**. Never export it to the
  public repo or put its fields in an Issue, a log or a reply to the browser.
- Only the Cloudflare account owner can read the database and the counts. If the daily Cron stops, fix it (it both
  purges old feedback records and posts the day's count). On a data request, remove the record where feasible.
  Cloudflare backups may outlive active-record deletion under Cloudflare's own policy.
- The privacy notice (`public/feedback-privacy.html`, at im-dog.com/feedback-privacy; the owner took its summary, link
  and acknowledgement box out of the form on 2026-09-29) says what's public, what's private and
  what the counter keeps. Comments are public, and people may still type personal things there: the notice asks them
  not to. Children under 13 are asked to have a parent or guardian send feedback.
- If the token is misused: revoke it in GitHub, then `npx wrangler secret delete GITHUB_TOKEN`; the form fails closed
  and the usage log stops updating (counting carries on).
- Worker request logging is off (`observability` in `wrangler.jsonc`), so feedback bodies don't land in logs.

## Search engines (Google and Bing)

What the site tells them (all in the repo, deployed with the game):

- `index.html`: a descriptive title and description, `<link rel="canonical" href="https://im-dog.com/">` (the GitHub
  Pages copy carries the same page, so search engines credit im-dog.com, not github.io), Open Graph and Twitter tags
  for link previews, and `VideoGame` structured data (JSON-LD: free, family friendly, plays in a browser).
- `public/og-image.jpg` (1200×630): the preview image for search results, messages and social posts, rendered from the
  game (the cartoon Moke in the living room, the title in the game's lettering). Not the real-Moke photo.
- `public/robots.txt`: everything may be crawled except `/api/`; it names the sitemap.
- `public/sitemap.xml`: the home page and the privacy page (`/feedback-privacy`, with its own canonical and
  description). Add a page here if the site ever gets another.

**Owner steps** (your Google and Microsoft sign-ins):

1. **Google Search Console** (search.google.com/search-console) → **Add property** → **Domain** → `im-dog.com`. To verify,
   pick Cloudflare when it offers (it adds the DNS record for you after you sign in to Cloudflare), or copy the TXT
   record it gives you into Cloudflare → im-dog.com → DNS. Then **Sitemaps** → submit `https://im-dog.com/sitemap.xml`,
   and **URL Inspection** → `https://im-dog.com/` → **Request indexing**.
2. **Bing Webmaster Tools** (bing.com/webmasters) → sign in → **Import from Google Search Console**: it brings the site
   and the sitemap over, already verified. (Bing's results also feed DuckDuckGo and Yahoo.)
3. Give it a few days. Search Console's reports then show impressions, clicks and any page it couldn't index.

## Local testing

The unit tests (`src/feedback/worker.test.ts`, `src/feedback/usage.test.ts`, `src/core/UsageCounter.test.ts`) fake
Cloudflare and GitHub and send nothing anywhere. For a local end-to-end check of the form, point a dev build at a local
copy of the Worker with `VITE_FEEDBACK_ENDPOINT` in a git-ignored `.env.<mode>` file, and add that origin to
`ALLOWED_ORIGINS` for the local Worker only. Never commit `.env` files or `.dev.vars`.
