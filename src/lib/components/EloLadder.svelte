<script lang="ts">
  import { LEVEL_FLOORS, levelColor } from '$lib/levels';
  import type { SquadPlayer } from '$lib/types';

  let { players }: { players: SquadPlayer[] } = $props();

  const ranked = $derived([...players].filter((player) => player.elo > 0).sort((a, b) => b.elo - a.elo));
  // Show the level bands the group actually spans, plus one either side.
  const low = $derived(Math.max(0, Math.min(...ranked.map((p) => p.level)) - 2));
  const high = $derived(Math.min(10, Math.max(...ranked.map((p) => p.level)) + 1));
  const min = $derived(LEVEL_FLOORS[low] ?? 100);
  const max = $derived(high >= 10 ? Math.max(2300, ...ranked.map((p) => p.elo + 50)) : LEVEL_FLOORS[high]);
  const bands = $derived(
    LEVEL_FLOORS.map((floor, index) => ({
      level: index + 1,
      from: Math.max(floor, min),
      to: Math.min(LEVEL_FLOORS[index + 1] ?? max, max)
    })).filter((band) => band.to > band.from)
  );
  const x = (elo: number) => ((elo - min) / (max - min)) * 100;
</script>

<figure class="ladder">
  <div class="scale" aria-hidden="true">
    {#each bands as band (band.level)}
      <span class="band" style:left="{x(band.from)}%" style:width="{x(band.to) - x(band.from)}%">
        <span>{band.level}</span>
      </span>
    {/each}
  </div>
  <ol>
    {#each ranked as player (player.playerId)}
      <li>
        <span class="who">{player.displayName}</span>
        <span class="track">
          {#each bands as band (band.level)}
            <span class="band" style:left="{x(band.from)}%" style:width="{x(band.to) - x(band.from)}%"></span>
          {/each}
          <span class="stem" style:width="{x(player.elo)}%"></span>
          <span class="dot" style:left="{x(player.elo)}%" style:--level={levelColor(player.level)}></span>
        </span>
        <span class="value">{player.elo.toLocaleString('en-GB')}</span>
      </li>
    {/each}
  </ol>
  <figcaption>FACEIT level bands; each dot is a player's current ELO.</figcaption>
</figure>
