import { COURSE, COURSE_RULES, COURSE_TEXT } from '../config/obstacleCourse';
import type { Vec3Like } from '../physics/CharacterBody';

const TAU = Math.PI * 2;

/** A point on the course's loop at angle `a` (see COURSE), `out` metres outward from its middle line. */
export function coursePoint(a: number, out = 0): { x: number; z: number } {
  const r = COURSE.radius + out;
  const t = a + COURSE.turn;
  return { x: COURSE.center.x - Math.cos(t) * r, z: COURSE.center.z + Math.sin(t) * r };
}

/** The yaw that faces the way round the loop at angle `a` (local +z forward). */
export function courseYaw(a: number): number {
  return a + COURSE.turn;
}

/** The way round the loop at angle `a` (a unit vector, flat). */
export function courseForward(a: number): { x: number; z: number } {
  return { x: Math.sin(a + COURSE.turn), z: Math.cos(a + COURSE.turn) };
}

/** Where a floor point is on the loop: its angle (0…2π) and how far it is from the middle line (outward +). */
export function courseAngle(x: number, z: number): { a: number; off: number } {
  const dx = x - COURSE.center.x;
  const dz = z - COURSE.center.z;
  let a = Math.atan2(dz, -dx) - COURSE.turn;
  a = ((a % TAU) + TAU) % TAU;
  return { a, off: Math.hypot(dx, dz) - COURSE.radius };
}

export type CourseStation = 'hurdles' | 'weave' | 'hill' | 'finish';
export type CoursePhase = 'idle' | 'running' | 'done';

export interface CourseMoke {
  readonly position: Vec3Like;
  readonly grounded: boolean;
}

export interface CourseEvents {
  onStart?(): void;
  /** A station finished (the next one is live). */
  onStation?(station: Exclude<CourseStation, 'finish'>): void;
  /** One obstacle within a station: a hurdle cleared, a pole passed the right way. */
  onObstacle?(): void;
  onComplete?(seconds: number): void;
}

/**
 * Liam's Obstacle Course, as rules (Phase 5): through the arch, over two hurdles (a jump each), in and out of five
 * weave poles, up and over the hill, back through the arch. Stations count in order; anything done out of order or
 * the wrong way simply doesn't count yet, so there's no failing, only "keep going". Fed Moke's position each fixed
 * step; knows nothing of the scenery or the game.
 */
export class ObstacleCourse {
  phase: CoursePhase = 'idle';
  station: CourseStation = 'hurdles';
  /** Hurdles cleared / poles passed, in the current station. */
  count = 0;
  /** Seconds since this run started. */
  elapsed = 0;
  /** Near the course (or on it): the HUD shows its line. */
  near = false;
  private prev: { a: number; off: number } | null = null;
  private weaveSide = 0;
  private onHill = false;
  private oops = 0;

  constructor(private readonly events: CourseEvents = {}) {}

  get hurdleCount(): number {
    return COURSE.hurdles.at.length;
  }

  /** The line for the HUD, or null when he's nowhere near it. */
  get objective(): string | null {
    if (this.phase === 'running') {
      if (this.oops > 0) return COURSE_TEXT.weaveOops;
      switch (this.station) {
        case 'hurdles': return COURSE_TEXT.hurdles(this.count, this.hurdleCount);
        case 'weave': return COURSE_TEXT.weave(this.count, COURSE.weave.count);
        case 'hill': return COURSE_TEXT.hill;
        case 'finish': return COURSE_TEXT.finish;
      }
    }
    return this.near && this.phase === 'idle' ? COURSE_TEXT.start : null;
  }

  /** Starts over (a replay). */
  reset(): void {
    this.phase = 'idle';
    this.station = 'hurdles';
    this.count = 0;
    this.elapsed = 0;
    this.prev = null;
    this.weaveSide = 0;
    this.onHill = false;
    this.oops = 0;
  }

  /** Each fixed step. `outside`: he's in the backyard (going back indoors calls off a run in progress). */
  update(dt: number, moke: CourseMoke, outside: boolean): void {
    const p = moke.position;
    const now = courseAngle(p.x, p.z);
    this.near = outside && Math.abs(now.off) < COURSE_RULES.nearBy;
    this.oops = Math.max(0, this.oops - dt);
    if (!outside) {
      if (this.phase !== 'idle') this.reset();
      return;
    }
    if (this.phase === 'running') this.elapsed += dt;
    const prev = this.prev;
    this.prev = now;
    if (!prev) return;
    // Only going forward round the loop, and never a jump across the middle of it.
    let da = now.a - prev.a;
    if (da > Math.PI) da -= TAU;
    if (da < -Math.PI) da += TAU;
    if (da <= 0 || da > 0.5) return;
    const crossed = (at: number) => {
      const from = prev.a;
      const to = prev.a + da;
      return (from < at && to >= at) || (from < at + TAU && to >= at + TAU);
    };
    const onLane = Math.abs(now.off) <= COURSE.laneHalfWidth + 0.2;

    // Through the arch: a new run (or, with everything done, the finish).
    if (crossed(COURSE.arch.at) && onLane) {
      if (this.phase === 'running' && this.station === 'finish') {
        this.phase = 'done';
        this.events.onComplete?.(this.elapsed);
        return;
      }
      if (this.phase !== 'running' || this.station === 'hurdles') this.begin();
      return;
    }
    if (this.phase !== 'running') return;

    switch (this.station) {
      case 'hurdles': {
        const at = COURSE.hurdles.at[this.count];
        if (at !== undefined && crossed(at) && Math.abs(now.off) <= COURSE.hurdles.halfWidth + 0.1) {
          if (!moke.grounded || p.y >= COURSE_RULES.jumpClear) {
            this.count++;
            this.events.onObstacle?.();
            if (this.count >= this.hurdleCount) this.next('hurdles', 'weave');
          }
        }
        break;
      }
      case 'weave': {
        const w = COURSE.weave;
        for (let i = 0; i < w.count; i++) {
          if (!crossed(w.from + i * w.step) || Math.abs(now.off) > COURSE_RULES.weaveReach) continue;
          const side = Math.sign(now.off) || 1;
          if (i === this.count && (i === 0 || side !== this.weaveSide)) {
            this.count++;
            this.weaveSide = side;
            this.events.onObstacle?.();
            if (this.count >= w.count) this.next('weave', 'hill');
          } else {
            // The same side twice, or a pole missed: start the weave again (this pole can be the first).
            this.oops = 2;
            this.count = i === 0 ? 1 : 0;
            this.weaveSide = side;
          }
        }
        break;
      }
      case 'hill': {
        const h = COURSE.hill;
        const along = Math.abs(now.a - h.at) * COURSE.radius;
        if (along <= h.flatHalf + 0.15 && Math.abs(now.off) <= h.halfWidth && p.y >= h.top - COURSE_RULES.hillTopSlack) this.onHill = true;
        if (this.onHill && crossed(h.at + h.halfLength / COURSE.radius)) this.next('hill', 'finish');
        break;
      }
      case 'finish':
        break;
    }
  }

  private begin(): void {
    this.phase = 'running';
    this.station = 'hurdles';
    this.count = 0;
    this.elapsed = 0;
    this.weaveSide = 0;
    this.onHill = false;
    this.events.onStart?.();
  }

  private next(done: Exclude<CourseStation, 'finish'>, then: CourseStation): void {
    this.station = then;
    this.count = 0;
    this.events.onStation?.(done);
  }
}
