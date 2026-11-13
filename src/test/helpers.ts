/** A canvas 2D context proxy that records every method call (for renderer tests). */
export interface RecordingCtx {
  ctx: CanvasRenderingContext2D;
  calls: string[];
}

export function recordingCtx(): RecordingCtx {
  const calls: string[] = [];
  const gradient = { addColorStop: () => undefined };
  const handler: ProxyHandler<object> = {
    get(_t, prop) {
      if (typeof prop === 'symbol') return undefined;
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => {
          calls.push(String(prop));
          return gradient;
        };
      }
      if (prop === 'measureText') return () => ({ width: 10 });
      return () => {
        calls.push(String(prop));
        return undefined;
      };
    },
    set() {
      return true;
    },
  };
  return { ctx: new Proxy({}, handler) as unknown as CanvasRenderingContext2D, calls };
}

/** Fake WebAudio backend that records oscillator frequencies. */
export interface FakeAudio {
  backend: import('../audio/sfx').AudioBackend;
  freqs: number[];
}

export function fakeAudio(): FakeAudio {
  const freqs: number[] = [];
  const osc = {
    type: '' as OscillatorType,
    frequency: {
      setValueAtTime: (v: number) => {
        freqs.push(v);
      },
      exponentialRampToValueAtTime: () => undefined,
      linearRampToValueAtTime: () => undefined,
    },
    connect: () => null,
    start: () => undefined,
    stop: () => undefined,
  };
  const gain = {
    gain: {
      setValueAtTime: () => undefined,
      linearRampToValueAtTime: () => undefined,
      exponentialRampToValueAtTime: () => undefined,
    },
    connect: () => null,
  };
  const backend: import('../audio/sfx').AudioBackend = {
    currentTime: 0,
    state: 'running',
    destination: {},
    createOscillator: () => osc,
    createGain: () => gain,
  };
  return { backend, freqs };
}
