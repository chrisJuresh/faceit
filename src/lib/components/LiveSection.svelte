<script lang="ts">
  import { timeAgo } from '$lib/format';
  import { LivePoll } from '$lib/live-poll.svelte';
  import type { LiveMatch, LiveOverview, SquadPlayer } from '$lib/types';
  import { onMount } from 'svelte';
  import MatchBoard from './MatchBoard.svelte';

  let { initial, players }: { initial: LiveOverview | null; players: SquadPlayer[] } = $props();

  // svelte-ignore state_referenced_locally
  const poll = new LivePoll(initial);
  let clock = $state(Math.floor(Date.now() / 1000));
  let openFinished = $state<string | null>(null);

  // A full page refresh brings a newer overview than the last poll.
  $effect(() => {
    if (initial) poll.overview = initial;
  });

  onMount(() => {
    const stop = poll.start();
    const timer = setInterval(() => (clock = Math.floor(Date.now() / 1000)), 30_000);
    return () => {
      stop();
      clearInterval(timer);
    };
  });

  const matches = $derived(poll.overview?.matches ?? []);
  const active = $derived(matches.filter((match) => match.phase === 'live' || match.phase === 'setup'));
  const finished = $derived(matches.filter((match) => match.phase === 'finished'));
  const byId = $derived(new Map(players.map((player) => [player.playerId, player])));
  const recentlySeen = $derived(
    players
      .filter((player) => player.lastMatchAt)
      .sort((a, b) => (b.lastMatchAt ?? 0) - (a.lastMatchAt ?? 0))
      .slice(0, 6)
  );

  const ours = (match: LiveMatch) =>
    match.trackedPlayerIds.map((id) => byId.get(id)?.displayName ?? 'Unknown').join(', ');
  const ourTeam = (match: LiveMatch) => match.teams.find((team) => team.tracked);
  const otherTeam = (match: LiveMatch) => match.teams.find((team) => !team.tracked);
</script>

<section class="live" aria-labelledby="live-heading">
  <div class="section-head">
    <h2 id="live-heading">Live</h2>
    {#if poll.failed}<span class="note">Couldn't reach FACEIT; showing the last update.</span>{/if}
  </div>

  {#if active.length}
    {#each active as match (match.matchId)}
      <div class="live-match">
        <p class="who">{ours(match)}</p>
        <MatchBoard {match} now={clock} />
      </div>
    {/each}
  {:else}
    <p class="idle">
      Nobody's in a match.
      {#if recentlySeen.length}
        <span class="seen">
          Last played:
          {#each recentlySeen as player, index (player.playerId)}
            <span class="seen-item">{player.displayName} <span class="ago">{timeAgo(player.lastMatchAt, clock)}</span></span>{#if index < recentlySeen.length - 1}<span class="sep" aria-hidden="true"> · </span>{/if}
          {/each}
        </span>
      {/if}
    </p>
  {/if}

  {#each finished as match (match.matchId)}
    {@const us = ourTeam(match)}
    {@const them = otherTeam(match)}
    <div class="finished">
      <button
        type="button"
        class="finished-row"
        aria-expanded={openFinished === match.matchId}
        onclick={() => (openFinished = openFinished === match.matchId ? null : match.matchId)}
      >
        <span class="label">Just finished</span>
        <span class="map">{match.map?.name ?? ''}</span>
        {#if us && them && us.score !== null && them.score !== null}
          <span class="result" class:win={us.won}>{us.won ? 'W' : 'L'} {us.score}–{them.score}</span>
        {/if}
        <span class="who">{ours(match)}</span>
        <span class="ago">{timeAgo(match.finishedAt, clock)}</span>
      </button>
      {#if openFinished === match.matchId}
        <MatchBoard {match} now={clock} />
      {/if}
    </div>
  {/each}
</section>
