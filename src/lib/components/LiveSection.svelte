<script lang="ts">
  import { isActive } from '$lib/columns';
  import { age, score, stopwatch, timeAgo } from '$lib/format';
  import type { GroupGame, LiveMatch, LiveOverview, SquadPlayer } from '$lib/types';
  import Avatar from './Avatar.svelte';
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

  /** The status words, and the time that goes with them. */
  function status(match: LiveMatch): [string, string] {
    if (match.phase === 'live') return ['In match', match.startedAt ? stopwatch(clock - match.startedAt) : ''];
    if (match.phase === 'setup')
      return match.configuredAt ? ['Starting · room opened', timeAgo(match.configuredAt, clock)] : ['Starting', ''];
    const ended = match.finishedAt ? timeAgo(match.finishedAt, clock) : '';
    if (!inProgress.length) return ended ? ['Nobody is in a match · last one finished', ended] : ['Nobody is in a match', ''];
    return ['Finished', ended];
  }
</script>

<section id="live" class="band" class:idle={!boards.length} aria-labelledby="live-head">
  <div class="wrap">
    {#each boards as match, index (match.matchId)}
      {@const [words, time] = status(match)}
      <div class="board" class:later={index > 0}>
        <div class="live-head">
          {#if index === 0}<h2 id="live-head">Live</h2>{/if}
          <span class="status">
            {#if match.phase !== 'finished'}<i class="dot" aria-hidden="true"></i>{/if}{words}{#if time}{match.phase === 'live' ? ' · ' : ' '}<span class="time">{time}</span>{/if}
          </span>
          {#if index === 0 && failed}<span class="muted">Couldn't reach FACEIT; showing the last update</span>{/if}
          <span class="links">
            {#if match.demoUrl}<a class="ext" href={match.demoUrl} target="_blank" rel="noreferrer">Demo ↗</a>{/if}
            <a class="ext" href={match.faceitUrl} target="_blank" rel="noreferrer">Match room ↗</a>
          </span>
        </div>
        <MatchBoard {match} />
      </div>
    {:else}
      <div class="live-head">
        <h2 id="live-head">Live</h2>
        <span class="status">Nobody is in a match</span>
        {#if failed}<span class="muted">Couldn't reach FACEIT; showing the last update</span>{/if}
      </div>
      {#if lastGame || lastPlayed.length}
        <div class="idle-grid">
          {#if lastGame}
            <div>
              <h3 class="label">Last game together</h3>
              <p class="last-game">
                {#if lastGame.map}<span class="map">{lastGame.map}</span>{/if}
                <span class="res" class:win={lastGame.won} class:loss={!lastGame.won}>{lastGame.won ? 'W' : 'L'}</span>
                <span class="mono">{score(lastGame.teamScore, lastGame.enemyScore)}</span>
                <span class="mono muted">{timeAgo(lastGame.finishedAt, clock)}</span>
              </p>
              <p class="with">
                {lastGame.lines.map((line) => byId.get(line.playerId)?.displayName ?? 'Unknown').join(', ')}
              </p>
            </div>
          {/if}
          {#if lastPlayed.length}
            <div>
              <h3 class="label">Last played</h3>
              <ul class="recent">
                {#each lastPlayed as player (player.playerId)}
                  <li>
                    <Avatar src={player.avatar} name={player.displayName} size={20} />
                    <span class="name">{player.displayName}</span>
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
    padding: 22px 0 30px;
  }

  .band.idle {
    padding: 22px 0 34px;
  }

  /* Opened rows inside the band sit on the page colour so they stand apart. */
  .band :global(.tbl tr.open > *),
  .band :global(.tbl tr.detail > td) {
    --surface: var(--page);
    background-color: var(--page);
  }

  .live-head {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    margin-bottom: 18px;
  }

  .later {
    border-top: 1px solid var(--rule);
    margin-top: 32px;
    padding-top: 20px;
  }

  h2 {
    font: 600 20px/28px var(--sans);
    letter-spacing: -0.01em;
  }

  .status {
    color: var(--ink-2);
    font-size: 12.5px;
  }

  .dot {
    background: var(--accent);
    border-radius: 50%;
    display: inline-block;
    height: 7px;
    margin-right: 7px;
    vertical-align: 1px;
    width: 7px;
  }

  .time {
    font-family: var(--mono);
    font-size: 12px;
  }

  .links {
    display: flex;
    gap: 18px;
    margin-left: auto;
  }

  .idle-grid {
    display: grid;
    gap: 28px 56px;
    grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
  }

  .label {
    color: var(--muted);
    font: 400 12px/1.4 var(--sans);
    margin-bottom: 10px;
  }

  .last-game {
    align-items: baseline;
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: 15px;
  }

  .last-game .map {
    font-weight: 600;
  }

  .last-game .res {
    font-size: 15px;
  }

  .last-game .mono {
    font-size: 14px;
  }

  .with {
    color: var(--ink-2);
    margin-top: 6px;
  }

  .recent {
    display: grid;
    gap: 10px 32px;
    grid-template-columns: repeat(auto-fill, minmax(168px, 1fr));
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .recent li {
    align-items: center;
    display: flex;
    gap: 9px;
    min-width: 0;
  }

  .recent .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .recent .mono {
    font-size: 12px;
    margin-left: auto;
  }

  @media (max-width: 860px) {
    .idle-grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }

  @media (max-width: 640px) {
    .links {
      margin-left: 0;
      width: 100%;
    }

    .recent {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px 20px;
    }
  }
</style>
