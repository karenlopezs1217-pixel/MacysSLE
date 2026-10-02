import '@testing-library/jest-dom/vitest';

// jsdom has no canvas; the try-on skips drawing when there is no 2D context.
HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];

// jsdom does not implement scrolling.
window.scrollTo = (() => undefined) as typeof window.scrollTo;
