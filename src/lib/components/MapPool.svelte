<script lang="ts">
  import { fixed, thousands } from '$lib/format';
  import { togetherMaps } from '$lib/stats';
  import { readout } from '$lib/tooltip.svelte';
  import type { GroupLineup, MapStats, SquadPlayer, TogetherMap } from '$lib/types';
  import { SvelteSet } from 'svelte/reactivity';
  import Avatar from './Avatar.svelte';
  import MapImage from './MapImage.svelte';

  /**
   * Each player's lifetime record per map, with the group's record on top: games where two or
   * more of the ticked players were on the same team, over the last `windowDays` days.
   */
  let {
    players,
    lineups,
    mapImages,
    windowDays
  }: {
    players: SquadPlayer[];
    lineups: GroupLineup[];
    mapImages: Record<string, string>;
    windowDays: number;
  } = $props();

  type Metric = 'winRate' | 'kd';
  /** Lifetime cells with fewer matches than this stay uncoloured; the Together row uses its own. */
  const FEW = 10;
  const FEW_TOGETHER = 5;

  let metric = $state<Metric>('winRate');
  const leftOut = new SvelteSet<string>();

  /** Only players who played a group game in the window can be ticked or unticked. */
  const eligible = $derived(new Set(lineups.flatMap((game) => game.lines.map((line) => line.playerId))));
  const chosen = $derived(new Set([...eligible].filter((id) => !leftOut.has(id))));
  const together = $derived(togetherMaps(lineups, chosen));
  // Columns follow the whole group's record, so unticking never adds or removes one.
  const everyone = $derived(togetherMaps(lineups, eligible));
  const leftOutCount = $derived([...leftOut].filter((id) => eligible.has(id)).length);

  const rows = $derived(
    [...players].filter((player) => player.maps.length || eligible.has(player.playerId)).sort((a, b) => b.elo - a.elo)
  );

  // Maps the shown players have played at least 10 times between them, most played first, then
  // any map only the group's games together reach.
  const maps = $derived.by(() => {
    const totals = new Map<string, { matches: number; image: string }>();
    for (const player of rows) {
      for (const record of player.maps) {
        const entry = totals.get(record.map) ?? { matches: 0, image: record.image || mapImages[record.map] || '' };
        entry.matches += record.matches;
        totals.set(record.map, entry);
      }
    }
    const ranked = [...totals.entries()]
      .filter(([, entry]) => entry.matches >= FEW)
      .sort((a, b) => b[1].matches - a[1].matches)
      .map(([map, entry]) => ({ map, image: entry.image }));
    const extra = [...everyone.values()]
      .filter((record) => !ranked.some((entry) => entry.map === record.map))
      .sort((a, b) => b.matches - a.matches)
      .map((record) => ({ map: record.map, image: totals.get(record.map)?.image || mapImages[record.map] || '' }));
    return [...ranked, ...extra];
  });

  const clamp = (value: number) => Math.max(-1, Math.min(1, value));
  /** Signed distance from even: 50% won, or a K/D of 1. */
  const lean = (value: number) => clamp(metric === 'winRate' ? (value - 50) / 25 : (value - 1) / 0.5);
  // Capped at 32% so the small match count stays readable on the strongest tint.
  const tint = (value: number) => {
    const amount = lean(value);
    if (Math.abs(amount) < 0.02) return undefined;
    return `color-mix(in srgb, var(${amount > 0 ? '--win' : '--loss'}) ${Math.round(Math.abs(amount) * 32)}%, var(--cell))`;
  };
  const text = (value: number) => (metric === 'winRate' ? fixed(value) : fixed(value, 2));

  const pick = (record: MapStats) => (metric === 'winRate' ? record.winRate : record.kd);
  const togetherKd = (record: TogetherMap) => (record.deaths ? record.kills / record.deaths : record.kills);
  const togetherValue = (record: TogetherMap) =>
    metric === 'winRate' ? (record.wins / record.matches) * 100 : togetherKd(record);

  const steps = $derived(metric === 'winRate' ? [30, 40, 50, 60, 70] : [0.5, 0.75, 1, 1.25, 1.5]);

  function toggle(playerId: string, event: Event) {
    const box = event.currentTarget as HTMLInputElement;
    if (leftOut.has(playerId)) leftOut.delete(playerId);
    // Together needs two people; the box is disabled at two, this is a backstop.
    else if (chosen.size <= 2) box.checked = true;
    else leftOut.add(playerId);
  }
</script>

<div class="section-head">
  <h2>Maps</h2>
  <span class="meta">Lifetime, 5v5</span>
  <div class="controls">
    <div class="seg" role="group" aria-label="Map metric">
      <button type="button" aria-pressed={metric === 'winRate'} onclick={() => (metric = 'winRate')}>Win %</button>
      <button type="button" aria-pressed={metric === 'kd'} onclick={() => (metric = 'kd')}>K/D</button>
    </div>
  </div>
</div>

{#if rows.length && maps.length}
  <div class="scroll">
    <table class="heat">
      <thead>
        <tr>
          <th class="stick"><span class="sr-only">Player</span></th>
          {#each maps as entry (entry.map)}
            <th scope="col" class="map">
              <MapImage src={entry.image} size="medium" />
              <span class="map-name" title={entry.map}>{entry.map}</span>
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#if lineups.length}
          <tr class="together">
            <th class="stick" scope="row">
              <span class="label">Together</span>
              <span class="note">
                <span class="mono">{windowDays}d</span>{#if leftOutCount}{' · '}<span class="mono">{leftOutCount}</span>
                  left out{/if}
              </span>
            </th>
            {#each maps as entry (entry.map)}
              {@const record = together.get(entry.map)}
              <td>
                {#if record}
                  {@const value = togetherValue(record)}
                  {@const few = record.matches < FEW_TOGETHER}
                  <span
                    class="cell"
                    class:few
                    style:background={few ? undefined : tint(value)}
                    {...readout(() => [
                      `Together · ${entry.map}`,
                      `${record.wins}–${record.matches - record.wins} · ${thousands(record.matches)} games`,
                      `K/D ${fixed(togetherKd(record), 2)}`
                    ])}
                  >
                    <b>{text(value)}</b><small>{thousands(record.matches)}<span class="sr-only"> games</span></small>
                  </span>
                {:else}
                  <span class="cell empty"><span aria-hidden="true">—</span><span class="sr-only">No games</span></span>
                {/if}
              </td>
            {/each}
          </tr>
        {/if}
        {#each rows as player (player.playerId)}
          {@const included = !leftOut.has(player.playerId)}
          {@const canPick = eligible.has(player.playerId)}
          <tr>
            <th class="stick" scope="row">
              <svelte:element this={canPick ? 'label' : 'span'} class="pick" class:out={canPick && !included}>
                {#if canPick}
                  <input
                    type="checkbox"
                    checked={included}
                    disabled={included && chosen.size <= 2}
                    onchange={(event) => toggle(player.playerId, event)}
                    aria-label="Count {player.displayName} in Together"
                  />
                {:else}
                  <span class="spacer" aria-hidden="true"></span>
                {/if}
                <Avatar src={player.avatar} name={player.displayName} />
                <span class="name" title={player.displayName}>{player.displayName}</span>
              </svelte:element>
            </th>
            {#each maps as entry (entry.map)}
              {@const record = player.maps.find((candidate) => candidate.map === entry.map)}
              <td>
                {#if record}
                  {@const few = record.matches < FEW}
                  <span
                    class="cell"
                    class:few
                    style:background={few ? undefined : tint(pick(record))}
                    {...readout(() => [
                      `${player.displayName} · ${entry.map}`,
                      `${thousands(record.matches)} matches · ${fixed(record.winRate)}% won`,
                      `K/D ${fixed(record.kd, 2)} · ADR ${fixed(record.adr, 1)}`
                    ])}
                  >
                    <b>{text(pick(record))}</b><small>{thousands(record.matches)}<span class="sr-only"> matches</span></small>
                  </span>
                {:else}
                  <span class="cell empty"><span aria-hidden="true">—</span><span class="sr-only">No matches</span></span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="legend below">
    <span class="key">
      <span class="mono">{metric === 'winRate' ? '30' : '0.50'}</span>
      <span class="scale" aria-hidden="true">
        {#each steps as step (step)}<i style:background={tint(step) ?? 'var(--cell)'}></i>{/each}
      </span>
      <span class="mono">{metric === 'winRate' ? '70' : '1.50'}</span>
      {metric === 'winRate' ? 'win %' : 'K/D'}
    </span>
    <span class="key">Small figure: matches</span>
    <span class="key">
      Uncoloured: under <span class="mono">{FEW}</span> matches, <span class="mono">{FEW_TOGETHER}</span> together
    </span>
  </p>
{:else}
  <p class="none">No map stats</p>
{/if}

<style>
  .heat {
    border-collapse: separate;
    border-spacing: 2px;
    margin: 0 -2px;
    white-space: nowrap;
  }

  th {
    font-weight: 400;
    padding: 0;
  }

  .stick {
    background: var(--surface);
    left: 0;
    position: sticky;
    text-align: left;
    z-index: 1;
  }

  .map {
    color: var(--ink-2);
    font: 500 11.5px var(--sans);
    padding-bottom: 4px;
    text-align: center;
    vertical-align: bottom;
  }

  .map :global(.map-img) {
    margin: 0 auto 5px;
  }

  .map-name {
    display: block;
    max-width: 56px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  td {
    padding: 0;
  }

  .cell {
    align-items: center;
    background: var(--cell);
    border-radius: 2px;
    display: flex;
    flex-direction: column;
    height: 56px;
    justify-content: center;
    line-height: 1.2;
    width: 56px;
  }

  .cell b {
    font: 500 13px var(--mono);
  }

  .cell small {
    color: var(--ink-2);
    font: 10.5px var(--mono);
  }

  .cell.few b,
  .cell.few small,
  .cell.empty {
    color: var(--muted);
  }

  .cell.few b {
    font-weight: 400;
  }

  .cell.empty {
    background: none;
    box-shadow: inset 0 0 0 1px var(--rule);
  }

  .together th,
  .together td {
    padding-bottom: 8px;
  }

  .together .label {
    display: block;
    font-size: 13px;
    font-weight: 500;
  }

  .note {
    color: var(--muted);
    display: block;
    font-size: 11.5px;
  }

  .pick {
    align-items: center;
    display: flex;
    gap: 8px;
    padding-right: 14px;
  }

  label.pick {
    cursor: pointer;
  }

  .pick input,
  .spacer {
    flex: none;
    height: 13px;
    margin: 0;
    width: 13px;
  }

  .pick input {
    accent-color: var(--accent);
    cursor: pointer;
  }

  .pick input:disabled {
    cursor: default;
  }

  .name {
    font-size: 13px;
    font-weight: 500;
    max-width: 135px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pick.out .name {
    color: var(--muted);
  }

  .scale {
    display: inline-flex;
    gap: 2px;
    margin: 0 4px;
  }

  .scale i {
    border-radius: 1px;
    display: block;
    height: 8px;
    width: 8px;
  }

  @media (max-width: 640px) {
    .stick {
      box-shadow: inset -1px 0 var(--rule);
    }

    .pick {
      padding-right: 8px;
    }

    .name {
      max-width: 91px;
    }
  }
</style>
