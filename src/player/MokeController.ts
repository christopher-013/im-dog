import { Vector3 } from 'three';
import { JUMP, MOVEMENT, type JumpTuning, type MovementTuning } from '../config/movement';
import type { CharacterBody, Vec3Like } from '../physics/CharacterBody';
import { angleDelta, moveToward } from '../utils/math';
import { createLocomotionState, gaitForSpeed, stepLocomotion, type Gait, type LocomotionState, type MoveIntent } from './Locomotion';

/** How far up to look for low furniture (m above the capsule centre). */
const HEADROOM_PROBE = 0.5;
/** Blocked almost head-on if Moke moves less than this fraction of the speed he's trying for... */
const BLOCKED_RATIO = 0.25;
/** ...for this many fixed steps in a row (ignores one-off contact glitches). */
const BLOCKED_STEPS = 2;
/** Not on the ground for this many fixed steps in a row: he's in the air (walked off the couch, say). */
const AIRBORNE_STEPS = 2;
/** Standing means something solid this close below his feet, straight under his middle (m). */
const SUPPORT_REACH = 0.025;

/**
 * Take-off speed (m/s) that lifts his feet exactly `rise` metres at the top of the jump, for this controller's
 * integration: the take-off step moves at full speed, and gravity starts from the next step.
 */
export function jumpSpeed(rise: number, gravity: number, dt: number): number {
  return Math.max(0, Math.sqrt(2 * gravity * rise) - (gravity * dt) / 2);
}

/**
 * Moke's gameplay body: position, facing, speed and collision. It doesn't know what Moke looks
 * like. The visual (the toon Moke today, maybe moke.glb later) only ever reads from it.
 *
 * Runs in the fixed step and keeps the previous step's state, so visuals and the camera can
 * interpolate smoothly on high-refresh displays.
 */
export class MokeController {
  readonly locomotion: LocomotionState;
  /** Feet position (ground point under the capsule), world space, as of the last fixed step. */
  readonly position = new Vector3();
  /** Horizontal speed actually achieved after collisions (m/s). */
  actualSpeed = 0;
  /** Free space above Moke's feet (m), for ducking under furniture. Infinity when nothing is low overhead. */
  headroom = Infinity;
  /** In the air: jumping, or dropping off something. */
  airborne = false;
  /** Up (+) or down (−), m/s. */
  verticalSpeed = 0;

  private readonly previousPosition = new Vector3();
  private previousHeading: number;
  private blockedSteps = 0;
  private ungroundedSteps = 0;
  /** On the ground with something under his middle, not teetering on an edge (see CharacterBody.groundBelow). */
  private standing = true;
  /** Seconds a jump press stays valid (JUMP.buffer), so one just before landing still counts. */
  private jumpRequest = 0;
  private readonly desired: Vec3Like = { x: 0, y: 0, z: 0 };
  private readonly applied: Vec3Like = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly body: CharacterBody,
    heading: number,
    readonly tuning: MovementTuning = MOVEMENT,
    readonly jumpTuning: JumpTuning = JUMP,
  ) {
    this.locomotion = createLocomotionState(heading);
    this.previousHeading = heading;
    // Settle onto the floor and probe the surroundings, so state is valid before the first step.
    this.body.move(this.desired, this.applied);
    this.standing = this.body.grounded && this.body.groundBelow(SUPPORT_REACH);
    this.probeHeadroom();
    this.syncPositionFromBody();
    this.previousPosition.copy(this.position);
  }

  get heading(): number {
    return this.locomotion.heading;
  }

  get grounded(): boolean {
    return this.standing;
  }

  get gait(): Gait {
    return gaitForSpeed(this.actualSpeed, this.tuning);
  }

  /**
   * Jump at the next fixed step if he can: on his feet, with nothing low overhead (no jumping under the coffee
   * table), and below the height cap. A press just before he lands counts too.
   */
  requestJump(): void {
    this.jumpRequest = this.jumpTuning.buffer;
  }

  fixedUpdate(dt: number, intent: MoveIntent): void {
    this.previousPosition.copy(this.position);
    this.previousHeading = this.locomotion.heading;

    stepLocomotion(this.locomotion, intent, this.tuning, dt);
    const { speed, heading } = this.locomotion;

    const jumped = this.tryJump(dt);
    if (!jumped) this.fall(dt);

    this.desired.x = Math.sin(heading) * speed * dt;
    this.desired.y = this.verticalSpeed * dt;
    this.desired.z = Math.cos(heading) * speed * dt;
    this.body.move(this.desired, this.applied, { noClimbing: jumped || this.airborne });

    this.actualSpeed = Math.hypot(this.applied.x, this.applied.z) / dt;
    // Running into a wall head-on: drop the stored speed so he doesn't burst off at full speed
    // the moment he turns away. Glancing contacts keep their speed and slide along. Not in mid-air: jumping
    // at the couch, his momentum is what carries him over the edge.
    const blocked = !this.airborne && speed > 0.2 && this.actualSpeed < speed * BLOCKED_RATIO;
    this.blockedSteps = blocked ? this.blockedSteps + 1 : 0;
    if (this.blockedSteps >= BLOCKED_STEPS) this.locomotion.speed = this.actualSpeed;

    this.afterVerticalMove(jumped);
    this.syncPositionFromBody();
    this.probeHeadroom();
  }

  /**
   * Gravity only while airborne. On the ground, snap-to-ground keeps him planted; pushing down
   * into the floor as well makes Rapier's controller occasionally drop a step's horizontal movement.
   */
  private fall(dt: number): void {
    const onGround = this.standing && this.verticalSpeed <= 0;
    this.verticalSpeed = onGround ? 0 : this.verticalSpeed - this.jumpTuning.gravity * dt;
  }

  /** After a move: a bumped head ends the rise; a couple of steps off the ground means he's in the air. */
  private afterVerticalMove(jumped: boolean): void {
    if (this.desired.y > 0 && this.applied.y < this.desired.y * 0.5) this.verticalSpeed = 0;
    // A round bottom resting on an edge (jumping short of the TV console, say) isn't standing: he slides off.
    this.standing = this.body.grounded && this.body.groundBelow(SUPPORT_REACH);
    this.ungroundedSteps = this.standing ? 0 : this.ungroundedSteps + 1;
    if (jumped || this.ungroundedSteps >= AIRBORNE_STEPS) this.airborne = true;
    else if (this.standing && this.verticalSpeed <= 0) this.airborne = false;
  }

  /** Takes off if a jump was asked for and he can (see requestJump). */
  private tryJump(dt: number): boolean {
    if (this.jumpRequest <= 0) return false;
    this.jumpRequest = Math.max(0, this.jumpRequest - dt);
    const j = this.jumpTuning;
    const rise = j.maxHeight - this.position.y;
    if (!this.standing || this.airborne || this.headroom !== Infinity || rise < j.minRise) return false;
    this.verticalSpeed = jumpSpeed(rise, j.gravity, dt);
    this.jumpRequest = 0;
    return true;
  }

  /**
   * Scripted step: shuffle toward `target` at `speed` (m/s) and turn toward `heading` at `turnRate`
   * (rad/s), still colliding normally. Used to settle into his bed.
   */
  glideTo(dt: number, target: Vec3Like, heading: number, speed: number, turnRate: number): void {
    this.previousPosition.copy(this.position);
    this.previousHeading = this.locomotion.heading;

    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const distance = Math.hypot(dx, dz);
    const step = Math.min(distance, speed * dt);
    this.fall(dt);
    this.desired.x = distance > 1e-6 ? (dx / distance) * step : 0;
    this.desired.y = this.verticalSpeed * dt;
    this.desired.z = distance > 1e-6 ? (dz / distance) * step : 0;
    this.body.move(this.desired, this.applied);
    this.afterVerticalMove(false);

    const l = this.locomotion;
    const before = l.heading;
    l.heading = before + moveToward(0, angleDelta(before, heading), turnRate * dt);
    l.turnRate = angleDelta(before, l.heading) / dt;
    l.speed = 0;
    l.targetSpeed = 0;
    this.actualSpeed = Math.hypot(this.applied.x, this.applied.z) / dt;
    this.syncPositionFromBody();
    this.probeHeadroom();
  }

  private probeHeadroom(): void {
    const above = this.body.spaceAbove(HEADROOM_PROBE);
    this.headroom = above >= HEADROOM_PROBE ? Infinity : above + this.body.centerHeight;
  }

  /** Feet position blended between the last two fixed steps (alpha 0..1). */
  interpolatedPosition(alpha: number, out: Vector3): Vector3 {
    return out.lerpVectors(this.previousPosition, this.position, alpha);
  }

  interpolatedHeading(alpha: number): number {
    return this.previousHeading + angleDelta(this.previousHeading, this.locomotion.heading) * alpha;
  }

  private syncPositionFromBody(): void {
    const c = this.body.center;
    this.position.set(c.x, c.y - this.body.centerHeight, c.z);
  }
}
