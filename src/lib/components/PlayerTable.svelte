<script lang="ts">
  import {
    DUELS,
    ELO,
    OVERVIEW,
    SCOPES,
    allColumns,
    formatValue,
    isActive,
    sortPlayers,
    type Column,
    type Scope,
    type View
  } from '$lib/columns';
  import { timeAgo } from '$lib/format';
  import type { SquadPlayer } from '$lib/types';
  import Level from './Level.svelte';
  import PlayerDetail from './PlayerDetail.svelte';

  let {
    players,
    now,
    isOwner = false,
    liveIds = new Set<string>()
  }: { players: SquadPlayer[]; now: number; isOwner?: boolean; liveIds?: Set<string> } = $props();

  let view = $state<View>('overview');
  let chosenScope = $state<Scope>('last30');
  let showAll = $state(false);
  let sortKey = $state('elo');
  let direction = $state<'asc' | 'desc'>('desc');
  let openId = $state<string | null>(null);

  // Duel and utility numbers only exist in FACEIT's lifetime record.
  const scope = $derived<Scope>(view === 'duels' ? 'lifetime' : chosenScope);
  const groups = $derived(view === 'duels' ? DUELS : OVERVIEW);
  const columns = $derived(allColumns(groups));
  const activeCount = $derived(players.filter(isActive).length);
  const visible = $derived(showAll ? players : players.filter(isActive));
  const sortColumn = $derived(columns.find((column) => column.key === sortKey) ?? ELO);
  const rows = $derived(sortPlayers(visible, sortColumn, scope, direction));
  const span = $derived(columns.length + (view === 'overview' ? 3 : 1));

  function sortBy(column: Column) {
    if (sortKey === column.key) direction = direction === 'desc' ? 'asc' : 'desc';
    else {
      sortKey = column.key;
      direction = column.descending ? 'desc' : 'asc';
    }
  }

  function setView(next: View) {
    view = next;
    if (!allColumns(next === 'duels' ? DUELS : OVERVIEW).some((column) => column.key === sortKey)) {
      sortKey = 'elo';
      direction = 'desc';
    }
  }

  /** Fewer matches than the scope asks for: still shown, but quieter. */
  function isLow(player: SquadPlayer) {
    if (scope === 'lifetime') return (player.lifetime?.matches ?? 0) < 20;
    const wanted = scope === 'last10' ? 10 : scope === 'last30' ? 30 : 100;
    return (player.form[scope]?.matches ?? 0) < Math.min(wanted, 10);
  }
</script>

<div class="section-head">
  <h2>Players</h2>
</div>

<div class="controls">
  <div class="seg" role="group" aria-label="Columns">
    <button type="button" aria-pressed={view === 'overview'} onclick={() => setView('overview')}>Overview</button>
    <button type="button" aria-pressed={view === 'duels'} onclick={() => setView('duels')}>Duels &amp; utility</button>
  </div>
  <div class="seg" role="group" aria-label="Matches counted">
    {#if view === 'duels'}
      <button type="button" aria-pressed="true" disabled>Lifetime</button>
    {:else}
      {#each SCOPES as option (option.key)}
        <button type="button" aria-pressed={chosenScope === option.key} onclick={() => (chosenScope = option.key)}>
          {option.label}
        </button>
      {/each}
    {/if}
  </div>
  <div class="seg push" role="group" aria-label="Players shown">
    <button type="button" aria-pressed={!showAll} onclick={() => (showAll = false)}>
      Active<span class="count">{activeCount}</span>
    </button>
    <button type="button" aria-pressed={showAll} onclick={() => (showAll = true)}>
      Everyone<span class="count">{players.length}</span>
    </button>
  </div>
</div>

<div class="scroll">
  <table class="tbl players">
    <thead>
      <tr class="groups">
        <th class="stick"></th>
        <th></th>
        {#each groups as group (group.label)}
          <th colspan={group.columns.length} class="group"><span>{group.label}</span></th>
        {/each}
        {#if view === 'overview'}<th></th><th></th>{/if}
      </tr>
      <tr>
        <th class="l stick" scope="col">Player</th>
        {#each columns as column (column.key)}
          <th
            scope="col"
            class:on={sortKey === column.key}
            class:first={groups.some((group) => group.columns[0] === column)}
            aria-sort={sortKey === column.key ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
          >
            <button type="button" title={column.title} onclick={() => sortBy(column)}>
              {#if sortKey === column.key}<span class="arrow" aria-hidden="true">{direction === 'asc' ? '▲' : '▼'}</span>{/if}{column.label}
            </button>
          </th>
        {/each}
        {#if view === 'overview'}
          <th class="l first" scope="col">Last 10</th>
          <th scope="col">Last match</th>
        {/if}
      </tr>
    </thead>
    <tbody>
      {#each rows as player (player.playerId)}
        {@const open = openId === player.playerId}
        {@const low = isLow(player)}
        <tr class="row" class:open class:low>
          <th class="l stick" scope="row">
            <button
              type="button"
              class="who"
              aria-expanded={open}
              onclick={() => (openId = open ? null : player.playerId)}
            >
              <svg class="chev" viewBox="0 0 10 10" aria-hidden="true"><path d="M3 1.5 6.5 5 3 8.5" /></svg>
              <Level level={player.level} elo={player.elo} />
              <span class="name">{player.displayName}</span>
              {#if player.country}<span class="cc">{player.country}</span>{/if}
              {#if liveIds.has(player.playerId)}<span class="in-match">in match</span>{/if}
            </button>
          </th>
          {#each columns as column (column.key)}
            {@const value = column.value(player, scope)}
            {@const sample = column.sample?.(player)}
            <td
              class:on={sortKey === column.key}
              class:first={groups.some((group) => group.columns[0] === column)}
              class:dim={sample !== undefined && sample !== null && sample < 10}
            >
              {column.text?.(player, scope) ?? formatValue(column, value)}{#if sample !== undefined && sample !== null}<span class="n"> {sample}</span>{/if}
            </td>
          {/each}
          {#if view === 'overview'}
            <td class="l first">
              <span class="results" aria-label="Last {Math.min(10, player.recent.length)} results">
                {#each player.recent.slice(0, 10) as match, index (index)}<i class:win={match.won}></i>{/each}
              </span>
            </td>
            <td class="last">{player.lastMatchAt ? timeAgo(player.lastMatchAt, now) : '—'}</td>
          {/if}
        </tr>
        {#if open}
          <tr class="detail">
            <td colspan={span}>
              <PlayerDetail {player} {now} {isOwner} />
            </td>
          </tr>
        {/if}
      {/each}
    </tbody>
  </table>
</div>

<style>
  .seg button:disabled {
    cursor: default;
  }

  .players th button {
    background: none;
    border: 0;
    color: inherit;
    cursor: pointer;
    font: inherit;
    padding: 0;
  }

  .players thead th button:hover {
    color: var(--ink);
  }

  .players thead th.on {
    color: var(--ink);
    font-weight: 600;
  }

  .arrow {
    font-size: 9px;
    margin-right: 3px;
    vertical-align: 1px;
  }

  .players .first {
    padding-left: 18px;
  }

  .groups .group {
    padding-left: 18px;
  }

  .players td.on {
    background: var(--band);
  }

  .row:hover > *,
  .row:hover > td.on {
    background: var(--hover);
  }

  .row.open > * {
    border-bottom-color: transparent;
  }

  .who {
    align-items: center;
    display: inline-flex;
    gap: 8px;
  }

  .name {
    font-weight: 500;
  }

  .cc {
    color: var(--muted);
    font-size: 11px;
  }

  .in-match {
    color: var(--accent);
    font-size: 11px;
    font-weight: 600;
  }

  .chev {
    fill: none;
    flex: none;
    height: 10px;
    stroke: var(--muted);
    stroke-width: 1.5;
    transition: transform 0.15s ease;
    width: 10px;
  }

  [aria-expanded='true'] > .chev {
    transform: rotate(90deg);
  }

  .n {
    color: var(--muted);
    font-size: 11px;
  }

  .dim {
    color: var(--muted);
  }

  .last {
    color: var(--ink-2);
  }

  .detail > td {
    background: var(--page);
    border-bottom: 1px solid var(--ink);
    padding: 0;
    text-align: left;
    white-space: normal;
  }

  @media (prefers-reduced-motion: reduce) {
    .chev {
      transition: none;
    }
  }
</style>
