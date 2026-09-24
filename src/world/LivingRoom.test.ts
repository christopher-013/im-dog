import { describe, expect, it } from 'vitest';
import { MOKE_BODY, MOVEMENT } from '../config/movement';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MokeController } from '../player/MokeController';
import { LivingRoom } from './LivingRoom';

// Navigation checks with the real Rapier world: guards against layout changes that trap Moke,
// seal off the hallway or let him walk through furniture.
const DT = 1 / 60;

async function setup() {
  const room = new LivingRoom();
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(room.colliders);
  physics.commitStaticGeometry();
  const moke = new MokeController(new CharacterBody(physics, room.spawn.position, MOKE_BODY), room.spawn.heading, {
    ...MOVEMENT,
  });
  /** Trots straight toward (x, z), easing off near the end. True if he gets within 12 cm. */
  const walkTo = (x: number, z: number, maxSeconds = 8): boolean => {
    for (let i = 0; i < maxSeconds / DT; i++) {
      const dx = x - moke.position.x;
      const dz = z - moke.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 0.12) return true;
      const strength = Math.min(1, distance / 0.5) / distance;
      moke.fixedUpdate(DT, { x: dx * strength, z: dz * strength, walk: false, run: false });
      physics.step();
    }
    return false;
  };
  const idle = (seconds: number) => {
    for (let i = 0; i < seconds / DT; i++) {
      moke.fixedUpdate(DT, { x: 0, z: 0, walk: false, run: false });
      physics.step();
    }
  };
  return { room, moke, walkTo, idle };
}

describe('LivingRoom', () => {
  it('builds furnished scenery with colliders, merged into a modest number of meshes', () => {
    const room = new LivingRoom();
    expect(room.colliders.length).toBeGreaterThan(25);
    expect(room.object.children.length).toBeLessThan(60);
  });

  it('spawns Moke on clear floor', async () => {
    const { room, moke, idle } = await setup();
    idle(0.5);
    expect(moke.grounded).toBe(true);
    expect(moke.position.distanceTo(room.spawn.position)).toBeLessThan(0.01);
  });

  it('lets him into his bed through the open side', async () => {
    const { room, moke, walkTo } = await setup();
    const { dogBedFront, dogBed } = room.landmarks;
    expect(walkTo(dogBedFront.x, dogBedFront.z)).toBe(true);
    expect(walkTo(dogBed.x, dogBed.z)).toBe(true);
    expect(moke.position.distanceTo(dogBed)).toBeLessThan(0.15);
  });

  it('lets him walk under the coffee table, ducking', async () => {
    const { room, moke, walkTo } = await setup();
    const { underTable } = room.landmarks;
    expect(walkTo(underTable.x, underTable.z)).toBe(true);
    expect(moke.headroom).toBeLessThan(0.45);
  });

  it('lets him through the doorway to the end of the hallway', async () => {
    const { room, walkTo } = await setup();
    const { hallwayEntrance, hallwayEnd } = room.landmarks;
    expect(walkTo(hallwayEntrance.x, hallwayEntrance.z)).toBe(true);
    expect(walkTo(hallwayEnd.x, hallwayEnd.z)).toBe(true);
  });

  it('stops him at the couch and the TV console', async () => {
    const couch = await setup();
    expect(couch.walkTo(0.3, -2.6, 4)).toBe(false);
    expect(couch.moke.position.z).toBeGreaterThan(-2.05);

    const tv = await setup();
    expect(tv.walkTo(0.3, 2.9, 4)).toBe(false);
    expect(tv.moke.position.z).toBeLessThan(2.4);
  });
});
