import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
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
 * Going for a ride (Phase 6): his harness, worn over the collar on the visual's back socket (presentation only, like
 * the costumes), and the leash from its clip on top of his back to the human's hand, sagging between them (one
 * instanced mesh of short rope pieces, updated each frame). Built in code.
 */
export class Harness {
  readonly leash: InstancedMesh;
  private readonly harness = new Group();
  private readonly clip = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private hand: Object3D | null = null;

  constructor(color: string) {
    const strap = this.material(new MeshStandardMaterial({ color, roughness: 0.6 }));
    const metal = this.material(new MeshStandardMaterial({ color: '#c9ccd2', metalness: 0.8, roughness: 0.3 }));
    const rope = this.material(new MeshStandardMaterial({ color, roughness: 0.7 }));
    this.harness.name = 'harness';
    // In back-socket space (on top of his back): a band round his chest just behind the front legs, a strap along
    // his back to the collar, and the ring the leash clips to.
    const band = this.geometry(new TorusGeometry(0.105, 0.012, 6, 28));
    const chest = new Mesh(band, strap);
    chest.position.set(0, -0.09, 0.06);
    chest.scale.set(1, 1.05, 0.6);
    chest.rotation.x = Math.PI / 2 + 0.35;
    const back = new Mesh(this.geometry(new BoxGeometry(0.03, 0.012, 0.12)), strap);
    back.position.set(0, 0.008, 0.09);
    back.rotation.x = -0.3;
    const pad = new Mesh(this.geometry(new BoxGeometry(0.07, 0.016, 0.07)), strap);
    pad.position.set(0, 0.006, 0.02);
    const ring = new Mesh(this.geometry(new TorusGeometry(0.014, 0.003, 6, 14)), metal);
    ring.position.set(0, 0.022, 0.02);
    this.clip.position.copy(ring.position);
    this.harness.add(chest, back, pad, ring, this.clip);
    for (const m of [chest, back, pad, ring]) m.castShadow = true;
    const piece = this.geometry(new CylinderGeometry(0.006, 0.006, 1, 5, 1, true));
    this.leash = new InstancedMesh(piece, rope, SEGMENTS);
    this.leash.name = 'leash';
    this.leash.frustumCulled = false;
    this.leash.visible = false;
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

/** A point along the leash: straight from clip to hand, dipping by `sag` in the middle. */
function point(t: number, sag: number, out: Vector3): Vector3 {
  out.lerpVectors(from, to, t);
  out.y -= 4 * sag * t * (1 - t);
  return out;
}
