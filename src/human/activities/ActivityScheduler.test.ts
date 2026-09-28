import { describe, expect, it } from 'vitest';
import { HUMAN_ACTIVITIES, ROUTINE } from '../../config/activities';
import { HOME_PLACES } from '../../world/home/places';
import { ActivityScheduler, type ScheduleContext } from './ActivityScheduler';

const ctx: ScheduleContext = { position: { x: 0, y: 0, z: 0 }, room: 'livingRoom', now: 0, last: null, isFree: () => true };
const chopping = (id?: string) => id === 'mealPrep' || id === 'prepareDinner';

describe('Scheduled kitchen prep', () => {
  it('randomizes the first appointment within ten minutes and prioritizes it over nearby laundry', () => {
    for (const roll of [0, 0.4, 0.999]) {
      const scheduler = new ActivityScheduler(HOME_PLACES, HUMAN_ACTIVITIES, () => roll);
      const due = ROUTINE.prepFirst[0] + roll * (ROUTINE.prepFirst[1] - ROUTINE.prepFirst[0]);
      expect(chopping(scheduler.choose({ ...ctx, now: due - 0.001 })?.activity.id)).toBe(false);
      expect(chopping(scheduler.choose({ ...ctx, now: due })?.activity.id)).toBe(true);
      expect(due).toBeLessThan(600);
    }
  });

  it('shares a randomized 10–15-minute interval between dinner and meal prep, measured from actual chopping', () => {
    for (const roll of [0, 0.3, 0.999]) {
      const scheduler = new ActivityScheduler(HOME_PLACES, HUMAN_ACTIVITIES, () => roll);
      let start = 100;
      for (let play = 0; play < 3; play++) {
        scheduler.prepStarted(start);
        const due = start + 600 + roll * 300;
        expect(chopping(scheduler.choose({ ...ctx, now: start + 599 })?.activity.id)).toBe(false);
        expect(chopping(scheduler.choose({ ...ctx, now: due - 0.001 })?.activity.id)).toBe(false);
        expect(chopping(scheduler.choose({ ...ctx, now: due })?.activity.id)).toBe(true);
        start = due + 15;
      }
    }
  });

  it('keeps overdue prep pending when its places are occupied and resets its appointment for a new game', () => {
    const scheduler = new ActivityScheduler(HOME_PLACES, HUMAN_ACTIVITIES, () => 0);
    const blocked = (p: typeof HOME_PLACES[number]) => p.kind !== 'islandPrep' && p.kind !== 'fridge';
    expect(chopping(scheduler.choose({ ...ctx, now: 500, isFree: blocked })?.activity.id)).toBe(false);
    expect(chopping(scheduler.choose({ ...ctx, now: 501 })?.activity.id)).toBe(true);
    scheduler.prepStarted(501); scheduler.markDone('mealPrep', 520); scheduler.reset();
    expect(chopping(scheduler.choose({ ...ctx, now: 44 })?.activity.id)).toBe(false);
    expect(chopping(scheduler.choose({ ...ctx, now: 45 })?.activity.id)).toBe(true);
  });
});
