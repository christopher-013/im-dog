import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, ShapeGeometry, type Material } from 'three';
import { NEIGHBOR_PROFILES, neighborDriveway, type NeighborStyle } from '../config/neighborhood';
import type { DEPARTURE_HOME } from '../config/ride';
import type { StaticSceneBuilder, Vec3Tuple } from '../world/StaticSceneBuilder';

type Paint = keyof typeof DEPARTURE_HOME.colors;
export interface NeighborSpec { style: NeighborStyle; scale: number; background: boolean; mirror?: boolean; wall?: Paint }

/** Six different architectural silhouettes, sharing a tiny material palette and the scenery batcher. */
export function buildNeighbor(b: StaticSceneBuilder, materials: Record<Paint, Material>, spec: NeighborSpec, apronEnd: number): void {
  const original = NEIGHBOR_PROFILES[spec.style];
  const p = { ...original, garageSide: original.garageSide * (spec.mirror ? -1 : 1) };
  const s = spec.scale, w = p.width, d = p.depth;
  const front = -9, base = 0.18, height = p.floors * 2.75, wall = spec.wall ?? p.wall as Paint, roofPaint = p.roofPaint as Paint;
  const add = (g: BufferGeometry, at: Vec3Tuple, color: Paint, angle = 0) => {
    g.scale(s, s, s); b.add(g, materials[color], at.map((n) => n * s) as Vec3Tuple, { rotation: [0, 0, angle] }); g.dispose();
  };
  const box = (size: Vec3Tuple, at: Vec3Tuple, color: Paint, angle = 0) => add(new BoxGeometry(...size), at, color, angle);
  const glass = (x: number, y: number, z: number, width: number, h: number, panes = 2) => {
    box([width + 0.2, h + 0.2, 0.16], [x, y, z], 'trim');
    box([width, h, 0.12], [x, y, z + 0.11], 'glass');
    box([width, 0.05, 0.035], [x, y + h * 0.12, z + 0.19], 'trim');
    for (let i = 1; i < panes; i++) box([0.05, h, 0.035], [x - width / 2 + width * i / panes, y, z + 0.19], 'trim');
    box([width + 0.3, 0.1, 0.22], [x, y - h / 2 - 0.08, z + 0.05], 'trim');
  };
  const roof = (x: number, y: number, z: number, width: number, depth: number, rise: number, hip: boolean) => {
    if (hip) {
      const half = width / 2, back = z - depth, inset = Math.min(depth / 3, width / 3);
      const a = [-half, 0, z], c = [half, 0, z], e = [half, 0, back], f = [-half, 0, back];
      const r = [0, rise, z - inset], t = [0, rise, back + inset];
      const g = new BufferGeometry();
      g.setAttribute('position', new Float32BufferAttribute([a, c, r, c, e, t, c, t, r, e, f, t, f, a, r, f, r, t].flat(), 3));
      g.computeVertexNormals(); add(g, [x, y, 0], roofPaint);
      box([width + 0.2, 0.16, depth + 0.2], [x, y - 0.08, z - depth / 2], 'trim');
    } else {
      const triangle = new Shape().moveTo(-width / 2, 0).lineTo(width / 2, 0).lineTo(0, rise).closePath();
      add(new ExtrudeGeometry(triangle, { depth, bevelEnabled: false }), [x, y, z - depth], wall);
      const angle = Math.atan2(rise, width / 2), length = Math.hypot(width / 2, rise);
      for (const side of [-1, 1]) {
        box([length + 0.4, 0.15, depth + 0.5], [x + side * width / 4, y + rise / 2 + 0.06, z - depth / 2], roofPaint, -side * angle);
        box([length + 0.4, 0.13, 0.16], [x + side * width / 4, y + rise / 2 - 0.05, z + 0.26], 'trim', -side * angle);
      }
    }
  };
  // Garage setback/side, main mass and roof shapes are different from the player's two-wing façade.
  const gx = neighborDriveway(spec.style, 1, spec.mirror).x, garageWidth = 4.6;
  box([w, height, d], [0, height / 2 + base, front - d / 2], wall);
  box([w + 0.25, 0.25, d + 0.15], [0, 0.05, front - d / 2], 'neighborStone');
  if (p.roof === 'double') {
    for (const x of [-w / 4, w / 4]) roof(x, height + base, front + 0.1, w / 2, d, p.rise, false);
  } else {
    roof(0, height + base, front, w + 0.3, d + 0.25, p.rise, p.roof === 'hip');
    if (p.roof === 'cross') roof(w * 0.22 * (spec.mirror ? -1 : 1), height - 0.25, front + 0.5, w * 0.4, d * 0.6, p.rise * 0.9, false);
  }
  const garageFront = front + (p.porch === 'court' ? 2 : 0.8);
  box([garageWidth, 2.6, d * 0.55], [gx, 1.3, garageFront - d * 0.275], wall);
  roof(gx, 2.65, garageFront + 0.1, garageWidth + 0.3, d * 0.55, 0.65, true);
  box([4, 2.2, 0.14], [gx, 1.1, garageFront + 0.06], p.porch === 'arch' ? 'entry' : 'trim');
  for (let y = 0.45; y < 2.2; y += 0.5) {
    box([3.85, 0.025, 0.04], [gx, y, garageFront + 0.16], 'roof');
    if (!spec.background) for (const dx of [-1.35, 0, 1.35]) box([1.1, 0.30, 0.035], [gx + dx, y - 0.18, garageFront + 0.16], 'concrete');
  }
  const entryX = -p.garageSide * w * 0.22;
  if (p.porch === 'arch' || p.porch === 'court') {
    const shape = new Shape().moveTo(-0.6, 0).lineTo(0.6, 0).lineTo(0.6, 1.7).absarc(0, 1.7, 0.6, 0, Math.PI, false).closePath();
    add(new ShapeGeometry(shape), [entryX, base, front + 0.22], 'entry');
    roof(entryX, 2.75, front + 1.1, 3.0, 2, 0.65, true);
    if (p.porch === 'court') {
      box([w * 0.44, 0.9, 0.2], [entryX, 0.45, front + 2.3], wall);
      box([w * 0.46, 0.12, 0.35], [entryX, 0.95, front + 2.3], 'trim');
      glass(entryX, 4.15, front + 0.1, 1.1, 1.4, 1);
    }
  } else {
    box([1.15, 2.2, 0.15], [entryX, 1.2, front + 0.2], 'entry');
    box([1.4, 0.28, 0.12], [entryX, 2.6, front + 0.23], 'glass');
    const porchWidth = p.porch === 'tower' ? 2.7 : w * 0.58;
    const porchX = -p.garageSide * (w / 2 - porchWidth / 2);
    box([porchWidth, 0.22, 2.4], [porchX, 0.1, front + 1.0], 'concrete');
    roof(porchX, 2.9, front + 2.3, porchWidth + 0.3, 2.6, 0.65, p.porch === 'tower');
    for (const dx of [-porchWidth / 2 + 0.2, porchWidth / 2 - 0.2]) {
      box([0.5, 0.7, 0.5], [porchX + dx, 0.45, front + 2.0], 'neighborStone');
      box([0.27, 2.2, 0.27], [porchX + dx, 1.85, front + 2], 'trim');
      box([0.38, 0.12, 0.38], [porchX + dx, 2.6, front + 2], 'roof');
    }
    if (p.porch === 'railed') {
      for (const y of [0.4, 1.1]) box([porchWidth * 0.45, 0.09, 0.10], [porchX - p.garageSide * porchWidth * 0.25, y, front + 2.0], 'trim');
      if (!spec.background) for (let i = 0; i < 8; i++) box([0.045, 0.65, 0.045], [porchX - p.garageSide * (0.6 + i * porchWidth * 0.04), 0.75, front + 2], 'trim');
    }
    if (p.porch === 'tower') {
      box([2.5, height + 0.6, 2.6], [entryX, (height + 0.6) / 2, front - 0.6], wall);
      roof(entryX, height + 0.6, front + 0.7, 2.8, 2.9, 1.2, true);
      glass(entryX, height - 0.1, front + 0.8, 0.65, 1.1, 1);
      box([1.1, 2.15, 0.12], [entryX, 1.15, front + 0.75], 'entry');
    }
  }
  // Tall paired windows, grouped bay windows, and board/siding rhythms distinguish each elevation.
  if (p.floors > 1) for (let i = 0; i < p.windowCount; i++) {
    const x = -w / 2 + 1.3 + i * (w - 2.6) / Math.max(1, p.windowCount - 1);
    if (p.porch === 'tower' && Math.abs(x - entryX) < 1.3) continue;
    glass(x, 4.3, front + 0.1, p.windowCount > 3 ? 0.9 : 1.5, 1.5, p.roof === 'double' ? 3 : 2);
  }
  const bayX = -p.garageSide * (w / 2 - 1.6);
  glass(bayX, 1.7, front + 0.16, 2.2, 1.5, 3);
  // Side/rear windows matter when a ride camera looks back across the street.
  for (const y of p.floors > 1 ? [1.6, 4.2] : [1.6]) for (const x of [-w * 0.26, w * 0.26]) glass(x, y, front - d - 0.08, 1.0, 1.3);
  for (const side of [-1, 1]) b.at([side * w / 2 * s, 0, (front - d / 2) * s], side * Math.PI / 2, () => {
    for (const y of spec.background || p.floors === 1 ? [1.7] : [1.7, 4.2]) {
      for (const x of spec.background ? [0] : [-d * 0.22, d * 0.22]) glass(x, y, 0.08, 0.85, 1.25);
    }
  });
  if (!spec.background && (p.roof === 'cross' || p.roof === 'double' || p.floors === 1)) {
    for (let y = 0.7; y < height; y += 0.34) box([w, 0.018, 0.025], [0, y, front + 0.05], 'trim');
    if (p.roof === 'double') for (let x = -w / 2 + 0.3; x < w / 2; x += 0.4) box([0.04, 2.4, 0.06], [x, 4.3, front + 0.05], 'trim');
  }
  const end = spec.background ? front + 5 : apronEnd / s;
  box([4.8, 0.12, end - garageFront], [gx, -0.03, (garageFront + end) / 2], 'concrete');
  box([w, 0.12, 5], [0, -0.05, front + 2.6], 'lawn');
  for (const x of [-w / 2 + 0.7, entryX + 1.4]) {
    box([1.7, 0.1, 1.1], [x, 0, front + 1.1], 'mulch');
    box([1.3, 0.55, 0.8], [x, 0.32, front + 1.1], 'hedge');
  }
}
