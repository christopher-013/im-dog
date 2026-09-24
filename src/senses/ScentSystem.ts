import { SNIFF } from '../config/senses';
import type { Vec3Like } from '../physics/CharacterBody';

/** What something smells like. Phase 1 uses SOCK, TOY and INTERESTING. */
export const SCENT_CATEGORIES = ['FOOD', 'TREAT', 'OWNER', 'FAMILY', 'SOCK', 'TOY', 'OUTSIDE', 'INTERESTING'] as const;

export type ScentCategory = (typeof SCENT_CATEGORIES)[number];

/** Something with a smell. Read every frame, so getters work (a carried sock stops being a source). */
export interface ScentSource {
  readonly id: string;
  readonly category: ScentCategory;
  readonly label: string;
  readonly position: Vec3Like;
  /** 0..1: how strong it smells at the source. */
  readonly strength: number;
  /** Can be smelled up to this far away (m). */
  readonly radius: number;
  readonly enabled: boolean;
}

export interface ScentHit {
  source: ScentSource;
  /** Horizontal distance from the nose (m). */
  distance: number;
  /** 0..1: how noticeable it is now (strength × closeness × sniff fade). */
  intensity: number;
}

type SniffTuning = { readonly [K in keyof typeof SNIFF]: number };

/**
 * Sniff mode: Q makes nearby scent sources noticeable for a few seconds. It keeps the list of
 * sources and, while sniffing, the strongest ones in range ("hits") for the wisps, the UI and the
 * debug panel. No three.js, no DOM, and no allocation per frame.
 */
export class ScentSystem {
  private readonly sources: ScentSource[] = [];
  private readonly pool: ScentHit[];
  private hitCount = 0;
  private elapsed = Infinity;
  private cooldownLeft = 0;
  private envelope = 0;

  constructor(private readonly tuning: SniffTuning = SNIFF) {
    this.pool = Array.from({ length: tuning.maxSources }, () => ({ source: null as unknown as ScentSource, distance: 0, intensity: 0 }));
  }

  get sourceCount(): number {
    return this.sources.length;
  }

  /** True from the press until the fade-out ends. */
  get active(): boolean {
    return this.elapsed < this.tuning.duration;
  }

  /** 0..1 fade of sniff mode itself. */
  get intensity(): number {
    return this.envelope;
  }

  /** The strongest sources in range, strongest first. Valid until the next update. */
  get hits(): readonly ScentHit[] {
    return this.pool.slice(0, this.hitCount);
  }

  get hitsLength(): number {
    return this.hitCount;
  }

  /** Allocation-free access to hits[i] (i < hitsLength). */
  hitAt(i: number): ScentHit {
    return this.pool[i]!;
  }

  register(source: ScentSource): void {
    if (this.sources.some((s) => s.id === source.id)) throw new Error(`Scent source "${source.id}" is already registered`);
    this.sources.push(source);
  }

  unregister(id: string): void {
    const index = this.sources.findIndex((s) => s.id === id);
    if (index >= 0) this.sources.splice(index, 1);
  }

  /** Q: start sniffing. False while already sniffing or cooling down. */
  start(): boolean {
    if (this.active || this.cooldownLeft > 0) return false;
    this.elapsed = 0;
    return true;
  }

  update(dt: number, nose: Vec3Like): void {
    const t = this.tuning;
    if (this.active) {
      this.elapsed += dt;
      if (!this.active) this.cooldownLeft = t.cooldown;
    } else {
      this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
    }
    this.envelope = this.active
      ? Math.min(1, this.elapsed / t.fadeIn, (t.duration - this.elapsed) / t.fadeOut)
      : 0;
    this.collectHits(nose);
  }

  private collectHits(nose: Vec3Like): void {
    this.hitCount = 0;
    if (this.envelope <= 0) return;
    for (const source of this.sources) {
      if (!source.enabled) continue;
      const distance = Math.hypot(source.position.x - nose.x, source.position.z - nose.z);
      if (distance >= source.radius) continue;
      const closeness = 1 - distance / source.radius;
      const intensity = source.strength * Math.sqrt(closeness) * this.envelope;
      this.insert(source, distance, intensity);
    }
  }

  /** Keeps the pool sorted by intensity, strongest first, dropping the weakest when full. */
  private insert(source: ScentSource, distance: number, intensity: number): void {
    const pool = this.pool;
    let i = this.hitCount;
    if (i === pool.length) {
      if (intensity <= pool[i - 1]!.intensity) return;
      i--;
    } else {
      this.hitCount++;
    }
    // Recycle the slot being overwritten; shift weaker hits down.
    const slot = pool[i]!;
    while (i > 0 && pool[i - 1]!.intensity < intensity) {
      pool[i] = pool[i - 1]!;
      i--;
    }
    pool[i] = slot;
    slot.source = source;
    slot.distance = distance;
    slot.intensity = intensity;
  }
}
