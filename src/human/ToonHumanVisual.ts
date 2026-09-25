import {
  CapsuleGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  SphereGeometry,
  TorusGeometry,
  type BufferGeometry,
  type Material,
} from 'three';
import { damp } from '../utils/math';
import type { HumanPose } from './HumanBrain';

/** What the visual needs each frame: plain numbers and names, no behaviour logic. */
export interface HumanVisualState {
  /** Ground speed (m/s): drives the walk cycle. */
  speed: number;
  /** 0 standing … 1 kneeling. */
  crouch: number;
  pose: HumanPose;
  /** Head turn relative to the body (rad). */
  headYaw: number;
}

/** The human's look, kept apart from behaviour so a modelled character could replace it. */
export interface HumanVisual {
  readonly object: Object3D;
  /** Where held items go: the sock (left) and the treat (right). */
  readonly hands: { readonly left: Object3D; readonly right: Object3D };
  /** Fade toward see-through (they're between the camera and Moke) or back to solid. */
  setSeeThrough(on: boolean): void;
  update(dt: number, state: HumanVisualState): void;
  dispose(): void;
}

const COLORS = {
  skin: '#efc3a0',
  hair: '#4a3226',
  sweater: '#e27d5f',
  sweaterCuff: '#c9654b',
  jeans: '#4f6f98',
  jeansCuff: '#6f8db3',
  // The other sock of the pair Moke keeps stealing (see propVisuals: the same charcoal and grey).
  sock: '#34373d',
  sockStripe: '#9ca3ad',
  ink: '#2b2530',
};

type Joint = 'spine' | 'neck' | 'hipL' | 'hipR' | 'kneeL' | 'kneeR' | 'shoulderL' | 'shoulderR' | 'elbowL' | 'elbowR';
const JOINTS: readonly Joint[] = ['spine', 'neck', 'hipL', 'hipR', 'kneeL', 'kneeR', 'shoulderL', 'shoulderR', 'elbowL', 'elbowR'];
type Angles = Record<Joint, { x: number; y: number; z: number }>;

const HIP_HEIGHT = 0.92;

/**
 * A friendly, stylized placeholder human built from simple rounded shapes in the game's palette (original,
 * code-built, no files). Poses are target joint angles blended smoothly, with a walk cycle on top.
 * Wears one sock: the other one is in Moke's mouth.
 */
export class ToonHumanVisual implements HumanVisual {
  readonly object = new Group();
  readonly hands: { left: Object3D; right: Object3D };

  private readonly hips = new Group();
  private readonly pivots: Record<Joint, Object3D>;
  private readonly current: Angles;
  private readonly target: Angles;
  private readonly materials: Material[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly brows: Object3D[] = [];
  private readonly smile: Object3D;
  private readonly gasp: Object3D;
  private walkPhase = 0;
  private time = 0;
  private hipDrop = 0;
  private opacity = 1;
  private seeThrough = false;

  constructor() {
    this.object.name = 'Human';
    const m = {
      skin: this.mat(COLORS.skin, 0.7),
      hair: this.mat(COLORS.hair, 0.8),
      sweater: this.mat(COLORS.sweater, 0.9),
      cuff: this.mat(COLORS.sweaterCuff, 0.9),
      jeans: this.mat(COLORS.jeans, 0.85),
      jeansCuff: this.mat(COLORS.jeansCuff, 0.85),
      sock: this.mat(COLORS.sock, 0.95),
      stripe: this.mat(COLORS.sockStripe, 0.95),
      ink: this.mat(COLORS.ink, 0.5),
    };
    const pivot = (parent: Object3D, name: string, x: number, y: number, z: number) => {
      const p = new Group();
      p.name = name;
      p.position.set(x, y, z);
      parent.add(p);
      return p;
    };
    const part = (parent: Object3D, geometry: BufferGeometry, material: Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
      this.geometries.push(geometry);
      const mesh = new Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.scale.set(sx, sy, sz);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    // Small details (face, cuffs, hands): no shadow of their own. Each would cost a draw call in the shadow pass.
    const detail = (...args: Parameters<typeof part>) => {
      const mesh = part(...args);
      mesh.castShadow = false;
      return mesh;
    };
    const capsule = (r: number, length: number) => new CapsuleGeometry(r, length, 6, 14);
    const sphere = (r: number) => new SphereGeometry(r, 20, 14);

    this.object.add(this.hips);
    this.hips.position.y = HIP_HEIGHT;
    part(this.hips, sphere(0.16), m.jeans, 0, 0.02, 0, 1.15, 0.7, 0.85);

    // Legs: hip → knee → foot. Left foot in the matching sock, right foot bare.
    const leg = (side: 1 | -1) => {
      const hip = pivot(this.hips, side > 0 ? 'hipL' : 'hipR', 0.095 * side, 0, 0);
      part(hip, capsule(0.075, 0.34), m.jeans, 0, -0.22, 0);
      const knee = pivot(hip, side > 0 ? 'kneeL' : 'kneeR', 0, -0.44, 0);
      part(knee, capsule(0.064, 0.32), m.jeans, 0, -0.2, 0);
      detail(knee, new TorusGeometry(0.066, 0.018, 8, 16), m.jeansCuff, 0, -0.37, 0, 1, 1, 1).rotation.x = Math.PI / 2;
      const foot = side > 0 ? m.sock : m.skin;
      part(knee, sphere(0.062), foot, 0, -0.44, 0.045, 0.95, 0.62, 1.75);
      if (side > 0) detail(knee, new TorusGeometry(0.052, 0.012, 6, 16), m.stripe, 0, -0.4, 0.01, 1, 1, 1).rotation.x = Math.PI / 2;
      return { hip, knee };
    };
    const left = leg(1);
    const right = leg(-1);

    // Torso, shoulders, arms, hands.
    const spine = pivot(this.hips, 'spine', 0, 0.08, 0);
    part(spine, capsule(0.17, 0.3), m.sweater, 0, 0.26, 0, 1.05, 1, 0.78);
    const arm = (side: 1 | -1) => {
      const shoulder = pivot(spine, side > 0 ? 'shoulderL' : 'shoulderR', 0.215 * side, 0.46, 0);
      part(shoulder, capsule(0.057, 0.2), m.sweater, 0, -0.14, 0);
      const elbow = pivot(shoulder, side > 0 ? 'elbowL' : 'elbowR', 0, -0.28, 0);
      part(elbow, capsule(0.05, 0.18), m.sweater, 0, -0.12, 0);
      detail(elbow, new TorusGeometry(0.048, 0.014, 6, 14), m.cuff, 0, -0.23, 0).rotation.x = Math.PI / 2;
      detail(elbow, sphere(0.05), m.skin, 0, -0.29, 0, 0.9, 1.05, 0.8);
      const hand = pivot(elbow, side > 0 ? 'handL' : 'handR', 0, -0.33, 0.02);
      return { shoulder, elbow, hand };
    };
    const armL = arm(1);
    const armR = arm(-1);

    // Neck and a friendly, simple face.
    const neck = pivot(spine, 'neck', 0, 0.52, 0);
    part(neck, capsule(0.05, 0.05), m.skin, 0, 0.04, 0);
    const head = pivot(neck, 'head', 0, 0.17, 0);
    part(head, sphere(0.112), m.skin, 0, 0, 0, 0.95, 1.05, 1);
    part(head, sphere(0.118), m.hair, 0, 0.035, -0.022, 1.0, 0.92, 1.0);
    detail(head, sphere(0.06), m.hair, 0.04, 0.075, 0.07, 1.4, 0.55, 0.8); // fringe
    for (const x of [-0.037, 0.037]) {
      detail(head, sphere(0.013), m.ink, x, 0.005, 0.104);
      const brow = detail(head, capsule(0.006, 0.026), m.ink, x, 0.04, 0.1);
      brow.rotation.z = Math.PI / 2;
      this.brows.push(brow);
    }
    detail(head, sphere(0.014), m.skin, 0, -0.018, 0.112);
    this.smile = detail(head, new TorusGeometry(0.022, 0.0045, 6, 16, Math.PI), m.ink, 0, -0.045, 0.1);
    this.smile.rotation.z = Math.PI;
    this.gasp = detail(head, sphere(0.014), m.ink, 0, -0.05, 0.103, 1, 1.3, 0.5);
    this.gasp.visible = false;

    this.hands = { left: armL.hand, right: armR.hand };
    this.pivots = {
      spine,
      neck,
      hipL: left.hip,
      hipR: right.hip,
      kneeL: left.knee,
      kneeR: right.knee,
      shoulderL: armL.shoulder,
      shoulderR: armR.shoulder,
      elbowL: armL.elbow,
      elbowR: armR.elbow,
    };
    const zero = () => Object.fromEntries(JOINTS.map((j) => [j, { x: 0, y: 0, z: 0 }])) as Angles;
    this.current = zero();
    this.target = zero();
  }

  update(dt: number, s: HumanVisualState): void {
    this.time += dt;
    const t = this.target;
    for (const j of JOINTS) {
      t[j].x = 0;
      t[j].y = 0;
      t[j].z = 0;
    }
    // Relaxed arms hang a little out from the body.
    t.shoulderL.z = 0.12;
    t.shoulderR.z = -0.12;
    t.elbowL.x = -0.15;
    t.elbowR.x = -0.15;

    this.pose(s.pose, t);
    this.crouch(s.crouch, t);
    this.walk(dt, s.speed, s.crouch, t);
    t.neck.y += s.headYaw;

    // Blend toward the targets (poses flow into each other).
    for (const j of JOINTS) {
      const c = this.current[j];
      c.x = damp(c.x, t[j].x, 10, dt);
      c.y = damp(c.y, t[j].y, 10, dt);
      c.z = damp(c.z, t[j].z, 10, dt);
      this.pivots[j].rotation.set(c.x, c.y, c.z);
    }
    this.hipDrop = damp(this.hipDrop, s.crouch * 0.42, 8, dt);
    this.hips.position.y = HIP_HEIGHT - this.hipDrop + Math.abs(Math.sin(this.walkPhase)) * 0.02 * Math.min(1, s.speed);

    const surprised = s.pose === 'surprised' || s.pose === 'lunge' || s.pose === 'stumble';
    this.gasp.visible = surprised;
    this.smile.visible = !surprised;
    for (const brow of this.brows) brow.position.y = damp(brow.position.y, surprised ? 0.052 : 0.04, 12, dt);
    this.fade(dt);
  }

  setSeeThrough(on: boolean): void {
    this.seeThrough = on;
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.object.removeFromParent();
  }

  /** Upper-body action. Angles in radians; +x on a shoulder swings the arm backward, -x forward. */
  private pose(pose: HumanPose, t: Angles): void {
    const wave = Math.sin(this.time * 6);
    switch (pose) {
      case 'fold':
        t.spine.x = 0.18;
        t.neck.x = 0.35;
        t.shoulderL.x = -0.9 + wave * 0.12;
        t.shoulderR.x = -0.9 - wave * 0.12;
        t.shoulderL.z = 0.25;
        t.shoulderR.z = -0.25;
        t.elbowL.x = -1.2;
        t.elbowR.x = -1.2;
        break;
      case 'surprised':
        t.spine.x = -0.12;
        t.neck.x = -0.15;
        t.shoulderL.z = 1.2;
        t.shoulderR.z = -1.2;
        t.elbowL.x = -1.1;
        t.elbowR.x = -1.1;
        break;
      case 'chase':
        t.spine.x = 0.22;
        t.shoulderL.x = -0.9;
        t.shoulderR.x = -0.7;
        t.elbowL.x = -0.4;
        t.elbowR.x = -0.4;
        break;
      case 'lunge':
        t.spine.x = 0.75;
        t.neck.x = -0.3;
        t.shoulderL.x = -1.5;
        t.shoulderR.x = -1.5;
        t.hipL.x = -0.55;
        t.kneeL.x = 0.7;
        t.hipR.x = 0.2;
        break;
      case 'stumble':
        t.spine.x = -0.15;
        t.spine.z = Math.sin(this.time * 9) * 0.12;
        t.shoulderL.z = 1.0 + wave * 0.5;
        t.shoulderR.z = -1.0 + wave * 0.5;
        break;
      case 'shrug':
        t.neck.z = 0.2;
        t.shoulderL.z = 0.35;
        t.shoulderR.z = -0.35;
        t.elbowL.x = -1.3;
        t.elbowR.x = -1.3;
        t.elbowL.y = -0.6;
        t.elbowR.y = 0.6;
        break;
      case 'search':
        t.spine.x = 0.12;
        t.shoulderR.x = -2.1; // hand shading the eyes
        t.elbowR.x = -1.6;
        break;
      case 'peek':
        t.spine.x = 1.0; // bent right down, peering under the furniture
        t.neck.x = -0.7;
        t.shoulderL.x = -0.6;
        t.shoulderR.x = -0.6;
        t.elbowL.x = -0.9;
        t.elbowR.x = -0.9;
        break;
      case 'rummage':
        t.spine.x = 0.25;
        t.shoulderR.x = -1.35 + wave * 0.15;
        t.elbowR.x = -0.35;
        t.shoulderL.x = -0.4;
        break;
      case 'offer':
        t.spine.x = 0.15;
        t.shoulderR.x = -1.35; // treat held out
        t.elbowR.x = -0.15;
        t.shoulderL.x = -0.2;
        break;
      case 'take':
        t.spine.x = 0.35;
        t.shoulderL.x = -1.2;
        t.shoulderR.x = -1.2;
        t.elbowL.x = -0.3;
        t.elbowR.x = -0.3;
        break;
      case 'place':
        t.spine.x = 0.5;
        t.shoulderR.x = -1.0;
        t.elbowR.x = -0.1;
        break;
      case 'tidy':
        t.spine.x = 0.45;
        t.neck.x = 0.3;
        t.shoulderL.x = -0.9;
        t.shoulderR.x = -0.9;
        t.elbowL.x = -0.5;
        t.elbowR.x = -0.5;
        break;
      case 'idle':
        break;
    }
  }

  /** Down on one knee: hips drop, thighs forward, shins back. */
  private crouch(amount: number, t: Angles): void {
    if (amount <= 0.001) return;
    t.hipL.x += -1.55 * amount;
    t.kneeL.x += 1.55 * amount;
    t.hipR.x += -0.35 * amount;
    t.kneeR.x += 1.9 * amount;
    t.spine.x += 0.1 * amount;
  }

  private walk(dt: number, speed: number, crouch: number, t: Angles): void {
    const stride = Math.min(1, speed / 1.2) * (1 - crouch);
    this.walkPhase += dt * (4.5 + speed * 2.2) * (speed > 0.05 ? 1 : 0);
    if (stride <= 0.01) return;
    const swing = Math.sin(this.walkPhase) * 0.55 * stride;
    t.hipL.x += swing;
    t.hipR.x -= swing;
    t.kneeL.x += Math.max(0, -Math.cos(this.walkPhase)) * 0.7 * stride;
    t.kneeR.x += Math.max(0, Math.cos(this.walkPhase)) * 0.7 * stride;
    t.shoulderL.x -= swing * 0.7;
    t.shoulderR.x += swing * 0.7;
    t.spine.x += 0.06 * stride;
  }

  /** Eases between solid and see-through; only switches materials to transparent while fading. */
  private fade(dt: number): void {
    const target = this.seeThrough ? 0.25 : 1;
    if (this.opacity === target) return;
    this.opacity = Math.abs(this.opacity - target) < 0.01 ? target : damp(this.opacity, target, 10, dt);
    const solid = this.opacity === 1;
    for (const material of this.materials) {
      const m = material as MeshStandardMaterial;
      if (m.transparent === solid) {
        m.transparent = !solid;
        m.depthWrite = solid;
        m.needsUpdate = true;
      }
      m.opacity = this.opacity;
    }
  }

  private mat(color: string, roughness: number): MeshStandardMaterial {
    const material = new MeshStandardMaterial({ color, roughness });
    this.materials.push(material);
    return material;
  }
}
