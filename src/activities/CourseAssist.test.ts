import { describe, expect, it } from 'vitest';
import { COURSE, COURSE_TEXT } from '../config/obstacleCourse';
import { MOKE_BODY, MOVEMENT } from '../config/movement';
import { NavGrid } from '../human/NavGrid';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MokeController } from '../player/MokeController';
import { Home } from '../world/Home';
import { roomAt } from '../world/home/layout';
import { CourseAssist } from './CourseAssist';
import { ObstacleCourse, courseAngle, courseEntryPath, coursePoint } from './ObstacleCourse';

// One-press help on Liam's Obstacle Course, and the path in, with the real Moke body in the real backyard (Rapier).
const DT = 1 / 60;
const home = new Home();

async function setup(start: { x: number; z: number }, heading = Math.PI / 2, blocked = () => false) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(home.colliders);
  physics.commitStaticGeometry();
  const moke = new MokeController(new CharacterBody(physics, { x: start.x, y: 0.02, z: start.z }, MOKE_BODY), heading, { ...MOVEMENT });
  const course = new ObstacleCourse();
  const assist = new CourseAssist(course, blocked);
  /** One fixed step, as Game does it: the help steers while it's on, else the player's move. */
  const step = (x = 0, z = 0) => {
    const moving = x !== 0 || z !== 0;
    if (assist.active && moving) assist.cancel();
    const cmd = assist.active ? assist.steer(DT, moke) : null;
    if (cmd?.jump) moke.requestJump();
    moke.fixedUpdate(DT, cmd ? { x: cmd.x, z: cmd.z, walk: false, run: cmd.run } : { x, z, walk: false, run: false });
    physics.step();
    const outside = roomAt(moke.position.x, moke.position.z).id === 'backyard';
    course.update(DT, { position: moke.position, grounded: moke.grounded }, outside);
    assist.update(moke);
  };
  const walkTo = (x: number, z: number, within = 0.15, seconds = 8): boolean => {
    for (let i = 0; i < seconds / DT; i++) {
      const dx = x - moke.position.x;
      const dz = z - moke.position.z;
      const d = Math.hypot(dx, dz);
      if (d < within) return true;
      const k = Math.min(1, d / 0.5) / d;
      step(dx * k, dz * k);
    }
    return false;
  };
  /** Presses the paw when it offers help, then lets it work until it's done. */
  const press = (): string | null => {
    const it = assist.interactable;
    if (!it.enabled) return null;
    const label = it.label;
    it.interact();
    for (let i = 0; i < 8 / DT && assist.active; i++) step();
    for (let i = 0; i < 10; i++) step();
    return label;
  };
  return { moke, course, assist, step, walkTo, press };
}

describe("Liam's Obstacle Course: the path in, and one-press help", () => {
  it('a paved path from the patio, straight out and then round to the right, onto the lane before START', () => {
    const path = courseEntryPath();
    const first = path[0]!;
    const last = path[path.length - 1]!;
    // From the patio's edge, heading out along the course's middle line.
    expect(first.z).toBeCloseTo(COURSE.center.z, 6);
    expect(path[1]!.x).toBeGreaterThan(first.x);
    // Ends on the lane's middle, just before the START arrow, turned to the right (towards +z) on the way.
    expect(courseAngle(last.x, last.z).a).toBeCloseTo(Math.PI * 2 + COURSE.entry.endAt, 4);
    expect(Math.abs(courseAngle(last.x, last.z).off)).toBeLessThan(1e-6);
    expect(last.z).toBeGreaterThan(first.z + 1.5);
    // Smooth: no corner sharper than ~12° between steps, and no gaps.
    for (let i = 2; i < path.length; i++) {
      const [a, b, c] = [path[i - 2]!, path[i - 1]!, path[i]!];
      const h1 = Math.atan2(b.x - a.x, b.z - a.z);
      const h2 = Math.atan2(c.x - b.x, c.z - b.z);
      let turn = Math.abs(h2 - h1);
      if (turn > Math.PI) turn = Math.PI * 2 - turn;
      expect(turn, `step ${i}`).toBeLessThan(0.21);
      expect(Math.hypot(c.x - b.x, c.z - b.z)).toBeLessThan(COURSE.entry.step * 2);
    }
    // All of it in the backyard, clear of everything (Moke's own navigation grid).
    const nav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.05, agentRadius: MOKE_BODY.radius + 0.01, minY: 0.03, maxY: 0.38 });
    for (const p of path) {
      expect(roomAt(p.x, p.z).id).toBe('backyard');
      expect(nav.isWalkable(p.x, p.z), `(${p.x.toFixed(2)}, ${p.z.toFixed(2)})`).toBe(true);
    }
  });

  it('following the path from the patio leads him through the arch: the run starts', async () => {
    const path = courseEntryPath();
    const w = await setup(path[0]!);
    for (const p of path) expect(w.walkTo(p.x, p.z, 0.2)).toBe(true);
    expect(w.walkTo(coursePoint(0.2).x, coursePoint(0.2).z)).toBe(true);
    expect(w.course.phase).toBe('running');
  }, 60_000);

  it('one press per obstacle: both hurdles hopped, all five poles woven, by the course rules', async () => {
    const start = coursePoint(-0.3);
    const w = await setup(start);
    expect(w.walkTo(coursePoint(0.15).x, coursePoint(0.15).z)).toBe(true);
    expect(w.course.phase).toBe('running');
    expect(w.course.station).toBe('hurdles');
    const labels: (string | null)[] = [];
    for (let i = 0; i < COURSE.hurdles.at.length; i++) labels.push(w.press());
    expect(labels).toEqual([COURSE_TEXT.jumpHurdle, COURSE_TEXT.jumpHurdle]);
    expect(w.course.station).toBe('weave');
    for (let i = 0; i < COURSE.weave.count; i++) {
      expect(w.press(), `pole ${i + 1}`).toBe(COURSE_TEXT.weavePole(i + 1, COURSE.weave.count));
    }
    expect(w.course.station).toBe('hill');
    // Nothing more to help with: the hill is his to run.
    expect(w.assist.interactable.enabled).toBe(false);
  }, 60_000);

  it('works from a standstill right up against a hurdle (it backs up for a run-up first)', async () => {
    const w = await setup(coursePoint(-0.3));
    expect(w.walkTo(coursePoint(0.15).x, coursePoint(0.15).z)).toBe(true);
    const close = coursePoint(COURSE.hurdles.at[0] - 0.08);
    expect(w.walkTo(close.x, close.z, 0.1)).toBe(true);
    for (let i = 0; i < 30; i++) w.step();
    expect(w.press()).toBe(COURSE_TEXT.jumpHurdle);
    expect(w.course.count).toBe(1);
  }, 60_000);

  it('moving takes over; and no offers while FSD is driving', async () => {
    let fsd = false;
    const w = await setup(coursePoint(-0.3), Math.PI / 2, () => fsd);
    expect(w.walkTo(coursePoint(0.15).x, coursePoint(0.15).z)).toBe(true);
    expect(w.assist.interactable.enabled).toBe(true);
    w.assist.interactable.interact();
    expect(w.assist.active).toBe(true);
    w.step(0, -1);
    expect(w.assist.active).toBe(false);
    fsd = true;
    for (let i = 0; i < 5; i++) w.step();
    expect(w.assist.interactable.enabled).toBe(false);
  }, 60_000);
});
