import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ellipsoidSurface, FUR_CAVITY, furClump, SMOOTH_NORMAL, type FurClumpOptions } from './furGeometry';

const HEAD: FurClumpOptions = {
  radii: [0.12, 0.1, 0.1],
  detail: 12,
  seed: 4,
  tufts: 40,
  length: 0.2,
  width: 0.5,
  flow: [0, -1, 0],
  flowAmount: 0.4,
};

function positions(options: FurClumpOptions): Float32Array {
  return furClump(options).getAttribute('position').array as Float32Array;
}

/** (x/rx)² + (y/ry)² + (z/rz)²: 1 on the smooth ellipsoid, more outside it. */
function ellipsoidValue(p: Vector3, [rx, ry, rz]: readonly number[]): number {
  return (p.x / rx!) ** 2 + (p.y / ry!) ** 2 + (p.z / rz!) ** 2;
}

describe('furClump', () => {
  it('is deterministic, so Moke looks the same on every load', () => {
    expect(positions(HEAD)).toEqual(positions(HEAD));
    expect(positions({ ...HEAD, seed: 5 })).not.toEqual(positions(HEAD));
  });

  it('grows tufts outward from the ellipsoid, no longer than asked', () => {
    const geometry = furClump(HEAD);
    const pos = geometry.getAttribute('position');
    const meanRadius = (0.12 + 0.1 + 0.1) / 3;
    const reach = HEAD.length * meanRadius + (HEAD.flowAmount ?? 0) * meanRadius;
    const p = new Vector3();
    let tufted = 0;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      expect(p.length()).toBeLessThanOrEqual(0.12 + reach + 1e-6);
      if (ellipsoidValue(p, HEAD.radii) > 1.1) tufted++;
    }
    // Most of the surface is covered by tufts that stand proud of the base shape.
    expect(tufted / pos.count).toBeGreaterThan(0.5);
  });

  it('leaves the surface smooth where the shape says so (e.g. the face)', () => {
    const geometry = furClump({ ...HEAD, shape: (_x, _y, z) => (z > 0.5 ? 0 : 1) });
    const pos = geometry.getAttribute('position');
    const p = new Vector3();
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      if (p.z / HEAD.radii[2] > 0.6) expect(ellipsoidValue(p, HEAD.radii)).toBeCloseTo(1, 5);
    }
  });

  it('carries unit smooth normals for toon shading', () => {
    const geometry = furClump(HEAD);
    const smooth = geometry.getAttribute(SMOOTH_NORMAL);
    expect(smooth.count).toBe(geometry.getAttribute('position').count);
    const n = new Vector3();
    for (let i = 0; i < smooth.count; i += 17) expect(n.fromBufferAttribute(smooth, i).length()).toBeCloseTo(1, 5);
  });
});

describe('furClump curls', () => {
  it('marks creases between curls (0..1), and none where the fur is kept short', () => {
    const smoothFront = (_x: number, _y: number, z: number) => (z > 0.5 ? 0 : 1);
    const geometry = furClump({ ...HEAD, shape: smoothFront, curls: { count: 120, length: 0.1, width: 0.3 } });
    const cavity = geometry.getAttribute(FUR_CAVITY);
    const pos = geometry.getAttribute('position');
    const p = new Vector3();
    let creased = 0;
    for (let i = 0; i < cavity.count; i++) {
      const c = cavity.getX(i);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
      p.fromBufferAttribute(pos, i);
      if (p.z / HEAD.radii[2] > 0.9) expect(c).toBe(0); // well inside the smooth front
      if (c > 0.3) creased++;
    }
    expect(creased).toBeGreaterThan(0);
  });
});

describe('ellipsoidSurface', () => {
  it('lands on the ellipsoid with an outward normal', () => {
    const { point, normal } = ellipsoidSurface([0.12, 0.1, 0.1], [0.3, 0.1, 0.9]);
    expect(ellipsoidValue(point, [0.12, 0.1, 0.1])).toBeCloseTo(1, 6);
    expect(normal.length()).toBeCloseTo(1, 6);
    expect(normal.dot(point)).toBeGreaterThan(0);
  });
});
