<script lang="ts">
  /** Results oldest first, so the latest sits on the right. Wins stand above the midline, losses below. */
  let { results }: { results: boolean[] } = $props();

  const BAR = 4;
  const GAP = 2;
  const width = $derived(results.length * (BAR + GAP) - GAP);
</script>

{#if results.length}
  <svg
    class="strip"
    {width}
    height="14"
    viewBox="0 0 {width} 14"
    role="img"
    aria-label="Oldest to latest: {results.map((won) => (won ? 'W' : 'L')).join(' ')}"
  >
    {#each results as won, index (index)}
      <rect x={index * (BAR + GAP)} y={won ? 0 : 8} width={BAR} height="6" rx="1" class={won ? 'win' : 'loss'} />
    {/each}
  </svg>
{:else}
  <span class="muted">—</span>
{/if}

<style>
  .strip {
    display: inline-block;
    vertical-align: middle;
  }

  .win {
    fill: var(--win);
  }

  .loss {
    fill: var(--loss);
  }
</style>
