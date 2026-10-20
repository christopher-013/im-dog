import { describe, expect, it } from 'vitest';
import { RIDE } from '../config/ride';
import { RideCameraTour, tourViews } from './RideCameraTour';

const ALL = RIDE.cameraTour.views;

describe('the gentle ride camera tour', () => {
  it('gives every view, Inside included, an equal share of the time on the road, and never loops at the end', () => {
    const tour = new RideCameraTour();
    // A 100-second drive, five views: a new one every 20 seconds.
    const shown: string[] = [];
    for (let t = 0; t < 100; t += 0.5) {
      const view = tour.update(0.5, true, 100 - t - 0.5, ALL);
      if (view) shown.push(`${view}@${t + 0.5}`);
    }
    expect(shown).toEqual(['face@20', 'cabin@40', 'chase@60', 'drone@80']);
    expect(tour.update(100, true, 0, ALL)).toBeNull();
  });

  it('keeps up when the estimate of what is left changes, still showing each view once', () => {
    const tour = new RideCameraTour();
    const order: string[] = [];
    let remaining = 60;
    for (let i = 0; i < 400 && remaining > 0; i++) {
      remaining -= 0.5 * (i % 7 === 0 ? 1.4 : 0.9);
      const view = tour.update(0.5, true, Math.max(0, remaining), ALL);
      if (view) order.push(view);
    }
    expect(order).toEqual(['face', 'cabin', 'chase', 'drone']);
  });

  it('freezes during pause/takeoff/return, and never catches up in a burst', () => {
    const tour = new RideCameraTour();
    expect(tour.update(100, false, 0, ALL)).toBeNull();
    expect(tour.update(0, true, 0, ALL)).toBeNull();
    expect(tour.update(100, true, 0, ALL)).toBe('drone');
    expect(tour.update(0.1, true, 0, ALL)).toBeNull();
  });

  it('gives a manual view extra time, resumes the schedule and resets each new ride', () => {
    const tour = new RideCameraTour();
    tour.manual();
    expect(tour.update(RIDE.cameraTour.manualHold - 0.1, true, 20, ALL)).toBeNull();
    expect(tour.update(100, false, 20, ALL)).toBeNull();
    expect(tour.update(0.2, true, 20, ALL)).not.toBeNull();
    tour.reset();
    expect(tour.update(10, true, 90, ALL)).toBeNull();
    expect(tour.update(10, true, 80, ALL)).toBe('face');
  });

  it('only tours views the car has', () => {
    expect(tourViews(['alongside', 'face', 'chase', 'drone'])).toEqual(['alongside', 'face', 'chase', 'drone']);
    expect(tourViews(ALL)).toEqual(['alongside', 'face', 'cabin', 'chase', 'drone']);
  });
});
