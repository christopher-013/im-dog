import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  RepeatWrapping,
  SRGBColorSpace,
  TorusGeometry,
  Vector3,
  BufferGeometry as BufferGeometryClass,
  Float32BufferAttribute,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { HarnessLook } from '../config/dogLooks';
import type { MokeVisual } from './MokeVisual';

const SEGMENTS = 18;
const UP = new Vector3(0, 1, 0);
const from = new Vector3();
const to = new Vector3();
const a = new Vector3();
const b = new Vector3();
const dir = new Vector3();
const matrix = new Matrix4();
const rotation = new Quaternion();
const scale = new Vector3();

/**
 * Going for a ride (Phase 6): his harness, a soft mesh step-in vest like the real Moke's (each dog's colours:
 * `DogLook.harness`), worn over the collar on the visual's back socket (presentation only, like the costumes), and the leash from its clip on top of his back to the human's hand, sagging between them (one
 * instanced mesh of short rope pieces, updated each frame). Built in code.
 */
export class Harness {
  readonly leash: InstancedMesh;
  private readonly harness = new Group();
  private readonly clip = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: CanvasTexture[] = [];
  private hand: Object3D | null = null;

  constructor(look: HarnessLook) {
    const mesh = this.material(new MeshStandardMaterial({ color: look.vest, roughness: 0.85, map: this.meshTexture(), side: DoubleSide }));
    const trim = this.material(new MeshStandardMaterial({ color: look.trim, roughness: 0.7 }));
    const buckle = this.material(new MeshStandardMaterial({ color: look.buckle, roughness: 0.4 }));
    const metal = this.material(new MeshStandardMaterial({ color: '#c9ccd2', metalness: 0.8, roughness: 0.3 }));
    const rope = this.material(new MeshStandardMaterial({ color: look.leash, roughness: 0.7 }));
    this.harness.name = 'harness';
    // In back-socket space (on top of his back; +z toward his nose): a soft mesh vest round his chest and shoulders,
    // over his curls (their tips poke through it, like the real thing), edged in a darker binding, the buckle, and
    // the ring on top that the leash clips to. His body's middle is about 0.095 below.
    // The vest reaches further forward on top (up toward his neck) than underneath (his chest, between his legs).
    const front = (a: number) => 0.088 + 0.04 * (1 + Math.cos(a)) / 2;
    const back = (a: number) => -0.045 - 0.012 * (1 + Math.cos(a)) / 2;
    const vest = new Mesh(this.geometry(vestBand(front, back, 0)), mesh);
    const frontEdge = new Mesh(this.geometry(vestBand(front, (a) => front(a) - 0.012, 0.003)), trim);
    const backEdge = new Mesh(this.geometry(vestBand((a) => back(a) + 0.012, back, 0.003)), trim);
    for (const part of [vest, frontEdge, backEdge]) part.position.set(0, -0.097, 0);
    // The buckle: low on his left side at the vest's front edge (his chest fluff hides the middle of his chest).
    const clasp = new Mesh(this.geometry(new BoxGeometry(0.012, 0.028, 0.04)), buckle);
    clasp.position.set(0.106, -0.142, 0.09);
    clasp.rotation.z = 0.45;
    const latch = new Mesh(this.geometry(new BoxGeometry(0.008, 0.012, 0.02)), metal);
    latch.position.set(0.112, -0.139, 0.09);
    latch.rotation.z = 0.45;
    const ring = new Mesh(this.geometry(new TorusGeometry(0.014, 0.003, 6, 14)), metal);
    ring.position.set(0, 0.026, 0.0);
    this.clip.position.copy(ring.position);
    this.harness.add(vest, frontEdge, backEdge, clasp, latch, ring, this.clip);
    for (const m of [vest, frontEdge, backEdge, clasp, ring]) m.castShadow = true;
    const piece = this.geometry(new CylinderGeometry(0.007, 0.007, 1, 5, 1, true));
    this.leash = new InstancedMesh(piece, rope, SEGMENTS);
    this.leash.name = 'leash';
    this.leash.frustumCulled = false;
    this.leash.visible = false;
  }

  /** The vest's fabric: a fine open mesh (lighter threads round darker holes), tiled round it. */
  private meshTexture(): CanvasTexture | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 32;
    const g = canvas.getContext('2d');
    if (!g) return null;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 32, 32);
    g.fillStyle = '#dfe5e9';
    for (const [x, y] of [[8, 8], [24, 8], [16, 24], [0, 24], [32, 24]] as const) {
      g.beginPath();
      g.arc(x, y, 3.2, 0, Math.PI * 2);
      g.fill();
    }
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(20, 4);
    texture.colorSpace = SRGBColorSpace;
    this.textures.push(texture);
    return texture;
  }

  /** On `visual` (taking it off whatever wore it), the leash to `hand` (or no leash). */
  wear(visual: MokeVisual, hand: Object3D | null): void {
    this.harness.removeFromParent();
    visual.attachments.back?.add(this.harness);
    this.hand = hand;
    this.leash.visible = !!hand && !!this.harness.parent;
  }

  takeOff(): void {
    this.harness.removeFromParent();
    this.hand = null;
    this.leash.visible = false;
  }

  get worn(): boolean {
    return this.harness.parent !== null;
  }

  /** Each rendered frame (after both have moved): the leash hangs from the clip to the hand, sagging with slack. */
  update(): void {
    if (!this.hand || !this.harness.parent) {
      this.leash.visible = false;
      return;
    }
    this.leash.visible = true;
    this.clip.getWorldPosition(from);
    this.hand.getWorldPosition(to);
    const length = from.distanceTo(to);
    const sag = Math.max(0.04, 1.25 - length) * 0.35;
    for (let i = 0; i < SEGMENTS; i++) {
      point(i / SEGMENTS, sag, a);
      point((i + 1) / SEGMENTS, sag, b);
      dir.subVectors(b, a);
      const len = dir.length();
      rotation.setFromUnitVectors(UP, dir.normalize());
      scale.set(1, len, 1);
      matrix.compose(a.lerp(b, 0.5), rotation, scale);
      this.leash.setMatrixAt(i, matrix);
    }
    this.leash.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.takeOff();
    this.leash.removeFromParent();
    this.leash.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
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

/**
 * A band of the vest round his body (in back-socket space, about his body's middle, which the caller sets): between
 * `front(a)` and `back(a)` along him at each angle `a` round him (0 on top), hugging his curls (snug: their tips poke
 * through) and `out` further out (the binding at the edges).
 */
function vestBand(front: (a: number) => number, back: (a: number) => number, out: number): BufferGeometry {
  const around = 32, along = 4;
  const positions: number[] = [], uvs: number[] = [], index: number[] = [];
  for (let i = 0; i <= around; i++) {
    const a = (i / around) * Math.PI * 2;
    for (let j = 0; j <= along; j++) {
      const t = j / along;
      const z = back(a) + (front(a) - back(a)) * t;
      // Round him, a little fuller in the middle of his body and narrower toward his neck.
      const r = 0.109 * (0.92 + 0.08 * Math.sqrt(Math.max(0, 1 - (z / 0.17) ** 2))) + out;
      positions.push(Math.sin(a) * r, Math.cos(a) * r * 0.94, z);
      uvs.push(i / around, t);
    }
  }
  for (let i = 0; i < around; i++) {
    for (let j = 0; j < along; j++) {
      const p = i * (along + 1) + j, q = p + along + 1;
      index.push(p, q, p + 1, q, q + 1, p + 1);
    }
  }
  const geometry = new BufferGeometryClass();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** A point along the leash: straight from clip to hand, dipping by `sag` in the middle. */
function point(t: number, sag: number, out: Vector3): Vector3 {
  out.lerpVectors(from, to, t);
  out.y -= 4 * sag * t * (1 - t);
  return out;
}
