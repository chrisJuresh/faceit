<script lang="ts">
  import { fixed, thousands } from '$lib/format';
  import { sides, teamName } from '$lib/match-board';
  import type { LiveMatch } from '$lib/types';
  import Avatar from './Avatar.svelte';
  import Elo from './Elo.svelte';
  import ResultStrip from './ResultStrip.svelte';

  /** Both teams before and during a match: each player's lifetime record and their record on this map. */
  let { match }: { match: LiveMatch } = $props();

  const teams = $derived(sides(match).teams);
  /** Until the map vote ends there is no map, so no on-map record to show. */
  const mapHead = $derived(match.map ? `On ${match.map.name}` : 'On map');
  const COLUMNS = 17;
</script>

<div class="scroll">
  <table class="tbl roster">
    <thead>
      <tr class="groups">
        <th class="stick"></th>
        <th></th>
        <th colspan="9" class="group gs">Lifetime</th>
        <th colspan="6" class="group gs">{mapHead}</th>
      </tr>
      <tr class="cols">
        <th class="l stick" scope="col">Player</th>
        <th scope="col">ELO</th>
        <th scope="col" class="gs">M</th>
        <th scope="col">Win %</th>
        <th scope="col">K/D</th>
        <th scope="col">ADR</th>
        <th scope="col">HS %</th>
        <th scope="col" title="Opening duels won">Entry success %</th>
        <th scope="col" title="1v1 clutches won">1v1 %</th>
        <th scope="col" title="Current win streak">Streak</th>
        <th scope="col" title="Last 5 results, oldest to latest">Last 5</th>
        <th scope="col" class="gs">M</th>
        <th scope="col">Win %</th>
        <th scope="col">K/D</th>
        <th scope="col">K/R</th>
        <th scope="col">ADR</th>
        <th scope="col">HS %</th>
      </tr>
    </thead>
    {#each teams as team (team.factionId)}
      <tbody>
        <tr class="team">
          <th colspan={COLUMNS} scope="colgroup" class="l">
            <span class="team-label">
              {teamName(team)}
              <span class="team-sub">
                avg ELO <span class="mono">{team.averageElo ? thousands(team.averageElo) : '—'}</span>{#if team.winProbability !== null}{' · '}<span class="mono"
                    >{team.winProbability}%</span
                  > win probability{/if}
              </span>
            </span>
          </th>
        </tr>
        {#each [...team.players].sort((a, b) => b.elo - a.elo) as player (player.playerId)}
          {@const life = player.lifetime}
          {@const map = player.onMap}
          {@const fewOnMap = !map || map.matches < 10}
          <tr>
            <th class="l stick" scope="row">
              <span class="who">
                <Avatar src={player.avatar} name={player.displayName} />
                <a
                  class="name"
                  class:other={!player.isOwner && !player.isFriend}
                  href={player.faceitUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={player.displayName}>{player.displayName}</a
                >
                {#if player.country}<span class="cc">{player.country}</span>{/if}
              </span>
            </th>
            <td><Elo elo={player.elo} level={player.skillLevel} /></td>
            {#if life}
              <td class="gs">{thousands(life.matches)}</td>
              <td>{fixed(life.winRate)}</td>
              <td class:pos={life.kd >= 1} class:neg={life.kd < 1}>{fixed(life.kd, 2)}</td>
              <td>{fixed(life.adr, 1)}</td>
              <td>{fixed(life.headshots)}</td>
              <td>{fixed(life.entrySuccess)}</td>
              <td>{fixed(life.clutch1v1)}</td>
              <td class:low={!life.currentStreak}>{life.currentStreak}</td>
              <td><ResultStrip results={life.recentResults.map((result) => result === 'W')} /></td>
            {:else}
              <td colspan="9" class="l gs muted">No lifetime record</td>
            {/if}
            {#if !match.map}
              <td class="gs low">—</td>
              {#each { length: 5 }, index (index)}<td class="low">—</td>{/each}
            {:else if map}
              <td class="gs" class:low={fewOnMap}>{map.matches}</td>
              <td class:low={fewOnMap}>{fixed(map.winRate)}</td>
              <td class:low={fewOnMap} class:pos={map.kd >= 1} class:neg={map.kd < 1}>{fixed(map.kd, 2)}</td>
              <td class:low={fewOnMap}>{fixed(map.kr, 2)}</td>
              <td class:low={fewOnMap}>{fixed(map.adr, 1)}</td>
              <td class:low={fewOnMap}>{fixed(map.headshots)}</td>
            {:else}
              <td colspan="6" class="l gs muted">Not played</td>
            {/if}
          </tr>
        {/each}
      </tbody>
    {/each}
  </table>
</div>

<style>
  .who a {
    color: inherit;
    text-decoration: none;
  }

  .who a:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  td.muted {
    color: var(--muted);
    font-size: 12px;
  }
</style>
