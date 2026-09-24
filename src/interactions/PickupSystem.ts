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
export type WallProbe = (origin: Vec3Like, direction: Vec3Like, max: number) => number;

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
      // Mouth's full: one thing at a time.
      get enabled() {
        return system.carriedItem === null;
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
      ahead = Math.max(0, Math.min(ahead, this.probe(at, f, ahead + t.dropWallGap) - t.dropWallGap));
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
