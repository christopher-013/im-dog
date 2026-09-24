import { describe, expect, it } from 'vitest';
import { angleDelta, clamp, damp, lerp, moveToward, smoothstep, wrapAngle } from './math';

describe('clamp', () => {
  it('keeps values within range', () => {
    expect(clamp(5, 0, 1)).toBe(1);
    expect(clamp(-5, 0, 1)).toBe(0);
    expect(clamp(0.5, 0, 1)).toBe(0.5);
  });
});

describe('lerp / smoothstep', () => {
  it('interpolates', () => {
    expect(lerp(2, 4, 0.5)).toBe(3);
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBe(0.5);
  });
});

describe('moveToward', () => {
  it('steps by at most maxDelta and never overshoots', () => {
    expect(moveToward(0, 10, 3)).toBe(3);
    expect(moveToward(10, 0, 3)).toBe(7);
    expect(moveToward(9, 10, 3)).toBe(10);
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

describe('angles', () => {
  it('wraps into [-π, π)', () => {
    expect(wrapAngle(0)).toBeCloseTo(0);
    expect(wrapAngle(Math.PI * 3)).toBeCloseTo(-Math.PI);
    expect(wrapAngle(-Math.PI * 1.5)).toBeCloseTo(Math.PI / 2);
  });

  it('finds the shortest rotation across the ±π seam', () => {
    expect(angleDelta(Math.PI - 0.1, -Math.PI + 0.1)).toBeCloseTo(0.2);
    expect(angleDelta(-Math.PI + 0.1, Math.PI - 0.1)).toBeCloseTo(-0.2);
    expect(angleDelta(0, Math.PI / 2)).toBeCloseTo(Math.PI / 2);
  });
});
