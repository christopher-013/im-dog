import { DEFAULT_DOG, isDogId, type DogId } from '../config/dogs';

/** The dog last chosen on this browser, so Choose Your Dog starts on them (and the title screen shows them). */
export const DOG_CHOICE_KEY = 'imdog.dog';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

function browserStorage(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** Moke when nothing (or nonsense) was saved, or storage is blocked. */
export function loadDogChoice(storage: KeyValueStore | null = browserStorage()): DogId {
  try {
    const saved = storage?.getItem(DOG_CHOICE_KEY);
    return isDogId(saved) ? saved : DEFAULT_DOG;
  } catch {
    return DEFAULT_DOG;
  }
}

export function saveDogChoice(id: DogId, storage: KeyValueStore | null = browserStorage()): void {
  try {
    storage?.setItem(DOG_CHOICE_KEY, id);
  } catch {
    // Blocked storage: the choice still holds for this visit.
  }
}
