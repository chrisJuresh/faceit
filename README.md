abandoned as faceit doesnt share swing% on api

# Stackline

Stackline is a server-rendered SvelteKit dashboard for understanding the people who regularly queue with `Christian976` on FACEIT. It turns the supported FACEIT Data API into a polished, shareable view of teammate impact, recent chemistry, form, maps, and match history without exposing the API key to visitors.

## What it includes

- Match lookbacks of 5, 10, 15, 25, 50, or 100 owner matches; the default is 15.
- Automatic discovery of FACEIT friends who appeared on the owner's team in that window.
- A recent-teammate fallback if none of those players are currently FACEIT friends.
- Swing-first rankings, trend lines, win rate, ADR, K/D, K/R, entry success, current ELO, and level.
- Player drill-downs with shared map splits and recent matches together.
- Owner form, map intelligence, match links, teammate frequency, search, sorting, and sharing.
- Responsive desktop/mobile layouts and light/dark themes.
- Owner-only aliases backed by a signed, HTTP-only session and server-side persistence.
- A **Live** page (`/live`) that watches the owner and their FACEIT friends, auto-refreshes, and shows a match board for every active or just-finished match.
- In-memory request caching, bounded concurrency, rate-limit retries, health checks, security headers, and a production Docker image.

## API limitations and the fallback model

The public FACEIT Data API exposes friends, match history, rosters, and match statistics. It does **not** expose historical party/lobby membership, so a past five-player team cannot be reliably split into a premade party and solo teammates. Stackline therefore uses the requested supported fallback:

1. Find the owner's teammates inside the selected match window.
2. Keep the teammates who are present in the owner's current `friends_ids` list.
3. If there are no matching friends, show all recent teammates from that window.

Players disappear automatically when they no longer occur inside the selected lookback.

FACEIT's proprietary Season 8 Round Swing is also not currently present in the public Data API. Stackline checks for official `Round Swing`/`Swing` fields and will use them if FACEIT adds them. Until then, values marked **EST.** are a transparent team-relative impact estimate built from public ADR, K/R, K/D, assists per round, entry success, and utility damage. It is intentionally labelled as an estimate everywhere it appears.

## Live match board

`/live` checks the owner and every FACEIT friend for matches, refreshing every 20 seconds while a match is active and every 60 seconds otherwise (paused while the tab is hidden). For each match it shows everything the public Data API offers:

- **Before and during the match:** status, competition, region, server location, map (with artwork), elapsed time, both rosters with captain, level, ELO, membership and Steam name, FACEIT's pre-match win probability, and each player's lifetime CS2 record (matches, win rate, K/D, ADR, HS%, entry success, 1v1 rate, streaks, recent results) plus their record on the current map. A team comparison strip sums these up.
- **After the match:** final and half/overtime scores, round count, and a full stat sheet per player (K/D/A, +/-, K/D, K/R, ADR, HS%, MVPs, first kills, entries, clutches, multi-kills, utility damage, enemies flashed, Stackline's estimated impact). Each row expands to list every raw stat FACEIT returned.

You can also paste any FACEIT match room link or match ID into the lookup box to open its board.

**Data API limits.** The public Data API has no "current match for player" endpoint and doesn't publish live round scores, so the board can't show a round-by-round score while a match is in progress. Matches are found two ways:

1. Polling each tracked player's latest match history. This catches every match once FACEIT lists it, and anything that finished in the last 60 minutes.
2. Optional FACEIT webhooks (recommended for true live detection). Create a webhook subscription in FACEIT App Studio for the owner and friends, covering the `match_status_*` events. Point it at `https://<your-host>/api/webhooks/faceit`, add a custom security header, and set `FACEIT_WEBHOOK_SECRET` (and `FACEIT_WEBHOOK_HEADER` if you don't use the default `x-webhook-secret`) to match. The endpoint returns 404 while the secret is unset. Webhook state is in memory, so it resets on restart. The endpoint must be reachable over public HTTPS.

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
| `OWNER_ACCESS_TOKEN` | For aliases | Secret entered through “Owner access” to unlock rename controls. |
| `SESSION_SECRET` | For aliases | Long random value used to sign the owner session. |
| `DATA_DIR` | No | Alias storage directory. Defaults to `./data`. |
| `FACEIT_WEBHOOK_SECRET` | No | Enables the FACEIT webhook receiver used by `/live`. |
| `FACEIT_WEBHOOK_HEADER` | No | Header carrying the webhook secret. Defaults to `x-webhook-secret`. |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | On Vercel | Upstash Redis REST credentials for webhook state and aliases. `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` also work. |

The local `.env` in this workspace already has generated `OWNER_ACCESS_TOKEN` and `SESSION_SECRET` values. They are deliberately ignored by Git. To rename a player, open **Owner access** in the footer and paste the `OWNER_ACCESS_TOKEN` value from your deployed environment.

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
