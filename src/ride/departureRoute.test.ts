import { Matrix4, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { DEPARTURE_HOME as HOME } from '../config/ride';
import { departureRoute } from './departureRoute';
import { drivePath, LANE, routeCurve, samplePath } from './coastRoute';

describe('driveway to neighborhood through street', () => {
  const coast = drivePath(routeCurve()), departure = departureRoute(coast);
  const local = new Matrix4().makeRotationY(departure.yaw).setPosition(departure.origin).invert();
  it('begins on the driveway perpendicular to a street that runs across the house frontage', () => {
    const pos = new Vector3(), dir = new Vector3();
    samplePath(departure.path, 0, pos, dir);
    expect(pos.clone().applyMatrix4(local).length()).toBeLessThan(0.001);
    const forward = new Vector3(0, 0, 1).transformDirection(new Matrix4().makeRotationY(departure.yaw));
    expect(dir.angleTo(forward)).toBeLessThan(0.01);
    const street = coast.points[0]!.clone().applyMatrix4(local);
    expect(street.x).toBeCloseTo(0);
    expect(street.z).toBeCloseTo(HOME.street.center + LANE);
    expect(Math.abs(dir.dot(new Vector3().subVectors(coast.points[2]!, coast.points[0]!).normalize()))).toBeLessThan(0.03);
  });
  it('turns continuously into the original coast lane, without gaps, reversing, or teleporting', () => {
    const pos = new Vector3(), dir = new Vector3(), last = new Vector3();
    samplePath(departure.path, 0, pos, last);
    for (let s = 0.1; s < departure.joinDistance + 10; s += 0.1) {
      samplePath(departure.path, s, pos, dir);
      expect(dir.angleTo(last)).toBeLessThan(0.035);
      last.copy(dir);
    }
    const end = new Vector3(), coastDir = new Vector3();
    samplePath(coast, HOME.street.joinAt, end, coastDir);
    samplePath(departure.path, departure.joinDistance, pos, dir);
    expect(pos.distanceTo(end)).toBeLessThan(0.001);
    expect(dir.angleTo(coastDir)).toBeLessThan(0.05);
    expect(departure.path.points.at(-1)!.distanceTo(coast.points.at(-1)!)).toBe(0);
  });
});
