<script lang="ts">
  import { enhance } from '$app/forms';
  import { age, dateTime, fixed, headshotRate, kd, monthYear, roomUrl, score, thousands, timeAgo } from '$lib/format';
  import { eloToNextLevel, levelForElo } from '$lib/levels';
  import type { SquadPlayer } from '$lib/types';
  import Avatar from './Avatar.svelte';
  import FormChart, { type FormMetric } from './FormChart.svelte';
  import WinTrack from './WinTrack.svelte';

  let { player, now, isOwner = false }: { player: SquadPlayer; now: number; isOwner?: boolean } =
    $props();

  const METRICS: Array<{ key: FormMetric; label: string }> = [
    { key: 'adr', label: 'ADR' },
    { key: 'kd', label: 'K/D' },
    { key: 'kills', label: 'Kills' },
    { key: 'hs', label: 'HS %' }
  ];

  let metric = $state<FormMetric>('adr');
  let allMatches = $state(false);

  const life = $derived(player.lifetime);
  const toNext = $derived(player.elo ? eloToNextLevel(player.elo) : null);
  const matches = $derived(allMatches ? player.recent : player.recent.slice(0, 10));
  const rank = (position: number | null) => (position ? `#${position.toLocaleString('en-GB')}` : 'Unranked');
</script>

<div class="detail">
  <div class="grid">
    <div class="profile">
      <div class="identity">
        <Avatar src={player.avatar} name={player.displayName} size={44} />
        <div>
          <p class="big">{player.displayName}</p>
          <p class="sub">
            {[player.country, player.region, player.level ? `level ${player.level}` : ''].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>
      <dl class="kv">
        <dt>ELO</dt>
        <dd>{player.elo ? thousands(player.elo) : '—'}</dd>
        {#if toNext !== null}
          <dt>To level {levelForElo(player.elo) + 1}</dt>
          <dd>{toNext}</dd>
        {/if}
        <dt>{player.region || 'Region'} rank</dt>
        <dd>{rank(player.regionRank)}</dd>
        {#if player.country}
          <dt>{player.country} rank</dt>
          <dd>{rank(player.countryRank)}</dd>
        {/if}
        {#if player.memberSince}
          <dt>Member since</dt>
          <dd>{monthYear(player.memberSince)}</dd>
        {/if}
        <dt>Last match</dt>
        <dd>{timeAgo(player.lastMatchAt, now)}</dd>
        {#if life}
          <dt>Lifetime matches</dt>
          <dd>{thousands(life.matches)}</dd>
          <dt>Win streak</dt>
          <dd>{life.currentStreak}<span class="muted">best {life.longestStreak}</span></dd>
        {/if}
      </dl>
      <p class="links">
        <a class="ext" href={player.faceitUrl} target="_blank" rel="noreferrer">FACEIT ↗</a>
        {#if player.steamUrl}<a class="ext" href={player.steamUrl} target="_blank" rel="noreferrer">Steam ↗</a>{/if}
      </p>
    </div>

    <div class="form">
      <div class="mini-head">
        <h4>Last {player.recent.length} matches</h4>
        {#if player.recent.length}
          <div class="seg small" role="group" aria-label="Chart metric">
            {#each METRICS as option (option.key)}
              <button type="button" aria-pressed={metric === option.key} onclick={() => (metric = option.key)}>
                {option.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
      {#if player.recent.length}
        <FormChart matches={player.recent} {metric} />
        <p class="legend">
          <span class="key"><i class="swatch win"></i>Win</span>
          <span class="key"><i class="swatch loss"></i>Loss</span>
          <span class="key"><i class="line"></i>Average</span>
        </p>
      {:else}
        <p class="none">No recent 5v5 matches</p>
      {/if}
    </div>

    <div class="maps">
      <div class="mini-head"><h4>Maps, lifetime</h4></div>
      {#if player.maps.length}
        <div class="scroll">
          <table class="mini">
            <thead>
              <tr>
                <th class="l" scope="col">Map</th>
                <th scope="col">M</th>
                <th scope="col">Win %</th>
                <th scope="col"><span class="sr-only">Win rate from 0 to 100, 50 marked</span></th>
                <th scope="col">K/D</th>
                <th scope="col">ADR</th>
                <th scope="col">HS %</th>
              </tr>
            </thead>
            <tbody>
              {#each player.maps as map (map.map)}
                <tr class:low={map.matches < 10}>
                  <td class="l">{map.map}</td>
                  <td>{map.matches}</td>
                  <td>{fixed(map.winRate)}</td>
                  <td class="l"><WinTrack rate={map.winRate} faded={map.matches < 10} /></td>
                  <td>{fixed(map.kd, 2)}</td>
                  <td>{fixed(map.adr, 1)}</td>
                  <td>{fixed(map.headshots)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {:else}
        <p class="none">No map record</p>
      {/if}
    </div>
  </div>

  {#if player.recent.length}
    <div class="matches">
      <div class="mini-head"><h4>Matches</h4></div>
      <div class="scroll">
        <table class="mini">
          <thead>
            <tr>
              <th class="l" scope="col">When</th>
              <th class="l" scope="col">Map</th>
              <th scope="col"><span class="sr-only">Result</span></th>
              <th scope="col">Score</th>
              <th scope="col">K</th>
              <th scope="col">D</th>
              <th scope="col">A</th>
              <th scope="col">K/D</th>
              <th scope="col">ADR</th>
              <th scope="col">HS %</th>
              <th scope="col">MVP</th>
              <th scope="col">2K</th>
              <th scope="col">3K</th>
              <th scope="col">4K</th>
              <th scope="col">5K</th>
              <th scope="col"><span class="sr-only">Match room</span></th>
            </tr>
          </thead>
          <tbody>
            {#each matches as match, index (index)}
              <tr>
                <td class="l muted" title={dateTime(match.finishedAt)}>{age(match.finishedAt, now)}</td>
                <td class="l">{match.map}</td>
                <td><span class="res" class:win={match.won} class:loss={!match.won}>{match.won ? 'W' : 'L'}</span></td>
                <td>{score(match.teamScore, match.enemyScore)}</td>
                <td>{match.kills}</td>
                <td>{match.deaths}</td>
                <td>{match.assists}</td>
                <td>{fixed(kd(match.kills, match.deaths), 2)}</td>
                <td>{fixed(match.adr, 1)}</td>
                <td>{headshotRate(match.headshots, match.kills)}</td>
                <td class:muted={!match.mvps}>{match.mvps}</td>
                <td class:muted={!match.doubleKills}>{match.doubleKills}</td>
                <td class:muted={!match.tripleKills}>{match.tripleKills}</td>
                <td class:muted={!match.quadroKills}>{match.quadroKills}</td>
                <td class:muted={!match.pentaKills}>{match.pentaKills}</td>
                <td>
                  <a class="ext" href={roomUrl(match.matchId)} target="_blank" rel="noreferrer" aria-label="Match room">↗</a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if player.recent.length > 10}
        <button class="text-button more" type="button" onclick={() => (allMatches = !allMatches)}>
          {allMatches ? 'Show 10' : `Show all ${player.recent.length}`}
        </button>
      {/if}
    </div>
  {/if}

  {#if isOwner}
    <form class="alias" method="POST" action="?/rename" use:enhance>
      <input type="hidden" name="playerId" value={player.playerId} />
      <label for="alias-{player.playerId}">Display name</label>
      <input id="alias-{player.playerId}" name="alias" maxlength="32" value={player.alias ?? ''} placeholder={player.nickname} />
      <button class="text-button" type="submit">Save</button>
    </form>
  {/if}
</div>

<style>
  .detail {
    padding: 20px 16px 24px;
  }

  .grid {
    display: grid;
    gap: 36px;
    grid-template-columns: minmax(230px, 3fr) minmax(0, 5fr) minmax(0, 4fr);
  }

  .identity {
    align-items: center;
    display: flex;
    gap: 12px;
    margin-bottom: 14px;
  }

  .big {
    font-size: 16px;
    font-weight: 600;
    letter-spacing: -0.01em;
  }

  .sub {
    color: var(--muted);
    font: 11.5px var(--mono);
  }

  .links {
    display: flex;
    gap: 16px;
    margin-top: 14px;
  }

  .mini-head {
    align-items: baseline;
    display: flex;
    gap: 12px;
    margin-bottom: 6px;
  }

  h4 {
    color: var(--ink-2);
    font: 600 12px/20px var(--sans);
  }

  .seg.small {
    margin-left: auto;
  }

  .seg.small button {
    font-size: 11.5px;
    padding: 3px 5px;
  }

  .legend {
    margin-top: 6px;
  }

  .mini td.muted {
    color: var(--muted);
  }

  .mini a {
    text-decoration: none;
  }

  .matches {
    margin-top: 24px;
  }

  .matches .mini {
    width: auto;
    min-width: min(100%, 720px);
  }

  .alias {
    align-items: baseline;
    border-top: 1px solid var(--rule);
    display: flex;
    flex-wrap: wrap;
    font-size: 12.5px;
    gap: 8px 12px;
    margin-top: 22px;
    padding-top: 12px;
  }

  .alias label {
    color: var(--muted);
  }

  .alias input {
    background: transparent;
    border: 0;
    border-bottom: 1px solid var(--rule-2);
    color: var(--ink);
    padding: 2px 0;
    width: 14em;
  }

  .alias input:focus {
    border-bottom-color: var(--accent);
    outline: none;
  }

  @media (max-width: 1060px) {
    .grid {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .form {
      grid-column: 1 / -1;
      grid-row: 2;
    }
  }

  @media (max-width: 640px) {
    .detail {
      padding: 16px 0 20px;
    }

    .grid {
      gap: 24px;
      grid-template-columns: minmax(0, 1fr);
    }

    .form {
      grid-row: auto;
    }
  }
</style>
