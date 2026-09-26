import { Vector3 } from 'three';
import type { Vec3Like } from '../physics/CharacterBody';
import { damp, lerp, smoothstep, wrapAngle } from '../utils/math';
import type { ClearSight } from './HumanAwareness';
import { createVisualState, HumanAnimationController, type LocalPoint } from './HumanAnimationController';
import type { HumanBrain, HumanSenses } from './HumanBrain';
import type { HumanController } from './HumanController';
import type { HumanVisual } from './StylizedHumanVisual';

/** What the human needs to know about Moke and the sock each step (from gameplay, never from meshes). */
export interface HumanWorld {
  readonly moke: Vec3Like;
  readonly mokeCarryingSock: boolean;
  readonly mokeSpeed: number;
  readonly mokeUnderFurniture: boolean;
  readonly mokeBarked: boolean;
  readonly looseSock: Vec3Like | null;
  readonly clear: ClearSight;
  readonly mokeCarrying?: string | null;
  readonly mokeTrick?: boolean;
  readonly mokeLying?: boolean;
}

/** Eye height when standing, and above the seat when sitting (m): for speech bubbles. */
const EYE_STANDING = 1.64;
const EYE_SITTING_ABOVE_SEAT = 0.74;
/** Look at a point this far above the one given (Moke's position is his feet; his face is higher). */
const LOOK_ABOVE = 0.25;
/** How much attention a look gets when the brain doesn't say (0 a glance … 1 full). */
const DEFAULT_LOOK_WEIGHT = 0.6;
/** Sitting down: step across onto the seat over the first part of it, lowering from a little before that ends. */
const SEAT_STEP = 0.55;
const SEAT_LOWER_FROM = 0.45;

/**
 * The human, in four parts kept apart like Moke's gameplay and visuals (D7): behaviour (HumanBrain, with the daily
 * routine plugged into it), body (HumanController: walking, sitting), animation (HumanAnimationController: poses
 * to joint angles) and look (a HumanVisual). A modelled human could replace the look without touching the rest.
 */
export class Human {
  /** The body's feet, between fixed steps. */
  readonly renderPosition = new Vector3();
  /** Where the visual stands this frame: over the seat when sitting. */
  readonly visualPosition = new Vector3();
  readonly animation = new HumanAnimationController();
  private readonly senses: { -readonly [K in keyof HumanSenses]: HumanSenses[K] };
  private readonly visualState = createVisualState();
  /** The visual's last position and heading, to measure how it really moves (so the feet match the ground). */
  private readonly lastPosition = new Vector3();
  private lastHeading: number;
  private readonly lookPoint: LocalPoint = { x: 0, y: 0, z: 0 };
  private readonly reachPoint: LocalPoint = { x: 0, y: 0, z: 0 };

  constructor(
    readonly brain: HumanBrain,
    readonly controller: HumanController,
    readonly visual: HumanVisual,
  ) {
    this.senses = {
      position: controller.position,
      heading: controller.heading,
      arrived: true,
      seated: false,
      stuck: 0,
      mokeCarrying: null,
      mokeTrick: false,
      mokeLying: false,
      moke: { x: 0, y: 0, z: 0 },
      mokeCarryingSock: false,
      mokeSpeed: 0,
      mokeUnderFurniture: false,
      mokeBarked: false,
      looseSock: null,
      clear: () => true,
    };
    this.renderPosition.set(controller.position.x, controller.position.y, controller.position.z);
    this.visualPosition.copy(this.renderPosition);
    this.lastPosition.copy(this.renderPosition);
    this.lastHeading = controller.heading;
  }

  /** The fixed step: perceive, decide, move. */
  fixedUpdate(dt: number, world: HumanWorld): void {
    const s = this.senses;
    s.heading = this.controller.heading;
    s.arrived = this.controller.arrived;
    s.seated = this.controller.seatBlend > 0.5;
    s.stuck = this.controller.stuckFor;
    s.mokeCarrying = world.mokeCarrying ?? null;
    s.mokeTrick = world.mokeTrick ?? false;
    s.mokeLying = world.mokeLying ?? false;
    s.moke = world.moke;
    s.mokeCarryingSock = world.mokeCarryingSock;
    s.mokeSpeed = world.mokeSpeed;
    s.mokeUnderFurniture = world.mokeUnderFurniture;
    s.mokeBarked = world.mokeBarked;
    s.looseSock = world.looseSock;
    s.clear = world.clear;
    this.brain.update(dt, s);
    this.brain.intent.avoid = world.moke;
    this.controller.fixedUpdate(dt, this.brain.intent);
  }

  /** Each rendered frame: place, animate and pose the visual between fixed steps. */
  update(dt: number, alpha: number): void {
    const c = this.controller;
    const { heading } = c.interpolated(alpha, this.renderPosition);
    // Sitting: a step or two across from where the body stands onto the seat, then lowering onto it (the reverse
    // getting up). The legs step because the animation sees the visual really moving.
    const seat = c.seat;
    const across = seat ? smoothstep(0, SEAT_STEP, c.seatBlend) : 0;
    this.visualPosition.set(
      lerp(this.renderPosition.x, seat?.x ?? this.renderPosition.x, across),
      this.renderPosition.y,
      lerp(this.renderPosition.z, seat?.z ?? this.renderPosition.z, across),
    );
    const object = this.visual.object;
    object.position.copy(this.visualPosition);
    object.rotation.y = heading;

    const intent = this.brain.intent;
    const v = this.visualState;
    this.measureMotion(dt, heading);
    v.crouch = intent.crouch;
    v.pose = intent.pose;
    v.headYaw = intent.headYaw;
    v.sit = seat ? smoothstep(SEAT_LOWER_FROM, 1, c.seatBlend) : 0;
    v.sitStyle = seat?.style ?? v.sitStyle;
    v.seatHeight = seat?.height ?? v.seatHeight;
    v.prop = intent.prop;
    v.talking = intent.talking > 0;
    v.surface = intent.surface ?? 0.92;
    v.look = intent.lookAt ? this.toLocal(intent.lookAt, heading, LOOK_ABOVE, this.lookPoint) : null;
    v.lookWeight = intent.lookAt ? (intent.lookWeight ?? DEFAULT_LOOK_WEIGHT) : 0;
    v.reach = intent.reach ? this.toLocal(intent.reach, heading, 0, this.reachPoint) : null;
    this.visual.apply(dt, this.animation.update(dt, v));
  }

  /** A point just above their head (for speech bubbles): lower while kneeling or sitting. */
  headPosition(out: Vector3): Vector3 {
    return out.copy(this.visualPosition).setY(this.visualPosition.y + this.eyeHeight() + 0.2);
  }

  /** How high their eyes are right now (m above the floor). */
  eyeHeight(): number {
    const seat = this.controller.seat;
    const standing = EYE_STANDING - 0.5 * this.brain.intent.crouch;
    return seat ? lerp(standing, seat.height + EYE_SITTING_ABOVE_SEAT, smoothstep(SEAT_LOWER_FROM, 1, this.controller.seatBlend)) : standing;
  }

  /** Back home, folding laundry (Sock Heist replay). */
  reset(home: Vec3Like, facing: Vec3Like): void {
    this.brain.reset();
    this.controller.teleport(home, Math.atan2(facing.x - home.x, facing.z - home.z));
    this.renderPosition.set(home.x, this.controller.position.y, home.z);
    this.visualPosition.copy(this.renderPosition);
    this.lastPosition.copy(this.renderPosition);
    this.lastHeading = this.controller.heading;
  }

  /**
   * How the visual really moved this frame in their own frame (forward, sideways, turning), smoothed: the legs
   * follow the ground, not what the body was asked for, so they never walk on the spot or slide.
   */
  private measureMotion(dt: number, heading: number): void {
    const v = this.visualState;
    const dx = this.visualPosition.x - this.lastPosition.x;
    const dz = this.visualPosition.z - this.lastPosition.z;
    const turn = wrapAngle(heading - this.lastHeading);
    this.lastPosition.copy(this.visualPosition);
    this.lastHeading = heading;
    if (dt <= 0) return;
    if (Math.hypot(dx, dz) > 1 || Math.abs(turn) > 1.5) {
      // Teleported (a replay, a debug jump): nothing to walk.
      v.speed = v.sideSpeed = v.turnRate = 0;
      return;
    }
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    v.speed = damp(v.speed, (dx * sin + dz * cos) / dt, 12, dt);
    v.sideSpeed = damp(v.sideSpeed, (dx * cos - dz * sin) / dt, 12, dt);
    v.turnRate = damp(v.turnRate, turn / dt, 10, dt);
  }

  /** A world point in the character's own space (root at the feet, facing +z, their left +x). */
  private toLocal(p: Vec3Like, heading: number, above: number, out: LocalPoint): LocalPoint {
    const dx = p.x - this.visualPosition.x;
    const dz = p.z - this.visualPosition.z;
    const sin = Math.sin(heading);
    const cos = Math.cos(heading);
    out.x = dx * cos - dz * sin;
    out.y = p.y + above - this.visualPosition.y;
    out.z = dx * sin + dz * cos;
    return out;
  }
}
