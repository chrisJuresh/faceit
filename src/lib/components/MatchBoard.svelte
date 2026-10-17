<script lang="ts">
  import { dateTime, duration, timeAgo } from '$lib/format';
  import type { LiveMatch, LivePlayer, LiveTeam } from '$lib/types';
  import Level from './Level.svelte';

  /** `compact` shows only our side's scoreline until "Full scoreboard" is opened. */
  let { match, now, compact = false }: { match: LiveMatch; now: number; compact?: boolean } = $props();

  let full = $state(false);
  let rawFor = $state<string | null>(null);

  const finished = $derived(match.phase === 'finished');
  const teams = $derived([...match.teams].sort((a, b) => Number(b.tracked) - Number(a.tracked)));
  const ours = $derived(teams.find((team) => team.tracked) ?? teams[0]);
  const theirs = $derived(teams.find((team) => team !== ours));
  const shownTeams = $derived(compact && !full ? teams.filter((team) => team === ours) : teams);
  const hasScore = $derived(finished && ours?.score !== null && theirs?.score !== null);

  const label = (team: LiveTeam | undefined) => (team ? team.name.replace(/^team_/, '') : '');
  const teamNote = (team: LiveTeam) => {
    if (finished) return team.score === null ? '' : String(team.score);
    return [
      team.averageElo ? `Avg ELO ${team.averageElo.toLocaleString('en-GB')}` : '',
      team.winProbability === null ? '' : `${team.winProbability}%`
    ]
      .filter(Boolean)
      .join(' · ');
  };
  const diff = (player: LivePlayer) =>
    player.scoreline ? player.scoreline.kills - player.scoreline.deaths : 0;
  const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0');
  const fraction = (wins: number, total: number) => (total ? `${wins}/${total}` : '–');
  const pct = (value: number | null | undefined) =>
    value === null || value === undefined || !Number.isFinite(value) ? '—' : value.toFixed(0);

  const halves = $derived.by(() => {
    if (!finished || !ours || !theirs || ours.firstHalf === null || theirs.firstHalf === null) return null;
    const parts = [
      `1st half ${ours.firstHalf}–${theirs.firstHalf}`,
      `2nd half ${ours.secondHalf ?? 0}–${theirs.secondHalf ?? 0}`
    ];
    if ((ours.overtime ?? 0) + (theirs.overtime ?? 0) > 0) parts.push(`Overtime ${ours.overtime}–${theirs.overtime}`);
    if (match.rounds) parts.push(`${match.rounds} rounds`);
    return parts.join(' · ');
  });

  const place = $derived(
    [
      match.competition,
      match.location?.name,
      match.region,
      match.calculateElo ? null : 'ELO not counted'
    ]
      .filter(Boolean)
      .join(' · ')
  );

  const when = $derived.by(() => {
    if (match.phase === 'live' && match.startedAt) return `Started ${timeAgo(match.startedAt, now)}`;
    if (match.phase === 'setup') return match.configuredAt ? `Room opened ${timeAgo(match.configuredAt, now)}` : 'Starting';
    if (finished && match.finishedAt) {
      const length = match.startedAt ? ` · ${duration(match.finishedAt - match.startedAt)}` : '';
      return `${dateTime(match.finishedAt)}${length}`;
    }
    return match.status;
  });
</script>

<article class="match" class:finished>
  <header class="head">
    {#if match.map?.image}
      <img class="art" src={match.map.image} alt="" loading="lazy" />
    {/if}
    <div class="title">
      <h3>
        {match.map?.name ?? 'Map vote'}
        {#if hasScore}
          <span class="score">{ours.score}–{theirs?.score}</span>
          <span class="res" class:win={ours.won} class:loss={!ours.won}>{ours.won ? 'Won' : 'Lost'}</span>
        {/if}
      </h3>
      {#if halves}<p class="meta-line">{halves}</p>{/if}
      <p class="meta-line">{place}</p>
      <p class="meta-line">{when}</p>
    </div>
    <p class="links">
      <a href={match.faceitUrl} target="_blank" rel="noreferrer">Match room ↗</a>
      {#if match.demoUrl}<a href={match.demoUrl} target="_blank" rel="noreferrer">Demo ↗</a>{/if}
    </p>
  </header>

  {#if !finished && ours && theirs}
    <div class="teams">
      <div>
        <p class="team-name">{label(ours)}</p>
        {#if ours.averageElo}<p class="team-sub">Avg ELO {ours.averageElo.toLocaleString('en-GB')}</p>{/if}
      </div>
      {#if ours.winProbability !== null && theirs.winProbability !== null}
        <div class="odds">
          <p class="odds-line"><b>{ours.winProbability}%</b><span>Win probability</span><b>{theirs.winProbability}%</b></p>
          <div class="odds-bar" aria-hidden="true">
            <i style:flex-grow={ours.winProbability}></i><i style:flex-grow={theirs.winProbability}></i>
          </div>
        </div>
      {:else}
        <div></div>
      {/if}
      <div class="right">
        <p class="team-name">{label(theirs)}</p>
        {#if theirs.averageElo}<p class="team-sub">Avg ELO {theirs.averageElo.toLocaleString('en-GB')}</p>{/if}
      </div>
    </div>
  {/if}

  <div class="scroll">
    <table class="tbl box">
      <thead>
        {#if finished}
          <tr>
            <th class="l stick" scope="col">Player</th>
            <th scope="col">K</th><th scope="col">D</th><th scope="col">A</th>
            <th scope="col" title="Kills minus deaths">+/−</th>
            <th scope="col">K/D</th><th scope="col">K/R</th><th scope="col">ADR</th>
            <th scope="col" title="Kills that were headshots">HS %</th>
            <th scope="col">MVPs</th>
            <th scope="col" title="First kills of a round">First</th>
            <th scope="col" title="Opening duels won / taken">Entry</th>
            <th scope="col" title="1v1 and 1v2 clutches won / played">Clutch</th>
            <th scope="col">3K</th><th scope="col">4K</th><th scope="col">5K</th>
            <th scope="col" title="Utility damage">Util</th>
            <th scope="col" title="Enemies flashed">Flashed</th>
            <th scope="col" title="Sniper kills">AWP</th>
          </tr>
        {:else}
          <tr class="groups">
            <th class="stick"></th>
            <th></th>
            <th colspan="9" class="first"><span>Lifetime</span></th>
            <th colspan="6" class="first"><span>On {match.map?.name ?? 'this map'}</span></th>
          </tr>
          <tr>
            <th class="l stick" scope="col">Player</th>
            <th scope="col">ELO</th>
            <th scope="col" class="first">M</th><th scope="col">Win %</th><th scope="col">K/D</th>
            <th scope="col">ADR</th><th scope="col">HS %</th>
            <th scope="col" title="Opening duels won">Entry %</th>
            <th scope="col" title="1v1 clutches won">1v1 %</th>
            <th scope="col" title="Current win streak">Streak</th>
            <th scope="col" class="l">Last 5</th>
            <th scope="col" class="first">M</th><th scope="col">Win %</th><th scope="col">K/D</th>
            <th scope="col">K/R</th><th scope="col">ADR</th><th scope="col">HS %</th>
          </tr>
        {/if}
      </thead>
      {#each shownTeams as team (team.factionId)}
        <tbody>
          <tr class="team">
            <th colspan={finished ? 19 : 17} scope="colgroup">
              {label(team)}
              <span class="team-sub">{teamNote(team)}</span>
            </th>
          </tr>
          {#each team.players as player (player.playerId)}
            {@const line = player.scoreline}
            {@const life = player.lifetime}
            {@const map = player.onMap}
            {@const mine = player.isOwner || player.isFriend}
            <tr class="person" class:mine>
              <th class="l stick" scope="row">
                <span class="who">
                  <Level level={player.skillLevel} elo={player.elo} />
                  {#if finished && player.allStats.length}
                    <button
                      type="button"
                      class="name"
                      aria-expanded={rawFor === player.playerId}
                      title="Every stat FACEIT recorded"
                      onclick={() => (rawFor = rawFor === player.playerId ? null : player.playerId)}
                    >{player.displayName}</button>
                  {:else}
                    <a class="name" href={player.faceitUrl} target="_blank" rel="noreferrer">{player.displayName}</a>
                  {/if}
                  {#if player.country}<span class="cc">{player.country}</span>{/if}
                  {#if player.isLeader}<span class="cc" title="Captain">C</span>{/if}
                </span>
              </th>
              {#if finished}
                {#if line}
                  <td>{line.kills}</td>
                  <td>{line.deaths}</td>
                  <td>{line.assists}</td>
                  <td class:pos={diff(player) > 0} class:neg={diff(player) < 0}>{signed(diff(player))}</td>
                  <td>{line.kd.toFixed(2)}</td>
                  <td>{line.kr.toFixed(2)}</td>
                  <td>{line.adr.toFixed(1)}</td>
                  <td>{line.headshots}</td>
                  <td>{line.mvps}</td>
                  <td>{line.firstKills}</td>
                  <td>{fraction(line.entryWins, line.entryCount)}</td>
                  <td>{fraction(line.clutchWins, line.clutchAttempts)}</td>
                  <td>{line.tripleKills}</td>
                  <td>{line.quadroKills}</td>
                  <td>{line.pentaKills}</td>
                  <td>{line.utilityDamage}</td>
                  <td>{line.enemiesFlashed}</td>
                  <td>{line.sniperKills}</td>
                {:else}
                  <td colspan="18" class="l muted">FACEIT has no stats for this player</td>
                {/if}
              {:else}
                <td>{player.elo ? player.elo.toLocaleString('en-GB') : '—'}</td>
                {#if life}
                  <td class="first">{life.matches.toLocaleString('en-GB')}</td>
                  <td>{pct(life.winRate)}</td>
                  <td class:pos={life.kd >= 1} class:neg={life.kd < 1}>{life.kd.toFixed(2)}</td>
                  <td>{life.adr.toFixed(1)}</td>
                  <td>{pct(life.headshots)}</td>
                  <td>{pct(life.entrySuccess)}</td>
                  <td>{pct(life.clutch1v1)}</td>
                  <td>{life.currentStreak}</td>
                  <td class="l">
                    <span class="results" aria-label="Last results, newest first: {life.recentResults.join(' ')}">
                      {#each life.recentResults as result, index (index)}<i class:win={result === 'W'}></i>{/each}
                    </span>
                  </td>
                {:else}
                  <td colspan="9" class="l muted first">No lifetime record</td>
                {/if}
                {#if map}
                  <td class="first" class:low={map.matches < 10}>{map.matches}</td>
                  <td class:low={map.matches < 10}>{pct(map.winRate)}</td>
                  <td class:low={map.matches < 10}>{map.kd.toFixed(2)}</td>
                  <td class:low={map.matches < 10}>{map.kr.toFixed(2)}</td>
                  <td class:low={map.matches < 10}>{map.adr.toFixed(1)}</td>
                  <td class:low={map.matches < 10}>{pct(map.headshots)}</td>
                {:else}
                  <td colspan="6" class="l muted first">Not played</td>
                {/if}
              {/if}
            </tr>
            {#if rawFor === player.playerId}
              <tr class="raw-row">
                <td colspan="19">
                  <dl class="raw">
                    {#each player.allStats as stat (stat.label)}
                      <div><dt>{stat.label}</dt><dd>{stat.value}</dd></div>
                    {/each}
                  </dl>
                </td>
              </tr>
            {/if}
          {/each}
        </tbody>
      {/each}
    </table>
  </div>

  {#if compact && finished}
    <button class="link-button" type="button" onclick={() => (full = !full)}>
      {full ? 'Our side only' : 'Full scoreboard'}
    </button>
  {/if}
</article>

<style>
  .head {
    align-items: center;
    display: grid;
    gap: 22px;
    grid-template-columns: auto minmax(0, 1fr) auto;
    margin-bottom: 22px;
  }

  .art {
    background: var(--band);
    display: block;
    height: 99px;
    object-fit: cover;
    width: 176px;
  }

  h3 {
    font: 500 38px/1 var(--serif);
    letter-spacing: -0.01em;
    margin-bottom: 8px;
  }

  .finished h3 {
    font-size: 32px;
  }

  .score {
    font: 600 30px/1 var(--sans);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.01em;
    margin-left: 14px;
  }

  h3 .res {
    font: 600 14px var(--sans);
    margin-left: 12px;
    vertical-align: middle;
  }

  .meta-line {
    color: var(--ink-2);
    font-size: 13px;
  }

  .meta-line + .meta-line {
    margin-top: 2px;
  }

  .links {
    align-self: start;
    display: flex;
    font-size: 13px;
    gap: 18px;
  }

  .teams {
    align-items: end;
    display: grid;
    gap: 24px;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.6fr) minmax(0, 1fr);
    margin-bottom: 8px;
  }

  .right {
    text-align: right;
  }

  .team-name {
    font: 500 19px/1.2 var(--serif);
  }

  .team-sub {
    color: var(--ink-2);
    font: 400 12.5px var(--sans);
  }

  .odds-line {
    display: flex;
    font-size: 12.5px;
    font-variant-numeric: tabular-nums;
    justify-content: space-between;
    margin-bottom: 5px;
  }

  .odds-line span {
    color: var(--ink-2);
  }

  .odds-line b {
    font-size: 15px;
    font-weight: 600;
  }

  .odds-bar {
    display: flex;
    gap: 2px;
    height: 6px;
  }

  .odds-bar i:first-child {
    background: var(--ink);
  }

  .odds-bar i:last-child {
    background: var(--rule-2);
  }

  .box .team th {
    border-bottom: 1px solid var(--ink);
    color: var(--ink);
    font: 500 16px/1.2 var(--serif);
    padding: 18px 0 6px;
    text-align: left;
  }

  .box .team .team-sub {
    margin-left: 12px;
  }

  .box tbody:first-of-type .team th {
    padding-top: 10px;
  }

  .box .first {
    padding-left: 18px;
  }

  .who {
    align-items: center;
    display: inline-flex;
    gap: 8px;
  }

  .name {
    background: none;
    border: 0;
    color: var(--ink);
    cursor: pointer;
    font: inherit;
    font-weight: 500;
    padding: 0;
  }

  button.name:hover {
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  .mine .name {
    font-weight: 700;
  }

  .cc {
    color: var(--muted);
    font-size: 11px;
  }

  .muted {
    color: var(--muted);
  }

  .raw-row > td {
    padding: 8px 0 16px;
    text-align: left;
    white-space: normal;
  }

  @media (max-width: 760px) {
    .head {
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .art {
      display: none;
    }

    h3 {
      font-size: 30px;
    }

    .score {
      font-size: 24px;
      margin-left: 10px;
    }

    .teams {
      grid-template-columns: 1fr 1fr;
    }

    .odds {
      grid-column: 1 / -1;
      order: 3;
    }
  }
</style>
