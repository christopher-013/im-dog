import { CAR_IDS, CARS, type CarId } from '../config/cars';
import { DeLoreanCar } from './DeLoreanCar';
import { FamilyCar } from './FamilyCar';
import type { RideCar } from './RideCar';

type CarStorage = Pick<Storage, 'getItem' | 'setItem'> | null;

/** Each shuffled pair contains one of each car; boarding consumes one, never a scene change. */
export function pickCar(storage: CarStorage, random: () => number = Math.random): CarId {
  let remaining: CarId[] = [];
  try {
    const saved: unknown = JSON.parse(storage?.getItem(CARS.storageKey) ?? 'null');
    // The only valid leftover from a two-car round is one known ID (or an empty round).
    if (Array.isArray(saved) && saved.length === 1 && CAR_IDS.includes(saved[0])) remaining = saved;
  } catch { /* Blocked storage or an old/corrupt save: start a fresh round. */ }
  if (!remaining.length) remaining = random() < 0.5 ? ['family', 'delorean'] : ['delorean', 'family'];
  const next = remaining.shift()!;
  try { storage?.setItem(CARS.storageKey, JSON.stringify(remaining)); } catch { /* A fair random pick still works. */ }
  return next;
}

/** A local visual-test override does not consume a saved turn. No identity or network data is stored. */
export function nextRideCar(): CarId {
  if (import.meta.env.DEV && typeof location !== 'undefined') {
    const override = new URLSearchParams(location.search).get('car');
    if (override === 'family' || override === 'delorean') return override;
  }
  let storage: CarStorage = null;
  try { storage = typeof localStorage === 'undefined' ? null : localStorage; } catch { /* Private browsing. */ }
  return pickCar(storage);
}

export function createCar(id: CarId): RideCar {
  return id === 'delorean' ? new DeLoreanCar() : new FamilyCar();
}
