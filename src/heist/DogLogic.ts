const KEY = 'imdog.dogLogic';

/**
 * What Moke has figured out about the world ("SOCK = TREAT"). Phase 3 only records discoveries and remembers
 * them in this browser; the full Dog Logic system is Phase 4's. Storage problems (private mode) never break
 * the game: he simply "rediscovers" things.
 */
export class DogLogicMemory {
  private readonly known = new Set<string>();

  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null = safeStorage()) {
    try {
      const saved = JSON.parse(this.storage?.getItem(KEY) ?? '[]') as unknown;
      if (Array.isArray(saved)) for (const id of saved) if (typeof id === 'string') this.known.add(id);
    } catch {
      // Corrupt or unavailable: start fresh.
    }
  }

  has(id: string): boolean {
    return this.known.has(id);
  }

  /** Records a discovery. Returns true the first time. */
  learn(id: string): boolean {
    if (this.known.has(id)) return false;
    this.known.add(id);
    try {
      this.storage?.setItem(KEY, JSON.stringify([...this.known]));
    } catch {
      // Not remembered across visits this time; fine.
    }
    return true;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}
