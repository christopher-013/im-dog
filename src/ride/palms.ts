import { BufferGeometry, Color, Float32BufferAttribute, Vector3 } from 'three';
import { mulberry32 } from '../utils/random';

/**
 * Southern California palms for the ride (owner, 2026-10-17: "make all the trees look like southern california palm
 * trees"), built in code as one vertex-coloured geometry each (draw them double-sided, instanced):
 * - `fan`: a Mexican fan palm, the very tall, skinny one lining the streets and the coast, with a small crown of fan
 *   leaves and a brown skirt of dead fronds under it;
 * - `date`: a Canary Island date palm, a thick, short trunk under a big round crown of long arching feathery fronds;
 * - `queen`: a queen palm, a slim grey trunk under a loose crown of drooping feathery fronds.
 * The origin is the foot of the trunk; +y up.
 */
export type PalmKind = 'fan' | 'date' | 'queen';

export function palmGeometry(kind: PalmKind, height: number, seed = 1): BufferGeometry {
  const b = new Builder();
  const rand = mulberry32(seed);
  // A gentle lean, more toward the top.
  const lean = new Vector3((rand() - 0.5) * 2, 0, (rand() - 0.5) * 2).normalize().multiplyScalar(kind === 'date' ? 0.25 : height * 0.06);
  const spine = (y: number) => new Vector3(lean.x * (y / height) ** 2, y, lean.z * (y / height) ** 2);
  const top = spine(height);
  if (kind === 'fan') {
    b.trunk(spine, height - 0.6, (y) => (y < 0.8 ? 0.42 - y * 0.15 : 0.3 - 0.1 * (y / height)), ['#8d7c68', '#7b6b59'], 0.9);
    b.skirt(spine, height - 1.9, height - 0.1, 0.31, 0.5, rand);
    // A round tuft: young leaves standing up in the middle, older ones out to the sides, the oldest drooping over the
    // skirt.
    const n = 22;
    for (let i = 0; i < n; i++) {
      const yaw = i * 2.39996 + rand() * 0.3;
      const rise = 1.15 - (i / n) * 1.8 + (rand() - 0.5) * 0.15;
      b.fanLeaf(top, yaw, rise, 1.05 + rand() * 0.35, 0.95, rand);
    }
  } else if (kind === 'date') {
    b.trunk(spine, height - 0.4, (y) => (y < 0.6 ? 0.62 - y * 0.15 : 0.52 + 0.14 * smooth01((y - (height - 1.6)) / 1.2)), ['#8a6f4e', '#a1835c'], 0.32, true);
    const n = 26;
    for (let i = 0; i < n; i++) {
      const yaw = i * 2.39996 + rand() * 0.2; // the golden angle: evenly round the crown
      const ring = i / n;
      const rise = 1.15 - ring * 1.25;
      b.featherFrond(top, yaw, rise, 4.6 + rand() * 0.8, 0.55, 0.55 + ring * 0.6, ['#3f7c2d', '#5b9640'], rand);
    }
  } else {
    b.trunk(spine, height - 0.2, (y) => (y < 0.5 ? 0.26 - y * 0.08 : 0.2), ['#9d978d', '#8f897f'], 0.9);
    const n = 13;
    for (let i = 0; i < n; i++) {
      const yaw = i * 2.39996 + rand() * 0.3;
      const ring = i / n;
      b.featherFrond(top, yaw, 0.95 - ring * 1.1, 3.6 + rand() * 0.6, 0.42, 0.9 + ring * 0.8, ['#4a8a34', '#6aa64a'], rand);
    }
  }
  return b.build();
}

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

const UP = new Vector3(0, 1, 0);

/** Triangles with a colour each; flat normals at the end. */
class Builder {
  private readonly positions: number[] = [];
  private readonly colors: number[] = [];
  private readonly c = new Color();

  tri(a: Vector3, b: Vector3, d: Vector3, color: string | Color): void {
    this.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z);
    if (typeof color === 'string') this.c.set(color);
    else this.c.copy(color);
    for (let i = 0; i < 3; i++) this.colors.push(this.c.r, this.c.g, this.c.b);
  }

  quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, color: string | Color): void {
    this.tri(a, b, c, color);
    this.tri(a, c, d, color);
  }

  /** A tube up the spine to `to`, its radius by height, in bands of alternating colour (`bulb`: a date palm's knobbly top). */
  trunk(spine: (y: number) => Vector3, to: number, radius: (y: number) => number, colors: [string, string], band: number, bulb = false): void {
    const sides = 8;
    const rings = Math.ceil(to / band);
    let prev: Vector3[] | null = null;
    for (let r = 0; r <= rings; r++) {
      const y = Math.min(to, r * band);
      const centre = spine(y);
      const rad = radius(y);
      const ring: Vector3[] = [];
      for (let s = 0; s < sides; s++) {
        // The date palm's old leaf bases make a diamond pattern: every other ring turned half a side.
        const a = ((s + (bulb && r % 2 ? 0.5 : 0)) / sides) * Math.PI * 2;
        ring.push(new Vector3(centre.x + Math.cos(a) * rad, centre.y, centre.z + Math.sin(a) * rad));
      }
      if (prev) for (let s = 0; s < sides; s++) this.quad(prev[s]!, ring[s]!, ring[(s + 1) % sides]!, prev[(s + 1) % sides]!, colors[r % 2]!);
      prev = ring;
    }
    // A cap at the top, under the crown.
    const centre = spine(to + 0.25);
    for (let s = 0; s < sides; s++) this.tri(prev![s]!, centre, prev![(s + 1) % sides]!, colors[0]);
  }

  /** The fan palm's skirt: dead fronds hanging down the trunk under the crown, ragged at the bottom. */
  skirt(spine: (y: number) => Vector3, from: number, to: number, r0: number, r1: number, rand: () => number): void {
    const sides = 14;
    const browns = ['#a68a5e', '#b89a6a', '#937650'];
    const topC = spine(to);
    for (let s = 0; s < sides; s++) {
      const a0 = (s / sides) * Math.PI * 2, a1 = ((s + 1) / sides) * Math.PI * 2;
      const drop = from - rand() * 0.7;
      const bottom = spine(drop);
      const p = (c: Vector3, a: number, r: number) => new Vector3(c.x + Math.cos(a) * r, c.y, c.z + Math.sin(a) * r);
      this.quad(p(bottom, a0, r0 + 0.08), p(topC, a0, r1), p(topC, a1, r1), p(bottom, a1, r0 + 0.08), browns[s % browns.length]!);
    }
  }

  /**
   * A fan leaf: a stalk out from the crown, then a pleated fan spread from its end and tipped up to face out, its
   * pointed segments drooping at the tips.
   */
  fanLeaf(top: Vector3, yaw: number, rise: number, stalk: number, radius: number, rand: () => number): void {
    const dir = new Vector3(Math.cos(yaw) * Math.cos(rise), Math.sin(rise), Math.sin(yaw) * Math.cos(rise)).normalize();
    const side = new Vector3().crossVectors(dir, UP).normalize();
    const normal = new Vector3().crossVectors(side, dir).normalize();
    const base = top.clone().addScaledVector(dir, stalk);
    // The blade's middle points out and up from the stalk (the leaf faces out from the crown).
    const mid = dir.clone().multiplyScalar(0.75).addScaledVector(normal, 0.65).normalize();
    const face = new Vector3().crossVectors(side, mid).normalize();
    const w = 0.04;
    this.quad(top.clone().addScaledVector(side, -w), top.clone().addScaledVector(side, w), base.clone().addScaledVector(side, w), base.clone().addScaledVector(side, -w), '#7d8a48');
    const greens = [new Color('#5f9440'), new Color('#7fae52')];
    const tint = new Color('#b8ad62');
    const old = rise < 0 ? 0.3 : 0;
    const segments = 9;
    const at = (a: number, r: number, up: number) => {
      const p = base.clone().addScaledVector(mid, Math.cos(a) * r).addScaledVector(side, Math.sin(a) * r).addScaledVector(face, up);
      // The segments hang down toward their tips.
      p.y -= 0.3 * (r / radius) ** 2 * radius;
      return p;
    };
    for (let i = 0; i < segments; i++) {
      const a0 = -1.45 + (i / segments) * 2.9, a1 = -1.45 + ((i + 1) / segments) * 2.9, am = (a0 + a1) / 2;
      const c = greens[i % 2]!.clone().lerp(tint, old + rand() * 0.12);
      // Each segment: a fold (up the middle) out to a point, longer than the blade's edge.
      const inner0 = at(a0, radius * 0.55, 0), inner1 = at(a1, radius * 0.55, 0);
      const tip = at(am, radius * (1.05 + rand() * 0.15), 0.06);
      this.tri(base, inner0, inner1, c);
      this.tri(inner0, tip, inner1, c);
    }
  }

  /**
   * A feathery frond: arching up and out from the crown and drooping toward its tip, its leaflets folded up in a V
   * either side of the midrib (the edges zig-zag, leaflet by leaflet).
   */
  featherFrond(top: Vector3, yaw: number, rise: number, length: number, width: number, droop: number, colors: [string, string], rand: () => number): void {
    const out = new Vector3(Math.cos(yaw), 0, Math.sin(yaw));
    const side = new Vector3(-out.z, 0, out.x);
    const segs = 9;
    const point = (s: number) =>
      top.clone().addScaledVector(out, length * s * Math.cos(rise)).add(new Vector3(0, length * s * Math.sin(rise) - droop * length * s * s, 0));
    const dark = new Color(colors[0]), light = new Color(colors[1]);
    let prev = point(0);
    let prevW = 0;
    for (let i = 1; i <= segs; i++) {
      const s = i / segs;
      const p = point(s);
      const w = width * Math.sin(Math.PI * Math.min(1, s * 1.05)) ** 0.7 * (i % 2 ? 1 : 0.7);
      const fold = 0.45;
      const c = dark.clone().lerp(light, 0.3 + 0.4 * (1 - s) + rand() * 0.15);
      for (const k of [-1, 1]) {
        const e0 = prev.clone().addScaledVector(side, k * prevW).add(new Vector3(0, prevW * fold, 0));
        const e1 = p.clone().addScaledVector(side, k * w).add(new Vector3(0, w * fold, 0));
        this.quad(prev, e0, e1, p, c);
      }
      prev = p;
      prevW = w;
    }
  }

  build(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new Float32BufferAttribute(this.colors, 3));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}
