# Stackline

Stackline is a server-rendered SvelteKit page for one group of friends on FACEIT: the owner account (`Christian976` by default) and everyone on its FACEIT friends list who has a CS2 profile. It reads the public FACEIT Data API on the server, so the API key never reaches visitors.

## The page

One page, top to bottom:

1. **Live.** Whether anyone in the group is in a FACEIT match right now, with everything FACEIT publishes about it. A match that finished in the last hour stays here with its final score.
2. **Highlights** (planned). Clips extracted from match demos will sit here: one main highlight per game and one per player per game.
3. **Players.** Every player's FACEIT numbers in one sortable table (K/D first), switchable between their last 10, 30 or 100 matches and FACEIT's lifetime record, with a detail view per player.
4. **Maps.** One grid of each player's record per map, switchable between their last 30 or 90 matches and FACEIT's lifetime record, with the group's record together over the last 90 days as the top row. Each player who played with the group has a tick by their name; untick them to leave them out of that row. A player's map cell stays uncoloured under 3 matches for the last 30, 5 for the last 90 and 10 for lifetime, and a Together cell under 5 games.
5. **ELO, activity, games and duos.** Each player's ELO against FACEIT's level bands and their matches per week, the games played together, and duo records.

The masthead's Active / All switch applies to every per-player view.

Only numbers FACEIT publishes are shown, or plain arithmetic on them (totals, rates, counts). There is no estimated rating, swing or impact score: FACEIT's Data API doesn't publish one.

## Where the numbers come from

| Data | FACEIT endpoint | Used for |
| --- | --- | --- |
| Profile, ELO, level, friends | `/players`, `/players/{id}` | Who is in the group, current ELO and level, Steam and FACEIT links |
| Lifetime record | `/players/{id}/stats/cs2` | Lifetime columns, entry/clutch/utility/flash rates, lifetime per-map records |
| Per-match stats | `/players/{id}/games/cs2/stats` | Last 10/30/100 summaries, last 30/90 per-map records, recent matches, games together, duos, activity |
| Ladder position | `/rankings/games/cs2/regions/{region}/players/{id}` | Regional and national rank (FACEIT leaves inactive players unranked) |
| Match room and stats | `/matches/{id}`, `/matches/{id}/stats` | Live and finished match boards |

Notes on FACEIT's fields:

- Lifetime `K/D Ratio` and `Total Headshots %` are running sums, so Stackline uses `Average K/D Ratio` and `Average Headshots %`. Lifetime K/R is total kills over total rounds across the 5v5 map records.
- Last-N summaries, per-map ones included, are totals, not averages of per-match ratios: K/D is kills over deaths, ADR is damage over rounds, HS% is headshot kills over kills. Lifetime per-map K/D is FACEIT's `Average K/D Ratio`, a mean of per-match ratios, so it reads a little differently from the last 30/90 per-map K/D.
- Wingman and 1v1 matches are left out. Two friends count as teammates in a match when FACEIT lists them on the same team.
- Group numbers (games together, duos, map record, activity) cover the last 90 days. Each player's latest 100 matches are always read; busier players get up to two more pages to reach back 90 days.
- FACEIT allows 20 requests per second per key. Requests are throttled to stay under it, and results are cached in memory, with stale values served while a background refresh runs.

## Live matches

The page polls `/api/live` every 20 seconds while someone is in a match and every 60 seconds otherwise, and pauses while the tab is hidden. For each match it shows everything the public Data API offers:

- **Before and during the match:** status, competition, region, server location, map, elapsed time, both rosters with profile photo, level and ELO, FACEIT's win probability, and each player's lifetime CS2 record (matches, win rate, K/D, ADR, HS%, entry success, 1v1 rate, streaks, recent results) plus their record on the current map.
- **After the match:** final and half/overtime scores, round count, the demo link when FACEIT publishes one, and a full stat sheet per player (K/D/A, K/D, K/R, ADR, HS%, MVPs, first kills, entries, clutches, multi-kills, utility damage, enemies flashed, sniper kills), plus every raw stat FACEIT returned.

`/live` redirects to the main page.

**Data API limits.** The public Data API has no "current match for player" endpoint and doesn't publish live round scores, so the board can't show a round-by-round score while a match is in progress. Matches are found two ways:

1. Polling each tracked player's latest match history. This catches every match once FACEIT lists it, and anything that finished in the last 60 minutes.
2. Optional FACEIT webhooks (recommended for true live detection). Create a webhook subscription in FACEIT App Studio for the owner and friends, covering the `match_status_*` events. Point it at `https://<your-host>/api/webhooks/faceit`, add a custom security header, and set `FACEIT_WEBHOOK_SECRET` (and `FACEIT_WEBHOOK_HEADER` if you don't use the default `x-webhook-secret`) to match. The endpoint returns 404 while the secret is unset. Without Redis, webhook state is in memory and resets on restart. The endpoint must be reachable over public HTTPS.

## Local setup

Requirements: Node.js 22 or newer and a FACEIT Data API key.

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead of `cp`.

Configure these server-side environment values:

| Variable | Required | Purpose |
| --- | --- | --- |
| `API_KEY` | Yes | FACEIT Data API key. Never sent to the browser. |
| `APP_ID` | No | FACEIT application identifier, retained for deployment metadata. |
| `API_KEY_NAME` | No | FACEIT key label, retained for deployment metadata. |
| `FACEIT_OWNER_NICKNAME` | No | Owner account. Defaults to `Christian976`. |
| `OWNER_ACCESS_TOKEN` | For aliases | Secret entered through “Edit names” to unlock rename controls. |
| `SESSION_SECRET` | For aliases | Long random value used to sign the owner session. |
| `DATA_DIR` | No | Alias storage directory. Defaults to `./data`. |
| `FACEIT_WEBHOOK_SECRET` | No | Enables the FACEIT webhook receiver used by `/live`. |
| `FACEIT_WEBHOOK_HEADER` | No | Header carrying the webhook secret. Defaults to `x-webhook-secret`. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | On Vercel | Upstash Redis REST credentials for webhook state and aliases. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work. |

The local `.env` in this workspace already has generated `OWNER_ACCESS_TOKEN` and `SESSION_SECRET` values. They are deliberately ignored by Git. To rename a player, choose **Edit names** in the footer, paste the `OWNER_ACCESS_TOKEN` value from your deployed environment, then open the player's row and set a display name.

## Production

Build and run directly:

```bash
npm ci
npm run build
node build
```

Or use Docker:

```bash
docker build -t stackline .
docker run --rm -p 3000:3000 --env-file .env -v stackline-data:/app/data stackline
```

Persist `DATA_DIR` (or `/app/data` in the supplied container) if aliases must survive a redeploy. The application needs a Node-capable host because FACEIT requests and owner authentication run on the server; it cannot be deployed as a static GitHub Pages site without replacing those server features.

### Vercel

The build switches to `@sveltejs/adapter-vercel` automatically when Vercel sets `VERCEL=1`; local and Docker builds keep using the Node adapter.

1. Import the GitHub repository in Vercel (framework preset: SvelteKit).
2. In the project's **Storage** tab, add an **Upstash Redis** database and connect it to the project. This sets `KV_REST_API_URL` and `KV_REST_API_TOKEN`. Redis is required on Vercel because serverless instances don't share memory or disk, so webhook matches and aliases would otherwise be lost between requests.
3. Add `API_KEY`, `OWNER_ACCESS_TOKEN`, `SESSION_SECRET` and `FACEIT_WEBHOOK_SECRET` (plus any other variables from the table above) under **Settings → Environment Variables**.
4. Add your domain under **Settings → Domains**. For a Cloudflare-managed subdomain, create a `CNAME` record pointing at the target Vercel shows (normally `cname.vercel-dns.com`) with the proxy set to **DNS only**.

## Quality checks

```bash
npm run check
npm test
npm run build
```

The health endpoint is available at `/api/health`.

## Security notes

- `.env`, generated owner credentials, and alias data are excluded from source control and the Docker build context.
- FACEIT requests originate only from SvelteKit server modules.
- Alias mutations require a timing-safe token check followed by a signed HTTP-only, same-site session cookie.
- The webhook receiver is disabled unless `FACEIT_WEBHOOK_SECRET` is set, checks the secret with a timing-safe comparison, caps payloads at 64 KB, and only stores validated match and player IDs in memory.
- Visitors can read public aliases but cannot access alias controls or mutate the alias store.

Stackline is an independent project and is not affiliated with or endorsed by FACEIT.
