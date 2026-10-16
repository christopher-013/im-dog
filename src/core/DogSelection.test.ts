import { describe, expect, it } from 'vitest';
import { DEFAULT_DOG, DOGS } from '../config/dogs';
import { DOG_SELECT } from '../config/dogSelect';
import { DogSelection, swipeStep } from './DogSelection';

const ids = DOGS.map((d) => d.id);

describe('Choose Your Dog: the highlight', () => {
  it('opens on Moke, in the middle (Dougie, Moke, Nori), and wraps round both ways', () => {
    expect(ids).toEqual(['dougie', 'moke', 'nori']);
    const s = new DogSelection(ids, DEFAULT_DOG);
    expect(s.current).toBe('moke');
    expect(s.position).toBe(1);
    expect(s.next()).toBe(true);
    expect(s.current).toBe('nori');
    expect(s.next()).toBe(true);
    expect(s.current).toBe('dougie');
    expect(s.next()).toBe(true);
    expect(s.current).toBe('moke');
    expect(s.prev()).toBe(true);
    expect(s.current).toBe('dougie');
  });

  it('picks a dog directly (a click or tap on it); picking the one already highlighted, or nothing, changes nothing', () => {
    const s = new DogSelection(ids, 'moke');
    expect(s.select(0)).toBe(true);
    expect(s.current).toBe('dougie');
    expect(s.select(0)).toBe(false);
    for (const bad of [-1, ids.length, 0.5, NaN]) expect(s.select(bad)).toBe(false);
    expect(s.position).toBe(0);
    expect(() => new DogSelection([], 'moke')).toThrow();
  });

  it('a swipe is a clear sideways drag: left for the next dog, right for the previous', () => {
    const min = DOG_SELECT.swipeMin;
    expect(swipeStep(-min - 5, 3, min)).toBe(1);
    expect(swipeStep(min + 5, -3, min)).toBe(-1);
    // Too short, or more up/down than sideways (scrolling, a wobbly tap): not a swipe.
    expect(swipeStep(min - 5, 0, min)).toBe(0);
    expect(swipeStep(min + 5, min + 30, min)).toBe(0);
    expect(swipeStep(0, 0, min)).toBe(0);
  });
});
