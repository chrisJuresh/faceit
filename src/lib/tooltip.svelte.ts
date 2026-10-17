/**
 * One hover read-out for every chart cell: form bars, heat cells and activity cells. The page
 * renders it once (Tooltip.svelte) at the top level, outside any scrolling table, so its
 * fixed position is always relative to the viewport.
 */
class Tooltip {
  lines = $state<string[]>([]);
  x = $state(0);
  y = $state(0);

  show(event: PointerEvent, lines: string[]) {
    this.lines = lines;
    this.x = event.clientX;
    this.y = event.clientY;
  }

  hide() {
    this.lines = [];
  }
}

export const tooltip = new Tooltip();

/**
 * Pointer handlers to spread on an element. A mouse shows the read-out while it is over the
 * element; a tap shows it until the next tap or scroll.
 */
export function readout(read: () => string[]) {
  const show = (event: PointerEvent) => tooltip.show(event, read());
  return {
    onpointerenter: show,
    onpointermove: show,
    onpointerdown: show,
    onpointerleave: (event: PointerEvent) => {
      if (event.pointerType === 'mouse') tooltip.hide();
    }
  };
}
