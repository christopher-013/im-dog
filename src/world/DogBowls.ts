import { BufferGeometry, CircleGeometry, Group, IcosahedronGeometry, Mesh, MeshStandardMaterial } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { Vec3Like } from '../physics/CharacterBody';
import { mulberry32 } from '../utils/random';

export type BowlKind = 'food' | 'water';

/** Where the bowls are (world): the middle of each bowl, on the floor. */
export interface BowlPlaces {
  readonly food: Vec3Like;
  readonly water: Vec3Like;
}

/**
 * What's in Moke's bowls: kibble in the slow feeder and water in the steel bowl (the bowls themselves are part of the
 * house). Each is a level from 0 (empty) to 1 (full): eating or drinking drains it over the time he takes, and the
 * human refills it (see human/activities/BowlRefill). Visual state plus a little logic; no physics.
 */
export class DogBowls {
  readonly object = new Group();
  /** Called once a bowl has been emptied. */
  onEmptied: ((kind: BowlKind) => void) | null = null;

  private readonly levels: Record<BowlKind, number> = { food: 1, water: 1 };
  private readonly draining: Record<BowlKind, number> = { food: 0, water: 0 };
  private readonly kibble: Mesh;
  private readonly water: Mesh;
  private readonly materials: MeshStandardMaterial[] = [];

  constructor(private readonly places: BowlPlaces) {
    this.object.name = 'DogBowls';
    const kibbleMaterial = new MeshStandardMaterial({ color: '#a86a3c', roughness: 0.85 });
    const waterMaterial = new MeshStandardMaterial({ color: '#8fcbe6', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.78 });
    this.materials.push(kibbleMaterial, waterMaterial);
    this.kibble = new Mesh(kibbleGeometry(), kibbleMaterial);
    this.kibble.name = 'bowl:food';
    this.kibble.position.set(places.food.x, 0.028, places.food.z);
    this.water = new Mesh(new CircleGeometry(1, 28).rotateX(-Math.PI / 2), waterMaterial);
    this.water.name = 'bowl:water';
    this.water.position.set(places.water.x, 0, places.water.z);
    this.kibble.receiveShadow = true;
    this.object.add(this.kibble, this.water);
    this.show();
  }

  /** How full a bowl is (0 empty … 1 full). */
  level(kind: BowlKind): number {
    return this.levels[kind];
  }

  /** Where a bowl is (world). */
  position(kind: BowlKind): Vec3Like {
    return this.places[kind];
  }

  /** Anything worth eating or drinking there? */
  has(kind: BowlKind): boolean {
    return this.levels[kind] > 0.05 && this.draining[kind] === 0;
  }

  /** Moke eats (or drinks) it all, over `seconds`. */
  finish(kind: BowlKind, seconds: number): void {
    if (this.levels[kind] <= 0) return;
    this.draining[kind] = this.levels[kind] / Math.max(0.1, seconds);
  }

  /** Filled up again (by the human). */
  refill(kind: BowlKind): void {
    this.levels[kind] = 1;
    this.draining[kind] = 0;
    this.show();
  }

  update(dt: number): void {
    for (const kind of ['food', 'water'] as const) {
      const rate = this.draining[kind];
      if (rate === 0) continue;
      this.levels[kind] = Math.max(0, this.levels[kind] - rate * dt);
      if (this.levels[kind] === 0) {
        this.draining[kind] = 0;
        this.onEmptied?.(kind);
      }
    }
    this.show();
  }

  dispose(): void {
    this.kibble.geometry.dispose();
    this.water.geometry.dispose();
    for (const m of this.materials) m.dispose();
    this.object.removeFromParent();
  }

  private show(): void {
    const food = this.levels.food;
    this.kibble.visible = food > 0.02;
    this.kibble.scale.set(0.55 + 0.45 * food, 0.2 + 0.8 * food, 0.55 + 0.45 * food);
    const water = this.levels.water;
    this.water.visible = water > 0.02;
    // The steel bowl widens toward its rim: a fuller bowl has a wider surface.
    const radius = 0.083 + 0.01 * water;
    this.water.scale.set(radius, 1, radius);
    this.water.position.y = 0.03 + 0.03 * water;
  }
}

/** A heaped portion of kibble: little brown nuggets, most in the middle, merged into one mesh. */
function kibbleGeometry(): BufferGeometry {
  const random = mulberry32(12);
  const pieces: BufferGeometry[] = [];
  for (let i = 0; i < 46; i++) {
    const r = Math.sqrt(random()) * 0.085;
    const a = random() * Math.PI * 2;
    const heap = 1 - r / 0.1;
    const piece = new IcosahedronGeometry(0.011 + random() * 0.004, 0).scale(1, 0.7, 1);
    piece.rotateX(random() * 3).rotateY(random() * 3);
    pieces.push(piece.translate(Math.cos(a) * r, 0.006 + heap * 0.028 * random(), Math.sin(a) * r));
  }
  const merged = mergeGeometries(pieces, false);
  for (const p of pieces) p.dispose();
  return merged!;
}
