import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { MOKE_BODY, MOVEMENT } from '../config/movement';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld, type StaticBox } from '../physics/PhysicsWorld';
import type { MoveIntent } from './Locomotion';
import { MokeController } from './MokeController';

// Integration tests: the real Rapier character controller in a tiny test room.
const DT = 1 / 60;
const tuning = { ...MOVEMENT };
const R = MOKE_BODY.radius;

const box = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): StaticBox => ({
  center: [cx, cy, cz],
  halfExtents: [hx, hy, hz],
  rotation: [0, 0, 0, 1],
});
const FLOOR = box(0, -0.05, 0, 10, 0.05, 10);
const run = (x: number, z: number): MoveIntent => ({ x, z, walk: false, run: true });
const STAND: MoveIntent = { x: 0, z: 0, walk: false, run: false };

async function setup(boxes: StaticBox[], heading = 0) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes([FLOOR, ...boxes]);
  physics.commitStaticGeometry();
  const moke = new MokeController(new CharacterBody(physics, { x: 0, y: 0, z: 0 }, MOKE_BODY), heading, tuning);
  const simulate = (intent: MoveIntent, seconds: number) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      moke.fixedUpdate(DT, intent);
      physics.step();
    }
  };
  return { moke, simulate };
}

describe('MokeController with Rapier', () => {
  it('stands on the floor and stays grounded', async () => {
    const { moke, simulate } = await setup([]);
    simulate(STAND, 0.5);
    expect(moke.grounded).toBe(true);
    expect(Math.abs(moke.position.y)).toBeLessThan(0.02);
  });

  it('holds a steady trot on open floor, with no stutter steps', async () => {
    const { moke, simulate } = await setup([]);
    simulate({ ...STAND, z: 1 }, 1);
    const z = moke.position.z;
    let slowest = Infinity;
    for (let i = 0; i < 120; i++) {
      simulate({ ...STAND, z: 1 }, DT);
      slowest = Math.min(slowest, moke.actualSpeed);
    }
    expect(moke.position.z - z).toBeCloseTo(tuning.trotSpeed * 2, 1);
    expect(slowest).toBeGreaterThan(tuning.trotSpeed * 0.95);
  });

  it('stops at a wall instead of passing through it', async () => {
    const { moke, simulate } = await setup([box(1.06, 1, 0, 0.06, 1, 5)], Math.PI / 2);
    simulate(run(1, 0), 2);
    expect(moke.position.x).toBeLessThan(1 - R + 0.001);
    expect(moke.position.x).toBeGreaterThan(1 - R - 0.03);
    expect(moke.actualSpeed).toBeLessThan(0.05);
    // Blocked head-on, so he doesn't keep "stored" run speed to burst off with.
    expect(moke.locomotion.speed).toBeLessThan(0.5);
  });

  it('slides along a wall when running into it at an angle', async () => {
    const { moke, simulate } = await setup([box(1.06, 1, 0, 0.06, 1, 10)], Math.PI / 4);
    simulate(run(Math.SQRT1_2, Math.SQRT1_2), 2);
    expect(moke.position.x).toBeLessThan(1 - R + 0.001);
    expect(moke.position.z).toBeGreaterThan(2);
  });

  it('walks under a coffee-table top (0.40 m clearance) and ducks there', async () => {
    const tableTop = box(1.5, 0.425, 0, 0.6, 0.025, 0.6);
    const { moke, simulate } = await setup([tableTop], Math.PI / 2);
    // Accelerating to run speed takes ~0.44 s and ~0.9 m; after 0.55 s he's mid-table (x ≈ 1.3).
    simulate(run(1, 0), 0.55);
    expect(moke.position.x).toBeGreaterThan(1.1);
    expect(moke.position.x).toBeLessThan(1.8);
    expect(moke.headroom).toBeLessThan(0.41);
    expect(Math.abs(moke.position.y)).toBeLessThan(0.02);
  });

  it("can't climb onto a couch-seat-height box", async () => {
    const seat = box(1.5, 0.225, 0, 0.5, 0.225, 1);
    const { moke, simulate } = await setup([seat], Math.PI / 2);
    simulate(run(1, 0), 2);
    expect(moke.position.x).toBeLessThan(1 - R + 0.001);
    expect(Math.abs(moke.position.y)).toBeLessThan(0.02);
  });

  it('interpolates between fixed steps for smooth rendering', async () => {
    const { moke, simulate } = await setup([]);
    simulate({ ...STAND, z: 1 }, 1);
    const before = moke.position.clone();
    simulate({ ...STAND, z: 1 }, DT);
    const mid = moke.interpolatedPosition(0.5, new Vector3());
    expect(mid.z).toBeCloseTo((before.z + moke.position.z) / 2, 6);
    expect(moke.interpolatedPosition(0, new Vector3()).z).toBeCloseTo(before.z, 6);
  });
});
