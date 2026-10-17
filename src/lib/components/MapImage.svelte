<script lang="ts">
  /**
   * A map image in one of the three sizes: large (live board), medium (finished thumbnail and
   * heat headers) or small (game rows). A missing or broken image keeps its slot as a blank box.
   */
  let {
    src,
    size,
    lazy = true
  }: { src: string; size: 'large' | 'medium' | 'small'; lazy?: boolean } = $props();

  let failed = $state<string | null>(null);
</script>

{#if src && failed !== src}
  <img class="map-img {size}" {src} alt="" loading={lazy ? 'lazy' : undefined} onerror={() => (failed = src)} />
{:else}
  <span class="map-img {size}"></span>
{/if}
