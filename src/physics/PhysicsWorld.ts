import type { Ball, Ray, World } from '@dimforge/rapier3d-compat';
import { TIMING } from '../config/engine';
import { MOVEMENT } from '../config/movement';
import type { Vec3Like } from './CharacterBody';
import { CAMERA_QUERY_GROUPS, interactionGroups, LAYER, WORLD_QUERY_GROUPS } from './collisionGroups';

export type Rapier = typeof import('@dimforge/rapier3d-compat');

/**
 * A static box collider in world space. Plain data, so world-building code can describe its
 * colliders without importing Rapier.
 */
export interface StaticBox {
  center: readonly [number, number, number];
  halfExtents: readonly [number, number, number];
  /** Quaternion (x, y, z, w). */
  rotation: readonly [number, number, number, number];
  /** Thin things (table legs) set this to false so the camera doesn't jump in and out as they pass. Default true. */
  blocksCamera?: boolean;
}

const IDENTITY_ROTATION = { x: 0, y: 0, z: 0, w: 1 };

/**
 * Owns the Rapier world. Rapier (WASM) is loaded lazily into its own chunk while the loading
 * screen is up, and stepped at the game's fixed timestep.
 */
export class PhysicsWorld {
  readonly world: World;
  private sweepBall: Ball | null = null;
  private ray: Ray | null = null;

  static async create(gravity: number = MOVEMENT.gravity, timestep: number = TIMING.fixedStep): Promise<PhysicsWorld> {
    const rapier = await import('@dimforge/rapier3d-compat');
    await rapier.init();
    return new PhysicsWorld(rapier, gravity, timestep);
  }

  private constructor(
    readonly rapier: Rapier,
    gravity: number,
    timestep: number,
  ) {
    this.world = new rapier.World({ x: 0, y: -gravity, z: 0 });
    this.world.timestep = timestep;
  }

  get version(): string {
    return this.rapier.version();
  }

  get colliderCount(): number {
    return this.world.colliders.len();
  }

  get bodyCount(): number {
    return this.world.bodies.len();
  }

  addStaticBoxes(boxes: readonly StaticBox[]): void {
    for (const { center, halfExtents, rotation, blocksCamera } of boxes) {
      const desc = this.rapier.ColliderDesc.cuboid(halfExtents[0], halfExtents[1], halfExtents[2])
        .setTranslation(center[0], center[1], center[2])
        .setRotation({ x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] })
        .setCollisionGroups(interactionGroups(blocksCamera === false ? LAYER.worldThin : LAYER.world));
      this.world.createCollider(desc);
    }
  }

  /**
   * How far a sphere can travel from `origin` along the unit `direction` before touching solid world
   * geometry, up to `maxDistance`. Ignores Moke, thin props and toys. Used by the camera.
   */
  sweepSphere(origin: Vec3Like, direction: Vec3Like, radius: number, maxDistance: number): number {
    return this.castSphere(origin, direction, radius, maxDistance, CAMERA_QUERY_GROUPS, false);
  }

  /** Clearance for dropped props: includes thin furniture, and stops at any initial overlap. */
  sweepWorldSphere(origin: Vec3Like, direction: Vec3Like, radius: number, maxDistance: number): number {
    return this.castSphere(origin, direction, radius, maxDistance, WORLD_QUERY_GROUPS, true);
  }

  private castSphere(origin: Vec3Like, direction: Vec3Like, radius: number, maxDistance: number, groups: number, stopAtPenetration: boolean): number {
    if (this.sweepBall?.radius !== radius) this.sweepBall = new this.rapier.Ball(radius);
    const hit = this.world.castShape(
      origin,
      IDENTITY_ROTATION,
      direction,
      this.sweepBall,
      0,
      maxDistance,
      stopAtPenetration,
      undefined,
      groups,
    );
    return hit ? hit.time_of_impact : maxDistance;
  }

  /**
   * Free distance along the unit `direction` from `origin` before hitting static world geometry
   * (walls, furniture, legs), up to `maxDistance`. Ignores Moke and toys.
   */
  rayDistance(origin: Vec3Like, direction: Vec3Like, maxDistance: number): number {
    const ray = (this.ray ??= new this.rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }));
    ray.origin.x = origin.x;
    ray.origin.y = origin.y;
    ray.origin.z = origin.z;
    ray.dir.x = direction.x;
    ray.dir.y = direction.y;
    ray.dir.z = direction.z;
    const hit = this.world.castRay(ray, maxDistance, true, undefined, WORLD_QUERY_GROUPS);
    return hit ? hit.timeOfImpact : maxDistance;
  }

  /**
   * Is there a clear line of sight from `from` to `to`? Only solid scenery blocks it (walls, the couch, the
   * coffee table's top): thin legs, props and characters don't. Used for the human's eyes.
   */
  lineOfSight(from: Vec3Like, to: Vec3Like): boolean {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const length = Math.hypot(dx, dy, dz);
    if (length < 1e-6) return true;
    const ray = (this.ray ??= new this.rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }));
    ray.origin.x = from.x;
    ray.origin.y = from.y;
    ray.origin.z = from.z;
    ray.dir.x = dx / length;
    ray.dir.y = dy / length;
    ray.dir.z = dz / length;
    return this.world.castRay(ray, length, true, undefined, CAMERA_QUERY_GROUPS) === null;
  }

  /**
   * Scene queries (ray casts, the character controller) only see colliders after a step.
   * Call once after adding static geometry and before the first query.
   */
  commitStaticGeometry(): void {
    this.world.step();
  }

  step(): void {
    this.world.step();
  }
}
