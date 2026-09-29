import { describe, expect, it } from 'vitest';
import type { BufferGeometry, Material, Mesh } from 'three';
import { Home } from './Home';

// Z-fighting: two differently shaded surfaces in the same place. The GPU can't tell which is in front, so they
// flicker as the camera moves (the hallway doorways and TV screens did). This scans every flat static surface of the
// house, at any angle, for faces from different meshes and materials that face the same way, lie within a millimetre
// of each other and genuinely overlap. Faces nobody can see are skipped: those pressed flat against something within
// a few millimetres (a vase's base on a table, a cabinet's back against a wall).

interface Face {
  mesh: number;
  material: string;
  /** The plane's basis, unit normal and distance, to turn 2D points back into 3D for messages. */
  e1: V3;
  e2: V3;
  n: V3;
  d: number;
  a: [number, number];
  b: [number, number];
  c: [number, number];
}

const PLANE_TOLERANCE = 0.001;

type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (a: V3): V3 => {
  const l = Math.hypot(a[0], a[1], a[2]);
  return [a[0] / l, a[1] / l, a[2] / l];
};
/** Overlaps smaller than this (m²) are ignored: shared edges and hairline touches. */
const MIN_AREA = 2e-5;

function clip(poly: [number, number][], a: [number, number], b: [number, number], sign: number): [number, number][] {
  const out: [number, number][] = [];
  const side = (p: [number, number]) => sign * ((b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]));
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const sp = side(p);
    const sq = side(q);
    if (sp >= 0) out.push(p);
    if (sp >= 0 !== sq >= 0) {
      const t = sp / (sp - sq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

function area(poly: [number, number][]): number {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    s += p[0] * q[1] - q[0] * p[1];
  }
  return Math.abs(s) / 2;
}

function contains(f: Face, p: [number, number]): boolean {
  const d = (a: [number, number], b: [number, number]) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
  const d1 = d(f.a, f.b), d2 = d(f.b, f.c), d3 = d(f.c, f.a);
  return !((d1 < -1e-9 || d2 < -1e-9 || d3 < -1e-9) && (d1 > 1e-9 || d2 > 1e-9 || d3 > 1e-9));
}

/** The overlap polygon of two triangles (2D, convex clipping). */
function overlapPolygon(f: Face, g: Face): [number, number][] {
  let poly: [number, number][] = [f.a, f.b, f.c];
  const orient = Math.sign((g.b[0] - g.a[0]) * (g.c[1] - g.a[1]) - (g.b[1] - g.a[1]) * (g.c[0] - g.a[0]));
  for (const [p, q] of [[g.a, g.b], [g.b, g.c], [g.c, g.a]] as const) {
    poly = clip(poly, p, q, orient);
    if (poly.length < 3) return [];
  }
  return poly;
}

/** How far (mm) in front of a face something else pressed against it would make it invisible. */
const PRESSED = 6;

export function findZFighting(root: { traverse(cb: (o: unknown) => void): void }): string[] {
  const meshes: { name: string; material: Material }[] = [];
  // Buckets: axis (0..2) × facing (±) × plane position (mm).
  const buckets = new Map<string, Face[]>();
  root.traverse((o) => {
    const mesh = o as Mesh<BufferGeometry, Material>;
    if (!(mesh as { isMesh?: boolean }).isMesh || Array.isArray(mesh.material)) return;
    const index = meshes.length;
    const color = (mesh.material as { color?: { getHexString(): string } }).color?.getHexString() ?? '?';
    meshes.push({ name: `${mesh.material.name || '#' + color}${mesh.castShadow ? '' : '/nocast'}${mesh.receiveShadow ? '' : '/norecv'}`, material: mesh.material });
    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const pos = geometry.getAttribute('position');
    const e = mesh.matrixWorld.elements;
    const world = (i: number): V3 => {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      return [e[0]! * x + e[4]! * y + e[8]! * z + e[12]!, e[1]! * x + e[5]! * y + e[9]! * z + e[13]!, e[2]! * x + e[6]! * y + e[10]! * z + e[14]!];
    };
    for (let i = 0; i + 2 < pos.count; i += 3) {
      const p = world(i), q = world(i + 1), r = world(i + 2);
      const u = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
      const v = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
      const n = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!];
      const len = Math.hypot(n[0]!, n[1]!, n[2]!);
      if (len < 1e-9) continue;
      const nx = n[0]! / len, ny = n[1]! / len, nz = n[2]! / len;
      // Plane key: the unit normal (to 1e-3) and the plane's distance along it (to the tolerance).
      const key = `${Math.round(nx * 1000)}|${Math.round(ny * 1000)}|${Math.round(nz * 1000)}`;
      const d = nx * p[0] + ny * p[1] + nz * p[2];
      // An orthonormal basis (e1, e2) of the plane for 2D coordinates, from the rounded normal so every face on
      // this plane uses the same one.
      const rn = normalize([Math.round(nx * 1000), Math.round(ny * 1000), Math.round(nz * 1000)]);
      const helper: V3 = Math.abs(rn[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      const e1 = normalize(cross(helper, rn));
      const e2 = cross(rn, e1);
      const to2d = (v: V3): [number, number] => [dot(v, e1), dot(v, e2)];
      const face: Face = { mesh: index, material: mesh.material.uuid, a: to2d(p), b: to2d(q), c: to2d(r), e1, e2, n: rn, d };
      const bucketKey = `${key}|${Math.round(d / PLANE_TOLERANCE)}`;
      let list = buckets.get(bucketKey);
      if (!list) buckets.set(bucketKey, (list = []));
      list.push(face);
    }
  });

  const found = new Map<string, number>();
  for (const [key, faces] of buckets) {
    const parts = key.split('|');
    const normal = parts.slice(0, 3).map(Number);
    const slot = Number(parts[3]);
    const nk = normal.join('|');
    const opposite = normal.map((c) => -c).join('|');
    // Compare with this slot and the next (so faces straddling a rounding boundary still meet).
    const next = buckets.get(`${nk}|${slot + 1}`) ?? [];
    const others = [...faces, ...next];
    for (let i = 0; i < faces.length; i++) {
      const f = faces[i]!;
      for (let j = i + 1; j < others.length; j++) {
        const g = others[j]!;
        // Same mesh, or the same material: identical pixels, so nothing visibly flickers.
        if (g.mesh === f.mesh || g.material === f.material) continue;
        const poly = overlapPolygon(f, g);
        const a = poly.length >= 3 ? area(poly) : 0;
        if (a < MIN_AREA) continue;
        // Hidden if something faces back at it from within a few millimetres (a vase's base on a table, a
        // cabinet's back against the wall, a wall's top under the ceiling): nobody can see between them.
        // Every corner of the overlap (nudged inward) must be covered, so a partly covered strip still counts.
        const centre: [number, number] = [poly.reduce((t, p) => t + p[0], 0) / poly.length, poly.reduce((t, p) => t + p[1], 0) / poly.length];
        const probes = [centre, ...poly.map((p): [number, number] => [p[0] + (centre[0] - p[0]) * 0.02, p[1] + (centre[1] - p[1]) * 0.02])];
        // The opposite plane has distance -d; "in front" of ours means within PRESSED mm along our normal.
        const covered = (pt: [number, number]) => {
          for (let k = 0; k <= PRESSED; k++) {
            // A face facing back at us, at distance d + k mm along our normal, has key -(slot + k) in its own sign.
            // The 2D basis flips with the normal, so mirror the point's first coordinate.
            const faces2 = buckets.get(`${opposite}|${-(slot + k)}`);
            if (faces2?.some((o) => contains(o, [-pt[0], pt[1]]))) return true;
          }
          return false;
        };
        if (probes.every(covered)) continue;
        const m1 = meshes[f.mesh]!, m2 = meshes[g.mesh]!;
        const at = [0, 1, 2].map((i) => f.e1[i]! * centre[0] + f.e2[i]! * centre[1] + f.n[i]! * f.d);
        // One line per spot: positions rounded to 0.5 m.
        const k = `${m1.name} ↔ ${m2.name} facing (${normal.map((c) => (c / 1000).toFixed(2)).join(', ')}), around (${at.map((v) => (Math.round(v * 2) / 2).toFixed(1)).join(', ')})`;
        found.set(k, (found.get(k) ?? 0) + a);
      }
    }
  }
  return [...found.entries()].map(([k, a]) => `${k}, ${(a * 1e4).toFixed(1)} cm²`);
}

describe('the house has no z-fighting (flickering overlapping surfaces)', () => {
  it('finds no two static surfaces drawn in the same place', () => {
    const home = new Home();
    expect(findZFighting(home.object)).toEqual([]);
  }, 30_000);
});
