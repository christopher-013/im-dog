/** Moke's discoveries have always been saved here; it stays his key, so no existing progress moves (see config/dogs.ts). */
export const DOG_LOGIC_KEY = 'imdog.dogLogic';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * What the dog being played has figured out about the world ("SOCK = TREAT"), remembered in this browser. Each dog
 * has their own (`switchTo` the chosen dog's key): Dougie doesn't inherit what Moke learned, and nothing Dougie
 * learns touches Moke's. Storage problems (private mode) never break the game: the dog simply "rediscovers" things.
 */
export class DogLogicMemory {
  private readonly known = new Set<string>();
  private storageKey: string;

  constructor(
    private readonly storage: Store | null = safeStorage(),
    key: string = DOG_LOGIC_KEY,
  ) {
    this.storageKey = key;
    this.load();
  }

  /** Where this memory is saved. */
  get key(): string {
    return this.storageKey;
  }

  /** Changes to another dog's memory (forgetting the current one's, which stays saved under its own key). */
  switchTo(key: string): void {
    if (key === this.storageKey) return;
    this.storageKey = key;
    this.load();
  }

  has(id: string): boolean {
    return this.known.has(id);
  }

  /** Records a discovery. Returns true the first time. */
  learn(id: string): boolean {
    if (this.known.has(id)) return false;
    this.known.add(id);
    try {
      this.storage?.setItem(this.storageKey, JSON.stringify([...this.known]));
    } catch {
      // Not remembered across visits this time; fine.
    }
    return true;
  }

  private load(): void {
    this.known.clear();
    try {
      const saved = JSON.parse(this.storage?.getItem(this.storageKey) ?? '[]') as unknown;
      if (Array.isArray(saved)) for (const id of saved) if (typeof id === 'string') this.known.add(id);
    } catch {
      // Corrupt or unavailable: start fresh.
    }
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
