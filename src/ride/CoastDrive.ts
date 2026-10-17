import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  type Material,
} from 'three';
import { mulberry32 } from '../utils/random';
import { FamilyCar } from '../world/FamilyCar';
import { coastX, drivePath, LAGOON, landHeight, ROAD_HALF, routeCurve, samplePath, smooth, TURNAROUND_RADIUS, turnaroundCenter } from './coastRoute';

/**
 * The camera shots, in the order "change the view" goes through them: his face from just ahead of his window
 * (looking back along the car, the coast behind him), alongside behind his window looking ahead with him, behind
 * the car, and a drone high above (inland of the car where it can, looking out over it to the sea).
 */
export const DRIVE_VIEWS = ['face', 'alongside', 'chase', 'drone'] as const;
export type DriveView = (typeof DRIVE_VIEWS)[number];

/** How fast the car goes (m/s): cruising, round the turnaround, and easing off and on at the ends (s). */
const SPEED = { cruise: 11.5, turnaround: 6, ease: 5 } as const;

const tmpPos = new Vector3();
const tmpDir = new Vector3();
const tmpA = new Vector3();
const tmpB = new Vector3();
const UP = new Vector3(0, 1, 0);

/**
 * The drive (Phase 6, D33/D34): a stylized homage to the coast road to Torrey Pines, built in code (no map data, no
 * photos), its own scene, loaded only for a ride. The family car follows the road out to the top of the grade and
 * back, about three and a half minutes. Whoever runs the ride puts the dog and the human into `dogSeat` and
 * `driverSeat` (the car's space) and poses them; this scene moves the car, the sea, the birds and the camera.
 */
export class CoastDrive {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(55, 16 / 9, 0.1, 2400);
  readonly car = new FamilyCar();
  /** In the car's space: put the dog's visual in here (the passenger seat), and the human's (the driver's). */
  readonly dogSeat = new Group();
  readonly driverSeat = new Group();
  view: DriveView = 'face';
  private readonly path = drivePath(routeCurve());
  private distance = 0;
  private speed = 0;
  private time = 0;
  private skipping = false;
  private readonly sun = new DirectionalLight('#fff2dc', 2.4);
  private readonly ocean: Mesh<PlaneGeometry, MeshStandardMaterial>;
  private readonly oceanBase: Float32Array;
  private readonly surf: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly birds: Group[] = [];
  private readonly surfers: Object3D[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: CanvasTexture[] = [];
  /** The window the dog leans out of, in the car's space (the close-up looks at it). */
  private readonly window = FamilyCar.WINDOW;

  constructor() {
    this.scene.name = 'Coast drive';
    this.scene.fog = new Fog('#d6e7f2', 180, 1500);
    this.scene.add(this.sky());
    this.scene.add(new HemisphereLight('#dceeff', '#9c8a6a', 1.25));
    this.sun.position.set(-60, 80, 40);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const s = this.sun.shadow.camera;
    s.left = s.bottom = -14;
    s.right = s.top = 14;
    s.near = 1;
    s.far = 220;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(this.terrain());
    const { mesh, base } = this.sea();
    this.ocean = mesh;
    this.oceanBase = base;
    this.scene.add(mesh);
    this.surf = this.surfLine();
    this.scene.add(this.surf);
    this.scene.add(this.road());
    this.scene.add(this.scenery());

    this.car.object.add(this.dogSeat, this.driverSeat);
    this.dogSeat.position.copy(FamilyCar.SEATS.passenger);
    this.driverSeat.position.copy(FamilyCar.SEATS.driver);
    this.car.setPassengerWindow(1);
    this.scene.add(this.car.object);
    this.place(0);
    this.aim();
  }

  /** The whole way round (m) and how far along it the car is (0..1). */
  get length(): number {
    return this.path.length;
  }

  get progress(): number {
    return this.distance / this.path.length;
  }

  /** Home: stopped at the end of the way round. */
  get done(): boolean {
    return this.distance >= this.path.length - 0.01;
  }

  /** Roughly how long the whole drive takes at the usual speeds (s). */
  get expectedDuration(): number {
    return this.path.length / SPEED.cruise + SPEED.ease + 6;
  }

  /** Next camera shot. */
  nextView(): void {
    this.view = DRIVE_VIEWS[(DRIVE_VIEWS.indexOf(this.view) + 1) % DRIVE_VIEWS.length]!;
  }

  /** Head home now: straight on to the last stretch of the way back. */
  skipHome(): void {
    if (this.skipping) return;
    this.skipping = true;
    this.distance = Math.max(this.distance, this.path.length - SPEED.cruise * 12);
  }

  /** The car's window in the world (for a look-at). */
  windowWorld(out: Vector3): Vector3 {
    return this.car.object.localToWorld(out.copy(this.window));
  }

  update(dt: number, aspect: number): void {
    this.time += dt;
    // Speed: easing off from the start, slower round the turnaround, easing to a stop at the end.
    const left = this.path.length - this.distance;
    const atTop = Math.abs(this.distance - this.path.length / 2) < 60;
    let target: number = atTop ? SPEED.turnaround : SPEED.cruise;
    target = Math.min(target, 1.5 + left * 0.45);
    this.speed += (target - this.speed) * Math.min(1, dt / (this.time < SPEED.ease ? 1.6 : 0.9));
    // Within a hand's breadth of home: there.
    const step = left < 0.2 ? left : Math.min(left, this.speed * dt);
    if (left < 0.2) this.speed = 0;
    this.distance += step;
    this.car.roll(step);
    this.place(this.distance);
    this.animateSea(dt);
    this.animateLife(dt);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.aim();
  }

  dispose(): void {
    this.dogSeat.clear();
    this.driverSeat.clear();
    this.car.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.sun.shadow.map?.dispose();
    this.scene.clear();
  }

  // ---- moving things

  private place(s: number): void {
    samplePath(this.path, s, tmpPos, tmpDir);
    const car = this.car.object;
    car.position.copy(tmpPos);
    car.position.y += 0.02;
    // Nose along the way, pitched with the slope.
    tmpA.copy(tmpPos).add(tmpDir);
    car.lookAt(tmpA);
    // The sun's shadow box follows the car.
    this.sun.position.set(tmpPos.x - 60, tmpPos.y + 80, tmpPos.z + 40);
    this.sun.target.position.copy(tmpPos);
    this.sun.target.updateMatrixWorld();
  }

  private aim(): void {
    const car = this.car.object;
    car.updateMatrixWorld();
    const cam = this.camera;
    const head = this.windowWorld(tmpB);
    switch (this.view) {
      case 'alongside':
        // On his side of the car, just behind and above his window, looking ahead with him.
        cam.position.copy(car.localToWorld(tmpA.set(-2.9, 2.1, -2.6)));
        cam.lookAt(car.localToWorld(tmpA.set(-0.7, 1.1, 4)));
        cam.fov = 55;
        break;
      case 'face':
        // Just ahead of the window, outside, looking back along the car at his happy face.
        cam.position.copy(car.localToWorld(tmpA.set(-1.45, 1.38, 2.3)));
        cam.lookAt(head.x, head.y + 0.05, head.z);
        cam.fov = 42;
        break;
      case 'chase':
        cam.position.copy(car.localToWorld(tmpA.set(0, 2.9, -8.5)));
        cam.lookAt(car.localToWorld(tmpA.set(0, 1.2, 6)));
        cam.fov = 55;
        break;
      case 'drone': {
        // High on the inland side (east), a little ahead, looking down over the car to the coast and the sea; where the
        // hills inland would be in the way (up the grade), out over the sea looking back at the bluffs instead.
        const ahead = car.localToWorld(tmpA.set(0, 0, 22)).sub(car.position);
        const p = car.position;
        const inland = Math.max(landHeight(p.x + 34 + ahead.x, p.z + ahead.z), landHeight(p.x + 17 + ahead.x / 2, p.z + ahead.z / 2));
        const side = inland > p.y + 6 ? -1 : 1;
        cam.position.set(p.x + side * 34 + ahead.x, p.y + 22, p.z + ahead.z);
        const clear = Math.max(landHeight(cam.position.x, cam.position.z), 0) + 14;
        if (cam.position.y < clear) cam.position.y = clear;
        cam.lookAt(p.x - side * 6, p.y, p.z);
        cam.fov = 50;
        break;
      }
    }
    // Never under the ground (or the sea).
    const ground = Math.max(landHeight(cam.position.x, cam.position.z), 0) + 0.6;
    if (cam.position.y < ground) cam.position.y = ground;
    cam.updateProjectionMatrix();
  }

  private animateSea(dt: number): void {
    const pos = this.ocean.geometry.attributes.position!;
    const base = this.oceanBase;
    const t = this.time;
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3]!, z = base[i * 3 + 2]!;
      pos.setY(i, 0.25 * Math.sin(x * 0.05 + t * 1.1) + 0.18 * Math.sin(z * 0.07 - t * 0.8) + 0.08 * Math.sin((x + z) * 0.2 + t * 2));
    }
    pos.needsUpdate = true;
    this.ocean.geometry.computeVertexNormals();
    // The surf line breathes in and out.
    this.surf.material.opacity = 0.55 + 0.3 * Math.sin(this.time * 1.4);
    void dt;
  }

  private animateLife(dt: number): void {
    // Pelicans gliding along the shore in a line, gulls wheeling; the surfers bob.
    this.birds.forEach((flock, i) => {
      const t = this.time * (0.25 + i * 0.07) + i * 3;
      const z = -120 - ((t * 40) % 900);
      flock.position.set(coastX(z) + 20 + i * 15, 24 + 4 * Math.sin(t * 0.8 + i), z);
      flock.children.forEach((bird, j) => {
        bird.rotation.z = 0.35 * Math.sin(this.time * (i % 2 ? 7 : 2.4) + j);
      });
    });
    this.surfers.forEach((surfer, i) => {
      surfer.position.y = 0.15 * Math.sin(this.time * 1.3 + i * 1.7);
      surfer.rotation.z = 0.08 * Math.sin(this.time * 1.1 + i);
    });
    void dt;
  }

  // ---- building the world

  private sky(): Mesh {
    const geometry = this.geometry(new SphereGeometry(2000, 32, 16));
    const colors: number[] = [];
    const top = new Color('#5aa3dd'), horizon = new Color('#e4f0f7'), c = new Color();
    const pos = geometry.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const h = Math.max(0, pos.getY(i) / 2000);
      c.copy(horizon).lerp(top, Math.pow(h, 0.6));
      colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
    const sky = new Mesh(geometry, this.material(new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false })));
    sky.renderOrder = -1;
    sky.frustumCulled = false;
    return sky;
  }

  /** The land: one height field over the whole area, with the road cut in and coloured by what it is. */
  private terrain(): Mesh {
    const size = { minX: -520, maxX: 120, minZ: -1080, maxZ: 120 };
    const nx = 128, nz = 220;
    const geometry = this.geometry(new PlaneGeometry(size.maxX - size.minX, size.maxZ - size.minZ, nx, nz).rotateX(-Math.PI / 2));
    geometry.translate((size.minX + size.maxX) / 2, 0, (size.minZ + size.maxZ) / 2);
    const pos = geometry.attributes.position!;
    // The road's middle, every 3 m, to cut it into the land.
    const samples: Vector3[] = [];
    const curve = routeCurve();
    for (let s = 0, L = curve.getLength(); s <= L; s += 3) samples.push(curve.getPointAt(s / L));
    const center = turnaroundCenter(curve);
    const colors = new Float32Array(pos.count * 3);
    const sand = new Color('#e7d4a4'), wetSand = new Color('#c9b07c'), stone = new Color('#d6a467'), stoneDark = new Color('#b98550');
    const scrub = new Color('#8b9a58'), scrubDark = new Color('#6f8148'), lawn = new Color('#79a94f'), seabed = new Color('#3d7f8f');
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      let h = landHeight(x, z);
      // Cut the road (and the turnaround) in: level with it on its width, blending back into the land beyond.
      let best = Infinity, roadY = 0;
      for (const p of samples) {
        const dz = p.z - z;
        if (dz > 40 || dz < -40) continue;
        const d = Math.hypot(p.x - x, dz);
        if (d < best) { best = d; roadY = p.y; }
      }
      const dTurn = Math.hypot(center.x - x, center.z - z);
      if (dTurn < TURNAROUND_RADIUS + 10 && dTurn < best) { best = Math.max(0, dTurn - TURNAROUND_RADIUS); roadY = center.y; }
      const k = 1 - smooth(ROAD_HALF + 1.5, ROAD_HALF + 14, best);
      h = h * (1 - k) + (roadY - 0.25) * k;
      pos.setY(i, h);
      // Colour: the sea floor, wet then dry sand, sandstone where it's steep or up on the bluffs' faces, scrub and
      // lawns on top and inland.
      const shore = x - coastX(z);
      const steep = Math.abs(landHeight(x + 2, z) - landHeight(x - 2, z)) / 4;
      if (h < -0.2) c.copy(seabed);
      else if (shore < 8) c.copy(wetSand);
      else if (h < 4 && shore < 60) c.copy(sand);
      else if (steep > 0.45) c.copy(stone).lerp(stoneDark, 0.5 + 0.5 * Math.sin(h * 0.7 + x * 0.1));
      else if (x > -240 && z > -160) c.copy(lawn);
      else c.copy(scrub).lerp(scrubDark, 0.5 + 0.5 * Math.sin(x * 0.07) * Math.sin(z * 0.05));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, this.material(new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false })));
    mesh.receiveShadow = true;
    mesh.name = 'land';
    return mesh;
  }

  private sea(): { mesh: Mesh<PlaneGeometry, MeshStandardMaterial>; base: Float32Array } {
    const geometry = this.geometry(new PlaneGeometry(1400, 1500, 70, 75).rotateX(-Math.PI / 2));
    geometry.translate(-860, 0, -480);
    const base = new Float32Array(geometry.attributes.position!.array);
    const mesh = new Mesh(geometry, this.material(new MeshStandardMaterial({ color: '#2d82b5', roughness: 0.18, metalness: 0.15 })));
    mesh.receiveShadow = true;
    mesh.name = 'ocean';
    // The lagoon: still and greener.
    const lagoon = new Mesh(this.geometry(new CircleGeometry(1, 40).rotateX(-Math.PI / 2)), this.material(new MeshStandardMaterial({ color: '#4f9a9a', roughness: 0.2 })));
    lagoon.scale.set(LAGOON.rx * 1.1, 1, LAGOON.rz * 1.1);
    lagoon.position.set(LAGOON.x, LAGOON.y, LAGOON.z);
    mesh.add(lagoon);
    lagoon.position.x -= mesh.position.x;
    return { mesh, base };
  }

  /** White water along the shore. */
  private surfLine(): Mesh<BufferGeometry, MeshBasicMaterial> {
    const pts: number[] = [];
    for (let z = -1080; z <= 120; z += 6) {
      const x = coastX(z);
      pts.push(x - 9, 0.35, z, x - 1, 0.35, z);
    }
    const index: number[] = [];
    for (let i = 0; i < pts.length / 6 - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = this.geometry(new BufferGeometry());
    geometry.setAttribute('position', new Float32BufferAttribute(pts, 3));
    geometry.setIndex(index);
    geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, this.material(new MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.7, side: DoubleSide, depthWrite: false })));
    mesh.name = 'surf';
    return mesh;
  }

  /** The road: asphalt, a double yellow line down the middle, white edges; a guard rail over the lagoon. */
  private road(): Group {
    const group = new Group();
    group.name = 'road';
    const curve = routeCurve();
    const L = curve.getLength();
    const ribbons = [
      { half: ROAD_HALF, offset: 0, y: 0.02, color: '#3d3f44' },
      { half: 0.07, offset: 0.12, y: 0.04, color: '#e9c13c' },
      { half: 0.07, offset: -0.12, y: 0.04, color: '#e9c13c' },
      { half: 0.08, offset: ROAD_HALF - 0.35, y: 0.04, color: '#f2f2ee' },
      { half: 0.08, offset: -ROAD_HALF + 0.35, y: 0.04, color: '#f2f2ee' },
    ];
    const tangent = new Vector3();
    for (const r of ribbons) {
      const verts: number[] = [];
      const index: number[] = [];
      const n = Math.ceil(L / 2);
      for (let i = 0; i <= n; i++) {
        const p = curve.getPointAt(i / n);
        curve.getTangentAt(i / n, tangent);
        const len = Math.hypot(tangent.x, tangent.z) || 1;
        const rx = -tangent.z / len, rz = tangent.x / len;
        for (const side of [-1, 1]) verts.push(p.x + rx * (r.offset + side * r.half), p.y + r.y, p.z + rz * (r.offset + side * r.half));
        if (i < n) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const geometry = this.geometry(new BufferGeometry());
      geometry.setAttribute('position', new Float32BufferAttribute(verts, 3));
      geometry.setIndex(index);
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, this.material(new MeshStandardMaterial({ color: r.color, roughness: 0.9, side: DoubleSide })));
      mesh.receiveShadow = true;
      group.add(mesh);
    }
    // The turnaround: a round of asphalt with a planted island in the middle.
    const c = turnaroundCenter(curve);
    const pad = new Mesh(this.geometry(new CircleGeometry(TURNAROUND_RADIUS + ROAD_HALF + 1, 40).rotateX(-Math.PI / 2)), this.material(new MeshStandardMaterial({ color: '#3d3f44', roughness: 0.9 })));
    pad.position.set(c.x, c.y + 0.015, c.z);
    pad.receiveShadow = true;
    const island = new Mesh(this.geometry(new CylinderGeometry(TURNAROUND_RADIUS - 3, TURNAROUND_RADIUS - 2.6, 0.3, 32)), this.material(new MeshStandardMaterial({ color: '#8c9a5a', roughness: 1 })));
    island.position.set(c.x, c.y + 0.15, c.z);
    group.add(pad, island);
    // A white rail along both sides over the lagoon.
    const rail = this.material(new MeshStandardMaterial({ color: '#f1f1ec', roughness: 0.6 }));
    const railBox = this.geometry(new BoxGeometry(0.15, 0.12, 2.1));
    const post = this.geometry(new BoxGeometry(0.12, 0.8, 0.12));
    for (let s = 0; s < L; s += 2) {
      const p = curve.getPointAt(s / L);
      if (Math.abs(p.z - LAGOON.z) > LAGOON.rz * 1.2) continue;
      curve.getTangentAt(s / L, tangent);
      const len = Math.hypot(tangent.x, tangent.z) || 1;
      const rx = -tangent.z / len, rz = tangent.x / len;
      for (const side of [-1, 1]) {
        const x = p.x + rx * side * (ROAD_HALF + 0.3), z = p.z + rz * side * (ROAD_HALF + 0.3);
        const bar = new Mesh(railBox, rail);
        bar.position.set(x, p.y + 0.75, z);
        bar.rotation.y = Math.atan2(tangent.x, tangent.z);
        const leg = new Mesh(post, rail);
        leg.position.set(x, p.y + 0.4, z);
        group.add(bar, leg);
      }
    }
    return group;
  }

  /** Houses and palms round home, the beach's umbrellas, lifeguard tower and surfers, Torrey pines on the bluffs, signs, birds. */
  private scenery(): Group {
    const group = new Group();
    group.name = 'scenery';
    const rand = mulberry32(7);
    const curve = routeCurve();
    const L = curve.getLength();
    const tangent = new Vector3();
    const along = (s: number, side: number, off: number, out: Vector3) => {
      const p = curve.getPointAt(Math.min(1, Math.max(0, s / L)));
      curve.getTangentAt(Math.min(1, Math.max(0, s / L)), tangent);
      const len = Math.hypot(tangent.x, tangent.z) || 1;
      return out.set(p.x + (-tangent.z / len) * side * off, 0, p.z + (tangent.x / len) * side * off);
    };
    const ground = (x: number, z: number) => Math.max(landHeight(x, z), 0);

    // ---- Home's street: houses either side, with palms.
    const walls = ['#f3e7d3', '#e9d9c1', '#f6efe4', '#dfe7e1', '#efe0d0'];
    const roofs = ['#b5653f', '#a65a3a', '#8f5a45'];
    for (let s = 20; s < 230; s += 26) {
      for (const side of [-1, 1]) {
        if (rand() < 0.15) continue;
        const at = along(s + rand() * 8, side, 18 + rand() * 6, new Vector3());
        const house = new Group();
        const w = 9 + rand() * 4, d = 8 + rand() * 3, h = 3.2 + rand() * 1.5;
        const body = new Mesh(this.geometry(new BoxGeometry(w, h, d)), this.material(new MeshStandardMaterial({ color: walls[Math.floor(rand() * walls.length)]!, roughness: 0.9 })));
        body.position.y = h / 2;
        const roof = new Mesh(this.geometry(new ConeGeometry(Math.hypot(w, d) / 2 + 0.4, 2.2, 4)), this.material(new MeshStandardMaterial({ color: roofs[Math.floor(rand() * roofs.length)]!, roughness: 0.8 })));
        roof.position.y = h + 1.1;
        roof.rotation.y = Math.PI / 4;
        roof.scale.set(w / Math.hypot(w, d) * 1.4, 1, d / Math.hypot(w, d) * 1.4);
        house.add(body, roof);
        house.position.set(at.x, ground(at.x, at.z) - 0.2, at.z);
        curve.getTangentAt(Math.min(1, s / L), tangent);
        house.rotation.y = Math.atan2(tangent.x, tangent.z);
        body.castShadow = roof.castShadow = true;
        group.add(house);
      }
    }
    const palm = this.palmGeometry();
    for (let s = 10; s < 420; s += 18) {
      for (const side of [-1, 1]) {
        if (rand() < 0.35) continue;
        const at = along(s, side, ROAD_HALF + 3 + rand() * 3, new Vector3());
        if (at.x < coastX(at.z) + 20) continue;
        const tree = new Mesh(palm.geometry, palm.material);
        tree.position.set(at.x, ground(at.x, at.z), at.z);
        tree.scale.setScalar(0.85 + rand() * 0.4);
        tree.rotation.y = rand() * Math.PI * 2;
        tree.castShadow = true;
        group.add(tree);
      }
    }

    // ---- The beach: umbrellas, the lifeguard tower, surfers in the water.
    const umbrellaColors = ['#e8453c', '#f5c331', '#2d8ad6', '#ffffff', '#3cb371', '#f08a24'];
    const pole = this.geometry(new CylinderGeometry(0.04, 0.04, 2.2, 6));
    const canopy = this.geometry(new ConeGeometry(1.4, 0.6, 10, 1, true));
    const poleMat = this.material(new MeshStandardMaterial({ color: '#f2f2f2' }));
    for (let z = -140; z > -440; z -= 14 + rand() * 10) {
      const x = coastX(z) + 14 + rand() * 18;
      const u = new Group();
      const p = new Mesh(pole, poleMat);
      p.position.y = 1.1;
      const top = new Mesh(canopy, this.material(new MeshStandardMaterial({ color: umbrellaColors[Math.floor(rand() * umbrellaColors.length)]!, side: DoubleSide })));
      top.position.y = 2.2;
      u.add(p, top);
      u.position.set(x, ground(x, z), z);
      u.rotation.z = (rand() - 0.5) * 0.2;
      group.add(u);
    }
    group.add(this.lifeguardTower(coastX(-230) + 22, -230, ground(coastX(-230) + 22, -230)));
    const board = this.geometry(new BoxGeometry(0.5, 0.08, 2.2));
    const person = this.geometry(new CylinderGeometry(0.18, 0.22, 0.9, 8));
    const wetsuit = this.material(new MeshStandardMaterial({ color: '#1b1d22' }));
    const boards = ['#f6f2e7', '#f5c331', '#e8453c', '#7ec8e3'];
    for (let i = 0; i < 9; i++) {
      const z = -170 - i * 34 - rand() * 12;
      const surfer = new Group();
      const b = new Mesh(board, this.material(new MeshStandardMaterial({ color: boards[i % boards.length]! })));
      const body = new Mesh(person, wetsuit);
      body.position.y = 0.5;
      surfer.add(b, body);
      const holder = new Group();
      holder.position.set(coastX(z) - 25 - rand() * 50, 0.15, z);
      holder.rotation.y = rand() * Math.PI;
      holder.add(surfer);
      this.surfers.push(surfer);
      group.add(holder);
    }

    // ---- Torrey pines on the bluffs and at the top: gnarled trunks, flat wind-shaped canopies.
    const trunkGeo = this.geometry(new CylinderGeometry(0.22, 0.4, 5, 7).translate(0, 2.5, 0));
    const crownGeo = this.geometry(new SphereGeometry(1, 10, 7).scale(3.4, 1.2, 2.6));
    const trunkMat = this.material(new MeshStandardMaterial({ color: '#6e5340', roughness: 1 }));
    const crownMat = this.material(new MeshStandardMaterial({ color: '#3f6a3a', roughness: 1 }));
    const spots: Matrix4[] = [];
    const crowns: Matrix4[] = [];
    const q = new Quaternion();
    for (let s = L * 0.55; s < L; s += 7) {
      for (const side of [-1, 1]) {
        if (rand() < 0.45) continue;
        const at = along(s, side, ROAD_HALF + 5 + rand() * 30, new Vector3());
        if (at.x < coastX(at.z) + 18) continue;
        const y = ground(at.x, at.z);
        const lean = (rand() - 0.5) * 0.5;
        q.setFromAxisAngle(new Vector3(0, 0, 1), lean);
        const scale = 0.8 + rand() * 0.6;
        spots.push(new Matrix4().compose(new Vector3(at.x, y - 0.2, at.z), q, new Vector3(scale, scale, scale)));
        const top = new Vector3(Math.sin(-lean) * 4.8 * scale, 4.9 * scale, 0).add(new Vector3(at.x, y, at.z));
        const yaw = new Quaternion().setFromAxisAngle(UP, rand() * Math.PI);
        crowns.push(new Matrix4().compose(top, yaw, new Vector3(scale, scale * (0.8 + rand() * 0.4), scale)));
        if (rand() < 0.4) crowns.push(new Matrix4().compose(top.clone().add(new Vector3(1.8 * scale, -0.8, 1.1)), yaw, new Vector3(scale * 0.6, scale * 0.6, scale * 0.6)));
      }
    }
    const trunks = new InstancedMesh(trunkGeo, trunkMat, spots.length);
    spots.forEach((m, i) => trunks.setMatrixAt(i, m));
    const canopies = new InstancedMesh(crownGeo, crownMat, crowns.length);
    crowns.forEach((m, i) => canopies.setMatrixAt(i, m));
    trunks.castShadow = canopies.castShadow = true;
    group.add(trunks, canopies);

    // ---- Signs: the beach, and the reserve at the top (place names only; original signs).
    group.add(this.sign('TORREY PINES STATE BEACH', along(L * 0.2, 1, ROAD_HALF + 3, new Vector3()), curve, L * 0.2, ground));
    group.add(this.sign('TORREY PINES STATE NATURAL RESERVE', along(L * 0.9, 1, ROAD_HALF + 3, new Vector3()), curve, L * 0.9, ground));

    // ---- Birds: two lines of pelicans and a few gulls.
    const wing = this.geometry(new BoxGeometry(1.6, 0.05, 0.35));
    const pelican = this.material(new MeshStandardMaterial({ color: '#7d7a73' }));
    const gull = this.material(new MeshStandardMaterial({ color: '#f4f4f2' }));
    for (let f = 0; f < 3; f++) {
      const flock = new Group();
      const n = f === 2 ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const bird = new Mesh(wing, f === 2 ? gull : pelican);
        bird.position.set(i * 2.5, 0, i * 3.2);
        flock.add(bird);
      }
      this.birds.push(flock);
      group.add(flock);
    }
    return group;
  }

  private palmGeometry(): { geometry: BufferGeometry; material: Material } {
    // One merged palm: a tall, slightly curved trunk and a crown of drooping fronds, coloured by vertex.
    const parts: { g: BufferGeometry; color: string }[] = [];
    parts.push({ g: new CylinderGeometry(0.18, 0.3, 9, 7).translate(0, 4.5, 0), color: '#8a7259' });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const frond = new BoxGeometry(0.5, 0.06, 3.2).translate(0, 0, 1.6).rotateX(0.55).rotateY(a).translate(0, 9, 0);
      parts.push({ g: frond, color: '#4d8a3a' });
    }
    const merged = new BufferGeometry();
    const positions: number[] = [], normals: number[] = [], colors: number[] = [];
    const c = new Color();
    for (const { g, color } of parts) {
      const ng = g.toNonIndexed();
      ng.computeVertexNormals();
      positions.push(...(ng.attributes.position!.array as Float32Array));
      normals.push(...(ng.attributes.normal!.array as Float32Array));
      c.set(color);
      for (let i = 0; i < ng.attributes.position!.count; i++) colors.push(c.r, c.g, c.b);
      g.dispose();
      ng.dispose();
    }
    merged.setAttribute('position', new Float32BufferAttribute(positions, 3));
    merged.setAttribute('normal', new Float32BufferAttribute(normals, 3));
    merged.setAttribute('color', new Float32BufferAttribute(colors, 3));
    return { geometry: this.geometry(merged), material: this.material(new MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })) };
  }

  private lifeguardTower(x: number, z: number, y: number): Group {
    const tower = new Group();
    const wood = this.material(new MeshStandardMaterial({ color: '#f1efe8' }));
    const blue = this.material(new MeshStandardMaterial({ color: '#3c87c7' }));
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const leg = new Mesh(this.geometry(new BoxGeometry(0.15, 2.4, 0.15)), wood);
      leg.position.set(dx * 1.1, 1.2, dz * 1.1);
      tower.add(leg);
    }
    const hut = new Mesh(this.geometry(new BoxGeometry(2.6, 1.8, 2.6)), blue);
    hut.position.y = 3.3;
    const roof = new Mesh(this.geometry(new BoxGeometry(3, 0.15, 3)), wood);
    roof.position.y = 4.3;
    tower.add(hut, roof);
    tower.position.set(x, y, z);
    tower.rotation.y = -Math.PI / 2;
    tower.traverse((o) => { if (o instanceof Mesh) o.castShadow = true; });
    return tower;
  }

  private sign(text: string, at: Vector3, curve: ReturnType<typeof routeCurve>, s: number, ground: (x: number, z: number) => number): Group {
    const group = new Group();
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    const board = new Mesh(this.geometry(new BoxGeometry(4.2, 1.1, 0.12)), this.material(new MeshStandardMaterial({ color: '#6b4a2f', roughness: 0.9 })));
    board.position.y = 1.6;
    group.add(board);
    if (canvas) {
      canvas.width = 1024; canvas.height = 256;
      const g = canvas.getContext('2d');
      if (g) {
        g.fillStyle = '#6b4a2f'; g.fillRect(0, 0, 1024, 256);
        g.strokeStyle = '#e8d9b4'; g.lineWidth = 10; g.strokeRect(14, 14, 996, 228);
        g.fillStyle = '#f2e6c8'; g.font = 'bold 64px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        const words = text.split(' ');
        const half = Math.ceil(words.length / 2);
        const lines = text.length > 22 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [text];
        lines.forEach((line, i) => g.fillText(line, 512, 128 + (i - (lines.length - 1) / 2) * 76));
        const texture = new CanvasTexture(canvas);
        this.textures.push(texture);
        for (const side of [1, -1]) {
          const face = new Mesh(this.geometry(new PlaneGeometry(4.1, 1.02)), this.material(new MeshBasicMaterial({ map: texture })));
          face.position.set(0, 1.6, side * 0.065);
          if (side < 0) face.rotation.y = Math.PI;
          group.add(face);
        }
      }
    }
    for (const dx of [-1.6, 1.6]) {
      const post = new Mesh(this.geometry(new BoxGeometry(0.16, 1.6, 0.16)), this.material(new MeshStandardMaterial({ color: '#5a3e27' })));
      post.position.set(dx, 0.8, 0);
      group.add(post);
    }
    const tangent = curve.getTangentAt(Math.min(1, s / curve.getLength()));
    group.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.PI / 2;
    group.position.set(at.x, ground(at.x, at.z), at.z);
    return group;
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
