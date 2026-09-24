import {
  CapsuleGeometry,
  Group,
  IcosahedronGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { MOKE_ANIMATION } from '../config/animation';
import { clamp, lerp, TAU } from '../utils/math';
import type { MokeAnimationState } from './MokeAnimationController';
import type { MokeVisual } from './MokeVisual';

const COLORS = {
  fur: '#fbf8f2',
  cream: '#f2e3cc',
  nose: '#17110f',
  eye: '#1c130f',
  tongue: '#ec8a93',
};

const HIP_HEIGHT = 0.172;
const NECK_HEIGHT = 0.26;
/** Legs: side (+1 = Moke's left), position, and gait phase offsets (trot pairs diagonals, run bounds). */
const LEGS = [
  { x: 0.055, z: 0.1, trot: 0, run: 0 },
  { x: -0.055, z: 0.1, trot: Math.PI, run: 0.35 },
  { x: 0.06, z: -0.11, trot: Math.PI, run: Math.PI },
  { x: -0.06, z: -0.11, trot: 0, run: Math.PI + 0.35 },
] as const;

interface Leg {
  pivot: Group;
  trot: number;
  run: number;
  /** +1 = Moke's left. */
  side: number;
  front: boolean;
}

/**
 * A lumpy "cotton" ball: an icosphere nudged in and out by smooth noise.
 * Deterministic per seed, so every Moke looks the same.
 */
function fluffBall(radius: number, seed: number, lumpiness = 0.07, detail = 3): BufferGeometry {
  const base = new IcosahedronGeometry(radius, detail);
  base.deleteAttribute('normal');
  base.deleteAttribute('uv');
  const geometry = mergeVertices(base);
  base.dispose();

  const positions = geometry.getAttribute('position');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);
    const length = Math.hypot(x, y, z) || 1;
    const nx = x / length;
    const ny = y / length;
    const nz = z / length;
    const lump =
      0.6 * Math.sin(nx * 7.3 + seed) * Math.sin(ny * 6.1 + seed * 1.7) * Math.sin(nz * 7.9 + seed * 0.6) +
      0.4 * Math.sin(nx * 13.1 + seed * 2.3) * Math.sin(ny * 12.7 + seed) * Math.sin(nz * 11.3 + seed * 1.3);
    const r = radius * (1 + lumpiness * lump);
    positions.setXYZ(i, nx * r, ny * r, nz * r);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * TEMPORARY stand-in for Moke until moke.glb exists: simple original geometry that echoes his
 * silhouette (round fluffy head, cream-tinted drop ears, black button nose, high pom tail),
 * animated procedurally from MokeAnimationState.
 */
export class PlaceholderDogVisual implements MokeVisual {
  readonly object = new Group();
  readonly mouthSocket = new Object3D();

  private readonly rig = new Group();
  private readonly torso = new Group();
  private readonly body: Mesh;
  private readonly neck = new Group();
  private readonly head = new Group();
  private readonly tail = new Group();
  private readonly tongue: Mesh;
  private readonly ears: { pivot: Group; side: number }[] = [];
  private readonly legs: Leg[] = [];
  private readonly eyes: Mesh[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private phase = 0;

  constructor() {
    this.object.name = 'PlaceholderMoke';
    // A little warm self-lift keeps Moke reading as *white* under the room's warm bounce light.
    const fur = this.material(
      new MeshStandardMaterial({ color: COLORS.fur, roughness: 0.95, emissive: '#fff4e6', emissiveIntensity: 0.22 }),
    );
    const cream = this.material(
      new MeshStandardMaterial({ color: COLORS.cream, roughness: 0.95, emissive: '#fbe9d2', emissiveIntensity: 0.16 }),
    );
    const nose = this.material(new MeshStandardMaterial({ color: COLORS.nose, roughness: 0.3 }));
    const eye = this.material(new MeshStandardMaterial({ color: COLORS.eye, roughness: 0.15 }));
    const sparkle = this.material(new MeshBasicMaterial({ color: '#ffffff' }));
    const tongue = this.material(new MeshStandardMaterial({ color: COLORS.tongue, roughness: 0.5 }));

    // Shift the body back a little so the nose pokes less past the round collision capsule.
    this.rig.position.z = -0.04;
    this.object.add(this.rig);
    this.rig.add(this.torso);

    // Body: a neat, curly torso with fluffier chest and rump.
    this.body = this.part(this.torso, fluffBall(0.1, 1), fur, [0, 0.205, 0], [1.05, 0.95, 1.6]);
    this.part(this.torso, fluffBall(0.088, 2), fur, [0, 0.2, 0.1]);
    this.part(this.torso, fluffBall(0.082, 3), fur, [0, 0.21, -0.11]);

    // Legs pivot at the hip so they can swing; paws are round and fur-covered.
    const legGeometry = this.geometry(new CapsuleGeometry(0.03, 0.1, 4, 10));
    const pawGeometry = this.geometry(fluffBall(0.034, 12, 0.05, 2));
    for (const def of LEGS) {
      const pivot = new Group();
      pivot.position.set(def.x, HIP_HEIGHT, def.z);
      this.part(pivot, legGeometry, fur, [0, -0.085, 0]);
      this.part(pivot, pawGeometry, fur, [0, -0.148, 0.012], [1, 0.72, 1.2]);
      this.rig.add(pivot);
      this.legs.push({ pivot, trot: def.trot, run: def.run, side: Math.sign(def.x), front: def.z > 0 });
    }

    // Head: the round cotton-ball dome, topknot, fluffy cheeks, short muzzle, black button nose.
    this.neck.position.set(0, NECK_HEIGHT, 0.13);
    this.torso.add(this.neck);
    this.neck.add(this.head);
    this.part(this.head, fluffBall(0.1, 4), fur, [0, 0.06, 0.015]);
    this.part(this.head, fluffBall(0.06, 5), fur, [0, 0.11, -0.005]);
    this.part(this.head, fluffBall(0.07, 6), fur, [0, 0.015, 0.055], [1.25, 0.85, 0.95]);
    this.part(this.head, fluffBall(0.046, 9, 0.05, 2), fur, [0, 0.015, 0.1], [1.15, 0.88, 1]);
    this.part(this.head, this.geometry(new SphereGeometry(0.018, 16, 12)), nose, [0, 0.037, 0.143], [1.3, 1, 0.85]);

    const eyeGeometry = this.geometry(new SphereGeometry(0.0165, 16, 12));
    const sparkleGeometry = this.geometry(new SphereGeometry(0.0048, 8, 6));
    for (const side of [1, -1]) {
      const eyeMesh = this.part(this.head, eyeGeometry, eye, [side * 0.041, 0.072, 0.108]);
      eyeMesh.castShadow = false;
      this.eyes.push(eyeMesh);
      this.part(this.head, sparkleGeometry, sparkle, [side * 0.041 + 0.004, 0.078, 0.1215]).castShadow = false;

      const pivot = new Group();
      pivot.position.set(side * 0.085, 0.095, 0);
      this.part(pivot, fluffBall(0.05, 7 + side), cream, [side * 0.012, -0.068, 0], [0.72, 1.55, 0.95]);
      this.head.add(pivot);
      this.ears.push({ pivot, side });
    }

    this.tongue = this.part(this.head, this.geometry(new SphereGeometry(0.02, 12, 8)), tongue, [0, -0.012, 0.118], [0.9, 0.3, 1.4]);
    this.tongue.visible = false;
    this.mouthSocket.position.set(0, 0, 0.15);
    this.head.add(this.mouthSocket);

    // Tail: a pom-pom carried high, curling forward over the back.
    this.tail.position.set(0, 0.28, -0.16);
    this.torso.add(this.tail);
    this.part(this.tail, this.geometry(new CapsuleGeometry(0.02, 0.05, 4, 8)), fur, [0, 0.03, -0.01]).rotation.x = -0.5;
    this.part(this.tail, fluffBall(0.062, 11), fur, [0, 0.075, -0.005], [0.9, 1.1, 1]);
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
    this.body.scale.y = 0.95 * (1 + (1 - moving) * 0.02 * Math.sin(s.time * 2.6)); // breathing

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
      ear.pivot.rotation.z = ear.side * (0.18 + flop + s.runBlend * 0.15 - s.bark * 0.25 - s.sniff * 0.08);
      ear.pivot.rotation.x = s.runBlend * 0.6 - s.bark * 0.3;
    }

    const wag = (0.15 + 0.4 * s.tailWag) * Math.sin(s.time * lerp(9, 16, s.tailWag));
    this.tail.rotation.z = wag;
    this.tail.rotation.x = 0.35 - s.runBlend * 0.9 - s.rest * 1.1;
    // Sleepy, contented half-closed eyes while resting.
    for (const e of this.eyes) e.scale.y = 1 - 0.65 * s.rest;

    // Mouth open for a bark (the tongue shows), or panting at a run; closed on a carried item.
    this.tongue.visible = (s.runBlend > 0.25 || s.bark > 0.2) && s.carry < 0.5;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.object.removeFromParent();
  }

  private part(
    parent: Object3D,
    geometry: BufferGeometry,
    material: Material,
    position: [number, number, number],
    scale: [number, number, number] = [1, 1, 1],
  ): Mesh {
    if (!this.geometries.includes(geometry)) this.geometries.push(geometry);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.scale.set(...scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private material<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }
}
