import { describe, expect, it } from 'vitest';
import { RideExcitement } from './RideExcitement';

describe('ride request excitement', () => {
  it('starts immediately, barks a playful pair then leaves a longer breathing gap', () => {
    const excitement = new RideExcitement();
    expect(excitement.update(0.01, true)).toBe(true);
    expect(excitement.update(0.44, true)).toBe(false);
    expect(excitement.update(0.02, true)).toBe(true);
    expect(excitement.update(1.7, true)).toBe(false);
    expect(excitement.update(0.11, true)).toBe(true);
  });
  it('freezes in pause, stops on cancellation or drive start, and restarts for a new request', () => {
    const excitement = new RideExcitement();
    expect(excitement.update(0, true)).toBe(false);
    expect(excitement.update(0.01, true)).toBe(true);
    for (let i = 0; i < 50; i++) expect(excitement.update(0, true)).toBe(false);
    expect(excitement.update(0.2, true)).toBe(false);
    expect(excitement.update(0, false)).toBe(false);
    expect(excitement.update(5, false)).toBe(false);
    expect(excitement.update(0.01, true)).toBe(true);
  });
  it('does not accumulate a burst of missed barks after a long frame', () => {
    const excitement = new RideExcitement();
    expect(excitement.update(20, true)).toBe(true);
    expect(excitement.update(0.01, true)).toBe(false);
  });
});
