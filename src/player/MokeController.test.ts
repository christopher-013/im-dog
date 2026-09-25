import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { JUMP, MOKE_BODY, MOVEMENT } from '../config/movement';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld, type StaticBox } from '../physics/PhysicsWorld';
import type { MoveIntent } from './Locomotion';
import { jumpSpeed, MokeController } from './MokeController';

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

  describe('jumping', () => {
    const trot = (x: number, z: number): MoveIntent => ({ x, z, walk: false, run: false });
    /**
     * Heads toward +x at `intent`, jumps once his capsule is `gap` metres short of x = edge, keeps pushing
     * forward through the jump, then stands still to see where he ends up.
     */
    const jumpAt = async (boxes: StaticBox[], edge: number, gap: number, intent: MoveIntent) => {
      const world = await setup(boxes, Math.PI / 2);
      const { moke, simulate } = world;
      for (let i = 0; i < 4 / DT && moke.position.x + R < edge - gap; i++) simulate(intent, DT);
      moke.requestJump();
      simulate(intent, 0.5);
      simulate(STAND, 0.8);
      return world;
    };

    it('takes off at the speed that lifts his feet exactly to the cap', () => {
      for (const rise of [0.04, 0.2, JUMP.maxHeight]) {
        let y = 0;
        let top = 0;
        let v = jumpSpeed(rise, JUMP.gravity, DT);
        for (let i = 0; i < 120; i++) {
          if (i > 0) v -= JUMP.gravity * DT;
          y += v * DT;
          top = Math.max(top, y);
        }
        expect(top).toBeCloseTo(rise, 3);
      }
    });

    it('jumps up onto a couch-seat-height box (0.45 m) from a trot', async () => {
      const seat = box(1.5, 0.225, 0, 0.5, 0.225, 1);
      const { moke } = await jumpAt([seat], 1, 0.15, trot(1, 0));
      expect(moke.position.y).toBeCloseTo(0.45, 1);
      expect(moke.grounded).toBe(true);
      expect(moke.airborne).toBe(false);
    });

    it("can never get onto a TV-console-height box (0.56 m), from any distance, trotting or running", async () => {
      const cabinet = box(1.5, 0.28, 0, 0.5, 0.28, 1);
      for (const intent of [trot(1, 0), run(1, 0)]) {
        for (let gap = 0; gap <= 1.2; gap += 0.1) {
          const { moke } = await jumpAt([cabinet], 1, gap, intent);
          expect(moke.position.y, `gap ${gap.toFixed(1)} m`).toBeLessThan(0.05);
        }
      }
    });

    it("can't get from up on the couch onto something taller beside it", async () => {
      // Standing on a 0.45 m seat with a 0.56 m cabinet right next to it.
      const seat = box(0, 0.225, 0, 0.6, 0.225, 1);
      const cabinet = box(0.85, 0.28, 0, 0.25, 0.28, 1);
      const physics = await PhysicsWorld.create();
      physics.addStaticBoxes([FLOOR, seat, cabinet]);
      physics.commitStaticGeometry();
      const moke = new MokeController(new CharacterBody(physics, { x: 0, y: 0.45, z: 0 }, MOKE_BODY), Math.PI / 2, tuning);
      let top = 0;
      for (let i = 0; i < 2 / DT; i++) {
        if (moke.grounded) moke.requestJump();
        moke.fixedUpdate(DT, run(1, 0));
        physics.step();
        top = Math.max(top, moke.position.y);
      }
      for (let i = 0; i < 0.5 / DT; i++) {
        moke.fixedUpdate(DT, STAND);
        physics.step();
      }
      // Jumping from 0.45 m only leaves him the cap's few centimetres of rise, so he never gets near 0.56 m.
      expect(top).toBeLessThan(JUMP.maxHeight + 0.01);
      expect(moke.position.y).toBeCloseTo(0.45, 2); // still on the seat...
      expect(moke.position.x).toBeLessThan(0.6); // ...not on the cabinet
    });

    it("doesn't jump under a low table top", async () => {
      const tableTop = box(0, 0.425, 0, 0.6, 0.025, 0.6);
      const { moke, simulate } = await setup([tableTop]);
      simulate(STAND, 0.1);
      moke.requestJump();
      simulate(STAND, 0.3);
      expect(Math.abs(moke.position.y)).toBeLessThan(0.02);
      expect(moke.airborne).toBe(false);
    });

    it('drops off an edge and lands, in the air in between', async () => {
      const seat = box(0, 0.225, 0, 0.6, 0.225, 1);
      const physics = await PhysicsWorld.create();
      physics.addStaticBoxes([FLOOR, seat]);
      physics.commitStaticGeometry();
      const moke = new MokeController(new CharacterBody(physics, { x: 0, y: 0.45, z: 0 }, MOKE_BODY), Math.PI / 2, tuning);
      let wasAirborne = false;
      for (let i = 0; i < 1.5 / DT; i++) {
        moke.fixedUpdate(DT, trot(1, 0));
        physics.step();
        wasAirborne ||= moke.airborne;
      }
      expect(wasAirborne).toBe(true);
      expect(moke.position.x).toBeGreaterThan(0.8);
      expect(Math.abs(moke.position.y)).toBeLessThan(0.02);
      expect(moke.airborne).toBe(false);
    });
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
