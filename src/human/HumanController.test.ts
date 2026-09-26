import { describe, expect, it } from 'vitest';
import { HUMAN } from '../config/human';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld, type StaticBox } from '../physics/PhysicsWorld';
import type { HumanIntent } from './HumanBrain';
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
  return { human, intent, run };
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

  it('stops where it is when the goal is unreachable (it gets as close as it can)', async () => {
    const { human, intent, run } = await setup([WALL]);
    intent.goal = { x: 0, y: 0, z: 0 }; // inside the block
    run(10);
    expect(human.arrived).toBe(true);
    expect(Math.abs(human.position.x)).toBeGreaterThan(0.3);
  });
});
