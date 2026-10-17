<script lang="ts">
  import { levelVar } from '$lib/levels';

  /** FACEIT skill level: a ring in the level's colour with the number inside. */
  let { level }: { level: number } = $props();
</script>

<span class="level" style:--ring={levelVar(level)} role="img" aria-label="Level {level || 'unknown'}">
  {level || '–'}
</span>

<style>
  .level {
    align-items: center;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1.5px var(--ring);
    color: var(--ink);
    display: inline-flex;
    flex: none;
    font: 500 10px/1 var(--mono);
    height: 20px;
    justify-content: center;
    width: 20px;
  }
</style>
