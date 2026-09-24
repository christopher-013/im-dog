import type { Collider, KinematicCharacterController, Ray, RigidBody, Vector } from '@dimforge/rapier3d-compat';
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
  snapToGround: number;
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
    this.collider = world.createCollider(rapier.ColliderDesc.capsule(options.halfHeight, options.radius), this.body);

    this.controller = world.createCharacterController(options.skin);
    this.controller.setSlideEnabled(true);
    this.controller.enableSnapToGround(options.snapToGround);
    this.controller.setMaxSlopeClimbAngle(options.maxSlopeClimb);
    this.controller.setCharacterMass(options.mass);
    // Lets Moke nudge dynamic bodies (the tennis ball, toys) once they exist in Milestone 7.
    this.controller.setApplyImpulsesToDynamicBodies(true);

    this.ray = new rapier.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 });
    this.computed = { x: 0, y: 0, z: 0 };
  }

  /**
   * Tries to move by `desired` (metres), resolving collisions. Takes effect on the next physics
   * step. Writes the movement actually applied into `out`.
   */
  move(desired: Vec3Like, out: Vec3Like): Vec3Like {
    this.controller.computeColliderMovement(this.collider, desired);
    const applied = this.controller.computedMovement(this.computed);
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
    this.ray.origin.x = this.center.x;
    this.ray.origin.y = this.center.y;
    this.ray.origin.z = this.center.z;
    const hit = this.physics.world.castRay(this.ray, max, true, undefined, undefined, this.collider);
    return hit ? hit.timeOfImpact : max;
  }
}
