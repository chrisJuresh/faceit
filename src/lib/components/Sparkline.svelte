<script lang="ts">
  export let values: number[] = [];
  export let label = 'Recent swing trend';

  const width = 112;
  const height = 34;
  const padding = 2;

  $: min = Math.min(...values, 0);
  $: max = Math.max(...values, 0);
  $: range = max - min || 1;
  $: points = values
    .map((value, index) => {
      const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
      const y = padding + ((max - value) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(' ');
  $: zeroY = padding + ((max - 0) / range) * (height - padding * 2);
</script>

<svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
  <line x1="0" x2={width} y1={zeroY} y2={zeroY} class="zero" />
  {#if values.length > 1}
    <polyline class:negative={values.at(-1)! < 0} {points} />
  {:else if values.length === 1}
    <circle
      class:negative={values[0] < 0}
      cx={width / 2}
      cy={padding + ((max - values[0]) / range) * (height - padding * 2)}
      r="2.5"
    />
  {/if}
</svg>

<style>
  svg {
    display: block;
    height: 34px;
    overflow: visible;
    width: 112px;
  }

  .zero {
    stroke: var(--border-subtle);
    stroke-width: 1;
  }

  polyline {
    fill: none;
    stroke: var(--positive);
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 2;
    vector-effect: non-scaling-stroke;
  }

  polyline.negative,
  circle.negative {
    stroke: var(--negative);
  }

  circle {
    fill: var(--positive);
  }

  circle.negative {
    fill: var(--negative);
  }
</style>
