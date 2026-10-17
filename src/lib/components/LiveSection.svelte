<script lang="ts">
  import { isActive } from '$lib/columns';
  import { age, score, stopwatch, timeAgo } from '$lib/format';
  import type { GroupGame, LiveMatch, LiveOverview, SquadPlayer } from '$lib/types';
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
    /** Unix seconds; the page ticks it every 30 seconds. */
    now: number;
    players: SquadPlayer[];
    games: GroupGame[];
  } = $props();

  // A match in progress ticks its clock every second.
  let second = $state(0);
  const clock = $derived(Math.max(now, overview?.generatedAt ?? 0, second));

  const matches = $derived(overview?.matches ?? []);
  const inProgress = $derived(matches.filter((match) => match.phase === 'live' || match.phase === 'setup'));
  const finished = $derived(matches.filter((match) => match.phase === 'finished'));
  const boards = $derived([...inProgress, ...finished]);
  const byId = $derived(new Map(players.map((player) => [player.playerId, player])));

  $effect(() => {
    if (!inProgress.some((match) => match.phase === 'live')) return;
    const tick = () => (second = Math.floor(Date.now() / 1000));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  });

  const lastGame = $derived(games[0] ?? null);
  /** Active players by how recently they played. */
  const lastPlayed = $derived(
    players
      .filter((player) => isActive(player) && player.lastMatchAt)
      .sort((a, b) => (b.lastMatchAt ?? 0) - (a.lastMatchAt ?? 0))
      .slice(0, 10)
  );

  /**
   * The status words, and the time that goes with them. Only the newest finished board, with
   * nothing in progress, speaks for the whole group.
   */
  function status(match: LiveMatch, index: number): [string, string] {
    if (match.phase === 'live') return ['In match', match.startedAt ? stopwatch(clock - match.startedAt) : ''];
    if (match.phase === 'setup')
      return match.configuredAt ? ['Starting · room opened', timeAgo(match.configuredAt, clock)] : ['Starting', ''];
    const ended = match.finishedAt ? timeAgo(match.finishedAt, clock) : '';
    if (index === 0 && !inProgress.length)
      return ended ? ['Nobody is in a match · last one finished', ended] : ['Nobody is in a match', ''];
    return ['Finished', ended];
  }
</script>

<section id="live" class="band on-band" aria-labelledby="live-head">
  <div class="wrap">
    {#each boards as match, index (match.matchId)}
      {@const [words, time] = status(match, index)}
      <div class="board" class:later={index > 0}>
        <div class="section-head">
          {#if index === 0}<h2 id="live-head">Live</h2>{/if}
          <span class="meta">
            {#if match.phase !== 'finished'}<i class="dot" aria-hidden="true"></i>{/if}{words}{#if time}{match.phase ===
                'live'
                  ? ' · '
                  : ' '}<b>{time}</b>{/if}
          </span>
          {#if index === 0 && failed}<span class="meta">Couldn't reach FACEIT; showing the last update</span>{/if}
          <div class="controls">
            {#if match.demoUrl}<a class="ext" href={match.demoUrl} target="_blank" rel="noreferrer">Demo ↗</a>{/if}
            <a class="ext" href={match.faceitUrl} target="_blank" rel="noreferrer">Match room ↗</a>
          </div>
        </div>
        <MatchBoard {match} />
      </div>
    {:else}
      <div class="section-head">
        <h2 id="live-head">Live</h2>
        <span class="meta">Nobody is in a match</span>
        {#if failed}<span class="meta">Couldn't reach FACEIT; showing the last update</span>{/if}
      </div>
      {#if lastGame || lastPlayed.length}
        <div class="idle-grid" class:single={!lastGame || !lastPlayed.length}>
          {#if lastGame}
            <div>
              <h3 class="block-label">Last game together</h3>
              <p class="last-game">
                {#if lastGame.map}<span class="map">{lastGame.map}</span>{/if}
                <span class="res" class:win={lastGame.won} class:loss={!lastGame.won}>{lastGame.won ? 'W' : 'L'}</span>
                <span class="mono">{score(lastGame.teamScore, lastGame.enemyScore)}</span>
                <span class="mono muted">{age(lastGame.finishedAt, clock)}</span>
              </p>
              <p class="with">
                {lastGame.lines.map((line) => byId.get(line.playerId)?.displayName ?? 'Unknown').join(', ')}
              </p>
            </div>
          {/if}
          {#if lastPlayed.length}
            <div>
              <h3 class="block-label">Last played</h3>
              <ul class="recent">
                {#each lastPlayed as player (player.playerId)}
                  <li>
                    <span class="name" title={player.displayName}>{player.displayName}</span>
                    <span class="mono muted">{age(player.lastMatchAt, clock)}</span>
                  </li>
                {/each}
              </ul>
            </div>
          {/if}
        </div>
      {/if}
    {/each}
  </div>
</section>

<style>
  .band {
    --surface: var(--band);
    background: var(--band);
    border-bottom: 1px solid var(--rule);
    padding: 22px 0 28px;
  }

  .later {
    border-top: 1px solid var(--rule);
    margin-top: 32px;
    padding-top: 20px;
  }

  .dot {
    background: var(--accent);
    border-radius: 50%;
    display: inline-block;
    height: 8px;
    margin-right: 8px;
    vertical-align: 0;
    width: 8px;
  }

  .idle-grid {
    display: grid;
    gap: 28px 56px;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  }

  .idle-grid.single {
    grid-template-columns: minmax(0, 1fr);
  }

  .block-label {
    margin-bottom: 8px;
  }

  .last-game {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
  }

  .last-game .map {
    font: 600 15px/22px var(--sans);
  }

  .last-game .mono {
    font-size: 12px;
  }

  .with {
    color: var(--ink-2);
    margin-top: 6px;
  }

  /* Most recent first, reading down each column: a ruled list, split into columns as width allows. */
  .recent {
    column-gap: 40px;
    columns: 5 150px;
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .recent li {
    align-items: baseline;
    border-bottom: 1px solid var(--rule);
    break-inside: avoid;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    line-height: 28px;
    min-width: 0;
  }

  .recent .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recent .mono {
    flex: none;
    font-size: 12px;
  }

  @media (max-width: 860px) {
    .idle-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 640px) {
    .recent {
      column-gap: 24px;
      columns: 2;
    }
  }
</style>
