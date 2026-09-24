import type { World } from '@dimforge/rapier3d-compat';
import { TIMING } from '../config/engine';
import { MOVEMENT } from '../config/movement';

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
}

/**
 * Owns the Rapier world. Rapier (WASM) is loaded lazily into its own chunk while the loading
 * screen is up, and stepped at the game's fixed timestep.
 */
export class PhysicsWorld {
  readonly world: World;

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
    for (const { center, halfExtents, rotation } of boxes) {
      const desc = this.rapier.ColliderDesc.cuboid(halfExtents[0], halfExtents[1], halfExtents[2])
        .setTranslation(center[0], center[1], center[2])
        .setRotation({ x: rotation[0], y: rotation[1], z: rotation[2], w: rotation[3] });
      this.world.createCollider(desc);
    }
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
