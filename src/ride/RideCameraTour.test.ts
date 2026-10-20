import { describe, expect, it } from 'vitest';
import { RIDE } from '../config/ride';
import { RideCameraTour } from './RideCameraTour';

describe('the gentle ride camera tour', () => {
  it('shows each view for one quarter of the route and never loops at the end', () => {
    const tour = new RideCameraTour();
    expect(tour.update(20, true, 0.249)).toBeNull();
    expect(tour.update(0.1, true, 0.25)).toBe('face');
    expect(tour.update(12, true, 0.499)).toBeNull();
    expect(tour.update(0.1, true, 0.5)).toBe('chase');
    expect(tour.update(12, true, 0.749)).toBeNull();
    expect(tour.update(0.1, true, 0.75)).toBe('drone');
    expect(tour.update(100, true, 1)).toBeNull();
  });

  it('freezes during pause/takeoff/return, and never catches up in a burst', () => {
    const tour = new RideCameraTour();
    expect(tour.update(100, false, 0.75)).toBeNull();
    expect(tour.update(0, true, 0.75)).toBeNull();
    expect(tour.update(100, true, 0.75)).toBe('drone');
    expect(tour.update(0.1, true, 0.75)).toBeNull();
  });

  it('gives a manual view extra time, resumes the route schedule and resets each new ride', () => {
    const tour = new RideCameraTour();
    tour.manual();
    expect(tour.update(RIDE.cameraTour.manualHold - 0.1, true, 0.5)).toBeNull();
    expect(tour.update(100, false, 0.5)).toBeNull();
    expect(tour.update(0.2, true, 0.5)).toBe('chase');
    tour.reset();
    expect(tour.update(20, true, 0.249)).toBeNull();
    expect(tour.update(0.1, true, 0.25)).toBe('face');
  });
});
