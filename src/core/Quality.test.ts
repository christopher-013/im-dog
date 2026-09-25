import { describe, expect, it } from 'vitest';
import { QUALITY } from '../config/quality';
import { AdaptiveResolution, pickQuality } from './Quality';

describe('quality presets', () => {
  it('keeps desktop on HIGH and starts phones lower', () => {
    expect(pickQuality({ forced: null, touchPrimary: false, cores: 4, memoryGB: 2 })).toBe('high');
    expect(pickQuality({ forced: null, touchPrimary: true, cores: 8, memoryGB: 8 })).toBe('medium');
    expect(pickQuality({ forced: null, touchPrimary: true })).toBe('medium');
    expect(pickQuality({ forced: null, touchPrimary: true, memoryGB: 2 })).toBe('low');
    expect(pickQuality({ forced: null, touchPrimary: true, cores: 4 })).toBe('low');
  });

  it('can be forced, and ignores nonsense', () => {
    expect(pickQuality({ forced: 'low', touchPrimary: false })).toBe('low');
    expect(pickQuality({ forced: 'ultra', touchPrimary: false })).toBe('high');
  });
});

describe('AdaptiveResolution', () => {
  const tuning = { slowFrameMs: 22, fastFrameMs: 17.5, stepDownAfter: 3, stepUpAfter: 10, step: 0.25 };
  const run = (adaptive: AdaptiveResolution, seconds: number, frameMs: number) => {
    for (let t = 0; t < seconds; t += 1 / 30) adaptive.update(1 / 30, frameMs);
  };

  it('steps down after sustained slow frames, not after a hitch', () => {
    const adaptive = new AdaptiveResolution(QUALITY.medium, tuning);
    run(adaptive, 1, 40);
    run(adaptive, 0.1, 10); // recovered briefly: the slow timer restarts
    run(adaptive, 2, 40);
    expect(adaptive.pixelRatio).toBe(1.5);
    run(adaptive, 1.2, 40);
    expect(adaptive.pixelRatio).toBe(1.25);
  });

  it('stays within the preset, and comes back up with sustained headroom', () => {
    const adaptive = new AdaptiveResolution(QUALITY.medium, tuning);
    run(adaptive, 30, 50);
    expect(adaptive.pixelRatio).toBe(QUALITY.medium.minPixelRatio);
    run(adaptive, 10.2, 12);
    expect(adaptive.pixelRatio).toBe(QUALITY.medium.minPixelRatio + 0.25);
    run(adaptive, 60, 12);
    expect(adaptive.pixelRatio).toBe(QUALITY.medium.maxPixelRatio);
  });

  it('never touches desktop (HIGH)', () => {
    const adaptive = new AdaptiveResolution(QUALITY.high, tuning);
    run(adaptive, 30, 80);
    expect(adaptive.pixelRatio).toBe(QUALITY.high.maxPixelRatio);
  });
});
