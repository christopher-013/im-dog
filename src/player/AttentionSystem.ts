import type { Vec3Like } from '../physics/CharacterBody';
import { MOKE_ATTENTION } from '../config/attention';
import { angleDelta } from '../utils/math';

/** Kinds of things Moke may glance at. Later phases add people and food. */
export type AttentionKind = 'sock' | 'toy' | 'ball' | 'bed' | 'scent' | 'food' | 'human';

/** Something interesting. Fields are read every frame, so getters work (e.g. a prop's live position). */
export interface AttentionTarget {
  readonly id: string;
  readonly kind: AttentionKind;
  /** Where to look (world). */
  readonly position: Vec3Like;
  /** How interesting, relative to others (1 = normal). */
  readonly interest: number;
  /** False while it shouldn't be looked at (e.g. it's in his mouth). Default true. */
  readonly enabled?: boolean;
}

export interface AttentionObserver {
  /** His feet position and facing (radians, 0 = +z). */
  readonly position: Vec3Like;
  readonly heading: number;
  /** Actual ground speed (m/s). */
  readonly speed: number;
}

type AttentionTuning = typeof MOKE_ATTENTION;

/**
 * Visual personality only: picks one interesting nearby thing for Moke to glance at now and then, so his head and
 * eyes follow the sock, a toy or his bed. It never moves him and never changes what the player controls.
 *
 * Glances come and go: he looks at something for a couple of seconds, looks away for a while, and a thing he just
 * looked at stays less interesting for a bit, so he doesn't stare. While sniffing, the game can set a `focus`
 * (the strongest scent), which wins while it lasts. He doesn't glance about at a run or while lying down.
 */
export class AttentionSystem {
  private readonly targets: AttentionTarget[] = [];
  private readonly boredUntil = new Map<string, number>();
  private current: AttentionTarget | null = null;
  private time = 0;
  /** Seconds left of the current glance, or of the pause before the next one. */
  private phaseLeft = 0;
  /** Set by the game each frame it applies (e.g. while sniffing), then cleared. */
  focus: Vec3Like | null = null;

  constructor(
    private readonly tuning: AttentionTuning = MOKE_ATTENTION,
    private readonly random: () => number = Math.random,
  ) {}

  register(target: AttentionTarget): void {
    this.targets.push(target);
  }

  /** What he's glancing at right now, if anything. */
  get target(): AttentionTarget | null {
    return this.current;
  }

  get targetCount(): number {
    return this.targets.length;
  }

  /**
   * Once per frame. Returns where to look (world position), or null. `busy` (lying down, doing a trick) turns
   * glancing off; the sniff `focus` still applies unless he's busy.
   */
  update(dt: number, observer: AttentionObserver, busy = false): Vec3Like | null {
    this.time += dt;
    const t = this.tuning;
    if (busy || observer.speed > t.maxSpeed) {
      this.endGlance(false);
      return null;
    }
    if (this.focus) return this.focus;

    this.phaseLeft -= dt;
    if (this.current) {
      if (this.phaseLeft <= 0 || !this.stillInteresting(this.current, observer)) this.endGlance(true);
      return this.current?.position ?? null;
    }
    if (this.phaseLeft > 0) return null; // looking away for a moment

    const best = this.pick(observer);
    if (!best) return null;
    this.current = best;
    this.phaseLeft = t.glance[0] + this.random() * t.glance[1];
    return best.position;
  }

  /** The most interesting thing in view: nearer, more in front and more interesting wins. */
  pick(observer: AttentionObserver): AttentionTarget | null {
    let best: AttentionTarget | null = null;
    let bestScore = 0;
    for (const target of this.targets) {
      if ((this.boredUntil.get(target.id) ?? 0) > this.time) continue;
      const score = this.score(target, observer);
      if (score > bestScore) {
        best = target;
        bestScore = score;
      }
    }
    return best;
  }

  private score(target: AttentionTarget, observer: AttentionObserver): number {
    if (target.enabled === false) return 0;
    const t = this.tuning;
    const dx = target.position.x - observer.position.x;
    const dz = target.position.z - observer.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance < t.minDistance || distance > t.range) return 0;
    const off = Math.abs(angleDelta(observer.heading, Math.atan2(dx, dz)));
    if (off > t.fieldOfView) return 0;
    return target.interest * (1 - distance / t.range) * (1 - t.sideFalloff * (off / t.fieldOfView));
  }

  private stillInteresting(target: AttentionTarget, observer: AttentionObserver): boolean {
    return this.score(target, observer) > 0;
  }

  private endGlance(lookAway: boolean): void {
    if (this.current) this.boredUntil.set(this.current.id, this.time + this.tuning.boredFor);
    this.current = null;
    const t = this.tuning;
    this.phaseLeft = lookAway ? t.lookAway[0] + this.random() * t.lookAway[1] : 0;
  }
}
