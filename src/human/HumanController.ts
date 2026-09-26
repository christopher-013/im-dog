import { HUMAN } from '../config/human';
import type { CharacterBody, Vec3Like } from '../physics/CharacterBody';
import { angleDelta, clamp, lerp, moveToward } from '../utils/math';
import type { HumanIntent, SeatSpec } from './HumanBrain';
import type { NavGrid, Point2 } from './NavGrid';

type MoveTuning = typeof HUMAN.move;

/**
 * The human's body: walks where the brain asks along NavGrid paths, at human speeds, with limited acceleration
 * and turning, through the same kind of Rapier character body as Moke (so furniture, walls and Moke himself
 * block it; no teleporting, no clipping). Runs in the fixed step and keeps the previous step for smooth
 * rendering.
 */
export class HumanController {
  heading: number;
  speed = 0;
  /** Reached the goal (or can't get any closer). */
  arrived = true;
  /** Feet position (world). */
  readonly position: Vec3Like;
  /** The seat they're on (or sitting down on, or getting up from), and how far down they are (0 standing … 1 seated). */
  seat: SeatSpec | null = null;
  seatBlend = 0;
  /** Seconds without getting closer to a goal they're walking to (the activity gives up after a while). */
  stuckFor = 0;

  private previousX: number;
  private previousZ: number;
  private previousHeading: number;
  private readonly path: Point2[] = [];
  private pathIndex = 0;
  private plannedFor: Point2 | null = null;
  private replanIn = 0;
  private checkTime = 0;
  private readonly progressFrom: Point2 = { x: 0, z: 0 };
  private readonly desired: Vec3Like = { x: 0, y: 0, z: 0 };
  private readonly applied: Vec3Like = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly body: CharacterBody,
    private readonly nav: NavGrid,
    heading: number,
    private readonly tuning: MoveTuning = HUMAN.move,
  ) {
    this.heading = heading;
    this.position = { x: body.center.x, y: body.center.y - body.centerHeight, z: body.center.z };
    this.previousX = this.position.x;
    this.previousZ = this.position.z;
    this.previousHeading = heading;
  }

  fixedUpdate(dt: number, intent: HumanIntent): void {
    this.previousX = this.position.x;
    this.previousZ = this.position.z;
    this.previousHeading = this.heading;
    const t = this.tuning;

    let targetSpeed = 0;
    let wantHeading = this.heading;
    const goal = intent.goal;
    if (this.updateSeat(dt, intent)) {
      // Sitting, sitting down or getting up: the body stays put, facing the way the seat faces.
      this.arrived = !intent.seat || intent.seat === this.seat;
      wantHeading = this.seat ? this.seat.facing : this.heading;
    } else if (goal) {
      const remaining = Math.hypot(goal.x - this.position.x, goal.z - this.position.z);
      if (remaining <= intent.stopWithin) {
        this.arrived = true;
      } else {
        this.plan(goal, dt, intent.avoid ?? null);
        const waypoint = this.nextWaypoint();
        if (!waypoint) {
          this.arrived = true; // nowhere closer to go
          this.stuckFor = 0;
        } else {
          this.arrived = false;
          wantHeading = Math.atan2(waypoint.x - this.position.x, waypoint.z - this.position.z);
          // Ease in to the stop, and slow for sharp turns (people don't strafe).
          const easeIn = clamp((remaining - intent.stopWithin) * 2 + 0.25, 0, 1);
          const turnFactor = clamp(Math.cos(angleDelta(this.heading, wantHeading)), 0.15, 1);
          targetSpeed = intent.speed * Math.min(easeIn, turnFactor);
          this.checkStuck(dt, targetSpeed);
        }
      }
    } else {
      this.arrived = true;
      this.plannedFor = null;
      this.stuckFor = 0;
    }
    if (this.arrived && intent.face && !this.seat) {
      wantHeading = Math.atan2(intent.face.x - this.position.x, intent.face.z - this.position.z);
    }

    this.heading = rotateToward(this.heading, wantHeading, t.turnRate * dt);
    this.speed = moveToward(this.speed, targetSpeed, (targetSpeed > this.speed ? t.acceleration : t.braking) * dt);

    const d = this.desired;
    d.x = Math.sin(this.heading) * this.speed * dt;
    d.y = 0;
    d.z = Math.cos(this.heading) * this.speed * dt;
    this.body.move(d, this.applied);
    this.position.x = this.body.center.x;
    this.position.y = this.body.center.y - this.body.centerHeight;
    this.position.z = this.body.center.z;
    // Blocked (by Moke, say): don't keep "running" on the spot.
    if (dt > 0 && this.speed > 0.05) {
      const actual = Math.hypot(this.applied.x, this.applied.z) / dt;
      this.speed = Math.min(this.speed, actual + 0.3);
    }
  }

  /** Fully sat down. */
  get seated(): boolean {
    return this.seat !== null && this.seatBlend >= 1;
  }

  /**
   * Sitting down and getting up (true while that holds the body still): once at the seat's stand point and facing
   * the way it faces, they lower themselves onto it; asked to stand (or to use a different seat), they get up first.
   */
  private updateSeat(dt: number, intent: HumanIntent): boolean {
    const t = this.tuning;
    const want = intent.seat;
    if (this.seat && want !== this.seat) {
      this.seatBlend = Math.max(0, this.seatBlend - dt / t.standTime);
      if (this.seatBlend <= 0) this.seat = null;
      return this.seat !== null;
    }
    if (!this.seat && want && intent.goal) {
      const there = Math.hypot(intent.goal.x - this.position.x, intent.goal.z - this.position.z) <= Math.max(intent.stopWithin, t.seatReach);
      if (there && this.speed < 0.25 && Math.abs(angleDelta(this.heading, want.facing)) < t.seatAlign) this.seat = want;
      else if (there) {
        this.heading = rotateToward(this.heading, want.facing, t.turnRate * dt);
        this.speed = moveToward(this.speed, 0, t.braking * dt);
        return true;
      }
    }
    if (this.seat) {
      this.seatBlend = Math.min(1, this.seatBlend + dt / t.sitTime);
      this.speed = 0;
      return true;
    }
    return false;
  }

  /** Where to draw the body between the last two fixed steps. */
  interpolated(alpha: number, out: Vec3Like): { heading: number } {
    out.x = lerp(this.previousX, this.position.x, alpha);
    out.y = this.position.y;
    out.z = lerp(this.previousZ, this.position.z, alpha);
    return { heading: this.previousHeading + angleDelta(this.previousHeading, this.heading) * alpha };
  }

  /** Straight to a spot (Sock Heist replay), no walking. */
  teleport(at: Vec3Like, heading: number): void {
    this.body.center.x = at.x;
    this.body.center.z = at.z;
    this.body.move({ x: 0, y: 0, z: 0 }, this.applied);
    this.position.x = at.x;
    this.position.z = at.z;
    this.previousX = at.x;
    this.previousZ = at.z;
    this.heading = heading;
    this.previousHeading = heading;
    this.speed = 0;
    this.path.length = 0;
    this.plannedFor = null;
    this.seat = null;
    this.seatBlend = 0;
  }

  private plan(goal: Vec3Like, dt: number, avoid: Vec3Like | null): void {
    this.replanIn -= dt;
    const moved = !this.plannedFor || Math.hypot(goal.x - this.plannedFor.x, goal.z - this.plannedFor.z) > 0.3;
    if (!moved && this.replanIn > 0) return;
    // Held up by something that isn't furniture (Moke in the way)? Plan round it, unless it's where they're going.
    const blocking =
      avoid && this.stuckFor > 0 && Math.hypot(avoid.x - this.position.x, avoid.z - this.position.z) < 1.2 && Math.hypot(avoid.x - goal.x, avoid.z - goal.z) > 0.8;
    const found = this.nav.findPath(this.position, goal, this.path, blocking ? { x: avoid.x, z: avoid.z, r: this.tuning.avoidRadius } : null);
    if (!found && blocking) this.nav.findPath(this.position, goal, this.path);
    this.pathIndex = 0;
    this.plannedFor = { x: goal.x, z: goal.z };
    this.replanIn = this.tuning.replanEvery;
  }

  private nextWaypoint(): Point2 | null {
    while (this.pathIndex < this.path.length) {
      const p = this.path[this.pathIndex]!;
      const last = this.pathIndex === this.path.length - 1;
      if (!last && Math.hypot(p.x - this.position.x, p.z - this.position.z) < 0.2) {
        this.pathIndex++;
        continue;
      }
      if (last && Math.hypot(p.x - this.position.x, p.z - this.position.z) < this.tuning.arriveDistance) return null;
      return p;
    }
    return null;
  }

  /** Wedged against something: skip ahead a waypoint, or plan afresh. Counts how long no progress is made. */
  private checkStuck(dt: number, targetSpeed: number): void {
    if (targetSpeed < 0.2) {
      this.checkTime = 0;
      return;
    }
    this.checkTime += dt;
    if (this.checkTime < this.tuning.stuckTime) return;
    const progress = Math.hypot(this.position.x - this.progressFrom.x, this.position.z - this.progressFrom.z);
    if (progress < this.tuning.stuckProgress) {
      // Plan afresh from here (round Moke, if he's what's in the way).
      this.plannedFor = null;
      this.stuckFor += this.checkTime;
    } else {
      this.stuckFor = 0;
    }
    this.checkTime = 0;
    this.progressFrom.x = this.position.x;
    this.progressFrom.z = this.position.z;
  }
}

function rotateToward(from: number, to: number, maxStep: number): number {
  const delta = angleDelta(from, to);
  return from + clamp(delta, -maxStep, maxStep);
}
