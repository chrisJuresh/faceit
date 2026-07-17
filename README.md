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
- In-memory request caching, bounded concurrency, rate-limit retries, health checks, security headers, and a production Docker image.

## API limitations and the fallback model

The public FACEIT Data API exposes friends, match history, rosters, and match statistics. It does **not** expose historical party/lobby membership, so a past five-player team cannot be reliably split into a premade party and solo teammates. Stackline therefore uses the requested supported fallback:

1. Find the owner's teammates inside the selected match window.
2. Keep the teammates who are present in the owner's current `friends_ids` list.
3. If there are no matching friends, show all recent teammates from that window.

Players disappear automatically when they no longer occur inside the selected lookback.

FACEIT's proprietary Season 8 Round Swing is also not currently present in the public Data API. Stackline checks for official `Round Swing`/`Swing` fields and will use them if FACEIT adds them. Until then, values marked **EST.** are a transparent team-relative impact estimate built from public ADR, K/R, K/D, assists per round, entry success, and utility damage. It is intentionally labelled as an estimate everywhere it appears.

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
- Visitors can read public aliases but cannot access alias controls or mutate the alias store.

Stackline is an independent project and is not affiliated with or endorsed by FACEIT.
