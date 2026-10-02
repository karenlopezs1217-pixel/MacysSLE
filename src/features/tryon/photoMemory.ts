/**
 * The shopper's photo only ever exists as an in-memory canvas owned by the try-on component.
 * It is never written to state shared with the shell, storage, or the network.
 */
export interface WipeableCanvas {
  width: number;
  height: number;
  getContext(id: '2d'): { setTransform(...a: number[]): void; clearRect(...a: number[]): void } | null;
}

/** Clear the pixels and release the backing store. Safe to call twice. */
export function wipeCanvas(canvas: WipeableCanvas | null): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  canvas.width = 0;
  canvas.height = 0;
}

/** Crop-to-fill `source` into a new in-memory canvas of the given size. */
export function coverCanvas(source: CanvasImageSource, sw: number, sh: number, w: number, h: number): HTMLCanvasElement | null {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  const scale = Math.max(w / sw, h / sh);
  ctx.drawImage(source, (w - sw * scale) / 2, (h - sh * scale) / 2, sw * scale, sh * scale);
  return c;
}
