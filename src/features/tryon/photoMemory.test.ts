import { wipeCanvas } from './photoMemory';

describe('photo memory', () => {
  it('clears pixels and releases the backing store', () => {
    const calls: string[] = [];
    const canvas = {
      width: 900,
      height: 1200,
      getContext: () => ({ setTransform: () => calls.push('reset'), clearRect: () => calls.push('clear') }),
    };
    wipeCanvas(canvas);
    expect(calls).toEqual(['reset', 'clear']);
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    wipeCanvas(canvas); // idempotent
    wipeCanvas(null);
  });
});
