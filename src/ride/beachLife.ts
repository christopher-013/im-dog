import {
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  SphereGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { mulberry32 } from '../utils/random';
import { BEACH, coastX, landHeight, ROAD_HALF, roadAt } from './coastRoute';

/** The sea's swell (m) at (x, z) and time t (s): the same sum the sea's shader draws, so swimmers bob with it. */
export function waveHeight(x: number, z: number, t: number): number {
  return 0.22 * Math.sin(x * 0.05 + t * 1.1) + 0.15 * Math.sin(z * 0.07 - t * 0.8) + 0.06 * Math.sin((x + z) * 0.2 + t * 2.0);
}

type Pose = 'stand' | 'walk' | 'sit' | 'lie' | 'swim' | 'wade';

interface Person {
  pose: Pose;
  x: number;
  y: number;
  z: number;
  yaw: number;
  scale: number;
  /** Walkers: m/s along the path (+ south, − north). */
  speed: number;
  phase: number;
  /** Walkers on the path along the road (not the sand). */
  onPath?: boolean;
}

const SKIN = ['#f1c7a5', '#e0ac85', '#c68a62', '#9a6644', '#6e4630', '#f6d5bd'];
const HAIR = ['#2b1d14', '#4a3020', '#8a5a2b', '#d9b56a', '#1a1a1a', '#bdbdbd', '#a0522d'];
const TOPS = ['#e8453c', '#2d8ad6', '#f5c331', '#3cb371', '#ff7eb6', '#1b1d22', '#ffffff', '#8e5bd6', '#f08a24', '#20b2aa'];
const BOTTOMS = ['#2d4f8a', '#d8c6a0', '#1b1d22', '#e8453c', '#3cb371', '#6b8fb5', '#f5c331'];
const BLANKETS = ['#d64541', '#2f6db5', '#f2c94c', '#ffffff', '#47a36b', '#f28d35', '#9b59b6'];
const UMBRELLAS = ['#e8453c', '#f5c331', '#2d8ad6', '#ffffff', '#3cb371', '#f08a24', '#ff7eb6'];
const BOARDS = ['#f6f2e7', '#f5c331', '#e8453c', '#7ec8e3', '#ffffff'];

/** The parts of a person (in their own space: feet at the origin, +z the way they face) for each pose. */
const PARTS: Record<Pose, { legs: [number, number, number, number] | null; torso: [number, number, number, number]; head: [number, number, number] }> = {
  // [x, y, z, pitch] for the legs and the torso; [x, y, z] for the head.
  stand: { legs: [0, 0.42, 0, 0], torso: [0, 1.14, 0, 0], head: [0, 1.58, 0] },
  walk: { legs: [0, 0.42, 0, 0], torso: [0, 1.14, 0, 0.05], head: [0, 1.58, 0.03] },
  sit: { legs: [0, 0.1, 0.4, Math.PI / 2], torso: [0, 0.42, 0, -0.1], head: [0, 0.86, -0.04] },
  lie: { legs: [0, 0.1, 0.45, Math.PI / 2], torso: [0, 0.16, -0.27, Math.PI / 2], head: [0, 0.14, -0.7] },
  swim: { legs: null, torso: [0, -0.42, 0, 0.3], head: [0, 0.06, 0.06] },
  wade: { legs: [0, 0.42, 0, 0], torso: [0, 1.14, 0, 0], head: [0, 1.58, 0] },
};

const m = new Matrix4();
const part = new Matrix4();
const q = new Quaternion();
const e = new Euler();
const v = new Vector3();
const s = new Vector3();
const ZERO = new Matrix4().makeScale(0, 0, 0);

/**
 * Life on the beach for the ride (owner, 2026-10-17: "the ocean on the right with people swimming and picnic'ing"):
 * swimmers bobbing in the surf, people wading, families picnicking on blankets under umbrellas, sunbathers on towels,
 * surfers waiting for a wave, people walking the path along the road and the water's edge, and the lifeguard towers.
 * Simple, toy-like figures, all instanced (a few draw calls for everyone). Built in code.
 */
export class BeachLife {
  readonly object = new Group();
  private readonly people: Person[] = [];
  private readonly legs: InstancedMesh;
  private readonly torso: InstancedMesh;
  private readonly head: InstancedMesh;
  private readonly hair: InstancedMesh;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private placed = false;

  constructor(seed = 11) {
    this.object.name = 'beach life';
    const rand = mulberry32(seed);
    const pick = <T>(list: readonly T[]) => list[Math.floor(rand() * list.length)]!;
    const blankets: Matrix4[] = [], blanketColors: string[] = [];
    const umbrellas: Matrix4[] = [], umbrellaColors: string[] = [];
    const coolers: Matrix4[] = [];
    const boards: Matrix4[] = [], boardColors: string[] = [];
    const place = (x: number, y: number, z: number, yaw: number, sx: number, sy: number, sz: number) =>
      new Matrix4().compose(v.set(x, y, z), q.setFromEuler(e.set(0, yaw, 0)), s.set(sx, sy, sz));
    const add = (pose: Pose, x: number, y: number, z: number, yaw: number, scale = 1, speed = 0) =>
      this.people.push({ pose, x, y, z, yaw, scale, speed, phase: rand() * 10 });

    // The sand: picnics, sunbathers, families, from the lagoon to the foot of the bluffs.
    for (let z = BEACH.zMin + 25; z < BEACH.zMax - 20; z += 4 + rand() * 7) {
      const shore = coastX(z);
      const back = roadAt(z).x - ROAD_HALF - 9;
      if (back - shore < 18) continue;
      const x = shore + 9 + rand() * (back - shore - 14);
      const y = landHeight(x, z);
      const facing = -Math.PI / 2 + (rand() - 0.5) * 0.8; // toward the sea (west)
      const kind = rand();
      if (kind < 0.45) {
        // A picnic: a blanket, two to four sitting round it, a cooler, often an umbrella.
        blankets.push(place(x, y + 0.02, z, facing, 1, 1, 1));
        blanketColors.push(pick(BLANKETS));
        const n = 2 + Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) {
          const a = facing + (i / n) * Math.PI * 2;
          add('sit', x + Math.sin(a) * 0.95, y, z + Math.cos(a) * 0.95, a + Math.PI, i === n - 1 && rand() < 0.5 ? 0.7 : 1);
        }
        coolers.push(place(x + 0.3, y + 0.15, z - 0.2, facing, 1, 1, 1));
        if (rand() < 0.7) {
          umbrellas.push(place(x - 0.9, y, z + 0.6, 0, 1, 1, 1));
          umbrellaColors.push(pick(UMBRELLAS));
        }
      } else if (kind < 0.75) {
        // Sunbathers on towels.
        const n = 1 + Math.floor(rand() * 2);
        for (let i = 0; i < n; i++) {
          const tx = x + i * 1.1;
          blankets.push(place(tx, y + 0.02, z, facing + Math.PI / 2, 0.45, 1, 1.35));
          blanketColors.push(pick(BLANKETS));
          add('lie', tx, y + 0.03, z, facing + Math.PI / 2);
        }
        if (rand() < 0.5) {
          umbrellas.push(place(x + 0.5, y, z - 1.2, 0, 1, 1, 1));
          umbrellaColors.push(pick(UMBRELLAS));
        }
      } else {
        // A family standing about, a kid or two.
        const n = 2 + Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) add('stand', x + (rand() - 0.5) * 3, y, z + (rand() - 0.5) * 3, facing + (rand() - 0.5) * 2, i > 1 ? 0.65 : 1);
      }
    }
    // In the water: swimmers in the surf, people wading in the shallows.
    for (let z = BEACH.zMin; z < BEACH.zMax + 80; z += 4 + rand() * 8) {
      const shore = coastX(z);
      const n = 1 + Math.floor(rand() * 3);
      for (let i = 0; i < n; i++) {
        if (rand() < 0.3) add('wade', shore - 1.5 - rand() * 3, -0.45, z + rand() * 3, -Math.PI / 2 + (rand() - 0.5) * 2, rand() < 0.3 ? 0.7 : 1);
        else add('swim', shore - 5 - rand() * 26, 0, z + rand() * 4, rand() * Math.PI * 2);
      }
    }
    // Surfers sitting on their boards out past the break.
    for (let i = 0; i < 22; i++) {
      const z = BEACH.zMin + 40 + rand() * (BEACH.zMax - BEACH.zMin);
      const x = coastX(z) - 40 - rand() * 45;
      const yaw = -Math.PI / 2 + Math.PI + (rand() - 0.5) * 0.6; // facing the beach, waiting
      add('sit', x, -0.15, z, yaw);
      boards.push(place(x, 0.02, z + 0.2, yaw, 1, 1, 1));
      boardColors.push(pick(BOARDS));
    }
    // Walkers: on the path by the road (beyond the rail; they follow the road, see `update`) and along the water's edge.
    for (let i = 0; i < 46; i++) {
      const onPath = i % 3 !== 2;
      const z = BEACH.zMin + rand() * (BEACH.zMax - BEACH.zMin);
      const speed = (rand() < 0.5 ? 1 : -1) * (1.1 + rand() * 0.5);
      add('walk', onPath ? 0 : coastX(z) + 3 + rand() * 3, 0, z, 0, i % 5 === 0 ? 0.7 : 1, speed);
      this.people[this.people.length - 1]!.onPath = onPath;
    }

    // ---- Meshes
    const n = this.people.length;
    const mat = (o: ConstructorParameters<typeof MeshStandardMaterial>[0]) => this.material(new MeshStandardMaterial(o));
    this.legs = new InstancedMesh(this.geometry(new BoxGeometry(0.3, 0.84, 0.17)), mat({ roughness: 0.8 }), n);
    this.torso = new InstancedMesh(this.geometry(new CylinderGeometry(0.15, 0.19, 0.62, 6, 1)), mat({ roughness: 0.8 }), n);
    this.head = new InstancedMesh(this.geometry(new SphereGeometry(0.115, 7, 5)), mat({ roughness: 0.7 }), n);
    this.hair = new InstancedMesh(this.geometry(new SphereGeometry(0.122, 7, 3, 0, Math.PI * 2, 0, Math.PI * 0.55)), mat({ roughness: 0.9 }), n);
    const c = new Color();
    this.people.forEach((p, i) => {
      const skin = pick(SKIN);
      const swimsuit = p.pose === 'swim' || p.pose === 'wade' || p.pose === 'lie' || rand() < 0.4;
      this.legs.setColorAt(i, c.set(swimsuit && rand() < 0.6 ? skin : pick(BOTTOMS)));
      this.torso.setColorAt(i, c.set(swimsuit && rand() < 0.35 ? skin : pick(TOPS)));
      this.head.setColorAt(i, c.set(skin));
      this.hair.setColorAt(i, c.set(pick(HAIR)));
    });
    for (const mesh of [this.legs, this.torso, this.head, this.hair]) {
      // (Too small and too many for shadows worth drawing twice.)
      mesh.frustumCulled = false;
      this.object.add(mesh);
    }
    this.update(0, 0);

    const things = (geometry: BufferGeometry, material: Material, list: Matrix4[], colors?: string[]) => {
      const mesh = new InstancedMesh(this.geometry(geometry), material, Math.max(1, list.length));
      list.forEach((matrix, i) => {
        mesh.setMatrixAt(i, matrix);
        if (colors) mesh.setColorAt(i, c.set(colors[i]!));
      });
      if (list.length === 0) mesh.setMatrixAt(0, ZERO);
      this.object.add(mesh);
      return mesh;
    };
    things(new BoxGeometry(1.9, 0.03, 1.5), mat({ roughness: 1 }), blankets, blanketColors);
    things(new BoxGeometry(0.5, 0.3, 0.32), mat({ color: '#2d7dd2', roughness: 0.6 }), coolers);
    things(new CylinderGeometry(0.035, 0.035, 2.3, 6).translate(0, 1.15, 0), mat({ color: '#f2f2f2' }), umbrellas);
    things(new ConeGeometry(1.45, 0.55, 8, 1, true).translate(0, 2.25, 0), mat({ side: DoubleSide, roughness: 0.8 }), umbrellas, umbrellaColors);
    things(new BoxGeometry(0.55, 0.08, 2.3), mat({ roughness: 0.5 }), boards, boardColors);
    // The lifeguard towers, one every couple of hundred metres.
    for (let z = BEACH.zMin + 70; z < BEACH.zMax; z += 210) {
      const x = coastX(z) + 17;
      this.object.add(this.tower(x, landHeight(x, z), z));
    }
  }

  /** Each frame: the walkers walk, the swimmers and surfers bob. */
  update(dt: number, time: number): void {
    const span = BEACH.zMax - BEACH.zMin;
    this.people.forEach((p, i) => {
      // The ones sitting and standing about on the sand stay put: placed once.
      const still = p.pose === 'stand' || p.pose === 'lie' || (p.pose === 'sit' && p.y >= 0);
      if (still && this.placed) return;
      let { x, y } = p;
      let yaw = p.yaw;
      let bob = 0;
      if (p.pose === 'walk') {
        p.z += p.speed * dt;
        if (p.z > BEACH.zMax) p.z -= span;
        if (p.z < BEACH.zMin) p.z += span;
        yaw = p.speed > 0 ? 0 : Math.PI;
        if (p.onPath) {
          // On the path just beyond the rail, at the road's level.
          const road = roadAt(p.z);
          x = road.x - ROAD_HALF - 1.9;
          y = road.y - 0.25;
          yaw += Math.atan2(roadAt(p.z + 2).x - road.x, 2) * (p.speed > 0 ? 1 : -1);
        } else {
          x = coastX(p.z) + 4;
          y = landHeight(x, p.z);
        }
        bob = 0.03 * Math.abs(Math.sin(time * 6 + p.phase));
      } else if (p.pose === 'swim') {
        y = waveHeight(p.x, p.z, time);
        yaw = p.yaw + 0.3 * Math.sin(time * 0.4 + p.phase);
      } else if (p.pose === 'sit' && p.y < 0) {
        y = -0.15 + 0.6 * waveHeight(p.x, p.z, time);
      }
      const k = PARTS[p.pose];
      m.compose(v.set(x, y + bob, p.z), q.setFromEuler(e.set(0, yaw, 0)), s.setScalar(p.scale));
      if (k.legs) this.legs.setMatrixAt(i, this.at(k.legs[0], k.legs[1], k.legs[2], k.legs[3]));
      else this.legs.setMatrixAt(i, ZERO);
      this.torso.setMatrixAt(i, this.at(k.torso[0], k.torso[1], k.torso[2], k.torso[3]));
      this.head.setMatrixAt(i, this.at(k.head[0], k.head[1], k.head[2], 0));
      this.hair.setMatrixAt(i, this.at(k.head[0], k.head[1] + 0.012, k.head[2] - 0.012, p.pose === 'lie' ? -Math.PI / 2 : 0));
    });
    for (const mesh of [this.legs, this.torso, this.head, this.hair]) mesh.instanceMatrix.needsUpdate = true;
    this.placed = true;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const mt of this.materials) mt.dispose();
    this.object.clear();
  }

  /** The person's matrix (`m`) times a part's offset and pitch. */
  private at(x: number, y: number, z: number, pitch: number): Matrix4 {
    part.compose(v.set(x, y, z), q.setFromEuler(e.set(pitch, 0, 0)), s.set(1, 1, 1));
    return part.premultiply(m);
  }

  private tower(x: number, y: number, z: number): Group {
    const tower = new Group();
    const white = this.material(new MeshStandardMaterial({ color: '#f1efe8' }));
    const blue = this.material(new MeshStandardMaterial({ color: '#3c87c7' }));
    const leg = this.geometry(new BoxGeometry(0.15, 2.4, 0.15));
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const l = new Mesh(leg, white);
      l.position.set(dx * 1.1, 1.2, dz * 1.1);
      tower.add(l);
    }
    const hut = new Mesh(this.geometry(new BoxGeometry(2.6, 1.8, 2.6)), blue);
    hut.position.y = 3.3;
    const roof = new Mesh(this.geometry(new BoxGeometry(3.1, 0.15, 3.1)), white);
    roof.position.y = 4.3;
    const ramp = new Mesh(this.geometry(new BoxGeometry(0.9, 0.08, 3.2)), white);
    ramp.position.set(0, 1.2, 2.6);
    ramp.rotation.x = 0.75;
    tower.add(hut, roof, ramp);
    tower.position.set(x, y, z);
    tower.rotation.y = Math.PI / 2;
    tower.traverse((o) => { if (o instanceof Mesh) o.castShadow = true; });
    return tower;
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
