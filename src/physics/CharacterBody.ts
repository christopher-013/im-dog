import type { Collider, KinematicCharacterController, Ray, RigidBody, Vector } from '@dimforge/rapier3d-compat';
import { interactionGroups, LAYER, WORLD_QUERY_GROUPS } from './collisionGroups';

/** Moke's capsule collides with everything except toys (the bumper handles those). */
const CAPSULE_GROUPS = interactionGroups(LAYER.character, 0xffff & ~LAYER.toy);
import type { PhysicsWorld } from './PhysicsWorld';

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

export interface CharacterBodyOptions {
  radius: number;
  halfHeight: number;
  /** Gap kept from surfaces (m). */
  skin: number;
  mass: number;
  maxSlopeClimb: number;
  /** Slopes flatter than this (radians) don't make a falling capsule slide. Rapier's default when unset. */
  minSlopeSlide?: number;
  snapToGround: number;
  /**
   * A low, upright cylinder that pushes toys. The capsule's round bottom would otherwise press a
   * small ball down into the floor and ride over it; a vertical face knocks it along instead.
   */
  toyBumper?: { radius: number; halfHeight: number; centerAboveFeet: number };
}

/**
 * An upright kinematic capsule moved by Rapier's character controller: it slides along walls,
 * stays on the floor and can't pass through furniture. It knows nothing about dogs; the
 * gameplay controller decides where it wants to go.
 */
export class CharacterBody {
  /** Capsule centre, world space. */
  readonly center: Vec3Like;
  /** Distance from the capsule centre down to the floor it rests on. */
  readonly centerHeight: number;
  grounded = false;

  private readonly body: RigidBody;
  private readonly collider: Collider;
  private readonly controller: KinematicCharacterController;
  private readonly ray: Ray;
  private readonly computed: Vector;
  private readonly vertical: Vec3Like = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly physics: PhysicsWorld,
    feet: Vec3Like,
    options: CharacterBodyOptions,
  ) {
    const { rapier, world } = physics;
    this.centerHeight = options.halfHeight + options.radius + options.skin;
    this.center = { x: feet.x, y: feet.y + this.centerHeight, z: feet.z };

    this.body = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(this.center.x, this.center.y, this.center.z),
    );
    this.collider = world.createCollider(
      rapier.ColliderDesc.capsule(options.halfHeight, options.radius).setCollisionGroups(CAPSULE_GROUPS),
      this.body,
    );
    const bumper = options.toyBumper;
    if (bumper) {
      world.createCollider(
        rapier.ColliderDesc.cylinder(bumper.halfHeight, bumper.radius)
          .setTranslation(0, bumper.centerAboveFeet - this.centerHeight, 0)
          .setCollisionGroups(interactionGroups(LAYER.character, LAYER.toy)),
        this.body,
      );
    }

    this.controller = world.createCharacterController(options.skin);
    this.controller.setSlideEnabled(true);
    this.controller.enableSnapToGround(options.snapToGround);
    this.controller.setMaxSlopeClimbAngle(options.maxSlopeClimb);
    if (options.minSlopeSlide !== undefined) this.controller.setMinSlopeSlideAngle(options.minSlopeSlide);
    this.controller.setCharacterMass(options.mass);
    // Toys aren't obstacles for the controller (see CAPSULE_GROUPS); this only matters if some
    // other dynamic body ever is.
    this.controller.setApplyImpulsesToDynamicBodies(true);

    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    this.computed = { x: 0, y: 0, z: 0 };
  }

  /**
   * Tries to move by `desired` (metres), resolving collisions. Takes effect on the next physics
   * step. Writes the movement actually applied into `out`.
   */
  move(desired: Vec3Like, out: Vec3Like, options: { noClimbing?: boolean } = {}): Vec3Like {
    this.controller.computeColliderMovement(this.collider, desired, undefined, CAPSULE_GROUPS);
    let applied = this.controller.computedMovement(this.computed);
    // In the air, sliding along an edge can carry the round bottom up and over it, higher than the jump itself
    // would. With `noClimbing`, such a step drops its sideways part instead: he only goes as high as he jumped.
    if (options.noClimbing && applied.y > Math.max(desired.y, 0) + 1e-3) {
      const vertical = this.vertical;
      vertical.y = desired.y;
      this.controller.computeColliderMovement(this.collider, vertical, undefined, CAPSULE_GROUPS);
      applied = this.controller.computedMovement(this.computed);
    }
    this.grounded = this.controller.computedGrounded();

    this.center.x += applied.x;
    this.center.y += applied.y;
    this.center.z += applied.z;
    this.body.setNextKinematicTranslation(this.center);

    out.x = applied.x;
    out.y = applied.y;
    out.z = applied.z;
    return out;
  }

  /** Free space straight above the capsule centre, capped at `max` metres. */
  spaceAbove(max: number): number {
    return this.castVertical(1, max);
  }

  /**
   * Is there something to stand on straight below the capsule centre, within `reach` of the feet? The
   * controller also calls a capsule "grounded" when its round bottom rests on an edge, so this is what tells
   * standing on a surface apart from teetering on its corner.
   */
  groundBelow(reach: number): boolean {
    const max = this.centerHeight + reach;
    return this.castVertical(-1, max) < max;
  }

  private castVertical(direction: 1 | -1, max: number): number {
    this.ray.origin.x = this.center.x;
    this.ray.origin.y = this.center.y;
    this.ray.origin.z = this.center.z;
    this.ray.dir.y = direction;
    const hit = this.physics.world.castRay(this.ray, max, true, undefined, WORLD_QUERY_GROUPS, this.collider);
    return hit ? hit.timeOfImpact : max;
  }
}
