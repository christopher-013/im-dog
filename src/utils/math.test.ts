import { describe, expect, it } from 'vitest';
import { clamp, damp } from './math';

describe('clamp', () => {
  it('keeps values within range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('damp', () => {
  it('moves toward the target without overshooting', () => {
    const v = damp(0, 10, 8, 1 / 60);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(10);
  });

  it('is frame-rate independent', () => {
    let at60 = 0;
    for (let i = 0; i < 60; i++) at60 = damp(at60, 1, 5, 1 / 60);
    let at144 = 0;
    for (let i = 0; i < 144; i++) at144 = damp(at144, 1, 5, 1 / 144);
    expect(at144).toBeCloseTo(at60, 6);
  });

  it('does not move when no time passes', () => {
    expect(damp(3, 10, 8, 0)).toBe(3);
  });
});
