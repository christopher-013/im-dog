import { describe, expect, it } from 'vitest';
import { DOGS } from '../config/dogs';
import { DOG_SELECT } from '../config/dogSelect';
import { DogSelection, swipeStep } from './DogSelection';
import { DOG_CHOICE_KEY, loadDogChoice, saveDogChoice } from './DogChoice';

const ids = DOGS.map((d) => d.id);

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

describe('Choose Your Dog: the highlight', () => {
  it('starts on the dog last played (or the first), and wraps round both ways', () => {
    expect(new DogSelection(ids, 'dougie').current).toBe('dougie');
    const s = new DogSelection(ids, 'moke');
    expect(s.next()).toBe(true);
    expect(s.current).toBe('dougie');
    expect(s.next()).toBe(true);
    expect(s.current).toBe('moke');
    expect(s.prev()).toBe(true);
    expect(s.current).toBe('dougie');
  });

  it('picks a dog directly (a click or tap on it); picking the one already highlighted, or nothing, changes nothing', () => {
    const s = new DogSelection(ids, 'moke');
    expect(s.select(1)).toBe(true);
    expect(s.current).toBe('dougie');
    expect(s.select(1)).toBe(false);
    for (const bad of [-1, 2, 0.5, NaN]) expect(s.select(bad)).toBe(false);
    expect(s.position).toBe(1);
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

describe('the dog last chosen (remembered in this browser)', () => {
  it('starts on Moke, then remembers the choice', () => {
    const store = memoryStore();
    expect(loadDogChoice(store)).toBe('moke');
    saveDogChoice('dougie', store);
    expect(store.data.get(DOG_CHOICE_KEY)).toBe('dougie');
    expect(loadDogChoice(store)).toBe('dougie');
  });

  it('falls back to Moke for anything it does not recognise, and never throws', () => {
    expect(loadDogChoice(memoryStore({ [DOG_CHOICE_KEY]: 'rex' }))).toBe('moke');
    expect(loadDogChoice(null)).toBe('moke');
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadDogChoice(broken)).toBe('moke');
    expect(() => saveDogChoice('dougie', broken)).not.toThrow();
  });
});
