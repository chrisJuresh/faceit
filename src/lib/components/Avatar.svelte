<script lang="ts">
  let { src = '', name = '', size = 28 }: { src?: string; name?: string; size?: number } = $props();
  let failed = $state(false);

  const initials = $derived(
    name
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .split(/[\s_-]+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  );
</script>

<span class="avatar" style:--size="{size}px">
  {#if src && !failed}
    <img {src} alt="" loading="lazy" onerror={() => (failed = true)} />
  {:else}
    <span aria-hidden="true">{initials}</span>
  {/if}
</span>

<style>
  .avatar {
    align-items: center;
    background: var(--surface-2);
    border-radius: 50%;
    color: var(--text-2);
    display: inline-flex;
    flex: none;
    font-size: calc(var(--size) * 0.36);
    font-weight: 600;
    height: var(--size);
    justify-content: center;
    overflow: hidden;
    width: var(--size);
  }

  img {
    height: 100%;
    object-fit: cover;
    width: 100%;
  }
</style>
