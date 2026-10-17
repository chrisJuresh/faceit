<script lang="ts">
  import { shortDate } from '$lib/format';
  import type { PlayerMatch } from '$lib/types';

  /** Matches newest first, as FACEIT returns them; drawn oldest to newest. */
  let { matches }: { matches: PlayerMatch[] } = $props();

  let hovered = $state<number | null>(null);

  const series = $derived([...matches].reverse());
  const top = $derived(Math.max(120, ...series.map((match) => match.adr)));
  const average = $derived(
    series.length ? series.reduce((sum, match) => sum + match.adr, 0) / series.length : 0
  );
  const tick = $derived(Math.ceil(top / 50) * 50);
  const active = $derived(hovered === null ? null : series[hovered]);
</script>

<figure class="form-chart">
  <div class="plot" style:--top={tick}>
    <span class="gridline" style:bottom="{(100 / tick) * 100}%"><span>100</span></span>
    <span class="average" style:bottom="{(average / tick) * 100}%"><span>avg {average.toFixed(0)}</span></span>
    <div class="bars" role="group" aria-label="ADR per match" onmouseleave={() => (hovered = null)}>
      {#each series as match, index (match.matchId)}
        <button
          type="button"
          class="bar"
          class:win={match.won}
          class:dim={hovered !== null && hovered !== index}
          style:--h="{(match.adr / tick) * 100}%"
          aria-label="{shortDate(match.finishedAt)}, {match.map}, {match.won ? 'win' : 'loss'}, {match.kills}-{match.deaths}, {match.adr.toFixed(0)} ADR"
          onmouseenter={() => (hovered = index)}
          onfocus={() => (hovered = index)}
          onblur={() => (hovered = null)}
        ></button>
      {/each}
    </div>
  </div>
  <figcaption>
    {#if active}
      <span>{shortDate(active.finishedAt)} · {active.map}</span>
      <span class:win={active.won} class="result">{active.won ? 'W' : 'L'}{#if active.teamScore !== null} {active.teamScore}–{active.enemyScore}{/if}</span>
      <span>{active.kills}–{active.deaths}–{active.assists}</span>
      <span>{active.adr.toFixed(1)} ADR</span>
    {:else}
      <span class="key"><i class="win"></i>Win</span>
      <span class="key"><i></i>Loss</span>
      <span class="hint">Oldest left, newest right</span>
    {/if}
  </figcaption>
</figure>
