import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BEACH, coastX, drivePath, landHeight, roadAt, routeCurve, samplePath } from './coastRoute';

describe('the ride’s road (Phase 6)', () => {
  const curve = routeCurve();
  const path = drivePath(curve);

  it('is one smooth way, south from home down the coast: no jumps, a sensible length', () => {
    for (let i = 1; i < path.points.length; i++) expect(path.points[i]!.distanceTo(path.points[i - 1]!)).toBeLessThan(4);
    // About two minutes at the drive's speed (owner: a minute shorter than the first version's three).
    expect(path.length).toBeGreaterThan(1400);
    expect(path.length).toBeLessThan(1800);
    expect(path.points[path.points.length - 1]!.z).toBeGreaterThan(path.points[0]!.z + 1200);
  });

  it('turns smoothly: the heading never jumps from one moment to the next', () => {
    const pos = new Vector3(), dir = new Vector3(), last = new Vector3();
    samplePath(path, 0, pos, last);
    for (let s = 0.5; s < path.length; s += 0.5) {
      samplePath(path, s, pos, dir);
      // At 11 m/s, half a metre is a frame or two: never more than a degree of turn.
      expect(dir.angleTo(last)).toBeLessThan(0.02);
      last.copy(dir);
    }
  });

  it('keeps to the right-hand lane, on land, with the sea on his side (the right) all along the beach', () => {
    const pos = new Vector3(), dir = new Vector3();
    let seaOnRight = 0, beachStretch = 0;
    for (let s = 0; s < path.length; s += 10) {
      samplePath(path, s, pos, dir);
      expect(pos.x).toBeGreaterThan(coastX(pos.z) + 25);
      const right = { x: -dir.z, z: dir.x };
      if (pos.z > BEACH.zMin && pos.z < BEACH.zMax) {
        beachStretch++;
        // Right of the centre line (west: the beach side), and the sea that way.
        expect(pos.x).toBeLessThan(roadAt(pos.z).x - 1);
        if (landHeight(pos.x + right.x * 75, pos.z + right.z * 75) < 0) seaOnRight++;
      }
    }
    expect(beachStretch).toBeGreaterThan(80);
    expect(seaOnRight / beachStretch).toBeGreaterThan(0.95);
  });

  it('ends up the grade between the bluffs, the sea below', () => {
    const top = Math.max(...path.points.map((p) => p.y));
    expect(top).toBeGreaterThan(35);
    expect(landHeight(roadAt(1100).x + 60, 1100)).toBeGreaterThan(45); // the bluffs inland
    expect(landHeight(coastX(1100) + 4, 1100)).toBeLessThan(4); // the beach under the cliffs
    expect(landHeight(coastX(300) - 30, 300)).toBeLessThan(0); // the sea off the beach
  });
});
