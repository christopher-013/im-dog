import { describe, expect, it } from 'vitest';
import { FixedStep } from './GameLoop';

const STEP = 1 / 60;

function run(fixed: FixedStep, frames: number[]): { ticks: number; alpha: number } {
  let ticks = 0;
  let alpha = 0;
  for (const dt of frames) alpha = fixed.advance(dt, () => ticks++);
  return { ticks, alpha };
}

describe('FixedStep', () => {
  it('runs one step per 60 Hz frame', () => {
    expect(run(new FixedStep(STEP, 6), Array(60).fill(STEP)).ticks).toBe(60);
  });

  it('runs one step every other frame at 120 Hz', () => {
    expect(run(new FixedStep(STEP, 6), Array(120).fill(1 / 120)).ticks).toBe(60);
  });

  it('simulates the same amount of time at 144 Hz (within one step)', () => {
    const { ticks } = run(new FixedStep(STEP, 6), Array(144).fill(1 / 144));
    expect(Math.abs(ticks - 60)).toBeLessThanOrEqual(1);
  });

  it('returns the leftover fraction for interpolation', () => {
    const { ticks, alpha } = run(new FixedStep(STEP, 6), [STEP * 1.5]);
    expect(ticks).toBe(1);
    expect(alpha).toBeCloseTo(0.5);
  });

  it('caps steps per frame and drops the backlog after a long hitch', () => {
    const fixed = new FixedStep(STEP, 6);
    const { ticks, alpha } = run(fixed, [2]);
    expect(ticks).toBe(6);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThan(1);
    // The next normal frame is back to one step, not a burst of catch-up steps.
    expect(run(fixed, [STEP]).ticks).toBeLessThanOrEqual(2);
  });

  it('does nothing for zero or negative time (paused, clock skew)', () => {
    expect(run(new FixedStep(STEP, 6), [0, -1, 0]).ticks).toBe(0);
  });
});
