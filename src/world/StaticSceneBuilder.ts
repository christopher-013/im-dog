import {
  BufferAttribute,
  Euler,
  Group,
  Matrix4,
  Mesh,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { StaticBox } from '../physics/PhysicsWorld';

export type Vec3Tuple = [number, number, number];

export interface PlaceOptions {
  rotation?: Vec3Tuple;
  scale?: Vec3Tuple;
  /** Default true. */
  cast?: boolean;
  /** Default true. */
  receive?: boolean;
  /** Also add a box collider matching this part's bounds. */
  solid?: boolean;
  /** A thin solid (legs, poles): blocks Moke but not the camera. */
  thin?: boolean;
  /** Re-map UVs from world X/Z at this many metres per texture tile (floors), so textures line up across pieces. */
  worldUV?: number;
}

interface Batch {
  material: Material;
  cast: boolean;
  receive: boolean;
  geometries: BufferGeometry[];
}

const tmpPosition = new Vector3();
const tmpQuaternion = new Quaternion();
const tmpScale = new Vector3();
const tmpCenter = new Vector3();
const tmpSize = new Vector3();

function transform(position: Vec3Tuple, rotation: Vec3Tuple = [0, 0, 0], scale: Vec3Tuple = [1, 1, 1]): Matrix4 {
  return new Matrix4().compose(
    new Vector3(...position),
    new Quaternion().setFromEuler(new Euler(...rotation)),
    new Vector3(...scale),
  );
}

/**
 * Builds static scenery.
 * - Parts are placed in local frames that can nest (`at`).
 * - Box colliders are derived from the parts themselves, or added directly.
 * - Everything that shares a material is merged into one mesh, so a furnished room costs a few
 *   dozen draw calls instead of hundreds.
 */
export class StaticSceneBuilder {
  readonly colliders: StaticBox[] = [];
  private readonly batches = new Map<string, Batch>();
  private readonly extras: Object3D[] = [];
  private frame = new Matrix4();

  /** Runs `build` with coordinates relative to `position`, turned `rotationY` about the vertical. */
  at(position: Vec3Tuple, rotationY: number, build: () => void): void {
    const saved = this.frame;
    this.frame = saved.clone().multiply(transform(position, [0, rotationY, 0]));
    try {
      build();
    } finally {
      this.frame = saved;
    }
  }

  add(geometry: BufferGeometry, material: Material, position: Vec3Tuple, options: PlaceOptions = {}): void {
    const world = this.frame.clone().multiply(transform(position, options.rotation, options.scale));
    const placed = (geometry.index ? geometry.toNonIndexed() : geometry.clone()).applyMatrix4(world);
    if (!placed.getAttribute('uv')) {
      placed.setAttribute('uv', new BufferAttribute(new Float32Array(placed.getAttribute('position').count * 2), 2));
    }
    if (options.worldUV) remapWorldUV(placed, options.worldUV);

    const cast = options.cast ?? true;
    const receive = options.receive ?? true;
    const key = `${material.uuid}|${cast}|${receive}`;
    let batch = this.batches.get(key);
    if (!batch) {
      batch = { material, cast, receive, geometries: [] };
      this.batches.set(key, batch);
    }
    batch.geometries.push(placed);

    if (options.solid || options.thin) this.addBoundsCollider(geometry, world, !options.thin);
  }

  /** A collider with no mesh of its own, e.g. one simple box for a whole couch. `size` is the full size. */
  addCollider(center: Vec3Tuple, size: Vec3Tuple, options: { rotationY?: number; thin?: boolean } = {}): void {
    const world = this.frame.clone().multiply(transform(center, [0, options.rotationY ?? 0, 0]));
    world.decompose(tmpPosition, tmpQuaternion, tmpScale);
    this.pushBox(tmpPosition, [size[0] / 2, size[1] / 2, size[2] / 2], tmpQuaternion, !options.thin);
  }

  /** Something that isn't merged (a light, a special mesh), placed in the current frame. */
  addObject(object: Object3D, position: Vec3Tuple): void {
    object.applyMatrix4(this.frame.clone().multiply(transform(position)));
    this.extras.push(object);
  }

  /** Merges all batches into meshes and returns the finished scenery. */
  build(name: string): Group {
    const group = new Group();
    group.name = name;
    for (const batch of this.batches.values()) {
      const merged = batch.geometries.length === 1 ? batch.geometries[0] : mergeGeometries(batch.geometries, false);
      if (!merged) throw new Error(`Could not merge scenery for material "${batch.material.name || batch.material.type}"`);
      if (merged !== batch.geometries[0]) for (const g of batch.geometries) g.dispose();
      const mesh = new Mesh(merged, batch.material);
      mesh.castShadow = batch.cast;
      mesh.receiveShadow = batch.receive;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
    for (const extra of this.extras) group.add(extra);
    this.batches.clear();
    this.extras.length = 0;
    return group;
  }

  private addBoundsCollider(geometry: BufferGeometry, world: Matrix4, blocksCamera: boolean): void {
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    world.decompose(tmpPosition, tmpQuaternion, tmpScale);
    const center = bounds.getCenter(tmpCenter).applyMatrix4(world);
    const half = bounds.getSize(tmpSize).multiply(tmpScale).multiplyScalar(0.5);
    this.pushBox(center, [Math.abs(half.x), Math.abs(half.y), Math.abs(half.z)], tmpQuaternion, blocksCamera);
  }

  private pushBox(center: Vector3, half: Vec3Tuple, rotation: Quaternion, blocksCamera: boolean): void {
    this.colliders.push({
      center: [center.x, center.y, center.z],
      halfExtents: half,
      rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
      blocksCamera,
    });
  }
}

/** Planar X/Z UVs in world space, so floor textures tile continuously across separate pieces. */
function remapWorldUV(geometry: BufferGeometry, metresPerTile: number): void {
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    uv.setXY(i, position.getX(i) / metresPerTile, -position.getZ(i) / metresPerTile);
  }
  uv.needsUpdate = true;
}

