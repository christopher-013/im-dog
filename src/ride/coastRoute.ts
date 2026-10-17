import { CatmullRomCurve3, Vector3 } from 'three';

/**
 * The ride's road (Phase 6, D33/D34): a stylized homage to the drive south from Del Mar along Torrey Pines State Beach
 * (owner, 2026-10-17: "all about the ocean on the right"): down the hill from home to the coast, over the lagoon,
 * along the beach with the sea on the passenger side, then up the grade between the sandstone bluffs to the reserve
 * at the top (owner, 2026-10-17: shorter twice over, now about a minute and a quarter). One way; home is a fade. Pure numbers and maths (tested), shared by the scenery and the car. Metres;
 * x east, z south, y up; the ocean is to the west, so heading south it's on the right.
 */

/** Where the shoreline is at each z (the sea to the west of it). */
export function coastX(z: number): number {
  return -340 + 9 * Math.sin(z / 120 + 0.6) + 4 * Math.sin(z / 43);
}

/** The road's centre line, from the street outside home to the top of the grade (heading south, z growing). */
export const ROUTE_POINTS: readonly [number, number, number][] = [
  [-200, 11, -360],
  [-252, 6, -310],
  [-281, 4.4, -245],
  [-290, 4.2, -170],
  [-292, 4.2, -80],
  [-292, 4.2, 20],
  [-291, 4.2, 120],
  [-290, 4.2, 220],
  [-289, 4.2, 320],
  [-288, 4.3, 420],
  [-286, 4.4, 520],
  [-285, 4.5, 620],
  [-284, 4.8, 720],
  [-282, 6, 810],
  [-275, 11.5, 890],
  [-264, 21, 965],
];

/** The lagoon (inland of the road, crossed on a low causeway with a rail either side). */
export const LAGOON = { x: -228, z: -120, rx: 44, rz: 72, y: 0.9 } as const;
/** Driving on the right: the middle of his lane, this far right of the centre line. */
export const LANE = 1.8;
/** Half the road's width: a lane each way and a bike lane each side. */
export const ROAD_HALF = 5.8;
/** Where each lane's bike lane begins (the solid white line), from the centre line. */
export const BIKE_LANE = 3.6;
/** The beach (between the road and the sea) from here to here (z): the people, the towers, the rail. */
export const BEACH = { zMin: -200, zMax: 900 } as const;

export function routeCurve(): CatmullRomCurve3 {
  return new CatmullRomCurve3(ROUTE_POINTS.map(([x, y, z]) => new Vector3(x, y, z)), false, 'centripetal');
}

export interface DrivePath {
  points: Vector3[];
  distances: number[];
  length: number;
}

/** The car's way: along the road in the right-hand lane, start to end, as points with their distances along it. */
export function drivePath(curve: CatmullRomCurve3, step = 2): DrivePath {
  const length = curve.getLength();
  const points: Vector3[] = [];
  const n = Math.ceil(length / step);
  const tangent = new Vector3();
  for (let i = 0; i <= n; i++) {
    const u = i / n;
    const p = curve.getPointAt(u);
    curve.getTangentAt(u, tangent);
    // Right of the way he's going: (−dz, dx) in x–z.
    const len = Math.hypot(tangent.x, tangent.z) || 1;
    p.x += (-tangent.z / len) * LANE;
    p.z += (tangent.x / len) * LANE;
    points.push(p);
  }
  const distances = [0];
  for (let i = 1; i < points.length; i++) distances.push(distances[i - 1]! + points[i]!.distanceTo(points[i - 1]!));
  return { points, distances, length: distances[distances.length - 1]! };
}

/** The point `s` along `path`, interpolated. */
export function pointAt(path: DrivePath, s: number, out: Vector3): Vector3 {
  const d = path.distances;
  const last = d.length - 1;
  s = Math.min(Math.max(s, 0), d[last]!);
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (d[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const span = d[hi]! - d[lo]! || 1;
  return out.lerpVectors(path.points[lo]!, path.points[hi]!, (s - d[lo]!) / span);
}

const ahead = new Vector3();
const behind = new Vector3();

/**
 * Where along `path` distance `s` is (position, and the heading of travel). The heading is taken across a few metres
 * either side, from interpolated points, so it turns smoothly (no steps from one path point to the next).
 */
export function samplePath(path: DrivePath, s: number, outPos: Vector3, outDir: Vector3): void {
  pointAt(path, s, outPos);
  pointAt(path, s + 4, ahead);
  pointAt(path, s - 4, behind);
  outDir.subVectors(ahead, behind);
  if (outDir.lengthSq() < 1e-6) outDir.set(0, 0, 1);
  outDir.normalize();
}

/** The road's middle (x) and height (y) where it passes `z`, along the coast (it heads steadily south). */
export function roadAt(z: number): { x: number; y: number } {
  const t = roadTable();
  const f = Math.min(t.x.length - 1.001, Math.max(0, (z - t.z0) / t.step));
  const i = Math.floor(f), k = f - i;
  return { x: t.x[i]! + (t.x[i + 1]! - t.x[i]!) * k, y: t.y[i]! + (t.y[i + 1]! - t.y[i]!) * k };
}

let table: { z0: number; step: number; x: Float32Array; y: Float32Array } | null = null;

function roadTable(): NonNullable<typeof table> {
  if (table) return table;
  const curve = routeCurve();
  const samples = curve.getSpacedPoints(1200);
  const z0 = ROUTE_POINTS[0]![2], z1 = ROUTE_POINTS[ROUTE_POINTS.length - 1]![2], step = 2;
  const n = Math.ceil((z1 - z0) / step) + 1;
  const x = new Float32Array(n), y = new Float32Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const z = z0 + i * step;
    while (j < samples.length - 2 && samples[j + 1]!.z < z) j++;
    const a = samples[j]!, b = samples[j + 1]!;
    const k = b.z > a.z ? Math.min(1, Math.max(0, (z - a.z) / (b.z - a.z))) : 0;
    x[i] = a.x + (b.x - a.x) * k;
    y[i] = a.y + (b.y - a.y) * k;
  }
  return (table = { z0, step, x, y });
}

/**
 * The terrain's height at (x, z) before the road is cut in: the sea floor, the beach, the lagoon, the land inland of
 * the road (the hill round home in the north, the bluffs rising to the mesa in the south). West of the road it's beach,
 * and up the grade the bluff falling away to the sandstone cliffs, the beach below them.
 */
export function landHeight(x: number, z: number): number {
  const shore = coastX(z);
  const fromShore = x - shore;
  if (fromShore < 0) return -1.5 + fromShore * 0.06; // the sea floor
  const beach = Math.min(2.6, 0.3 + fromShore * 0.08);
  const road = roadAt(z);
  const east = x - road.x;
  // Inland of the road: low and green by the lagoon, rising into the bluffs and the mesa further south.
  const bluff = smooth(580, 960, z) * 46;
  const roll = 2.2 * Math.sin(x / 37) * Math.sin(z / 49);
  const inland = road.y + 0.5 + (bluff + 6 + roll) * smooth(6, 70, east);
  // Seaward of the road: the beach; where the road climbs the grade, the bluff falling away from it to the cliffs
  // over the beach (so the sea is in view all the way up).
  const fromRoad = Math.max(0, road.x - ROAD_HALF - x);
  const mesa = smooth(760, 1000, z) * Math.min(road.y - 1.2 - fromRoad * 0.45, road.y * smooth(8, 30, fromShore));
  let h = east <= 0 ? Math.max(beach, mesa) : Math.max(beach, inland);
  // The neighbourhood up the hill round home (the north end, where the road comes down from the east).
  const north = 1 - smooth(-290, -220, z);
  if (north > 0) h = h * (1 - north) + (beach + (1.5 + 22 * smooth(-280, -20, x) + roll) * smooth(0, 40, fromShore)) * north;
  // The lagoon: a shallow basin.
  const lx = (x - LAGOON.x) / LAGOON.rx, lz = (z - LAGOON.z) / LAGOON.rz;
  const l = lx * lx + lz * lz;
  if (l < 1.6) h = h * smooth(0.7, 1.6, l) + (LAGOON.y - 1.2) * (1 - smooth(0.7, 1.6, l));
  return h;
}

/** 0 at `a`, 1 at `b` (either way round), smooth between. */
export function smooth(a: number, b: number, v: number): number {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
