import {
  BoxGeometry,
  CylinderGeometry,
  PlaneGeometry,
  PointLight,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TorusGeometry,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HOUSE_SCALE } from '../config/world';
import { addLoosePillow } from './CouchPillows';
import type { Material } from 'three';
import type { RoomMaterials } from './materials';
import type { StaticSceneBuilder, Vec3Tuple } from './StaticSceneBuilder';

// Every piece is built around its own origin, standing on the floor, with its front facing +z.
// LivingRoom places and turns them.

const rbox = (w: number, h: number, d: number, radius: number, segments = 3) =>
  new RoundedBoxGeometry(w, h, d, segments, radius);

/** A couch's fabrics and its three pillows (default: the living room's oatmeal linen and leaf-print pillows). */
export interface CouchStyle {
  readonly frame: Material;
  readonly cushion: Material;
  readonly pillows: readonly [Material, Material, Material];
}

/** Oatmeal linen couch, 2.3 m wide: seat 0.45 m (Moke can jump up onto it), arms 0.64 m, back 0.88 m. */
export function couch(b: StaticSceneBuilder, m: RoomMaterials, style?: CouchStyle): void {
  const frame = style?.frame ?? m.linen;
  const cushion = style?.cushion ?? m.linenLight;
  const [pillowA, pillowB, pillowC] = style?.pillows ?? [m.pillowLeaf, m.pillowLattice, m.pillowMustard];
  const W = 2.3;
  const D = 0.95;
  const legH = 0.08;
  const seatTop = HOUSE_SCALE.couchSeatHeight;
  const backTop = HOUSE_SCALE.couchBackHeight;

  const leg = new CylinderGeometry(0.025, 0.018, legH, 10);
  for (const x of [-W / 2 + 0.12, W / 2 - 0.12]) {
    for (const z of [-D / 2 + 0.1, D / 2 - 0.1]) b.add(leg, m.walnut, [x, legH / 2, z]);
  }
  b.add(rbox(W, 0.2, D, 0.05), frame, [0, legH + 0.1, 0]);
  const cushionW = (W - 0.5) / 2 - 0.01;
  for (const side of [-1, 1]) {
    b.add(rbox(cushionW, seatTop - 0.28, 0.67, 0.07), cushion, [side * (cushionW / 2 + 0.005), (0.28 + seatTop) / 2, 0.13]);
    b.add(rbox(cushionW, 0.4, 0.18, 0.08), cushion, [side * (cushionW / 2 + 0.005), seatTop + 0.2, -0.15], {
      rotation: [-0.12, 0, 0],
    });
  }
  b.add(rbox(W - 0.02, backTop - 0.28, 0.24, 0.07), frame, [0, (0.28 + backTop) / 2, -D / 2 + 0.12]);
  for (const side of [-1, 1]) b.add(rbox(0.24, 0.56, D + 0.02, 0.08), frame, [side * (W / 2 - 0.12), 0.36, 0]);

  const pillow = rbox(0.44, 0.42, 0.13, 0.06);
  addLoosePillow(b, pillow, pillowA, [-0.6, 0.67, -0.02], { rotation: [-0.25, 0.25, 0.07] });
  addLoosePillow(b, pillow, pillowB, [-0.2, 0.64, 0.0], { rotation: [-0.22, 0.05, -0.05], scale: [0.9, 0.9, 0.9] });
  addLoosePillow(b, pillow, pillowC, [0.62, 0.67, -0.02], { rotation: [-0.25, -0.2, -0.06] });

  b.addCollider([0, seatTop / 2, 0.01], [W, seatTop, D + 0.02]);
  b.addCollider([0, backTop / 2, -D / 2 + 0.125], [W, backTop, 0.25]);
  // Up on the seat, the arms and the back cushions and pillows are solid too, so he stands on the cushions
  // rather than inside them. Thin: only Moke meets them; the camera and the human see the couch as before.
  for (const side of [-1, 1]) b.addCollider([side * (W / 2 - 0.12), 0.32, 0.01], [0.24, 0.64, D + 0.02], { thin: true });
  b.addCollider([0, seatTop + 0.22, -0.09], [W - 0.48, 0.44, 0.3], { thin: true });
}

/** Walnut coffee table with 0.40 m of clearance underneath: tall enough for Moke to duck under, low enough to jump onto. */
export function coffeeTable(b: StaticSceneBuilder, m: RoomMaterials): void {
  const H = HOUSE_SCALE.coffeeTableHeight;
  const top = 0.05;
  b.add(rbox(1.15, top, 0.62, 0.02, 2), m.walnut, [0, H - top / 2, 0], { solid: true });
  const leg = new CylinderGeometry(0.028, 0.02, H - top, 12);
  for (const [x, z] of [
    [-0.5, -0.24],
    [0.5, -0.24],
    [-0.5, 0.24],
    [0.5, 0.24],
  ] as const) {
    b.add(leg, m.walnut, [x, (H - top) / 2, z], { thin: true });
  }
  b.add(rbox(0.26, 0.04, 0.19, 0.008, 2), m.coral, [-0.28, H + 0.02, -0.05], { rotation: [0, 0.12, 0] });
  b.add(rbox(0.23, 0.035, 0.17, 0.008, 2), m.navy, [-0.27, H + 0.0575, -0.04], { rotation: [0, -0.1, 0] });
  b.add(new CylinderGeometry(0.04, 0.036, 0.09, 20), m.mug, [0.3, H + 0.045, 0.1]);
  b.add(new TorusGeometry(0.025, 0.007, 8, 16), m.mug, [0.345, H + 0.05, 0.1]);
  b.add(rbox(0.17, 0.02, 0.05, 0.008, 2), m.tvBody, [0.05, H + 0.01, 0.16], { rotation: [0, 0.4, 0] });
  // On the table top, he walks round the books and the mug, not through them (thin: only Moke meets them).
  b.addCollider([-0.275, H + 0.0375, -0.045], [0.28, 0.075, 0.22], { thin: true });
  b.addCollider([0.31, H + 0.045, 0.1], [0.11, 0.09, 0.09], { thin: true });
}

/** Round woven rug, flat on the floor. */
export function rug(b: StaticSceneBuilder, m: RoomMaterials, radius: number): void {
  b.add(new CylinderGeometry(radius, radius, 0.012, 72), m.rug, [0, 0.006, 0], { cast: false });
}

/** Low walnut media console with cream doors, a TV and a little decor. */
export function tvConsole(b: StaticSceneBuilder, m: RoomMaterials): void {
  const W = 1.7;
  const D = 0.42;
  const legH = 0.14;
  const bodyH = 0.42;
  const topY = legH + bodyH;

  const leg = new CylinderGeometry(0.02, 0.014, legH, 10);
  for (const x of [-W / 2 + 0.08, W / 2 - 0.08]) {
    for (const z of [-D / 2 + 0.07, D / 2 - 0.07]) b.add(leg, m.walnut, [x, legH / 2, z]);
  }
  b.add(rbox(W, bodyH, D, 0.025), m.walnut, [0, legH + bodyH / 2, 0]);
  const doorW = (W - 0.08) / 3 - 0.02;
  const knob = new SphereGeometry(0.012, 10, 8);
  for (const i of [-1, 0, 1]) {
    b.add(rbox(doorW, bodyH - 0.07, 0.012, 0.004, 2), m.cream, [i * (doorW + 0.02), legH + bodyH / 2, D / 2 + 0.004]);
    b.add(knob, m.brass, [i * (doorW + 0.02), legH + bodyH / 2, D / 2 + 0.02], { cast: false });
  }

  b.add(rbox(0.34, 0.025, 0.2, 0.008, 2), m.tvBody, [0, topY + 0.0125, -0.02]);
  b.add(new BoxGeometry(0.06, 0.12, 0.04), m.tvBody, [0, topY + 0.085, -0.05]);
  const tvW = 1.25;
  const tvH = 0.72;
  const tvY = topY + 0.14 + tvH / 2;
  b.add(rbox(tvW, tvH, 0.045, 0.01, 2), m.tvBody, [0, tvY, -0.05]);
  b.add(new PlaneGeometry(tvW - 0.04, tvH - 0.04), m.tvLiving, [0, tvY, -0.05 + 0.0225 + 0.004], { cast: false, receive: false });

  b.add(new CylinderGeometry(0.06, 0.05, 0.1, 16), m.ceramic, [0.7, topY + 0.05, 0.02]);
  b.add(new SphereGeometry(0.075, 12, 8), m.leafLight, [0.7, topY + 0.15, 0.02], { scale: [1, 0.8, 1] });
  const book = rbox(0.03, 0.2, 0.15, 0.004, 2);
  b.add(book, m.coral, [-0.72, topY + 0.1, 0]);
  b.add(book, m.mustard, [-0.687, topY + 0.1, 0]);
  b.add(book, m.leaf, [-0.654, topY + 0.095, 0.006], { rotation: [0, 0, -0.08] });

  b.addCollider([0, topY / 2, 0], [W, topY, D]);
}

/** Brass floor lamp with a glowing linen shade and a warm light. */
export function floorLamp(b: StaticSceneBuilder, m: RoomMaterials, lightIntensity: number): void {
  b.add(new CylinderGeometry(0.15, 0.17, 0.03, 28), m.brass, [0, 0.015, 0]);
  b.add(new CylinderGeometry(0.013, 0.013, 1.42, 10), m.brass, [0, 0.73, 0], { thin: true });
  b.add(new CylinderGeometry(0.19, 0.25, 0.3, 32, 1, true), m.lampShade, [0, 1.52, 0], { cast: false });
  b.add(new SphereGeometry(0.045, 12, 8), m.bulb, [0, 1.45, 0], { cast: false, receive: false });
  b.addObject(new PointLight('#ffc98a', lightIntensity, 6, 2), [0, 1.48, 0]);
}

/** A flat leaf outline pointing +y from the origin. */
export function leafGeometry(length: number, width: number): ShapeGeometry {
  const s = new Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(width, length * 0.2, width * 0.9, length * 0.8, 0, length);
  s.bezierCurveTo(-width * 0.9, length * 0.8, -width, length * 0.2, 0, 0);
  return new ShapeGeometry(s, 10);
}

/** Big leafy plant in a terracotta pot. */
export function pottedPlant(b: StaticSceneBuilder, m: RoomMaterials): void {
  const potH = 0.36;
  b.add(new CylinderGeometry(0.2, 0.15, potH, 28), m.terracotta, [0, potH / 2, 0]);
  b.add(new CylinderGeometry(0.19, 0.19, 0.02, 24), m.soil, [0, potH - 0.005, 0], { cast: false });

  const stem = new CylinderGeometry(0.008, 0.01, 1, 6);
  const leaves = [leafGeometry(0.34, 0.2), leafGeometry(0.28, 0.17)];
  const count = 9;
  for (let i = 0; i < count; i++) {
    const yaw = (i / count) * Math.PI * 2 + (i % 3) * 0.3;
    const tilt = 0.35 + (i % 4) * 0.18;
    const length = 0.45 + ((i * 37) % 10) * 0.035;
    b.at([0, potH, 0], yaw, () => {
      const dir: Vec3Tuple = [0, Math.cos(tilt), Math.sin(tilt)];
      b.add(stem, m.stem, [0, (dir[1] * length) / 2, (dir[2] * length) / 2], {
        rotation: [tilt, 0, 0],
        scale: [1, length, 1],
        cast: false,
      });
      b.add(leaves[i % 2]!, i % 2 ? m.leafLight : m.leafDark, [0, dir[1] * length, dir[2] * length], {
        rotation: [tilt + 0.55, 0, 0],
      });
    });
  }
  b.addCollider([0, potH / 2, 0], [0.4, potH, 0.4]);
  // The leaves above the pot: nothing to jump up and stand on (thin: only Moke meets it).
  b.addCollider([0, potH + 0.35, 0], [0.4, 0.7, 0.4], { thin: true });
}

/** Moke's bed: a fleece cushion inside a round bolster that's open at the front (+z), so he steps in. */
export function dogBed(b: StaticSceneBuilder, m: RoomMaterials, style: { cushion?: Material; bolster?: Material; radius?: number } = {}): void {
  const R = style.radius ?? 0.42;
  const tube = 0.095;
  const cushion = style.cushion ?? m.bedCushion;
  const bolster = style.bolster ?? m.bedBolster;
  b.add(new CylinderGeometry(R - 0.02, R, 0.07, 40), cushion, [0, 0.035, 0]);
  // The torus arc lies flat after the X turn; the Z turn puts its 90° gap at +z.
  const start = (3 * Math.PI) / 4;
  const arc = Math.PI * 1.5;
  b.add(new TorusGeometry(R, tube, 14, 48, arc), bolster, [0, tube, 0], { rotation: [Math.PI / 2, 0, start] });
  const endCap = new SphereGeometry(tube, 14, 10);
  for (const angle of [start, start + arc]) b.add(endCap, bolster, [R * Math.cos(angle), tube, R * Math.sin(angle)]);

  // Bolster colliders: segments around the arc. Thin, so the camera ignores them.
  const segments = 5;
  for (let k = 0; k < segments; k++) {
    const angle = start + ((k + 0.5) / segments) * arc;
    b.addCollider([R * Math.cos(angle), tube, R * Math.sin(angle)], [2 * tube, 2 * tube, (arc * R) / segments], {
      rotationY: -angle,
      thin: true,
    });
  }
}

/** Round oak side table with a book and a vase. */
export function sideTable(b: StaticSceneBuilder, m: RoomMaterials): void {
  b.add(new CylinderGeometry(0.24, 0.24, 0.03, 32), m.oak, [0, 0.545, 0]);
  b.add(new CylinderGeometry(0.035, 0.035, 0.52, 12), m.oak, [0, 0.27, 0], { thin: true });
  b.add(new CylinderGeometry(0.16, 0.17, 0.025, 28), m.oak, [0, 0.0125, 0]);
  b.add(rbox(0.2, 0.03, 0.14, 0.006, 2), m.leaf, [0.03, 0.575, 0.02], { rotation: [0, 0.3, 0] });
  b.add(new CylinderGeometry(0.035, 0.05, 0.14, 16), m.ceramic, [-0.08, 0.63, -0.06]);
}

/** A softly folded curtain panel hanging in the local XY plane, top at `height`. */
export function curtain(b: StaticSceneBuilder, m: RoomMaterials, width: number, height: number): void {
  const geometry = new PlaneGeometry(width, height, 32, 1);
  const position = geometry.getAttribute('position');
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    position.setZ(i, 0.035 * Math.sin((x / width) * Math.PI * 2 * 3));
  }
  geometry.computeVertexNormals();
  b.add(geometry, m.curtain, [0, height / 2, 0]);
  b.addCollider([0, height / 2, 0], [width, height, 0.08], { thin: true });
}

/** Framed print, hanging flat against a wall, facing +z. */
export function framedArt(b: StaticSceneBuilder, m: RoomMaterials, width: number, height: number): void {
  b.add(rbox(width + 0.06, height + 0.06, 0.035, 0.008, 2), m.walnut, [0, 0, 0]);
  b.add(new PlaneGeometry(width, height), m.art, [0, 0, 0.0185], { cast: false });
}

/** Small picture frame with a plain coloured print. */
export function smallFrame(b: StaticSceneBuilder, m: RoomMaterials, print: keyof RoomMaterials): void {
  b.add(rbox(0.3, 0.38, 0.025, 0.006, 2), m.oak, [0, 0, 0]);
  b.add(new PlaneGeometry(0.22, 0.3), m[print], [0, 0, 0.0135], { cast: false });
}

/** Closed panel door with a brass handle, in the local XY plane facing +z. */
export function door(b: StaticSceneBuilder, m: RoomMaterials, width: number, height: number): void {
  b.add(rbox(width, height, 0.045, 0.01, 2), m.door, [0, height / 2, 0]);
  for (const y of [height * 0.28, height * 0.7]) {
    b.add(rbox(width - 0.2, height * 0.34, 0.012, 0.006, 2), m.trim, [0, y, 0.026], { cast: false });
  }
  b.add(new SphereGeometry(0.03, 12, 8), m.brass, [width / 2 - 0.09, height * 0.48, 0.05]);
}


/** The laundry table (living room): a plain walnut table, tall enough to fold at without stooping. */
export const LAUNDRY_TABLE = { width: 1.0, depth: 0.48, height: 0.74 } as const;
/** The laundry basket on it: an oval, gently tapered woven basket. */
export const LAUNDRY_BASKET = { width: 0.52, depth: 0.38, height: 0.27 } as const;

/**
 * Where the human folds laundry (Sock Heist starts here): a small table with the laundry basket on it, heaped with
 * rumpled washing, and a neat stack of what's been folded so far beside it. Local +z faces where the human stands.
 * Moke can walk underneath (only the legs block him); he can't jump up onto it.
 */
export function laundryTable(b: StaticSceneBuilder, m: RoomMaterials): void {
  const { width: W, depth: D, height: H } = LAUNDRY_TABLE;
  const top = 0.035;
  b.add(rbox(W, top, D, 0.01), m.walnut, [0, H - top / 2, 0], { solid: true });
  // An apron under the top, and square legs set in from the corners.
  for (const z of [D / 2 - 0.04, -D / 2 + 0.04]) b.add(new BoxGeometry(W - 0.12, 0.07, 0.02), m.walnut, [0, H - top - 0.035, z]);
  for (const x of [W / 2 - 0.04, -W / 2 + 0.04]) b.add(new BoxGeometry(0.02, 0.07, D - 0.1), m.walnut, [x, H - top - 0.035, 0]);
  for (const x of [W / 2 - 0.045, -W / 2 + 0.045]) {
    for (const z of [D / 2 - 0.045, -D / 2 + 0.045]) b.add(new BoxGeometry(0.04, H - top, 0.04), m.walnut, [x, (H - top) / 2, z], { thin: true });
  }
  b.at([-0.1, H, -0.01], 0, () => laundryBasket(b, m));
  // What's been folded: a tidy stack of shirts and a towel, each with a fold line down its front.
  const stack: [RoomMaterials['coral'], number, number][] = [
    [m.linenLight, 0.3, 0.24],
    [m.navy, 0.27, 0.21],
    [m.coral, 0.26, 0.2],
    [m.leaf, 0.25, 0.2],
  ];
  let y = H;
  stack.forEach(([material, w, d], i) => {
    const h = i === 0 ? 0.05 : 0.038;
    b.add(rbox(w, h, d, 0.014), material, [0.34, y + h / 2, 0.02], { rotation: [0, 0.06 * (i % 2 ? 1 : -1), 0] });
    y += h;
  });
}

/**
 * The laundry basket: an oval, gently tapered basket woven from cane (upright ribs, three woven bands, a rolled rim
 * and a cut-out handle at each end), heaped with rumpled washing and a towel hanging over the front.
 */
export function laundryBasket(b: StaticSceneBuilder, m: RoomMaterials): void {
  const { width: W, depth: D, height: H } = LAUNDRY_BASKET;
  const rx = W / 2;
  const rz = D / 2;
  const taper = 0.86;
  // The body, and a rolled rim just proud of it.
  b.add(new CylinderGeometry(1, taper, H, 40), m.wicker, [0, H / 2, 0], { scale: [rx, 1, rz] });
  b.add(new CylinderGeometry(1, 1, 0.026, 40), m.wickerDark, [0, H + 0.004, 0], { scale: [rx + 0.012, 1, rz + 0.012] });
  // Three woven bands round it (each follows the taper at its height).
  for (const t of [0.22, 0.5, 0.78]) {
    const k = taper + (1 - taper) * t;
    b.add(new CylinderGeometry(1, 1, 0.022, 40), m.wickerDark, [0, H * t, 0], { scale: [rx * k + 0.004, 1, rz * k + 0.004], cast: false });
  }
  // Upright ribs, leaning out with the sides.
  const ribs = 22;
  const rib = new BoxGeometry(0.012, H * 0.96, 0.006);
  for (let i = 0; i < ribs; i++) {
    const a = (i / ribs) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const mid = (1 + taper) / 2;
    const yaw = Math.atan2(c / rx, sn / rz);
    const reach = Math.hypot(rx * c, rz * sn);
    const lean = Math.atan(((1 - taper) * reach) / H);
    b.at([rx * c * mid + Math.sin(yaw) * 0.004, 0, rz * sn * mid + Math.cos(yaw) * 0.004], yaw, () => {
      b.add(rib, m.wickerDark, [0, H / 2, 0], { rotation: [lean, 0, 0], cast: false });
    });
  }
  // A cut-out handle at each end: a dark slot just under the rim.
  for (const side of [1, -1]) {
    b.at([side * (rx + 0.003), 0, 0], side * Math.PI / 2, () => {
      b.add(rbox(0.1, 0.035, 0.012, 0.012), m.wickerShadow, [0, H - 0.045, 0], { cast: false });
    });
  }
  // The washing: soft, rumpled heaps of clothes, piled up over the rim.
  const lump = new SphereGeometry(1, 18, 12);
  const heap: [RoomMaterials['coral'], number, number, number, number, number, number][] = [
    // material, x, y, z, radius x, radius y, radius z
    [m.linenLight, -0.1, H + 0.03, -0.04, 0.13, 0.055, 0.11],
    [m.navy, 0.1, H + 0.025, 0.03, 0.12, 0.05, 0.1],
    [m.coral, -0.02, H + 0.06, 0.05, 0.11, 0.05, 0.09],
    [m.mustard, 0.12, H + 0.055, -0.07, 0.09, 0.045, 0.07],
    [m.leaf, -0.14, H + 0.06, 0.06, 0.08, 0.04, 0.07],
    [m.linen, 0.02, H + 0.085, -0.03, 0.09, 0.04, 0.08],
  ];
  heap.forEach(([material, x, y, z, sx, sy, sz], i) => b.add(lump, material, [x, y, z], { scale: [sx, sy, sz], rotation: [0.15 * (i % 3 - 1), i * 0.7, 0.1 * (i % 2 ? 1 : -1)] }));
  // A towel hanging over the front rim: lying across the top, then down the outside.
  b.add(rbox(0.16, 0.012, 0.1, 0.005), m.linenLight, [0.14, H + 0.03, rz - 0.04], { rotation: [0.25, 0, 0] });
  b.add(rbox(0.16, 0.14, 0.012, 0.005), m.linenLight, [0.14, H - 0.05, rz + 0.012], { rotation: [0.1, 0, 0] });
  b.add(new BoxGeometry(0.16, 0.012, 0.004), m.coral, [0.14, H - 0.1, rz + 0.02], { rotation: [0.1, 0, 0], cast: false });
  b.addCollider([0, H / 2 + 0.03, 0], [W + 0.03, H + 0.06, D + 0.03]);
}

/** A ceramic treat jar with a coral lid, up on the TV console where Moke can only dream of it. */
export function treatJar(b: StaticSceneBuilder, m: RoomMaterials): void {
  b.add(new CylinderGeometry(0.07, 0.065, 0.16, 24), m.ceramic, [0, 0.08, 0]);
  b.add(new CylinderGeometry(0.078, 0.078, 0.025, 24), m.coral, [0, 0.172, 0]);
  b.add(new CylinderGeometry(0.018, 0.022, 0.03, 12), m.coral, [0, 0.198, 0]);
  // A little bone on the label.
  b.add(rbox(0.06, 0.018, 0.01, 0.006), m.mustard, [0, 0.085, 0.07]);
}
