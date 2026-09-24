import {
  CapsuleGeometry,
  CatmullRomCurve3,
  CircleGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Quaternion,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
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
import { blushTexture, eyeTexture } from './toon/faceTextures';
import { ellipsoidSurface, furClump, SMOOTH_NORMAL, type Vec3Tuple } from './toon/furGeometry';
import { createOutlineMaterial, createToonMaterial, trackOutlineResolution } from './toon/toonMaterials';

const HIP_HEIGHT = 0.172;
const NECK_HEIGHT = 0.26;
/** Legs: side (+1 = Moke's left), position, and gait phase offsets (trot pairs diagonals, run bounds). */
const LEGS = [
  { x: 0.055, z: 0.1, trot: 0, run: 0 },
  { x: -0.055, z: 0.1, trot: Math.PI, run: 0.35 },
  { x: 0.06, z: -0.11, trot: Math.PI, run: Math.PI },
  { x: -0.06, z: -0.11, trot: 0, run: Math.PI + 0.35 },
] as const;

/** Head layout, in head space (the head pivots at the neck; +z is forward). */
const HEAD = { center: [0, 0.042, 0.01] as Vec3Tuple, radii: [0.118, 0.104, 0.104] as Vec3Tuple };
const MUZZLE = { center: [0, -0.004, 0.1] as Vec3Tuple, radii: [0.046, 0.034, 0.036] as Vec3Tuple };
/** Directions from the head centre to face features (on the smooth face). */
const FACE = {
  eye: [0.34, 0.14, 0.93] as Vec3Tuple,
  eyeSize: [0.021, 0.024] as const,
  blush: [0.56, -0.12, 0.82] as Vec3Tuple,
  blushSize: [0.021, 0.012] as const,
  /** On the muzzle. */
  nose: [0, 0.5, 0.87] as Vec3Tuple,
};
/** The face stays smooth (no tufts) within this cone around straight ahead, fading out by `fade`. */
const FACE_CONE = { direction: new Vector3(0, -0.1, 1).normalize(), smooth: 0.62, fade: 0.95 };

interface Leg {
  pivot: Group;
  trot: number;
  run: number;
  /** +1 = Moke's left. */
  side: number;
  front: boolean;
}

const Z_AXIS = new Vector3(0, 0, 1);

/** A slightly domed disc (planar UVs), for decals that sit on the face: eyes and blush. */
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
 * a smooth normal (their own) to match the fur clumps.
 */
function placed(geometry: BufferGeometry, [x, y, z]: Vec3Tuple, rotationX = 0): BufferGeometry {
  if (geometry.hasAttribute('uv')) geometry.deleteAttribute('uv');
  if (rotationX) geometry.rotateX(rotationX);
  if (!geometry.hasAttribute(SMOOTH_NORMAL)) geometry.setAttribute(SMOOTH_NORMAL, geometry.getAttribute('normal').clone());
  return geometry.translate(x, y, z);
}

function merged(parts: BufferGeometry[]): BufferGeometry {
  const geometry = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!geometry) throw new Error('ToonMokeVisual: fur parts could not be merged');
  return geometry;
}

/** Height on the muzzle's front surface at (x, y), in head space. */
function muzzleZ(x: number, y: number): number {
  const [cx, cy, cz] = MUZZLE.center;
  const [rx, ry, rz] = MUZZLE.radii;
  return cz + rz * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2 - ((y - cy) / ry) ** 2));
}

/**
 * Moke in an anime-film style, built entirely in code (no image files): a big round cotton-ball head
 * with long wavy ear curtains, a fluffy chest, a neat curly body and a plume tail, all made of soft
 * pointed fur tufts; cel shading with lavender shadows and ink outlines; big glossy brown eyes that
 * blink, pink blush, a black button nose and a little "w" smile. Animated procedurally from
 * MokeAnimationState. Gameplay never touches any of it (the swap point is `createMokeVisual`).
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
  private readonly smile: Mesh;
  private readonly mouth: Mesh;
  private readonly tongue: Mesh;
  private readonly ears: { pivot: Group; side: number }[] = [];
  private readonly legs: Leg[] = [];
  private readonly eyes: Mesh[] = [];
  private readonly lids: Mesh[] = [];
  private readonly outline: ShaderMaterial;
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
    const ink = this.material(new MeshBasicMaterial({ color: p.line, toneMapped: false }));
    const mouth = this.material(new MeshBasicMaterial({ color: p.mouth, toneMapped: false }));
    const sparkle = this.material(new MeshBasicMaterial({ color: '#ffffff', toneMapped: false }));
    this.outline = this.material(createOutlineMaterial());

    // Shift the body back a little so the nose pokes less past the round collision capsule.
    this.rig.position.z = -0.04;
    this.object.add(this.rig);
    this.rig.add(this.torso);

    // Body: a neat, curly torso with a big fluffy chest bib.
    this.body = this.fur(
      this.torso,
      merged([
        placed(
          furClump({ radii: [0.094, 0.088, 0.134], detail: 16, seed: 1, tufts: 40, length: 0.12, width: 0.55, sharpness: 0.35, flow: [0, -0.5, -1], flowAmount: 0.4 }),
          [0, 0.21, -0.01],
        ),
        placed(
          furClump({ radii: [0.076, 0.074, 0.06], detail: 12, seed: 2, tufts: 18, length: 0.28, width: 0.6, sharpness: 0.55, flow: [0, -1, 0.25], flowAmount: 0.6 }),
          [0, 0.198, 0.112],
        ),
      ]),
      fur,
    );

    // Legs pivot at the hip so they can swing; fluffy columns ending in round, fur-covered paws.
    const legGeometry = merged([
      placed(furClump({ radii: [0.036, 0.07, 0.038], detail: 9, seed: 12, tufts: 12, length: 0.22, width: 0.75, sharpness: 0.4, flow: [0, -1, 0], flowAmount: 0.5 }), [0, -0.07, 0]),
      placed(furClump({ radii: [0.034, 0.022, 0.04], detail: 7, seed: 13, tufts: 10, length: 0.07, width: 0.8, sharpness: 0.2 }), [0, -0.15, 0.01]),
    ]);
    for (const def of LEGS) {
      const pivot = new Group();
      pivot.position.set(def.x, HIP_HEIGHT, def.z);
      this.fur(pivot, legGeometry, fur);
      this.rig.add(pivot);
      this.legs.push({ pivot, trot: def.trot, run: def.run, side: Math.sign(def.x), front: def.z > 0 });
    }

    // Head: one round cotton-ball dome with a fluffy crown, a smooth face and a short, bearded muzzle.
    this.neck.position.set(0, NECK_HEIGHT, 0.13);
    this.torso.add(this.neck);
    this.neck.add(this.head);
    const { direction: faceDir, smooth, fade } = FACE_CONE;
    this.fur(
      this.head,
      merged([
        placed(
          furClump({
            radii: HEAD.radii,
            detail: 20,
            seed: 4,
            tufts: 60,
            length: 0.15,
            width: 0.5,
            sharpness: 0.45,
            flow: [0, -1, -0.25],
            flowAmount: 0.55,
            shape: (x, y, z) => {
              const face = smoothstep(Math.cos(fade), Math.cos(smooth), x * faceDir.x + y * faceDir.y + z * faceDir.z);
              return (1 - 0.95 * face) * (1 + 0.8 * Math.max(0, y) ** 2);
            },
          }),
          HEAD.center,
        ),
        placed(
          furClump({
            radii: MUZZLE.radii,
            detail: 10,
            seed: 5,
            tufts: 16,
            length: 0.4,
            width: 0.6,
            sharpness: 0.6,
            flow: [0, -1, 0.2],
            flowAmount: 0.4,
            shape: (_x, y) => clamp((-y - 0.15) / 0.45, 0, 1), // a little beard, only underneath
          }),
          MUZZLE.center,
        ),
      ]),
      fur,
    );

    // Face: big glossy eyes, blush, button nose and a "w" smile, all sitting on the smooth face.
    const eyeMap = this.texture(eyeTexture());
    const eyeMaterial = this.material(
      eyeMap
        ? new MeshBasicMaterial({ map: eyeMap, toneMapped: false })
        : new MeshBasicMaterial({ color: p.irisDark, toneMapped: false }),
    );
    const blushMap = this.texture(blushTexture());
    const blush = this.material(
      new MeshBasicMaterial({
        map: blushMap,
        color: blushMap ? '#ffffff' : p.blush,
        transparent: true,
        opacity: blushMap ? 0.85 : 0.4,
        depthWrite: false,
        toneMapped: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    const eyeDisc = this.geometry(domedDisc(0.25));
    const [eyeW, eyeH] = FACE.eyeSize;
    const closedEyeGeometry = new TubeGeometry(
      new CatmullRomCurve3(
        [-1, -0.5, 0, 0.5, 1].map((t) => new Vector3(t * eyeW * 0.95, eyeH * (0.15 - 0.4 * (1 - t * t)), 0.0055)),
      ),
      20,
      0.0017,
      6,
    );
    const blushDisc = this.geometry(domedDisc(0.1));
    for (const side of [1, -1]) {
      const eye = this.decal(eyeDisc, eyeMaterial, HEAD, [side * FACE.eye[0], FACE.eye[1], FACE.eye[2]], FACE.eyeSize, 0.0015);
      eye.name = 'eye';
      this.eyes.push(eye);
      // Shut eyes are a soft ink curve (‿): for blinks and for dozing in his bed.
      const lid = this.part(this.head, closedEyeGeometry, ink, eye.position.toArray());
      lid.quaternion.copy(eye.quaternion);
      lid.castShadow = false;
      lid.name = 'eyeShut';
      lid.visible = false;
      this.lids.push(lid);
      this.decal(blushDisc, blush, HEAD, [side * FACE.blush[0], FACE.blush[1], FACE.blush[2]], FACE.blushSize, 0.0012).renderOrder = 1;
    }

    const noseAt = ellipsoidSurface(MUZZLE.radii, FACE.nose);
    const noseCenter = noseAt.point.add(new Vector3(...MUZZLE.center)).addScaledVector(noseAt.normal, 0.004);
    const noseMesh = this.part(this.head, this.geometry(new SphereGeometry(0.0118, 20, 14)), nose, noseCenter.toArray(), [1.45, 1, 0.9]);
    noseMesh.rotation.x = -0.35;
    this.part(this.head, this.geometry(new SphereGeometry(0.0032, 10, 8)), sparkle, [-0.005, noseCenter.y + 0.005, noseCenter.z + 0.008], [1.4, 0.8, 1]).castShadow = false;

    // The "w" smile: a short line down from the nose, then two little curves.
    const noseBottom = noseCenter.y - 0.011;
    const onMuzzle = (x: number, y: number) => new Vector3(x, y, muzzleZ(x, y) + 0.0012);
    const smileY = noseBottom - 0.009;
    const philtrum = new CatmullRomCurve3([onMuzzle(0, noseBottom + 0.002), onMuzzle(0, smileY)]);
    const smile = new CatmullRomCurve3(
      [
        [-0.017, 0.004],
        [-0.0115, -0.0025],
        [-0.005, -0.0035],
        [0, 0],
        [0.005, -0.0035],
        [0.0115, -0.0025],
        [0.017, 0.004],
      ].map(([x, y]) => onMuzzle(x!, smileY + y!)),
    );
    this.smile = this.part(
      this.head,
      merged([new TubeGeometry(philtrum, 4, 0.0011, 6), new TubeGeometry(smile, 40, 0.0011, 6)].map((g) => placed(g, [0, 0, 0]))),
      ink,
      [0, 0, 0],
    );
    this.smile.name = 'smile';
    this.smile.castShadow = false;

    // Open mouth (bark, panting) with a pink tongue.
    const mouthY = smileY - 0.002;
    this.mouth = this.part(this.head, this.geometry(new SphereGeometry(1, 16, 12)), mouth, [0, mouthY, muzzleZ(0, mouthY) - 0.003], [0.013, 0.01, 0.006]);
    this.mouth.name = 'mouthOpen';
    this.mouth.castShadow = false;
    this.mouth.visible = false;
    this.tongue = this.part(this.head, this.geometry(new SphereGeometry(1, 16, 10)), tongue, [0, mouthY - 0.007, muzzleZ(0, mouthY) + 0.001], [0.0085, 0.004, 0.011]);
    this.tongue.visible = false;
    this.mouthSocket.position.set(0, mouthY, 0.15);
    this.head.add(this.mouthSocket);

    // Ears: long, wavy curtains hanging from the crown to below the jaw, flaring out a little at the bottom.
    for (const side of [1, -1]) {
      const pivot = new Group();
      pivot.position.set(side * 0.08, 0.09, -0.005);
      this.fur(
        pivot,
        placed(
          furClump({
            radii: [0.04, 0.096, 0.052],
            detail: 13,
            seed: 7 + side,
            tufts: 24,
            length: 0.22,
            width: 0.62,
            sharpness: 0.6,
            flow: [side * 0.45, -1, -0.15],
            flowAmount: 0.7,
          }),
          [side * 0.012, -0.078, 0],
        ),
        earFur,
      );
      this.head.add(pivot);
      this.ears.push({ pivot, side });
    }

    // Tail: a flame-like plume carried high, curling forward over the back.
    this.tail.position.set(0, 0.28, -0.155);
    this.torso.add(this.tail);
    this.fur(
      this.tail,
      merged([
        placed(new CapsuleGeometry(0.018, 0.045, 4, 8), [0, 0.028, -0.01], -0.5),
        placed(
          furClump({ radii: [0.044, 0.06, 0.046], detail: 11, seed: 11, tufts: 18, length: 0.3, width: 0.65, sharpness: 0.65, flow: [0, 0.6, -1], flowAmount: 0.8 }),
          [0, 0.068, -0.012],
        ),
      ]),
      fur,
    );
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
    // A bark is a little hop from the front paws; lying lowers him onto his tummy.
    this.rig.position.y = -s.crouch * 0.03 + s.bark * 0.018 - s.rest * 0.105;
    this.rig.rotation.x = -s.bark * 0.08;

    this.neck.position.y = NECK_HEIGHT - s.crouch * 0.05 - bob * 0.5 - s.rest * 0.03;
    const a = MOKE_ANIMATION;
    // Sniffing: nose down with quick little twitches.
    const twitch = s.sniff * 0.05 * Math.sin(s.time * 26) * (0.5 + 0.5 * Math.sin(s.time * 3.1));
    this.neck.rotation.x =
      s.crouch * 0.3 + moving * 0.06 + s.runBlend * 0.1 - s.carry * a.carryHeadLift + s.sniff * a.sniffHeadDip + twitch - s.bark * 0.35 + s.rest * 0.22;
    this.head.rotation.y = s.headYaw * (1 - 0.5 * s.sniff) + s.sniff * 0.25 * Math.sin(s.time * 1.7);
    this.head.rotation.z = -s.headTilt;

    const flop = moving * 0.1 * Math.sin(2 * p + 1.2);
    for (const ear of this.ears) {
      // Drop ears: they bounce and sweep back at speed rather than sticking out sideways.
      ear.pivot.rotation.z = ear.side * (0.1 + flop + s.runBlend * 0.15 - s.bark * 0.25 - s.sniff * 0.08);
      ear.pivot.rotation.x = s.runBlend * 0.6 - s.bark * 0.3;
    }

    const wag = (0.15 + 0.4 * s.tailWag) * Math.sin(s.time * lerp(9, 16, s.tailWag));
    this.tail.rotation.z = wag;
    // Swept back at a run, lying flat in bed, and tucked lower while ducking under furniture.
    this.tail.rotation.x = 0.35 - s.runBlend * 0.9 - s.rest * 1.1 - s.crouch * 1.2;

    // Eyes: idle blinks; closed and content while resting, a little squint while sniffing or barking.
    const eyeOpen = (1 - this.blink(dt)) * (1 - 0.9 * s.rest) * (1 - 0.35 * s.sniff) * (1 - 0.4 * s.bark);
    const shut = eyeOpen < 0.3;
    for (const eye of this.eyes) {
      eye.visible = !shut;
      eye.scale.y = FACE.eyeSize[1] * eyeOpen;
    }
    for (const lid of this.lids) lid.visible = shut;

    // Mouth open for a bark (tongue out), or panting at a run; closed on a carried item.
    const open = s.carry < 0.5 ? Math.max(s.bark, s.runBlend > 0.25 ? 0.7 : 0) : 0;
    this.mouth.visible = this.tongue.visible = open > 0.05;
    this.smile.visible = !this.mouth.visible;
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

  /** A fur mesh with its ink outline. */
  private fur(parent: Object3D, geometry: BufferGeometry, material: Material): Mesh {
    const mesh = this.part(parent, geometry, material, [0, 0, 0]);
    const hull = new Mesh(geometry, this.outline);
    hull.castShadow = false;
    hull.receiveShadow = false;
    trackOutlineResolution(hull, this.outline);
    mesh.add(hull);
    return mesh;
  }

  /** A disc lying on one of the head's smooth ellipsoids, facing out along the surface. */
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
