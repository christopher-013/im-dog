import { HUMAN } from '../config/human';
import type { CharacterBody, Vec3Like } from '../physics/CharacterBody';
import { angleDelta, clamp, lerp, moveToward } from '../utils/math';
import type { HumanIntent } from './HumanBrain';
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

  private previousX: number;
  private previousZ: number;
  private previousHeading: number;
  private readonly path: Point2[] = [];
  private pathIndex = 0;
  private plannedFor: Point2 | null = null;
  private replanIn = 0;
  private stuckFor = 0;
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
    if (goal) {
      const remaining = Math.hypot(goal.x - this.position.x, goal.z - this.position.z);
      if (remaining <= intent.stopWithin) {
        this.arrived = true;
      } else {
        this.plan(goal, dt);
        const waypoint = this.nextWaypoint();
        if (!waypoint) {
          this.arrived = true; // nowhere closer to go
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
    }
    if (this.arrived && intent.face) {
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
  }

  private plan(goal: Vec3Like, dt: number): void {
    this.replanIn -= dt;
    const moved = !this.plannedFor || Math.hypot(goal.x - this.plannedFor.x, goal.z - this.plannedFor.z) > 0.3;
    if (!moved && this.replanIn > 0) return;
    this.nav.findPath(this.position, goal, this.path);
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

  /** Wedged against something: skip ahead a waypoint, or plan afresh. */
  private checkStuck(dt: number, targetSpeed: number): void {
    if (targetSpeed < 0.2) {
      this.stuckFor = 0;
      return;
    }
    this.stuckFor += dt;
    if (this.stuckFor < this.tuning.stuckTime) return;
    const progress = Math.hypot(this.position.x - this.progressFrom.x, this.position.z - this.progressFrom.z);
    if (progress < this.tuning.stuckProgress) {
      if (this.pathIndex < this.path.length - 1) this.pathIndex++;
      else this.plannedFor = null;
    }
    this.stuckFor = 0;
    this.progressFrom.x = this.position.x;
    this.progressFrom.z = this.position.z;
  }
}

function rotateToward(from: number, to: number, maxStep: number): number {
  const delta = angleDelta(from, to);
  return from + clamp(delta, -maxStep, maxStep);
}
