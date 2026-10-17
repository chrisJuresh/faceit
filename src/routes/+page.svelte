<script lang="ts">
  import { invalidate } from '$app/navigation';
  import Activity from '$lib/components/Activity.svelte';
  import Duos from '$lib/components/Duos.svelte';
  import EloLadder from '$lib/components/EloLadder.svelte';
  import GroupGames from '$lib/components/GroupGames.svelte';
  import LiveSection from '$lib/components/LiveSection.svelte';
  import MapPool from '$lib/components/MapPool.svelte';
  import OwnerAccess from '$lib/components/OwnerAccess.svelte';
  import PlayerTable from '$lib/components/PlayerTable.svelte';
  import Tooltip from '$lib/components/Tooltip.svelte';
  import { isActive } from '$lib/columns';
  import { dateTime, timeAgo } from '$lib/format';
  import { LivePoll } from '$lib/live-poll.svelte';
  import { onMount } from 'svelte';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let theme = $state<'light' | 'dark'>('dark');
  let everyone = $state(false);
  let refreshing = $state(false);
  // Starts at the data's own timestamp so the server render and hydration agree, then ticks.
  // svelte-ignore state_referenced_locally
  let clock = $state(data.squad?.generatedAt ?? data.live?.generatedAt ?? 0);

  // svelte-ignore state_referenced_locally
  const poll = new LivePoll(data.live);

  const squad = $derived(data.squad);
  const players = $derived(squad?.players ?? []);
  const byId = $derived(new Map(players.map((player) => [player.playerId, player])));
  const activeCount = $derived(players.filter(isActive).length);
  /** The masthead's Active / All choice applies to every per-player view. */
  const shown = $derived(everyone ? players : players.filter(isActive));
  const liveIds = $derived(
    new Set(
      (poll.overview?.matches ?? [])
        .filter((match) => match.phase === 'live' || match.phase === 'setup')
        .flatMap((match) => match.trackedPlayerIds)
    )
  );
  const together = $derived(squad?.together ?? { matches: 0, wins: 0 });

  // A full refresh brings a newer overview than the last poll.
  $effect(() => {
    if (data.live) poll.overview = data.live;
  });

  onMount(() => {
    theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const tick = () => (clock = Math.floor(Date.now() / 1000));
    tick();
    const timer = setInterval(tick, 30_000);
    const stop = poll.start();
    return () => {
      clearInterval(timer);
      stop();
    };
  });

  function setTheme(next: 'light' | 'dark') {
    theme = next;
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('stackline-theme', next);
    } catch {
      // Private windows can refuse storage; the choice still applies to this visit.
    }
  }

  async function refresh() {
    refreshing = true;
    try {
      await invalidate('faceit:squad');
    } finally {
      refreshing = false;
    }
  }
</script>

<svelte:head>
  <title>Stackline</title>
</svelte:head>

<header class="masthead">
  <div class="wrap bar">
    <a class="wordmark" href="/">Stackline</a>
    <nav aria-label="Sections">
      <a href="#live">Live</a>
      {#if squad}
        <a href="#players">Players</a>
        <a href="#maps">Maps</a>
        <a href="#games">Games</a>
        <a href="#duos">Duos</a>
      {/if}
    </nav>
    <div class="tools">
      {#if squad}
        <span class="stamp" title={dateTime(squad.generatedAt)}>
          Updated <span class="mono">{timeAgo(squad.generatedAt, Math.max(clock, squad.generatedAt))}</span>
        </span>
        <button class="text-button" type="button" onclick={refresh} disabled={refreshing}>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
        <div class="seg" role="group" aria-label="Players shown">
          <button type="button" aria-pressed={!everyone} onclick={() => (everyone = false)}>
            Active<span class="count">{activeCount}</span>
          </button>
          <button type="button" aria-pressed={everyone} onclick={() => (everyone = true)}>
            All<span class="count">{players.length}</span>
          </button>
        </div>
        <span class="divider" aria-hidden="true"></span>
      {/if}
      <div class="seg theme" role="group" aria-label="Theme">
        <button type="button" class="dark" aria-pressed={theme === 'dark'} onclick={() => setTheme('dark')}>Dark</button>
        <button type="button" class="light" aria-pressed={theme === 'light'} onclick={() => setTheme('light')}>Light</button>
      </div>
    </div>
  </div>
</header>

<LiveSection overview={poll.overview} failed={poll.failed} now={clock} {players} games={squad?.games ?? []} />

<!-- Highlights from match demos go here: a full-width band between Live and Players. -->

<main class="wrap">
  {#if squad}
    <section id="players" class="section">
      <PlayerTable players={shown} now={clock} isOwner={data.isOwner} {liveIds} />

      <div class="pair">
        <section aria-labelledby="elo-head">
          <div class="sub-head">
            <h3 id="elo-head">ELO</h3>
            <span class="meta"><i class="lead-key" aria-hidden="true"></i>To next level</span>
          </div>
          <EloLadder players={shown} />
        </section>
        <section aria-labelledby="activity-head">
          <div class="sub-head">
            <h3 id="activity-head">Activity</h3>
            <span class="meta">Matches per week</span>
          </div>
          <Activity activity={squad.activity} players={shown} />
        </section>
      </div>
    </section>

    <section id="maps" class="section">
      <MapPool players={shown} lineups={squad.lineups} mapImages={squad.mapImages} windowDays={squad.windowDays} />
    </section>

    <section id="games" class="section">
      <div class="section-head">
        <h2>Games</h2>
        {#if together.matches}
          <span class="meta">
            Together, last <span class="mono">{squad.windowDays}</span> days: <b>{together.matches}</b> matches ·
            <b>{together.wins}–{together.matches - together.wins}</b> ·
            <b>{Math.round((together.wins / together.matches) * 100)}%</b> won
          </span>
        {/if}
      </div>
      <GroupGames games={squad.games} players={byId} mapImages={squad.mapImages} now={clock} />
    </section>

    <section id="duos" class="section">
      <Duos pairs={squad.pairs} players={byId} windowDays={squad.windowDays} />
    </section>
  {:else}
    <section class="section">
      <div class="section-head"><h2>Players</h2></div>
      <p class="none">FACEIT isn't responding</p>
      <button class="text-button more" type="button" onclick={refresh} disabled={refreshing}>
        {refreshing ? 'Trying again…' : 'Try again'}
      </button>
    </section>
  {/if}
</main>

<footer class="wrap">
  <div class="footer">
    <span>
      FACEIT Data API{#if squad}{' · '}<span class="mono">{players.length}</span> players · Updated
        <span class="mono">{dateTime(squad.generatedAt)}</span>{/if}
    </span>
    <OwnerAccess
      isOwner={data.isOwner}
      configured={data.ownerAccessConfigured}
      error={form && 'ownerError' in form ? (form.ownerError ?? null) : null}
    />
  </div>
</footer>

<Tooltip />

<style>
  .masthead {
    border-bottom: 1px solid var(--rule);
  }

  .bar {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 6px 28px;
    min-height: 48px;
  }

  .wordmark {
    font: 650 16px/1 var(--wordmark);
    font-stretch: 116%;
    letter-spacing: -0.01em;
    text-decoration: none;
  }

  nav {
    display: flex;
    gap: 20px;
  }

  nav a {
    color: var(--muted);
    text-decoration: none;
  }

  nav a:hover {
    color: var(--ink);
  }

  .tools {
    align-items: center;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 14px;
    margin-left: auto;
  }

  .stamp {
    color: var(--muted);
    font-size: 11.5px;
  }

  /* The theme is set on <html> before first paint, so the switch follows it rather than waiting for hydration. */
  .theme button[aria-pressed] {
    border-bottom-color: transparent;
    color: var(--muted);
  }

  :global(:root:not([data-theme='light'])) .theme .dark,
  :global(:root[data-theme='light']) .theme .light {
    border-bottom-color: var(--accent);
    color: var(--ink);
  }

  .theme button:hover {
    color: var(--ink);
  }

  /* The ELO key draws the leader line it explains. */
  .lead-key {
    background: var(--muted);
    display: inline-block;
    height: 2px;
    margin-right: 5px;
    vertical-align: middle;
    width: 14px;
  }

  .pair {
    display: grid;
    gap: 48px;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    margin-top: 40px;
  }

  .footer {
    align-items: baseline;
    border-top: 1px solid var(--rule);
    color: var(--muted);
    display: flex;
    flex-wrap: wrap;
    font-size: 11.5px;
    gap: 8px 24px;
    justify-content: space-between;
    margin-top: 64px;
    padding-bottom: 72px;
    padding-top: 14px;
  }

  @media (max-width: 1060px) {
    .pair {
      grid-template-columns: minmax(0, 1fr);
      gap: 36px;
    }
  }

  @media (max-width: 860px) {
    nav {
      display: none;
    }
  }

  @media (max-width: 640px) {
    .bar {
      gap: 4px 16px;
      padding-bottom: 6px;
      padding-top: 6px;
    }

    .tools {
      gap: 2px 14px;
      margin-left: 0;
      width: 100%;
    }

    .stamp {
      display: none;
    }
  }
</style>
