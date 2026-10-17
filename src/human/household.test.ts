import { describe, expect, it } from 'vitest';
import { HUMAN } from '../config/human';
import { HOUSEHOLD, pickHousehold, type HouseholdId } from './household';

function memoryStorage() {
  const data = new Map<string, string>();
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}
/** A seeded random, so the shuffles are repeatable. */
function seeded(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

describe('who lives here this visit (the man or the woman)', () => {
  it('is even over every round, whatever the shuffle', () => {
    const storage = memoryStorage();
    const random = seeded(7);
    const round = HUMAN.household.perRound * 2;
    for (let r = 0; r < 25; r++) {
      const visits = Array.from({ length: round }, () => pickHousehold(storage, random));
      expect(visits.filter((id) => id === 'man')).toHaveLength(HUMAN.household.perRound);
      expect(visits.filter((id) => id === 'woman')).toHaveLength(HUMAN.household.perRound);
    }
  });

  it('is random: the order changes from round to round, and either can start', () => {
    const storage = memoryStorage();
    const random = seeded(11);
    const orders = new Set<string>();
    const firsts = new Set<HouseholdId>();
    for (let r = 0; r < 30; r++) {
      const visits = Array.from({ length: HUMAN.household.perRound * 2 }, () => pickHousehold(storage, random));
      orders.add(visits.join());
      firsts.add(visits[0]!);
    }
    expect(orders.size).toBeGreaterThan(3);
    expect(firsts).toEqual(new Set(['man', 'woman']));
  });

  it('never has the same person home more than twice a round in a row', () => {
    const storage = memoryStorage();
    const random = seeded(3);
    let run = 0;
    let last: HouseholdId | null = null;
    for (let i = 0; i < 400; i++) {
      const id = pickHousehold(storage, random);
      run = id === last ? run + 1 : 1;
      last = id;
      expect(run).toBeLessThanOrEqual(HUMAN.household.perRound * 2);
    }
  });

  it('copes with no storage, or junk in it', () => {
    expect(Object.keys(HOUSEHOLD)).toContain(pickHousehold(null));
    const storage = memoryStorage();
    storage.setItem(HUMAN.household.key, '{not json');
    expect(Object.keys(HOUSEHOLD)).toContain(pickHousehold(storage));
    storage.setItem(HUMAN.household.key, '["alien","woman"]');
    expect(pickHousehold(storage)).toBe('woman');
  });

  it('the woman is a shorter build in a long dress; the man is unchanged', () => {
    expect(HOUSEHOLD.woman.figure).toBe('woman');
    expect(HOUSEHOLD.woman.height).toBeLessThan(0.95);
    expect(HOUSEHOLD.man.figure ?? 'man').toBe('man');
    expect(HOUSEHOLD.man.height ?? 1).toBe(1);
  });
});
