<script lang="ts">
  import { levelColor } from '$lib/levels';

  let { level }: { level: number } = $props();
</script>

<span class="level" style:--level={levelColor(level)} title="FACEIT level {level}">
  {level || '–'}
</span>

<style>
  .level {
    align-items: center;
    border: 1.5px solid var(--level);
    border-radius: 50%;
    color: var(--text-1);
    display: inline-flex;
    flex: none;
    font-size: 0.6875rem;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
    height: 1.375rem;
    justify-content: center;
    width: 1.375rem;
  }
</style>
