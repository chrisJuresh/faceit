<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head><title>{page.status} · Stackline</title></svelte:head>

<main>
  <p class="status">{page.status}</p>
  <h1>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
  {#if page.error?.message && page.status !== 404}<p>{page.error.message}</p>{/if}
  <a href="/">Back to Stackline</a>
</main>

<style>
  main {
    margin: 0 auto;
    max-width: 36rem;
    padding: 6rem 1.25rem;
  }

  .status {
    color: var(--text-3);
    font-variant-numeric: tabular-nums;
    margin: 0;
  }

  h1 {
    color: var(--text-1);
    font-size: 1.5rem;
    font-weight: 600;
    margin: 0.25rem 0 0.75rem;
  }

  p {
    color: var(--text-2);
  }

  a {
    color: var(--text-1);
  }
</style>
