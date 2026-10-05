import { describe, expect, it } from 'vitest';
import { FSD } from '../config/autopilot';
import { HEIST } from '../config/heist';
import { MISCHIEF_TABLES, PILLOW_SOFAS } from '../config/mischief';
import { MOKE_BODY, MOVEMENT } from '../config/movement';
import { NavGrid } from '../human/NavGrid';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MokeController } from '../player/MokeController';
import { Home } from '../world/Home';
import { BACKYARD_DOORWAY, GYM, roomAt } from '../world/home/layout';
import { ObstacleCourse } from '../activities/ObstacleCourse';
import { TV_SCREENS } from '../world/home/places';
import { FullSelfDog, type FsdSurface, type FsdTarget, type FsdWorld } from './FullSelfDog';

// FSD driving the real Moke body (Rapier) through the real house: the same navigation grid the game builds for it.
const DT = 1 / 60;
const home = new Home();
const nav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.1, agentRadius: MOKE_BODY.radius + 0.04, minY: 0.03, maxY: 0.38 });
/** The game's finer grid at his exact size, for squeezes. */
const tightNav = new NavGrid(home.colliders, { bounds: home.bounds, cell: 0.05, agentRadius: MOKE_BODY.radius + 0.01, minY: 0.03, maxY: 0.38 });

async function drive(opts: { targets?: FsdTarget[]; surfaces?: FsdSurface[]; doorRinging?: boolean; random?: () => number; course?: ObstacleCourse; start?: { x: number; z: number }; tuning?: typeof FSD; tight?: boolean }) {
  const physics = await PhysicsWorld.create();
  physics.addStaticBoxes(home.colliders);
  physics.commitStaticGeometry();
  const spawn = home.spawn;
  const start = opts.start ? { x: opts.start.x, y: 0.02, z: opts.start.z } : spawn.position;
  const c = new MokeController(new CharacterBody(physics, start, MOKE_BODY), spawn.heading, { ...MOVEMENT });
  const targets = opts.targets ?? [];
  let current: string | null = null;
  const w: FsdWorld = {
    moke: {
      get position() { return c.position; },
      get heading() { return c.heading; },
      get grounded() { return c.grounded; },
      get speed() { return c.actualSpeed; },
      carrying: null, resting: false, watching: false, busy: false,
    },
    human: null,
    heistRunning: false,
    heistPhase: 'waiting',
    doorRinging: opts.doorRinging ?? false,
    ballgameOn: false,
    holdingPaper: false,
    course: opts.course ?? null,
    rewardWaiting: false,
    play: { phase: 'idle' },
    interactables: targets,
    get current() { return current; },
    screens: TV_SCREENS,
    surfaces: opts.surfaces ?? [],
    roomName: (x, z) => home.roomAt(x, z).name,
  };
  const fsd = new FullSelfDog(nav, opts.random ?? (() => 0), opts.tuning, opts.tight ? () => tightNav : undefined);
  const pressed: string[] = [];
  const run = (seconds: number, each?: () => void) => {
    for (let i = 0; i < seconds / DT; i++) {
      current = targets.find((t) => t.enabled && Math.hypot(t.position.x - c.position.x, t.position.z - c.position.z) <= t.interactionDistance)?.id ?? null;
      const cmd = fsd.update(DT, w);
      if (cmd.presses.has('jump')) c.requestJump();
      for (const p of cmd.presses) pressed.push(p);
      c.fixedUpdate(DT, { x: cmd.x, z: cmd.z, walk: cmd.walk, run: cmd.run });
      physics.step();
      opts.course?.update(DT, { position: c.position, grounded: c.grounded }, roomAt(c.position.x, c.position.z).id === 'backyard');
      each?.();
    }
  };
  return { c, fsd, run, pressed };
}

describe('FSD in the real house (Rapier)', () => {
  it('runs Moke from the living room, down the hall, through the kitchen and dining room into the gym, to the bird cage', async () => {
    const cage = { x: GYM.cage.x - 0.7, y: 0, z: GYM.cage.z };
    const d = await drive({ doorRinging: true, targets: [{ id: 'door:bark', label: 'Bark', enabled: true, position: cage, interactionDistance: 0.9 }] });
    let arrived = -1;
    let t = 0;
    d.run(40, () => {
      t += DT;
      if (arrived < 0 && d.pressed.includes('interact')) arrived = t;
    });
    expect(arrived, 'pressed interact at the far end of the house').toBeGreaterThan(0);
    expect(home.roomAt(d.c.position.x, d.c.position.z).id).toBe('gym');
    expect(Math.hypot(d.c.position.x - cage.x, d.c.position.z - cage.z)).toBeLessThan(0.9);
    expect(d.fsd.stats.failed.size).toBe(0);
  }, 60_000);

  it('hops up onto the living-room coffee table, stays a while, and gets down again', async () => {
    const table = MISCHIEF_TABLES.find((t) => t.id === 'livingCoffee')!;
    const surface: FsdSurface = { id: table.id, kind: 'table', x: table.x, z: table.z, halfX: table.halfX, halfZ: table.halfZ, height: table.height };
    const d = await drive({ surfaces: [surface] });
    let onTable = 0;
    let downAfter = false;
    d.run(30, () => {
      const on = d.c.position.y > table.height - 0.1 && Math.abs(d.c.position.x - table.x) <= table.halfX + 0.05 && Math.abs(d.c.position.z - table.z) <= table.halfZ + 0.05;
      if (on) onTable += DT;
      else if (onTable > 2 && d.c.position.y < 0.05) downAfter = true;
    });
    expect(d.fsd.stats.started.get('table')).toBeGreaterThanOrEqual(1);
    expect(onTable, 'seconds up on the table').toBeGreaterThan(4);
    expect(downAfter).toBe(true);
    expect(d.fsd.stats.failed.get('table') ?? 0).toBe(0);
  }, 60_000);

  it("goes out through the open slider and runs Liam's Obstacle Course all the way round, by its rules", async () => {
    let done = 0;
    const course = new ObstacleCourse({ onComplete: () => done++ });
    // (FSD normally leaves the course for its first couple of minutes.)
    const d = await drive({ course, start: { x: 15.4, z: (BACKYARD_DOORWAY.zMin + BACKYARD_DOORWAY.zMax) / 2 }, tuning: { ...FSD, courseFirstAfter: 0 } as unknown as typeof FSD });
    d.run(70);
    expect(d.fsd.stats.started.get('course')).toBeGreaterThanOrEqual(1);
    expect(d.fsd.stats.failed.get('course') ?? 0).toBe(0);
    expect(done).toBeGreaterThanOrEqual(1);
    expect(d.pressed.filter((p) => p === 'jump').length).toBeGreaterThanOrEqual(2);
  }, 120_000);

  it('hops onto the couch under the family-room windows from inside the room, never from the lawn outside', async () => {
    const sofa = PILLOW_SOFAS.find((p) => p.id === 'window')!;
    const surface: FsdSurface = { id: sofa.id, kind: 'table', x: sofa.x, z: sofa.z, halfX: sofa.halfX, halfZ: sofa.halfZ, height: 0.45 };
    // Starting from the gym, the door out to the backyard is nearer the far side of the couch's wall.
    const d = await drive({ surfaces: [surface], start: { x: 15.4, z: (BACKYARD_DOORWAY.zMin + BACKYARD_DOORWAY.zMax) / 2 } });
    let wentOut = false;
    let up = 0;
    d.run(25, () => {
      if (roomAt(d.c.position.x, d.c.position.z).id === 'backyard') wentOut = true;
      if (d.c.position.y > 0.38) up += DT;
    });
    expect(wentOut).toBe(false);
    expect(up, 'seconds up on the couch').toBeGreaterThan(2);
  }, 60_000);

  it('squeezes between the dining chairs to a treat hidden under the table', async () => {
    const spot = home.landmarks.underDiningTable;
    const treat: FsdTarget = { id: 'eat:hunt', label: 'Eat Treat', enabled: true, position: { x: spot.x, y: 0, z: spot.z }, interactionDistance: HEIST.eatReach };
    const d = await drive({ targets: [treat], start: { x: 8.0, z: 1.2 }, tight: true });
    let ateAt: number | null = null;
    d.run(30, () => {
      if (ateAt === null && d.pressed.includes('interact')) ateAt = Math.hypot(d.c.position.x - spot.x, d.c.position.z - spot.z);
    });
    expect(ateAt, 'pressed Eat').not.toBeNull();
    expect(ateAt!, 'with the treat in reach').toBeLessThan(HEIST.eatReach);
    expect(d.fsd.stats.failed.get('eatTreat') ?? 0).toBe(0);
  }, 60_000);

  it('gets back out from between the dining chairs (where he once got stuck) to go somewhere else', async () => {
    const d = await drive({ doorRinging: true, start: { x: 9.0, z: -2.5 }, tight: true,
      targets: [{ id: 'door:bark', label: 'Bark', enabled: true, position: { x: 8.0, y: 0, z: 2.0 }, interactionDistance: 0.9 }] });
    let got = false;
    d.run(25, () => {
      if (!got && d.pressed.includes('interact')) got = true;
    });
    expect(got, 'out from the chairs and over to the kitchen').toBe(true);
    expect(d.fsd.stats.failed.get('door') ?? 0).toBe(0);
  }, 60_000);
});

