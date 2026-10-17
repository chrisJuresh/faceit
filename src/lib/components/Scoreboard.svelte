<script lang="ts">
  import { fixed, signed, thousands } from '$lib/format';
  import { sides, teamName } from '$lib/match-board';
  import type { LiveMatch, LivePlayer } from '$lib/types';
  import Avatar from './Avatar.svelte';
  import Chevron from './Chevron.svelte';
  import Elo from './Elo.svelte';

  /** A finished match's stat sheet. Each player opens to every raw stat FACEIT returned. */
  let { match }: { match: LiveMatch } = $props();

  let openId = $state<string | null>(null);

  const teams = $derived(sides(match).teams);
  const COLUMNS = 20;

  const byKills = (players: LivePlayer[]) =>
    [...players].sort((a, b) => (b.scoreline?.kills ?? -1) - (a.scoreline?.kills ?? -1));
  const fraction = (wins: number, total: number) => (total ? `${wins}/${total}` : '—');
  const toggle = (player: LivePlayer) => {
    if (player.allStats.length) openId = openId === player.playerId ? null : player.playerId;
  };
</script>

<div class="scroll">
  <table class="tbl scoreboard">
    <thead>
      <tr class="groups">
        <th class="stick"></th>
        <th></th>
        <th colspan="5" class="group gs">Scoreline</th>
        <th colspan="4" class="group gs">Fragging</th>
        <th colspan="3" class="group gs">Multi-kills</th>
        <th colspan="3" class="group gs">Duels</th>
        <th colspan="2" class="group gs">Utility</th>
        <th colspan="1" class="group gs">Sniper</th>
      </tr>
      <tr class="cols">
        <th class="l stick" scope="col">Player</th>
        <th scope="col">ELO</th>
        <th scope="col" class="gs">K</th>
        <th scope="col">D</th>
        <th scope="col">A</th>
        <th scope="col" title="Kills minus deaths">±</th>
        <th scope="col">MVP</th>
        <th scope="col" class="gs">K/D</th>
        <th scope="col">K/R</th>
        <th scope="col">ADR</th>
        <th scope="col" title="Kills that were headshots">HS %</th>
        <th scope="col" class="gs">3K</th>
        <th scope="col">4K</th>
        <th scope="col">5K</th>
        <th scope="col" class="gs" title="First kills of a round">First</th>
        <th scope="col" title="Opening duels won / taken">Entry</th>
        <th scope="col" title="Clutches won / played">Clutch</th>
        <th scope="col" class="gs" title="Utility damage">Dmg</th>
        <th scope="col" title="Enemies flashed">Flashed</th>
        <th scope="col" class="gs" title="Sniper kills">Kills</th>
      </tr>
    </thead>
    {#each teams as team (team.factionId)}
      <tbody>
        <tr class="team">
          <th colspan={COLUMNS} scope="colgroup" class="l">
            <span class="team-label">
              {teamName(team)}
              <span class="team-sub">
                {#if team.score !== null}<span class="res" class:win={team.won} class:loss={!team.won}>{team.score}</span>{/if}
                {#if team.averageElo}&nbsp;· avg ELO {thousands(team.averageElo)}{/if}
              </span>
            </span>
          </th>
        </tr>
        {#each byKills(team.players) as player (player.playerId)}
          {@const line = player.scoreline}
          {@const open = openId === player.playerId}
          {@const diff = line ? line.kills - line.deaths : 0}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
          <tr class:row={player.allStats.length > 0} class:open onclick={() => toggle(player)}>
            <th class="l stick" scope="row">
              <span class="who">
                <Avatar src={player.avatar} name={player.displayName} />
                {#if player.allStats.length}
                  <button
                    type="button"
                    class="name"
                    class:other={!player.isOwner && !player.isFriend}
                    aria-expanded={open}
                    onclick={(event) => {
                      event.stopPropagation();
                      toggle(player);
                    }}>{player.displayName}</button
                  >
                  <span class="push"><Chevron /></span>
                {:else}
                  <span class="name" class:other={!player.isOwner && !player.isFriend}>{player.displayName}</span>
                {/if}
              </span>
            </th>
            <td><Elo elo={player.elo} level={player.skillLevel} /></td>
            {#if line}
              <td class="gs">{line.kills}</td>
              <td>{line.deaths}</td>
              <td>{line.assists}</td>
              <td class:pos={diff > 0} class:neg={diff < 0}>{signed(diff)}</td>
              <td class:low={!line.mvps}>{line.mvps}</td>
              <td class="gs">{fixed(line.kd, 2)}</td>
              <td>{fixed(line.kr, 2)}</td>
              <td>{fixed(line.adr, 1)}</td>
              <td>{fixed(line.headshots)}</td>
              <td class="gs" class:low={!line.tripleKills}>{line.tripleKills}</td>
              <td class:low={!line.quadroKills}>{line.quadroKills}</td>
              <td class:low={!line.pentaKills}>{line.pentaKills}</td>
              <td class="gs" class:low={!line.firstKills}>{line.firstKills}</td>
              <td>{fraction(line.entryWins, line.entryCount)}</td>
              <td>{fraction(line.clutchWins, line.clutchAttempts)}</td>
              <td class="gs" class:low={!line.utilityDamage}>{line.utilityDamage}</td>
              <td class:low={!line.enemiesFlashed}>{line.enemiesFlashed}</td>
              <td class="gs" class:low={!line.sniperKills}>{line.sniperKills}</td>
            {:else}
              <td colspan={COLUMNS - 2} class="l gs muted">FACEIT has no stats for this player</td>
            {/if}
          </tr>
          {#if open}
            <tr class="detail">
              <td colspan={COLUMNS}>
                <div class="pin">
                  <dl class="raw">
                    {#each [...player.allStats].sort((a, b) => a.label.localeCompare(b.label)) as stat (stat.label)}
                      <div><dt>{stat.label}</dt><dd>{stat.value}</dd></div>
                    {/each}
                  </dl>
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    {/each}
  </table>
</div>

<style>
  .team th {
    border-bottom: 1px solid var(--rule-2);
    font-weight: 600;
    height: 38px;
    padding-top: 10px;
  }

  tbody:first-of-type .team th {
    height: 30px;
    padding-top: 4px;
  }

  .team-label {
    display: inline-block;
    left: 7px;
    position: sticky;
  }

  .team-sub {
    color: var(--muted);
    font: 400 11.5px var(--mono);
    margin-left: 12px;
  }

  .team-sub .res {
    font-size: 11.5px;
  }

  button.name {
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .push {
    margin-left: auto;
    padding-left: 10px;
  }

  td.muted {
    color: var(--muted);
    font-size: 12px;
  }
</style>
