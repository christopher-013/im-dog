import { CAR_IDS, CARS, type CarId } from '../config/cars';
import { DeLoreanCar } from './DeLoreanCar';
import { FamilyCar } from './FamilyCar';
import { KittCar } from './KittCar';
import type { RideCar } from './RideCar';

type CarStorage = Pick<Storage, 'getItem' | 'setItem'> | null;

/** A fresh round: every car once, in random order (Fisher–Yates). */
function shuffled(random: () => number): CarId[] {
  const ids: CarId[] = [...CAR_IDS];
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  return ids;
}

/** Each shuffled round has every car once; boarding consumes one, never a scene change. */
export function pickCar(storage: CarStorage, random: () => number = Math.random): CarId {
  let remaining: CarId[] = [];
  try {
    const saved: unknown = JSON.parse(storage?.getItem(CARS.storageKey) ?? 'null');
    // A round's leftovers: fewer than all the cars, each known and none twice.
    if (Array.isArray(saved) && saved.length < CAR_IDS.length && new Set(saved).size === saved.length && saved.every((id) => CAR_IDS.includes(id))) remaining = saved;
  } catch { /* Blocked storage or an old/corrupt save: start a fresh round. */ }
  if (!remaining.length) remaining = shuffled(random);
  const next = remaining.shift()!;
  try { storage?.setItem(CARS.storageKey, JSON.stringify(remaining)); } catch { /* A fair random pick still works. */ }
  return next;
}

/** A local visual-test override does not consume a saved turn. No identity or network data is stored. */
export function nextRideCar(): CarId {
  if (import.meta.env.DEV && typeof location !== 'undefined') {
    const override = new URLSearchParams(location.search).get('car');
    if ((CAR_IDS as readonly string[]).includes(override ?? '')) return override as CarId;
  }
  let storage: CarStorage = null;
  try { storage = typeof localStorage === 'undefined' ? null : localStorage; } catch { /* Private browsing. */ }
  return pickCar(storage);
}

export function createCar(id: CarId): RideCar {
  return id === 'delorean' ? new DeLoreanCar() : id === 'kitt' ? new KittCar() : new FamilyCar();
}
