import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { coastX, drivePath, landHeight, routeCurve, samplePath } from './coastRoute';

describe('the ride’s road (Phase 6)', () => {
  const curve = routeCurve();
  const path = drivePath(curve);

  it('goes out and back as one smooth way round: no jumps, a sensible length', () => {
    for (let i = 1; i < path.points.length; i++) expect(path.points[i]!.distanceTo(path.points[i - 1]!)).toBeLessThan(4);
    expect(path.length).toBeGreaterThan(2000);
    expect(path.length).toBeLessThan(2600);
    // It ends where it started, in the other lane.
    expect(path.points[0]!.distanceTo(path.points[path.points.length - 1]!)).toBeLessThan(8);
  });

  it('keeps the road on land, behind the beach, and the sea on the passenger side (right) on the way home', () => {
    const pos = new Vector3(), dir = new Vector3();
    let seaOnRight = 0, beachStretch = 0;
    for (let s = 0; s < path.length; s += 10) {
      samplePath(path, s, pos, dir);
      expect(pos.x).toBeGreaterThan(coastX(pos.z) + 25);
      const right = { x: -dir.z, z: dir.x };
      // Along the beach (z -150…-450), heading home: is the sea on his side?
      if (pos.z < -150 && pos.z > -450 && dir.z > 0.5) {
        beachStretch++;
        if (landHeight(pos.x + right.x * 85, pos.z + right.z * 85) < 0) seaOnRight++;
      }
    }
    expect(beachStretch).toBeGreaterThan(10);
    expect(seaOnRight / beachStretch).toBeGreaterThan(0.9);
  });

  it('climbs the grade to the top and comes back down', () => {
    const top = Math.max(...path.points.map((p) => p.y));
    expect(top).toBeGreaterThan(45);
    expect(landHeight(coastX(-700) + 40, -700)).toBeGreaterThan(30); // bluffs up there
    expect(landHeight(coastX(-300) - 30, -300)).toBeLessThan(0); // the sea off the beach
  });
});
