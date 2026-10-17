import { CatmullRomCurve3, Vector3 } from 'three';

/**
 * The ride's road (Phase 6, D33/D34): a stylized homage to the drive from home down to the coast and north along
 * Torrey Pines State Beach, over the lagoon and up the grade to the reserve at the top, then back. Pure numbers and
 * maths (tested), shared by the scenery and the car. Metres; x east, z south, y up; the ocean is to the west.
 */

/** Where the shoreline is at each z (the sea to the west of it). */
export function coastX(z: number): number {
  return -345 + 14 * Math.sin(z / 95) + 6 * Math.sin(z / 37);
}

/** The road's centre line, from the street outside home to the top of the grade (outbound, heading north). */
export const ROUTE_POINTS: readonly [number, number, number][] = [
  [0, 24, 12],
  [-70, 23, 12],
  [-150, 17, 4],
  [-220, 9, -30],
  [-268, 5, -95],
  [-285, 4.5, -170],
  [-290, 4.5, -250],
  [-291, 5, -330],
  [-288, 6, -410],
  [-276, 13, -500],
  [-258, 25, -590],
  [-242, 37, -680],
  [-232, 47, -770],
  [-228, 53, -850],
  [-226, 55, -905],
];

/** The lagoon (inland of the road, crossed on a low bridge). */
export const LAGOON = { x: -215, z: -290, rx: 55, rz: 34, y: 0.9 } as const;
/** Torrey Pines' turnaround at the top: a loop round a planted island this big, just beyond the road's end. */
export const TURNAROUND_RADIUS = 11;

/** The turnaround's middle: straight on from the end of the road. */
export function turnaroundCenter(curve: CatmullRomCurve3): Vector3 {
  const end = curve.getPointAt(1);
  const t = curve.getTangentAt(1);
  const len = Math.hypot(t.x, t.z) || 1;
  return new Vector3(end.x + (t.x / len) * (TURNAROUND_RADIUS + 3), end.y, end.z + (t.z / len) * (TURNAROUND_RADIUS + 3));
}
/** Lanes: drive on the right, this far from the centre line. */
export const LANE = 2.4;
/** Half the road's width. */
export const ROAD_HALF = 4.6;

export function routeCurve(): CatmullRomCurve3 {
  return new CatmullRomCurve3(ROUTE_POINTS.map(([x, y, z]) => new Vector3(x, y, z)), false, 'centripetal');
}

/**
 * The car's way round: out along the road in the right-hand (east) lane, round the turnaround at the top, and back in
 * the other lane (now the west one, by the sea), as one list of points with their distances along the way.
 */
export function drivePath(curve: CatmullRomCurve3, step = 2): { points: Vector3[]; distances: number[]; length: number } {
  const length = curve.getLength();
  const out: Vector3[] = [];
  const n = Math.ceil(length / step);
  const tangent = new Vector3();
  for (const dir of [1, -1] as const) {
    if (dir === -1) {
      // The turnaround: from the end of the outbound lane, round the far side of the island, into the inbound lane.
      const c = turnaroundCenter(curve);
      const from = out[out.length - 1]!;
      const end = curve.getPointAt(1);
      curve.getTangentAt(1, tangent);
      const len = Math.hypot(tangent.x, tangent.z) || 1;
      const to = new Vector3(end.x + (tangent.z / len) * LANE, end.y, end.z - (tangent.x / len) * LANE);
      const a0 = Math.atan2(from.z - c.z, from.x - c.x);
      let a1 = Math.atan2(to.z - c.z, to.x - c.x);
      // Round the far side: the long way, turning left.
      while (a1 > a0) a1 -= Math.PI * 2;
      const r0 = Math.hypot(from.x - c.x, from.z - c.z), r1 = Math.hypot(to.x - c.x, to.z - c.z);
      const bulge = TURNAROUND_RADIUS + 2;
      for (let i = 1; i < 48; i++) {
        const f = i / 48;
        const a = a0 + (a1 - a0) * f;
        const r = Math.max(r0 + (r1 - r0) * f, bulge * Math.sin(Math.PI * f));
        out.push(new Vector3(c.x + Math.cos(a) * r, end.y, c.z + Math.sin(a) * r));
      }
    }
    for (let i = 0; i <= n; i++) {
      const u = dir === 1 ? i / n : 1 - i / n;
      const p = curve.getPointAt(u);
      curve.getTangentAt(u, tangent);
      if (dir === -1) tangent.negate();
      // Right of the way he's going: (−dz, dx) in x–z.
      const len = Math.hypot(tangent.x, tangent.z) || 1;
      p.x += (-tangent.z / len) * LANE;
      p.z += (tangent.x / len) * LANE;
      out.push(p);
    }
  }
  const distances = [0];
  for (let i = 1; i < out.length; i++) distances.push(distances[i - 1]! + out[i]!.distanceTo(out[i - 1]!));
  return { points: out, distances, length: distances[distances.length - 1]! };
}

/** Where along `path` distance `s` is (position, and the heading of travel), interpolated. */
export function samplePath(path: { points: Vector3[]; distances: number[] }, s: number, outPos: Vector3, outDir: Vector3): void {
  const d = path.distances;
  const last = d.length - 1;
  s = Math.min(Math.max(s, 0), d[last]!);
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (d[mid]! <= s) lo = mid;
    else hi = mid;
  }
  const a = path.points[lo]!, b = path.points[hi]!;
  const span = d[hi]! - d[lo]! || 1;
  outPos.lerpVectors(a, b, (s - d[lo]!) / span);
  // Heading from a little ahead, so turns are smooth.
  const ahead = path.points[Math.min(last, hi + 2)]!;
  const behind = path.points[Math.max(0, lo - 1)]!;
  outDir.subVectors(ahead, behind).normalize();
}

/** The terrain's height at (x, z) before the road is cut in: sea, beach, the lagoon, the bluffs and the hills. */
export function landHeight(x: number, z: number): number {
  const shore = coastX(z);
  const fromShore = x - shore;
  if (fromShore < 0) return -1.5 + fromShore * 0.06; // the sea floor
  // The bluffs: from south of the grade northward, the land behind the beach rises into sandstone cliffs.
  const bluff = smooth(-430, -620, z) * 48 + smooth(-620, -880, z) * 8;
  const beach = Math.min(3, fromShore * 0.09);
  // Cliff face a few metres in from the waterline, then the mesa top, rising a little inland.
  const cliff = bluff > 0.5 ? bluff * smooth(14, 26, fromShore) : 0;
  const inland = Math.max(0, fromShore - 70) * 0.06 + 2.5 * Math.sin(x / 41) * Math.sin(z / 53);
  // The neighbourhood up the hill to the east, round home.
  const hill = smooth(-260, -40, x) * 20 * smooth(-160, 30, z);
  let h = Math.max(beach, beach + cliff) + inland * smooth(40, 90, fromShore) + hill;
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
