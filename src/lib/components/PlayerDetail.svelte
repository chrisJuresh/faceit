<script lang="ts">
  import { enhance } from '$app/forms';
  import { dateTime, resultText, timeAgo } from '$lib/format';
  import { eloToNextLevel, levelForElo } from '$lib/levels';
  import type { SquadPlayer } from '$lib/types';
  import FormChart from './FormChart.svelte';

  let { player, now, isOwner = false }: { player: SquadPlayer; now: number; isOwner?: boolean } =
    $props();

  let allMatches = $state(false);
  let metric = $state<'adr' | 'kd'>('adr');

  const toNext = $derived(player.elo ? eloToNextLevel(player.elo) : null);
  const matches = $derived(allMatches ? player.recent : player.recent.slice(0, 10));
  const life = $derived(player.lifetime);
  const memberSince = $derived(
    player.memberSince
      ? new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
          new Date(player.memberSince * 1000)
        )
      : null
  );
  const roomUrl = (matchId: string) => `https://www.faceit.com/en/cs2/room/${matchId}`;
  const signed = (value: number) => (value > 0 ? `+${value}` : value < 0 ? `−${-value}` : '0');
</script>

<div class="detail">
  <div class="grid">
    <div>
      <dl class="facts">
        <dt>ELO</dt>
        <dd>{player.elo ? player.elo.toLocaleString('en-GB') : '—'}</dd>
        {#if toNext !== null}
          <dt>To level {levelForElo(player.elo) + 1}</dt>
          <dd>{toNext}</dd>
        {/if}
        <dt>{player.region || 'Region'} rank</dt>
        <dd>{player.regionRank ? `#${player.regionRank.toLocaleString('en-GB')}` : 'Unranked'}</dd>
        {#if player.country}
          <dt>{player.country} rank</dt>
          <dd>{player.countryRank ? `#${player.countryRank.toLocaleString('en-GB')}` : 'Unranked'}</dd>
        {/if}
        <dt>Last match</dt>
        <dd>{player.lastMatchAt ? timeAgo(player.lastMatchAt, now) : '—'}</dd>
        <dt>Played 7/30/90d</dt>
        <dd>{player.played.days7} / {player.played.days30} / {player.played.days90}</dd>
        {#if life}
          <dt>Lifetime</dt>
          <dd>{life.matches.toLocaleString('en-GB')} <span class="muted">{life.wins}–{life.matches - life.wins}</span></dd>
          <dt>Win streak</dt>
          <dd>{life.currentStreak} <span class="muted">best {life.longestStreak}</span></dd>
        {/if}
        {#if memberSince}
          <dt>On FACEIT since</dt>
          <dd>{memberSince}</dd>
        {/if}
        {#if player.steamName}
          <dt>Steam</dt>
          <dd class="clip">{player.steamName}</dd>
        {/if}
      </dl>
      <p class="links">
        <a href={player.faceitUrl} target="_blank" rel="noreferrer">FACEIT ↗</a>
        {#if player.steamUrl}<a href={player.steamUrl} target="_blank" rel="noreferrer">Steam ↗</a>{/if}
      </p>
    </div>

    <div>
      <div class="sub">
        <h4>Last {player.recent.length} matches</h4>
        {#if player.recent.length}
          <div class="seg small" role="group" aria-label="Chart metric">
            <button type="button" aria-pressed={metric === 'adr'} onclick={() => (metric = 'adr')}>ADR</button>
            <button type="button" aria-pressed={metric === 'kd'} onclick={() => (metric = 'kd')}>K/D</button>
          </div>
        {/if}
      </div>
      {#if player.recent.length}
        <FormChart matches={player.recent} {metric} />
      {:else}
        <p class="none">No recent 5v5 matches.</p>
      {/if}
    </div>

    <div>
      <div class="sub"><h4>Maps <span class="muted">lifetime</span></h4></div>
      {#if player.maps.length}
        <div class="scroll">
        <table class="tbl mini">
          <thead>
            <tr><th class="l" scope="col">Map</th><th scope="col">M</th><th scope="col">Win %</th><th scope="col">K/D</th><th scope="col">ADR</th><th scope="col">HS %</th></tr>
          </thead>
          <tbody>
            {#each player.maps as map (map.map)}
              <tr class:low={map.matches < 10}>
                <th class="l" scope="row">{map.map}</th>
                <td>{map.matches}</td>
                <td>{map.winRate.toFixed(0)}</td>
                <td>{map.kd.toFixed(2)}</td>
                <td>{map.adr.toFixed(1)}</td>
                <td>{map.headshots.toFixed(0)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        </div>
      {:else}
        <p class="none">No map record.</p>
      {/if}
    </div>
  </div>

  {#if player.recent.length}
    <div class="matches">
      <h4>Matches</h4>
      <div class="scroll">
        <table class="tbl mini">
          <thead>
            <tr>
              <th class="l" scope="col">When</th>
              <th class="l" scope="col">Map</th>
              <th class="l" scope="col">Result</th>
              <th scope="col">K</th><th scope="col">D</th><th scope="col">A</th>
              <th scope="col" title="Kills minus deaths">+/−</th>
              <th scope="col">ADR</th><th scope="col">HS %</th><th scope="col">MVPs</th>
              <th scope="col">3K</th><th scope="col">4K</th><th scope="col">5K</th>
            </tr>
          </thead>
          <tbody>
            {#each matches as match (match.matchId)}
              <tr>
                <td class="l" title={dateTime(match.finishedAt)}>{timeAgo(match.finishedAt, now)}</td>
                <td class="l">{match.map}</td>
                <td class="l">
                  <a class="res" class:win={match.won} class:loss={!match.won} href={roomUrl(match.matchId)} target="_blank" rel="noreferrer">
                    {resultText(match.won, match.teamScore, match.enemyScore)}
                  </a>
                </td>
                <td>{match.kills}</td>
                <td>{match.deaths}</td>
                <td>{match.assists}</td>
                <td class:pos={match.kills > match.deaths} class:neg={match.kills < match.deaths}>{signed(match.kills - match.deaths)}</td>
                <td>{match.adr.toFixed(1)}</td>
                <td>{match.kills ? Math.round((match.headshots / match.kills) * 100) : '—'}</td>
                <td>{match.mvps}</td>
                <td>{match.tripleKills || ''}</td>
                <td>{match.quadroKills || ''}</td>
                <td>{match.pentaKills || ''}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if player.recent.length > 10}
        <button class="link-button" type="button" onclick={() => (allMatches = !allMatches)}>
          {allMatches ? 'Show the last 10' : `Show all ${player.recent.length}`}
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
    left: 0;
    padding: 18px 0 30px;
    position: sticky;
    width: min(100%, calc(100vw - 2 * var(--gutter)));
  }

  .grid {
    display: grid;
    gap: 24px 44px;
    grid-template-columns: 230px minmax(0, 1.3fr) minmax(0, 1fr);
  }

  .facts {
    display: grid;
    font-size: 13px;
    gap: 5px 14px;
    grid-template-columns: auto 1fr;
    margin: 0;
  }

  .facts dt {
    color: var(--muted);
  }

  .facts dd {
    font-variant-numeric: tabular-nums;
    margin: 0;
    text-align: right;
  }

  .facts .muted {
    margin-left: 4px;
  }

  .clip {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .links {
    display: flex;
    font-size: 13px;
    gap: 18px;
    margin-top: 14px;
  }

  .sub {
    align-items: baseline;
    display: flex;
    gap: 12px;
    justify-content: space-between;
    margin-bottom: 4px;
  }

  h4 {
    font: 600 13px/1.3 var(--sans);
    margin-bottom: 8px;
  }

  h4 .muted {
    font-weight: 400;
    margin-left: 4px;
  }

  .seg.small {
    font-size: 12px;
    gap: 14px;
  }

  .mini {
    font-size: 12.5px;
  }

  .mini th,
  .mini td {
    padding: 5px 7px;
  }

  .matches {
    margin-top: 26px;
  }

  .matches .mini {
    min-width: min(100%, 640px);
    width: auto;
  }

  .matches .mini :is(td, th) {
    padding-left: 14px;
  }

  .matches .mini :is(td, th):first-child {
    padding-left: 0;
  }

  .alias {
    align-items: baseline;
    border-top: 1px solid var(--rule);
    display: flex;
    flex-wrap: wrap;
    font-size: 13px;
    gap: 8px 12px;
    margin-top: 24px;
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
    border-bottom-color: var(--ink);
    outline: none;
  }

  @media (max-width: 1000px) {
    .grid {
      grid-template-columns: 1fr 1fr;
    }

    .grid > :nth-child(2) {
      grid-column: 1 / -1;
      order: 3;
    }
  }

  @media (max-width: 760px) {
    .grid {
      grid-template-columns: 1fr;
    }

    .grid > :nth-child(2) {
      order: 0;
    }
  }
</style>
