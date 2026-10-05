import { describe, expect, it } from 'vitest';
import { COURSE } from '../config/obstacleCourse';
import { ObstacleCourse, courseAngle, coursePoint } from './ObstacleCourse';

const DT = 1 / 60;
/** Radians per step (about 3.5 m/s round the loop). */
const STEP = (3.5 * DT) / COURSE.radius;

interface Lap {
  /** Sideways off the middle line at angle a (m, outward +). */
  off?: (a: number) => number;
  /** Feet height at angle a. */
  y?: (a: number) => number;
  from?: number;
  to?: number;
  dir?: 1 | -1;
}

const near = (a: number, at: number, within: number) => Math.abs(a - at) < within;
/** In and out of the weave poles: outside, inside, outside… (or always outside with `sameSide`). */
const weaving = (sameSide = false) => (a: number) => {
  const w = COURSE.weave;
  for (let i = 0; i < w.count; i++) if (near(a, w.from + i * w.step, w.step / 2)) return (sameSide || i % 2 === 0 ? 1 : -1) * 0.3;
  return 0;
};
const hopping = (a: number) => {
  if (COURSE.hurdles.at.some((h) => near(a, h, 0.12))) return 0.32;
  if (near(a, COURSE.hill.at, (COURSE.hill.flatHalf + 0.05) / COURSE.radius)) return COURSE.hill.top;
  return 0;
};

function run(course: ObstacleCourse, lap: Lap = {}, outside = true, each?: () => void): void {
  const { off = weaving(), y = hopping, from = -0.3, to = Math.PI * 2 + 0.2, dir = 1 } = lap;
  const position = { x: 0, y: 0, z: 0 };
  const moke = { position, grounded: true };
  for (let a = dir > 0 ? from : to; dir > 0 ? a <= to : a >= from; a += STEP * dir) {
    const p = coursePoint(a, off(a));
    position.x = p.x;
    position.z = p.z;
    position.y = y(a);
    moke.grounded = position.y < 0.02 || near(a, COURSE.hill.at, (COURSE.hill.halfLength + 0.1) / COURSE.radius);
    course.update(DT, moke, outside);
    each?.();
  }
}

describe("Liam's Obstacle Course (the rules)", () => {
  it('maps the loop: the arch at the west end, angles growing round to the south', () => {
    const west = coursePoint(0);
    expect(west.x).toBeCloseTo(COURSE.center.x - COURSE.radius, 6);
    expect(coursePoint(Math.PI / 2).z).toBeGreaterThan(COURSE.center.z);
    const back = courseAngle(coursePoint(2.4, 0.3).x, coursePoint(2.4, 0.3).z);
    expect(back.a).toBeCloseTo(2.4, 6);
    expect(back.off).toBeCloseTo(0.3, 6);
  });

  it('one lap done properly: arch, both hurdles, the weave, the hill, back through the arch', () => {
    const events: string[] = [];
    let took = 0;
    const course = new ObstacleCourse({
      onStart: () => events.push('start'),
      onStation: (s) => events.push(s),
      onComplete: (s) => { events.push('complete'); took = s; },
    });
    run(course);
    expect(events).toEqual(['start', 'hurdles', 'weave', 'hill', 'complete']);
    expect(course.phase).toBe('done');
    expect(took).toBeGreaterThan(2);
  });

  it('says what to do next all the way round', () => {
    const course = new ObstacleCourse();
    const lines = new Set<string>();
    const position = { x: 0, y: 0, z: 0 };
    const p = coursePoint(-0.5, -1.5);
    course.update(DT, { position: { ...position, x: p.x, z: p.z }, grounded: true }, true);
    expect(course.objective).toMatch(/Start at the arch/);
    run(course, {}, true, () => { if (course.objective) lines.add(course.objective); });
    expect([...lines].some((l) => /hurdles/.test(l))).toBe(true);
    expect([...lines].some((l) => /Weave/.test(l))).toBe(true);
    expect([...lines].some((l) => /hill/.test(l))).toBe(true);
    expect([...lines].some((l) => /finish/.test(l))).toBe(true);
  });

  it("going round the hurdles instead of over them doesn't count", () => {
    const course = new ObstacleCourse();
    run(course, { off: (a) => (COURSE.hurdles.at.some((h) => near(a, h, 0.15)) ? 0.85 : 0), y: () => 0 });
    expect(course.phase).toBe('running');
    expect(course.station).toBe('hurdles');
    expect(course.count).toBe(0);
  });

  it('the weave needs in and out: the same side twice starts it again', () => {
    const course = new ObstacleCourse();
    run(course, { off: weaving(true), to: COURSE.weave.from + COURSE.weave.count * COURSE.weave.step });
    expect(course.station).toBe('weave');
    expect(course.count).toBeLessThan(2);
    expect(course.objective).toMatch(/Oops/);
  });

  it('going round the wrong way never counts', () => {
    const course = new ObstacleCourse();
    run(course, { dir: -1 });
    expect(course.phase).toBe('idle');
  });

  it('going back inside calls off a run in progress', () => {
    const course = new ObstacleCourse();
    run(course, { to: 1.2 });
    expect(course.phase).toBe('running');
    run(course, { from: 1.2, to: 1.3 }, false);
    expect(course.phase).toBe('idle');
    expect(course.objective).toBeNull();
  });
});
