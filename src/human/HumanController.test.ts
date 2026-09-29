import { describe, expect, it } from 'vitest';
import { HUMAN } from '../config/human';
import { MOKE_BODY } from '../config/movement';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld, type StaticBox } from '../physics/PhysicsWorld';
import type { HumanIntent, SeatSpec } from './HumanBrain';
import { HumanController } from './HumanController';
import { NavGrid } from './NavGrid';

// Integration: the human's body with the real Rapier character controller, following NavGrid paths.
const DT = 1 / 60;
const box = (cx: number, cy: number, cz: number, hx: number, hy: number, hz: number): StaticBox => ({
  center: [cx, cy, cz],
  halfExtents: [hx, hy, hz],
  rotation: [0, 0, 0, 1],
});
const FLOOR = box(0, -0.05, 0, 10, 0.05, 10);
const WALL = box(0, 0.6, 0, 0.3, 0.6, 1.6); // a couch-sized block between start and goal
// A couch against the back (seat 0.4 m up), facing +z; they sit on its middle from a stand point in front of it.
const COUCH = box(0, 0.2, -1.2, 1.2, 0.2, 0.35);
const SEAT: SeatSpec = { x: 0, z: -1.1, height: 0.4, style: 'upright', facing: 0 };
const STAND = { x: 0, y: 0, z: -0.4 };

async function setup(obstacles: StaticBox[]) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes([FLOOR, ...obstacles]);
  physics.commitStaticGeometry();
  const nav = new NavGrid(obstacles, {
    bounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 },
    cell: 0.1,
    agentRadius: HUMAN.body.radius,
    minY: 0.08,
    maxY: 1.7,
  });
  const human = new HumanController(new CharacterBody(physics, { x: -2, y: 0, z: 0 }, HUMAN.body), nav, Math.PI / 2);
  const intent: HumanIntent = { goal: null, speed: HUMAN.move.walkSpeed, stopWithin: 0.15, face: null, headYaw: 0, crouch: 0, pose: 'idle', seat: null, prop: null, lookAt: null, talking: 0 };
  const run = (seconds: number, each?: () => void) => {
    for (let i = 0; i < Math.round(seconds / DT); i++) {
      each?.();
      human.fixedUpdate(DT, intent);
      physics.step();
    }
  };
  return { human, intent, run, physics };
}

/** Walks them to the couch and sits them down, then puts Moke where they stood. */
async function seatedWithMokeInFront(obstacles: StaticBox[]) {
  const world = await setup([COUCH, ...obstacles]);
  const { human, intent, run, physics } = world;
  intent.goal = STAND;
  intent.stopWithin = 0.12;
  intent.seat = SEAT;
  run(12);
  expect(human.seated).toBe(true);
  const moke = new CharacterBody(physics, { x: STAND.x + 0.05, y: 0, z: STAND.z + 0.15 }, MOKE_BODY);
  physics.step();
  return { ...world, moke };
}

describe('HumanController (with Rapier)', () => {
  it('walks around an obstacle to the goal, never through it, at human speed', async () => {
    const { human, intent, run } = await setup([WALL]);
    intent.goal = { x: 2, y: 0, z: 0 };
    let maxSpeed = 0;
    let insideWall = false;
    run(12, () => {
      maxSpeed = Math.max(maxSpeed, human.speed);
      if (Math.abs(human.position.x) < 0.3 && Math.abs(human.position.z) < 1.6) insideWall = true;
    });
    expect(Math.hypot(human.position.x - 2, human.position.z)).toBeLessThan(0.3);
    expect(human.arrived).toBe(true);
    expect(insideWall).toBe(false);
    expect(maxSpeed).toBeLessThanOrEqual(HUMAN.move.walkSpeed + 1e-6);
  });

  it('turns to face something once it has arrived', async () => {
    const { human, intent, run } = await setup([]);
    intent.face = { x: -2, y: 0, z: -3 };
    run(2);
    expect(Math.abs(human.heading - Math.PI)).toBeLessThan(0.05);
  });

  it('follows a moving goal, re-planning as it goes', async () => {
    const { human, intent, run } = await setup([WALL]);
    const goal = { x: 2, y: 0, z: -2.5 };
    intent.goal = goal;
    intent.speed = HUMAN.move.hurrySpeed;
    run(3);
    goal.z = 2.5; // the dog doubled back round the other end
    run(8);
    expect(Math.hypot(human.position.x - goal.x, human.position.z - goal.z)).toBeLessThan(0.4);
  });

  it('getting up with Moke where they stood, stands up beside him instead of waiting', async () => {
    const { human, intent, run, moke } = await seatedWithMokeInFront([]);
    intent.seat = null;
    intent.goal = { x: 2, y: 0, z: 2 };
    let overlapped = false;
    run(2.5, () => {
      if (!human.seat && Math.hypot(human.position.x - moke.center.x, human.position.z - moke.center.z) < HUMAN.body.radius + MOKE_BODY.radius) overlapped = true;
    });
    expect(human.seat).toBeNull();
    expect(overlapped).toBe(false);
    // On their feet to the side of him (the side away from him: he's a little to their right), then off they go.
    expect(human.position.x).toBeLessThan(moke.center.x - 0.3);
    run(6);
    expect(Math.hypot(human.position.x - 2, human.position.z - 2)).toBeLessThan(0.4);
  });

  it('with no room beside Moke either, stays sat until he moves', async () => {
    // Cabinets either side of the stand point: only just room for them to walk in and sit.
    const sides = [box(-0.75, 0.5, -0.3, 0.3, 0.5, 0.3), box(0.75, 0.5, -0.3, 0.3, 0.5, 0.3)];
    const { human, intent, run, moke } = await seatedWithMokeInFront(sides);
    intent.seat = null;
    intent.goal = { x: 0, y: 0, z: 2 };
    run(3);
    expect(human.seat).not.toBeNull();
    // He wanders off: now they get up.
    const out = { x: 0, y: 0, z: 0 };
    for (let i = 0; i < 60; i++) moke.move({ x: 0, y: 0, z: 0.05 }, out);
    run(4);
    expect(human.seat).toBeNull();
  });

  it('stops where it is when the goal is unreachable (it gets as close as it can)', async () => {
    const { human, intent, run } = await setup([WALL]);
    intent.goal = { x: 0, y: 0, z: 0 }; // inside the block
    run(10);
    expect(human.arrived).toBe(true);
    expect(Math.abs(human.position.x)).toBeGreaterThan(0.3);
  });
});
