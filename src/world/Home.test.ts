import { Quaternion, Vector3 } from 'three';
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
import { BOWLS, HOME_PLACES, placeById } from './home/places';
import { HumanController } from '../human/HumanController';
import type { HumanIntent, SeatSpec } from '../human/HumanBrain';
import { BOWL_REFILL } from '../config/activities';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import { BATHROOM } from './home/layout';

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
  it('lets Moke reach the delivery door, but not escape across its doorstep threshold', async () => {
    const w = await setup();
    const { stand, door } = HOME_ACTIVITIES.delivery;
    expect(w.travel(stand.x, stand.z)).toBe(true);
    expect(w.walkTo(door.x - 0.65, door.z, 3)).toBe(false);
    expect(w.moke.position.x).toBeGreaterThan(door.x);
    w.jumpToward(door.x - 0.65, door.z, 0.9);
    expect(w.moke.position.x).toBeGreaterThan(door.x);
  });
  it('builds the whole house as a few merged meshes with its colliders', () => {
    expect(home.colliders.length).toBeGreaterThan(150);
    let meshes = 0;
    home.object.traverse((o) => {
      if ((o as { isMesh?: boolean }).isMesh) meshes++;
    });
    expect(meshes).toBeLessThan(185);
  });

  it('knows which room a point is in', () => {
    expect(roomAt(0, 0).id).toBe('livingRoom');
    expect(roomAt(5, 1.1).id).toBe('hallway');
    expect(roomAt(5, -0.4).id).toBe('bathroom');
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

  it('lets Moke push through the hall-side bathroom opening and reach the paper, while the human can reach its cleanup point', async () => {
    const w = await setup();
    expect(w.travel(BATHROOM.doorway.x, 0.15)).toBe(true);
    expect(w.travel(BATHROOM.paperApproach.x, BATHROOM.paperApproach.z)).toBe(true);
    expect(Math.hypot(w.moke.position.x - BATHROOM.paper.x, w.moke.position.z - BATHROOM.paper.z)).toBeLessThan(1.15);
    expect(w.travel(BATHROOM.doorway.x, 1.2)).toBe(true);
    expect(w.travel(8, 1.2)).toBe(true);
    expect(humanNav.findPath(home.landmarks.laundry, BATHROOM.cleanup, [])).toBe(true);
    expect(humanNav.findPath(home.landmarks.familyRoom, BATHROOM.cleanup, [])).toBe(true);
    w.physics.world.free();
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
    // The glass doors to the backyard: not through the closed panes (Phase 5: the open slider is the way out).
    const yard = await setup({ x: 15.8, z: -3.0 });
    expect(yard.walkTo(18.5, -3.0, 4)).toBe(false);
    expect(yard.moke.position.x).toBeLessThan(16.9);
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

  it('lets Moke get to both his bowls, and the human to where they kneel to fill them', async () => {
    for (const bowl of [BOWLS.food, BOWLS.water]) {
      // Into the family room, then up to the bowl from the open floor in front of it (they're in a nook by the hearth).
      const { travel, walkTo, moke } = await setup();
      expect(travel(bowl.x, bowl.z - 0.8, 0.2)).toBe(true);
      walkTo(bowl.x, bowl.z - 0.3, 3, 0.05);
      expect(Math.hypot(moke.position.x - bowl.x, moke.position.z - bowl.z)).toBeLessThan(BOWL_REFILL.reach);
    }
    const path: Point2[] = [];
    expect(humanNav.isWalkable(BOWLS.stand.x, BOWLS.stand.z)).toBe(true);
    for (const from of [placeById(BOWLS.sources.food).stand, placeById(BOWLS.sources.water).stand, home.landmarks.laundry]) {
      expect(humanNav.findPath(from, BOWLS.stand, path)).toBe(true);
    }
  }, 30_000);

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

  it('lines every interaction point up with what it is for: facing the counter or table, stepping straight into seats', () => {
    for (const place of home.places) {
      const forward = { x: Math.sin(place.facing), z: Math.cos(place.facing) };
      if (place.surface) {
        const toward = Math.atan2(place.surface.x - place.stand.x, place.surface.z - place.stand.z);
        const off = Math.abs(Math.atan2(Math.sin(toward - place.facing), Math.cos(toward - place.facing)));
        expect(off, `${place.id} faces its surface`).toBeLessThan(0.7);
      }
      if (!place.seat) continue;
      // The last step onto the seat is straight back (a sofa) or straight sideways (a chair or stool at a table):
      // never a diagonal slide.
      const from = place.seat.entry ?? place.stand;
      const dx = place.seat.x - from.x;
      const dz = place.seat.z - from.z;
      const along = dx * forward.x + dz * forward.z;
      const across = dx * forward.z - dz * forward.x;
      expect(Math.min(Math.abs(along), Math.abs(across)), `${place.id} steps straight in`).toBeLessThan(0.1);
      // Stood behind the seat (a chair tucked under the table)? Then they come in from beside it, not through its back.
      const standBehind = (place.stand.x - place.seat.x) * forward.x + (place.stand.z - place.seat.z) * forward.z < -0.1;
      if (standBehind) {
        expect(place.seat.entry, `${place.id} has a way in beside it`).toBeDefined();
        const e = place.seat.entry!;
        expect(Math.abs((e.x - place.seat.x) * forward.z - (e.z - place.seat.z) * forward.x), `${place.id} entry is beside it`).toBeGreaterThan(0.3);
      }
    }
  });

  it('never smooths the human into a squeeze it cannot plan out of (between the chaise and the coffee table)', () => {
    const path: Point2[] = [];
    // A straight line may not slip diagonally between two blocked cells...
    expect(humanNav.lineOfSight({ x: 13.2, z: 2.5 }, { x: 13.4, z: 2.3 })).toBe(false);
    // ...and standing right in the squeeze, there's still a way out to anywhere.
    expect(humanNav.findPath({ x: 13.3, z: 2.4 }, { x: 8.08, z: 2.95 }, path)).toBe(true);
    expect(humanNav.findPath({ x: 13.3, z: 2.4 }, { x: 13.75, z: 1.85 }, path)).toBe(true);
  });

  it("keeps the human out of dog-sized gaps: under the dining table and between the chairs", () => {
    const { underDiningTable } = home.landmarks;
    expect(humanNav.isWalkable(underDiningTable.x, underDiningTable.z)).toBe(false);
    expect(humanNav.isWalkable(9.6, 3.28)).toBe(false);
  });

  it('never leaves him wedged between the step stool and the sofa arms (the jump safety net frees him)', async () => {
    // Hopping at the step stool from the south, this approach used to leave him resting on edges in the gap
    // between the stool and the two sofa arms: "in the air", unable to jump or walk, for good.
    const { moke, physics } = await setup({ x: 16.0, z: 2.1 }, 0);
    const dx = 16.03 - 16.0;
    const dz = 1.32 - 2.1;
    const d = Math.hypot(dx, dz);
    for (let i = 0; i < 1.6 / DT; i++) {
      if (i % 16 === 5) moke.requestJump();
      moke.fixedUpdate(DT, { x: dx / d, z: dz / d, walk: false, run: false });
      physics.step();
    }
    for (let i = 0; i < 1 / DT; i++) {
      moke.fixedUpdate(DT, { x: 0, z: 0, walk: false, run: false });
      physics.step();
    }
    expect(moke.airborne).toBe(false);
    expect(moke.position.y).toBeLessThan(0.05);
  });

  it('lets him into the home gym from the dining room, round the bike and the weights, up to the bird cage', async () => {
    const w = await setup({ x: 10.5, z: -1.7 }, Math.PI / 2);
    expect(w.walkTo(11.6, -1.7, 4)).toBe(true); // straight through the doorway (the old sliding doors)
    expect(roomAt(w.moke.position.x, w.moke.position.z).id).toBe('gym');
    expect(w.travel(12.75, -1.1)).toBe(true); // beside the bike
    expect(w.travel(14.7, -0.75)).toBe(true); // in front of the dumbbell rack
    expect(w.travel(15.8, -3.72)).toBe(true); // in front of the cage
    // …but not behind or under it.
    expect(mokeNav.isWalkable(16.72, -3.72)).toBe(false);
    expect(w.travel(10.5, -1.7)).toBe(true); // and back out to the dining room
  });

  describe('with the human sitting at the dining table, gym side', () => {
    for (const place of HOME_PLACES.filter((p) => p.id.startsWith('dining.chair'))) {
      it(`lets Moke round ${place.id} and on into the gym (their body goes onto the chair with them)`, async () => {
        const w = await setup({ x: 8.85, z: 0.05 }, Math.PI / 2);
        const human = new HumanController(new CharacterBody(w.physics, { x: place.stand.x, y: 0, z: place.stand.z }, HUMAN.body), humanNav, place.facing);
        const s = place.seat!;
        const seat: SeatSpec = { x: s.x, z: s.z, height: s.height, style: s.style, facing: place.facing, entry: s.entry ?? null };
        const intent: HumanIntent = { goal: place.stand, speed: HUMAN.move.walkSpeed, stopWithin: 0.15, face: null, headYaw: 0, crouch: 0, pose: 'idle', seat, prop: null, lookAt: null, talking: 0 };
        for (let i = 0; i < 6 / DT && !human.seated; i++) {
          human.fixedUpdate(DT, intent);
          w.physics.step();
        }
        expect(human.seated).toBe(true);
        // Through the corner by the kitchen opening and along behind the chairs, where the human stood to sit down…
        expect(w.walkTo(10.5, -0.2)).toBe(true);
        expect(w.walkTo(place.stand.x, place.stand.z)).toBe(true);
        expect(w.walkTo(10.45, -2.9)).toBe(true);
        // …and into the gym.
        expect(w.travel(11.6, -1.7)).toBe(true);
        expect(roomAt(w.moke.position.x, w.moke.position.z).id).toBe('gym');
        // Asked to get up with Moke standing right where they sat down from: their body can't come back down on top of
        // him, so they get up beside him instead (no waiting for him), and walk away once he's out of the walkway.
        expect(w.travel(place.stand.x, place.stand.z)).toBe(true);
        intent.seat = null;
        intent.goal = { x: 8.85, y: 0, z: 0.1 };
        intent.avoid = w.moke.position;
        let onTopOfMoke = false;
        const run = (seconds: number) => {
          for (let i = 0; i < seconds / DT; i++) {
            human.fixedUpdate(DT, intent);
            w.physics.step();
            const gap = Math.hypot(human.position.x - w.moke.position.x, human.position.z - w.moke.position.z);
            if (!human.seat && gap < HUMAN.body.radius + MOKE_BODY.radius) onTopOfMoke = true;
          }
        };
        run(3);
        expect(human.seat).toBeNull();
        expect(w.travel(11.6, -1.7)).toBe(true);
        run(12);
        expect(onTopOfMoke).toBe(false);
        expect(Math.hypot(human.position.x - 8.85, human.position.z - 0.1)).toBeLessThan(0.3);
      });
    }
  });

  describe('with the human sitting on a couch', () => {
    const inside = (p: Vector3) => home.colliders.some((box) => {
      const q = new Quaternion(...box.rotation).invert();
      const local = p.clone().sub(new Vector3(...box.center)).applyQuaternion(q);
      return Math.abs(local.x) < box.halfExtents[0] && Math.abs(local.y) < box.halfExtents[1] && Math.abs(local.z) < box.halfExtents[2];
    });
    const couchSeats = HOME_PLACES.filter((p) => p.kind === 'couchSeat' || p.kind === 'readingSeat');

    it('seats them far enough forward that their shins come down in front of the couch, not through it', () => {
      for (const place of couchSeats) {
        const s = place.seat!;
        const f = { x: Math.sin(place.facing), z: Math.cos(place.facing) };
        // Sitting, the knees are 0.44 m in front of the hips and the shins hang down from them (about 6 cm thick).
        for (const [ahead, y] of [[0.44, 0.45], [0.38, 0.3], [0.38, 0.15]] as const) {
          const p = new Vector3(s.x + f.x * ahead, y, s.z + f.z * ahead);
          expect(inside(p), `${place.id}: ${ahead} m ahead at ${y} m`).toBe(false);
        }
      }
    });

    const lanes: Record<string, [Point2, Point2]> = {
      'living.couch': [{ x: -1.05, z: -1.72 }, { x: 1.65, z: -1.72 }],
      'family.sectional': [{ x: 13.45, z: 1.95 }, { x: 15.5, z: 1.95 }],
      'family.windowCouch': [{ x: 15.45, z: 1.6 }, { x: 15.45, z: 4.2 }],
    };
    for (const place of couchSeats) {
      const lane = lanes[place.id.replace(/\.[a-z]+$/, '')];
      if (!lane) continue;
      it(`leaves room to walk past in front of them on ${place.id}, between the couch and the coffee table`, async () => {
        const [a, b] = lane;
        const w = await setup(a, Math.atan2(b.x - a.x, b.z - a.z));
        const human = new HumanController(new CharacterBody(w.physics, { x: place.stand.x, y: 0, z: place.stand.z }, HUMAN.body), humanNav, place.facing);
        const s = place.seat!;
        const seat: SeatSpec = { x: s.x, z: s.z, height: s.height, style: s.style, facing: place.facing, entry: s.entry ?? null };
        const intent: HumanIntent = { goal: place.stand, speed: HUMAN.move.walkSpeed, stopWithin: 0.15, face: null, headYaw: 0, crouch: 0, pose: 'idle', seat, prop: null, lookAt: null, talking: 0 };
        for (let i = 0; i < 6 / DT && !human.seated; i++) {
          human.fixedUpdate(DT, intent);
          w.physics.step();
        }
        expect(human.seated).toBe(true);
        expect(w.walkTo(b.x, b.z)).toBe(true);
        expect(w.walkTo(a.x, a.z)).toBe(true);
      });
    }
  });
});
