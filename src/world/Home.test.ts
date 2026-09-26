import { describe, expect, it } from 'vitest';
import { HEIST } from '../config/heist';
import { HUMAN } from '../config/human';
import { MOKE_BODY, MOVEMENT } from '../config/movement';
import { NavGrid, type Point2 } from '../human/NavGrid';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MokeController } from '../player/MokeController';
import { Home } from './Home';
import { roomAt } from './home/layout';

// The whole house with the real Rapier world: Moke can get everywhere he should (and nowhere he shouldn't),
// the human can reach every place their routine uses, and every nap and treat spot is reachable.
const DT = 1 / 60;
const home = new Home();

/** A grid for planning Moke's routes in tests: his size, and anything below his head blocks. */
const mokeNav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.05, agentRadius: MOKE_BODY.radius + 0.01, minY: 0.03, maxY: 0.38 });
const humanNav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.1, agentRadius: HUMAN.body.radius, minY: 0.08, maxY: 1.7 });

async function setup(start: { x: number; z: number } = home.spawn.position, heading = home.spawn.heading) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(home.colliders);
  physics.commitStaticGeometry();
  const moke = new MokeController(new CharacterBody(physics, { x: start.x, y: 0, z: start.z }, MOKE_BODY), heading, { ...MOVEMENT });
  const step = (x: number, z: number) => {
    moke.fixedUpdate(DT, { x, z, walk: false, run: false });
    physics.step();
  };
  /** Trots straight toward (x, z). True if he gets within `within`. */
  const walkTo = (x: number, z: number, maxSeconds = 8, within = 0.12): boolean => {
    for (let i = 0; i < maxSeconds / DT; i++) {
      const dx = x - moke.position.x;
      const dz = z - moke.position.z;
      const distance = Math.hypot(dx, dz);
      if (distance < within) return true;
      const strength = Math.min(1, distance / 0.5) / distance;
      step(dx * strength, dz * strength);
    }
    return false;
  };
  /** Plans a route for his size and follows it. True if he ends within `within` of the goal. */
  const travel = (x: number, z: number, within = 0.15): boolean => {
    const path: Point2[] = [];
    if (!mokeNav.findPath(moke.position, { x, z }, path)) return false;
    for (let i = 0; i < path.length; i++) {
      const p = path[i]!;
      const last = i === path.length - 1;
      if (!walkTo(p.x, p.z, 10, last ? within : 0.2)) return false;
    }
    return Math.hypot(moke.position.x - x, moke.position.z - z) < within + 0.05;
  };
  const idle = (seconds: number) => {
    for (let i = 0; i < seconds / DT; i++) step(0, 0);
  };
  /** Trots toward (x, z) and jumps once he's within `jumpAt`, keeps pushing until he's down, then stands still. */
  const jumpToward = (x: number, z: number, jumpAt: number): void => {
    let jumped = false;
    for (let i = 0; i < 4 / DT && !jumped; i++) {
      const dx = x - moke.position.x;
      const dz = z - moke.position.z;
      const d = Math.hypot(dx, dz);
      if (d <= jumpAt) {
        moke.requestJump();
        jumped = true;
      }
      step(dx / d, dz / d);
    }
    for (let i = 0; i < 1 / DT && (i < 3 || moke.airborne); i++) {
      const dx = x - moke.position.x;
      const dz = z - moke.position.z;
      const d = Math.max(0.01, Math.hypot(dx, dz));
      step(dx / d, dz / d);
    }
    idle(0.6);
  };
  return { physics, moke, walkTo, travel, idle, jumpToward };
}

describe('Home', () => {
  it('builds the whole house as a few merged meshes with its colliders', () => {
    expect(home.colliders.length).toBeGreaterThan(150);
    let meshes = 0;
    home.object.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh) meshes++;
    });
    expect(meshes).toBeLessThan(160);
  });

  it('knows which room a point is in', () => {
    expect(roomAt(0, 0).id).toBe('livingRoom');
    expect(roomAt(5, 1.1).id).toBe('hallway');
    expect(roomAt(9, 3).id).toBe('kitchen');
    expect(roomAt(14, 3).id).toBe('familyRoom');
    expect(roomAt(8.8, -2).id).toBe('diningRoom');
  });

  it('walks from the living room down the hallway into every room, no loading, nothing in the way', async () => {
    const { travel, moke } = await setup();
    for (const [x, z] of [
      [6.2, 1.1],
      [8.0, 1.2],
      [7.6, -1.2],
      [9.5, 4.3],
      [13.0, 3.4],
      [15.3, 4.2],
      [0.3, 0.5],
    ] as const) {
      expect(travel(x, z), `to ${x}, ${z}`).toBe(true);
      expect(moke.position.y).toBeLessThan(0.05);
    }
  });

  it('lets him walk under the dining table, ducking under nothing (the table is high)', async () => {
    const { travel, moke } = await setup({ x: 7.6, z: -1.2 });
    const { underDiningTable } = home.landmarks;
    expect(travel(underDiningTable.x, underDiningTable.z)).toBe(true);
    expect(moke.headroom).toBeGreaterThan(0.6);
  });

  it('lets him under the island overhang between the stools', async () => {
    const { travel, moke } = await setup({ x: 10.6, z: 3.3 });
    expect(travel(9.66, 3.35, 0.12)).toBe(true);
    expect(moke.position.y).toBeLessThan(0.05);
  });

  describe('jumping: sofas, the coffee table, the hearth and the dining chairs, never higher', () => {
    const cases: [string, { x: number; z: number }, { x: number; z: number }, number][] = [
      ['the family coffee table (0.45 m)', { x: 14.2, z: 1.95 }, { x: 14.2, z: 2.9 }, 0.45],
      ['the sectional (0.45 m)', { x: 14.3, z: 2.3 }, { x: 14.3, z: 1.1 }, 0.45],
      ['the sunny couch (0.45 m)', { x: 15.2, z: 2.9 }, { x: 16.3, z: 2.9 }, 0.45],
      ['the hearth (0.3 m)', { x: 14.0, z: 3.9 }, { x: 14.0, z: 4.95 }, 0.3],
    ];
    for (const [name, from, to, height] of cases) {
      it(`jumps up onto ${name}`, async () => {
        const { moke, jumpToward } = await setup(from, Math.atan2(to.x - from.x, to.z - from.z));
        jumpToward(to.x, to.z, 0.6);
        expect(moke.position.y).toBeCloseTo(height, 1);
      });
    }

    const tooHigh: [string, { x: number; z: number }, { x: number; z: number }][] = [
      ['the island (0.92 m)', { x: 8.0, z: 3.4 }, { x: 8.9, z: 3.4 }],
      ['a counter stool (0.65 m)', { x: 10.6, z: 2.95 }, { x: 9.97, z: 2.95 }],
      ['the kitchen counter', { x: 7.9, z: 2.4 }, { x: 7.0, z: 2.4 }],
      ['the sideboard (0.86 m)', { x: 7.8, z: -1.75 }, { x: 7.0, z: -1.75 }],
      ['the built-ins', { x: 15.9, z: 4.1 }, { x: 15.9, z: 5.2 }],
    ];
    for (const [name, from, to] of tooHigh) {
      it(`can't get onto ${name}`, async () => {
        for (const jumpAt of [0.35, 0.6, 0.9]) {
          const { moke, jumpToward } = await setup(from, Math.atan2(to.x - from.x, to.z - from.z));
          jumpToward(to.x, to.z, jumpAt);
          expect(moke.position.y, `jump at ${jumpAt}`).toBeLessThan(0.05);
        }
      });
    }

  });

  it('lets him slip between the dining chairs and under the table', async () => {
    const { walkTo, moke } = await setup({ x: 10.35, z: -1.3 });
    expect(walkTo(9.63, -1.3, 3, 0.1)).toBe(true);
    expect(walkTo(8.85, -1.3, 3, 0.1)).toBe(true);
    expect(moke.position.y).toBeLessThan(0.05);
  });

  it('keeps him out of the walls, the glass and the fireplace', async () => {
    const glass = await setup({ x: 14.0, z: 2.3 });
    expect(glass.walkTo(14.0, -1.5, 4)).toBe(false);
    expect(glass.moke.position.z).toBeGreaterThan(0.5);
    const sliders = await setup({ x: 10.3, z: -1.7 });
    expect(sliders.walkTo(12.5, -1.7, 4)).toBe(false);
    expect(sliders.moke.position.x).toBeLessThan(10.9);
    const fire = await setup({ x: 14.55, z: 3.6 });
    fire.jumpToward(14.55, 5.3, 0.9);
    fire.walkTo(14.55, 5.4, 2);
    expect(fire.moke.position.z).toBeLessThan(5.14);
  });

  it('can reach every nap spot (the high ones with a hop)', async () => {
    for (const spot of home.napSpots) {
      const { travel, jumpToward, moke } = await setup();
      if (spot.position.y < 0.05) {
        expect(travel(spot.position.x, spot.position.z, 0.2), spot.id).toBe(true);
        continue;
      }
      // Up onto the seat: from open floor in front of it, facing the way he'll lie.
      const back = 1.3;
      const from = { x: spot.position.x + Math.sin(spot.facing) * back, z: spot.position.z + Math.cos(spot.facing) * back };
      expect(travel(from.x, from.z, 0.2), `${spot.id}: in front`).toBe(true);
      jumpToward(spot.position.x, spot.position.z, 0.7);
      expect(moke.position.y, `${spot.id}: up`).toBeCloseTo(spot.position.y, 1);
    }
  }, 60_000);

  it('can reach every treat hiding spot close enough to eat, and so can the human (to hide it)', async () => {
    const humanPath: Point2[] = [];
    for (const spot of home.treatHidingSpots) {
      const { travel, moke } = await setup();
      travel(spot.x, spot.z, HEIST.eatReach - 0.15);
      expect(Math.hypot(moke.position.x - spot.x, moke.position.z - spot.z), `Moke to ${spot.x}, ${spot.z}`).toBeLessThan(HEIST.eatReach);
      // Somewhere within arm's reach-and-a-step that the human can walk to.
      let reachable = false;
      for (let ring = 0.3; ring <= 1.3 && !reachable; ring += 0.2) {
        for (let k = 0; k < 12 && !reachable; k++) {
          const a = (k / 12) * Math.PI * 2;
          const x = spot.x + Math.sin(a) * ring;
          const z = spot.z + Math.cos(a) * ring;
          reachable = humanNav.isWalkable(x, z) && humanNav.findPath(home.landmarks.laundry, { x, z }, humanPath);
        }
      }
      expect(reachable, `human near ${spot.x}, ${spot.z}`).toBe(true);
    }
  }, 60_000);

  it("gives the human a walkable way to every place in the routine, from anywhere to anywhere", () => {
    const path: Point2[] = [];
    for (const place of home.places) {
      expect(humanNav.isWalkable(place.stand.x, place.stand.z), `${place.id} stand`).toBe(true);
      expect(humanNav.findPath(home.landmarks.laundry, place.stand, path), place.id).toBe(true);
      for (const other of home.places) expect(humanNav.findPath(place.stand, other.stand, path), `${place.id} → ${other.id}`).toBe(true);
    }
  });

  it("keeps the human out of dog-sized gaps: under the dining table and between the chairs", () => {
    const { underDiningTable } = home.landmarks;
    expect(humanNav.isWalkable(underDiningTable.x, underDiningTable.z)).toBe(false);
    expect(humanNav.isWalkable(9.6, 3.28)).toBe(false);
  });
});
