<script lang="ts">
  import type { MapStats, SquadPlayer } from '$lib/types';

  let {
    players,
    groupMaps,
    windowDays
  }: {
    players: SquadPlayer[];
    groupMaps: Array<{ map: string; matches: number; wins: number }>;
    windowDays: number;
  } = $props();

  type Metric = 'winRate' | 'kd' | 'adr' | 'matches';
  const METRICS: Array<{ key: Metric; label: string }> = [
    { key: 'winRate', label: 'Win %' },
    { key: 'kd', label: 'K/D' },
    { key: 'adr', label: 'ADR' },
    { key: 'matches', label: 'Matches' }
  ];
  /** Cells with fewer matches than this are faded and left uncoloured. */
  const FEW = 10;

  let metric = $state<Metric>('winRate');

  // Maps ordered by how much the group has played them (lifetime), leaving out one-offs.
  const maps = $derived.by(() => {
    const totals = new Map<string, { matches: number; image: string }>();
    for (const player of players) {
      for (const record of player.maps) {
        const entry = totals.get(record.map) ?? { matches: 0, image: record.image };
        entry.matches += record.matches;
        entry.image ||= record.image;
        totals.set(record.map, entry);
      }
    }
    return [...totals.entries()]
      .filter(([, entry]) => entry.matches >= 10)
      .sort((a, b) => b[1].matches - a[1].matches)
      .map(([map, entry]) => ({ map, image: entry.image }));
  });
  const rows = $derived(players.filter((player) => player.maps.length));
  const together = $derived(new Map(groupMaps.map((record) => [record.map, record])));
  const peak = $derived(Math.max(1, ...rows.flatMap((player) => player.maps.map((record) => record.matches))));

  function value(record: MapStats) {
    if (metric === 'winRate') return record.winRate;
    if (metric === 'kd') return record.kd;
    if (metric === 'adr') return record.adr;
    return record.matches;
  }

  function text(record: MapStats) {
    if (metric === 'kd') return record.kd.toFixed(2);
    if (metric === 'adr') return record.adr.toFixed(0);
    return String(Math.round(value(record)));
  }

  /** Signed strength in [-1, 1] around each metric's neutral point; null for magnitude only. */
  function polarity(record: MapStats) {
    if (metric === 'winRate') return clamp((record.winRate - 50) / 25);
    if (metric === 'kd') return clamp((record.kd - 1) / 0.4);
    if (metric === 'adr') return clamp((record.adr - 80) / 25);
    return null;
  }

  const clamp = (value: number) => Math.max(-1, Math.min(1, value));

  function fill(record: MapStats) {
    if (record.matches < FEW) return 'transparent';
    const signed = polarity(record);
    if (signed === null) return `rgb(var(--ink-rgb) / ${(0.05 + 0.3 * (record.matches / peak)).toFixed(3)})`;
    const alpha = (0.06 + 0.32 * Math.abs(signed)).toFixed(3);
    return signed >= 0 ? `rgb(var(--win-rgb) / ${alpha})` : `rgb(var(--loss-rgb) / ${alpha})`;
  }

  function togetherFill(wins: number, matches: number) {
    if (matches < 5) return 'transparent';
    const signed = clamp(((wins / matches) * 100 - 50) / 25);
    const alpha = (0.06 + 0.32 * Math.abs(signed)).toFixed(3);
    return signed >= 0 ? `rgb(var(--win-rgb) / ${alpha})` : `rgb(var(--loss-rgb) / ${alpha})`;
  }

  const neutral = $derived(
    metric === 'winRate' ? '50%' : metric === 'kd' ? '1.00' : metric === 'adr' ? '80' : null
  );
</script>

<div class="section-head">
  <h2>Maps</h2>
  <span class="meta">Lifetime, 5v5</span>
</div>

<div class="controls">
  <div class="seg" role="group" aria-label="Map metric">
    {#each METRICS as option (option.key)}
      <button type="button" aria-pressed={metric === option.key} onclick={() => (metric = option.key)}>{option.label}</button>
    {/each}
  </div>
  <p class="legend push">
    {#if neutral}
      <span class="swatch" style:background="rgb(var(--loss-rgb) / 0.38)"></span>
      <span>below {neutral}</span>
      <span class="swatch" style:background="rgb(var(--win-rgb) / 0.38)"></span>
      <span>above</span>
    {:else}
      <span class="swatch" style:background="rgb(var(--ink-rgb) / 0.08)"></span>
      <span class="swatch" style:background="rgb(var(--ink-rgb) / 0.35)"></span>
      <span>more matches</span>
    {/if}
    <span class="muted">Small figure: matches · faded under {FEW}</span>
  </p>
</div>

<div class="scroll">
  <table class="heat">
    <thead>
      <tr>
        <th class="stick" scope="col"><span class="sr-only">Player</span></th>
        {#each maps as entry (entry.map)}
          <th scope="col">
            {#if entry.image}<img src={entry.image} alt="" loading="lazy" />{/if}
            {entry.map}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      {#if groupMaps.length}
        <tr class="together">
          <th class="stick" scope="row" title="Win rate when two or more of us were on the same team, last {windowDays} days">
            Together <span class="muted">{windowDays}d</span>
          </th>
          {#each maps as entry (entry.map)}
            {@const record = together.get(entry.map)}
            <td>
              {#if record}
                <span
                  class="cell"
                  class:few={record.matches < 5}
                  style:background={togetherFill(record.wins, record.matches)}
                  title="{record.wins} wins in {record.matches} games together"
                >
                  <b>{Math.round((record.wins / record.matches) * 100)}</b><small>{record.matches}</small>
                </span>
              {:else}
                <span class="cell empty">·</span>
              {/if}
            </td>
          {/each}
        </tr>
      {/if}
      {#each rows as player (player.playerId)}
        <tr>
          <th class="stick" scope="row">{player.displayName}</th>
          {#each maps as entry (entry.map)}
            {@const record = player.maps.find((candidate) => candidate.map === entry.map)}
            <td>
              {#if record}
                <span
                  class="cell"
                  class:few={record.matches < FEW}
                  style:background={fill(record)}
                  title="{player.displayName} on {entry.map}: {record.matches} matches, {record.winRate}% won, {record.kd.toFixed(2)} K/D, {record.adr.toFixed(1)} ADR"
                >
                  <b>{text(record)}</b>{#if metric !== 'matches'}<small>{record.matches}</small>{/if}
                </span>
              {:else}
                <span class="cell empty">·</span>
              {/if}
            </td>
          {/each}
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .legend {
    align-items: center;
    color: var(--ink-2);
    display: flex;
    flex-wrap: wrap;
    font-size: 12px;
    gap: 4px 6px;
  }

  .legend .muted {
    color: var(--muted);
    margin-left: 12px;
  }

  .swatch {
    display: inline-block;
    height: 10px;
    width: 10px;
  }

  .heat {
    border-collapse: collapse;
    font-size: 12px;
    font-variant-numeric: tabular-nums;
  }

  .heat th,
  .heat td {
    padding: 0;
    text-align: center;
    white-space: nowrap;
  }

  .heat thead th {
    border-bottom: 1px solid var(--ink);
    color: var(--ink-2);
    font-weight: 500;
    padding: 0 2px 6px;
    vertical-align: bottom;
  }

  .heat thead img {
    background: var(--band);
    display: block;
    height: 26px;
    margin: 0 auto 5px;
    object-fit: cover;
    width: 44px;
  }

  .heat tbody th {
    font-weight: 500;
    padding: 0 16px 0 0;
    text-align: left;
  }

  .stick {
    background: var(--page);
    left: 0;
    position: sticky;
    z-index: 1;
  }

  .together th,
  .together td {
    border-bottom: 1px solid var(--rule-2);
    padding-bottom: 4px;
  }

  .together + tr td,
  .together + tr th {
    padding-top: 4px;
  }

  .cell {
    display: flex;
    flex-direction: column;
    height: 40px;
    justify-content: center;
    line-height: 1.15;
    margin: 2px 1px;
    min-width: 56px;
  }

  .cell b {
    color: var(--ink);
    font-size: 13px;
    font-weight: 500;
  }

  .cell small {
    color: var(--ink-2);
    font-size: 10.5px;
  }

  .cell.few b,
  .cell.few small {
    color: var(--muted);
  }

  .cell.empty {
    color: var(--rule-2);
  }

  .muted {
    color: var(--muted);
    font-weight: 400;
  }
</style>
