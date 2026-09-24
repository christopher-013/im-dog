import {
  BufferAttribute,
  BufferGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  ConeGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Material,
  type ShaderMaterial,
  type Texture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOKE_ANIMATION } from '../config/animation';
import { MOKE_LOOK } from '../config/mokeLook';
import { clamp, lerp, smoothstep, TAU } from '../utils/math';
import { mulberry32 } from '../utils/random';
import type { MokeAnimationState } from './MokeAnimationController';
import type { MokeVisual } from './MokeVisual';
import { eyeTexture } from './toon/faceTextures';
import { tagNameTexture } from './toon/tagTexture';
import { bendAlongCurve, ellipsoidSurface, FUR_CAVITY, furClump, SMOOTH_NORMAL, type Vec3Tuple } from './toon/furGeometry';
import { createOutlineMaterial, createToonMaterial, trackOutlineResolution } from './toon/toonMaterials';

const HIP_HEIGHT = 0.172;
const NECK_HEIGHT = 0.26;
/**
 * Tail, in torso space: rooted inside the top of his rump, it rises, arches and curls forward over his back.
 * The curve is in tail space; `thickness` scales the plume along it (0 = root, 1 = tip).
 */
const TAIL = {
  root: [0, 0.25, -0.118] as Vec3Tuple,
  curve: [
    [0, -0.012, 0.01],
    [0, 0.04, -0.026],
    [0, 0.088, -0.03],
    [0, 0.118, -0.006],
    [0, 0.126, 0.03],
    [0, 0.112, 0.06],
  ] as const,
  radius: 0.034,
  halfLength: 0.09,
  thickness: (t: number) => 0.62 + 0.48 * smoothstep(0, 0.45, t) - 0.12 * smoothstep(0.8, 1, t),
};

/** Legs: side (+1 = Moke's left), position, and gait phase offsets (trot pairs diagonals, run bounds). */
const LEGS = [
  { x: 0.055, z: 0.1, trot: 0, run: 0 },
  { x: -0.055, z: 0.1, trot: Math.PI, run: 0.35 },
  { x: 0.06, z: -0.11, trot: Math.PI, run: Math.PI },
  { x: -0.06, z: -0.11, trot: 0, run: Math.PI + 0.35 },
] as const;

/** Head layout, in head space (the head pivots at the neck; +z is forward). */
const HEAD = { center: [0, 0.04, 0.01] as Vec3Tuple, radii: [0.112, 0.1, 0.1] as Vec3Tuple };
const MUZZLE = { center: [0, -0.006, 0.098] as Vec3Tuple, radii: [0.05, 0.036, 0.04] as Vec3Tuple };
/** Directions from the head (eyes) or muzzle (nose) centre to the face features. */
const FACE = {
  eye: [0.36, 0.12, 0.925] as Vec3Tuple,
  eyeSize: [0.0165, 0.0165] as const,
  nose: [0, 0.42, 0.9] as Vec3Tuple,
};
/** Around straight ahead, the face fur is shorter so his eyes stay clear; it fades back to full by `fade`. */
const FACE_CONE = { direction: new Vector3(0, -0.1, 1).normalize(), smooth: 0.62, fade: 0.95 };
const NOSE_DIR = new Vector3(...FACE.nose).normalize();
/**
 * Collar, in neck space (so it moves with his head): a nearly level loop round his neck immediately beneath the
 * round head, with his ears and side fur hanging over it. It's snug: the head fur's outer surface is measured round
 * the loop at build time and the strap sits `sink` inside it. A slight `depthPull` keeps the front edge readable
 * without drawing the side or back of the strap over the head fur.
 * The bone-shaped tag hangs from a ring at the front.
 */
const COLLAR = {
  // Follow the underside of the round head instead of rising across the back of it.
  center: [0, -0.045, -0.02] as Vec3Tuple,
  tilt: 0.08,
  /** Fur within this distance of the collar's plane is measured. */
  slab: 0.005,
  directions: 48,
  halfHeight: 0.0075,
  /** Radial half-thickness of the strap. */
  thickness: 0.003,
  /** Pull only the front arc back so it ends beneath the chin, before the muzzle begins. */
  frontInset: 0.01,
  // Sit down in the coat against the neck instead of following the outer curl tips.
  sink: 0.024,
  // Let the head fur naturally hide the side/back of the strap.
  depthPull: 0.001,
  tag: { width: 0.036, height: 0.022, depth: 0.002, ringRadius: 0.0045 },
};

interface Leg {
  pivot: Group;
  trot: number;
  run: number;
  /** +1 = Moke's left. */
  side: number;
  front: boolean;
}

const Z_AXIS = new Vector3(0, 0, 1);

/** A slightly domed disc (planar UVs), for the eyes. */
function domedDisc(bulge: number): BufferGeometry {
  const geometry = new CircleGeometry(1, 40);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const r2 = p.getX(i) ** 2 + p.getY(i) ** 2;
    p.setZ(i, bulge * (1 - r2));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Moves a geometry into place so it can be merged with other fur: drops UVs, and gives plain shapes
 * a smooth normal (their own) and no creases, to match the fur clumps.
 */
function placed(geometry: BufferGeometry, [x, y, z]: Vec3Tuple, rotationX = 0): BufferGeometry {
  if (geometry.hasAttribute('uv')) geometry.deleteAttribute('uv');
  if (rotationX) geometry.rotateX(rotationX);
  if (!geometry.hasAttribute(SMOOTH_NORMAL)) geometry.setAttribute(SMOOTH_NORMAL, geometry.getAttribute('normal').clone());
  if (!geometry.hasAttribute(FUR_CAVITY)) {
    geometry.setAttribute(FUR_CAVITY, new BufferAttribute(new Float32Array(geometry.getAttribute('position').count), 1));
  }
  return geometry.translate(x, y, z);
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error('ToonMokeVisual: fur parts could not be merged');
  return geometry;
}

/** A dog-bone outline (a narrower bar with two round lobes at each end), as overlapping shapes to extrude. */
function boneShapes(width: number, height: number): Shape[] {
  const r = height * 0.27;
  const x = width / 2 - r;
  const bar = height * 0.25;
  const shapes = [new Shape().moveTo(-x, -bar).lineTo(x, -bar).lineTo(x, bar).lineTo(-x, bar).lineTo(-x, -bar)];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) shapes.push(new Shape().absarc(sx * x, sy * (height / 2 - r), r, 0, Math.PI * 2, false));
  }
  return shapes;
}

/**
 * A flat, closed strap along a loop of points around the y axis: `halfHeight` tall (along y) and `2 × thickness`
 * thick (outward, in XZ). Returns the outward direction at each point too.
 */
function strapGeometry(loop: Vector3[], halfHeight: number, thickness: number): { geometry: BufferGeometry; outward: Vector3[] } {
  const n = loop.length;
  const positions: number[] = [];
  const indices: number[] = [];
  const outward: Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const p = loop[i]!;
    const prev = loop[(i + n - 1) % n]!;
    const next = loop[(i + 1) % n]!;
    const out = new Vector3(next.z - prev.z, 0, prev.x - next.x).normalize();
    if (out.x * p.x + out.z * p.z < 0) out.negate();
    outward.push(out);
    for (const [r, y] of [
      [thickness, halfHeight],
      [thickness, -halfHeight],
      [-thickness, -halfHeight],
      [-thickness, halfHeight],
    ] as const) {
      positions.push(p.x + out.x * r, p.y + y, p.z + out.z * r);
    }
  }
  for (let i = 0; i < n; i++) {
    const a = i * 4;
    const b = ((i + 1) % n) * 4;
    for (let k = 0; k < 4; k++) {
      const k2 = (k + 1) % 4;
      indices.push(a + k, b + k, b + k2, a + k, b + k2, a + k2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, outward };
}

/** 1 in the middle of his face, fading to 0 around it. */
function faceAmount(x: number, y: number, z: number): number {
  const { direction: d, smooth, fade } = FACE_CONE;
  return smoothstep(Math.cos(fade), Math.cos(smooth), x * d.x + y * d.y + z * d.z);
}

/**
 * Moke, modelled on the photos of the real dog and built entirely in code (no image files): a big round
 * cotton-ball head, wavy cream-tinted drop ears, a short broad muzzle with a fluffy mustache and a black
 * button nose, a compact curly body and a pom-pom tail carried high. The coat is soft rounded clumps
 * covered in small curls, shaded softly with a thin silhouette line. Dark, glossy eyes that blink.
 * Animated procedurally from MokeAnimationState. Gameplay never touches any of it (the swap point is
 * `createMokeVisual`).
 */
export class ToonMokeVisual implements MokeVisual {
  readonly object = new Group();
  readonly mouthSocket = new Object3D();

  private readonly rig = new Group();
  private readonly torso = new Group();
  private readonly body: Mesh;
  private readonly neck = new Group();
  private readonly head = new Group();
  private readonly tail = new Group();
  private readonly collar = new Group();
  private readonly tagPivot = new Group();
  private readonly mouth: Mesh;
  private readonly tongue: Mesh;
  private readonly teeth: Mesh;
  private readonly ears: { pivot: Group; side: number }[] = [];
  private readonly legs: Leg[] = [];
  private readonly eyes: Mesh[] = [];
  private readonly lids: Mesh[] = [];
  private readonly outline: ShaderMaterial | null;
  private readonly geometries = new Set<BufferGeometry>();
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  private readonly random = mulberry32(2024);
  private phase = 0;
  private untilBlink: number = MOKE_LOOK.blink.every[0];
  private blinkLeft = 0;

  constructor() {
    this.object.name = 'ToonMoke';
    const p = MOKE_LOOK.palette;
    const fur = this.material(createToonMaterial(p.furLit, p.furShade, { smoothNormals: true }));
    const earFur = this.material(createToonMaterial(p.earLit, p.earShade, { smoothNormals: true }));
    const nose = this.material(createToonMaterial(p.noseLit, p.noseShade));
    const tongue = this.material(createToonMaterial(p.tongueLit, p.tongueShade));
    const lash = this.material(new MeshBasicMaterial({ color: p.eyeRim, toneMapped: false }));
    const mouth = this.material(new MeshBasicMaterial({ color: p.mouth, toneMapped: false }));
    const teeth = this.material(new MeshBasicMaterial({ color: p.teeth, toneMapped: false }));
    const sparkle = this.material(new MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
    this.outline = MOKE_LOOK.outline.enabled ? this.material(createOutlineMaterial()) : null;

    // Shift the body back a little so the nose pokes less past the round collision capsule.
    this.rig.position.z = -0.04;
    this.object.add(this.rig);
    this.rig.add(this.torso);

    // Body: compact and covered in tight curls, with a fluffier chest.
    this.body = this.fur(
      this.torso,
      merged([
        placed(
          furClump({
            radii: [0.092, 0.086, 0.132],
            detail: 18,
            seed: 1,
            tufts: 30,
            length: 0.08,
            width: 0.6,
            sharpness: 0,
            flow: [0, -0.5, -1],
            flowAmount: 0.15,
            curls: { count: 200, length: 0.07, width: 0.22 },
          }),
          [0, 0.21, -0.01],
        ),
        placed(
          furClump({
            radii: [0.074, 0.072, 0.058],
            detail: 12,
            seed: 2,
            tufts: 16,
            length: 0.18,
            width: 0.6,
            sharpness: 0.1,
            flow: [0, -1, 0.25],
            flowAmount: 0.4,
            curls: { count: 60, length: 0.1, width: 0.3 },
          }),
          [0, 0.198, 0.112],
        ),
      ]),
      fur,
    );
    this.body.name = 'body';

    // Legs pivot at the hip so they can swing: curly columns ending in round, fur-covered paws.
    const legGeometry = merged([
      placed(
        furClump({
          radii: [0.032, 0.07, 0.034],
          detail: 10,
          seed: 12,
          tufts: 12,
          length: 0.14,
          width: 0.75,
          sharpness: 0,
          flow: [0, -1, 0],
          flowAmount: 0.2,
          curls: { count: 50, length: 0.1, width: 0.35 },
        }),
        [0, -0.07, 0],
      ),
      placed(
        furClump({ radii: [0.034, 0.022, 0.04], detail: 8, seed: 13, tufts: 10, length: 0.06, width: 0.8, sharpness: 0, curls: { count: 24, length: 0.1, width: 0.45 } }),
        [0, -0.15, 0.01],
      ),
    ]);
    for (const def of LEGS) {
      const pivot = new Group();
      pivot.position.set(def.x, HIP_HEIGHT, def.z);
      this.fur(pivot, legGeometry, fur);
      this.rig.add(pivot);
      this.legs.push({ pivot, trot: def.trot, run: def.run, side: Math.sign(def.x), front: def.z > 0 });
    }

    // Head: one round cotton-ball dome (fluffiest on top), with a short, broad muzzle and a fluffy mustache.
    this.neck.position.set(0, NECK_HEIGHT, 0.13);
    this.torso.add(this.neck);
    this.neck.add(this.head);
    const headFur = this.fur(
      this.head,
      merged([
        placed(
          furClump({
            radii: HEAD.radii,
            detail: 22,
            seed: 4,
            tufts: 40,
            length: 0.12,
            width: 0.55,
            sharpness: 0.1,
            flow: [0, -1, -0.2],
            flowAmount: 0.25,
            shape: (x, y, z) => (1 - 0.85 * faceAmount(x, y, z)) * (1 + 0.6 * Math.max(0, y) ** 2),
            curls: { count: 260, length: 0.075, width: 0.24, shape: (x, y, z) => 1 - 0.6 * faceAmount(x, y, z) },
          }),
          HEAD.center,
        ),
        placed(
          furClump({
            radii: MUZZLE.radii,
            detail: 12,
            seed: 5,
            tufts: 22,
            length: 0.3,
            width: 0.55,
            sharpness: 0.1,
            flow: [0, -1, 0.3],
            flowAmount: 0.35,
            // Fluffiest underneath (the beard), and short around the nose so it shows.
            shape: (x, y, z) =>
              (0.6 + 0.8 * clamp(-y, 0, 1)) * (1 - 0.85 * smoothstep(0.8, 0.95, x * NOSE_DIR.x + y * NOSE_DIR.y + z * NOSE_DIR.z)),
            curls: { count: 70, length: 0.12, width: 0.3 },
          }),
          MUZZLE.center,
        ),
      ]),
      fur,
    );

    // Eyes: round, dark and glossy, peeking out of the fluff. A closed eye is a short dark lash line.
    const eyeMap = this.texture(eyeTexture());
    const eyeMaterial = this.material(
      eyeMap
        ? new MeshBasicMaterial({ map: eyeMap, toneMapped: false })
        : new MeshBasicMaterial({ color: p.irisDark, toneMapped: false }),
    );
    const eyeDisc = this.geometry(domedDisc(0.3));
    const [eyeW, eyeH] = FACE.eyeSize;
    const closedEyeGeometry = new TubeGeometry(
      new CatmullRomCurve3(
        [-1, -0.5, 0, 0.5, 1].map((t) => new Vector3(t * eyeW * 1.05, eyeH * (0.05 - 0.25 * (1 - t * t)), 0.0055)),
      ),
      16,
      0.0012,
      6,
    );
    for (const side of [1, -1]) {
      const eye = this.decal(eyeDisc, eyeMaterial, HEAD, [side * FACE.eye[0], FACE.eye[1], FACE.eye[2]], FACE.eyeSize, 0.003);
      eye.name = 'eye';
      this.eyes.push(eye);
      const lid = this.part(this.head, closedEyeGeometry, lash, eye.position.toArray());
      lid.quaternion.copy(eye.quaternion);
      lid.castShadow = false;
      lid.name = 'eyeShut';
      lid.visible = false;
      this.lids.push(lid);
    }

    // A glossy black button nose, a little wider than tall, with a highlight.
    const noseAt = ellipsoidSurface(MUZZLE.radii, FACE.nose);
    const noseCenter = noseAt.point.add(new Vector3(...MUZZLE.center)).addScaledVector(noseAt.normal, 0.006);
    const noseMesh = this.part(this.head, this.geometry(new SphereGeometry(0.0135, 20, 14)), nose, noseCenter.toArray(), [1.35, 1, 0.95]);
    noseMesh.rotation.x = -0.3;
    this.part(this.head, this.geometry(new SphereGeometry(0.003, 10, 8)), sparkle, [-0.006, noseCenter.y + 0.006, noseCenter.z + 0.009], [1.5, 0.8, 1]).castShadow = false;

    // Mouth: hidden in the mustache until he barks or pants (dark lips, pink tongue).
    const [, my, mz] = MUZZLE.center;
    const mouthY = noseCenter.y - 0.026;
    const mouthZ = mz + MUZZLE.radii[2] * Math.sqrt(Math.max(0, 1 - ((mouthY - my) / MUZZLE.radii[1]) ** 2));
    this.mouth = this.part(this.head, this.geometry(new SphereGeometry(1, 16, 12)), mouth, [0, mouthY, mouthZ], [0.014, 0.01, 0.008]);
    this.mouth.name = 'mouthOpen';
    this.mouth.castShadow = false;
    this.mouth.visible = false;
    this.tongue = this.part(this.head, this.geometry(new SphereGeometry(1, 16, 10)), tongue, [0, mouthY - 0.007, mouthZ + 0.003], [0.009, 0.004, 0.012]);
    this.tongue.visible = false;
    const tooth = (x: number, y: number, upsideDown: boolean): BufferGeometry => {
      const geometry = new ConeGeometry(0.0027, 0.007, 8);
      if (upsideDown) geometry.rotateZ(Math.PI);
      return placed(geometry, [x, y, mouthZ + 0.009]);
    };
    this.teeth = this.part(
      this.head,
      this.geometry(merged([
        tooth(-0.006, mouthY + 0.004, true),
        tooth(0.006, mouthY + 0.004, true),
        tooth(-0.004, mouthY - 0.004, false),
        tooth(0.004, mouthY - 0.004, false),
      ])),
      teeth,
      [0, 0, 0],
    );
    this.teeth.name = 'growlTeeth';
    this.teeth.castShadow = false;
    this.teeth.visible = false;
    this.mouthSocket.position.set(0, mouthY, 0.15);
    this.head.add(this.mouthSocket);

    // Ears: short, wavy, cream-tinted drop ears hanging close to his cheeks, down to about his mouth.
    for (const side of [1, -1]) {
      const pivot = new Group();
      pivot.position.set(side * 0.082, 0.085, -0.005);
      this.fur(
        pivot,
        placed(
          furClump({
            radii: [0.046, 0.068, 0.054],
            detail: 14,
            seed: 7 + side,
            tufts: 18,
            length: 0.2,
            width: 0.6,
            sharpness: 0,
            flow: [side * 0.4, -1, 0],
            flowAmount: 0.3,
            // Wavy curls, fuller toward the bottom where the ear flares out.
            shape: (_x, y) => 0.6 + 0.6 * clamp(-y, 0, 1),
            curls: { count: 130, length: 0.15, width: 0.27 },
          }),
          [side * 0.018, -0.048, 0],
        ),
        earFur,
      );
      this.head.add(pivot);
      this.ears.push({ pivot, side });
    }

    // Collar: a blue strap snug in the fluff around his neck, with a navy bone-shaped tag on a silver ring.
    const look = MOKE_LOOK.collar;
    const strap = this.material(createToonMaterial(look.lit, look.shade, { depthPull: COLLAR.depthPull }));
    const tagMetal = this.material(createToonMaterial(look.tagLit, look.tagShade));
    const ringMetal = this.material(createToonMaterial(look.ringLit, look.ringShade));
    strap.side = DoubleSide;
    this.collar.position.set(...COLLAR.center);
    this.collar.rotation.x = COLLAR.tilt;
    this.neck.add(this.collar);
    const loop = this.measureNeck([headFur]);
    const { geometry: strapShape, outward } = strapGeometry(loop, COLLAR.halfHeight, COLLAR.thickness);
    const band = this.part(this.collar, this.geometry(strapShape), strap, [0, 0, 0]);
    band.name = 'collar';
    band.castShadow = false;
    const { width: tagW, height: tagH, depth: tagD, ringRadius } = COLLAR.tag;
    // Attach the ring to the outside face of the strap; do not push it beyond the collar loop.
    const front = loop[0]!.clone().addScaledVector(outward[0]!, COLLAR.thickness);
    this.tagPivot.position.set(front.x, front.y - COLLAR.halfHeight * 0.5, front.z);
    this.collar.add(this.tagPivot);
    // A small D-ring on the strap and the split ring the tag hangs from.
    this.part(this.tagPivot, this.geometry(new TorusGeometry(ringRadius, 0.0011, 6, 20)), ringMetal, [0, -ringRadius * 0.6, 0]);
    const tagTop = -ringRadius * 1.9;
    const tagBody = new ExtrudeGeometry(boneShapes(tagW, tagH), { depth: tagD, bevelEnabled: false, curveSegments: 12 });
    tagBody.translate(0, tagTop - tagH / 2, -tagD / 2);
    this.part(this.tagPivot, this.geometry(tagBody), tagMetal, [0, 0, 0]).name = 'tag';
    const nameMap = this.texture(tagNameTexture());
    if (nameMap) {
      const nameMaterial = this.material(
        new MeshBasicMaterial({
          map: nameMap,
          transparent: true,
          depthWrite: false,
          toneMapped: false,
          side: DoubleSide,
          polygonOffset: true,
          polygonOffsetFactor: -2,
        }),
      );
      const name = this.part(this.tagPivot, this.geometry(new PlaneGeometry(tagW * 0.8, tagW * 0.4)), nameMaterial, [0, tagTop - tagH / 2, tagD / 2 + 0.0002]);
      name.name = 'tagName';
      name.castShadow = false;
      name.renderOrder = 1;
    }

    // Tail: one long, curly plume rooted inside his rump, rising and curling forward over his back like the real
    // Moke's. A single bent mesh, so it can't come apart from his body.
    this.tail.position.set(...TAIL.root);
    this.torso.add(this.tail);
    const tailFur = furClump({
      radii: [TAIL.radius, TAIL.halfLength, TAIL.radius],
      detail: 12,
      seed: 11,
      tufts: 26,
      length: 0.3,
      width: 0.55,
      sharpness: 0.15,
      // Fur grows toward the tip.
      flow: [0, 1, 0],
      flowAmount: 0.35,
      // Neater at the root, fullest along the arch.
      shape: (_x, y) => 0.45 + 0.55 * smoothstep(-0.9, 0.1, y),
      curls: { count: 110, length: 0.14, width: 0.28 },
    });
    this.fur(this.tail, bendAlongCurve(tailFur, TAIL.halfLength, TAIL.curve, TAIL.thickness), fur).name = 'tail';
  }

  update(dt: number, s: Readonly<MokeAnimationState>): void {
    const moving = clamp(s.speed / 0.35, 0, 1);

    // Gait cycle: stride length grows with speed, so little legs patter at a walk and reach at a run.
    const stride = lerp(0.2, 0.55, clamp(s.speed / 4, 0, 1));
    this.phase = (this.phase + (s.speed / stride) * dt) % 1;
    const p = this.phase * TAU;
    const swing = clamp(s.speed * 0.3, 0, 0.7) * (1 - s.rest);
    for (const leg of this.legs) {
      const a = p + lerp(leg.trot, leg.run, s.runBlend);
      // Lying: a sphinx pose, front paws stretched forward, hind legs tucked alongside.
      leg.pivot.rotation.x = swing * Math.sin(a) - s.rest * (leg.front ? 1.35 : 1.15);
      leg.pivot.rotation.z = s.rest * (leg.front ? 0 : leg.side * 0.35);
      // Lift the paw while it swings forward, so feet step instead of sliding.
      leg.pivot.position.y = HIP_HEIGHT + Math.max(0, -Math.cos(a)) * 0.022 * moving;
    }

    const bob = moving * (0.006 + 0.012 * s.runBlend) * Math.abs(Math.sin(p));
    this.torso.position.y = bob;
    this.torso.rotation.x = s.runBlend * 0.09 * Math.sin(p + 0.8);
    this.body.scale.y = 1 + (1 - moving) * 0.02 * Math.sin(s.time * 2.6); // breathing

    this.rig.rotation.z = -s.lean;
    // A bark is a little hop; a growl plants him low and pushes his chest forward.
    this.rig.position.y = -s.crouch * 0.03 + s.bark * 0.018 - s.growl * 0.008 - s.rest * 0.105;
    this.rig.rotation.x = -s.bark * 0.08 + s.growl * 0.045;

    this.neck.position.y = NECK_HEIGHT - s.crouch * 0.05 - bob * 0.5 - s.rest * 0.03;
    const a = MOKE_ANIMATION;
    // Sniffing: nose down with quick little twitches.
    const twitch = s.sniff * 0.05 * Math.sin(s.time * 26) * (0.5 + 0.5 * Math.sin(s.time * 3.1));
    this.neck.rotation.x =
      s.crouch * 0.3 + moving * 0.06 + s.runBlend * 0.1 - s.carry * a.carryHeadLift + s.sniff * a.sniffHeadDip + twitch - s.bark * 0.35 + s.growl * 0.16 + s.rest * 0.22;
    this.head.rotation.y = s.headYaw * (1 - 0.5 * s.sniff) + s.sniff * 0.25 * Math.sin(s.time * 1.7);
    this.head.rotation.z = -s.headTilt + s.growl * 0.018 * Math.sin(s.time * 28);

    const flop = moving * 0.1 * Math.sin(2 * p + 1.2);
    for (const ear of this.ears) {
      // Drop ears: they bounce and sweep back at speed rather than sticking out sideways.
      ear.pivot.rotation.z = ear.side * (0.12 + flop + s.runBlend * 0.15 - s.bark * 0.25 - s.sniff * 0.08 - s.growl * 0.16);
      ear.pivot.rotation.x = s.runBlend * 0.6 - s.bark * 0.3 - s.growl * 0.38;
    }

    // The tag hangs down whatever his head does, and jingles a little as he trots.
    this.tagPivot.rotation.x = -COLLAR.tilt - this.neck.rotation.x - this.torso.rotation.x + moving * 0.18 * Math.sin(2 * p) + s.bark * 0.4;
    this.tagPivot.rotation.z = moving * 0.12 * Math.sin(p + 0.6);

    const wag = (0.15 + 0.4 * s.tailWag) * Math.sin(s.time * lerp(9, 16, s.tailWag));
    this.tail.rotation.z = wag;
    // Swept back at a run, lying flat in bed, and tucked lower while ducking under furniture.
    this.tail.rotation.x = -s.runBlend * 0.9 - s.rest * 1.1 - s.crouch * 1.2;

    // Eyes: idle blinks; closed while resting, a little squint while sniffing or barking.
    const eyeOpen = (1 - this.blink(dt)) * (1 - 0.9 * s.rest) * (1 - 0.35 * s.sniff) * (1 - 0.4 * s.bark) * (1 - 0.5 * s.growl);
    const shut = eyeOpen < 0.3;
    for (const eye of this.eyes) {
      eye.visible = !shut;
      eye.scale.y = FACE.eyeSize[1] * eyeOpen;
    }
    for (const lid of this.lids) lid.visible = shut;

    // A growl reveals four tiny teeth; bark/panting shows the tongue instead.
    const open = s.carry < 0.5 ? Math.max(s.bark, s.growl * 0.72, s.runBlend > 0.25 ? 0.7 : 0) : 0;
    this.mouth.visible = open > 0.05;
    this.tongue.visible = open > 0.05 && s.growl < 0.2;
    this.teeth.visible = s.carry < 0.5 && s.growl > 0.05;
    this.mouth.scale.y = 0.004 + 0.008 * open;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.object.removeFromParent();
  }

  /** 0 = eyes open, 1 = shut, during an idle blink. */
  private blink(dt: number): number {
    const { every, duration } = MOKE_LOOK.blink;
    this.untilBlink -= dt;
    if (this.untilBlink <= 0) {
      this.untilBlink = every[0] + this.random() * every[1];
      this.blinkLeft = duration;
    }
    if (this.blinkLeft <= 0) return 0;
    this.blinkLeft -= dt;
    return Math.sin(Math.PI * clamp(1 - this.blinkLeft / duration, 0, 1));
  }

  /**
   * The head fur's outer surface round the collar, measured in the build pose: every nearby fur vertex
   * near the collar's plane is binned by direction, keeping the outermost per direction (and its neighbours, so
   * sparse bins don't mislead). Smoothed round the loop, then the strap sits `sink` inside it.
   * Points are in collar space, starting straight ahead (+z) and going round.
   */
  private measureNeck(fur: Mesh[]): Vector3[] {
    this.object.updateMatrixWorld(true);
    const { directions, slab, sink, thickness, frontInset } = COLLAR;
    const outer = new Float32Array(directions);
    const toCollar = new Matrix4();
    const fromWorld = this.collar.matrixWorld.clone().invert();
    const v = new Vector3();
    for (const mesh of fur) {
      toCollar.multiplyMatrices(fromWorld, mesh.matrixWorld);
      const positions = mesh.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) {
        v.fromBufferAttribute(positions, i).applyMatrix4(toCollar);
        if (Math.abs(v.y) > slab) continue;
        const col = (Math.round((Math.atan2(v.x, v.z) / TAU) * directions) + directions) % directions;
        outer[col] = Math.max(outer[col]!, Math.hypot(v.x, v.z));
      }
    }
    const surface = Array.from(outer, (_, c) =>
      Math.max(outer[(c + directions - 1) % directions]!, outer[c]!, outer[(c + 1) % directions]!),
    );
    return surface.map((_, i) => {
      let sum = 0;
      let count = 0;
      for (let k = -2; k <= 2; k++) {
        const value = surface[(i + k + directions) % directions]!;
        if (value > 0) {
          sum += value;
          count++;
        }
      }
      const angle = (i / directions) * TAU;
      const towardFront = Math.max(0, Math.cos(angle));
      const r = (count ? sum / count : 0.08) - sink + thickness - frontInset * towardFront * towardFront;
      return new Vector3(Math.sin(angle) * r, 0, Math.cos(angle) * r);
    });
  }

  /** A fur mesh, with its silhouette line when outlines are on. */
  private fur(parent: Object3D, geometry: BufferGeometry, material: Material): Mesh {
    const mesh = this.part(parent, geometry, material, [0, 0, 0]);
    if (this.outline) {
      const hull = new Mesh(geometry, this.outline);
      hull.castShadow = false;
      hull.receiveShadow = false;
      trackOutlineResolution(hull, this.outline);
      mesh.add(hull);
    }
    return mesh;
  }

  /** A disc lying on one of the head's ellipsoids, facing out along the surface. */
  private decal(
    geometry: BufferGeometry,
    material: Material,
    on: { center: Vec3Tuple; radii: Vec3Tuple },
    direction: Vec3Tuple,
    [width, height]: readonly [number, number],
    lift: number,
  ): Mesh {
    const { point, normal } = ellipsoidSurface(on.radii, direction);
    point.add(new Vector3(...on.center)).addScaledVector(normal, lift);
    const mesh = this.part(this.head, geometry, material, point.toArray(), [width, height, Math.min(width, height)]);
    mesh.quaternion.copy(new Quaternion().setFromUnitVectors(Z_AXIS, normal));
    mesh.castShadow = false;
    return mesh;
  }

  private part(
    parent: Object3D,
    geometry: BufferGeometry,
    material: Material,
    position: readonly [number, number, number] | number[],
    scale: readonly [number, number, number] = [1, 1, 1],
  ): Mesh {
    this.geometries.add(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(position[0]!, position[1]!, position[2]!);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.add(geometry);
    return geometry;
  }

  private material<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }

  private texture(texture: Texture | null): Texture | null {
    if (texture) this.textures.push(texture);
    return texture;
  }
}
