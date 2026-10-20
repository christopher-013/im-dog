import { CubicBezierCurve3, Vector3 } from 'three';
import { DEPARTURE_HOME } from '../config/ride';
import { LANE, samplePath, type DrivePath } from './coastRoute';

/** A driveway perpendicular to the through street, then a slow turn into the existing coast lane. */
export function departureRoute(coast: DrivePath) {
  const road = new Vector3(), along = new Vector3();
  samplePath(coast, 0, road, along);
  const forward = new Vector3(-along.z, 0, along.x).normalize();
  const origin = road.clone().addScaledVector(forward, -(DEPARTURE_HOME.street.center + LANE));
  const yaw = Math.atan2(forward.x, forward.z);
  const end = new Vector3(), endDir = new Vector3();
  samplePath(coast, DEPARTURE_HOME.street.joinAt, end, endDir);
  const startTurn = origin.clone().addScaledVector(forward, 4);
  const bend = new CubicBezierCurve3(startTurn, startTurn.clone().addScaledVector(forward, 10),
    end.clone().addScaledVector(endDir, -14), end);
  const points = [origin.clone(), origin.clone().addScaledVector(forward, 2), ...bend.getSpacedPoints(Math.ceil(bend.getLength()))];
  const joinIndex = points.length - 1;
  for (let i = 0; i < coast.points.length; i++) {
    if (coast.distances[i]! > DEPARTURE_HOME.street.joinAt) points.push(coast.points[i]!.clone());
  }
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1]! + points[i]!.distanceTo(points[i - 1]!));
  const heightPos = new Vector3(), heightDir = new Vector3();
  const heightAt = (x: number) => {
    samplePath(coast, Math.max(0, x), heightPos, heightDir);
    return heightPos.y - origin.y;
  };
  return { path: { points, distances, length: distances[distances.length - 1]! } satisfies DrivePath,
    origin, yaw, heightAt, joinDistance: distances[joinIndex]! };
}
