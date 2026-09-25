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
  /**
   * Trots (or runs) straight along +z or -z from where he is, jumps once he's `jumpAtZ` or past it, keeps
   * pushing until he's down again, then stands still. Where he ends up says what he landed on.
   */
  const jumpToward = (direction: 1 | -1, jumpAtZ: number, run = false): void => {
    const intent = { x: 0, z: direction, walk: false, run };
    let jumped = false;
    for (let i = 0; i < 4 / DT && !jumped; i++) {
      if ((moke.position.z - jumpAtZ) * direction >= 0) {
        moke.requestJump();
        jumped = true;
      }
      moke.fixedUpdate(DT, intent);
      physics.step();
    }
    for (let i = 0; i < 1 / DT && (i < 3 || moke.airborne); i++) {
      moke.fixedUpdate(DT, intent);
      physics.step();
    }
    idle(0.6);
  };
  return { room, moke, physics, walkTo, idle, jumpToward };
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

  describe('jumping (the couch seat and coffee table are the highest he can get)', () => {
    it('jumps up onto the couch seat, and stays out of the arms and back cushions up there', async () => {
      const { moke, physics, walkTo, jumpToward, idle } = await setup();
      expect(walkTo(-0.35, -1.0)).toBe(true);
      jumpToward(-1, -1.75);
      expect(moke.position.y).toBeCloseTo(0.45, 2);
      // Push on into the back cushions, then along the seat into an arm.
      for (let i = 0; i < 1.5 / DT; i++) {
        moke.fixedUpdate(DT, { x: 0, z: -1, walk: false, run: false });
        physics.step();
      }
      expect(moke.position.z).toBeGreaterThan(-2.405 + 0.15);
      for (let i = 0; i < 2 / DT; i++) {
        moke.fixedUpdate(DT, { x: -1, z: 0, walk: false, run: false });
        physics.step();
      }
      idle(0.3);
      expect(moke.position.x).toBeGreaterThan(-0.61 + 0.15);
      expect(moke.position.y).toBeCloseTo(0.45, 2);
    });

    it('jumps up onto the coffee table', async () => {
      const { moke, walkTo, jumpToward } = await setup();
      expect(walkTo(0.4, 0.2)).toBe(true);
      jumpToward(-1, -0.6);
      expect(moke.position.y).toBeCloseTo(0.45, 2);
      expect(moke.position.z).toBeLessThan(-0.84);
    });

    it("can't get onto the TV console (0.56 m), trotting or running, from near or far", async () => {
      for (const run of [false, true]) {
        for (const jumpAtZ of [1.7, 1.9, 2.1, 2.2, 2.3, 2.4]) {
          const { moke, walkTo, jumpToward } = await setup();
          expect(walkTo(0.3, 1.2)).toBe(true);
          jumpToward(1, jumpAtZ, run);
          expect(moke.position.y, `${run ? 'run' : 'trot'}, jump at z ${jumpAtZ}`).toBeLessThan(0.05);
        }
      }
    });
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
