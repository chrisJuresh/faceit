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
  import { dateTime } from '$lib/format';
  import { onMount } from 'svelte';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let theme = $state<'light' | 'dark'>('dark');
  let refreshing = $state(false);

  const squad = $derived(data.squad);
  const byId = $derived(new Map((squad?.players ?? []).map((player) => [player.playerId, player])));
  const active = $derived((squad?.players ?? []).filter(isActive));
  const togetherRate = $derived(
    squad && squad.together.matches ? Math.round((squad.together.wins / squad.together.matches) * 100) : null
  );

  onMount(() => {
    theme = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  });

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('stackline-theme', theme);
    } catch {
      // Private windows can refuse storage; the toggle still works for this visit.
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
  <a class="wordmark" href="/">Stackline</a>
  <div class="masthead-tools">
    {#if squad}
      <span class="updated">Updated {dateTime(squad.generatedAt)}</span>
    {/if}
    <button class="text-button" type="button" onclick={refresh} disabled={refreshing}>
      {refreshing ? 'Refreshing…' : 'Refresh'}
    </button>
    <button class="text-button" type="button" onclick={toggleTheme} aria-label="Switch to {theme === 'dark' ? 'light' : 'dark'} theme">
      {theme === 'dark' ? 'Light' : 'Dark'}
    </button>
  </div>
</header>

<main>
  <LiveSection initial={data.live} players={squad?.players ?? []} />

  <!-- Highlights from match demos will go here, between Live and Players. -->

  {#if squad}
    <section aria-labelledby="players-heading">
      <div class="section-head">
        <h2 id="players-heading">Players</h2>
      </div>
      <PlayerTable players={squad.players} now={squad.generatedAt} isOwner={data.isOwner} />
    </section>

    <section aria-labelledby="ladder-heading">
      <div class="section-head">
        <h2 id="ladder-heading">ELO</h2>
      </div>
      <EloLadder players={active} />
    </section>

    <section aria-labelledby="games-heading">
      <div class="section-head">
        <h2 id="games-heading">Games together</h2>
        {#if squad.together.matches}
          <span class="note">
            {squad.together.wins}–{squad.together.matches - squad.together.wins} in the last {squad.windowDays} days{#if togetherRate !== null}, {togetherRate}% won{/if}
          </span>
        {/if}
      </div>
      <GroupGames games={squad.games} players={byId} now={squad.generatedAt} />
    </section>

    <section aria-labelledby="duos-heading">
      <div class="section-head">
        <h2 id="duos-heading">Duos</h2>
        <span class="note">Last {squad.windowDays} days, 3+ games</span>
      </div>
      <Duos pairs={squad.pairs} players={byId} />
    </section>

    <section aria-labelledby="maps-heading">
      <div class="section-head">
        <h2 id="maps-heading">Maps</h2>
        <span class="note">Lifetime win rate and matches; 5+ matches to show a rate</span>
      </div>
      <MapPool players={active} groupMaps={squad.groupMaps} />
    </section>

    <section aria-labelledby="activity-heading">
      <div class="section-head">
        <h2 id="activity-heading">Activity</h2>
        <span class="note">Matches per week</span>
      </div>
      <Activity activity={squad.activity} players={byId} />
    </section>
  {:else}
    <section>
      <p class="quiet">FACEIT isn't responding right now. Try again in a minute.</p>
      <button class="text-button" type="button" onclick={refresh}>Try again</button>
    </section>
  {/if}
</main>

<footer class="footer">
  <span>Data from the FACEIT Data API.</span>
  <OwnerAccess
    isOwner={data.isOwner}
    configured={data.ownerAccessConfigured}
    error={form && 'ownerError' in form ? (form.ownerError ?? null) : null}
  />
</footer>
