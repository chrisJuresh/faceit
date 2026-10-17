<script lang="ts">
  import {
    ELO,
    SCOPES,
    allColumns,
    columnGroups,
    formatValue,
    isLowSample,
    sortByName,
    sortPlayers,
    type Column,
    type Scope,
    type View
  } from '$lib/columns';
  import { age, aroundOne } from '$lib/format';
  import type { SquadPlayer } from '$lib/types';
  import Avatar from './Avatar.svelte';
  import Chevron from './Chevron.svelte';
  import Divider from './Divider.svelte';
  import Elo from './Elo.svelte';
  import type { FormMetric } from './FormChart.svelte';
  import PlayerDetail from './PlayerDetail.svelte';
  import ResultStrip from './ResultStrip.svelte';

  let {
    players,
    now,
    isOwner = false,
    liveIds = new Set<string>()
  }: { players: SquadPlayer[]; now: number; isOwner?: boolean; liveIds?: Set<string> } = $props();

  let view = $state<View>('core');
  let chosenScope = $state<Scope>('last30');
  let sortKey = $state('elo');
  let direction = $state<'asc' | 'desc'>('desc');
  let openId = $state<string | null>(null);
  /** The detail chart's metric, kept when another player is opened. */
  let formMetric = $state<FormMetric>('adr');

  // Duel and utility numbers only exist in FACEIT's lifetime record.
  const scope = $derived<Scope>(view === 'duels' ? 'lifetime' : chosenScope);
  const groups = $derived(columnGroups(view, scope));
  const columns = $derived(allColumns(groups));
  /** Column keys that start a group, for the wider gap in front of them. */
  const starts = $derived(new Set(groups.map((group) => group.columns[0].key)));
  /** The chosen sort, or ELO when the chosen column isn't in this view. */
  const sorting = $derived(
    sortKey === 'name' || columns.some((column) => column.key === sortKey && !column.strip)
      ? { key: sortKey, direction }
      : { key: 'elo', direction: 'desc' as const }
  );
  const rows = $derived.by(() => {
    if (sorting.key === 'name') return sortByName(players, sorting.direction);
    const column = columns.find((entry) => entry.key === sorting.key) ?? ELO;
    return sortPlayers(players, column, scope, sorting.direction);
  });

  function sortBy(key: string) {
    if (sorting.key === key) direction = sorting.direction === 'desc' ? 'asc' : 'desc';
    else direction = key === 'name' ? 'asc' : 'desc';
    sortKey = key;
  }

  const ariaSort = (key: string) =>
    sorting.key === key ? (sorting.direction === 'asc' ? 'ascending' : 'descending') : undefined;

  function cellText(column: Column, player: SquadPlayer) {
    const value = column.value(player, scope);
    if (column.age) return age(value, now);
    return column.text?.(player, scope) ?? formatValue(column, value);
  }

  function muted(column: Column, player: SquadPlayer) {
    if (column.isSample) return true;
    const value = column.value(player, scope);
    if (column.quietZero && value === 0) return true;
    const sample = column.sample?.(player);
    return sample !== undefined && sample !== null && sample < 10;
  }

  const tone = (column: Column, player: SquadPlayer) =>
    column.aroundOne ? aroundOne(column.value(player, scope), column.digits) : '';

  const toggle = (player: SquadPlayer) => (openId = openId === player.playerId ? null : player.playerId);
</script>

<div class="section-head">
  <h2>Players</h2>
  <div class="controls">
    <div class="seg" role="group" aria-label="Matches counted">
      {#each SCOPES as option (option.key)}
        <button
          type="button"
          aria-pressed={scope === option.key}
          disabled={view === 'duels' && option.key !== 'lifetime'}
          onclick={() => (chosenScope = option.key)}>{option.label}</button
        >
      {/each}
    </div>
    <Divider />
    <div class="seg" role="group" aria-label="Columns">
      <button type="button" aria-pressed={view === 'core'} onclick={() => (view = 'core')}>Core</button>
      <button type="button" aria-pressed={view === 'duels'} onclick={() => (view = 'duels')}>Duels &amp; utility</button>
    </div>
  </div>
</div>

{#if rows.length}
  <div class="scroll">
    <table class="tbl players">
      <thead>
        <tr class="groups">
          <th class="stick"></th>
          <th></th>
          {#each groups as group (group.label)}
            <th colspan={group.columns.length} class="group gs">{group.label}</th>
          {/each}
        </tr>
        <tr class="cols">
          <th class="l stick" class:sorted={sorting.key === 'name'} scope="col" aria-sort={ariaSort('name')}>
            <button type="button" class="sort" onclick={() => sortBy('name')}>
              Player{#if sorting.key === 'name'}<span class="arrow after" aria-hidden="true">{sorting.direction === 'asc' ? '▲' : '▼'}</span>{/if}
            </button>
          </th>
          {#each columns as column (column.key)}
            <th
              scope="col"
              class:gs={starts.has(column.key)}
              class:sorted={sorting.key === column.key}
              aria-sort={column.strip ? undefined : ariaSort(column.key)}
              title={column.title}
            >
              {#if column.strip}
                {column.label}
              {:else}
                <button type="button" class="sort" onclick={() => sortBy(column.key)}>
                  <span class="arrow" aria-hidden="true">{sorting.key === column.key ? (sorting.direction === 'asc' ? '▲' : '▼') : ''}</span>{column.label}
                </button>
              {/if}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each rows as player (player.playerId)}
          {@const open = openId === player.playerId}
          <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions -->
          <tr class="row" class:open class:low={isLowSample(player, view, scope)} onclick={() => toggle(player)}>
            <th class="l stick" scope="row">
              <span class="who">
                <Avatar src={player.avatar} name={player.displayName} />
                <button
                  type="button"
                  class="name"
                  aria-expanded={open}
                  onclick={(event) => {
                    event.stopPropagation();
                    toggle(player);
                  }}
                  title={player.displayName}><span>{player.displayName}</span></button
                >
                {#if player.country}<span class="cc">{player.country}</span>{/if}
                {#if liveIds.has(player.playerId)}<span class="in-match" title="In a match"><span class="sr-only">In a match</span></span>{/if}
                <span class="push"><Chevron /></span>
              </span>
            </th>
            {#each columns as column (column.key)}
              {#if column.key === 'elo'}
                <td class:sorted={sorting.key === 'elo'}>
                  <Elo elo={player.elo} level={player.level} />
                </td>
              {:else if column.strip}
                <td class="gs">
                  <ResultStrip results={player.recent.slice(0, 10).reverse().map((match) => match.won)} />
                </td>
              {:else}
                <td
                  class={tone(column, player)}
                  class:gs={starts.has(column.key)}
                  class:sorted={sorting.key === column.key}
                  class:low={muted(column, player)}
                >
                  {cellText(column, player)}
                </td>
              {/if}
            {/each}
          </tr>
          {#if open}
            <tr class="detail">
              <td colspan={columns.length + 1}>
                <div class="pin">
                  <PlayerDetail {player} {now} {isOwner} bind:metric={formMetric} />
                </div>
              </td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </div>
{:else}
  <p class="none">No players</p>
{/if}

<style>
  .players button.name {
    background: none;
    border: 0;
    cursor: pointer;
    padding: 0;
    text-align: left;
  }

  .arrow.after {
    margin: 0 0 0 4px;
  }

  .in-match {
    background: var(--accent);
    border-radius: 50%;
    flex: none;
    height: 8px;
    width: 8px;
  }

  .players tr.low td.pos,
  .players tr.low td.neg {
    color: var(--muted);
  }

  td.muted {
    color: var(--muted);
  }
</style>
