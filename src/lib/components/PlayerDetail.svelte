<script lang="ts">
  import { enhance } from '$app/forms';
  import { percentText, shortDate, thousands, timeAgo } from '$lib/format';
  import { eloToNextLevel, levelForElo } from '$lib/levels';
  import type { SquadPlayer } from '$lib/types';
  import FormChart from './FormChart.svelte';

  let { player, now, isOwner = false }: { player: SquadPlayer; now: number; isOwner?: boolean } =
    $props();

  let showAllMatches = $state(false);

  const toNext = $derived(player.elo ? eloToNextLevel(player.elo) : null);
  const matches = $derived(showAllMatches ? player.recent : player.recent.slice(0, 10));
  const roomUrl = (matchId: string) => `https://www.faceit.com/en/cs2/room/${matchId}`;
  const multi = (match: SquadPlayer['recent'][number]) =>
    [
      match.pentaKills ? `${match.pentaKills}×5K` : '',
      match.quadroKills ? `${match.quadroKills}×4K` : '',
      match.tripleKills ? `${match.tripleKills}×3K` : ''
    ]
      .filter(Boolean)
      .join(' ');
</script>

<div class="detail">
  <dl class="facts">
    <div><dt>ELO</dt><dd>{thousands(player.elo)}{#if toNext !== null}<span class="aside"> · {toNext} to level {levelForElo(player.elo) + 1}</span>{/if}</dd></div>
    <div><dt>{player.region || 'Region'} rank</dt><dd>{player.regionRank ? `#${thousands(player.regionRank)}` : 'Unranked'}</dd></div>
    {#if player.country}
      <div><dt>{player.country} rank</dt><dd>{player.countryRank ? `#${thousands(player.countryRank)}` : 'Unranked'}</dd></div>
    {/if}
    <div><dt>Played</dt><dd>{player.played.days7} · {player.played.days30} · {player.played.days90}<span class="aside"> in 7 / 30 / 90 days</span></dd></div>
    {#if player.lifetime}
      <div><dt>Streak</dt><dd>{player.lifetime.currentStreak}<span class="aside"> now · best {player.lifetime.longestStreak}</span></dd></div>
    {/if}
    {#if player.memberSince}
      <div><dt>On FACEIT since</dt><dd>{new Date(player.memberSince * 1000).getUTCFullYear()}</dd></div>
    {/if}
    <div class="links">
      <a href={player.faceitUrl} target="_blank" rel="noreferrer">FACEIT</a>
      {#if player.steamUrl}<a href={player.steamUrl} target="_blank" rel="noreferrer">Steam{#if player.steamName} ({player.steamName}){/if}</a>{/if}
    </div>
  </dl>

  {#if player.recent.length}
    <section class="block">
      <h4>ADR, last {player.recent.length} matches</h4>
      <FormChart matches={player.recent} />
    </section>
  {/if}

  {#if player.maps.length}
    <section class="block">
      <h4>Maps <span class="aside">lifetime</span></h4>
      <div class="scroll">
        <table class="mini">
          <thead>
            <tr>
              <th class="left">Map</th><th>Matches</th><th>Win</th><th>K/D</th><th>K/R</th><th>ADR</th><th>HS</th><th>Entry win</th><th>1v1</th><th>Util</th>
            </tr>
          </thead>
          <tbody>
            {#each player.maps as map (map.map)}
              <tr class:thin={map.matches < 5}>
                <th class="left" scope="row">{map.map}</th>
                <td>{map.matches}</td>
                <td>{percentText(map.winRate)}</td>
                <td>{map.kd.toFixed(2)}</td>
                <td>{map.kr.toFixed(2)}</td>
                <td>{map.adr.toFixed(1)}</td>
                <td>{percentText(map.headshots)}</td>
                <td>{percentText(map.entrySuccess)}</td>
                <td>{percentText(map.clutch1v1)}</td>
                <td>{map.utilityDamagePerRound === null ? '—' : map.utilityDamagePerRound.toFixed(1)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </section>
  {/if}

  {#if player.recent.length}
    <section class="block">
      <h4>Matches</h4>
      <div class="scroll">
        <table class="mini">
          <thead>
            <tr>
              <th class="left">When</th><th class="left">Map</th><th class="left">Result</th><th>K</th><th>D</th><th>A</th><th>ADR</th><th>HS</th><th>MVP</th><th class="left">Multi-kills</th>
            </tr>
          </thead>
          <tbody>
            {#each matches as match (match.matchId)}
              <tr>
                <td class="left" title={shortDate(match.finishedAt)}>{timeAgo(match.finishedAt, now)}</td>
                <td class="left">{match.map}</td>
                <td class="left">
                  <a class="result" class:win={match.won} href={roomUrl(match.matchId)} target="_blank" rel="noreferrer">
                    {match.won ? 'W' : 'L'}{#if match.teamScore !== null && match.enemyScore !== null} {match.teamScore}–{match.enemyScore}{/if}
                  </a>
                </td>
                <td>{match.kills}</td>
                <td>{match.deaths}</td>
                <td>{match.assists}</td>
                <td>{match.adr.toFixed(1)}</td>
                <td>{match.kills ? percentText((match.headshots / match.kills) * 100) : '—'}</td>
                <td>{match.mvps}</td>
                <td class="left">{multi(match)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
      {#if player.recent.length > 10}
        <button class="text-button" type="button" onclick={() => (showAllMatches = !showAllMatches)}>
          {showAllMatches ? 'Show fewer' : `Show all ${player.recent.length}`}
        </button>
      {/if}
    </section>
  {/if}

  {#if isOwner}
    <form class="alias" method="POST" action="?/rename" use:enhance>
      <input type="hidden" name="playerId" value={player.playerId} />
      <label>
        Display name
        <input name="alias" maxlength="32" value={player.alias ?? ''} placeholder={player.nickname} />
      </label>
      <button type="submit">Save</button>
    </form>
  {/if}
</div>
