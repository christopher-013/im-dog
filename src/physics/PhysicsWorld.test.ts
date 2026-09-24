import { describe, expect, it } from 'vitest';
import { MOKE_BODY } from '../config/movement';
import { CharacterBody } from './CharacterBody';
import { PhysicsWorld, type StaticBox } from './PhysicsWorld';

const box = (cx: number, hx: number, blocksCamera?: boolean): StaticBox => ({
  center: [cx, 0.5, 0],
  halfExtents: [hx, 0.5, 2],
  rotation: [0, 0, 0, 1],
  blocksCamera,
});

async function world(boxes: StaticBox[]) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(boxes);
  physics.commitStaticGeometry();
  return physics;
}

const ORIGIN = { x: 0, y: 0.5, z: 0 };
const PLUS_X = { x: 1, y: 0, z: 0 };

describe('PhysicsWorld.sweepSphere (camera collision)', () => {
  it('returns the full distance when nothing is in the way', async () => {
    const physics = await world([]);
    expect(physics.sweepSphere(ORIGIN, PLUS_X, 0.1, 3)).toBe(3);
  });

  it('stops at a wall, allowing for the sphere radius', async () => {
    const physics = await world([box(1.06, 0.06)]); // face at x = 1.0
    expect(physics.sweepSphere(ORIGIN, PLUS_X, 0.1, 3)).toBeCloseTo(0.9, 3);
  });

  it('ignores thin props like table legs', async () => {
    const physics = await world([box(0.5, 0.02, false), box(1.06, 0.06)]);
    expect(physics.sweepSphere(ORIGIN, PLUS_X, 0.1, 3)).toBeCloseTo(0.9, 3);
  });

  it("ignores Moke's own body", async () => {
    const physics = await world([]);
    new CharacterBody(physics, { x: 0.6, y: 0.3, z: 0 }, MOKE_BODY);
    physics.step();
    expect(physics.sweepSphere(ORIGIN, PLUS_X, 0.1, 3)).toBe(3);
  });
});
