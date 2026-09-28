import { BoxGeometry, BufferAttribute, BufferGeometry, CylinderGeometry, DoubleSide, DynamicDrawUsage, Group, Mesh, MeshStandardMaterial, PointLight, TorusGeometry, Vector3, type Object3D } from 'three';
import { BATHROOM_ACTIVITY } from '../config/bathroom';
import type { Vec3Like } from '../physics/CharacterBody';
import { BATHROOM, CEILING, HALL, WALL } from './home/layout';
import { TILE_REPEAT, type RoomMaterials } from './materials';
import type { StaticSceneBuilder } from './StaticSceneBuilder';

/** Fixed shell and furnishings. The doorway is collision-free because its light door swings open as Moke approaches. */
export function buildBathroom(b: StaticSceneBuilder, m: RoomMaterials): void {
  const r = BATHROOM;
  const width = r.xMax - r.xMin;
  const depth = r.zMax - r.zMin;
  const midX = (r.xMin + r.xMax) / 2;
  const midZ = (r.zMin + r.zMax) / 2;
  const solid = { solid: true };
  b.add(new BoxGeometry(width, 0.1, depth), m.arabesque, [midX, -0.05, midZ], { cast: false, solid: true, worldUV: TILE_REPEAT });
  b.add(new BoxGeometry(width + WALL, 0.1, depth + WALL), m.ceiling, [midX, CEILING + 0.05, midZ], { cast: false });
  b.add(new BoxGeometry(width, CEILING, WALL), m.wallGreige, [midX, CEILING / 2, r.zMin - WALL / 2], solid);
  // The side walls stop at the hallway wall's back face (HALL.zMin - WALL): running on through it would put their
  // ends in the hallway wall's face, two paints in one place, which flicker (z-fighting).
  const sideDepth = HALL.zMin - WALL - r.zMin;
  for (const x of [r.xMin + WALL / 2, r.xMax - WALL / 2]) {
    b.add(new BoxGeometry(WALL, CEILING, sideDepth), m.wallGreige, [x, CEILING / 2, r.zMin + sideDepth / 2], solid);
  }
  // Casing on both sides of the hallway opening.
  for (const x of [r.doorMin, r.doorMax]) {
    b.add(new BoxGeometry(0.065, r.doorHeight, 0.08), m.trim, [x, r.doorHeight / 2, HALL.zMin - 0.02]);
  }
  b.add(new BoxGeometry(r.doorMax - r.doorMin + 0.09, 0.065, 0.08), m.trim,
    [(r.doorMin + r.doorMax) / 2, r.doorHeight, HALL.zMin - 0.02]);

  // Compact vanity and inset basin on the west wall; leave the room centre clear for both dog and human.
  b.add(new BoxGeometry(0.58, 0.72, 0.72), m.cabinet, [4.05, 0.36, -0.75], solid);
  b.add(new BoxGeometry(0.66, 0.055, 0.8), m.quartz, [4.05, 0.75, -0.75], solid);
  b.add(new CylinderGeometry(0.2, 0.2, 0.018, 24), m.ceramic, [4.07, 0.79, -0.75]);
  b.add(new CylinderGeometry(0.022, 0.022, 0.16, 10), m.stainless, [3.91, 0.86, -0.75]);
  b.add(new BoxGeometry(0.035, 0.74, 0.66), m.trim, [3.76, 1.53, -0.75]);
  b.add(new BoxGeometry(0.039, 0.67, 0.59), m.mirror, [3.783, 1.53, -0.75], { cast: false });

  // Toilet bowl, lid and tank against the back wall; the paper holder is immediately to its right.
  b.add(new BoxGeometry(0.52, 0.61, 0.21), m.ceramic, [5.75, 0.36, -1.43], solid);
  b.add(new CylinderGeometry(0.29, 0.25, 0.43, 24), m.ceramic, [5.75, 0.24, -1.09], solid);
  b.add(new CylinderGeometry(0.31, 0.31, 0.045, 24), m.trim, [5.75, 0.47, -1.09]);
  b.add(new TorusGeometry(0.225, 0.034, 8, 28), m.ceramic, [5.75, 0.5, -1.09], { rotation: [-Math.PI / 2, 0, 0] });
  // Wall-mounted holder to the toilet's right, with the roll facing into the room.
  b.add(new BoxGeometry(0.055, 0.09, 0.1), m.stainless, [6.43, 0.68, -0.93]);
  b.add(new CylinderGeometry(0.012, 0.012, 0.27, 10), m.stainless, [6.3, 0.68, -0.93], { rotation: [0, 0, Math.PI / 2] });
  b.addObject(new PointLight('#fff2e0', 4, 3.7, 2), [midX, CEILING - 0.24, midZ]);
  b.add(new CylinderGeometry(0.13, 0.13, 0.035, 20), m.lampShade, [midX, CEILING - 0.015, midZ], { cast: false });
}

const X_AXIS = new Vector3(1, 0, 0);
const MOUTH = new Vector3();
const FLOOR = new Vector3();
const DELTA = new Vector3();
type FloorPoint = { x: number; z: number };

/** Moving door, wall roll and one batched ribbon following Moke's actual route. */
export class BathroomView {
  readonly object = new Group();
  private readonly hinge = new Group();
  private readonly roll = new Group();
  private readonly trail: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly mouthLink: Mesh<BoxGeometry, MeshStandardMaterial>;
  private readonly heldEnd: Mesh<BoxGeometry, MeshStandardMaterial>;
  private readonly points: FloorPoint[] = [];
  private tip: FloorPoint | null = null;
  private mouth: Object3D | null = null;
  private open = false;
  private opening = 0.35;
  private wasInside = false;
  private closingAfterExit = false;
  private lastDoorDistance = Infinity;
  private drawnSegments = 0;
  private readonly paper = new MeshStandardMaterial({ color: '#fffdf8', roughness: 1, side: DoubleSide });
  private readonly wood = new MeshStandardMaterial({ color: '#f4f0e8', roughness: 0.78 });
  private readonly brass = new MeshStandardMaterial({ color: '#ad8952', metalness: 0.62, roughness: 0.38 });

  constructor() {
    this.object.name = 'Hall bathroom door and toilet paper';
    this.hinge.position.set(BATHROOM.doorMin, 0, HALL.zMin - WALL / 2);
    this.object.add(this.hinge);
    const panel = new Mesh(new BoxGeometry(BATHROOM.doorMax - BATHROOM.doorMin - 0.045, BATHROOM.doorHeight - 0.045, 0.045), this.wood);
    panel.position.set((BATHROOM.doorMax - BATHROOM.doorMin) / 2 - 0.022, BATHROOM.doorHeight / 2, 0);
    panel.castShadow = true;
    this.hinge.add(panel);
    for (const z of [-0.052, 0.052]) {
      const knob = new Mesh(new CylinderGeometry(0.035, 0.035, 0.038, 12), this.brass);
      knob.rotation.x = Math.PI / 2;
      knob.position.set(0.73, 0.96, z);
      this.hinge.add(knob);
    }
    this.roll.position.set(BATHROOM.paper.x, BATHROOM.paper.y, BATHROOM.paper.z);
    this.object.add(this.roll);
    const roll = new Mesh(new CylinderGeometry(0.095, 0.095, 0.15, 24), this.paper);
    roll.rotation.z = Math.PI / 2;
    this.roll.add(roll);
    const core = new Mesh(new CylinderGeometry(0.035, 0.035, 0.154, 16), this.brass);
    core.rotation.z = Math.PI / 2;
    this.roll.add(core);
    // One geometry/draw call for the unrolled sheet, including turns Moke makes on his way out.
    const segments = BATHROOM_ACTIVITY.maxTrailPoints - 1;
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(segments * 12), 3).setUsage(DynamicDrawUsage));
    const normals = new Float32Array(segments * 12);
    for (let i = 0; i < normals.length; i += 3) normals[i + 1] = 1;
    geometry.setAttribute('normal', new BufferAttribute(normals, 3));
    const indices = new Uint16Array(segments * 6);
    for (let i = 0; i < segments; i++) {
      const v = i * 4; const at = i * 6;
      indices.set([v, v + 1, v + 2, v + 1, v + 3, v + 2], at);
    }
    geometry.setIndex(new BufferAttribute(indices, 1));
    geometry.setDrawRange(0, 0);
    this.trail = new Mesh(geometry, this.paper);
    this.trail.name = 'Unrolled toilet paper trail';
    this.trail.frustumCulled = false;
    this.trail.castShadow = false;
    this.object.add(this.trail);
    this.mouthLink = new Mesh(new BoxGeometry(1, 0.006, 0.15), this.paper);
    this.mouthLink.name = 'Paper from floor to Moke mouth';
    this.mouthLink.visible = false;
    this.mouthLink.castShadow = false;
    this.object.add(this.mouthLink);
    this.heldEnd = new Mesh(new BoxGeometry(0.14, 0.006, 0.1), this.paper);
    this.heldEnd.name = 'Paper held in Moke mouth';
    this.heldEnd.visible = false;
    this.hinge.rotation.y = this.opening;
  }

  get isOpen(): boolean { return this.open; }
  get visibleStrips(): number { return this.drawnSegments; }
  get trailEndsOutside(): boolean { return this.points.some((p) => p.z >= HALL.zMin) || (this.tip?.z ?? -Infinity) >= HALL.zMin; }

  /** Nudge open near the threshold. Closing on exit stays ajar until Moke turns back toward it. */
  update(dt: number, moke: Vec3Like): void {
    const inside = moke.x > BATHROOM.xMin && moke.x < BATHROOM.xMax && moke.z < HALL.zMin - 0.04;
    const distance = Math.hypot(moke.x - BATHROOM.doorway.x, moke.z - BATHROOM.doorway.z);
    if (this.wasInside && !inside) {
      this.open = false;
      this.closingAfterExit = true;
    } else if (inside || (distance < 0.83 && (!this.closingAfterExit || distance < this.lastDoorDistance - 0.008))) {
      this.open = true;
      this.closingAfterExit = false;
    }
    const wanted = this.open ? 1.45 : 0.35;
    this.opening += Math.sign(wanted - this.opening) * Math.min(Math.abs(wanted - this.opening), dt * 5);
    this.hinge.rotation.y = this.opening;
    this.wasInside = inside;
    this.lastDoorDistance = distance;
  }

  /** At the bite, the loose paper end becomes a real child of Moke's model-independent mouth socket. */
  startPull(mouth: Object3D, moke: Vec3Like): void {
    this.clearPaper();
    this.mouth = mouth;
    mouth.add(this.heldEnd);
    this.heldEnd.position.set(0, 0, 0.04);
    this.heldEnd.visible = true;
    this.mouthLink.visible = true;
    this.points.push({ x: BATHROOM.paper.x, z: BATHROOM.paper.z });
    this.tip = { x: moke.x, z: moke.z };
    this.redraw();
  }

  /** Sample his floor route while he holds the free end; the ribbon follows each turn. */
  extendTrail(moke: Vec3Like): void {
    if (!this.tip) return;
    const moved = Math.hypot(moke.x - this.tip.x, moke.z - this.tip.z);
    if (moved < 0.005) return;
    if (Math.hypot(this.tip.x - this.points[this.points.length - 1]!.x, this.tip.z - this.points[this.points.length - 1]!.z) >= BATHROOM_ACTIVITY.trailSampleDistance
      && this.points.length < BATHROOM_ACTIVITY.maxTrailPoints - 1) this.points.push({ ...this.tip });
    this.tip.x = moke.x;
    this.tip.z = moke.z;
    this.roll.rotation.x -= moved * 4.5;
    this.redraw();
  }

  /** Called after Moke's visual pose updates, so the last loose edge really reaches his animated mouth. */
  updateMouthLink(): void {
    if (!this.mouth || !this.tip) return;
    this.mouth.updateWorldMatrix(true, false);
    this.mouth.getWorldPosition(MOUTH);
    FLOOR.set(this.tip.x, 0.018, this.tip.z);
    DELTA.subVectors(MOUTH, FLOOR);
    const length = DELTA.length();
    this.mouthLink.position.copy(FLOOR).addScaledVector(DELTA, 0.5);
    this.mouthLink.quaternion.setFromUnitVectors(X_AXIS, DELTA.normalize());
    this.mouthLink.scale.x = length;
  }

  /** Moke lets go outside. The human can now notice and clear the sheet from its far end. */
  releasePaper(): void {
    this.detachMouth();
    this.mouthLink.visible = false;
  }

  setCleanup(progress: number): void {
    this.drawnSegments = Math.ceil((1 - Math.max(0, Math.min(1, progress))) * (this.points.length - (this.tip ? 0 : 1)));
    this.trail.geometry.setDrawRange(0, this.drawnSegments * 6);
  }

  clearPaper(): void {
    this.detachMouth();
    this.mouthLink.visible = false;
    this.points.length = 0;
    this.tip = null;
    this.drawnSegments = 0;
    this.trail.geometry.setDrawRange(0, 0);
    this.roll.rotation.x = 0;
  }

  private detachMouth(): void {
    this.heldEnd.removeFromParent();
    this.heldEnd.visible = false;
    this.mouth = null;
  }

  private redraw(): void {
    if (!this.tip) return;
    const positions = this.trail.geometry.getAttribute('position') as BufferAttribute;
    const count = Math.min(this.points.length, BATHROOM_ACTIVITY.maxTrailPoints - 1);
    for (let i = 0; i < count; i++) {
      const a = this.points[i]!; const b = this.points[i + 1] ?? this.tip;
      const dx = b.x - a.x; const dz = b.z - a.z;
      const length = Math.max(0.001, Math.hypot(dx, dz));
      const nx = -dz / length * 0.075; const nz = dx / length * 0.075;
      const at = i * 4;
      positions.setXYZ(at, a.x + nx, 0.012, a.z + nz);
      positions.setXYZ(at + 1, a.x - nx, 0.012, a.z - nz);
      positions.setXYZ(at + 2, b.x + nx, 0.012, b.z + nz);
      positions.setXYZ(at + 3, b.x - nx, 0.012, b.z - nz);
    }
    positions.needsUpdate = true;
    this.drawnSegments = count;
    this.trail.geometry.setDrawRange(0, count * 6);
  }

  reset(): void {
    this.open = false;
    this.opening = 0.35;
    this.wasInside = false;
    this.closingAfterExit = false;
    this.lastDoorDistance = Infinity;
    this.hinge.rotation.y = this.opening;
    this.clearPaper();
  }

  dispose(): void {
    this.clearPaper();
    this.object.traverse((part: Object3D) => { if (part instanceof Mesh) part.geometry.dispose(); });
    this.heldEnd.geometry.dispose();
    this.paper.dispose(); this.wood.dispose(); this.brass.dispose();
  }
}
