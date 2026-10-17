<script lang="ts">
  import { thousands } from '$lib/format';
  import Level from './Level.svelte';

  /** ELO with its level ring. The number has a fixed width so the rings line up down a column. */
  let { elo, level }: { elo: number; level: number } = $props();
</script>

<span class="elo"><Level {level} /><span class="number">{elo ? thousands(elo) : '—'}</span></span>

<style>
  .elo {
    align-items: center;
    display: inline-flex;
    gap: 7px;
    justify-content: flex-end;
  }

  .number {
    min-width: 5ch;
    text-align: right;
  }
</style>
