<script lang="ts">
  import { duration, resultText, timeAgo } from '$lib/format';
  import type { GroupGame, LiveOverview, SquadPlayer } from '$lib/types';
  import MatchBoard from './MatchBoard.svelte';

  let {
    overview,
    failed = false,
    now,
    players,
    games
  }: {
    overview: LiveOverview | null;
    failed?: boolean;
    /** Unix seconds; the page ticks it. */
    now: number;
    players: SquadPlayer[];
    games: GroupGame[];
  } = $props();

  const clock = $derived(Math.max(now, overview?.generatedAt ?? 0));

  const matches = $derived(overview?.matches ?? []);
  const active = $derived(matches.filter((match) => match.phase === 'live' || match.phase === 'setup'));
  const finished = $derived(matches.filter((match) => match.phase === 'finished'));
  const byId = $derived(new Map(players.map((player) => [player.playerId, player])));

  /** Who played last, grouped by the match they last played (so a 5-stack reads as one entry). */
  const lastPlayed = $derived.by(() => {
    const groups = new Map<string, { at: number; names: string[] }>();
    for (const player of players) {
      const last = player.recent[0];
      if (!last) continue;
      const group = groups.get(last.matchId) ?? { at: last.finishedAt, names: [] };
      group.names.push(player.displayName);
      groups.set(last.matchId, group);
    }
    return [...groups.values()].sort((a, b) => b.at - a.at).slice(0, 4);
  });

  const lastGame = $derived(games[0] ?? null);
  const status = $derived.by(() => {
    const live = active.find((match) => match.phase === 'live');
    if (live?.startedAt) return `In progress · ${duration(clock - live.startedAt)}`;
    if (live) return 'In progress';
    if (active.length) return 'Starting';
    return null;
  });
</script>

<section id="live" class="wrap live">
  <div class="section-head">
    <h2>Live</h2>
    <span class="meta">
      {#if status}<span class="status"><i aria-hidden="true"></i>{status}</span>{/if}
      {#if failed}<span class="muted">Couldn't reach FACEIT; showing the last update</span>{/if}
    </span>
  </div>

  {#each active as match (match.matchId)}
    <div class="board">
      <MatchBoard {match} now={clock} />
    </div>
  {:else}
    <div class="idle">
      <p class="headline">Nobody is in a match.</p>
      {#if lastPlayed.length}
        <p>
          <span class="muted">Last played</span>
          {#each lastPlayed as group, index (index)}
            {#if index > 0}<span class="sep" aria-hidden="true">/</span>{/if}
            <span class="group">{group.names.join(', ')} <span class="muted">{timeAgo(group.at, clock)}</span></span>
          {/each}
        </p>
      {/if}
      {#if lastGame}
        <p>
          <span class="muted">Last game together</span>
          {lastGame.map}
          <span class="res" class:win={lastGame.won} class:loss={!lastGame.won}>
            {resultText(lastGame.won, lastGame.teamScore, lastGame.enemyScore)}
          </span>
          <span class="muted">
            {lastGame.lines.map((line) => byId.get(line.playerId)?.displayName ?? 'Unknown').join(', ')} · {timeAgo(lastGame.finishedAt, clock)}
          </span>
        </p>
      {/if}
    </div>
  {/each}

  {#each finished as match (match.matchId)}
    <div class="board">
      <MatchBoard {match} now={clock} compact />
    </div>
  {/each}
</section>

<style>
  .live {
    margin-top: 28px;
  }

  /* The masthead's rule already separates Live from the top of the page. */
  .live .section-head {
    border-top: 0;
    padding-top: 0;
  }

  .status {
    align-items: center;
    display: inline-flex;
    gap: 7px;
  }

  .status i {
    background: var(--accent);
    display: block;
    height: 7px;
    width: 7px;
  }

  .idle {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    font-size: 14px;
    gap: 6px 28px;
  }

  .headline {
    font: 500 19px/1.3 var(--serif);
  }

  .muted {
    margin-right: 6px;
  }

  .group .muted {
    margin-left: 4px;
    margin-right: 0;
  }

  .sep {
    color: var(--rule-2);
    margin: 0 10px;
  }

  .res {
    margin: 0 6px;
  }

  .board + .board {
    margin-top: 40px;
  }

  .idle + .board {
    margin-top: 28px;
  }
</style>
