<script lang="ts">
  import { dateTime, timeAgo } from '$lib/format';
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
  let boards = $state<Record<string, LiveMatch | 'loading' | 'error'>>({});

  const shown = $derived(games.slice(0, limit));
  const name = (id: string) => players.get(id)?.displayName ?? 'Unknown';

  async function toggle(game: GroupGame) {
    openKey = openKey === game.key ? null : game.key;
    if (openKey !== game.key || boards[game.matchId] instanceof Object) return;
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
  <ol class="games">
    {#each shown as game (game.key)}
      {@const open = openKey === game.key}
      {@const board = boards[game.matchId]}
      <li class:open>
        <button type="button" class="game" aria-expanded={open} onclick={() => toggle(game)}>
          <span class="when" title={dateTime(game.finishedAt)}>{timeAgo(game.finishedAt, now)}</span>
          <span class="map">{game.map}</span>
          <span class="result" class:win={game.won}>
            {game.won ? 'W' : 'L'}{#if game.teamScore !== null && game.enemyScore !== null}<span class="score">{game.teamScore}–{game.enemyScore}</span>{/if}
          </span>
          <span class="lines">
            {#each game.lines as line (line.playerId)}
              <span class="line">
                <span class="who">{name(line.playerId)}</span>
                <span class="kd">{line.kills}–{line.deaths}</span>
                <span class="adr">{line.adr.toFixed(0)}</span>
              </span>
            {/each}
          </span>
        </button>
        {#if open}
          <div class="board-slot">
            {#if board === 'loading' || board === undefined}
              <p class="quiet">Loading scoreboard…</p>
            {:else if board === 'error'}
              <p class="quiet">FACEIT didn't return this match. <a href="https://www.faceit.com/en/cs2/room/{game.matchId}" target="_blank" rel="noreferrer">Open on FACEIT</a></p>
            {:else}
              <MatchBoard match={board} {now} />
            {/if}
          </div>
        {/if}
      </li>
    {/each}
  </ol>
  {#if games.length > limit}
    <button class="text-button" type="button" onclick={() => (limit += PAGE)}>Show {Math.min(PAGE, games.length - limit)} more</button>
  {/if}
{:else}
  <p class="quiet">No games together in the last 90 days.</p>
{/if}
