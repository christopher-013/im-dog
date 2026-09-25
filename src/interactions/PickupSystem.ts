import { PICKUP } from '../config/props';
import type { Vec3Like } from '../physics/CharacterBody';
import type { InteractionSystem } from './InteractionSystem';

/** Anything Moke can carry in his mouth. */
export interface Carryable {
  readonly id: string;
  /** For prompts: "Pick Up Sock", "Drop Sock". */
  readonly name: string;
  /** World position now. */
  readonly position: Vec3Like;
  /** Conservative physics radius used to keep the entire dropped object clear of scenery. */
  readonly dropRadius?: number;
  /** Held by someone else right now (a human took it back): not available to pick up. */
  readonly carried?: boolean;
  /** Leaves the physics world (it now rides in his mouth). */
  pickUp(): void;
  /** Back into the physics world at `at`, facing `heading`, moving with `velocity`. */
  drop(at: Vec3Like, heading: number, velocity: Vec3Like): void;
}

/** The one carrying: Moke's controller satisfies this. */
export interface Carrier {
  readonly position: Vec3Like;
  readonly heading: number;
  /** Ground speed (m/s) along `heading`. */
  readonly actualSpeed: number;
}

/** Free distance ahead from `origin` along unit `direction`, up to `max` (walls, furniture). */
export type WallProbe = (origin: Vec3Like, direction: Vec3Like, max: number, radius: number) => number;

type PickupTuning = { readonly [K in keyof typeof PICKUP]: number };

/**
 * Pick up, carry and drop, for any Carryable. It registers a PICKUP interactable per item and
 * one DROP interactable ("Drop Sock") that wins while something is carried. It computes where
 * a dropped item goes from Moke's gameplay pose, never from his mesh; presentation (attaching
 * the item's view to the mouth socket) listens through `onPickUp` / `onDrop`.
 */
export class PickupSystem<T extends Carryable = Carryable> {
  onPickUp: ((item: T) => void) | null = null;
  onDrop: ((item: T) => void) | null = null;
  /** He let go of it into someone's hand (a trade): it didn't go back into the world. */
  onHandOver: ((item: T) => void) | null = null;

  private carriedItem: T | null = null;
  private readonly items: T[] = [];
  private readonly dropAt: Vec3Like = { x: 0, y: 0, z: 0 };
  private readonly dropVelocity: Vec3Like = { x: 0, y: 0, z: 0 };
  private readonly forward: Vec3Like = { x: 0, y: 0, z: 1 };

  constructor(
    private readonly interactions: InteractionSystem,
    private readonly carrier: Carrier,
    private readonly probe: WallProbe | null = null,
    private readonly tuning: PickupTuning = PICKUP,
  ) {
    const system = this;
    interactions.register({
      id: 'pickup:drop',
      type: 'DROP',
      get label() {
        return `Drop ${system.carriedItem?.name ?? ''}`;
      },
      interactionDistance: Infinity,
      get enabled() {
        return system.carriedItem !== null;
      },
      position: carrier.position,
      requiresFacing: false,
      requiresClearPath: false,
      priority: 10,
      interact: () => this.drop(),
    });
  }

  get carried(): T | null {
    return this.carriedItem;
  }

  get registered(): readonly T[] {
    return this.items;
  }

  add(item: T): void {
    this.items.push(item);
    const system = this;
    this.interactions.register({
      id: `pickup:${item.id}`,
      type: 'PICKUP',
      label: `Pick Up ${item.name}`,
      interactionDistance: this.tuning.reach,
      // Mouth's full: one thing at a time. And not while someone else is holding it.
      get enabled() {
        return system.carriedItem === null && !item.carried;
      },
      get position() {
        return item.position;
      },
      interact: () => this.pickUp(item),
    });
  }

  pickUp(item: T): boolean {
    if (this.carriedItem) return false;
    this.carriedItem = item;
    item.pickUp();
    this.onPickUp?.(item);
    return true;
  }

  /**
   * Lets go of what he's carrying into someone else's hands (a trade): it stays out of the physics world, and
   * whoever took it decides where it goes. Returns the item, or null if his mouth was empty.
   */
  handOver(): T | null {
    const item = this.carriedItem;
    if (!item) return null;
    this.carriedItem = null;
    this.onHandOver?.(item);
    return item;
  }

  /** Drops what he's carrying just ahead of his mouth, kept clear of walls. */
  drop(): T | null {
    const item = this.carriedItem;
    if (!item) return null;
    const t = this.tuning;
    const c = this.carrier;
    const f = this.forward;
    f.x = Math.sin(c.heading);
    f.z = Math.cos(c.heading);

    const at = this.dropAt;
    at.y = c.position.y + t.dropHeight;
    let ahead = t.dropForward;
    if (this.probe) {
      at.x = c.position.x;
      at.z = c.position.z;
      ahead = Math.max(0, Math.min(ahead, this.probe(at, f, ahead + t.dropWallGap, item.dropRadius ?? 0) - t.dropWallGap));
    }
    at.x = c.position.x + f.x * ahead;
    at.z = c.position.z + f.z * ahead;

    const v = this.dropVelocity;
    v.x = f.x * c.actualSpeed * t.dropCarryVelocity;
    v.y = 0;
    v.z = f.z * c.actualSpeed * t.dropCarryVelocity;

    this.carriedItem = null;
    item.drop(at, c.heading, v);
    this.onDrop?.(item);
    return item;
  }
}
