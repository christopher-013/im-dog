import { Mesh, Quaternion, Vector3, type BufferGeometry, type Material, type Object3D } from 'three';
import { MISCHIEF, PILLOW_SOFAS, type PillowSofa } from '../config/mischief';
import type { StaticSceneBuilder, PlaceOptions, Vec3Tuple } from './StaticSceneBuilder';

/** Only throw pillows remain unmerged; the large scenery batches stay static. Materials are still shared. */
export function addLoosePillow(b: StaticSceneBuilder, geometry: BufferGeometry, material: Material, at: Vec3Tuple, options: PlaceOptions = {}): void {
  const pillow = new Mesh(geometry, material);
  pillow.name = 'Loose couch pillow';
  pillow.userData.loosePillow = true;
  if (options.rotation) pillow.rotation.set(...options.rotation);
  if (options.scale) pillow.scale.set(...options.scale);
  pillow.castShadow = options.cast ?? b.castByDefault;
  pillow.receiveShadow = true;
  b.addObject(pillow, at);
}

interface Pillow {
  mesh: Object3D;
  parent: Object3D;
  rest: Vector3;
  rotation: Quaternion;
  scale: Vector3;
  flight: { start: Vector3; end: Vector3; rotation: Quaternion; targetRotation: Quaternion; elapsed: number; duration: number; arc: number } | null;
}

/** Presentation only: short deterministic toss/return arcs, not gameplay or a new physics simulation. */
export class CouchPillows {
  private readonly groups = new Map<string, Pillow[]>();

  constructor(root: Object3D) {
    root.updateMatrixWorld(true);
    const at = new Vector3();
    root.traverse((mesh) => {
      if (!mesh.userData.loosePillow || !mesh.parent) return;
      mesh.getWorldPosition(at);
      const sofa = PILLOW_SOFAS.reduce((best, s) => Math.hypot(at.x - s.x, at.z - s.z) < Math.hypot(at.x - best.x, at.z - best.z) ? s : best);
      const list = this.groups.get(sofa.id) ?? [];
      list.push({ mesh, parent: mesh.parent, rest: mesh.position.clone(), rotation: mesh.quaternion.clone(), scale: mesh.scale.clone(), flight: null });
      this.groups.set(sofa.id, list);
    });
  }

  count(sofa: PillowSofa): number { return this.groups.get(sofa.id)?.length ?? 0; }

  toss(sofa: PillowSofa): void {
    this.groups.get(sofa.id)?.forEach((p, i) => {
      const floor = sofa.floors[i % sofa.floors.length]!;
      const end = p.parent.worldToLocal(new Vector3(floor.x, floor.y, floor.z));
      this.fly(p, end, new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2), MISCHIEF.tossTime, MISCHIEF.tossArc);
    });
  }

  pickUp(sofa: PillowSofa, index: number, hand: Object3D): void {
    const p = this.groups.get(sofa.id)?.[index];
    if (!p) return;
    p.flight = null;
    hand.add(p.mesh);
    p.mesh.position.set(0, -0.03, 0.12);
    p.mesh.rotation.set(0, 0, 0);
  }

  putBack(sofa: PillowSofa, index: number): void {
    const p = this.groups.get(sofa.id)?.[index];
    if (!p) return;
    p.parent.attach(p.mesh);
    this.fly(p, p.rest, p.rotation, MISCHIEF.returnTime, 0.12);
  }

  restAt(sofa: PillowSofa, index: number): Vector3 {
    const p = this.groups.get(sofa.id)![index]!;
    return p.parent.localToWorld(p.rest.clone());
  }

  reset(sofa?: PillowSofa): void {
    for (const [id, pillows] of this.groups) {
      if (sofa && sofa.id !== id) continue;
      for (const p of pillows) {
        p.flight = null;
        p.parent.add(p.mesh);
        p.mesh.position.copy(p.rest); p.mesh.quaternion.copy(p.rotation); p.mesh.scale.copy(p.scale);
      }
    }
  }

  update(dt: number): void {
    if (dt <= 0) return;
    for (const pillows of this.groups.values()) for (const p of pillows) {
      const f = p.flight;
      if (!f) continue;
      f.elapsed += dt;
      const t = Math.min(1, f.elapsed / f.duration);
      p.mesh.position.lerpVectors(f.start, f.end, t);
      p.mesh.position.y += 4 * f.arc * t * (1 - t);
      p.mesh.quaternion.slerpQuaternions(f.rotation, f.targetRotation, t);
      if (t >= 1) p.flight = null;
    }
  }

  private fly(p: Pillow, end: Vector3, rotation: Quaternion, duration: number, arc: number): void {
    p.flight = { start: p.mesh.position.clone(), end: end.clone(), rotation: p.mesh.quaternion.clone(), targetRotation: rotation.clone(), elapsed: 0, duration, arc };
  }
}
