import type { RigidBody } from '@dimforge/rapier3d-compat';
import type { Vec3Like } from './CharacterBody';
import { interactionGroups, LAYER } from './collisionGroups';
import type { PhysicsWorld } from './PhysicsWorld';

export type PropShape =
  | { kind: 'ball'; radius: number }
  | { kind: 'box'; halfExtents: readonly [number, number, number] }
  /** Lying along local z (a rope toy). */
  | { kind: 'capsule'; radius: number; halfLength: number };

export interface PropPhysics {
  shape: PropShape;
  /** kg. */
  mass: number;
  friction: number;
  restitution: number;
  linearDamping: number;
  angularDamping: number;
  /** Moke bumps it along (true), or walks over it without noticing (false, the sock). */
  pushable: boolean;
  /** Hard speed limit (m/s), so a bump can never fling it across the room. */
  maxSpeed: number;
}

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

/**
 * A small dynamic Rapier body for a loose prop (sock, ball, toy). Plain numbers in and out, no
 * three.js. It can be switched off while Moke carries it and dropped back into the world.
 */
export class PropBody {
  /** As of the last `sync()`. */
  readonly position: Vec3Like = { x: 0, y: 0, z: 0 };
  readonly rotation: Quat = { x: 0, y: 0, z: 0, w: 1 };

  private readonly body: RigidBody;

  constructor(
    physics: PhysicsWorld,
    private readonly options: PropPhysics,
    at: Vec3Like,
    heading = 0,
  ) {
    const { rapier, world } = physics;
    const shape = options.shape;
    this.body = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(at.x, at.y, at.z)
        .setRotation(yawQuat(heading, this.rotation))
        .setLinearDamping(options.linearDamping)
        .setAngularDamping(options.angularDamping)
        // Small and quick: without CCD a hard bump could push it through a thin bed bolster.
        .setCcdEnabled(true),
    );
    const desc =
      shape.kind === 'ball'
        ? rapier.ColliderDesc.ball(shape.radius)
        : shape.kind === 'box'
          ? rapier.ColliderDesc.cuboid(...shape.halfExtents)
          : rapier.ColliderDesc.capsule(shape.halfLength, shape.radius).setRotation({ x: Math.SQRT1_2, y: 0, z: 0, w: Math.SQRT1_2 });
    // Unpushable props don't collide with Moke at all, so he never trips over a sock.
    const filter = options.pushable ? 0xffff : 0xffff & ~LAYER.character;
    desc
      .setMass(options.mass)
      .setFriction(options.friction)
      .setRestitution(options.restitution)
      .setCollisionGroups(interactionGroups(LAYER.toy, filter));
    world.createCollider(desc, this.body);
    this.sync();
  }

  get enabled(): boolean {
    return this.body.isEnabled();
  }

  get sleeping(): boolean {
    return this.body.isSleeping();
  }

  /** Current speed (m/s). */
  get speed(): number {
    const v = this.body.linvel();
    return Math.hypot(v.x, v.y, v.z);
  }

  /** After each physics step: clamp the speed and copy the pose out. */
  sync(): void {
    const b = this.body;
    if (b.isEnabled() && !b.isSleeping()) {
      const v = b.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      if (speed > this.options.maxSpeed) {
        const k = this.options.maxSpeed / speed;
        b.setLinvel({ x: v.x * k, y: v.y * k, z: v.z * k }, true);
      }
    }
    const t = b.translation();
    const r = b.rotation();
    this.position.x = t.x;
    this.position.y = t.y;
    this.position.z = t.z;
    this.rotation.x = r.x;
    this.rotation.y = r.y;
    this.rotation.z = r.z;
    this.rotation.w = r.w;
  }

  /** Out of the simulation (carried in Moke's mouth). */
  disable(): void {
    this.body.setEnabled(false);
  }

  /** Back into the simulation at `at`, turned to `heading`, moving with `velocity`. */
  place(at: Vec3Like, heading: number, velocity: Vec3Like = { x: 0, y: 0, z: 0 }): void {
    const b = this.body;
    b.setTranslation(at, false);
    b.setRotation(yawQuat(heading, this.rotation), false);
    b.setLinvel(velocity, false);
    b.setAngvel({ x: 0, y: 0, z: 0 }, false);
    b.setEnabled(true);
    b.wakeUp();
    this.sync();
  }
}

/** Rotation of `heading` radians about +y. */
export function yawQuat(heading: number, out: Quat): Quat {
  out.x = 0;
  out.y = Math.sin(heading / 2);
  out.z = 0;
  out.w = Math.cos(heading / 2);
  return out;
}
