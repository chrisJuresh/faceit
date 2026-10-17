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
  import { isActive } from '$lib/columns';
  import { dateTime, timeAgo } from '$lib/format';
  import { LivePoll } from '$lib/live-poll.svelte';
  import { onMount } from 'svelte';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let theme = $state<'light' | 'dark'>('dark');
  let refreshing = $state(false);
  // Starts at the data's own timestamp so the server render and hydration agree, then ticks.
  // svelte-ignore state_referenced_locally
  let clock = $state(data.squad?.generatedAt ?? data.live?.generatedAt ?? 0);

  // svelte-ignore state_referenced_locally
  const poll = new LivePoll(data.live);

  const squad = $derived(data.squad);
  const byId = $derived(new Map((squad?.players ?? []).map((player) => [player.playerId, player])));
  const active = $derived((squad?.players ?? []).filter(isActive));
  const liveIds = $derived(
    new Set(
      (poll.overview?.matches ?? [])
        .filter((match) => match.phase === 'live' || match.phase === 'setup')
        .flatMap((match) => match.trackedPlayerIds)
    )
  );

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

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('stackline-theme', theme);
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

<header class="wrap masthead">
  <div class="top">
    <a class="wordmark" href="/">Stackline</a>
    <nav aria-label="Sections">
      <a href="#live">Live</a>
      {#if squad}
        <a href="#players">Players</a>
        <a href="#elo">ELO</a>
        <a href="#maps">Maps</a>
        <a href="#games">Games</a>
        <a href="#duos">Duos</a>
      {/if}
    </nav>
    <div class="tools">
      {#if squad}
        <span class="updated" title={dateTime(squad.generatedAt)}>
          {refreshing ? 'Refreshing…' : `Updated ${timeAgo(squad.generatedAt, Math.max(clock, squad.generatedAt))}`}
        </span>
        <button class="text-button" type="button" onclick={refresh} disabled={refreshing}>Refresh</button>
      {/if}
      <button class="text-button" type="button" onclick={toggleTheme}>
        {theme === 'dark' ? 'Light' : 'Dark'} mode
      </button>
    </div>
  </div>
</header>

<main>
  <LiveSection
    overview={poll.overview}
    failed={poll.failed}
    now={clock}
    players={squad?.players ?? []}
    games={squad?.games ?? []}
  />

  <!-- Highlights from match demos go here: a full-width section between Live and Players. -->

  {#if squad}
    <section id="players" class="wrap section">
      <PlayerTable players={squad.players} now={squad.generatedAt} isOwner={data.isOwner} {liveIds} />
    </section>

    <div class="wrap section pair">
      <section id="elo">
        <div class="section-head">
          <h2>ELO</h2>
          <span class="meta">FACEIT levels</span>
        </div>
        <EloLadder players={active} />
      </section>
      <section id="activity">
        <div class="section-head">
          <h2>Activity</h2>
          <span class="meta">Matches per week</span>
        </div>
        <Activity activity={squad.activity} players={byId} />
      </section>
    </div>

    <section id="maps" class="wrap section">
      <MapPool players={active} groupMaps={squad.groupMaps} windowDays={squad.windowDays} />
    </section>

    <section id="games" class="wrap section">
      <div class="section-head">
        <h2>Games together</h2>
        {#if squad.together.matches}
          <span class="meta">
            <span>Last {squad.windowDays} days</span>
            <span class="record">
              <b>{squad.together.wins}–{squad.together.matches - squad.together.wins}</b>
              {Math.round((squad.together.wins / squad.together.matches) * 100)}%
            </span>
          </span>
        {/if}
      </div>
      <GroupGames games={squad.games} players={byId} now={squad.generatedAt} />
    </section>

    <section id="duos" class="wrap section">
      <Duos pairs={squad.pairs} players={byId} windowDays={squad.windowDays} />
    </section>
  {:else}
    <section class="wrap section">
      <div class="section-head"><h2>Players</h2></div>
      <p class="none">FACEIT isn't responding right now.</p>
      <button class="link-button" type="button" onclick={refresh}>Try again</button>
    </section>
  {/if}
</main>

<footer class="wrap footer">
  <div class="footer-row">
    <span>Data from the FACEIT Data API{#if squad} · {squad.players.length} players{/if}</span>
    <OwnerAccess
      isOwner={data.isOwner}
      configured={data.ownerAccessConfigured}
      error={form && 'ownerError' in form ? (form.ownerError ?? null) : null}
    />
  </div>
</footer>

<style>
  .top {
    align-items: baseline;
    border-bottom: 3px solid var(--ink);
    display: flex;
    flex-wrap: wrap;
    gap: 8px 32px;
    padding: 22px 0 10px;
  }

  .wordmark {
    color: var(--ink);
    font: 600 30px/1 var(--serif);
    letter-spacing: -0.015em;
  }

  .wordmark:hover {
    text-decoration: none;
  }

  nav {
    display: flex;
    font-size: 13px;
    gap: 22px;
  }

  nav a {
    color: var(--ink-2);
  }

  nav a:hover {
    color: var(--ink);
    text-decoration: none;
  }

  .tools {
    align-items: baseline;
    color: var(--ink-2);
    display: flex;
    font-size: 13px;
    gap: 18px;
    margin-left: auto;
  }

  .updated {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }

  .section {
    margin-top: 60px;
  }

  .pair {
    column-gap: 40px;
    display: grid;
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
  }

  .record b {
    color: var(--ink);
    font-weight: 600;
  }

  .footer {
    color: var(--muted);
    font-size: 12px;
    margin-top: 80px;
    padding-bottom: 64px;
  }

  .footer-row {
    align-items: baseline;
    border-top: 1px solid var(--ink);
    display: flex;
    flex-wrap: wrap;
    gap: 8px 24px;
    justify-content: space-between;
    padding-top: 10px;
  }

  @media (max-width: 1000px) {
    .pair {
      grid-template-columns: minmax(0, 1fr);
      row-gap: 60px;
    }
  }

  @media (max-width: 760px) {
    .top {
      padding-top: 16px;
    }

    .wordmark {
      font-size: 26px;
    }

    nav {
      order: 3;
      overflow-x: auto;
      scrollbar-width: none;
      width: 100%;
    }

    .updated {
      display: none;
    }

    .section {
      margin-top: 44px;
    }
  }
</style>
