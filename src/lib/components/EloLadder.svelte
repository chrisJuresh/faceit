<script lang="ts">
  import { LEVEL_FLOORS, eloToNextLevel, levelForElo, levelVar } from '$lib/levels';
  import type { SquadPlayer } from '$lib/types';

  /**
   * Each player's ELO against FACEIT's level bands, with a leader line to the next level. Players
   * without an ELO keep their row, so this lists the same people as Activity beside it.
   */
  let { players }: { players: SquadPlayer[] } = $props();

  const ranked = $derived([...players].sort((a, b) => b.elo - a.elo));
  const elos = $derived(ranked.map((player) => player.elo).filter((elo) => elo > 0));
  const low = $derived(elos.length ? Math.min(500, Math.floor((Math.min(...elos) - 40) / 50) * 50) : 500);
  const high = $derived(elos.length ? Math.max(2150, Math.ceil((Math.max(...elos) + 80) / 50) * 50) : 2150);
  const x = (elo: number) => ((Math.min(Math.max(elo, low), high) - low) / (high - low)) * 100;

  const bands = $derived(
    LEVEL_FLOORS.map((floor, index) => ({
      level: index + 1,
      from: x(Math.max(floor, low)),
      to: x(Math.min(LEVEL_FLOORS[index + 1] ?? high, high))
    })).filter((band) => band.to - band.from > 1.5)
  );
  const floors = $derived(LEVEL_FLOORS.slice(1).filter((floor) => floor > low && floor < high).map(x));
</script>

{#if ranked.length}
  <figure class="ladder" aria-label="ELO per player against FACEIT level bands">
    <div class="row scale" aria-hidden="true">
      <span></span>
      <span class="track">
        {#each bands as band (band.level)}
          <span
            class="band"
            style:left="calc({band.from}% + 1px)"
            style:width="calc({band.to - band.from}% - 2px)"
            style:--level={levelVar(band.level)}
          >
            <span class="number">{band.level}</span>
          </span>
        {/each}
        {#each floors as floor (floor)}<i class="floor" style:left="{floor}%"></i>{/each}
      </span>
      <span></span>
    </div>
    <ol>
      {#each ranked as player (player.playerId)}
        {@const next = player.elo ? eloToNextLevel(player.elo) : null}
        {@const level = player.level || levelForElo(player.elo)}
        <li class="row">
          <span class="name" title={player.displayName}>{player.displayName}</span>
          <span class="track">
            {#each floors as floor (floor)}<i class="floor" style:left="{floor}%"></i>{/each}
            {#if player.elo}
              {#if next !== null}
                <i
                  class="lead"
                  style:left="{x(player.elo)}%"
                  style:width="{x(player.elo + next) - x(player.elo)}%"
                  style:--level={levelVar(level)}
                ></i>
                <span class="gap" style:left="{x(player.elo + next)}%">{next}<span class="sr-only"> to level {level + 1}</span></span>
              {/if}
              <i class="dot" style:left="{x(player.elo)}%" style:--level={levelVar(level)}></i>
            {/if}
          </span>
          <span class="value" class:missing={!player.elo}>{player.elo ? player.elo.toLocaleString('en-GB') : '—'}</span>
        </li>
      {/each}
    </ol>
  </figure>
{:else}
  <p class="none">No players</p>
{/if}

<style>
  .ladder {
    margin: 0;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .row {
    align-items: center;
    display: grid;
    gap: 0 12px;
    grid-template-columns: minmax(80px, 112px) minmax(0, 1fr) 48px;
    height: 24px;
  }

  .scale {
    height: 30px;
  }

  .name {
    color: var(--ink-2);
    font-size: 12px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .track {
    height: 100%;
    position: relative;
  }

  .band {
    background: var(--level);
    border-radius: 1px;
    height: 3px;
    position: absolute;
    top: 18px;
  }

  .band .number {
    color: var(--muted);
    font: 10.5px var(--mono);
    left: 50%;
    position: absolute;
    top: -16px;
    transform: translateX(-50%);
  }

  .scale .floor {
    top: 24px;
  }

  .floor {
    background: var(--rule);
    bottom: 0;
    position: absolute;
    top: 0;
    width: 1px;
  }

  .lead {
    background: var(--level);
    height: 2px;
    opacity: 0.4;
    position: absolute;
    top: calc(50% - 1px);
  }

  .gap {
    color: var(--muted);
    font: 10.5px var(--mono);
    margin-left: 5px;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
  }

  .dot {
    background: var(--level);
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--surface);
    height: 8px;
    margin-left: -4px;
    position: absolute;
    top: calc(50% - 4px);
    width: 8px;
  }

  .value {
    font: 12px var(--mono);
    text-align: right;
  }

  .value.missing {
    color: var(--muted);
  }
</style>
