<script lang="ts">
  import { invalidate } from '$app/navigation';
  import { navigating } from '$app/stores';
  import Avatar from '$lib/components/Avatar.svelte';
  import MatchBoard from '$lib/components/MatchBoard.svelte';
  import { Activity, ArrowLeft, Info, Moon, Radio, RefreshCw, Search, Sun, Webhook } from '@lucide/svelte';
  import { onMount } from 'svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const ACTIVE_INTERVAL = 20;
  const IDLE_INTERVAL = 60;

  let now = $state(Math.floor(Date.now() / 1000));
  let countdown = $state(ACTIVE_INTERVAL);
  let refreshing = $state(false);
  let theme = $state<'dark' | 'light'>('dark');

  let overview = $derived(data.overview);
  let activeMatches = $derived(
    overview?.matches.filter((match) => match.phase === 'live' || match.phase === 'setup') || []
  );
  let recentMatches = $derived(
    overview?.matches.filter((match) => match.phase === 'finished' || match.phase === 'cancelled') || []
  );
  let playersInGame = $derived(overview?.squad.filter((member) => member.activeMatchId) || []);
  let interval = $derived(activeMatches.length ? ACTIVE_INTERVAL : IDLE_INTERVAL);

  onMount(() => {
    theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    countdown = interval;
    const timer = window.setInterval(() => {
      now = Math.floor(Date.now() / 1000);
      if (document.hidden || refreshing) return;
      countdown -= 1;
      if (countdown <= 0) refresh();
    }, 1000);
    return () => window.clearInterval(timer);
  });

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      await invalidate('faceit:live');
    } finally {
      refreshing = false;
      countdown = interval;
    }
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('stackline-theme', theme);
    } catch {
      // Storage can be unavailable in private windows.
    }
  }

  function ago(timestamp: number | null) {
    if (!timestamp) return 'No match in 30 days';
    const seconds = Math.max(0, now - timestamp);
    if (seconds < 3600) return `Finished ${Math.max(1, Math.round(seconds / 60))}m ago`;
    if (seconds < 86400) return `Finished ${Math.round(seconds / 3600)}h ago`;
    return `Finished ${Math.round(seconds / 86400)}d ago`;
  }

  function formatTime(timestamp: number) {
    return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(
      new Date(timestamp * 1000)
    );
  }
</script>

<svelte:head>
  <title>{playersInGame.length ? `● ${playersInGame.length} in game` : 'Live'} · Stackline</title>
  <meta name="description" content="Live FACEIT match tracker and scoreboard for the squad." />
</svelte:head>

<div class="page-shell" class:is-loading={$navigating !== null}>
  <header class="site-header">
    <a class="brand" href="/" aria-label="Stackline home">
      <span class="brand-mark">S/</span>
      <span><strong>STACKLINE</strong><small>LIVE MATCH ROOM</small></span>
    </a>
    <nav class="header-actions" aria-label="Live actions">
      <a class="text-button" href="/"><ArrowLeft size={16} /><span>Squad dashboard</span></a>
      <button class="icon-button" type="button" onclick={toggleTheme} aria-label="Toggle theme">
        {#if theme === 'dark'}<Sun size={17} />{:else}<Moon size={17} />{/if}
      </button>
    </nav>
  </header>

  <main>
    <section class="hero">
      <div>
        <span class="eyebrow"><Radio size={14} /> SQUAD RADAR</span>
        {#if !overview}
          <h1>FACEIT is between rounds.</h1>
          <p>{data.apiError}</p>
        {:else if playersInGame.length}
          <h1>{playersInGame.length} {playersInGame.length === 1 ? 'player' : 'players'} <em>in game.</em></h1>
          <p>{playersInGame.map((member) => member.displayName).join(', ')} {playersInGame.length === 1 ? 'is' : 'are'} in a match right now.</p>
        {:else}
          <h1>Nobody's <em>in game.</em></h1>
          <p>
            Watching {overview.squad.length} players ({overview.owner.nickname} and FACEIT friends). Matches
            finished in the last {overview.recentWindowMinutes} minutes are shown below with full scoreboards.
          </p>
        {/if}
      </div>

      <div class="status-card">
        <div class="status-row">
          <span class="live-dot" class:idle={!activeMatches.length}></span>
          <strong>{activeMatches.length ? 'Tracking live match' : 'Watching for matches'}</strong>
        </div>
        <div class="status-row muted">
          {#if overview}Updated {formatTime(overview.generatedAt)} · {/if}
          {refreshing ? 'Refreshing…' : `next check in ${countdown}s`}
        </div>
        <div class="status-row muted">
          <Webhook size={13} />
          {overview?.webhookEnabled ? 'Webhook receiver on: new matches appear instantly' : 'Webhook receiver off: matches show once FACEIT lists them'}
        </div>
        <button class="refresh-button" type="button" onclick={refresh} disabled={refreshing}>
          <RefreshCw size={15} class={refreshing ? 'spin' : ''} /> Refresh now
        </button>
      </div>
    </section>

    <form class="lookup" method="GET" action="/live">
      <Search size={16} />
      <label class="sr-only" for="match-lookup">FACEIT match room link or ID</label>
      <input id="match-lookup" name="match" placeholder="Paste a FACEIT match room link or match ID to open its scoreboard" value={data.lookup?.matchId || ''} autocomplete="off" />
      <button type="submit">Open</button>
    </form>
    {#if data.lookupError}<p class="lookup-error">{data.lookupError}</p>{/if}

    {#if data.lookup}
      <section class="board-section">
        <div class="section-heading"><span class="eyebrow">LOOKED UP</span><a href="/live">Clear</a></div>
        <MatchBoard match={data.lookup} {now} />
      </section>
    {/if}

    {#if overview}
      {#if activeMatches.length}
        <section class="board-section">
          <div class="section-heading"><span class="eyebrow"><Activity size={14} /> IN PROGRESS</span></div>
          {#each activeMatches as match (match.matchId)}
            <MatchBoard {match} {now} />
          {/each}
        </section>
      {/if}

      {#if recentMatches.length}
        <section class="board-section">
          <div class="section-heading"><span class="eyebrow">JUST FINISHED · LAST {overview.recentWindowMinutes} MIN</span></div>
          {#each recentMatches as match (match.matchId)}
            <MatchBoard {match} {now} />
          {/each}
        </section>
      {/if}

      <section class="squad-section">
        <div class="section-heading"><span class="eyebrow">SQUAD STATUS</span><span class="muted">{overview.squad.length} players</span></div>
        <div class="squad-grid">
          {#each overview.squad as member (member.playerId)}
            {#if member.activeMatchId}
              <a class="member active" href={`#match-${member.activeMatchId}`}>
                <Avatar src={member.avatar} name={member.displayName} />
                <span><strong>{member.displayName}</strong><small><i class="live-dot"></i> In a match</small></span>
              </a>
            {:else}
              <div class="member">
                <Avatar src={member.avatar} name={member.displayName} />
                <span>
                  <strong>{member.displayName}{#if member.isOwner} <em>YOU</em>{/if}</strong>
                  <small>{ago(member.lastMatchAt)}{member.elo ? ` · ${member.elo.toLocaleString()} ELO` : ''}</small>
                </span>
              </div>
            {/if}
          {/each}
        </div>
      </section>
    {/if}
  </main>

  <footer>
    <Info size={15} />
    <p>
      The public FACEIT Data API has no "current match" lookup and doesn't publish round-by-round scores
      during a match. Stackline finds matches from friends' match history and, when configured, FACEIT
      webhooks. Before and during a match the board shows rosters, ELO, win probability, lifetime form and
      current-map records. When the match ends it switches to the full stat sheet. Impact marked "est." is
      Stackline's estimate, not a FACEIT figure.
    </p>
  </footer>
</div>

<style>
  .page-shell { background: radial-gradient(circle at 82% 4%, rgba(255, 92, 53, 0.08), transparent 24rem), var(--background); min-height: 100vh; transition: opacity 160ms ease; }
  .page-shell.is-loading { opacity: 0.72; }
  .site-header, main, footer { margin: 0 auto; max-width: 1440px; padding-left: clamp(1rem, 4vw, 4rem); padding-right: clamp(1rem, 4vw, 4rem); }
  .site-header { align-items: center; border-bottom: 1px solid var(--border-subtle); display: flex; height: 82px; justify-content: space-between; }
  .brand { align-items: center; color: var(--text-strong); display: flex; gap: 0.7rem; text-decoration: none; }
  .brand-mark { color: var(--accent); font-size: 1.35rem; font-weight: 900; letter-spacing: -0.08em; }
  .brand > span:last-child { display: grid; line-height: 1; }
  .brand strong { font-size: 0.78rem; letter-spacing: 0.17em; }
  .brand small { color: var(--text-muted); font-size: 0.54rem; letter-spacing: 0.13em; margin-top: 0.28rem; }
  .header-actions { align-items: center; display: flex; gap: 0.55rem; }
  .icon-button, .text-button, .refresh-button { align-items: center; background: transparent; border: 1px solid var(--border); color: var(--text); cursor: pointer; display: inline-flex; height: 38px; justify-content: center; text-decoration: none; transition: 160ms ease; }
  .icon-button { border-radius: 50%; width: 38px; }
  .text-button { border-radius: 999px; font-size: 0.8rem; gap: 0.45rem; padding: 0 0.85rem; }
  .icon-button:hover, .text-button:hover, .refresh-button:hover { background: var(--surface); border-color: var(--border-strong); color: var(--text-strong); }

  main { padding-bottom: 4rem; }
  .hero { align-items: end; display: grid; gap: 2rem; grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.6fr); padding: clamp(2.5rem, 6vw, 5rem) 0 2rem; }
  .eyebrow { align-items: center; color: var(--accent); display: inline-flex; font-size: 0.65rem; font-weight: 750; gap: 0.42rem; letter-spacing: 0.16em; }
  .hero h1 { color: var(--text-strong); font-size: clamp(2.6rem, 6.5vw, 5.6rem); font-weight: 650; letter-spacing: -0.07em; line-height: 0.9; margin: 1.1rem 0 1.2rem; }
  .hero h1 em { color: var(--accent); font-family: Georgia, 'Times New Roman', serif; font-weight: 400; }
  .hero p { color: var(--text-muted); font-size: 1rem; line-height: 1.6; margin: 0; max-width: 640px; }
  .status-card { background: linear-gradient(145deg, var(--surface-raised), var(--surface-quiet)); border: 1px solid var(--border); display: grid; gap: 0.6rem; padding: 1.1rem 1.2rem; }
  .status-row { align-items: center; color: var(--text-strong); display: flex; font-size: 0.82rem; gap: 0.5rem; }
  .status-row.muted, .muted { color: var(--text-muted); font-size: 0.7rem; }
  .live-dot { animation: glow 1.6s ease-in-out infinite; background: var(--positive); border-radius: 50%; box-shadow: 0 0 0 4px var(--positive-soft); display: inline-block; height: 7px; width: 7px; }
  .live-dot.idle { animation: none; background: var(--text-muted); box-shadow: 0 0 0 4px var(--border-subtle); }
  @keyframes glow { 50% { box-shadow: 0 0 0 7px transparent; } }
  .refresh-button { border-radius: 0; font-size: 0.75rem; gap: 0.45rem; justify-self: start; padding: 0 0.8rem; }
  .refresh-button:disabled { cursor: wait; opacity: 0.55; }
  :global(.spin) { animation: spin 800ms linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .lookup { align-items: center; background: var(--surface-quiet); border: 1px solid var(--border); color: var(--text-muted); display: flex; gap: 0.6rem; margin-bottom: 0.6rem; padding: 0.4rem 0.4rem 0.4rem 0.9rem; }
  .lookup input { background: transparent; border: 0; color: var(--text-strong); flex: 1; font-size: 0.8rem; min-height: 38px; min-width: 0; }
  .lookup input:focus-visible { outline: none; }
  .lookup:focus-within { border-color: var(--accent-border); }
  .lookup button { background: var(--accent); border: 0; color: #fff; cursor: pointer; font-size: 0.75rem; font-weight: 700; min-height: 38px; padding: 0 1rem; }
  .lookup-error { color: var(--negative); font-size: 0.75rem; margin: 0 0 1rem; }
  .sr-only { border: 0; clip: rect(0 0 0 0); height: 1px; margin: -1px; overflow: hidden; position: absolute; width: 1px; }

  .board-section, .squad-section { margin-top: 2.2rem; }
  .section-heading { align-items: center; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; margin-bottom: 1rem; padding-bottom: 0.6rem; }
  .section-heading a { color: var(--text-muted); font-size: 0.72rem; }
  .squad-grid { display: grid; gap: 0.6rem; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); }
  .member { align-items: center; background: var(--surface-quiet); border: 1px solid var(--border); color: inherit; display: flex; gap: 0.75rem; padding: 0.7rem 0.8rem; text-decoration: none; }
  .member span { display: grid; gap: 0.2rem; min-width: 0; }
  .member strong { color: var(--text-strong); font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .member em { color: var(--accent); font-size: 0.55rem; font-style: normal; font-weight: 800; letter-spacing: 0.1em; }
  .member small { align-items: center; color: var(--text-muted); display: inline-flex; font-size: 0.66rem; gap: 0.4rem; }
  .member.active { background: var(--accent-soft); border-color: var(--accent-border); }
  .member.active small { color: var(--positive); }

  footer { align-items: flex-start; border-top: 1px solid var(--border-subtle); color: var(--text-muted); display: flex; gap: 0.6rem; padding-bottom: 3rem; padding-top: 1.5rem; }
  footer p { font-size: 0.7rem; line-height: 1.6; margin: 0; max-width: 900px; }
  footer :global(svg) { flex: 0 0 auto; margin-top: 0.15rem; }

  @media (max-width: 860px) {
    .hero { grid-template-columns: 1fr; }
    .text-button span { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .live-dot { animation: none; }
  }
</style>
