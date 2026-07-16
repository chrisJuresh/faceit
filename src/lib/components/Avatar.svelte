<script lang="ts">
  export let src = '';
  export let name = '';
  export let size: 'sm' | 'md' | 'lg' | 'xl' = 'md';
  let failed = false;

  $: initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
</script>

<span class:sm={size === 'sm'} class:lg={size === 'lg'} class:xl={size === 'xl'} class="avatar">
  {#if src && !failed}
    <img src={src} alt="" on:error={() => (failed = true)} />
  {:else}
    <span aria-hidden="true">{initials || '?'}</span>
  {/if}
</span>

<style>
  .avatar {
    align-items: center;
    background: linear-gradient(145deg, var(--surface-raised), var(--surface-quiet));
    border: 1px solid var(--border-strong);
    border-radius: 50%;
    color: var(--text-strong);
    display: inline-flex;
    flex: 0 0 auto;
    font-size: 0.72rem;
    font-weight: 700;
    height: 42px;
    justify-content: center;
    overflow: hidden;
    width: 42px;
  }

  .avatar.sm {
    height: 30px;
    width: 30px;
  }

  .avatar.lg {
    font-size: 1rem;
    height: 58px;
    width: 58px;
  }

  .avatar.xl {
    font-size: 1.25rem;
    height: 76px;
    width: 76px;
  }

  img {
    height: 100%;
    object-fit: cover;
    width: 100%;
  }
</style>
