<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head><title>Something went wrong · Stackline</title></svelte:head>

<main>
  <div class="mark">S/</div>
  <p>{page.status}</p>
  <h1>That round did not go to plan.</h1>
  <span>{page.error?.message || 'An unexpected error occurred.'}</span>
  <a href="/">Return to dashboard</a>
</main>

<style>
  :global(body) {
    background: #0b0b0c;
    color: #f4f1eb;
    font-family: Inter, ui-sans-serif, system-ui, sans-serif;
    margin: 0;
  }
  main {
    display: grid;
    min-height: 100vh;
    place-content: center;
    padding: 2rem;
    text-align: center;
  }
  .mark {
    color: #ff5c35;
    font-size: 2rem;
    font-weight: 900;
  }
  p {
    color: #ff5c35;
    font-family: ui-monospace, monospace;
    margin-bottom: 0;
  }
  h1 {
    font-size: clamp(2rem, 5vw, 4rem);
    letter-spacing: -0.05em;
    margin: 0.5rem 0;
  }
  span {
    color: #9c9993;
  }
  a {
    color: #f4f1eb;
    margin-top: 2rem;
  }
</style>
