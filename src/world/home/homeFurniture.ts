import {
  BoxGeometry,
  CylinderGeometry,
  LatheGeometry,
  OctahedronGeometry,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { couch, leafGeometry } from '../furniture';
import { TILE_REPEAT, type RoomMaterials } from '../materials';
import type { StaticSceneBuilder, Vec3Tuple } from '../StaticSceneBuilder';

// The great room, kitchen and dining room's furniture (Phase 4), drawn from the home photos in the game's
// stylized look (see docs/HOME_REFERENCE.md). Same conventions as furniture.ts: built round its own origin,
// standing on the floor, front facing +z. Wall pieces have their back at z = 0 and stand out toward +z.

const rbox = (w: number, h: number, d: number, radius: number, segments = 2) => new RoundedBoxGeometry(w, h, d, segments, radius);

/** A flat panel whose texture repeats every `tile` metres (tiles, not stretched across the panel). */
export function tiledPlane(width: number, height: number, tile = TILE_REPEAT): PlaneGeometry {
  const geometry = new PlaneGeometry(width, height);
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * width) / tile, (uv.getY(i) * height) / tile);
  return geometry;
}

// ---------------------------------------------------------------- family room

/** Seat and back heights shared by the sofas (the same as the living room couch, so Moke can hop up). */
const SEAT = 0.45;
const BACK = 0.86;

/**
 * The cream sectional against the interior windows: a long run with its back to -z, an arm at the +x end, and a
 * chaise at the -x end reaching forward. `length` × 0.95 m, chaise 0.85 m wide and 1.7 m deep.
 */
export function sectional(b: StaticSceneBuilder, m: RoomMaterials, length = 3.4): void {
  const L = length;
  const D = 0.95;
  const chaiseW = 0.85;
  const chaiseD = 1.7;
  const legH = 0.07;
  const x0 = -L / 2;
  const extend = chaiseD - D;
  const chaiseX = x0 + chaiseW / 2;
  const chaiseZ = D / 2 + extend / 2;

  const leg = new CylinderGeometry(0.022, 0.016, legH, 8);
  for (const [x, z] of [
    [x0 + 0.1, -D / 2 + 0.1],
    [L / 2 - 0.1, -D / 2 + 0.1],
    [L / 2 - 0.1, D / 2 - 0.1],
    [x0 + 0.1, chaiseD - D / 2 - 0.1],
    [x0 + chaiseW - 0.1, chaiseD - D / 2 - 0.1],
  ] as const) {
    b.add(leg, m.darkWood, [x, legH / 2, z]);
  }
  // Base frame: the long run and the chaise's extension.
  b.add(rbox(L, 0.22, D, 0.06), m.creamBoucle, [0, legH + 0.11, 0]);
  b.add(rbox(chaiseW, 0.22, extend + 0.06, 0.06), m.creamBoucle, [chaiseX, legH + 0.11, chaiseZ]);
  // Seat cushions: three along the run, one long chaise cushion.
  const runX0 = x0 + chaiseW;
  const runW = L / 2 - 0.24 - runX0;
  const cushionW = runW / 3 - 0.01;
  for (let i = 0; i < 3; i++) {
    b.add(rbox(cushionW, SEAT - 0.29, 0.68, 0.07, 3), m.creamBoucle, [runX0 + (i + 0.5) * (runW / 3), (0.29 + SEAT) / 2, 0.12]);
  }
  b.add(rbox(chaiseW - 0.02, SEAT - 0.29, chaiseD - 0.28, 0.07, 3), m.creamBoucle, [chaiseX, (0.29 + SEAT) / 2, -D / 2 + 0.25 + (chaiseD - 0.28) / 2]);
  // Back, back cushions, the one arm.
  b.add(rbox(L - 0.02, BACK - 0.28, 0.24, 0.07), m.creamBoucle, [0, (0.28 + BACK) / 2, -D / 2 + 0.12]);
  for (let i = 0; i < 4; i++) {
    const w = (L - 0.3) / 4 - 0.02;
    b.add(rbox(w, 0.42, 0.2, 0.09, 3), m.cream, [x0 + 0.05 + (i + 0.5) * ((L - 0.3) / 4), SEAT + 0.2, -D / 2 + 0.33], { rotation: [-0.12, 0, 0] });
  }
  b.add(rbox(0.24, 0.6, D + 0.02, 0.08), m.creamBoucle, [L / 2 - 0.12, 0.36, 0]);
  // Fluffy pillows and a throw draped over the chaise.
  const pillow = rbox(0.46, 0.44, 0.15, 0.08, 3);
  b.add(pillow, m.cream, [runX0 + 0.35, SEAT + 0.24, -0.12], { rotation: [-0.25, 0.3, 0.06] });
  b.add(pillow, m.linenLight, [L / 2 - 0.55, SEAT + 0.24, -0.12], { rotation: [-0.25, -0.3, -0.06] });
  b.add(pillow, m.pillowLattice, [x0 + 0.42, SEAT + 0.24, -0.14], { rotation: [-0.22, 0.1, 0.04], scale: [0.9, 0.9, 0.9] });
  b.add(rbox(chaiseW + 0.08, 0.05, 0.7, 0.025, 2), m.linenLight, [chaiseX, SEAT + 0.03, chaiseD - D / 2 - 0.45], { rotation: [0.04, 0.05, 0] });

  b.addCollider([0, SEAT / 2, 0.01], [L, SEAT, D + 0.02]);
  b.addCollider([chaiseX, SEAT / 2, chaiseZ + 0.01], [chaiseW, SEAT, extend + 0.02]);
  b.addCollider([0, BACK / 2, -D / 2 + 0.125], [L, BACK, 0.25]);
  // Up on the seat: the arm and back cushions are solid to Moke (thin: the camera and the human ignore them).
  b.addCollider([L / 2 - 0.12, 0.32, 0.01], [0.24, 0.64, D + 0.02], { thin: true });
  b.addCollider([0, SEAT + 0.22, -D / 2 + 0.38], [L - 0.3, 0.44, 0.28], { thin: true });
}

/** The beige three-seat couch under the windows, with grey-and-white trellis pillows. */
export function windowCouch(b: StaticSceneBuilder, m: RoomMaterials): void {
  couch(b, m, { frame: m.beigeFabric, cushion: m.linen, pillows: [m.pillowLattice, m.cream, m.pillowLattice] });
}

/**
 * White fireplace: a raised hearth (0.3 m: Moke can hop up), a dark firebox with gas logs and a low flame, a deep
 * mantel shelf and the big TV above. Its back is against the wall (z = 0).
 */
export function fireplace(b: StaticSceneBuilder, m: RoomMaterials): void {
  const W = 1.8;
  const H = 1.3;
  const depth = 0.26;
  const open = { halfW: 0.42, y0: 0.3, y1: 0.92 };
  const pillarW = W / 2 - open.halfW;
  b.add(new BoxGeometry(W, open.y0, depth), m.cabinet, [0, open.y0 / 2, depth / 2]);
  for (const side of [-1, 1]) {
    b.add(new BoxGeometry(pillarW, H - open.y0, depth), m.cabinet, [side * (open.halfW + pillarW / 2), (H + open.y0) / 2, depth / 2]);
  }
  b.add(new BoxGeometry(open.halfW * 2, H - open.y1, depth), m.cabinet, [0, (H + open.y1) / 2, depth / 2]);
  // Moulded trim round the opening and a deep mantel shelf.
  const t = 0.05;
  for (const side of [-1, 1]) b.add(new BoxGeometry(t, open.y1 - open.y0 + t, 0.03), m.trim, [side * (open.halfW + t / 2), (open.y0 + open.y1 + t) / 2, depth + 0.015]);
  b.add(new BoxGeometry(open.halfW * 2 + 2 * t, t, 0.03), m.trim, [0, open.y1 + t / 2, depth + 0.015]);
  b.add(rbox(W + 0.26, 0.08, depth + 0.16, 0.015), m.trim, [0, H + 0.04, (depth + 0.16) / 2]);
  // The firebox, set back, with logs and a lazy flame.
  b.add(new BoxGeometry(open.halfW * 2, open.y1 - open.y0, 0.1), m.firebox, [0, (open.y0 + open.y1) / 2, 0.05], { cast: false });
  for (const [x, z, yaw] of [
    [-0.12, 0.15, 0.1],
    [0.13, 0.16, -0.12],
    [0, 0.12, 0],
  ] as const) {
    b.add(new CylinderGeometry(0.04, 0.045, 0.5, 8), m.darkWood, [x, open.y0 + 0.05, z], { rotation: [0, yaw, Math.PI / 2], cast: false });
  }
  const flame = leafGeometry(0.2, 0.08);
  for (const [x, h] of [
    [-0.18, 0.8],
    [-0.04, 1],
    [0.1, 0.85],
    [0.22, 0.65],
  ] as const) {
    b.add(flame, m.flame, [x, open.y0 + 0.06, 0.2], { scale: [1, h, 1], cast: false, receive: false });
  }
  // The raised hearth in front.
  b.add(rbox(W + 0.2, 0.3, 0.46, 0.015), m.cabinet, [0, 0.15, depth + 0.23]);
  // The TV above the mantel.
  const tvY = H + 0.62;
  b.add(rbox(1.45, 0.83, 0.05, 0.01), m.tvBody, [0, tvY, 0.04]);
  b.add(new PlaneGeometry(1.41, 0.79), m.tvScreen, [0, tvY, 0.0655], { cast: false });

  b.addCollider([0, H / 2, depth / 2], [W, H, depth]);
  b.addCollider([0, 0.15, depth + 0.23], [W + 0.2, 0.3, 0.46]);
  b.addCollider([0, H + 0.04, (depth + 0.16) / 2], [W + 0.26, 0.08, depth + 0.16]);
}

/** White built-in shelves: a cabinet below and open shelves of frames, books and little plants above. */
export function builtIns(b: StaticSceneBuilder, m: RoomMaterials, width = 0.9): void {
  const W = width;
  const H = 2.3;
  const D = 0.4;
  const baseH = 0.86;
  b.add(new BoxGeometry(W, baseH, D), m.cabinet, [0, baseH / 2, D / 2]);
  for (const side of [-1, 1]) {
    b.add(rbox(W / 2 - 0.05, baseH - 0.14, 0.02, 0.005), m.cabinet, [side * (W / 4), baseH / 2 + 0.03, D + 0.01]);
    b.add(new BoxGeometry(0.012, 0.12, 0.012), m.brass, [side * 0.05, baseH * 0.62, D + 0.03], { cast: false });
  }
  b.add(new BoxGeometry(W + 0.04, 0.035, D + 0.03), m.cabinet, [0, baseH + 0.0175, (D + 0.03) / 2]);
  // Upper shelves: sides, back and three shelves.
  const upperD = 0.3;
  for (const side of [-1, 1]) b.add(new BoxGeometry(0.03, H - baseH, upperD), m.cabinet, [side * (W / 2 - 0.015), (H + baseH) / 2, upperD / 2]);
  b.add(new BoxGeometry(W, H - baseH, 0.02), m.cabinet, [0, (H + baseH) / 2, 0.01]);
  const shelves = [1.3, 1.72, 2.12];
  for (const y of shelves) b.add(new BoxGeometry(W - 0.06, 0.03, upperD - 0.02), m.cabinet, [0, y, upperD / 2]);
  b.add(new BoxGeometry(W + 0.04, 0.05, upperD + 0.02), m.trim, [0, H + 0.025, (upperD + 0.02) / 2]);
  // Decor: frames, books, a plant, a vase, a little lamp.
  b.add(rbox(0.2, 0.26, 0.02, 0.005), m.oak, [-0.18, baseH + 0.17, 0.12], { rotation: [-0.12, 0.1, 0] });
  b.add(new PlaneGeometry(0.15, 0.2), m.art, [-0.178, baseH + 0.172, 0.135], { rotation: [-0.12, 0.1, 0], cast: false });
  b.add(new CylinderGeometry(0.07, 0.08, 0.26, 10), m.lampShade, [0.22, baseH + 0.36, 0.15], { cast: false });
  b.add(new CylinderGeometry(0.05, 0.06, 0.2, 10), m.ceramic, [0.22, baseH + 0.1, 0.15]);
  const book = rbox(0.035, 0.22, 0.16, 0.004);
  const bookColors = [m.coral, m.navy, m.leaf, m.mustard, m.linenLight];
  bookColors.forEach((material, i) => b.add(book, material, [-0.3 + i * 0.04, shelves[0]! + 0.125, 0.14]));
  b.add(new SphereGeometry(0.08, 10, 8), m.leafLight, [0.2, shelves[0]! + 0.14, 0.14], { scale: [1, 0.8, 1] });
  b.add(new CylinderGeometry(0.055, 0.045, 0.1, 10), m.terracotta, [0.2, shelves[0]! + 0.065, 0.14]);
  b.add(rbox(0.24, 0.18, 0.02, 0.004), m.walnut, [0.05, shelves[1]! + 0.11, 0.08]);
  b.add(new PlaneGeometry(0.19, 0.13), m.art, [0.05, shelves[1]! + 0.11, 0.092], { cast: false });
  b.add(new CylinderGeometry(0.04, 0.06, 0.2, 12), m.ceramic, [-0.25, shelves[1]! + 0.115, 0.14]);
  b.add(new SphereGeometry(0.07, 10, 8), m.leafDark, [-0.2, shelves[2]! + 0.1, 0.14], { scale: [1.3, 0.7, 1] });

  b.addCollider([0, H / 2, D / 2], [W + 0.04, H, D]);
}

/** Moke's ukulele-playing human's ukulele, leaning against something. */
export function ukulele(b: StaticSceneBuilder, m: RoomMaterials): void {
  const lean = -0.22;
  b.at([0, 0, 0], 0, () => {
    b.add(new SphereGeometry(0.13, 14, 10), m.oak, [0, 0.17, 0], { scale: [1, 1.05, 0.34], rotation: [lean, 0, 0] });
    b.add(new SphereGeometry(0.1, 14, 10), m.oak, [0, 0.33, -0.036], { scale: [1, 1, 0.34], rotation: [lean, 0, 0] });
    b.add(new BoxGeometry(0.045, 0.33, 0.025), m.walnut, [0, 0.55, -0.085], { rotation: [lean, 0, 0] });
    b.add(new BoxGeometry(0.06, 0.08, 0.02), m.walnut, [0, 0.74, -0.13], { rotation: [lean, 0, 0] });
    b.add(new CylinderGeometry(0.035, 0.035, 0.005, 16), m.black, [0, 0.26, -0.005], { rotation: [Math.PI / 2 + lean, 0, 0], cast: false });
  });
}

/** Dark rustic coffee table with drawers and a lower shelf of books: 1.3 × 0.7 m, 0.45 m high (Moke can hop up). */
export function rusticCoffeeTable(b: StaticSceneBuilder, m: RoomMaterials): void {
  const W = 1.3;
  const D = 0.7;
  const H = 0.45;
  const top = 0.05;
  b.add(rbox(W, top, D, 0.012), m.darkWood, [0, H - top / 2, 0]);
  b.add(new BoxGeometry(W - 0.08, 0.12, D - 0.08), m.darkWood, [0, H - top - 0.06, 0]);
  for (const side of [-1, 1]) {
    b.add(rbox(W / 2 - 0.1, 0.08, 0.012, 0.004), m.walnut, [side * (W / 4), H - top - 0.06, D / 2 - 0.035]);
    b.add(new SphereGeometry(0.012, 8, 6), m.black, [side * (W / 4), H - top - 0.06, D / 2 - 0.02], { cast: false });
  }
  for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) for (const z of [-D / 2 + 0.05, D / 2 - 0.05]) b.add(new BoxGeometry(0.06, H - top, 0.06), m.darkWood, [x, (H - top) / 2, z]);
  b.add(new BoxGeometry(W - 0.08, 0.03, D - 0.08), m.darkWood, [0, 0.1, 0]);
  const book = rbox(0.26, 0.05, 0.2, 0.006);
  [m.linenLight, m.navy, m.coral, m.leaf].forEach((material, i) => b.add(book, material, [-0.4 + i * 0.27, 0.14, (i % 2) * 0.05 - 0.02], { rotation: [0, (i - 1.5) * 0.08, 0] }));
  // On top: a tray, a candle and a stack of magazines.
  b.add(rbox(0.4, 0.03, 0.26, 0.01), m.wicker, [0.28, H + 0.015, 0.02]);
  b.add(new CylinderGeometry(0.045, 0.045, 0.1, 12), m.cream, [0.36, H + 0.08, 0.02]);
  b.add(rbox(0.28, 0.04, 0.22, 0.005), m.cream, [-0.3, H + 0.02, -0.05], { rotation: [0, 0.2, 0] });

  b.addCollider([0, H / 2, 0], [W, H, D]);
  b.addCollider([0.28, H + 0.06, 0.02], [0.4, 0.12, 0.26], { thin: true });
}

/** A big monstera in a woven basket (one in each corner of the window wall). */
export function monstera(b: StaticSceneBuilder, m: RoomMaterials, size = 1): void {
  const potH = 0.38 * size;
  const r = 0.25 * size;
  b.add(new CylinderGeometry(r, r * 0.86, potH, 18), m.wicker, [0, potH / 2, 0]);
  b.add(new TorusGeometry(r, 0.02, 6, 18), m.wickerDark, [0, potH, 0], { rotation: [Math.PI / 2, 0, 0] });
  b.add(new CylinderGeometry(r * 0.94, r * 0.94, 0.02, 16), m.soil, [0, potH - 0.02, 0], { cast: false });
  const stem = new CylinderGeometry(0.01, 0.012, 1, 5);
  const leaves = [leafGeometry(0.5 * size, 0.36 * size), leafGeometry(0.42 * size, 0.32 * size)];
  const count = 8;
  for (let i = 0; i < count; i++) {
    const yaw = (i / count) * Math.PI * 2 + (i % 3) * 0.4;
    const tilt = 0.3 + (i % 3) * 0.22;
    const length = (0.55 + ((i * 29) % 7) * 0.08) * size;
    b.at([0, potH, 0], yaw, () => {
      const dir: Vec3Tuple = [0, Math.cos(tilt), Math.sin(tilt)];
      b.add(stem, m.stem, [0, (dir[1] * length) / 2, (dir[2] * length) / 2], { rotation: [tilt, 0, 0], scale: [1, length, 1], cast: false });
      b.add(leaves[i % 2]!, i % 2 ? m.leafLight : m.leafDark, [0, dir[1] * length, dir[2] * length], { rotation: [tilt + 0.7, 0, 0] });
    });
  }
  b.addCollider([0, potH / 2, 0], [2 * r, potH, 2 * r]);
  b.addCollider([0, potH + 0.4 * size, 0], [2 * r, 0.8 * size, 2 * r], { thin: true });
}

/** A white bladeless tower fan. */
export function towerFan(b: StaticSceneBuilder, m: RoomMaterials): void {
  b.add(new CylinderGeometry(0.13, 0.14, 0.05, 20), m.cabinet, [0, 0.025, 0]);
  b.add(new CylinderGeometry(0.05, 0.07, 0.3, 14), m.cabinet, [0, 0.2, 0]);
  b.add(new TorusGeometry(0.2, 0.03, 8, 28), m.cabinet, [0, 0.72, 0], { scale: [0.55, 1.2, 1] });
  b.addCollider([0, 0.5, 0], [0.26, 1, 0.26], { thin: true });
}

/** A white two-step stool (Moke can climb it: 0.2 m then 0.4 m). */
export function stepStool(b: StaticSceneBuilder, m: RoomMaterials): void {
  b.add(rbox(0.42, 0.2, 0.22, 0.02), m.cabinet, [0, 0.1, 0.11]);
  b.add(rbox(0.42, 0.4, 0.2, 0.02), m.cabinet, [0, 0.2, -0.1]);
  b.addCollider([0, 0.1, 0.11], [0.42, 0.2, 0.22]);
  b.addCollider([0, 0.2, -0.1], [0.42, 0.4, 0.2]);
}

/** Moke's pink fleece blanket, rumpled on the floor (a favourite nap spot). No collider: he walks onto it. */
export function pinkBlanket(b: StaticSceneBuilder, m: RoomMaterials): void {
  const W = 1.0;
  const D = 0.78;
  const geometry = new PlaneGeometry(W, D, 20, 16);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    const edge = Math.max(Math.abs(x) / (W / 2), Math.abs(y) / (D / 2));
    const ripple = 0.008 * Math.sin(x * 9 + y * 4) + 0.006 * Math.cos(y * 11 - x * 3);
    position.setZ(i, 0.022 + ripple * (1 - edge * 0.6) - edge * edge * 0.01);
  }
  geometry.computeVertexNormals();
  b.add(geometry, m.blanketPink, [0, 0, 0], { rotation: [-Math.PI / 2, 0, 0], cast: false });
  // A soft fold along one side.
  b.add(new CylinderGeometry(0.05, 0.05, W * 0.9, 10), m.blanketPink, [0, 0.045, -D / 2 + 0.06], { rotation: [0, 0, Math.PI / 2], scale: [1, 1, 0.6], cast: false });
}

/** Moke's bowls: the blue slow feeder and his steel water bowl, on a little mat. */
export function dogBowls(b: StaticSceneBuilder, m: RoomMaterials): void {
  b.add(rbox(0.62, 0.008, 0.34, 0.004), m.linenLight, [0, 0.004, 0], { cast: false });
  const profile = [new Vector2(0.001, 0), new Vector2(0.1, 0), new Vector2(0.12, 0.012), new Vector2(0.125, 0.06), new Vector2(0.11, 0.062), new Vector2(0.1, 0.02), new Vector2(0.001, 0.02)];
  b.add(new LatheGeometry(profile, 20), m.bowlBlue, [-0.15, 0.008, 0]);
  // The slow feeder's maze ridges.
  for (let i = 0; i < 3; i++) b.add(new TorusGeometry(0.03 + i * 0.028, 0.006, 4, 16), m.bowlBlue, [-0.15, 0.03, 0], { rotation: [Math.PI / 2, 0, 0], cast: false });
  b.add(new LatheGeometry(profile, 20), m.stainless, [0.15, 0.008, 0], { scale: [0.85, 1, 0.85] });
  b.add(new CylinderGeometry(0.085, 0.085, 0.004, 16), m.glass, [0.15, 0.045, 0], { cast: false, receive: false });
  b.addCollider([-0.15, 0.035, 0], [0.25, 0.07, 0.25], { thin: true });
  b.addCollider([0.15, 0.035, 0], [0.21, 0.07, 0.21], { thin: true });
}

/** The rose-gold wire basket of Moke's toys on the hearth. */
export function toyBasket(b: StaticSceneBuilder, m: RoomMaterials): void {
  const r = 0.16;
  const h = 0.2;
  b.add(new CylinderGeometry(r * 0.9, r * 0.9, 0.01, 14), m.roseGold, [0, 0.005, 0]);
  for (const y of [0.07, 0.14, h]) b.add(new TorusGeometry(r, 0.006, 4, 20), m.roseGold, [0, y, 0], { rotation: [Math.PI / 2, 0, 0], cast: false });
  const wire = new CylinderGeometry(0.004, 0.004, h, 4);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.add(wire, m.roseGold, [Math.cos(a) * r, h / 2, Math.sin(a) * r], { cast: false });
  }
  b.add(new SphereGeometry(0.07, 10, 8), m.coral, [-0.05, 0.13, 0.02]);
  b.add(new SphereGeometry(0.06, 10, 8), m.mustard, [0.06, 0.15, -0.03]);
  b.add(new CylinderGeometry(0.025, 0.025, 0.22, 8), m.leaf, [0.02, 0.2, 0.04], { rotation: [0.5, 0, 0.6] });
  b.addCollider([0, h / 2, 0], [2 * r, h, 2 * r], { thin: true });
}

// ---------------------------------------------------------------- kitchen

const COUNTER = { height: 0.92, depth: 0.62, top: 0.03, kick: 0.09 };

/** A shaker door or drawer front with a bar pull. */
function shakerFront(b: StaticSceneBuilder, m: RoomMaterials, x: number, y: number, z: number, w: number, h: number, pullVertical: boolean): void {
  b.add(rbox(w, h, 0.02, 0.004), m.cabinet, [x, y, z + 0.01]);
  b.add(new BoxGeometry(w - 0.1, h - 0.1, 0.008), m.trim, [x, y, z + 0.022], { cast: false });
  const pull = pullVertical ? new BoxGeometry(0.012, 0.14, 0.02) : new BoxGeometry(0.14, 0.012, 0.02);
  b.add(pull, m.stainless, [x + (pullVertical ? w / 2 - 0.05 : 0), y + (pullVertical ? 0 : h / 2 - 0.05), z + 0.035], { cast: false });
}

/** A run of white base cabinets with a quartz top, `length` m along x, back at z = 0 (0.92 m high). */
export function baseCabinets(b: StaticSceneBuilder, m: RoomMaterials, length: number): void {
  const { height, depth, top, kick } = COUNTER;
  const bodyH = height - top;
  b.add(new BoxGeometry(length, bodyH - kick, depth - 0.02), m.cabinet, [0, kick + (bodyH - kick) / 2, (depth - 0.02) / 2]);
  b.add(new BoxGeometry(length, kick, depth - 0.08), m.steelDark, [0, kick / 2, (depth - 0.08) / 2], { cast: false });
  b.add(new BoxGeometry(length + 0.02, top, depth + 0.02), m.quartz, [0, height - top / 2, (depth + 0.02) / 2]);
  const doors = Math.max(1, Math.round(length / 0.5));
  const w = length / doors;
  for (let i = 0; i < doors; i++) {
    const x = -length / 2 + (i + 0.5) * w;
    shakerFront(b, m, x, height - top - 0.1, depth - 0.02, w - 0.02, 0.16, false);
    shakerFront(b, m, x, kick + (bodyH - kick - 0.2) / 2, depth - 0.02, w - 0.02, bodyH - kick - 0.22, true);
  }
  b.addCollider([0, height / 2, depth / 2], [length, height, depth]);
}

/** White upper cabinets with glass-fronted doors, `length` m along x, from 1.45 m to the ceiling line. */
export function upperCabinets(b: StaticSceneBuilder, m: RoomMaterials, length: number, bottom = 1.45, topY = 2.35): void {
  const D = 0.34;
  const H = topY - bottom;
  b.add(new BoxGeometry(length, H, D - 0.02), m.cabinet, [0, bottom + H / 2, (D - 0.02) / 2]);
  const doors = Math.max(1, Math.round(length / 0.45));
  const w = length / doors;
  for (let i = 0; i < doors; i++) {
    const x = -length / 2 + (i + 0.5) * w;
    b.add(rbox(w - 0.02, H - 0.04, 0.02, 0.004), m.cabinet, [x, bottom + H / 2, D - 0.01]);
    b.add(new PlaneGeometry(w - 0.14, H - 0.16), m.glass, [x, bottom + H / 2 + 0.01, D + 0.002], { cast: false, receive: false });
    b.add(new BoxGeometry(0.012, 0.12, 0.02), m.stainless, [x + (i % 2 ? -1 : 1) * (w / 2 - 0.05), bottom + 0.14, D + 0.02], { cast: false });
    // Dishes behind the glass.
    b.add(new CylinderGeometry(0.1, 0.1, 0.015, 14), m.ceramic, [x, bottom + H * 0.35, D * 0.5], { rotation: [Math.PI / 2 - 0.15, 0, 0], cast: false });
  }
  b.add(new BoxGeometry(length + 0.04, 0.06, D + 0.03), m.trim, [0, topY + 0.03, (D + 0.03) / 2]);
  b.addCollider([0, bottom + H / 2, D / 2], [length, H, D]);
}

/** A tiled backsplash panel (subway or arabesque), `width` × `height`, bottom at y = 0, flat on the wall. */
export function backsplash(b: StaticSceneBuilder, material: Material, width: number, height: number): void {
  b.add(tiledPlane(width, height), material, [0, height / 2, 0.004], { cast: false });
}

/** The stainless range with red knobs and a black cooktop: 0.76 m wide, fits in a counter run. */
export function range(b: StaticSceneBuilder, m: RoomMaterials): void {
  const W = 0.76;
  const H = COUNTER.height;
  const D = 0.66;
  b.add(rbox(W, H - 0.02, D, 0.01), m.stainless, [0, (H - 0.02) / 2, D / 2]);
  b.add(new BoxGeometry(W - 0.02, 0.02, D - 0.04), m.black, [0, H - 0.01, D / 2 - 0.01]);
  // Grates and burners.
  for (const x of [-0.18, 0.18]) for (const z of [0.18, 0.44]) b.add(new TorusGeometry(0.07, 0.008, 4, 14), m.steelDark, [x, H + 0.012, z], { rotation: [Math.PI / 2, 0, 0], cast: false });
  // Oven door with a window and a handle.
  b.add(rbox(W - 0.06, 0.5, 0.02, 0.006), m.stainless, [0, 0.36, D + 0.01]);
  b.add(new PlaneGeometry(W - 0.26, 0.24), m.tvScreen, [0, 0.38, D + 0.022], { cast: false });
  b.add(new CylinderGeometry(0.012, 0.012, W - 0.16, 8), m.stainless, [0, 0.66, D + 0.05], { rotation: [0, 0, Math.PI / 2], cast: false });
  // Control panel and the red knobs.
  b.add(new BoxGeometry(W - 0.02, 0.09, 0.03), m.stainless, [0, H - 0.08, D + 0.005]);
  for (let i = 0; i < 6; i++) b.add(new CylinderGeometry(0.018, 0.02, 0.03, 10), m.knobRed, [-0.3 + i * 0.12, H - 0.08, D + 0.03], { rotation: [Math.PI / 2, 0, 0], cast: false });
  b.addCollider([0, H / 2, D / 2], [W, H, D]);
}

/** The stainless chimney hood over the range. Bottom edge at `bottom` m. */
export function rangeHood(b: StaticSceneBuilder, m: RoomMaterials, bottom = 1.72, ceiling = 2.6): void {
  const canopy = new CylinderGeometry(0.21, 0.52, 0.34, 4, 1);
  b.add(canopy, m.stainless, [0, bottom + 0.17, 0.3], { rotation: [0, Math.PI / 4, 0], scale: [1.05, 1, 0.62] });
  b.add(new BoxGeometry(0.78, 0.06, 0.5), m.stainless, [0, bottom + 0.03, 0.25]);
  b.add(new BoxGeometry(0.32, ceiling - bottom - 0.34, 0.26), m.stainless, [0, (ceiling + bottom + 0.34) / 2, 0.13]);
}

/** Stainless French-door fridge (0.92 × 1.78 m) with a freezer drawer, cabinets above to the ceiling. */
export function fridge(b: StaticSceneBuilder, m: RoomMaterials, ceiling: number): void {
  const W = 0.92;
  const H = 1.78;
  const D = 0.68;
  b.add(rbox(W, H, D, 0.015), m.stainless, [0, H / 2, D / 2]);
  for (const side of [-1, 1]) {
    b.add(new BoxGeometry(0.004, 1.1, 0.01), m.steelDark, [0, 1.2, D + 0.002], { cast: false });
    b.add(new CylinderGeometry(0.012, 0.012, 0.72, 8), m.stainless, [side * 0.06, 1.2, D + 0.05], { cast: false });
  }
  b.add(new BoxGeometry(W - 0.02, 0.005, 0.01), m.steelDark, [0, 0.63, D + 0.002], { cast: false });
  b.add(new CylinderGeometry(0.012, 0.012, 0.6, 8), m.stainless, [0, 0.55, D + 0.05], { rotation: [0, 0, Math.PI / 2], cast: false });
  tallCabinetTop(b, m, W, H, ceiling);
  b.addCollider([0, H / 2, D / 2], [W, H, D]);
}

/** A tall white cabinet column (0.76 m) holding a double wall oven, or a microwave over drawers. */
export function tallColumn(b: StaticSceneBuilder, m: RoomMaterials, kind: 'ovens' | 'microwave', ceiling: number): void {
  const W = 0.76;
  const D = 0.66;
  b.add(new BoxGeometry(W, ceiling, D - 0.02), m.cabinet, [0, ceiling / 2, (D - 0.02) / 2]);
  if (kind === 'ovens') {
    for (const y of [0.62, 1.3]) {
      b.add(rbox(W - 0.06, 0.6, 0.03, 0.006), m.stainless, [0, y, D - 0.005]);
      b.add(new PlaneGeometry(W - 0.26, 0.3), m.tvScreen, [0, y - 0.02, D + 0.012], { cast: false });
      b.add(new CylinderGeometry(0.012, 0.012, W - 0.2, 8), m.stainless, [0, y + 0.24, D + 0.045], { rotation: [0, 0, Math.PI / 2], cast: false });
    }
    shakerFront(b, m, 0, 0.16, D - 0.02, W - 0.04, 0.24, false);
  } else {
    b.add(rbox(W - 0.08, 0.38, 0.03, 0.006), m.stainless, [0, 1.38, D - 0.005]);
    b.add(new PlaneGeometry(0.44, 0.26), m.tvScreen, [-0.06, 1.38, D + 0.012], { cast: false });
    for (const y of [0.2, 0.52, 0.86]) shakerFront(b, m, 0, y, D - 0.02, W - 0.04, 0.3, false);
  }
  shakerFront(b, m, 0, (ceiling + 1.95) / 2, D - 0.02, W - 0.04, ceiling - 2.0, true);
  b.addCollider([0, ceiling / 2, D / 2], [W, ceiling, D]);
}

function tallCabinetTop(b: StaticSceneBuilder, m: RoomMaterials, W: number, from: number, ceiling: number): void {
  const H = ceiling - from - 0.04;
  b.add(new BoxGeometry(W, H, 0.64), m.cabinet, [0, from + 0.04 + H / 2, 0.32]);
  for (const side of [-1, 1]) shakerFront(b, m, side * (W / 4), from + 0.04 + H / 2, 0.64, W / 2 - 0.02, H - 0.04, true);
}

/** A turned (lathe) leg: the island's decorative corner legs. */
function turnedLeg(height: number): LatheGeometry {
  const r = [0.05, 0.04, 0.055, 0.035, 0.04, 0.03, 0.045, 0.045];
  const y = [0, 0.08, 0.16, 0.28, 0.45, 0.62, 0.74, 1];
  return new LatheGeometry(
    r.map((radius, i) => new Vector2(radius, y[i]! * height)),
    10,
  );
}

/**
 * The big white island: 2.3 × 1.3 m, 0.92 m high, a quartz top overhanging 0.3 m on the stool side (+z) with
 * turned legs at the corners, a sink with a tall faucet on the working side (-z) and jars of monstera cuttings.
 * Moke fits under the overhang between the stools' legs.
 */
export function island(b: StaticSceneBuilder, m: RoomMaterials): void {
  const L = 2.3;
  const W = 1.3;
  const H = COUNTER.height;
  const overhang = 0.3;
  const bodyW = W - overhang;
  const bodyZ = -W / 2 + bodyW / 2;
  b.add(new BoxGeometry(L - 0.16, H - COUNTER.top - COUNTER.kick, bodyW - 0.02), m.cabinet, [0, COUNTER.kick + (H - COUNTER.top - COUNTER.kick) / 2, bodyZ]);
  b.add(new BoxGeometry(L - 0.2, COUNTER.kick, bodyW - 0.08), m.steelDark, [0, COUNTER.kick / 2, bodyZ], { cast: false });
  // Working side (-z): doors, the dishwasher, drawers.
  const front = -W / 2 + 0.01;
  b.at([0, 0, front], Math.PI, () => {
    shakerFront(b, m, -0.6, 0.47, 0, 0.56, 0.7, true);
    b.add(rbox(0.6, 0.72, 0.02, 0.004), m.stainless, [0, 0.47, 0.01]);
    b.add(new BoxGeometry(0.5, 0.012, 0.02), m.stainless, [0, 0.8, 0.04], { cast: false });
    shakerFront(b, m, 0.6, 0.47, 0, 0.56, 0.7, true);
  });
  // Stool side (+z): shaker panels under the overhang.
  for (const x of [-0.72, 0, 0.72]) b.add(rbox(0.66, 0.7, 0.012, 0.004), m.trim, [x, 0.47, bodyZ + bodyW / 2], { cast: false });
  const leg = turnedLeg(H - COUNTER.top);
  for (const x of [-L / 2 + 0.07, L / 2 - 0.07]) for (const z of [-W / 2 + 0.07, W / 2 - 0.06]) b.add(leg, m.cabinet, [x, 0, z]);
  b.add(rbox(L + 0.04, 0.04, W + 0.04, 0.012), m.quartz, [0, H - 0.02, 0]);
  // Sink and faucet.
  b.add(new BoxGeometry(0.62, 0.012, 0.36), m.stainless, [0, H + 0.001, -W / 2 + 0.34], { cast: false });
  b.add(new BoxGeometry(0.58, 0.004, 0.32), m.steelDark, [0, H + 0.008, -W / 2 + 0.34], { cast: false });
  b.add(new CylinderGeometry(0.018, 0.022, 0.34, 10), m.stainless, [0, H + 0.17, -W / 2 + 0.1]);
  b.add(new TorusGeometry(0.1, 0.014, 6, 14, Math.PI), m.stainless, [0, H + 0.34, -W / 2 + 0.2], { rotation: [0, Math.PI / 2, 0] });
  // Glass jars of monstera cuttings and a fruit bowl.
  for (const [x, h] of [
    [0.62, 0.26],
    [0.78, 0.2],
  ] as const) {
    b.add(new CylinderGeometry(0.06, 0.06, h, 12), m.glass, [x, H + h / 2, -0.05], { cast: false, receive: false });
    b.add(leafGeometry(0.2, 0.14), m.leafLight, [x, H + h, -0.05], { rotation: [0.3, x * 3, 0] });
  }
  b.add(new SphereGeometry(0.14, 14, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.ceramic, [-0.55, H + 0.14, 0.05], { cast: false });
  for (const [x, z, material] of [
    [-0.6, 0.02, m.mustard],
    [-0.5, 0.08, m.coral],
    [-0.55, -0.02, m.leaf],
  ] as const) {
    b.add(new SphereGeometry(0.045, 10, 8), material, [x, H + 0.06, z + 0.05]);
  }

  b.addCollider([0, H / 2, bodyZ], [L, H, bodyW]);
  b.addCollider([0, H - 0.02, 0], [L + 0.04, 0.04, W + 0.04]);
  for (const x of [-L / 2 + 0.07, L / 2 - 0.07]) b.addCollider([x, (H - 0.04) / 2, W / 2 - 0.06], [0.1, H - 0.04, 0.1], { thin: true });
}

/** A white upholstered counter stool (seat 0.65 m: too high for Moke), dark legs and a footrest ring. */
export function counterStool(b: StaticSceneBuilder, m: RoomMaterials): void {
  const seatY = 0.65;
  b.add(rbox(0.42, 0.08, 0.42, 0.03, 2), m.cream, [0, seatY - 0.04, 0]);
  b.add(rbox(0.4, 0.28, 0.06, 0.03, 2), m.cream, [0, seatY + 0.2, -0.19], { rotation: [-0.12, 0, 0] });
  const leg = new CylinderGeometry(0.014, 0.012, seatY - 0.08, 6);
  for (const x of [-0.15, 0.15]) for (const z of [-0.15, 0.15]) b.add(leg, m.black, [x, (seatY - 0.08) / 2, z]);
  b.add(new TorusGeometry(0.2, 0.008, 4, 16), m.black, [0, 0.24, 0], { rotation: [Math.PI / 2, 0, Math.PI / 4], scale: [0.8, 0.8, 1], cast: false });
  b.addCollider([0, seatY - 0.04, 0], [0.42, 0.08, 0.42], { thin: true });
  for (const x of [-0.15, 0.15]) for (const z of [-0.15, 0.15]) b.addCollider([x, (seatY - 0.08) / 2, z], [0.04, seatY - 0.08, 0.04], { thin: true });
}

/** A coffee maker and a rice cooker for the counter. */
export function smallAppliances(b: StaticSceneBuilder, m: RoomMaterials): void {
  b.add(rbox(0.2, 0.34, 0.24, 0.02), m.black, [-0.2, 0.17, 0.14]);
  b.add(new CylinderGeometry(0.06, 0.055, 0.13, 12), m.glass, [-0.2, 0.08, 0.26], { cast: false, receive: false });
  b.add(new SphereGeometry(0.13, 16, 10), m.cream, [0.2, 0.1, 0.16], { scale: [1, 0.75, 1] });
  b.add(new CylinderGeometry(0.1, 0.11, 0.05, 16), m.cream, [0.2, 0.02, 0.16]);
}

/** A rectangular crystal chandelier, hanging `drop` m from the ceiling (long axis along x). */
export function rectChandelier(b: StaticSceneBuilder, m: RoomMaterials, ceiling: number, drop = 0.75): void {
  const L = 0.95;
  const W = 0.32;
  const bottom = ceiling - drop;
  b.add(new BoxGeometry(L, 0.02, W), m.stainless, [0, ceiling - 0.12, 0], { cast: false });
  b.add(new BoxGeometry(L - 0.1, 0.015, W - 0.1), m.stainless, [0, bottom, 0], { cast: false });
  b.add(new CylinderGeometry(0.005, 0.005, 0.1, 4), m.stainless, [0, ceiling - 0.06, 0], { cast: false });
  const drop1 = new OctahedronGeometry(0.018, 0);
  const tiers = 5;
  for (let t = 0; t < tiers; t++) {
    const y = ceiling - 0.16 - t * ((drop - 0.2) / (tiers - 1));
    for (let i = 0; i < 9; i++) {
      const x = -L / 2 + 0.05 + (i / 8) * (L - 0.1);
      for (const z of [-W / 2 + 0.03, W / 2 - 0.03]) b.add(drop1, m.crystal, [x, y, z], { scale: [1, 1.8, 1], cast: false });
    }
  }
  for (const x of [-0.25, 0, 0.25]) b.add(new SphereGeometry(0.03, 8, 6), m.bulb, [x, bottom + 0.2, 0], { cast: false, receive: false });
}

/** A round tiered crystal chandelier (the dining room's). */
export function roundChandelier(b: StaticSceneBuilder, m: RoomMaterials, ceiling: number, drop = 0.7): void {
  const bottom = ceiling - drop;
  b.add(new CylinderGeometry(0.006, 0.006, drop - 0.4, 4), m.stainless, [0, ceiling - (drop - 0.4) / 2, 0], { cast: false });
  const drop1 = new OctahedronGeometry(0.02, 0);
  const tiers: [number, number, number][] = [
    [0.36, bottom + 0.34, 18],
    [0.3, bottom + 0.22, 16],
    [0.22, bottom + 0.1, 12],
    [0.1, bottom, 6],
  ];
  for (const [r, y, n] of tiers) {
    b.add(new TorusGeometry(r, 0.008, 4, 24), m.stainless, [0, y + 0.03, 0], { rotation: [Math.PI / 2, 0, 0], cast: false });
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      b.add(drop1, m.crystal, [Math.cos(a) * r, y, Math.sin(a) * r], { scale: [1, 1.9, 1], cast: false });
    }
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    b.add(new SphereGeometry(0.03, 8, 6), m.bulb, [Math.cos(a) * 0.2, bottom + 0.3, Math.sin(a) * 0.2], { cast: false, receive: false });
  }
}

// ---------------------------------------------------------------- dining room

/** The long whitewashed trestle table: 2.6 × 1.0 m (long axis along x), top at 0.76 m. Moke walks under it. */
export function diningTable(b: StaticSceneBuilder, m: RoomMaterials): void {
  const L = 2.6;
  const W = 1.0;
  const H = 0.76;
  const top = 0.06;
  b.add(rbox(L, top, W, 0.012), m.whitewash, [0, H - top / 2, 0]);
  b.add(new BoxGeometry(L - 0.3, 0.08, W - 0.2), m.whitewash, [0, H - top - 0.04, 0]);
  // X trestles at each end, with feet and a high stretcher (Moke's head clears it).
  for (const x of [-L / 2 + 0.32, L / 2 - 0.32]) {
    for (const lean of [-0.72, 0.72]) b.add(new BoxGeometry(0.07, 0.92, 0.07), m.whitewash, [x, 0.36, 0], { rotation: [lean, 0, 0] });
    b.add(new BoxGeometry(0.09, 0.06, W - 0.14), m.whitewash, [x, 0.03, 0]);
    b.add(new BoxGeometry(0.09, 0.06, W - 0.26), m.whitewash, [x, H - top - 0.1, 0]);
  }
  b.add(new BoxGeometry(L - 0.64, 0.07, 0.07), m.whitewash, [0, 0.6, 0]);
  // A low vase of flowers in the middle.
  b.add(new CylinderGeometry(0.08, 0.06, 0.16, 14), m.ceramic, [0, H + 0.08, 0]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    b.add(new SphereGeometry(0.05, 8, 6), i % 2 ? m.cream : m.pillowMustard, [Math.cos(a) * 0.08, H + 0.2 + (i % 3) * 0.02, Math.sin(a) * 0.08]);
  }
  b.add(new SphereGeometry(0.05, 8, 6), m.coral, [0, H + 0.25, 0]);

  b.addCollider([0, H - top / 2, 0], [L, top, W]);
  for (const x of [-L / 2 + 0.32, L / 2 - 0.32]) b.addCollider([x, 0.36, 0], [0.1, 0.72, W - 0.14], { thin: true });
}

/**
 * A beige upholstered dining chair (seat top 0.46 m: Moke can just hop up, and duck under), dark legs. Front +z.
 * `arms`: the armchairs at the table's ends.
 */
export function diningChair(b: StaticSceneBuilder, m: RoomMaterials, arms = false): void {
  const seatTop = 0.46;
  const W = arms ? 0.58 : 0.5;
  const D = 0.5;
  const leg = new CylinderGeometry(0.018, 0.014, seatTop - 0.06, 6);
  for (const x of [-W / 2 + 0.015, W / 2 - 0.015]) for (const z of [-D / 2 + 0.015, D / 2 - 0.015]) b.add(leg, m.darkWood, [x, (seatTop - 0.06) / 2, z]);
  b.add(rbox(W, 0.09, D, 0.03, 2), m.upholstery, [0, seatTop - 0.045, 0]);
  b.add(rbox(W - 0.02, 0.58, 0.08, 0.035, 2), m.upholstery, [0, seatTop + 0.29, -D / 2 + 0.04], { rotation: [-0.08, 0, 0] });
  // Nailhead trim along the seat front.
  b.add(new BoxGeometry(W - 0.04, 0.012, 0.004), m.brass, [0, seatTop - 0.07, D / 2 + 0.002], { cast: false });
  if (arms) for (const side of [-1, 1]) b.add(rbox(0.07, 0.24, D - 0.08, 0.025, 2), m.upholstery, [side * (W / 2 - 0.035), seatTop + 0.12, -0.02]);

  b.addCollider([0, seatTop - 0.045, 0], [W, 0.09, D]);
  b.addCollider([0, seatTop + 0.29, -D / 2 + 0.04], [W, 0.58, 0.09]);
  for (const x of [-W / 2 + 0.015, W / 2 - 0.015]) for (const z of [-D / 2 + 0.015, D / 2 - 0.015]) b.addCollider([x, (seatTop - 0.09) / 2, z], [0.04, seatTop - 0.09, 0.04], { thin: true });
  if (arms) for (const side of [-1, 1]) b.addCollider([side * (W / 2 - 0.035), seatTop + 0.12, -0.02], [0.07, 0.24, D - 0.08], { thin: true });
}

/** The dark carved sideboard with bottles on top and the bevelled mirror above. Length along x, back at z = 0. */
export function sideboard(b: StaticSceneBuilder, m: RoomMaterials, length = 1.6): void {
  const H = 0.86;
  const D = 0.48;
  b.add(rbox(length, H - 0.1, D, 0.015), m.darkWood, [0, 0.1 + (H - 0.1) / 2, D / 2]);
  b.add(rbox(length + 0.04, 0.04, D + 0.03, 0.01), m.darkWood, [0, H + 0.02, (D + 0.03) / 2]);
  for (const x of [-length / 2 + 0.05, length / 2 - 0.05]) for (const z of [0.05, D - 0.05]) b.add(new BoxGeometry(0.06, 0.12, 0.06), m.darkWood, [x, 0.06, z]);
  const doors = 4;
  const w = length / doors;
  for (let i = 0; i < doors; i++) {
    const x = -length / 2 + (i + 0.5) * w;
    b.add(rbox(w - 0.05, H - 0.26, 0.02, 0.006), m.walnut, [x, 0.12 + (H - 0.26) / 2 + 0.03, D + 0.008]);
    b.add(new SphereGeometry(0.018, 8, 6), m.brass, [x + (i % 2 ? -1 : 1) * (w / 2 - 0.06), 0.5, D + 0.03], { cast: false });
    // A carved diamond in each panel.
    b.add(new BoxGeometry(0.14, 0.14, 0.012), m.darkWood, [x, 0.5, D + 0.022], { rotation: [0, 0, Math.PI / 4], cast: false });
  }
  // Bottles and a tray.
  b.add(rbox(0.5, 0.02, 0.3, 0.008), m.brass, [-0.35, H + 0.05, D / 2]);
  const bottle = new CylinderGeometry(0.035, 0.035, 0.24, 10);
  const neck = new CylinderGeometry(0.012, 0.02, 0.1, 8);
  [m.leafDark, m.mustard, m.tvScreen, m.coral].forEach((material, i) => {
    const x = -0.52 + i * 0.11;
    b.add(bottle, material, [x, H + 0.18, D / 2]);
    b.add(neck, material, [x, H + 0.35, D / 2]);
  });
  b.add(new CylinderGeometry(0.07, 0.05, 0.22, 10), m.ceramic, [0.45, H + 0.13, D / 2]);
  b.add(new SphereGeometry(0.12, 10, 8), m.leafLight, [0.45, H + 0.3, D / 2], { scale: [1.3, 0.7, 1] });
  // The bevelled mirror above.
  b.add(rbox(1.3, 0.95, 0.03, 0.01), m.trim, [0, 1.62, 0.015]);
  b.add(new PlaneGeometry(1.2, 0.85), m.mirror, [0, 1.62, 0.032], { cast: false });

  b.addCollider([0, H / 2 + 0.02, D / 2], [length, H + 0.04, D]);
}

/** A stainless wine fridge with a dark glass door and rows of bottle ends. Fits under the counter line. */
export function wineFridge(b: StaticSceneBuilder, m: RoomMaterials): void {
  const W = 0.6;
  const H = 0.86;
  const D = 0.5;
  b.add(rbox(W, H, D, 0.01), m.stainless, [0, H / 2, D / 2]);
  b.add(new PlaneGeometry(W - 0.1, H - 0.16), m.tvScreen, [0, H / 2 + 0.02, D + 0.004], { cast: false });
  const end = new CylinderGeometry(0.022, 0.022, 0.01, 8);
  for (let row = 0; row < 5; row++) for (let i = 0; i < 5; i++) b.add(end, row % 2 ? m.leafDark : m.coral, [-0.19 + i * 0.095, 0.16 + row * 0.13, D - 0.02], { rotation: [Math.PI / 2, 0, 0], cast: false });
  b.add(new BoxGeometry(0.02, 0.5, 0.03), m.stainless, [W / 2 - 0.06, H / 2 + 0.02, D + 0.02], { cast: false });
  b.addCollider([0, H / 2, D / 2], [W, H, D]);
}

/** The big black Roman-numeral wall clock (0.9 m across), flat on the wall. */
export function wallClock(b: StaticSceneBuilder, m: RoomMaterials): void {
  b.add(new TorusGeometry(0.43, 0.035, 8, 40), m.black, [0, 0, 0.03], { cast: false });
  b.add(new CylinderGeometry(0.43, 0.43, 0.02, 40), m.clockFace, [0, 0, 0.012], { rotation: [Math.PI / 2, -Math.PI / 2, 0], cast: false });
}

/** A TV on a black rolling stand (the dining room corner). */
export function tvOnStand(b: StaticSceneBuilder, m: RoomMaterials): void {
  b.add(new BoxGeometry(0.62, 0.04, 0.46), m.black, [0, 0.07, 0]);
  for (const x of [-0.27, 0.27]) for (const z of [-0.19, 0.19]) b.add(new SphereGeometry(0.03, 8, 6), m.black, [x, 0.03, z], { cast: false });
  b.add(new BoxGeometry(0.08, 1.25, 0.06), m.black, [0, 0.7, -0.05]);
  b.add(rbox(1.1, 0.64, 0.05, 0.01), m.tvBody, [0, 1.3, 0]);
  b.add(new PlaneGeometry(1.06, 0.6), m.tvScreen, [0, 1.3, 0.0255], { cast: false });
  b.addCollider([0, 0.05, 0], [0.62, 0.1, 0.46]);
  b.addCollider([0, 0.7, -0.05], [0.1, 1.3, 0.1], { thin: true });
}

/**
 * A window with a white frame, a mullion, a half-raised fabric shade and the garden beyond. Its middle is at the
 * origin (in the wall plane, x across, y up): `width` × `height`, sill at `sill`. The glass faces +z (the room).
 */
export function gardenWindow(b: StaticSceneBuilder, m: RoomMaterials, width: number, height: number, sill: number, wall: number): void {
  const f = 0.06;
  const depth = wall + 0.04;
  const midY = sill + height / 2;
  b.add(new BoxGeometry(width, f, depth), m.trim, [0, sill + height - f / 2, 0]);
  b.add(new BoxGeometry(width, f, depth), m.trim, [0, sill + f / 2, 0]);
  for (const side of [-1, 1]) b.add(new BoxGeometry(f, height, depth), m.trim, [side * (width / 2 - f / 2), midY, 0]);
  b.add(new BoxGeometry(0.035, height, depth * 0.6), m.trim, [0, midY, 0]);
  b.add(new BoxGeometry(width + 0.16, 0.035, 0.14), m.trim, [0, sill - 0.0175, depth / 2 + 0.03]);
  b.add(new PlaneGeometry(width - 2 * f, height - 2 * f), m.glass, [0, midY, 0], { cast: false, receive: false });
  // Shade, raised to about two-thirds.
  b.add(rbox(width - 0.1, height * 0.3, 0.03, 0.01), m.cream, [0, sill + height * 0.83, depth / 2 + 0.02], { cast: false });
  b.add(new PlaneGeometry(width * 3, height * 2.2), m.garden, [0, midY + 0.2, -1.4], { cast: false, receive: false });
  // The glass is solid: nothing (the camera included) goes out through it.
  b.addCollider([0, midY, 0], [width, height, wall]);
}

/** Tall sliding glass doors (`width` × 2.2 m) with white curtains either side on a black rod. Middle at the origin. */
export function slidingDoors(b: StaticSceneBuilder, m: RoomMaterials, width: number, wall: number): void {
  const H = 2.2;
  const f = 0.05;
  const depth = wall + 0.02;
  b.add(new BoxGeometry(width, f, depth), m.trim, [0, H - f / 2, 0]);
  b.add(new BoxGeometry(width, 0.02, depth), m.trim, [0, 0.01, 0]);
  for (const x of [-width / 2 + f / 2, 0, width / 2 - f / 2]) b.add(new BoxGeometry(f, H, depth), m.trim, [x, H / 2, 0]);
  for (const side of [-1, 1]) b.add(new PlaneGeometry(width / 2 - 1.5 * f, H - 2 * f), m.glass, [side * (width / 4), H / 2, 0.01 * side], { cast: false, receive: false });
  b.add(new BoxGeometry(0.02, 0.3, 0.03), m.black, [0.1, 1.05, depth / 2 + 0.01], { cast: false });
  b.addCollider([0, H / 2, 0], [width, H, wall]);
  // Curtains.
  b.add(new CylinderGeometry(0.012, 0.012, width + 1.1, 8), m.black, [0, H + 0.14, depth / 2 + 0.08], { rotation: [0, 0, Math.PI / 2], cast: false });
  for (const side of [-1, 1]) {
    const w = 0.5;
    const geometry = new PlaneGeometry(w, H + 0.1, 20, 1);
    const position = geometry.getAttribute('position');
    for (let i = 0; i < position.count; i++) position.setZ(i, 0.035 * Math.sin((position.getX(i) / w) * Math.PI * 6));
    geometry.computeVertexNormals();
    b.add(geometry, m.curtain, [side * (width / 2 + 0.22), (H + 0.1) / 2, depth / 2 + 0.1]);
    b.addCollider([side * (width / 2 + 0.22), (H + 0.1) / 2, depth / 2 + 0.1], [w, H + 0.1, 0.08], { thin: true });
  }
}

/** White wainscoting: panelled boards up to 0.95 m with a cap rail, `length` along x, flat on the wall. */
export function wainscoting(b: StaticSceneBuilder, m: RoomMaterials, length: number): void {
  const H = 0.95;
  b.add(new BoxGeometry(length, H, 0.015), m.trim, [0, H / 2, 0.0075], { cast: false });
  b.add(new BoxGeometry(length, 0.04, 0.035), m.trim, [0, H, 0.0175], { cast: false });
  const panels = Math.max(1, Math.round(length / 0.6));
  const w = length / panels;
  for (let i = 0; i < panels; i++) b.add(new BoxGeometry(w - 0.12, H - 0.32, 0.008), m.cabinet, [-length / 2 + (i + 0.5) * w, H / 2 + 0.04, 0.019], { cast: false });
}

/** A closed door, recessed, with the hand-painted sign. Front +z, middle at the origin. */
export function signedDoor(b: StaticSceneBuilder, m: RoomMaterials, width: number, height: number): void {
  b.add(rbox(width, height, 0.045, 0.01), m.door, [0, height / 2, 0]);
  for (const y of [height * 0.28, height * 0.72]) b.add(rbox(width - 0.2, height * 0.34, 0.012, 0.006), m.trim, [0, y, 0.026], { cast: false });
  b.add(new SphereGeometry(0.03, 10, 8), m.brass, [width / 2 - 0.09, height * 0.48, 0.05], { cast: false });
  b.add(rbox(0.46, 0.24, 0.02, 0.01), m.doorSign, [0, height * 0.66, 0.045], { cast: false });
}

/** The gym/sunroom behind the interior windows and sliders: seen through glass only, never entered. */
export function backroomDressing(b: StaticSceneBuilder, m: RoomMaterials): void {
  // A treadmill and an exercise ball, in silhouette.
  b.add(new BoxGeometry(0.8, 0.18, 1.8), m.black, [0, 0.09, 0]);
  b.add(new BoxGeometry(0.06, 1.1, 0.06), m.black, [-0.36, 0.6, -0.85]);
  b.add(new BoxGeometry(0.06, 1.1, 0.06), m.black, [0.36, 0.6, -0.85]);
  b.add(new BoxGeometry(0.8, 0.2, 0.3), m.black, [0, 1.2, -0.85]);
  b.add(new SphereGeometry(0.33, 16, 12), m.wallSage, [1.3, 0.33, 0.6]);
}

/** Box shorthand for callers that build walls. */
export function box(w: number, h: number, d: number): BufferGeometry {
  return new BoxGeometry(w, h, d);
}
