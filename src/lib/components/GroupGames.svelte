<script lang="ts">
  import { age, dateTime, fixed, headshotRate, kd, roomUrl, score, signed } from '$lib/format';
  import { loadBoard } from '$lib/match-board';
  import type { GroupGame, LiveMatch, SquadPlayer } from '$lib/types';
  import Avatar from './Avatar.svelte';
  import Chevron from './Chevron.svelte';
  import MapImage from './MapImage.svelte';
  import Scoreboard from './Scoreboard.svelte';

  let {
    games,
    players,
    mapImages,
    now
  }: {
    games: GroupGame[];
    players: Map<string, SquadPlayer>;
    mapImages: Record<string, string>;
    now: number;
  } = $props();

  const PAGE = 10;
  let showAll = $state(false);
  let open = $state<Record<string, boolean>>({});
  /** Which games show their full scoreboard. */
  let showBoard = $state<Record<string, boolean>>({});
  /** Full scoreboards, fetched when first asked for. */
  let boards = $state.raw<Record<string, LiveMatch | 'loading' | 'error'>>({});

  const shown = $derived(showAll ? games : games.slice(0, PAGE));
  const name = (id: string) => players.get(id)?.displayName ?? 'Unknown';

  async function fetchBoard(game: GroupGame) {
    const current = boards[game.matchId];
    if (current !== undefined && current !== 'error') return;
    boards = { ...boards, [game.matchId]: 'loading' };
    try {
      boards = { ...boards, [game.matchId]: await loadBoard(game.matchId) };
    } catch {
      boards = { ...boards, [game.matchId]: 'error' };
    }
  }

  function toggleBoard(game: GroupGame) {
    showBoard[game.matchId] = !showBoard[game.matchId];
    if (showBoard[game.matchId]) void fetchBoard(game);
  }
</script>

{#if games.length}
  <div class="games">
    {#each shown as game (game.key)}
      {@const expanded = open[game.key] ?? false}
      {@const board = boards[game.matchId]}
      <button type="button" class="game" aria-expanded={expanded} onclick={() => (open[game.key] = !expanded)}>
        <span class="when" title={dateTime(game.finishedAt)}>{age(game.finishedAt, now)}</span>
        <span class="map">
          <MapImage src={mapImages[game.map] ?? ''} size="small" />
          <span>{game.map}</span>
        </span>
        <span class="result">
          <span class="res" class:win={game.won} class:loss={!game.won}>{game.won ? 'W' : 'L'}</span>
          <span class="score">{score(game.teamScore, game.enemyScore)}</span>
        </span>
        <span class="lines">
          {#each game.lines as line (line.playerId)}
            <span class="line">
              <span class="line-name" title={name(line.playerId)}>{name(line.playerId)}</span>
              <span class="kd">{line.kills}–{line.deaths}</span>
              <span class="adr">{fixed(line.adr, 1)}</span>
            </span>
          {/each}
        </span>
        <Chevron />
      </button>
      {#if expanded}
        <div class="detail on-band">
          <div class="scroll">
            <table class="mini">
              <thead>
                <tr>
                  <th class="l" scope="col">Player</th>
                  <th scope="col">K</th>
                  <th scope="col">D</th>
                  <th scope="col">A</th>
                  <th scope="col" title="Kills minus deaths">±</th>
                  <th scope="col">K/D</th>
                  <th scope="col">ADR</th>
                  <th scope="col">HS %</th>
                  <th scope="col">MVP</th>
                  <th scope="col">3K</th>
                  <th scope="col">4K</th>
                  <th scope="col">5K</th>
                </tr>
              </thead>
              <tbody>
                {#each game.lines as line (line.playerId)}
                  {@const player = players.get(line.playerId)}
                  {@const diff = line.kills - line.deaths}
                  <tr>
                    <th class="l" scope="row">
                      <span class="who">
                        <Avatar src={player?.avatar ?? ''} name={name(line.playerId)} />
                        <span class="name" title={name(line.playerId)}>{name(line.playerId)}</span>
                      </span>
                    </th>
                    <td>{line.kills}</td>
                    <td>{line.deaths}</td>
                    <td>{line.assists}</td>
                    <td class:pos={diff > 0} class:neg={diff < 0}>{signed(diff)}</td>
                    <td>{fixed(kd(line.kills, line.deaths), 2)}</td>
                    <td>{fixed(line.adr, 1)}</td>
                    <td>{headshotRate(line.headshots, line.kills)}</td>
                    <td class:muted={!line.mvps}>{line.mvps}</td>
                    <td class:muted={!line.tripleKills}>{line.tripleKills}</td>
                    <td class:muted={!line.quadroKills}>{line.quadroKills}</td>
                    <td class:muted={!line.pentaKills}>{line.pentaKills}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
          <div class="foot">
            <span class="muted"><span class="mono">{dateTime(game.finishedAt)}</span> · <span class="mono">{game.rounds}</span> rounds</span>
            <span class="actions">
              <button class="text-button" type="button" onclick={() => toggleBoard(game)}>
                {showBoard[game.matchId] ? 'Hide scoreboard' : 'Full scoreboard'}
              </button>
              <a class="ext" href={roomUrl(game.matchId)} target="_blank" rel="noreferrer">Match room ↗</a>
            </span>
          </div>
          {#if showBoard[game.matchId]}
            {#if board === 'loading' || board === undefined}
              <p class="none">Loading scoreboard…</p>
            {:else if board === 'error'}
              <p class="none">
                FACEIT didn't return this match
                <button class="text-button retry" type="button" onclick={() => fetchBoard(game)}>Try again</button>
              </p>
            {:else}
              <div class="board"><Scoreboard match={board} /></div>
            {/if}
          {/if}
        </div>
      {/if}
    {/each}
  </div>
  {#if games.length > PAGE}
    <button class="text-button more" type="button" onclick={() => (showAll = !showAll)}>
      {#if showAll}Show <span class="mono">{PAGE}</span>{:else}Show all <span class="mono">{games.length}</span>{/if}
    </button>
  {/if}
{:else}
  <p class="none">No games together</p>
{/if}

<style>
  .games {
    border-top: 1px solid var(--rule-2);
  }

  .game {
    align-items: center;
    background: none;
    border: 0;
    border-bottom: 1px solid var(--rule);
    cursor: pointer;
    display: grid;
    gap: 0 16px;
    grid-template-columns: 52px 150px 72px minmax(0, 1fr) 14px;
    min-height: 46px;
    padding: 6px 4px;
    text-align: left;
    width: 100%;
  }

  .game:hover {
    background: var(--hover);
  }

  .game[aria-expanded='true'] {
    background: var(--band);
    border-bottom-color: transparent;
  }

  .when {
    color: var(--muted);
    font: 11.5px var(--mono);
  }

  .map {
    align-items: center;
    display: flex;
    gap: 8px;
    min-width: 0;
  }

  .result {
    align-items: baseline;
    display: flex;
    gap: 8px;
  }

  .score {
    font: 12px var(--mono);
  }

  .lines {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 22px;
    min-width: 0;
  }

  .line {
    align-items: baseline;
    display: inline-flex;
    gap: 8px;
    max-width: 100%;
    min-width: 0;
    white-space: nowrap;
  }

  .line-name {
    color: var(--ink-2);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .kd {
    flex: none;
    font: 12px var(--mono);
  }

  .adr {
    color: var(--muted);
    flex: none;
    font: 11.5px var(--mono);
  }

  .detail {
    --surface: var(--band);
    background: var(--band);
    border-bottom: 1px solid var(--rule-2);
    padding: 12px 16px 18px;
  }

  .detail .mini {
    max-width: 900px;
  }

  .mini td.muted {
    color: var(--muted);
  }

  .foot {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    font-size: 11.5px;
    gap: 6px 14px;
    margin-top: 10px;
    max-width: 900px;
  }

  .actions {
    display: flex;
    gap: 16px;
    margin-left: auto;
  }

  .retry {
    margin-left: 12px;
  }

  .board {
    margin-top: 14px;
  }

  .detail .none {
    margin-top: 10px;
  }

  @media (max-width: 860px) {
    .game {
      grid-template-columns: minmax(0, 1fr) auto 14px;
      row-gap: 6px;
    }

    .when {
      grid-column: 1;
      grid-row: 2;
    }

    .map {
      grid-column: 1;
      grid-row: 1;
    }

    .result {
      grid-column: 2;
      grid-row: 1;
    }

    .game :global(.chev) {
      grid-column: 3;
      grid-row: 1;
    }

    .lines {
      gap: 2px 16px;
      grid-column: 1 / -1;
      grid-row: 3;
    }
  }

  @media (max-width: 640px) {
    .detail {
      padding: 12px 12px 18px;
    }

    .actions {
      margin-left: 0;
    }
  }
</style>
