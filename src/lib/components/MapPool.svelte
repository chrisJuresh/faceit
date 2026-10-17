<script lang="ts">
  import { fixed } from '$lib/format';
  import { togetherMaps } from '$lib/stats';
  import type { GroupLineup, MapStats, SquadPlayer } from '$lib/types';
  import { SvelteSet } from 'svelte/reactivity';
  import Avatar from './Avatar.svelte';

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

  const rows = $derived([...players].filter((player) => player.maps.length).sort((a, b) => b.elo - a.elo));
  // Everyone who played a group game counts unless unticked, including players hidden by the filter.
  const chosen = $derived(
    new Set(lineups.flatMap((game) => game.lines.map((line) => line.playerId)).filter((id) => !leftOut.has(id)))
  );
  const together = $derived(togetherMaps(lineups, chosen));

  // Maps the shown players have played at least 10 times between them, most played first.
  const maps = $derived.by(() => {
    const totals = new Map<string, { matches: number; image: string }>();
    for (const player of rows) {
      for (const record of player.maps) {
        const entry = totals.get(record.map) ?? { matches: 0, image: record.image || mapImages[record.map] || '' };
        entry.matches += record.matches;
        totals.set(record.map, entry);
      }
    }
    return [...totals.entries()]
      .filter(([, entry]) => entry.matches >= FEW)
      .sort((a, b) => b[1].matches - a[1].matches)
      .map(([map, entry]) => ({ map, image: entry.image }));
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
  const togetherValue = (record: { matches: number; wins: number; kills: number; deaths: number }) =>
    metric === 'winRate' ? (record.wins / record.matches) * 100 : record.deaths ? record.kills / record.deaths : record.kills;

  const steps = $derived(metric === 'winRate' ? [30, 40, 50, 60, 70] : [0.5, 0.75, 1, 1.25, 1.5]);

  function toggle(playerId: string) {
    if (leftOut.has(playerId)) leftOut.delete(playerId);
    else leftOut.add(playerId);
  }
</script>

<div class="section-head">
  <h2>Maps</h2>
  <span class="meta">Lifetime, 5v5 · Together: last {windowDays} days</span>
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
              {#if entry.image}<img src={entry.image} alt="" loading="lazy" />{:else}<span class="img"></span>{/if}
              {entry.map}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        <tr class="together">
          <th class="stick" scope="row">
            <span class="label">
              Together
              <span class="note">{windowDays}d{leftOut.size ? ` · ${leftOut.size} left out` : ''}</span>
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
                  title="Together on {entry.map}: {record.wins}–{record.matches - record.wins} in {record.matches} games, K/D {fixed(record.deaths ? record.kills / record.deaths : record.kills, 2)}"
                >
                  <b>{text(value)}</b><small>{record.matches}</small>
                </span>
              {:else}
                <span class="cell empty">–</span>
              {/if}
            </td>
          {/each}
        </tr>
        {#each rows as player (player.playerId)}
          {@const included = !leftOut.has(player.playerId)}
          <tr>
            <th class="stick" scope="row">
              <label class="pick" class:out={!included}>
                <input
                  type="checkbox"
                  checked={included}
                  onchange={() => toggle(player.playerId)}
                  aria-label="Count {player.displayName} in Together"
                />
                <Avatar src={player.avatar} name={player.displayName} />
                <span class="name">{player.displayName}</span>
              </label>
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
                    title="{player.displayName} on {entry.map}: {record.matches} matches, {fixed(record.winRate)}% won, K/D {fixed(record.kd, 2)}, ADR {fixed(record.adr, 1)}"
                  >
                    <b>{text(pick(record))}</b><small>{record.matches}</small>
                  </span>
                {:else}
                  <span class="cell empty">–</span>
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="legend">
    <span class="key mono">
      {metric === 'winRate' ? '30' : '0.50'}
      <span class="scale" aria-hidden="true">
        {#each steps as step (step)}<i style:background={tint(step) ?? 'var(--cell)'}></i>{/each}
      </span>
      {metric === 'winRate' ? '70 win %' : '1.50 K/D'}
    </span>
    <span class="key">Small figure: matches</span>
    <span class="key">Uncoloured: under {FEW} matches, {FEW_TOGETHER} together</span>
  </p>
{:else}
  <p class="none">No map record</p>
{/if}

<style>
  .heat {
    border-collapse: separate;
    border-spacing: 3px;
    margin: 0 -3px;
    white-space: nowrap;
  }

  th {
    font-weight: 400;
    padding: 0;
  }

  .stick {
    background: var(--page);
    left: 0;
    position: sticky;
    text-align: left;
    z-index: 1;
  }

  .map {
    color: var(--ink-2);
    font: 500 11px var(--sans);
    padding-bottom: 4px;
    text-align: center;
    vertical-align: bottom;
  }

  .map img,
  .map .img {
    background: var(--cell);
    border-radius: 2px;
    display: block;
    height: 30px;
    margin: 0 auto 5px;
    object-fit: cover;
    width: 52px;
  }

  td {
    padding: 0;
  }

  .cell {
    align-items: center;
    background: var(--cell);
    border-radius: 3px;
    display: flex;
    flex-direction: column;
    height: 52px;
    justify-content: center;
    line-height: 1.2;
    width: 52px;
  }

  .cell b {
    font: 500 13px var(--mono);
  }

  .cell small {
    color: var(--ink-2);
    font: 10px var(--mono);
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
    font-weight: 600;
  }

  .note {
    color: var(--muted);
    font: 400 11px var(--mono);
    margin-left: 6px;
  }

  .pick {
    align-items: center;
    cursor: pointer;
    display: flex;
    gap: 8px;
    padding-right: 14px;
  }

  .pick input {
    accent-color: var(--accent);
    cursor: pointer;
    height: 13px;
    margin: 0;
    width: 13px;
  }

  .name {
    color: var(--ink-2);
    font-size: 12.5px;
    max-width: 120px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .pick.out .name {
    color: var(--muted);
  }

  .legend {
    margin-top: 12px;
  }

  .scale {
    display: inline-flex;
    gap: 2px;
    margin: 0 4px;
  }

  .scale i {
    border-radius: 2px;
    display: block;
    height: 10px;
    width: 16px;
  }
</style>
