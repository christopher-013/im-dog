import { describe, expect, it } from 'vitest';
import { ObstacleCourse, courseAngle, courseForward, coursePoint } from '../activities/ObstacleCourse';
import { COURSE } from '../config/obstacleCourse';
import { MOKE_BODY, MOVEMENT } from '../config/movement';
import { NavGrid, type Point2 } from '../human/NavGrid';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MokeController } from '../player/MokeController';
import { Home } from './Home';
import { BACKYARD_DOORWAY, YARD, roomAt } from './home/layout';

// The backyard (Phase 5) with the real Rapier world: out through the open slider, round the yard but never out of
// it, and Liam's Obstacle Course done the way a player would (hops, weaving, the hill), scored by its own rules.
const DT = 1 / 60;
const home = new Home();
const mokeNav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.05, agentRadius: MOKE_BODY.radius + 0.01, minY: 0.03, maxY: 0.38 });

async function setup(start: { x: number; z: number }, heading = 0) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(home.colliders);
  physics.commitStaticGeometry();
  const moke = new MokeController(new CharacterBody(physics, { x: start.x, y: 0.02, z: start.z }, MOKE_BODY), heading, { ...MOVEMENT });
  const course = new ObstacleCourse();
  let maxY = 0;
  const step = (x: number, z: number, run = false) => {
    moke.fixedUpdate(DT, { x, z, walk: false, run });
    physics.step();
    maxY = Math.max(maxY, moke.position.y);
    course.update(DT, { position: moke.position, grounded: moke.grounded }, roomAt(moke.position.x, moke.position.z).id === 'backyard');
  };
  const walkTo = (x: number, z: number, maxSeconds = 8, within = 0.15, run = false): boolean => {
    for (let i = 0; i < maxSeconds / DT; i++) {
      const dx = x - moke.position.x;
      const dz = z - moke.position.z;
      const d = Math.hypot(dx, dz);
      if (d < within) return true;
      const k = Math.min(1, d / 0.5) / d;
      step(dx * k, dz * k, run);
    }
    return false;
  };
  const travel = (x: number, z: number, within = 0.2): boolean => {
    const path: Point2[] = [];
    if (!mokeNav.findPath(moke.position, { x, z }, path)) return false;
    for (let i = 0; i < path.length; i++) if (!walkTo(path[i]!.x, path[i]!.z, 12, i === path.length - 1 ? within : 0.2)) return false;
    return true;
  };
  /** Runs at (x, z) and jumps `jumpAt` short of it, then keeps going until he's landed. */
  const hopTo = (x: number, z: number, jumpAt: number): void => {
    let jumped = false;
    for (let i = 0; i < 4 / DT && !jumped; i++) {
      const dx = x - moke.position.x;
      const dz = z - moke.position.z;
      const d = Math.hypot(dx, dz);
      if (d <= jumpAt && moke.grounded) {
        moke.requestJump();
        jumped = true;
      }
      step(dx / d, dz / d, true);
    }
    for (let i = 0; i < 1.2 / DT && (i < 3 || moke.airborne); i++) {
      const dx = x - moke.position.x;
      const dz = z - moke.position.z;
      const d = Math.max(0.01, Math.hypot(dx, dz));
      step(dx / d, dz / d);
    }
  };
  return { moke, course, walkTo, travel, hopTo, maxY: () => maxY };
}

const along = (a: number, s: number) => {
  const p = coursePoint(a);
  const f = courseForward(a);
  return { x: p.x + f.x * s, z: p.z + f.z * s };
};

describe('The backyard (Phase 5)', () => {
  it('goes out through the open slider, across the patio, to the obstacle course', async () => {
    const w = await setup({ x: 15.6, z: (BACKYARD_DOORWAY.zMin + BACKYARD_DOORWAY.zMax) / 2 });
    expect(w.walkTo(BACKYARD_DOORWAY.x + 0.6, w.moke.position.z, 4)).toBe(true);
    expect(roomAt(w.moke.position.x, w.moke.position.z).id).toBe('backyard');
    const start = coursePoint(-0.3);
    expect(w.travel(start.x, start.z)).toBe(true);
    expect(w.course.near).toBe(true);
    expect(w.course.objective).toMatch(/Start at the arch/);
  }, 60_000);

  it("can't get out of the yard: the hedges, the fence and the end of the house hold him in", async () => {
    const north = await setup({ x: 23, z: -3.5 });
    expect(north.walkTo(23, -8, 4)).toBe(false);
    expect(north.moke.position.z).toBeGreaterThan(YARD.minZ - 0.05);
    const east = await setup({ x: YARD.maxX - 1, z: 3.6 });
    expect(east.walkTo(YARD.maxX + 3, 3.6, 4)).toBe(false);
    expect(east.moke.position.x).toBeLessThan(YARD.maxX + 0.05);
    const corner = await setup({ x: 17.6, z: -5 });
    expect(corner.walkTo(14, -5, 4)).toBe(false);
    expect(corner.moke.position.x).toBeGreaterThan(16.9);
  }, 60_000);

  it('a hurdle stops him trotting, but a hop clears it', async () => {
    const w = await setup(coursePoint(0.2));
    const beyond = coursePoint(0.8);
    expect(w.walkTo(beyond.x, beyond.z, 3)).toBe(false);
    expect(courseAngle(w.moke.position.x, w.moke.position.z).a).toBeLessThan(COURSE.hurdles.at[0]);
    // Back up, trot in, hop.
    const back = coursePoint(0.05);
    const runIn = coursePoint(0.25);
    w.walkTo(back.x, back.z, 3);
    w.walkTo(runIn.x, runIn.z, 3, 0.2);
    const land = coursePoint(COURSE.hurdles.at[0] + 0.22);
    w.hopTo(land.x, land.z, 0.22 * COURSE.radius + 0.45);
    expect(courseAngle(w.moke.position.x, w.moke.position.z).a).toBeGreaterThan(COURSE.hurdles.at[0]);
  }, 60_000);

  it('runs up the hill and down the other side', async () => {
    const { at, halfLength } = COURSE.hill;
    const from = along(at, -halfLength - 0.6);
    const to = along(at, halfLength + 0.6);
    const w = await setup(from);
    expect(w.walkTo(to.x, to.z, 6, 0.15, true)).toBe(true);
    expect(w.maxY()).toBeGreaterThan(COURSE.hill.top - 0.06);
    expect(w.moke.position.y).toBeLessThan(0.03);
  }, 60_000);

  it("a whole lap of Liam's Obstacle Course, played like a player would, scored by its rules", async () => {
    const w = await setup(coursePoint(-0.45));
    // (The rules are fed every physics step inside setup.)
    const go = (a: number, off = 0) => {
      const p = coursePoint(a, off);
      return w.walkTo(p.x, p.z, 6, 0.2);
    };
    // Through the arch.
    expect(go(-0.2)).toBe(true);
    expect(go(0.25)).toBe(true);
    expect(w.course.phase).toBe('running');
    // Hop both hurdles.
    for (const [i, h] of COURSE.hurdles.at.entries()) {
      const land = coursePoint(h + 0.22);
      w.hopTo(land.x, land.z, 0.22 * COURSE.radius + 0.45);
      expect(w.course.count, `hurdle ${i + 1}`).toBe(i + 1 === COURSE.hurdles.at.length ? 0 : i + 1);
    }
    expect(w.course.station).toBe('weave');
    // In and out of the poles.
    const wv = COURSE.weave;
    for (let i = 0; i < wv.count; i++) expect(go(wv.from + i * wv.step, (i % 2 ? -1 : 1) * 0.28), `pole ${i + 1}`).toBe(true);
    expect(go(wv.from + wv.count * wv.step)).toBe(true);
    expect(w.course.station).toBe('hill');
    // Over the hill.
    const { at, halfLength } = COURSE.hill;
    const up = along(at, -halfLength - 0.4);
    const down = along(at, halfLength + 0.5);
    expect(w.walkTo(up.x, up.z, 6)).toBe(true);
    expect(w.walkTo(down.x, down.z, 6, 0.2, true)).toBe(true);
    expect(w.course.station).toBe('finish');
    // Home through the arch.
    for (let a = 4.9; a < Math.PI * 2 + 0.3; a += 0.3) expect(go(a)).toBe(true);
    expect(w.course.phase).toBe('done');
  }, 120_000);
});
