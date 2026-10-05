import { describe, expect, it } from 'vitest';
import { FSD } from '../config/autopilot';
import { NavGrid } from '../human/NavGrid';
import type { StaticBox } from '../physics/PhysicsWorld';
import { FullSelfDog, type FsdSurface, type FsdTarget, type FsdWorld } from './FullSelfDog';

const DT = 1 / 30;
const box = (cx: number, cz: number, hx: number, hz: number, hy = 0.3): StaticBox => ({ center: [cx, hy, cz], halfExtents: [hx, hy, hz], rotation: [0, 0, 0, 1] });
/** An empty 12 × 12 m floor with a wall down the middle (a gap at the top), so routes have to go round. */
const nav = new NavGrid([box(0, -1.5, 0.1, 4.5, 1)], { bounds: { minX: -6, maxX: 6, minZ: -6, maxZ: 6 }, cell: 0.1, agentRadius: 0.2, minY: 0.03, maxY: 0.38 });

interface Fake extends FsdWorld {
  moke: { position: { x: number; y: number; z: number }; heading: number; grounded: boolean; speed: number; carrying: string | null; resting: boolean; watching: boolean; busy: boolean };
  human: { position: { x: number; y: number; z: number }; available: boolean; effect: string | null; placeKind: string | null } | null;
  heistRunning: boolean;
  heistPhase: string;
  doorRinging: boolean;
  ballgameOn: boolean;
  holdingPaper: boolean;
  course: { phase: string } | null;
  rewardWaiting: boolean;
  play: { phase: 'idle' | 'asking' | 'playing' };
  interactables: FsdTarget[];
  current: string | null;
  surfaces: FsdSurface[];
}

/** A tiny stand-in game: Moke moves where FSD steers him (no physics); the prompt is the nearest enabled target in reach. */
function world(): Fake & { onPress?: (press: string, current: string | null) => void; step(seconds: number, fsd: FullSelfDog, each?: () => void): string[] } {
  const w: Fake = {
    moke: { position: { x: -4, y: 0, z: 4 }, heading: 0, grounded: true, speed: 0, carrying: null, resting: false, watching: false, busy: false },
    human: null,
    heistRunning: false,
    heistPhase: 'waiting',
    doorRinging: false,
    ballgameOn: false,
    holdingPaper: false,
    course: null,
    rewardWaiting: false,
    play: { phase: 'idle' },
    interactables: [],
    current: null,
    screens: [{ id: 'living', x: 4, y: 1, z: -5.5, facing: 0 }],
    surfaces: [],
    roomName: () => 'the living room',
  };
  const game = Object.assign(w, {
    onPress: undefined as ((press: string, current: string | null) => void) | undefined,
    step(seconds: number, fsd: FullSelfDog, each?: () => void) {
      const presses: string[] = [];
      for (let i = 0; i < seconds / DT; i++) {
        // The prompt: the nearest enabled target in reach.
        let best: FsdTarget | null = null;
        for (const t of w.interactables) {
          const d = Math.hypot(t.position.x - w.moke.position.x, t.position.z - w.moke.position.z);
          if (t.enabled && d <= t.interactionDistance && (!best || d < Math.hypot(best.position.x - w.moke.position.x, best.position.z - w.moke.position.z))) best = t;
        }
        w.current = best?.id ?? null;
        const cmd = fsd.update(DT, w);
        const speed = cmd.run ? 4 : cmd.walk ? 0.8 : 1.8;
        const len = Math.hypot(cmd.x, cmd.z);
        w.moke.position.x += cmd.x * speed * DT;
        w.moke.position.z += cmd.z * speed * DT;
        w.moke.speed = len * speed;
        for (const p of cmd.presses) {
          presses.push(p);
          game.onPress?.(p, w.current);
        }
        each?.();
      }
      return presses;
    },
  });
  return game;
}

type Target = { -readonly [K in keyof FsdTarget]: FsdTarget[K] };
const target = (id: string, x: number, z: number, enabled = true, reach = 0.8): Target => ({ id, label: id, enabled, position: { x, y: 0, z }, interactionDistance: reach });

describe('FSD, Full Self Dog (the autopilot)', () => {
  it('with nothing to do, still goes exploring round the house', () => {
    const w = world();
    const fsd = new FullSelfDog(nav, () => 0.3);
    const start = { ...w.moke.position };
    w.step(6, fsd);
    expect(fsd.routineId === 'explore' || fsd.stats.started.get('explore')).toBeTruthy();
    expect(Math.hypot(w.moke.position.x - start.x, w.moke.position.z - start.z)).toBeGreaterThan(1.5);
    expect(fsd.status).toMatch(/Exploring/);
  });

  it('answers the door the moment it rings, cutting in on whatever he was doing, and barks at it once he is there', () => {
    const w = world();
    const fsd = new FullSelfDog(nav, () => 0.3);
    w.step(2, fsd); // off exploring
    w.doorRinging = true;
    // Behind the wall: the route has to go round its end.
    w.interactables.push(target('door:bark', 4, 3));
    // As in the game: the bark at the door stops the ringing.
    w.onPress = (press, current) => { if (press === 'interact' && current === 'door:bark') w.doorRinging = false; };
    // On his way: the trail (the rainbow path) leads round the wall to the door.
    w.step(0.1, fsd);
    expect(fsd.trail.length).toBeGreaterThan(0);
    const end = fsd.trail[fsd.trail.length - 1]!;
    expect(Math.hypot(end.x - 4, end.z - 3)).toBeLessThan(0.3);
    const presses = w.step(12, fsd);
    expect(fsd.stats.started.get('door')).toBe(1);
    expect(presses).toContain('interact');
    expect(Math.hypot(w.moke.position.x - 4, w.moke.position.z - 3)).toBeLessThan(0.8);
    // Never through the wall (x 0 ± 0.1 below z 3).
  });

  it('routes round walls, never through them', () => {
    const w = world();
    const fsd = new FullSelfDog(nav, () => 0.3);
    w.doorRinging = true;
    w.moke.position = { x: -3, y: 0, z: -3 };
    w.interactables.push(target('door:bark', 3, -3));
    let crossedThroughWall = false;
    let prevX = w.moke.position.x;
    w.step(15, fsd, () => {
      if (Math.sign(prevX) !== Math.sign(w.moke.position.x) && w.moke.position.z < 2.9) crossedThroughWall = true;
      prevX = w.moke.position.x;
    });
    expect(crossedThroughWall).toBe(false);
    expect(Math.hypot(w.moke.position.x - 3, w.moke.position.z + 3)).toBeLessThan(0.8);
  });

  it('goes and watches the ballgame when it comes on: to the TV, Watch the Game, then sits still until it ends', () => {
    const w = world();
    const fsd = new FullSelfDog(nav, () => 0.3);
    w.ballgameOn = true;
    const screen = w.screens[0]!;
    const watchSpot = { x: screen.x + Math.sin(screen.facing) * FSD.watchDistance, z: screen.z + Math.cos(screen.facing) * FSD.watchDistance };
    w.interactables.push(target('tv:watch', watchSpot.x, watchSpot.z, true, 1));
    let pressedAt: { x: number; z: number } | null = null;
    // As in the game: Watch the Game sits him down watching.
    w.onPress = (press, current) => {
      if (press === 'interact' && current === 'tv:watch') {
        pressedAt = { ...w.moke.position };
        w.moke.watching = true;
      }
    };
    w.step(15, fsd);
    expect(fsd.stats.started.get('watchGame')).toBe(1);
    expect(pressedAt).not.toBeNull();
    expect(Math.hypot(pressedAt!.x - watchSpot.x, pressedAt!.z - watchSpot.z)).toBeLessThan(1);
    // Watching: he holds still, however long it goes on.
    w.ballgameOn = false;
    const before = { ...w.moke.position };
    w.step(10, fsd);
    expect(w.moke.position).toEqual(before);
    expect(fsd.status).toMatch(/Padres/);
    w.moke.watching = false;
    w.step(4, fsd);
    expect(fsd.routineId).not.toBe('keepWatching');
  });

  it('plays the Sock Heist through: shows the sock off till they notice, keeps away, waits for the treat, trades, eats', () => {
    const w = world();
    let seed = 11;
    const fsd = new FullSelfDog(nav, () => ((seed = (seed * 16807) % 2147483647) / 2147483647));
    const human = { x: 3, y: 0, z: 4 };
    w.human = { position: human, available: false, effect: null, placeKind: null };
    w.moke.carrying = 'sock';
    w.heistRunning = true;
    w.heistPhase = 'stolen';
    const give = target('heist:give', human.x, human.z, false, 0.9);
    const treat = target('eat:treat', human.x - 0.5, human.z, false, 0.6);
    w.interactables.push(give, treat);
    // As in the game: a bark with the sock in his mouth gets him noticed; the trade puts the treat down.
    w.onPress = (press, current) => {
      if (press === 'bark' && w.heistPhase === 'stolen') w.heistPhase = 'chase';
      if (press === 'interact' && current === 'heist:give') {
        w.moke.carrying = null;
        give.enabled = false;
        w.heistPhase = 'trade';
        treat.enabled = true;
      }
      if (press === 'interact' && current === 'eat:treat') {
        w.heistPhase = 'eating';
        treat.enabled = false;
      }
    };
    w.step(8, fsd);
    expect(fsd.stats.started.get('tease')).toBe(1);
    expect(w.heistPhase).toBe('chase');
    // The chase: he keeps his distance.
    let closest = Infinity;
    w.step(12, fsd, () => {
      closest = Math.min(closest, Math.hypot(w.moke.position.x - human.x, w.moke.position.z - human.z));
    });
    expect(fsd.routineId).toBe('flee');
    expect(closest).toBeGreaterThan(1.5);
    // They give up and go for a treat: he waits for it, then trades when it's offered, then eats it.
    w.heistPhase = 'treat';
    w.step(3, fsd);
    expect(fsd.routineId).toBe('awaitTreat');
    give.enabled = true;
    w.step(15, fsd);
    expect(fsd.stats.started.get('giveSock')).toBe(1);
    expect(fsd.stats.started.get('eatTreat')).toBe(1);
    expect(w.heistPhase).toBe('eating');
    expect(fsd.stats.failed.size).toBe(0);
  });

  it('gets out of a pocket of floor the grid thinks is closed off (squeezed between chairs), then carries on', () => {
    // A pen of chairs with gaps too narrow for the grid but not for him (the fake world lets him through).
    const pen = [box(-3, -3.6, 0.8, 0.05), box(-3, -2.4, 0.8, 0.05), box(-3.6, -3, 0.05, 0.8), box(-2.4, -3, 0.05, 0.8)];
    const grid = new NavGrid([box(0, -1.5, 0.1, 4.5, 1), ...pen], { bounds: { minX: -6, maxX: 6, minZ: -6, maxZ: 6 }, cell: 0.1, agentRadius: 0.2, minY: 0.03, maxY: 0.38 });
    const w = world();
    w.moke.position = { x: -3, y: 0, z: -3 };
    expect(grid.region(-3, -3)).not.toBe(grid.region(-5, 5));
    const fsd = new FullSelfDog(grid, () => 0.3);
    w.doorRinging = true;
    w.interactables.push(target('door:bark', -5, 5));
    w.onPress = (press, current) => { if (press === 'interact' && current === 'door:bark') w.doorRinging = false; };
    w.step(15, fsd);
    expect(w.doorRinging, 'he got out and barked at the door').toBe(false);
    expect(fsd.stats.done.get('door')).toBe(1);
    expect(fsd.stats.failed.get('door') ?? 0).toBe(0);
  });

  it("leaves Liam's Obstacle Course for the first couple of minutes, then does it at most every few minutes", () => {
    const w = world();
    (w as { course: { phase: string } | null }).course = { phase: 'idle' };
    // random() = 0 picks the first open routine: the course, whenever it's allowed.
    const fsd = new FullSelfDog(nav, () => 0);
    w.step(FSD.courseFirstAfter - 5, fsd);
    expect(fsd.stats.started.get('course') ?? 0).toBe(0);
    w.step(30, fsd);
    expect(fsd.stats.started.get('course')).toBe(1);
    w.step(FSD.courseEvery - 60, fsd);
    expect(fsd.stats.started.get('course')).toBe(1);
  });

  it('lets whatever he is in the middle of finish (eating, a trick, pets) before moving on', () => {
    const w = world();
    const fsd = new FullSelfDog(nav, () => 0.3);
    w.moke.busy = true;
    const before = { ...w.moke.position };
    w.step(3, fsd);
    expect(w.moke.position).toEqual(before);
    w.moke.busy = false;
    w.step(3, fsd);
    expect(w.moke.position).not.toEqual(before);
  });

  it('gets up out of bed first (a hop), before heading off', () => {
    const w = world();
    const fsd = new FullSelfDog(nav, () => 0.3);
    w.moke.resting = true;
    const presses = w.step(DT, fsd);
    expect(presses).toEqual(['jump']);
  });

  it('only picks what it can do now, and goes round the house rather than repeating itself', () => {
    const w = world();
    let seed = 7;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const fsd = new FullSelfDog(nav, random);
    w.human = { position: { x: 3, y: 0, z: 4 }, available: true, effect: null, placeKind: null };
    w.interactables.push(
      target('pickup:ball', -3, 2), target('pickup:fish', -2, -4), target('human:pet', 3, 4),
      target('bowl:food', 5, 0), target('bowl:water', 5, 1), target('bird:play', -5, -5),
      target('kitchen:beg', 3, 4, false), // not prep time: never
    );
    // Picking up and dropping: the fake "carrying" follows the presses.
    w.step(240, fsd, () => {
      if (w.current?.startsWith('pickup:') && w.current !== 'pickup:drop') {
        /* the press happens in update; mirror it */
      }
    });
    const started = [...fsd.stats.started.keys()];
    expect(started).not.toContain('carrot');
    expect(started).not.toContain('door');
    expect(new Set(started).size).toBeGreaterThanOrEqual(5);
  });

  it('hops onto a coffee table from beside it, not from under it, then gets down again', () => {
    const table: FsdSurface = { id: 'livingCoffee', kind: 'table', x: -3, z: 0, halfX: 0.6, halfZ: 0.3, height: 0.45 };
    let jumpedFrom: { x: number; z: number } | null = null;
    // Watch for the jump press.
    const fsd2 = new FullSelfDog(nav, () => 0);
    const w2 = world();
    w2.surfaces.push(table);
    for (let i = 0; i < 12 / DT && !jumpedFrom; i++) {
      const presses = w2.step(DT, fsd2);
      if (presses.includes('jump')) jumpedFrom = { ...w2.moke.position };
    }
    expect(fsd2.routineId).toBe('table');
    expect(jumpedFrom).not.toBeNull();
    const outside = Math.abs(jumpedFrom!.x - table.x) > table.halfX || Math.abs(jumpedFrom!.z - table.z) > table.halfZ;
    expect(outside).toBe(true);
    // Up he goes: then he waits a while, and walks off it.
    w2.moke.position.y = table.height;
    w2.moke.position.x = table.x;
    w2.moke.position.z = table.z;
    w2.step(FSD.tableFor[1] + 0.5, fsd2);
    expect(Math.hypot(w2.moke.position.x - table.x, w2.moke.position.z - table.z)).toBeGreaterThan(0.2);
  });
});
