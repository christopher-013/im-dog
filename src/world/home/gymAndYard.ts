import { BoxGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, PlaneGeometry, SphereGeometry, TorusGeometry } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PATIO_TILE, type RoomMaterials } from '../materials';
import type { StaticSceneBuilder } from '../StaticSceneBuilder';

// The home gym (the old sunroom) and the backyard seen through its glass doors. Original, built in code
// (docs/HOME_REFERENCE.md); no image textures. Each piece is built around its own origin
// with its front facing +z, like the rest of the furniture; Wing.ts places them.

const rbox = (w: number, h: number, d: number, radius: number, segments = 2) => new RoundedBoxGeometry(w, h, d, segments, radius);

/**
 * The bird cage (local space: front +z, middle of the footprint at the origin): a dark wrought-iron flight cage on a
 * stand with casters, a seed-catching skirt, a pull-out tray lined with light blue paper, wooden perches, cups and
 * toys. `ConureView` uses the same numbers for where the bird can go.
 */
export const CAGE = {
  width: 0.8,
  depth: 0.55,
  /** The cage floor (the paper) and the top of the bars. */
  floorY: 0.82,
  topY: 1.68,
  /** The two perches: height, how far back (z), and their ends along x. */
  perches: [
    { y: 1.06, z: -0.06, x0: -0.34, x1: 0.34 },
    { y: 1.36, z: 0.08, x0: -0.32, x1: 0.12 },
  ],
  /** The swing's bar. */
  swing: { y: 1.2, z: 0.12, x0: 0.14, x1: 0.28 },
} as const;

/** The big sliding glass doors to the backyard: two fixed panes either side of two sliders. Middle at the origin, glass faces +z. */
export function patioDoors(b: StaticSceneBuilder, m: RoomMaterials, width: number, height: number, wall: number): void {
  // The frame sits inside the wall's opening (its outer faces against the opening's, never in the same place).
  const f = 0.055;
  const depth = wall + 0.03;
  const inner = width - 2 * f;
  const pane = inner / 4;
  b.add(new BoxGeometry(width, f, depth), m.doorFrame, [0, height - f / 2, 0]);
  b.add(new BoxGeometry(inner, 0.03, depth + 0.04), m.doorFrame, [0, 0.015, 0]);
  for (const side of [-1, 1]) b.add(new BoxGeometry(f, height - f, depth), m.doorFrame, [side * (width / 2 - f / 2), (height - f) / 2, 0]);
  const paneHeight = height - f - 0.03;
  // The two sliders run on the inner track, the fixed panes on the outer one (so no two panes share a plane).
  for (let i = 0; i < 4; i++) {
    const x = -inner / 2 + (i + 0.5) * pane;
    const z = i === 1 || i === 2 ? 0.022 : -0.022;
    const sash = i === 1 || i === 2 ? 0.036 : 0.03;
    for (const sx of [-1, 1]) b.add(new BoxGeometry(0.045, paneHeight, sash), m.doorFrame, [x + sx * (pane / 2 - 0.0225), 0.03 + paneHeight / 2, z]);
    for (const y of [0.03 + 0.035, 0.03 + paneHeight - 0.035]) b.add(new BoxGeometry(pane - 0.09, 0.07, sash), m.doorFrame, [x, y, z]);
    b.add(new PlaneGeometry(pane - 0.09, paneHeight - 0.14), m.glass, [x, 0.03 + paneHeight / 2, z], { cast: false, receive: false });
  }
  // The C-shaped pulls on the two sliders, where they meet in the middle.
  for (const sx of [-1, 1]) {
    const x = sx * 0.09;
    b.add(new BoxGeometry(0.02, 0.26, 0.018), m.doorFrame, [x, 1.0, 0.07]);
    for (const y of [0.88, 1.12]) b.add(new BoxGeometry(0.02, 0.02, 0.04), m.doorFrame, [x, y, 0.055]);
  }
  b.addCollider([0, height / 2, 0], [width, height, wall]);
}

/** A connected stationary bike facing +z: a low frame, a big flywheel under a red guard, a saddle, bars and a screen. */
export function spinBike(b: StaticSceneBuilder, m: RoomMaterials): void {
  b.add(new BoxGeometry(0.95, 0.008, 1.55), m.rubberMat, [0, 0.004, 0.02], { cast: false });
  // Base: two stabilisers and a spine.
  b.add(rbox(0.56, 0.05, 0.08, 0.02), m.gymFrame, [0, 0.033, 0.5]);
  b.add(rbox(0.5, 0.05, 0.08, 0.02), m.gymFrame, [0, 0.033, -0.52]);
  b.add(new BoxGeometry(0.08, 0.06, 1.04), m.gymFrame, [0, 0.05, 0]);
  // The frame: up from the back of the base to the seat post, and from the front to the bars.
  b.add(new BoxGeometry(0.075, 0.075, 0.62), m.gymFrame, [0, 0.33, -0.2], { rotation: [0.9, 0, 0] });
  b.add(new BoxGeometry(0.075, 0.075, 0.55), m.gymFrame, [0, 0.36, 0.32], { rotation: [-1.15, 0, 0] });
  // The flywheel and its red guard.
  b.add(new CylinderGeometry(0.235, 0.235, 0.06, 32), m.gymFrame, [0, 0.4, 0.28], { rotation: [0, 0, Math.PI / 2] });
  b.add(new TorusGeometry(0.235, 0.014, 8, 36), m.bikeRed, [0, 0.4, 0.28], { rotation: [0, Math.PI / 2, 0] });
  b.add(new CylinderGeometry(0.05, 0.05, 0.085, 16), m.chrome, [0, 0.4, 0.28], { rotation: [0, 0, Math.PI / 2] });
  // Cranks and pedals.
  for (const side of [-1, 1]) {
    b.add(new BoxGeometry(0.02, 0.17, 0.03), m.chrome, [side * 0.075, 0.3 + side * 0.05, 0.02], { rotation: [side * 0.6, 0, 0] });
    b.add(new BoxGeometry(0.1, 0.02, 0.06), m.gymFrame, [side * 0.12, 0.3 + side * 0.12, 0.02 - side * 0.05]);
  }
  // Seat post and saddle.
  b.add(new BoxGeometry(0.05, 0.36, 0.05), m.chrome, [0, 0.66, -0.36], { rotation: [-0.25, 0, 0] });
  b.add(rbox(0.17, 0.06, 0.28, 0.025), m.gymFrame, [0, 0.85, -0.4]);
  // Bars and the screen.
  b.add(new BoxGeometry(0.05, 0.4, 0.05), m.chrome, [0, 0.8, 0.44], { rotation: [0.25, 0, 0] });
  b.add(new CylinderGeometry(0.016, 0.016, 0.46, 12), m.gymFrame, [0, 1.0, 0.46], { rotation: [0, 0, Math.PI / 2] });
  for (const side of [-1, 1]) b.add(new CylinderGeometry(0.016, 0.016, 0.2, 10), m.gymFrame, [side * 0.21, 1.02, 0.36], { rotation: [Math.PI / 2 - 0.2, 0, 0] });
  b.add(rbox(0.58, 0.38, 0.035, 0.01), m.gymFrame, [0, 1.27, 0.5], { rotation: [-0.3, 0, 0] });
  b.add(new PlaneGeometry(0.54, 0.34), m.screen, [0, 1.27 - 0.004, 0.5 - 0.0175 - 0.008], { rotation: [-0.3, Math.PI, 0], cast: false });
  b.addCollider([0, 0.55, 0], [0.6, 1.1, 1.2], { thin: true });
}

/** A two-tier dumbbell rack with pairs of hex dumbbells, light to heavy, and two kettlebells beside it. Front +z. */
export function dumbbellRack(b: StaticSceneBuilder, m: RoomMaterials): void {
  const L = 1.25;
  b.add(new BoxGeometry(L + 0.7, 0.008, 0.85), m.rubberMat, [0.25, 0.004, 0.12], { cast: false });
  for (const x of [-L / 2, L / 2]) {
    b.add(new BoxGeometry(0.05, 0.05, 0.6), m.gymFrame, [x, 0.025, 0]);
    b.add(new BoxGeometry(0.05, 0.85, 0.05), m.gymFrame, [x, 0.45, -0.15], { rotation: [-0.2, 0, 0] });
    b.add(new BoxGeometry(0.05, 0.6, 0.05), m.gymFrame, [x, 0.32, 0.17], { rotation: [0.25, 0, 0] });
  }
  const tiers = [
    { y: 0.78, z: -0.08, sizes: [0.036, 0.04, 0.044, 0.048, 0.052] },
    { y: 0.48, z: 0.08, sizes: [0.056, 0.06, 0.064, 0.068] },
  ];
  for (const tier of tiers) {
    // The cradle, tilted toward you.
    b.add(new BoxGeometry(L + 0.05, 0.03, 0.22), m.gymFrame, [0, tier.y - 0.05, tier.z], { rotation: [0.3, 0, 0] });
    const step = L / (tier.sizes.length * 2);
    tier.sizes.forEach((r, i) => {
      for (let k = 0; k < 2; k++) {
        const x = -L / 2 + step * (i * 2 + k + 0.5);
        const at: [number, number, number] = [x, tier.y + r * 0.4, tier.z];
        b.add(new CylinderGeometry(0.014, 0.014, 0.13, 10), m.chrome, at, { rotation: [Math.PI / 2 - 0.3, 0, 0] });
        for (const end of [-1, 1]) {
          const dz = end * (0.065 + 0.024);
          b.add(new CylinderGeometry(r, r, 0.048, 6), m.dumbbell, [x, at[1] + dz * Math.sin(0.3), tier.z + dz * Math.cos(0.3)], { rotation: [Math.PI / 2 - 0.3, 0, 0] });
        }
      }
    });
  }
  for (const [x, r] of [[L / 2 + 0.22, 0.085], [L / 2 + 0.45, 0.1]] as const) {
    b.add(new SphereGeometry(r, 16, 12), m.dumbbell, [x, r, 0.2]);
    b.add(new TorusGeometry(r * 0.55, r * 0.14, 8, 16, Math.PI), m.dumbbell, [x, r * 1.75, 0.2]);
  }
  b.addCollider([0, 0.45, 0], [L + 0.1, 0.9, 0.62]);
  b.addCollider([L / 2 + 0.33, 0.1, 0.2], [0.42, 0.2, 0.22], { thin: true });
}

/** The conure's cage on its stand (see CAGE). Front +z; the door and the cups face you. */
export function birdCage(b: StaticSceneBuilder, m: RoomMaterials): void {
  const { width: W, depth: D, floorY, topY } = CAGE;
  const bar = 0.0032;
  // The stand: four legs on casters, a low grate shelf, and the seed skirt under the cage.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const x = sx * (W / 2 - 0.02);
      const z = sz * (D / 2 - 0.02);
      b.add(new BoxGeometry(0.028, 0.68, 0.028), m.cageMetal, [x, 0.41, z]);
      b.add(new SphereGeometry(0.03, 10, 8), m.black, [x, 0.03, z]);
    }
  }
  b.add(new BoxGeometry(W - 0.02, 0.018, D - 0.02), m.cageMetal, [0, 0.22, 0]);
  b.add(new BoxGeometry(W + 0.16, 0.025, D + 0.16), m.cageMetal, [0, floorY - 0.075, 0]);
  for (const side of [-1, 1]) {
    b.add(new BoxGeometry(W + 0.16, 0.06, 0.012), m.cageMetal, [0, floorY - 0.045, side * (D / 2 + 0.074)]);
    b.add(new BoxGeometry(0.012, 0.06, D + 0.16), m.cageMetal, [side * (W / 2 + 0.074), floorY - 0.045, 0]);
  }
  // The pan, its paper, the corner posts and the rails.
  b.add(new BoxGeometry(W, 0.06, D), m.cageMetal, [0, floorY - 0.034, 0]);
  b.add(new BoxGeometry(W - 0.03, 0.004, D - 0.03), m.cagePaper, [0, floorY + 0.001, 0], { cast: false });
  const height = topY - floorY;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(new BoxGeometry(0.02, height, 0.02), m.cageMetal, [sx * W / 2, floorY + height / 2, sz * D / 2]);
  for (const y of [floorY + 0.02, floorY + height * 0.48, topY]) {
    for (const side of [-1, 1]) {
      b.add(new BoxGeometry(W, 0.012, 0.012), m.cageMetal, [0, y, side * D / 2]);
      b.add(new BoxGeometry(0.012, 0.012, D), m.cageMetal, [side * W / 2, y, 0]);
    }
  }
  // The bars, 2.5 cm apart all round, and a grid over the top.
  const barHeight = height - 0.02;
  for (let x = -W / 2 + 0.025; x < W / 2 - 0.01; x += 0.025) {
    for (const side of [-1, 1]) b.add(new BoxGeometry(bar, barHeight, bar), m.cageMetal, [x, floorY + barHeight / 2 + 0.01, side * D / 2], { cast: false });
  }
  for (let z = -D / 2 + 0.025; z < D / 2 - 0.01; z += 0.025) {
    for (const side of [-1, 1]) b.add(new BoxGeometry(bar, barHeight, bar), m.cageMetal, [side * W / 2, floorY + barHeight / 2 + 0.01, z], { cast: false });
  }
  for (let z = -D / 2 + 0.05; z < D / 2; z += 0.05) b.add(new BoxGeometry(W, bar, bar), m.cageMetal, [0, topY, z], { cast: false });
  for (let x = -W / 2 + 0.05; x < W / 2; x += 0.05) b.add(new BoxGeometry(bar, bar, D), m.cageMetal, [x, topY, 0], { cast: false });
  // The front door's frame and latch.
  const door = { x0: -0.19, x1: 0.19, y0: floorY + 0.12, y1: floorY + 0.62 };
  const fz = D / 2 + 0.008;
  for (const y of [door.y0, door.y1]) b.add(new BoxGeometry(door.x1 - door.x0, 0.014, 0.012), m.cageMetal, [0, y, fz]);
  for (const x of [door.x0, door.x1]) b.add(new BoxGeometry(0.014, door.y1 - door.y0, 0.012), m.cageMetal, [x, (door.y0 + door.y1) / 2, fz]);
  b.add(new BoxGeometry(0.03, 0.05, 0.02), m.cageMetal, [door.x1 + 0.012, (door.y0 + door.y1) / 2, fz + 0.006]);
  // Perches, the swing, cups and toys.
  for (const p of CAGE.perches) b.add(new CylinderGeometry(0.011, 0.011, p.x1 - p.x0, 10), m.perchWood, [(p.x0 + p.x1) / 2, p.y, p.z], { rotation: [0, 0, Math.PI / 2] });
  const s = CAGE.swing;
  b.add(new CylinderGeometry(0.007, 0.007, s.x1 - s.x0, 8), m.perchWood, [(s.x0 + s.x1) / 2, s.y, s.z], { rotation: [0, 0, Math.PI / 2] });
  b.add(new TorusGeometry((s.x1 - s.x0) / 2, 0.003, 5, 16, Math.PI), m.cageMetal, [(s.x0 + s.x1) / 2, s.y, s.z]);
  for (const [x, material] of [[-0.26, m.bowlBlue], [0.27, m.ceramic]] as const) {
    b.add(new CylinderGeometry(0.045, 0.035, 0.045, 14), material, [x, floorY + 0.2, D / 2 - 0.045]);
  }
  b.add(new CylinderGeometry(0.046, 0.046, 0.012, 16), m.toyRed, [0.2, 1.43, -0.05], { rotation: [Math.PI / 2, 0, 0] });
  b.add(new SphereGeometry(0.017, 10, 8), m.toyYellow, [0.2, 1.43, -0.037]);
  b.add(new BoxGeometry(0.004, 0.2, 0.004), m.cageMetal, [0.2, 1.57, -0.05], { cast: false });
  b.add(new CylinderGeometry(0.04, 0.04, 0.01, 6), m.toyTeal, [-0.3, 1.5, -0.2], { rotation: [Math.PI / 2, 0, 0] });
  // Solid to Moke (he can't get under or behind it); the camera looks through the bars.
  b.addCollider([0, topY / 2, 0], [W + 0.16, topY, D + 0.16], { thin: true });
}

/**
 * The backyard beyond the gym's glass doors, in world space (x east of the house's east wall, x > 17): a flagstone
 * patio, the stone BBQ island with a grill and covered bar chairs under a white market umbrella, the dark wood bench
 * with grey cushions and two wicker lounge chairs under a big cantilever umbrella, potted plants by the doors, then
 * the lawn, hedges with pink bougainvillea, a fence and trees, and the sky. Scenery only: nothing out here is reachable.
 */
export function backyard(b: StaticSceneBuilder, m: RoomMaterials): void {
  const cast = b.castByDefault;
  b.castByDefault = false;
  const x0 = 17.03;
  // Ground: the lawn, and the patio just above it.
  b.add(new BoxGeometry(24, 0.1, 40), m.lawn, [x0 + 12.05, -0.064, 0]);
  b.add(new BoxGeometry(6.4, 0.1, 11.5), m.patio, [x0 + 3.2, -0.054, -1], { worldUV: PATIO_TILE });

  // The BBQ island, running away from the doors on the left.
  const island = { x0: 18.1, x1: 21.1, z: -2.65, depth: 0.78, height: 0.9 };
  const midX = (island.x0 + island.x1) / 2;
  const len = island.x1 - island.x0;
  b.add(new BoxGeometry(len, island.height, island.depth), m.islandStone, [midX, island.height / 2, island.z]);
  b.add(rbox(len + 0.12, 0.06, island.depth + 0.3, 0.01), m.travertine, [midX, island.height + 0.03, island.z + 0.1]);
  b.add(new BoxGeometry(0.3, 0.1, 0.02), m.grillDark, [island.x0 - 0.001, 0.55, island.z], { rotation: [0, Math.PI / 2, 0] });
  // The grill: a stainless body set into the top, its hood, and the handle.
  b.add(new BoxGeometry(0.75, 0.16, 0.56), m.grill, [island.x0 + 0.62, island.height + 0.14, island.z - 0.05]);
  b.add(new CylinderGeometry(0.28, 0.28, 0.75, 20, 1, false, 0, Math.PI), m.grill, [island.x0 + 0.62, island.height + 0.22, island.z - 0.05], { rotation: [0, 0, Math.PI / 2], scale: [1, 1, 0.6] });
  b.add(new CylinderGeometry(0.012, 0.012, 0.6, 8), m.grillDark, [island.x0 + 0.62, island.height + 0.36, island.z + 0.16], { rotation: [0, 0, Math.PI / 2] });
  // Bar chairs along the right side of the island, under their white covers.
  for (const x of [18.75, 19.45, 20.15, 20.85]) {
    b.add(rbox(0.46, 1.0, 0.46, 0.06), m.chairCover, [x, 0.52, island.z + island.depth / 2 + 0.34]);
    b.add(new BoxGeometry(0.48, 0.12, 0.48), m.chairCoverHem, [x, 0.06, island.z + island.depth / 2 + 0.34]);
  }
  b.add(new CylinderGeometry(0.15, 0.15, 0.45, 16), m.propane, [21.3, 0.23, -1.75]);
  // The market umbrella over the far end of the island.
  umbrella(b, m, 20.6, -3.45, 2.45, 1.4, 0);

  // The seating on the right: a long dark bench with a grey bolster and cream pillows, two wicker lounge chairs.
  const bench = { x0: 19.3, x1: 21.9, z: 2.3 };
  const bl = bench.x1 - bench.x0;
  b.add(new BoxGeometry(bl, 0.36, 0.62), m.benchWood, [(bench.x0 + bench.x1) / 2, 0.18, bench.z]);
  b.add(new BoxGeometry(bl, 0.5, 0.14), m.benchWood, [(bench.x0 + bench.x1) / 2, 0.45, bench.z + 0.27]);
  b.add(new CylinderGeometry(0.1, 0.1, bl - 0.1, 16), m.cushionGrey, [(bench.x0 + bench.x1) / 2, 0.46, bench.z - 0.12], { rotation: [0, 0, Math.PI / 2] });
  for (const [x, turn] of [[19.8, 0.2], [20.3, -0.15], [20.8, 0.1]] as const) b.add(rbox(0.36, 0.34, 0.12, 0.05), m.pillowCream, [x, 0.6, bench.z + 0.14], { rotation: [-0.25, turn, 0] });
  b.add(new BoxGeometry(0.62, 0.36, 0.62), m.benchWood, [bench.x0 - 0.4, 0.18, bench.z + 0.05]);
  for (const [x, z, r] of [[18.55, 1.2, 0.5], [19.35, 1.45, -0.4]] as const) {
    b.at([x, 0, z], r, () => {
      b.add(new CylinderGeometry(0.36, 0.32, 0.36, 18), m.loungeWicker, [0, 0.18, 0]);
      b.add(new CylinderGeometry(0.34, 0.34, 0.12, 18), m.loungeCushion, [0, 0.42, 0]);
      b.add(new TorusGeometry(0.34, 0.07, 8, 18, Math.PI * 1.1), m.loungeWicker, [0, 0.55, 0], { rotation: [Math.PI / 2, 0, Math.PI * 0.95] });
    });
  }
  // The big cantilever umbrella: a post beside the bench, its arm reaching over the seating.
  const post = { x: 22.2, z: 0.6 };
  b.add(new BoxGeometry(0.9, 0.08, 0.12), m.umbrellaPole, [post.x, 0.04, post.z]);
  b.add(new BoxGeometry(0.12, 0.08, 0.9), m.umbrellaPole, [post.x, 0.04, post.z]);
  b.add(new CylinderGeometry(0.035, 0.04, 2.7, 10), m.umbrellaPole, [post.x, 1.35, post.z]);
  b.add(new CylinderGeometry(0.025, 0.025, 1.9, 8), m.umbrellaPole, [post.x - 0.72, 2.62, post.z + 0.56], { rotation: [0, -0.66, Math.PI / 2 - 0.12] });
  umbrella(b, m, 20.6, 1.8, 2.55, 1.8, 0.35);

  // Pots by the doors: two small trees in white pots and a frangipani in a blue glazed one.
  for (const [x, z, r, material] of [[17.5, -0.45, 0.22, m.potWhite], [17.75, 0.2, 0.2, m.potWhite], [17.95, 0.95, 0.26, m.potBlue]] as const) {
    b.add(new CylinderGeometry(r, r * 0.8, r * 1.4, 18), material, [x, r * 0.7, z]);
    b.add(new CylinderGeometry(r * 0.92, r * 0.92, 0.02, 16), m.soilDark, [x, r * 1.4 + 0.005, z]);
    b.add(new CylinderGeometry(0.018, 0.024, 0.5, 6), m.trunk, [x, r * 1.4 + 0.25, z]);
    b.add(new IcosahedronGeometry(r * 1.3, 1), material === m.potBlue ? m.hedgeLight : m.hedge, [x, r * 1.4 + 0.55, z], { scale: [1, 0.8, 1] });
  }

  // The garden: hedges down both sides with bougainvillea on the left, trees and a fence at the back.
  const blob = (x: number, y: number, z: number, r: number, material = m.hedge) => b.add(new IcosahedronGeometry(r, 1), material, [x, y, z], { scale: [1, 0.85, 1] });
  for (let x = 17.6; x < 27; x += 0.9) {
    blob(x, 0.9, -6.9, 1.1, (Math.round(x * 10) % 2 ? m.hedge : m.hedgeLight));
    blob(x, 0.9, 5.6, 1.1, (Math.round(x * 10) % 2 ? m.hedgeLight : m.hedge));
  }
  for (const [x, y, z] of [[18.1, 1.5, -6.0], [18.6, 1.1, -5.8], [19.3, 1.7, -6.1], [19.9, 1.25, -5.9], [20.6, 1.6, -6.2], [18.9, 2.0, -6.3]] as const) blob(x, y, z, 0.32, m.bougainvillea);
  b.add(new BoxGeometry(0.15, 1.9, 13), m.fence, [27.5, 0.95, -0.5]);
  for (const [x, z, h, r] of [[25.5, -4.5, 3.2, 1.6], [26.2, -1.2, 3.8, 1.9], [25.8, 2.6, 3.4, 1.7], [24.3, 4.0, 2.4, 1.1], [24.6, -5.8, 2.6, 1.2]] as const) {
    b.add(new CylinderGeometry(0.1, 0.14, h, 8), m.trunk, [x, h / 2, z]);
    blob(x, h, z, r);
    blob(x + 0.5, h - 0.4, z + 0.6, r * 0.75, m.hedgeLight);
  }
  // The sky and distant trees, far behind the fence.
  b.add(new PlaneGeometry(80, 26), m.sky, [42, 9, 0], { rotation: [0, -Math.PI / 2, 0], receive: false });
  b.castByDefault = cast;
}

/** A square white umbrella: a pole (unless `armed`, when the caller has drawn the cantilever) and a low pyramid canopy. */
function umbrella(b: StaticSceneBuilder, m: RoomMaterials, x: number, z: number, height: number, radius: number, armed: number): void {
  if (!armed) {
    b.add(new CylinderGeometry(0.025, 0.025, height, 8), m.umbrellaPole, [x, height / 2, z]);
    b.add(new CylinderGeometry(0.28, 0.3, 0.06, 12), m.umbrellaPole, [x, 0.03, z]);
  }
  b.add(new ConeGeometry(radius, 0.42, 4, 1, true), m.umbrella, [x, height + 0.15, z], { rotation: [0, Math.PI / 4 + armed, 0] });
  b.add(new ConeGeometry(0.07, 0.12, 4), m.umbrella, [x, height + 0.42, z], { rotation: [0, Math.PI / 4 + armed, 0] });
}
