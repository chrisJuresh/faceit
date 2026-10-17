<script lang="ts">
  import { dateTime, resultText, timeAgo } from '$lib/format';
  import { loadBoard } from '$lib/match-board';
  import type { GroupGame, LiveMatch, SquadPlayer } from '$lib/types';
  import MatchBoard from './MatchBoard.svelte';

  let {
    games,
    players,
    now
  }: { games: GroupGame[]; players: Map<string, SquadPlayer>; now: number } = $props();

  const PAGE = 10;
  let limit = $state(PAGE);
  let openKey = $state<string | null>(null);
  let boards = $state.raw<Record<string, LiveMatch | 'loading' | 'error'>>({});

  const shown = $derived(games.slice(0, limit));
  const name = (id: string) => players.get(id)?.displayName ?? 'Unknown';

  async function toggle(game: GroupGame) {
    openKey = openKey === game.key ? null : game.key;
    const current = boards[game.matchId];
    if (openKey !== game.key || (current !== undefined && current !== 'error')) return;
    boards = { ...boards, [game.matchId]: 'loading' };
    try {
      const board = await loadBoard(game.matchId);
      boards = { ...boards, [game.matchId]: board };
    } catch {
      boards = { ...boards, [game.matchId]: 'error' };
    }
  }
</script>

{#if games.length}
  <div class="list">
    <div class="head" aria-hidden="true">
      <span>When</span><span>Map</span><span>Result</span><span>Players · K–D · ADR</span><span></span>
    </div>
    {#each shown as game (game.key)}
      {@const open = openKey === game.key}
      {@const board = boards[game.matchId]}
      <div class="game" class:open>
        <button type="button" class="row" aria-expanded={open} onclick={() => toggle(game)}>
          <span class="when" title={dateTime(game.finishedAt)}>{timeAgo(game.finishedAt, now)}</span>
          <span class="map">{game.map}</span>
          <span class="res" class:win={game.won} class:loss={!game.won}>
            {resultText(game.won, game.teamScore, game.enemyScore)}
          </span>
          <span class="lines">
            {#each game.lines as line (line.playerId)}
              <span class="line">
                {name(line.playerId)}<span class="kd">{line.kills}–{line.deaths}</span><span class="adr">{line.adr.toFixed(0)}</span>
              </span>
            {/each}
          </span>
          <svg class="chev" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1.5 6.5 5 3 8.5" /></svg>
        </button>
        {#if open}
          <div class="board">
            {#if board === 'loading' || board === undefined}
              <p class="none">Loading scoreboard…</p>
            {:else if board === 'error'}
              <p class="none">
                FACEIT didn't return this match.
                <a href="https://www.faceit.com/en/cs2/room/{game.matchId}" target="_blank" rel="noreferrer">Open it on FACEIT ↗</a>
              </p>
            {:else}
              <MatchBoard match={board} {now} />
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
  {#if games.length > limit}
    <button class="link-button" type="button" onclick={() => (limit += PAGE)}>
      Show {Math.min(PAGE, games.length - limit)} more
    </button>
  {/if}
{:else}
  <p class="none">No games together in this window.</p>
{/if}

<style>
  .head,
  .row {
    align-items: baseline;
    display: grid;
    gap: 14px;
    grid-template-columns: 56px 92px 92px minmax(0, 1fr) 14px;
  }

  .head {
    border-bottom: 1px solid var(--ink);
    color: var(--ink-2);
    font-size: 12px;
    font-weight: 500;
    padding-bottom: 6px;
  }

  .game {
    border-bottom: 1px solid var(--rule);
  }

  .game.open {
    border-bottom-color: var(--ink);
  }

  .row {
    background: none;
    border: 0;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-variant-numeric: tabular-nums;
    padding: 9px 0;
    text-align: left;
    width: 100%;
  }

  .row:hover {
    background: var(--hover);
  }

  .when {
    color: var(--ink-2);
  }

  .map {
    font-weight: 500;
  }

  .lines {
    display: flex;
    flex-wrap: wrap;
    gap: 3px 20px;
  }

  .line {
    white-space: nowrap;
  }

  .kd {
    margin-left: 5px;
  }

  .adr {
    color: var(--muted);
    margin-left: 5px;
  }

  .chev {
    align-self: center;
    fill: none;
    height: 10px;
    stroke: var(--muted);
    stroke-width: 1.5;
    transition: transform 0.15s ease;
    width: 10px;
  }

  [aria-expanded='true'] > .chev {
    transform: rotate(90deg);
  }

  .board {
    padding: 8px 0 22px 70px;
  }

  @media (max-width: 760px) {
    .head {
      display: none;
    }

    .row {
      gap: 4px 10px;
      grid-template-columns: 44px 64px minmax(0, 1fr) 14px;
    }

    .lines {
      grid-column: 2 / 4;
      grid-row: 2;
    }

    .chev {
      grid-column: 4;
      grid-row: 1;
    }

    .board {
      padding-left: 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .chev {
      transition: none;
    }
  }
</style>
