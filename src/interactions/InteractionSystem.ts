import { INTERACTION } from '../config/interaction';
import type { Vec3Like } from '../physics/CharacterBody';
import { angleDelta } from '../utils/math';
import type { Interactable } from './Interactable';

/** Where the one doing the interacting (Moke) is. */
export interface InteractorPose {
  /** Feet position, world space. */
  readonly position: Vec3Like;
  /** Facing (radians, 0 = +z). */
  readonly heading: number;
}

type InteractionTuning = { readonly [K in keyof typeof INTERACTION]: number };

/**
 * Keeps the registry of interactables and decides which one Moke would use right now: the one
 * he's close to and roughly facing, with priority first. The UI shows it as a prompt; the
 * interact action triggers it. Gameplay objects register themselves; nothing here is sock- or
 * bed-specific, and MokeController never hears about any of it.
 */
export class InteractionSystem {
  private readonly items: Interactable[] = [];
  private currentItem: Interactable | null = null;
  private readonly origin: Vec3Like = { x: 0, y: 0, z: 0 };
  private readonly direction: Vec3Like = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly tuning: InteractionTuning = INTERACTION,
    private readonly probe: ((origin: Vec3Like, direction: Vec3Like, max: number) => number) | null = null,
  ) {}

  /** What E would do right now, or null. Updated by `update()`. */
  get current(): Interactable | null {
    return this.currentItem;
  }

  get count(): number {
    return this.items.length;
  }

  register(item: Interactable): void {
    if (this.items.some((i) => i.id === item.id)) throw new Error(`Interactable "${item.id}" is already registered`);
    this.items.push(item);
  }

  unregister(id: string): void {
    const index = this.items.findIndex((i) => i.id === id);
    if (index >= 0) this.items.splice(index, 1);
    if (this.currentItem?.id === id) this.currentItem = null;
  }

  /** Picks the current target for Moke's pose. Call once per frame, after he has moved. */
  update(actor: InteractorPose): Interactable | null {
    let best: Interactable | null = null;
    let bestPriority = -Infinity;
    let bestScore = Infinity;
    for (const item of this.items) {
      const score = this.score(item, actor);
      if (score === null) continue;
      const priority = item.priority ?? 0;
      if (priority > bestPriority || (priority === bestPriority && score < bestScore)) {
        best = item;
        bestPriority = priority;
        bestScore = score;
      }
    }
    this.currentItem = best;
    return best;
  }

  /** Uses the current target. Returns false if there was nothing to do. */
  interact(): boolean {
    const item = this.currentItem;
    if (!item?.enabled) return false;
    item.interact();
    return true;
  }

  /** Lower is better; null if out of reach, disabled or behind him. */
  private score(item: Interactable, actor: InteractorPose): number | null {
    if (!item.enabled) return null;
    const t = this.tuning;
    const dx = item.position.x - actor.position.x;
    const dz = item.position.z - actor.position.z;
    const distance = Math.hypot(dx, dz);
    if (distance > item.interactionDistance) return null;
    if (item.requiresClearPath !== false) {
      if (Math.abs(item.position.y - actor.position.y) > t.verticalReach) return null;
      if (this.probe) {
        const o = this.origin;
        o.x = actor.position.x;
        o.y = actor.position.y + t.probeHeight;
        o.z = actor.position.z;
        const d = this.direction;
        d.x = dx;
        d.y = item.position.y + t.targetClearance - o.y;
        d.z = dz;
        const length = Math.hypot(d.x, d.y, d.z);
        if (length > 1e-6) {
          d.x /= length;
          d.y /= length;
          d.z /= length;
          if (this.probe(o, d, length) < length - 1e-4) return null;
        }
      }
    }

    let offAngle = 0;
    if (item.requiresFacing !== false && distance > t.facingFreeRadius) {
      offAngle = Math.abs(angleDelta(actor.heading, Math.atan2(dx, dz)));
      if (offAngle > t.facingHalfAngle) return null;
    }
    const score = distance / item.interactionDistance + (offAngle / Math.PI) * t.facingWeight;
    return item === this.currentItem ? score - t.stickiness : score;
  }
}
