import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type CatmullRomCurve3,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../utils/random';
import { LANE } from './coastRoute';

const COLORS = ['#f2f2f2', '#c62828', '#1f4e8c', '#9aa3ab', '#2b2b2b', '#e0b84a', '#4f7f5a', '#ffffff', '#7a2f38'];

interface Car {
  /** Along the road's centre line (m). */
  s: number;
  /** +1: our way (south, in our lane, ahead of us); −1: coming the other way. */
  way: 1 | -1;
  speed: number;
}

const m = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const p = new Vector3();
const t = new Vector3();
const one = new Vector3(1, 1, 1);
const none = new Vector3(0, 0, 0);

/**
 * Other cars on the coast road: a couple ahead of us going our way, and traffic coming the other way (they pass and
 * come round again far ahead). Simple toy cars, instanced. Built in code.
 */
export class Traffic {
  readonly object = new Group();
  private readonly cars: Car[] = [];
  private readonly body: InstancedMesh;
  private readonly glass: InstancedMesh;
  private readonly wheels: InstancedMesh;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly length: number;
  private readonly rand = mulberry32(23);

  constructor(private readonly curve: CatmullRomCurve3) {
    this.object.name = 'traffic';
    this.length = curve.getLength();
    this.cars.push({ s: 55, way: 1, speed: 12 }, { s: 130, way: 1, speed: 12.3 });
    for (let i = 0; i < 8; i++) this.cars.push({ s: 90 + i * 85 + this.rand() * 40, way: -1, speed: 12 + this.rand() * 3 });
    const n = this.cars.length;
    const paint = this.material(new MeshStandardMaterial({ roughness: 0.35, metalness: 0.3 }));
    this.body = new InstancedMesh(this.geometry(new BoxGeometry(1.85, 0.7, 4.4).translate(0, 0.62, 0)), paint, n);
    this.glass = new InstancedMesh(this.geometry(new BoxGeometry(1.62, 0.55, 2.2).translate(0, 1.24, -0.25)), this.material(new MeshStandardMaterial({ color: '#1e2a36', roughness: 0.2, metalness: 0.5 })), n);
    const wheel = new CylinderGeometry(0.33, 0.33, 0.24, 12).rotateZ(Math.PI / 2);
    const four = mergeGeometries([[-0.86, 1.4], [0.86, 1.4], [-0.86, -1.4], [0.86, -1.4]].map(([x, z]) => wheel.clone().translate(x!, 0.33, z!)))!;
    wheel.dispose();
    this.wheels = new InstancedMesh(this.geometry(four), this.material(new MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.9 })), n);
    const c = new Color();
    this.cars.forEach((_, i) => this.body.setColorAt(i, c.set(COLORS[i % COLORS.length]!)));
    for (const mesh of [this.body, this.glass, this.wheels]) {
      mesh.frustumCulled = false;
      mesh.castShadow = true;
      this.object.add(mesh);
    }
    this.update(0, 0);
  }

  /** Each frame, given how far along the road we are (m). */
  update(dt: number, ours: number): void {
    this.cars.forEach((car, i) => {
      car.s += car.way * car.speed * dt;
      if (car.way === -1 && car.s < ours - 40) car.s = ours + 450 + this.rand() * 300;
      // Going our way: always ahead (after a skip ahead, round again further on).
      if (car.way === 1 && car.s < ours + 20) car.s = ours + 250 + this.rand() * 100;
      const hidden = car.s < 0 || car.s > this.length;
      const u = Math.min(1, Math.max(0, car.s / this.length));
      this.curve.getPointAt(u, p);
      this.curve.getTangentAt(u, t);
      const len = Math.hypot(t.x, t.z) || 1;
      // Each keeps to the right of its own way: ours is right of the line, theirs left of it.
      p.x += (-t.z / len) * LANE * car.way;
      p.z += (t.x / len) * LANE * car.way;
      const heading = Math.atan2(t.x, t.z) + (car.way === 1 ? 0 : Math.PI);
      m.compose(p, q.setFromEuler(e.set(0, heading, 0)), hidden ? none : one);
      this.body.setMatrixAt(i, m);
      this.glass.setMatrixAt(i, m);
      this.wheels.setMatrixAt(i, m);
    });
    for (const mesh of [this.body, this.glass, this.wheels]) mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const mt of this.materials) mt.dispose();
    this.object.clear();
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
