<script lang="ts">
  import {
    LIFETIME_ONLY,
    MATCH_ONLY,
    PERFORMANCE,
    SCOPES,
    formatValue,
    isActive,
    sortPlayers,
    type Column,
    type Scope
  } from '$lib/columns';
  import { timeAgo } from '$lib/format';
  import type { SquadPlayer } from '$lib/types';
  import Avatar from './Avatar.svelte';
  import Level from './Level.svelte';
  import PlayerDetail from './PlayerDetail.svelte';

  let {
    players,
    now,
    isOwner = false
  }: { players: SquadPlayer[]; now: number; isOwner?: boolean } = $props();

  const ELO: Column = {
    key: 'elo',
    label: 'ELO',
    title: 'FACEIT ELO',
    digits: 0,
    descending: true,
    value: (player) => player.elo || null
  };
  const PLAYED: Column = {
    key: 'played30',
    label: '30 days',
    title: 'Matches in the last 30 days',
    digits: 0,
    descending: true,
    value: (player) => player.played.days30
  };

  let scope = $state<Scope>('last30');
  let showAll = $state(false);
  let sortKey = $state('elo');
  let direction = $state<'asc' | 'desc'>('desc');
  let openId = $state<string | null>(null);

  const extra = $derived(scope === 'lifetime' ? LIFETIME_ONLY : MATCH_ONLY);
  const columns = $derived([ELO, PLAYED, ...PERFORMANCE, ...extra]);
  const activeCount = $derived(players.filter(isActive).length);
  const visible = $derived(showAll ? players : players.filter(isActive));
  const sortColumn = $derived(columns.find((column) => column.key === sortKey) ?? ELO);
  const rows = $derived(sortPlayers(visible, sortColumn, scope, direction));

  /** Best value per column among visible players, for a quiet emphasis. */
  const best = $derived.by(() => {
    const result: Record<string, number> = {};
    for (const column of columns) {
      if (column === ELO || column === PLAYED) continue;
      const values = visible
        .map((player) => column.value(player, scope))
        .filter((value): value is number => value !== null);
      if (values.length > 1) result[column.key] = column.descending ? Math.max(...values) : Math.min(...values);
    }
    return result;
  });

  function sortBy(column: Column) {
    if (sortKey === column.key) direction = direction === 'desc' ? 'asc' : 'desc';
    else {
      sortKey = column.key;
      direction = column.descending ? 'desc' : 'asc';
    }
  }

  function setScope(next: Scope) {
    scope = next;
    if (!columns.some((column) => column.key === sortKey)) {
      sortKey = 'elo';
      direction = 'desc';
    }
  }

  const sampleSize = (player: SquadPlayer) =>
    scope === 'lifetime' ? (player.lifetime?.matches ?? 0) : (player.form[scope]?.matches ?? 0);
  const wanted = $derived(scope === 'last10' ? 10 : scope === 'last30' ? 30 : scope === 'last100' ? 100 : 0);
</script>

<div class="controls">
  <div class="segmented" role="group" aria-label="Matches counted">
    {#each SCOPES as option (option.key)}
      <button type="button" aria-pressed={scope === option.key} onclick={() => setScope(option.key)}>
        {option.label}
      </button>
    {/each}
  </div>
  <label class="toggle">
    <input type="checkbox" bind:checked={showAll} />
    Include inactive ({players.length - activeCount})
  </label>
</div>

<div class="scroll">
  <table class="players">
    <thead>
      <tr>
        <th class="player-col" scope="col">Player</th>
        <th scope="col" class="form-col">Last 10</th>
        {#each columns as column (column.key)}
          <th
            scope="col"
            aria-sort={sortKey === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
          >
            <button type="button" title={column.title} onclick={() => sortBy(column)}>
              {column.label}{#if sortKey === column.key}<span class="arrow" aria-hidden="true">{direction === 'asc' ? '↑' : '↓'}</span>{/if}
            </button>
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#each rows as player (player.playerId)}
        {@const open = openId === player.playerId}
        <tr class:open class:inactive={!isActive(player)}>
          <th class="player-col" scope="row">
            <button
              type="button"
              class="player"
              aria-expanded={open}
              onclick={() => (openId = open ? null : player.playerId)}
            >
              <Avatar src={player.avatar} name={player.nickname} size={28} />
              <span class="names">
                <span class="name">{player.displayName}</span>
                <span class="sub">
                  {#if player.alias}{player.nickname} · {/if}{player.lastMatchAt ? timeAgo(player.lastMatchAt, now) : 'No recent matches'}
                </span>
              </span>
              <Level level={player.level} />
            </button>
          </th>
          <td class="form-col">
            <span class="results" aria-label="Last results">
              {#each player.recent.slice(0, 10) as match (match.matchId)}<i class:win={match.won}></i>{/each}
            </span>
          </td>
          {#each columns as column (column.key)}
            {@const value = column.value(player, scope)}
            <td
              class:best={value !== null && best[column.key] === value}
              class:sorted={sortKey === column.key}
              class:thin={column !== ELO && column !== PLAYED && wanted > 0 && sampleSize(player) < Math.min(wanted, 10)}
            >
              {formatValue(column, value)}
            </td>
          {/each}
        </tr>
        {#if open}
          <tr class="detail-row">
            <td colspan={columns.length + 2}>
              <PlayerDetail {player} {now} {isOwner} />
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>
