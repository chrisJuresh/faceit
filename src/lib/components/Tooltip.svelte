<script lang="ts">
  import { tooltip } from '$lib/tooltip.svelte';

  /** Offset from the pointer, and the smallest gap kept to the viewport edge. */
  const OFFSET = 14;
  const INSET = 8;

  let width = $state(0);
  let height = $state(0);

  const position = $derived.by(() => {
    let x = tooltip.x + OFFSET;
    let y = tooltip.y + OFFSET;
    if (typeof window !== 'undefined') {
      if (x + width > window.innerWidth - INSET) x = tooltip.x - width - OFFSET;
      if (y + height > window.innerHeight - INSET) y = tooltip.y - height - OFFSET;
    }
    return { x: Math.max(INSET, x), y: Math.max(INSET, y) };
  });
</script>

<!-- A press anywhere clears the read-out first; a press on a chart cell then shows its own. -->
<svelte:document onpointerdowncapture={() => tooltip.hide()} />
<svelte:window onscrollcapture={() => tooltip.hide()} />

{#if tooltip.lines.length}
  <div
    class="tip"
    aria-hidden="true"
    bind:clientWidth={width}
    bind:clientHeight={height}
    style:left="{position.x}px"
    style:top="{position.y}px"
  >
    {#each tooltip.lines as line, index (index)}<span>{line}</span>{/each}
  </div>
{/if}

<style>
  span {
    display: block;
  }
</style>
