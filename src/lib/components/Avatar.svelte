<script lang="ts">
  /** FACEIT profile photo; falls back to the name's first letter when there is none or it fails. */
  let { src, name, size = 22 }: { src: string; name: string; size?: number } = $props();

  let failed = $state<string | null>(null);
  const initial = $derived((name.replace(/[^\p{L}\p{N}]/gu, '').charAt(0) || '?').toUpperCase());
</script>

{#if src && failed !== src}
  <img
    class="avatar"
    {src}
    alt=""
    width={size}
    height={size}
    loading="lazy"
    referrerpolicy="no-referrer"
    style:--size="{size}px"
    onerror={() => (failed = src)}
  />
{:else}
  <span class="avatar initial" style:--size="{size}px" aria-hidden="true">{initial}</span>
{/if}

<style>
  .avatar {
    background: var(--cell);
    border-radius: 2px;
    flex: none;
    height: var(--size);
    object-fit: cover;
    width: var(--size);
  }

  .initial {
    align-items: center;
    color: var(--muted);
    display: inline-flex;
    font: 600 calc(var(--size) * 0.45) / 1 var(--sans);
    justify-content: center;
  }
</style>
