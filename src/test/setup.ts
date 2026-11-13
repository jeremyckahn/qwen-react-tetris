import '@testing-library/jest-dom/vitest';

// jsdom has no canvas 2D implementation; give every canvas a recording stub so
// component tests can run the real render loop without a GL context.
const proto = HTMLCanvasElement.prototype as unknown as {
  getContext: (type: string) => CanvasRenderingContext2D | null;
};

proto.getContext = function (this: HTMLCanvasElement, type: string) {
  if (type !== '2d') return null;
  const target: Record<string | symbol, unknown> = {};
  const ctx = new Proxy(target, {
    get(_t, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop: () => undefined });
      }
      if (prop === 'measureText') return () => ({ width: 0 });
      if (prop in target) return target[prop];
      return () => undefined;
    },
    set(_t, prop, value) {
      target[prop] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
  return ctx;
};
