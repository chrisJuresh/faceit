<script lang="ts">
  import { enhance } from '$app/forms';
  import { age, dateTime, fixed, headshotRate, kd, monthYear, roomUrl, score, thousands } from '$lib/format';
  import { eloToNextLevel, levelForElo } from '$lib/levels';
  import type { SquadPlayer } from '$lib/types';
  import Avatar from './Avatar.svelte';
  import FormChart, { type FormMetric } from './FormChart.svelte';
  import Level from './Level.svelte';
  import WinTrack from './WinTrack.svelte';
  import type { SubmitFunction } from '@sveltejs/kit';

  let {
    player,
    now,
    isOwner = false,
    metric = $bindable('adr')
  }: { player: SquadPlayer; now: number; isOwner?: boolean; metric?: FormMetric } = $props();

  const METRICS: Array<{ key: FormMetric; label: string }> = [
    { key: 'adr', label: 'ADR' },
    { key: 'kd', label: 'K/D' },
    { key: 'kills', label: 'Kills' },
    { key: 'hs', label: 'HS %' }
  ];

  let allMatches = $state(false);
  let renameError = $state<string | null>(null);

  const life = $derived(player.lifetime);
  const toNext = $derived(player.elo ? eloToNextLevel(player.elo) : null);
  const matches = $derived(allMatches ? player.recent : player.recent.slice(0, 10));
  const rank = (position: number | null) => (position ? `#${position.toLocaleString('en-GB')}` : '—');

  const rename: SubmitFunction = () => {
    return async ({ result, update }) => {
      if (result.type === 'failure') renameError = String(result.data?.renameError ?? "Couldn't save the name");
      else if (result.type === 'error') renameError = "Couldn't save the name";
      else renameError = null;
      await update();
    };
  };
</script>

<div class="detail">
  <div class="grid">
    <div class="profile">
      <div class="identity">
        <Avatar src={player.avatar} name={player.displayName} size={44} />
        <div>
          <h3 class="big">{player.displayName}</h3>
          <p class="sub">
            {#if player.country || player.region}
              <span>{[player.country, player.region].filter(Boolean).join(' · ')}</span>
            {/if}
            <Level level={player.level} />
          </p>
        </div>
      </div>
      <dl class="kv">
        <dt>ELO</dt>
        <dd>{player.elo ? thousands(player.elo) : '—'}</dd>
        {#if toNext !== null}
          <dt>To level {levelForElo(player.elo) + 1}</dt>
          <dd>{toNext}</dd>
        {:else if player.elo}
          <dt>Level</dt>
          <dd>10</dd>
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
        <dd>{age(player.lastMatchAt, now)}</dd>
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
        <p class="legend below">
          <span class="key"><i class="swatch win"></i>Win</span>
          <span class="key"><i class="swatch loss"></i>Loss</span>
          <span class="key"><i class="line"></i>Average</span>
        </p>
      {:else}
        <p class="none">No matches</p>
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
        <p class="none">No map stats</p>
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
                <td class="l mono muted" title={dateTime(match.finishedAt)}>{age(match.finishedAt, now)}</td>
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
    <form class="alias" method="POST" action="?/rename" use:enhance={rename}>
      <input type="hidden" name="playerId" value={player.playerId} />
      <label class="field-label" for="alias-{player.playerId}">Display name</label>
      <input
        id="alias-{player.playerId}"
        class="input"
        name="alias"
        maxlength="32"
        value={player.alias ?? ''}
        placeholder={player.nickname}
      />
      <button class="text-button" type="submit">Save</button>
      {#if renameError}<p class="error">{renameError}</p>{/if}
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
    font: 600 15px/22px var(--sans);
    letter-spacing: -0.01em;
  }

  .sub {
    align-items: center;
    color: var(--muted);
    display: flex;
    font: 11.5px var(--mono);
    gap: 8px;
    margin-top: 2px;
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
    margin-bottom: 8px;
  }

  .seg.small {
    margin-left: auto;
  }

  .seg.small button {
    padding: 3px 5px;
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
    gap: 8px 12px;
    margin-top: 22px;
    padding-top: 12px;
  }

  .alias .input {
    width: 14em;
  }

  .alias .error {
    width: 100%;
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
      padding: 20px 12px 24px;
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
