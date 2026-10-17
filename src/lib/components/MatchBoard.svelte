<script lang="ts">
  import { duration, percentText } from '$lib/format';
  import type { LiveMatch, LivePlayer, LiveTeam } from '$lib/types';
  import Avatar from './Avatar.svelte';
  import Level from './Level.svelte';

  let { match, now }: { match: LiveMatch; now: number } = $props();

  let openRows = $state<Record<string, boolean>>({});

  const finished = $derived(match.phase === 'finished');
  const teams = $derived(
    [...match.teams].sort((a, b) => Number(b.tracked) - Number(a.tracked))
  );
  const stateLabel = $derived(
    match.phase === 'live'
      ? 'Live'
      : match.phase === 'setup'
        ? 'Starting'
        : match.phase === 'cancelled'
          ? 'Cancelled'
          : 'Final'
  );
  const elapsed = $derived(
    match.phase === 'live' && match.startedAt ? duration(now - match.startedAt) : null
  );
  const lengthText = $derived(
    finished && match.startedAt && match.finishedAt
      ? duration(match.finishedAt - match.startedAt)
      : null
  );
  const probability = $derived(
    !finished && teams.every((team) => team.winProbability !== null)
      ? teams.map((team) => team.winProbability as number)
      : null
  );

  const diff = (player: LivePlayer) =>
    player.scoreline ? player.scoreline.kills - player.scoreline.deaths : 0;
  const signed = (value: number) => (value > 0 ? `+${value}` : String(value));
  const fraction = (wins: number, total: number) => (total ? `${wins}/${total}` : '–');
  const teamLabel = (team: LiveTeam) => team.name.replace(/^team_/, '');

  function toggle(id: string) {
    openRows = { ...openRows, [id]: !openRows[id] };
  }
</script>

<article class="board" class:finished>
  <header class="board-head">
    {#if match.map?.image}
      <div class="map-art" style:background-image="url('{match.map.image}')" aria-hidden="true"></div>
    {/if}
    <div class="board-title">
      <span class="state" class:live={match.phase === 'live'}>{stateLabel}</span>
      <h3>{match.map?.name ?? 'Map vote'}</h3>
      {#if finished && teams.every((team) => team.score !== null)}
        <span class="final-score">
          <span class:won={teams[0].won}>{teams[0].score}</span><span class="dash">–</span><span
            class:won={teams[1]?.won}>{teams[1]?.score}</span
          >
        </span>
      {/if}
    </div>
    <dl class="board-meta">
      {#if elapsed}<div><dt>Elapsed</dt><dd>{elapsed}</dd></div>{/if}
      {#if lengthText}<div><dt>Length</dt><dd>{lengthText}</dd></div>{/if}
      {#if match.rounds}<div><dt>Rounds</dt><dd>{match.rounds}</dd></div>{/if}
      {#if finished && teams[0]?.firstHalf !== null}
        <div>
          <dt>Halves</dt>
          <dd>
            {teams[0].firstHalf}–{teams[1]?.firstHalf}, {teams[0].secondHalf}–{teams[1]?.secondHalf}{#if (teams[0].overtime ?? 0) + (teams[1]?.overtime ?? 0) > 0},
              OT {teams[0].overtime}–{teams[1]?.overtime}{/if}
          </dd>
        </div>
      {/if}
      {#if match.location}<div><dt>Server</dt><dd>{match.location.name}</dd></div>{/if}
      <div><dt>Queue</dt><dd>{match.competition}</dd></div>
      {#if !match.calculateElo}<div><dt>ELO</dt><dd>Not counted</dd></div>{/if}
    </dl>
    <nav class="board-links">
      <a href={match.faceitUrl} target="_blank" rel="noreferrer">Match room</a>
      {#if match.demoUrl}<a href={match.demoUrl} target="_blank" rel="noreferrer">Demo</a>{/if}
    </nav>
  </header>

  {#if probability}
    <div class="odds" aria-label="FACEIT win probability">
      <span class="odds-label">{teamLabel(teams[0])} {probability[0]}%</span>
      <div class="odds-bar">
        <span style:width="{probability[0]}%"></span>
      </div>
      <span class="odds-label right">{probability[1]}% {teamLabel(teams[1])}</span>
    </div>
  {/if}

  <div class="scroll">
    <table class="roster">
      <thead>
        {#if finished}
          <tr>
            <th class="player-col">Player</th>
            <th>K</th><th>D</th><th>A</th><th>+/–</th><th>K/D</th><th>K/R</th><th>ADR</th>
            <th>HS</th><th>MVP</th><th title="First kills">FK</th>
            <th title="Opening duels won / taken">Entry</th>
            <th title="1v1 and 1v2 clutches won / played">Clutch</th>
            <th>3K</th><th>4K</th><th>5K</th>
            <th title="Utility damage">Util</th>
            <th title="Enemies flashed">Flashed</th>
            <th title="Sniper kills">AWP</th>
          </tr>
        {:else}
          <tr class="group-row">
            <th class="player-col" rowspan="2">Player</th>
            <th rowspan="2">ELO</th>
            <th colspan="9" class="group">Lifetime</th>
            <th colspan="3" class="group">{match.map?.name ?? 'This map'}</th>
          </tr>
          <tr>
            <th>Matches</th><th>Win</th><th>K/D</th><th>ADR</th><th>HS</th>
            <th title="Opening duels won">Entry</th>
            <th title="1v1 clutches won">1v1</th>
            <th title="Current win streak">Streak</th>
            <th class="results-col">Last 5</th>
            <th>Matches</th><th>Win</th><th>K/D</th>
          </tr>
        {/if}
      </thead>
      {#each teams as team (team.factionId)}
        <tbody class:ours={team.tracked}>
          <tr class="team-row">
            <th colspan={finished ? 19 : 14} scope="colgroup">
              <span class="team-name">{teamLabel(team)}</span>
              {#if team.averageElo}<span class="team-meta">{team.averageElo.toLocaleString('en-GB')} avg ELO</span>{/if}
              {#if finished && team.score !== null}<span class="team-meta">{team.won ? 'Won' : 'Lost'}</span>{/if}
            </th>
          </tr>
          {#each team.players as player (player.playerId)}
            {@const line = player.scoreline}
            <tr class:tracked={player.isOwner || player.isFriend}>
              <th class="player-col" scope="row">
                <span class="player">
                  <Avatar src={player.avatar} name={player.nickname} size={24} />
                  <Level level={player.skillLevel} />
                  <a href={player.faceitUrl} target="_blank" rel="noreferrer">{player.displayName}</a>
                  {#if player.isLeader}<span class="captain" title="Captain">C</span>{/if}
                  {#if finished && player.allStats.length}
                    <button
                      class="more"
                      type="button"
                      aria-expanded={Boolean(openRows[player.playerId])}
                      onclick={() => toggle(player.playerId)}
                    >
                      {openRows[player.playerId] ? 'Less' : 'All stats'}
                    </button>
                  {/if}
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
                  <td>{line.headshots}%</td>
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
                  <td colspan="18" class="empty">No stats from FACEIT</td>
                {/if}
              {:else}
                {@const life = player.lifetime}
                {@const map = player.onMap}
                <td>{player.elo ? player.elo.toLocaleString('en-GB') : '–'}</td>
                {#if life}
                  <td>{life.matches.toLocaleString('en-GB')}</td>
                  <td>{percentText(life.winRate)}</td>
                  <td>{life.kd.toFixed(2)}</td>
                  <td>{life.adr.toFixed(1)}</td>
                  <td>{percentText(life.headshots)}</td>
                  <td>{percentText(life.entrySuccess)}</td>
                  <td>{percentText(life.clutch1v1)}</td>
                  <td>{life.currentStreak}</td>
                  <td class="results-col">
                    <span class="results" aria-label="Last results {life.recentResults.join(' ')}">
                      {#each life.recentResults as result}<i class:win={result === 'W'}></i>{/each}
                    </span>
                  </td>
                {:else}
                  <td colspan="9" class="empty">No lifetime record</td>
                {/if}
                {#if map}
                  <td class:thin={map.matches < 5}>{map.matches}</td>
                  <td class:thin={map.matches < 5}>{percentText(map.winRate)}</td>
                  <td class:thin={map.matches < 5}>{map.kd.toFixed(2)}</td>
                {:else}
                  <td colspan="3" class="empty">–</td>
                {/if}
              {/if}
            </tr>
            {#if finished && openRows[player.playerId]}
              <tr class="all-stats">
                <td colspan="19">
                  <dl>
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
</article>
