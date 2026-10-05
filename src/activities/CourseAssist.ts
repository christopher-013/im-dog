import { COURSE, COURSE_ASSIST, COURSE_TEXT, HURDLE_HOP } from '../config/obstacleCourse';
import type { Interactable } from '../interactions/Interactable';
import type { Vec3Like } from '../physics/CharacterBody';
import { type ObstacleCourse, courseAngle, coursePoint } from './ObstacleCourse';

export interface AssistMoke {
  readonly position: Vec3Like;
  readonly grounded: boolean;
}

/** This fixed step's move while helping: which way (world x/z, unit or less), running, and a jump to press. */
export interface AssistCommand {
  x: number;
  z: number;
  run: boolean;
  jump: boolean;
}

interface Waypoint {
  readonly x: number;
  readonly z: number;
  readonly run: boolean;
  /** Jump once he's this close (m) to this point, and only count it reached after landing. */
  readonly jumpAt?: number;
}

type Offer = { readonly kind: 'hurdle' | 'weave'; readonly index: number; readonly at: number };

const TAU = Math.PI * 2;

/**
 * One-press help on Liam's Obstacle Course (owner, 2026-10-05): during a run, coming up to the next hurdle the paw
 * (E) offers "Jump Hurdle", and at the weave poles "Weave Pole n/5". One press and Moke does just that obstacle by
 * himself (a run-up and a hop; round the pole on the side the rules want), then it's the player's again. Moving takes
 * over at any time (Game calls `cancel`). The course's own rules still do the scoring, exactly as if the player had
 * done it. Knows nothing of the scenery or the game: fed Moke each fixed step, it says where to go.
 */
export class CourseAssist {
  readonly interactable: Interactable;
  private offer: Offer | null = null;
  private plan: Waypoint[] | null = null;
  private index = 0;
  private time = 0;
  private jumped = false;
  private readonly command: AssistCommand = { x: 0, z: 0, run: false, jump: false };
  private readonly point = { x: 0, y: 0, z: 0 };

  constructor(
    private readonly course: ObstacleCourse,
    /** Help isn't offered while this says so (FSD is driving). */
    private readonly blocked: () => boolean = () => false,
  ) {
    const self = this;
    this.interactable = {
      id: 'course:assist',
      type: 'PLAY',
      get label() {
        const o = self.offer;
        return o?.kind === 'weave' ? COURSE_TEXT.weavePole(o.index + 1, COURSE.weave.count) : COURSE_TEXT.jumpHurdle;
      },
      interactionDistance: COURSE_ASSIST.reach,
      get enabled() { return self.offer !== null; },
      position: this.point,
      requiresFacing: false,
      requiresClearPath: false,
      priority: COURSE_ASSIST.priority,
      interact: () => this.start(),
    };
  }

  /** Doing an obstacle for him right now. */
  get active(): boolean {
    return this.plan !== null;
  }

  /** Each fixed step: what's on offer (nothing while helping, off the course, or not facing an obstacle). */
  update(moke: AssistMoke): void {
    this.offer = !this.plan && !this.blocked() && moke.grounded ? this.nextObstacle(moke.position) : null;
    if (this.offer) {
      const p = coursePoint(this.offer.at);
      this.point.x = p.x;
      this.point.z = p.z;
    }
  }

  /** Each fixed step while helping: where to go this step (null when not helping, or just finished). */
  steer(dt: number, moke: AssistMoke): AssistCommand | null {
    const plan = this.plan;
    if (!plan) return null;
    // The run's over (or called off): so is the help.
    if (this.course.phase !== 'running') return this.finish();
    const w = plan[this.index]!;
    this.time += dt;
    if (this.time > COURSE_ASSIST.stepTimeout) return this.finish();
    const p = moke.position;
    const dx = w.x - p.x;
    const dz = w.z - p.z;
    const d = Math.hypot(dx, dz);
    const c = this.command;
    c.jump = false;
    if (d < COURSE_ASSIST.within && (!w.jumpAt || (this.jumped && moke.grounded))) {
      this.index++;
      this.time = 0;
      this.jumped = false;
      if (this.index >= plan.length) return this.finish();
      return this.steer(0, moke);
    }
    if (w.jumpAt && !this.jumped && d <= w.jumpAt && moke.grounded) {
      c.jump = true;
      this.jumped = true;
    }
    // Ease off right at a point he stops at (the last one); keep going through the others.
    const last = this.index === plan.length - 1 && !w.jumpAt;
    const k = d > 1e-6 ? Math.min(1, last ? d / 0.4 + 0.3 : 1) / d : 0;
    c.x = dx * k;
    c.z = dz * k;
    c.run = w.run;
    return c;
  }

  /** The player took over (or anything else stops it). */
  cancel(): void {
    this.plan = null;
    this.offer = null;
  }

  private finish(): null {
    this.plan = null;
    return null;
  }

  /** Press: plan that one obstacle from where he is. */
  private start(): void {
    const o = this.offer;
    if (!o) return;
    this.offer = null;
    this.index = 0;
    this.time = 0;
    this.jumped = false;
    this.plan = o.kind === 'hurdle' ? this.hurdlePlan(o.at) : this.weavePlan(o.index, o.at);
  }

  private hurdlePlan(at: number): Waypoint[] {
    const plan: Waypoint[] = [];
    // Too close to it, or off to the side: back to a run-up spot in line with it first.
    const here = this.here;
    const ahead = here ? angleAhead(here.a, at) * COURSE.radius : 0;
    if (!here || ahead < COURSE_ASSIST.runUp || Math.abs(here.off) > 0.25) {
      plan.push({ ...coursePoint(at - COURSE_ASSIST.runUp / COURSE.radius), run: false });
    }
    plan.push({ ...coursePoint(at + HURDLE_HOP.landPast), run: true, jumpAt: HURDLE_HOP.jumpAt });
    return plan;
  }

  private weavePlan(index: number, at: number): Waypoint[] {
    // The first pole on the outside; each one after on the other side from the last.
    const last = this.course.lastWeaveSide;
    const side = index === 0 || last === 0 ? 1 : -last;
    const off = side * COURSE_ASSIST.weaveOff;
    return [
      { ...coursePoint(at - COURSE_ASSIST.weaveBefore, off), run: false },
      { ...coursePoint(at + COURSE_ASSIST.weavePast, off), run: false },
    ];
  }

  /** Where he was at the last `update` (for planning). */
  private here: { a: number; off: number } | null = null;

  private nextObstacle(p: Vec3Like): Offer | null {
    const c = this.course;
    this.here = null;
    if (c.phase !== 'running' || (c.station !== 'hurdles' && c.station !== 'weave')) return null;
    const here = courseAngle(p.x, p.z);
    this.here = here;
    if (Math.abs(here.off) > COURSE.laneHalfWidth + COURSE_ASSIST.offLane) return null;
    const index = c.count;
    const at = c.station === 'hurdles' ? COURSE.hurdles.at[index] : COURSE.weave.from + index * COURSE.weave.step;
    if (at === undefined) return null;
    const ahead = angleAhead(here.a, at) * COURSE.radius;
    if (ahead > COURSE_ASSIST.offerFrom || ahead < -COURSE_ASSIST.offerUntil) return null;
    return { kind: c.station === 'hurdles' ? 'hurdle' : 'weave', index, at };
  }
}

/** How far `at` is ahead of `a` round the loop (rad, negative just past it). */
function angleAhead(a: number, at: number): number {
  let d = at - a;
  d = ((d % TAU) + TAU) % TAU;
  return d > Math.PI ? d - TAU : d;
}
