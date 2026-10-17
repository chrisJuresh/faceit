<script lang="ts">
  import { fixed, monthYear, thousands } from '$lib/format';
  import { togetherMaps } from '$lib/stats';
  import { readout } from '$lib/tooltip.svelte';
  import type { GroupLineup, MapStats, SquadPlayer, TogetherMap } from '$lib/types';
  import { SvelteSet } from 'svelte/reactivity';
  import Avatar from './Avatar.svelte';
  import Divider from './Divider.svelte';
  import MapImage from './MapImage.svelte';

  /**
   * Each player's record per map over their last 30 or 90 matches or FACEIT's lifetime record,
   * with the group's record on top: games where every ticked player was on the same team, whoever
   * else played, over the same span (their last 30 or 90 games together, or all of them). When a
   * history was cut short, `togetherFrom` says how far back the games go, and the row says so
   * rather than pass for a lifetime record.
   */
  let {
    players,
    lineups,
    togetherFrom,
    mapImages
  }: {
    players: SquadPlayer[];
    lineups: GroupLineup[];
    togetherFrom: number | null;
    mapImages: Record<string, string>;
  } = $props();

  type Metric = 'winRate' | 'kd';
  type Scope = 'last30' | 'last90' | 'lifetime';
  /** The fields a heatmap cell reads, shared by FACEIT's lifetime map records and recent runs. */
  type MapRecord = Pick<MapStats, 'map' | 'matches' | 'winRate' | 'kd' | 'adr'>;

  const SCOPES: Array<{ key: Scope; label: string; count?: number }> = [
    { key: 'last30', label: 'Last 30', count: 30 },
    { key: 'last90', label: 'Last 90', count: 90 },
    { key: 'lifetime', label: 'Lifetime' }
  ];
  /**
   * Player cells with fewer matches than this stay uncoloured. A shorter run spreads fewer matches
   * over the same maps, so its bar is lower. The Together row uses its own.
   */
  const FEW: Record<Scope, number> = { last30: 3, last90: 5, lifetime: 10 };
  const FEW_TOGETHER = 5;

  let metric = $state<Metric>('winRate');
  let scope = $state<Scope>('lifetime');
  const picked = new SvelteSet<string>();

  const few = $derived(FEW[scope]);
  const scopeCount = $derived(SCOPES.find((option) => option.key === scope)?.count);
  const records = (player: SquadPlayer): MapRecord[] =>
    scope === 'lifetime' ? player.maps : player.mapForm[scope];

  /**
   * Only shown players who played a group game can be ticked. Players the Active filter hides have
   * no box, so they never count.
   */
  const listed = $derived(new Set(players.map((player) => player.playerId)));
  const eligible = $derived(
    new Set(lineups.flatMap((game) => game.lines.map((line) => line.playerId)).filter((id) => listed.has(id)))
  );
  const chosen = $derived(new Set([...picked].filter((id) => eligible.has(id))));
  // Games every ticked player was in, whoever else played; nothing until two are ticked.
  const together = $derived(chosen.size >= 2 ? togetherMaps(lineups, chosen, scopeCount) : new Map<string, TogetherMap>());
  const togetherGames = $derived([...together.values()].reduce((sum, record) => sum + record.matches, 0));
  // Columns follow any two of the group playing together, so ticking never adds or removes one.
  const everyone = $derived(togetherMaps(lineups, eligible, scopeCount, 2));

  const rows = $derived(
    [...players]
      .filter((player) => records(player).length || eligible.has(player.playerId))
      .sort((a, b) => b.elo - a.elo)
  );

  // Maps the shown players have played at least `few` times between them, most played first, then
  // any map only the group's games together reach.
  const maps = $derived.by(() => {
    const totals = new Map<string, number>();
    for (const player of rows) {
      for (const record of records(player)) totals.set(record.map, (totals.get(record.map) ?? 0) + record.matches);
    }
    const ranked = [...totals.entries()]
      .filter(([, matches]) => matches >= few)
      .sort((a, b) => b[1] - a[1])
      .map(([map]) => map);
    const extra = [...everyone.values()]
      .filter((record) => !ranked.includes(record.map))
      .sort((a, b) => b.matches - a.matches)
      .map((record) => record.map);
    return [...ranked, ...extra].map((map) => ({ map, image: mapImages[map] ?? '' }));
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

  const pick = (record: MapRecord) => (metric === 'winRate' ? record.winRate : record.kd);
  const togetherKd = (record: TogetherMap) => (record.deaths ? record.kills / record.deaths : record.kills);
  const togetherValue = (record: TogetherMap) =>
    metric === 'winRate' ? (record.wins / record.matches) * 100 : togetherKd(record);

  const steps = $derived(metric === 'winRate' ? [30, 40, 50, 60, 70] : [0.5, 0.75, 1, 1.25, 1.5]);

  function toggle(playerId: string) {
    if (picked.has(playerId)) picked.delete(playerId);
    else picked.add(playerId);
  }
</script>

<div class="section-head">
  <h2>Maps</h2>
  <span class="meta">
    {#if scopeCount}Last <span class="mono">{scopeCount}</span> matches{:else}Lifetime{/if}, 5v5
  </span>
  <div class="controls">
    <div class="seg" role="group" aria-label="Map matches counted">
      {#each SCOPES as option (option.key)}
        <button type="button" aria-pressed={scope === option.key} onclick={() => (scope = option.key)}
          >{option.label}</button
        >
      {/each}
    </div>
    <Divider />
    <div class="seg" role="group" aria-label="Map metric">
      <button type="button" aria-pressed={metric === 'winRate'} onclick={() => (metric = 'winRate')}>Win %</button>
      <button type="button" aria-pressed={metric === 'kd'} onclick={() => (metric = 'kd')}>K/D</button>
    </div>
  </div>
</div>

{#if rows.length && maps.length}
  <div class="scroll bleed">
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
                {#if chosen.size < 2}Tick two or more players{:else}<span class="mono">{thousands(togetherGames)}</span>
                  games{#if togetherFrom && (!scopeCount || togetherGames < scopeCount)}
                    since {monthYear(togetherFrom)}{/if}{/if}
              </span>
            </th>
            {#each maps as entry (entry.map)}
              {@const record = together.get(entry.map)}
              <td>
                {#if record}
                  {@const value = togetherValue(record)}
                  {@const thin = record.matches < FEW_TOGETHER}
                  {@const lines = [
                    `Together · ${entry.map}`,
                    `${record.wins}–${record.matches - record.wins} · ${thousands(record.matches)} games`,
                    `K/D ${fixed(togetherKd(record), 2)}`
                  ]}
                  <span
                    class="cell"
                    class:few={thin}
                    style:background={thin ? undefined : tint(value)}
                    {...readout(() => lines)}
                  >
                    <b aria-hidden="true">{text(value)}</b><small aria-hidden="true">{thousands(record.matches)}</small>
                    <span class="sr-only">{lines.slice(1).join(', ')}</span>
                  </span>
                {:else}
                  <span class="cell empty"><span aria-hidden="true">—</span><span class="sr-only">No games</span></span>
                {/if}
              </td>
            {/each}
          </tr>
        {/if}
        {#each rows as player (player.playerId)}
          {@const canPick = eligible.has(player.playerId)}
          <tr>
            <th class="stick" scope="row">
              <svelte:element this={canPick ? 'label' : 'span'} class="pick">
                {#if canPick}
                  <input
                    type="checkbox"
                    checked={picked.has(player.playerId)}
                    onchange={() => toggle(player.playerId)}
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
              {@const record = records(player).find((candidate) => candidate.map === entry.map)}
              <td>
                {#if record}
                  {@const thin = record.matches < few}
                  {@const lines = [
                    `${player.displayName} · ${entry.map}`,
                    `${thousands(record.matches)} matches · ${fixed(record.winRate)}% won`,
                    `K/D ${fixed(record.kd, 2)} · ADR ${fixed(record.adr, 1)}`
                  ]}
                  <span
                    class="cell"
                    class:few={thin}
                    style:background={thin ? undefined : tint(pick(record))}
                    {...readout(() => lines)}
                  >
                    <b aria-hidden="true">{text(pick(record))}</b><small aria-hidden="true">{thousands(record.matches)}</small>
                    <!-- The row and column headers already name the player and map. -->
                    <span class="sr-only">{lines.slice(1).join(', ')}</span>
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
      Uncoloured: under <span class="mono">{few}</span> matches{#if lineups.length},
        <span class="mono">{FEW_TOGETHER}</span> together{/if}
    </span>
  </p>
{:else}
  <p class="none">No map stats</p>
{/if}

<style>
  /* The wrapper bleeds by the cell spacing, so the outer cells line up with the column edges. */
  .bleed {
    margin: 0 -2px;
  }

  /* Map columns share whatever width the name column leaves. */
  .heat {
    border-collapse: separate;
    border-spacing: 2px;
    white-space: nowrap;
    width: 100%;
  }

  .heat th {
    font-weight: 400;
    padding: 0;
  }

  .stick {
    background: var(--surface);
    left: 0;
    position: sticky;
    text-align: left;
    width: 1%;
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
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .heat td {
    padding: 0;
  }

  .cell {
    align-items: center;
    background: var(--cell);
    border-radius: 2px;
    display: flex;
    flex-direction: column;
    height: 40px;
    justify-content: center;
    line-height: 1.15;
    min-width: 52px;
  }

  .cell b {
    font: 500 12.5px var(--mono);
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

  /* A gap under the group's row sets it apart from the players'. */
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

  label.pick:has(input:disabled) {
    cursor: default;
  }

  .pick input,
  .spacer {
    flex: none;
    height: 12px;
    margin: 0 1px;
    width: 12px;
  }

  /* A hairline ring in the page's rule colour; ticked, it turns accent with an accent dot inside. */
  .pick input {
    appearance: none;
    background: transparent;
    border: 1px solid var(--rule-2);
    border-radius: 50%;
    cursor: pointer;
    display: grid;
    place-content: center;
  }

  .pick input::after {
    background: var(--accent);
    border-radius: 50%;
    content: '';
    height: 6px;
    visibility: hidden;
    width: 6px;
  }

  .pick input:checked {
    border-color: var(--accent);
  }

  .pick input:checked::after {
    visibility: visible;
  }

  label.pick:hover input:not(:checked) {
    border-color: var(--ink-2);
  }

  /* The last two can't be unticked: still ticked, but quieter. */
  .pick input:disabled {
    cursor: default;
    opacity: 0.45;
  }

  .name {
    font-size: 13px;
    font-weight: 500;
    max-width: 135px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
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
