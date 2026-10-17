<script lang="ts">
  import { age, dateTime, fixed, headshotRate, kd, roomUrl, score, signed } from '$lib/format';
  import { loadBoard } from '$lib/match-board';
  import type { GroupGame, LiveMatch, SquadPlayer } from '$lib/types';
  import Avatar from './Avatar.svelte';
  import Chevron from './Chevron.svelte';
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
  /** Full scoreboards, fetched when asked for. */
  let boards = $state.raw<Record<string, LiveMatch | 'loading' | 'error'>>({});

  const shown = $derived(showAll ? games : games.slice(0, PAGE));
  const name = (id: string) => players.get(id)?.displayName ?? 'Unknown';

  async function fullScoreboard(game: GroupGame) {
    const current = boards[game.matchId];
    if (current !== undefined && current !== 'error') return;
    boards = { ...boards, [game.matchId]: 'loading' };
    try {
      boards = { ...boards, [game.matchId]: await loadBoard(game.matchId) };
    } catch {
      boards = { ...boards, [game.matchId]: 'error' };
    }
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
          {#if mapImages[game.map]}<img class="thumb" src={mapImages[game.map]} alt="" loading="lazy" />{:else}<span class="thumb"></span>{/if}
          <span>{game.map}</span>
        </span>
        <span class="result">
          <span class="res" class:win={game.won} class:loss={!game.won}>{game.won ? 'W' : 'L'}</span>
          <span class="score">{score(game.teamScore, game.enemyScore)}</span>
        </span>
        <span class="lines">
          {#each game.lines as line (line.playerId)}
            <span class="line">
              <span class="who-name">{name(line.playerId)}</span>
              <span class="kd">{line.kills}–{line.deaths}</span>
              <span class="adr">{fixed(line.adr, 1)}</span>
            </span>
          {/each}
        </span>
        <Chevron />
      </button>
      {#if expanded}
        <div class="detail">
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
                    <td class="l">
                      <span class="who">
                        <Avatar src={player?.avatar ?? ''} name={name(line.playerId)} size={18} />
                        <span>{name(line.playerId)}</span>
                      </span>
                    </td>
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
          <p class="foot">
            <span class="mono muted">{dateTime(game.finishedAt)} · {game.rounds} rounds</span>
            {#if board === undefined || board === 'error'}
              <button class="text-button" type="button" onclick={() => fullScoreboard(game)}>Full scoreboard</button>
            {/if}
            <a class="ext" href={roomUrl(game.matchId)} target="_blank" rel="noreferrer">Match room ↗</a>
          </p>
          {#if board === 'loading'}
            <p class="none">Loading scoreboard…</p>
          {:else if board === 'error'}
            <p class="none">FACEIT didn't return this match</p>
          {:else if board}
            <div class="board"><Scoreboard match={board} /></div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
  {#if games.length > PAGE}
    <button class="text-button more" type="button" onclick={() => (showAll = !showAll)}>
      {showAll ? `Show ${PAGE}` : `Show all ${games.length}`}
    </button>
  {/if}
{:else}
  <p class="none">No games together in this window</p>
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
    grid-template-columns: 44px 150px 76px minmax(0, 1fr) 10px;
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
    gap: 10px;
    font-weight: 500;
    min-width: 0;
  }

  .result {
    align-items: baseline;
    display: flex;
    gap: 8px;
  }

  .score {
    font: 12.5px var(--mono);
  }

  .lines {
    display: flex;
    flex-wrap: wrap;
    gap: 3px 22px;
  }

  .line {
    align-items: baseline;
    display: inline-flex;
    gap: 7px;
    white-space: nowrap;
  }

  .who-name {
    color: var(--ink-2);
  }

  .kd {
    font: 12px var(--mono);
  }

  .adr {
    color: var(--muted);
    font: 11.5px var(--mono);
  }

  .detail {
    --surface: var(--band);
    background: var(--band);
    border-bottom: 1px solid var(--rule-2);
    padding: 6px 12px 14px;
  }

  .detail .mini {
    max-width: 900px;
  }

  .detail .who {
    gap: 8px;
  }

  .mini td.muted {
    color: var(--muted);
  }

  .foot {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    font-size: 11.5px;
    gap: 6px 20px;
    margin-top: 10px;
  }

  .board {
    margin-top: 14px;
  }

  .detail .none {
    margin-top: 10px;
  }

  @media (max-width: 760px) {
    .game {
      gap: 6px 10px;
      grid-template-columns: minmax(0, 1fr) auto 10px;
      padding: 10px 0;
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

    .detail {
      padding: 6px 0 14px;
    }
  }
</style>
