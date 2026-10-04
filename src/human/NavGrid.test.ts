import { describe, expect, it } from 'vitest';
import type { StaticBox } from '../physics/PhysicsWorld';
import { LivingRoom } from '../world/LivingRoom';
import { HUMAN } from '../config/human';
import { NavGrid, type Point2 } from './NavGrid';

const box = (x: number, z: number, hx: number, hz: number, y0 = 0, y1 = 1): StaticBox => ({
  center: [x, (y0 + y1) / 2, z],
  halfExtents: [hx, (y1 - y0) / 2, hz],
  rotation: [0, 0, 0, 1],
});

const options = (agentRadius: number) => ({
  bounds: { minX: -3, maxX: 3, minZ: -3, maxZ: 3 },
  cell: 0.1,
  agentRadius,
  minY: 0.08,
  maxY: 1.7,
});

const length = (from: Point2, path: Point2[]) => {
  let total = 0;
  let at = from;
  for (const p of path) {
    total += Math.hypot(p.x - at.x, p.z - at.z);
    at = p;
  }
  return total;
};

describe('NavGrid', () => {
  it('goes straight when nothing is in the way', () => {
    const grid = new NavGrid([], options(0.24));
    const path: Point2[] = [];
    expect(grid.findPath({ x: -2, z: 0 }, { x: 2, z: 0 }, path)).toBe(true);
    expect(path).toHaveLength(1);
  });

  it('walks around an obstacle, never through it', () => {
    const grid = new NavGrid([box(0, 0, 0.5, 1.5)], options(0.24));
    const path: Point2[] = [];
    const from = { x: -2, z: 0 };
    expect(grid.findPath(from, { x: 2, z: 0 }, path)).toBe(true);
    expect(path.length).toBeGreaterThan(1);
    let at = from;
    for (const p of path) {
      expect(grid.lineOfSight(at, p)).toBe(true);
      at = p;
    }
    expect(length(from, path)).toBeGreaterThan(4.5);
  });

  it('keeps dog-sized gaps dog-only', () => {
    // Two blocks with a 0.46 m gap: fine for a 0.17 m dog, too tight for a 0.24 m person.
    const walls = [box(0, -1.48, 0.3, 1.25), box(0, 1.48, 0.3, 1.25)];
    const dog = new NavGrid(walls, options(0.17));
    const person = new NavGrid(walls, options(0.24));
    expect(dog.isWalkable(0, 0)).toBe(true);
    expect(person.isWalkable(0, 0)).toBe(false);
  });

  it('ignores things below the knee band (a rug) and above head height', () => {
    const grid = new NavGrid([box(0, 0, 1, 1, 0, 0.01), box(0, 0, 1, 1, 2.2, 2.4)], options(0.24));
    expect(grid.isWalkable(0, 0)).toBe(true);
  });

  it('snaps an unreachable goal to the nearest walkable spot', () => {
    const grid = new NavGrid([box(0, 0, 0.5, 0.5)], options(0.24));
    const near = grid.nearestWalkable(0, 0)!;
    expect(grid.isWalkable(near.x, near.z)).toBe(true);
    expect(Math.hypot(near.x, near.z)).toBeLessThan(1);
  });

  it('finds the human a way round the game\'s living room: around the coffee table, not under it', () => {
    const room = new LivingRoom();
    const grid = new NavGrid(room.colliders, {
      bounds: { minX: -3.6, maxX: 6.8, minZ: -3.1, maxZ: 3.1 },
      cell: 0.1,
      agentRadius: HUMAN.body.radius,
      minY: 0.08,
      maxY: 1.7,
    });
    const { underTable, hallwayEnd } = room.landmarks;
    expect(grid.isWalkable(underTable.x, underTable.z)).toBe(false);
    // Nor can they squeeze between the coffee table and the couch: a dog-only hideout.
    expect(grid.isWalkable(0.3, -1.7)).toBe(false);
    const path: Point2[] = [];
    // From one end of the table to the other: round the front of it.
    const from = { x: -1.4, z: -1.15 };
    expect(grid.findPath(from, { x: 2.0, z: -1.15 }, path)).toBe(true);
    expect(length(from, path)).toBeGreaterThan(3.45);
    expect(Math.max(...path.map((p) => p.z))).toBeGreaterThan(-0.84);
    // And out through the doorway to the end of the hallway.
    expect(grid.findPath({ x: -1.4, z: -1.15 }, hallwayEnd, path)).toBe(true);
    expect(path.at(-1)!.x).toBeGreaterThan(5.5);
  });

  it('knows which floor is connected, and the nearest reachable point to a spot that is walled in', () => {
    // A closed pen in the middle (walls on four sides): inside is walkable but cut off.
    const pen = [box(0, -0.8, 0.9, 0.05), box(0, 0.8, 0.9, 0.05), box(-0.8, 0, 0.05, 0.9), box(0.8, 0, 0.05, 0.9)];
    const grid = new NavGrid(pen, options(0.1));
    const outside = { x: -2.5, z: -2.5 };
    expect(grid.region(0, 0)).toBeGreaterThanOrEqual(0);
    expect(grid.region(0, 0)).not.toBe(grid.region(outside.x, outside.z));
    expect(grid.region(2.5, 2.5)).toBe(grid.region(outside.x, outside.z));
    expect(grid.region(0.8, 0)).toBe(-1);
    // From outside, the nearest reachable floor to the middle of the pen is just outside its wall.
    const near = grid.nearestReachable(outside, { x: 0.5, z: 0 }, 1.5)!;
    expect(grid.region(near.x, near.z)).toBe(grid.region(outside.x, outside.z));
    expect(near.x).toBeGreaterThan(0.95);
    expect(near.x).toBeLessThan(1.15);
    expect(grid.nearestReachable(outside, { x: 0, z: 0 }, 0.3)).toBeNull();
    // Already reachable: unchanged.
    expect(grid.nearestReachable(outside, { x: 2, z: 2 })).toEqual({ x: 2, z: 2 });
  });
});
