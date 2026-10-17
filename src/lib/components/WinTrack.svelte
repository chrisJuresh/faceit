<script lang="ts">
  /** A win rate as a dot on a 0–100 line, with 50 marked. Width comes from --track-width (72px). */
  let { rate, faded = false }: { rate: number; faded?: boolean } = $props();
</script>

<span class="track" class:faded aria-hidden="true">
  <i class="mid"></i>
  <i class="dot" class:up={rate > 50} class:down={rate < 50} style:left="{Math.max(0, Math.min(100, rate))}%"></i>
</span>

<style>
  .track {
    display: inline-block;
    height: 10px;
    position: relative;
    vertical-align: middle;
    width: var(--track-width, 72px);
  }

  .track::before {
    background: var(--rule-2);
    content: '';
    height: 1px;
    left: 0;
    position: absolute;
    right: 0;
    top: 4.5px;
  }

  .mid {
    background: var(--faint);
    height: 8px;
    left: 50%;
    position: absolute;
    top: 1px;
    width: 1px;
  }

  .dot {
    background: var(--muted);
    border-radius: 50%;
    box-shadow: 0 0 0 2px var(--surface);
    height: 8px;
    margin-left: -4px;
    position: absolute;
    top: 1px;
    width: 8px;
  }

  .dot.up {
    background: var(--win);
  }

  .dot.down {
    background: var(--loss);
  }

  .faded .dot {
    opacity: 0.4;
  }
</style>
