import { BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, ExtrudeGeometry, PlaneGeometry, RingGeometry, Shape, SphereGeometry, TorusGeometry } from 'three';
import { courseEntryPath, coursePoint, courseYaw } from '../../activities/ObstacleCourse';
import { COURSE } from '../../config/obstacleCourse';
import type { RoomMaterials } from '../materials';
import type { StaticSceneBuilder } from '../StaticSceneBuilder';

// Liam's Obstacle Course (Phase 5): a small loop on the backyard lawn behind the patio furniture, built in code
// (original, no images). Where everything goes comes from COURSE (config/obstacleCourse.ts), the same numbers the
// rules (activities/ObstacleCourse.ts) use. Each piece is built in its own frame: local z along the way round the
// loop, local x across the lane (inward +x).

/** Top of the lawn (gymAndYard.ts). */
const LAWN = -0.014;

export function obstacleCourse(b: StaticSceneBuilder, m: RoomMaterials): void {
  const cast = b.castByDefault;
  b.castByDefault = false;
  const { center, radius, laneHalfWidth } = COURSE;
  // The mown lane round the loop, a touch lighter than the lawn.
  b.add(new RingGeometry(radius - laneHalfWidth, radius + laneHalfWidth, 72, 1), m.courseLane, [center.x, LAWN + 0.004, center.z], { rotation: [-Math.PI / 2, 0, 0], cast: false });

  const at = (a: number, build: () => void) => {
    const p = coursePoint(a);
    b.at([p.x, LAWN, p.z], courseYaw(a), build);
  };

  at(COURSE.arch.at, () => arch(b, m));
  // START, painted on the lane just before the arch, with a big arrow the way round.
  at(COURSE.arch.at - COURSE.startArrow.before, () => {
    const { length, width } = COURSE.startArrow;
    b.add(new PlaneGeometry(width, length), m.startArrow, [0, 0.011, 0], { rotation: [-Math.PI / 2, 0, Math.PI], cast: false, receive: false });
  });
  for (const a of COURSE.hurdles.at) at(a, () => hurdle(b, m));
  const w = COURSE.weave;
  for (let i = 0; i < w.count; i++) at(w.from + i * w.step, () => pole(b, m, i));
  at(COURSE.hill.at, () => hill(b, m));
  b.add(entryPath(), m.coursePath, [0, 0, 0], { cast: false });
  b.castByDefault = cast;
}

/** The start/finish arch over the lane: two white posts, a curved top, and a string of little flags. */
function arch(b: StaticSceneBuilder, m: RoomMaterials): void {
  const { halfWidth: hw, height: h } = COURSE.arch;
  for (const side of [-1, 1]) {
    b.add(new CylinderGeometry(0.04, 0.045, h, 12), m.hurdleWhite, [side * hw, h / 2, 0]);
    b.add(new CylinderGeometry(0.09, 0.1, 0.05, 14), m.hurdleRed, [side * hw, 0.025, 0]);
    b.addCollider([side * hw, h / 2, 0], [0.1, h, 0.1], { thin: true });
  }
  b.add(new TorusGeometry(hw, 0.04, 10, 28, Math.PI), m.hurdleWhite, [0, h, 0]);
  // Bunting along the top: little triangles in three colours.
  const flags = [m.flagCoral, m.flagSun, m.flagTeal];
  for (let i = 0; i < 9; i++) {
    const t = (i + 0.5) / 9;
    const angle = Math.PI * (1 - t);
    const x = Math.cos(angle) * hw * 0.98;
    const y = h + Math.sin(angle) * hw * 0.98 - 0.07;
    const flag = new BoxGeometry(0.09, 0.11, 0.004);
    flag.translate(0, -0.03, 0);
    b.add(flag, flags[i % 3]!, [x, y, 0], { rotation: [0, 0, angle - Math.PI / 2 + Math.PI / 4] });
  }
  // The banner hung inside the top, facing the way you come in: the course's name, START AND FINISH.
  const { width: bw, height: bh, above } = COURSE.arch.banner;
  const by = h + above;
  b.add(new BoxGeometry(bw + 0.04, bh + 0.04, 0.025), m.hurdleWhite, [0, by, 0]);
  b.add(new PlaneGeometry(bw, bh), m.startBanner, [0, by, -0.022], { rotation: [0, Math.PI, 0], cast: false });
  // Hung from the arch by two cords.
  for (const side of [-1, 1]) {
    const x = side * bw * 0.36;
    const top = h + Math.sqrt(hw * hw - x * x);
    const from = by + bh / 2 + 0.02;
    b.add(new CylinderGeometry(0.006, 0.006, top - from, 6), m.hurdleWhite, [x, (top + from) / 2, 0]);
  }
}

/** A low hurdle across the lane: two posts, a red-and-white striped board and a top bar. Solid: he hops it. */
function hurdle(b: StaticSceneBuilder, m: RoomMaterials): void {
  const hw = COURSE.hurdles.halfWidth;
  const h = COURSE.hurdles.height;
  for (const side of [-1, 1]) {
    b.add(new BoxGeometry(0.05, h + 0.06, 0.05), m.hurdleWhite, [side * (hw + 0.025), (h + 0.06) / 2, 0]);
    b.add(new BoxGeometry(0.06, 0.03, 0.22), m.hurdleWhite, [side * (hw + 0.025), 0.015, 0]);
  }
  // The striped board, in six bands.
  const bands = 6;
  const bw = (2 * hw) / bands;
  for (let i = 0; i < bands; i++) {
    b.add(new BoxGeometry(bw, h - 0.06, 0.025), i % 2 ? m.hurdleWhite : m.hurdleRed, [-hw + bw * (i + 0.5), 0.03 + (h - 0.06) / 2, 0]);
  }
  b.add(new CylinderGeometry(0.02, 0.02, 2 * hw + 0.1, 10), m.hurdleWhite, [0, h - 0.01, 0], { rotation: [0, 0, Math.PI / 2] });
  b.addCollider([0, h / 2 + 0.01, 0], [2 * hw + 0.1, h + 0.02, 0.06]);
}

/** A weave pole: tall, thin, yellow and blue by turns, a ball on top. */
function pole(b: StaticSceneBuilder, m: RoomMaterials, i: number): void {
  const { height, radius } = COURSE.weave;
  b.add(new CylinderGeometry(radius, radius, height, 10), i % 2 ? m.poleBlue : m.poleYellow, [0, height / 2, 0]);
  b.add(new SphereGeometry(radius * 1.8, 12, 8), m.hurdleWhite, [0, height + 0.02, 0]);
  b.add(new CylinderGeometry(0.07, 0.08, 0.03, 12), m.hurdleWhite, [0, 0.015, 0]);
  b.addCollider([0, height / 2, 0], [radius * 2.4, height, radius * 2.4], { thin: true });
}

/**
 * The hill: a grassy mound across the lane, up a gentle ramp (about 20°), a short flat top, down the other side.
 * Its colliders are the same three pieces: two tilted slabs and a block.
 */
function hill(b: StaticSceneBuilder, m: RoomMaterials): void {
  const { halfLength: L, flatHalf: F, top: h, halfWidth: W } = COURSE.hill;
  // The look: the profile (along the way, up), rounded a little at each bend, pushed out across the lane.
  const s = new Shape();
  s.moveTo(-L - 0.05, 0);
  s.quadraticCurveTo(-L + 0.05, 0, -L + 0.12, h * 0.1);
  s.lineTo(-F - 0.1, h * 0.86);
  s.quadraticCurveTo(-F, h, -F + 0.12, h);
  s.lineTo(F - 0.12, h);
  s.quadraticCurveTo(F, h, F + 0.1, h * 0.86);
  s.lineTo(L - 0.12, h * 0.1);
  s.quadraticCurveTo(L - 0.05, 0, L + 0.05, 0);
  s.lineTo(-L - 0.05, 0);
  const geometry = new ExtrudeGeometry(s, { depth: 2 * W, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.015, bevelSegments: 3, curveSegments: 6 });
  geometry.translate(0, 0, -W);
  b.add(geometry, m.hillGrass, [0, 0, 0], { rotation: [0, -Math.PI / 2, 0] });

  const run = L - F;
  const slope = Math.atan2(h, run);
  const length = Math.hypot(run, h);
  const thick = 0.3;
  for (const end of [-1, 1]) {
    // The top face's middle, then back along its normal by half the slab's thickness.
    const sMid = end * (L + F) / 2;
    const nz = end * Math.sin(slope);
    const ny = Math.cos(slope);
    b.addCollider([0, h / 2 - ny * thick / 2, sMid - nz * thick / 2], [2 * W, thick, length], { rotation: [end * slope, 0, 0] });
  }
  b.addCollider([0, h / 2, 0], [2 * W, h, 2 * F]);
}

/**
 * The paved path in from the patio (COURSE.entry): a flat ribbon along its middle line, `width` wide, just above the
 * lawn and the patio's edge. The texture repeats along it, one chevron every `chevrons` metres, pointing the way.
 */
function entryPath(): BufferGeometry {
  const points = courseEntryPath();
  const { width, chevrons } = COURSE.entry;
  const n = points.length;
  const positions = new Float32Array(n * 2 * 3);
  const normals = new Float32Array(n * 2 * 3);
  const uvs = new Float32Array(n * 2 * 2);
  const index: number[] = [];
  let along = 0;
  for (let i = 0; i < n; i++) {
    const p = points[i]!;
    if (i > 0) along += Math.hypot(p.x - points[i - 1]!.x, p.z - points[i - 1]!.z);
    const q = points[Math.min(n - 1, i + 1)]!;
    const o = points[Math.max(0, i - 1)]!;
    const d = Math.hypot(q.x - o.x, q.z - o.z) || 1;
    const fx = (q.x - o.x) / d;
    const fz = (q.z - o.z) / d;
    for (const [side, v] of [[-1, 0], [1, 1]] as const) {
      const k = (i * 2 + v) * 3;
      // Across the way (left -, right +), flat on the ground.
      positions[k] = p.x - fz * (width / 2) * side;
      positions[k + 1] = PATH_Y;
      positions[k + 2] = p.z + fx * (width / 2) * side;
      normals[k + 1] = 1;
      const u = (i * 2 + v) * 2;
      uvs[u] = v;
      uvs[u + 1] = along / chevrons;
    }
    if (i < n - 1) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  return geometry;
}

/** The path's surface: a hair above the patio's top (-0.004) and so a touch above the lawn. */
const PATH_Y = 0.0;
