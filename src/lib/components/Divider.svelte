<script lang="ts">
  /**
   * The 1×14 rule between two control groups. When the groups wrap onto separate lines it hides
   * (keeping its space, so hiding can't unwrap them and loop) instead of dangling at a line end.
   */
  let rule = $state<HTMLSpanElement>();
  let wrapped = $state(false);

  $effect(() => {
    const node = rule;
    const parent = node?.parentElement;
    if (!node || !parent) return;
    const check = () => {
      const before = node.previousElementSibling?.getBoundingClientRect();
      const after = node.nextElementSibling?.getBoundingClientRect();
      wrapped = Boolean(before && after && Math.abs(before.top - after.top) > 2);
    };
    const observer = new ResizeObserver(check);
    observer.observe(parent);
    check();
    return () => observer.disconnect();
  });
</script>

<span class="divider" class:wrapped bind:this={rule} aria-hidden="true"></span>

<style>
  .wrapped {
    visibility: hidden;
  }
</style>
