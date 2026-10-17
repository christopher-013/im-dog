import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Path,
  Quaternion,
  Shape,
  ShapeGeometry,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
  type Object3D,
} from 'three';

/**
 * The family car (Phase 6, D34): an original, code-built black electric SUV that reads as the family's Model X by its
 * shape (a long body, a huge windshield sweeping back over the front seats into a gently sloping roof, a light bar
 * across the nose, flush handles, aero wheels), with no name, logo or badge anywhere.
 *
 * Its own space: +z is forward, +y up, the floor at y 0; the passenger (right-hand) side is −x. The passenger's front
 * door opens and its window rolls down (the dog sits there for a ride, head out of the window); the wheels turn.
 * One mesh per part; materials and geometries are its own (dispose()).
 */
export class FamilyCar {
  readonly object = new Group();
  /** Where the seats are, in the car's space (cushion top, middle). */
  static readonly SEATS = {
    passenger: new Vector3(-0.45, 0.62, 0.42),
    driver: new Vector3(0.45, 0.62, 0.42),
  } as const;
  static readonly SIZE = { length: 5.05, width: 1.98, height: 1.68 } as const;
  /** The passenger window's opening: the dog's head goes out about here (car space). */
  static readonly WINDOW = new Vector3(-0.9, 1.22, 0.42);
  private readonly passengerDoor = new Group();
  private readonly passengerWindow: Mesh;
  private readonly wheels: Group[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private doorOpen = 0;
  private windowDown = 0;

  constructor() {
    this.object.name = 'Family car';
    const paint = this.material(new MeshPhysicalMaterial({ color: '#0b0c10', metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 }));
    const glass = this.material(new MeshStandardMaterial({ color: '#0e141c', metalness: 0.8, roughness: 0.05, transparent: true, opacity: 0.86, side: DoubleSide }));
    const trim = this.material(new MeshStandardMaterial({ color: '#050506', roughness: 0.45 }));
    const rubber = this.material(new MeshStandardMaterial({ color: '#141416', roughness: 0.9 }));
    const rim = this.material(new MeshStandardMaterial({ color: '#a3a8ae', metalness: 0.75, roughness: 0.32 }));
    const chrome = this.material(new MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.9, roughness: 0.2 }));
    const lamp = this.material(new MeshStandardMaterial({ color: '#ffffff', emissive: '#f4f8ff', emissiveIntensity: 1.2 }));
    const tail = this.material(new MeshStandardMaterial({ color: '#7a0a10', emissive: '#d0101e', emissiveIntensity: 0.8 }));
    const seat = this.material(new MeshStandardMaterial({ color: '#ebe5d8', roughness: 0.75 }));
    const cabin = this.material(new MeshStandardMaterial({ color: '#1d1e22', roughness: 0.8, side: DoubleSide }));

    const W = FamilyCar.SIZE.width;
    // ---- The body below the windows: one rounded extrusion of its side profile across the car, wheel arches cut
    // out of its bottom edge and the front doors' opening through it (the cabin's front row).
    const bevel = 0.07;
    const body = this.geometry(new ExtrudeGeometry(sideProfile(), {
      depth: W - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: 0.06, bevelSegments: 4, curveSegments: 18,
    }));
    // Shape (u, v) → car (z, y); the extrusion's depth → car −x, centred.
    body.rotateY(-Math.PI / 2).translate(W / 2 - bevel, 0, 0);
    this.add(body, paint, this.object).name = 'body';

    // ---- The cabin's front row, inside the door opening: a dark interior, two cream seats, the dash and the wheel.
    this.add(this.geometry(new BoxGeometry(W - 0.2, 0.02, 0.95)), cabin, this.object, [0, 0.45, 0.55]);
    this.add(this.geometry(new BoxGeometry(W - 0.2, 0.55, 0.02)), cabin, this.object, [0, 0.72, 0.08]);
    for (const s of [FamilyCar.SEATS.passenger, FamilyCar.SEATS.driver]) {
      this.add(this.geometry(new BoxGeometry(0.52, 0.12, 0.5)), seat, this.object, [s.x, s.y - 0.06, s.z + 0.05]);
      this.add(this.geometry(new BoxGeometry(0.5, 0.75, 0.12)), seat, this.object, [s.x, s.y + 0.33, s.z - 0.24], [0.22, 0, 0]);
      this.add(this.geometry(new BoxGeometry(0.28, 0.16, 0.1)), seat, this.object, [s.x, s.y + 0.8, s.z - 0.36], [0.22, 0, 0]);
    }
    this.add(this.geometry(new BoxGeometry(W - 0.25, 0.16, 0.35)), cabin, this.object, [0, 0.98, 1.12]);
    const wheel = this.add(this.geometry(new TorusGeometry(0.17, 0.022, 8, 24)), trim, this.object, [FamilyCar.SEATS.driver.x, 1.05, 0.88], [-1.0, 0, 0]);
    wheel.name = 'steering wheel';

    // ---- The glass: a panoramic windshield running back over the front seats, the roof, the rear window and the
    // side windows (the passenger's front one is the door's, below), with black pillars between.
    const P = GLASS;
    this.add(this.geometry(quad([P.bottomHalf, P.belt, P.cowl], [P.bottomHalf, P.belt, P.cowl], [P.topHalf, P.roofY, P.roofFront], [P.topHalf, P.roofY, P.roofFront])), glass, this.object).name = 'windshield';
    // Behind the windshield the roof is painted (both faces: it's a single skin), meeting the side windows' tops.
    const roofPaint = this.material(new MeshPhysicalMaterial({ color: '#0b0c10', metalness: 0.55, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12, side: DoubleSide }));
    this.add(this.geometry(quad([P.topHalf, P.roofY, P.roofFront], [P.topHalf, P.roofY, P.roofFront], [P.topHalf, P.roofBackY, P.roofBack], [P.topHalf, P.roofBackY, P.roofBack])), roofPaint, this.object).name = 'roof';
    this.add(this.geometry(quad([P.topHalf, P.roofBackY, P.roofBack], [P.topHalf, P.roofBackY, P.roofBack], [P.bottomHalf, P.belt, P.tail], [P.bottomHalf, P.belt, P.tail])), glass, this.object).name = 'rear window';
    for (const side of [1, -1] as const) {
      // Rear side windows (both sides), and the driver's front one.
      this.add(this.geometry(sideGlass(side, rearWindowOutline())), glass, this.object);
      if (side === 1) this.add(this.geometry(sideGlass(side, frontWindowOutline())), glass, this.object);
      // The pillars: along the windshield's edge (A), between the side windows (B), and behind (D).
      this.add(this.geometry(strip([side * P.bottomHalf, P.belt, P.cowl], [side * P.topHalf, P.roofY, P.roofFront], 0.05)), trim, this.object);
      this.add(this.geometry(strip([side * P.bottomHalf, P.belt, 0.0], [side * (P.topHalf + 0.01), 1.6, 0.0], 0.07)), trim, this.object);
      this.add(this.geometry(strip([side * P.bottomHalf, P.belt, P.tail], [side * P.topHalf, P.roofBackY, P.roofBack], 0.06)), trim, this.object);
      // Door seams: the front door's outline, and the long rear (falcon-wing) door's running up into the roof.
      for (const [z0, z1] of [[DOOR.front + 0.02, DOOR.back - 0.02], [DOOR.back - 0.05, -1.32]] as const) {
        this.add(this.geometry(new BoxGeometry(0.006, DOOR.top - DOOR.sill + 0.08, 0.012)), trim, this.object, [side * (W / 2 + 0.012), (DOOR.sill + DOOR.top) / 2 + 0.01, z1]);
        this.add(this.geometry(new BoxGeometry(0.006, 0.012, Math.abs(z1 - z0))), trim, this.object, [side * (W / 2 + 0.012), DOOR.sill - 0.03, (z0 + z1) / 2]);
      }
      // Mirrors.
      this.add(this.geometry(new BoxGeometry(0.2, 0.12, 0.08)), trim, this.object, [side * 1.06, 1.1, 1.18]);
    }

    // ---- Doors. The driver's, closed over its side of the opening; the passenger's opens on a hinge at its front.
    const doorX = W / 2 + 0.005;
    this.add(this.geometry(doorPanel(1)), paint, this.object, [doorX, 0, 0]).name = 'driver door';
    this.add(this.geometry(new BoxGeometry(0.02, 0.025, 0.16)), chrome, this.object, [doorX + 0.01, 0.92, 0.25]);
    this.passengerDoor.name = 'passenger door';
    this.passengerDoor.position.set(-doorX, 0, DOOR.front);
    this.object.add(this.passengerDoor);
    this.add(this.geometry(doorPanel(-1)), paint, this.passengerDoor, [0, 0, -DOOR.front]);
    this.add(this.geometry(new BoxGeometry(0.02, 0.025, 0.16)), chrome, this.passengerDoor, [-0.01, 0.92, 0.25 - DOOR.front]);
    this.passengerWindow = this.add(this.geometry(sideGlass(-1, frontWindowOutline(), -doorX)), glass, this.passengerDoor, [0, 0, -DOOR.front]);
    this.passengerWindow.name = 'passenger window';

    // ---- Wheels: tyres, silver-grey aero rims with five spokes, and a cap.
    for (const [x, z] of [[1, AXLES.front], [-1, AXLES.front], [1, AXLES.rear], [-1, AXLES.rear]] as const) {
      const group = new Group();
      group.position.set(x * (W / 2 - 0.16), WHEEL.radius, z);
      this.object.add(group);
      this.wheels.push(group);
      const spin = new Group();
      group.add(spin);
      this.add(this.geometry(new CylinderGeometry(WHEEL.radius, WHEEL.radius, WHEEL.width, 28)), rubber, spin, [0, 0, 0], [0, 0, Math.PI / 2]);
      this.add(this.geometry(new CylinderGeometry(0.26, 0.26, WHEEL.width + 0.012, 28)), rim, spin, [0, 0, 0], [0, 0, Math.PI / 2]);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        this.add(this.geometry(new BoxGeometry(0.02, 0.21, 0.035)), trim, spin, [x * (WHEEL.width / 2 + 0.008), Math.cos(a) * 0.12, Math.sin(a) * 0.12], [a, 0, 0]);
      }
      this.add(this.geometry(new CylinderGeometry(0.05, 0.05, WHEEL.width + 0.02, 14)), trim, spin, [0, 0, 0], [0, 0, Math.PI / 2]);
    }

    // ---- Lights: the light bar across the nose with the headlamps at its ends, and the full-width tail light.
    this.add(this.geometry(new BoxGeometry(1.5, 0.018, 0.02)), lamp, this.object, [0, 0.77, 2.48]);
    for (const side of [1, -1]) this.add(this.geometry(new BoxGeometry(0.32, 0.05, 0.05)), lamp, this.object, [side * 0.7, 0.72, 2.45], [0, side * -0.3, 0]);
    this.add(this.geometry(new BoxGeometry(1.7, 0.05, 0.03)), tail, this.object, [0, 0.98, -2.55]);
    // A dark lower intake under the nose, and the number-plate recess at the back (blank).
    this.add(this.geometry(new BoxGeometry(1.2, 0.14, 0.04)), trim, this.object, [0, 0.38, 2.54]);
    this.add(this.geometry(new BoxGeometry(0.52, 0.13, 0.02)), trim, this.object, [0, 0.68, -2.58]);
  }

  /** The passenger's front door: 0 shut, 1 wide open. */
  setPassengerDoor(open: number): void {
    this.doorOpen = Math.min(1, Math.max(0, open));
    this.passengerDoor.rotation.y = this.doorOpen * DOOR.openAngle;
  }

  /** The passenger window: 0 up, 1 all the way down (into the door). */
  setPassengerWindow(down: number): void {
    this.windowDown = Math.min(1, Math.max(0, down));
    this.passengerWindow.position.y = -0.52 * this.windowDown;
    this.passengerWindow.visible = this.windowDown < 0.98;
  }

  get passengerDoorOpen(): number {
    return this.doorOpen;
  }

  get passengerWindowDown(): number {
    return this.windowDown;
  }

  /** Turns the wheels for `distance` metres travelled (negative: backwards). */
  roll(distance: number): void {
    for (const wheel of this.wheels) wheel.children[0]!.rotation.x += distance / WHEEL.radius;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.object.removeFromParent();
  }

  private add(geometry: BufferGeometry, material: Material, parent: Object3D, at: [number, number, number] = [0, 0, 0], rotation?: [number, number, number]): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...at);
    if (rotation) mesh.rotation.set(...rotation);
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

const WHEEL = { radius: 0.37, width: 0.25 } as const;
const AXLES = { front: 1.49, rear: -1.48 } as const;
const ARCH = 0.44;
/** The front doors' opening (car z from `back` to `front`, y from `sill` to `top`), and how far the passenger's opens. */
const DOOR = { front: 1.02, back: 0.05, sill: 0.44, top: 1.0, openAngle: 1.15 } as const;
/** The glasshouse: half-widths at the beltline and the roof, and its profile along the car (z) and up (y). */
const GLASS = {
  bottomHalf: 0.86, topHalf: 0.7, belt: 1.06, cowl: 1.32, roofFront: 0.05, roofY: 1.68, roofBack: -1.35, roofBackY: 1.6, tail: -2.36,
} as const;

/** The body's side profile below the windows (z along the car, y up), with the wheel arches and the door opening. */
function sideProfile(): Shape {
  const s = new Shape();
  s.moveTo(2.38, 0.2);
  s.quadraticCurveTo(2.54, 0.22, 2.55, 0.4);
  s.lineTo(2.55, 0.56);
  s.quadraticCurveTo(2.54, 0.78, 2.3, 0.84);
  s.quadraticCurveTo(1.8, 0.96, GLASS.cowl, GLASS.belt - 0.02);
  s.lineTo(-2.1, GLASS.belt + 0.02);
  s.quadraticCurveTo(-2.5, GLASS.belt, -2.56, 0.9);
  s.lineTo(-2.55, 0.4);
  s.quadraticCurveTo(-2.54, 0.22, -2.38, 0.2);
  // Along the bottom, round the rear arch, on, round the front arch, back to the nose.
  for (const axle of [AXLES.rear, AXLES.front]) {
    s.lineTo(axle - ARCH, 0.2);
    s.absarc(axle, WHEEL.radius - 0.02, ARCH, Math.PI, 0, true);
    s.lineTo(axle + ARCH, 0.2);
  }
  s.closePath();
  const door = new Path();
  door.moveTo(DOOR.front, DOOR.sill);
  door.lineTo(DOOR.front, DOOR.top);
  door.lineTo(DOOR.back, DOOR.top);
  door.lineTo(DOOR.back, DOOR.sill);
  door.closePath();
  s.holes.push(door);
  return s;
}

/**
 * A front door's panel: flat, filling the opening with a little overlap, its outer face at x = 0 and its thickness
 * inward (for `side` +1, the driver's, that's −x; for −1, the passenger's, +x).
 */
function doorPanel(side: 1 | -1): BufferGeometry {
  const len = DOOR.front - DOOR.back + 0.05;
  return new BoxGeometry(0.04, DOOR.top - DOOR.sill + 0.06, len).translate(-side * 0.02, (DOOR.sill + DOOR.top) / 2, (DOOR.front + DOOR.back) / 2);
}

/** The front side window's outline (z, y): under the sweep of the windshield, from the mirror back to the B-pillar. */
function frontWindowOutline(): [number, number][] {
  const G = GLASS;
  const yAt = (z: number) => G.belt + ((G.cowl - z) / (G.cowl - G.roofFront)) * (G.roofY - G.belt);
  return [[1.2, G.belt + 0.01], [0.04, G.belt + 0.01], [0.04, yAt(0.04) - 0.03], [1.2, yAt(1.2) - 0.01]];
}

/** The rear side window's outline (z, y): from the B-pillar back under the roof to the tail. */
function rearWindowOutline(): [number, number][] {
  const G = GLASS;
  const roofAt = (z: number) => G.roofY + ((G.roofFront - z) / (G.roofFront - G.roofBack)) * (G.roofBackY - G.roofY);
  return [[-0.04, G.belt + 0.01], [G.tail + 0.08, G.belt + 0.03], [G.roofBack, G.roofBackY], [-0.04, roofAt(-0.04)]];
}

/**
 * A side window: the outline (z, y) as a flat pane on the `side` (+1 the driver's, −1 the passenger's), leaning in
 * toward the roof (from the beltline's half-width to the roof's). `originX`: where its parent sits across the car
 * (a door's own pane is built relative to the door).
 */
function sideGlass(side: 1 | -1, outline: [number, number][], originX = 0): BufferGeometry {
  const shape = new Shape(outline.map(([z, y]) => new Vector2(z, y)));
  const geometry = new ShapeGeometry(shape);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const z = position.getX(i), y = position.getY(i);
    const t = (y - GLASS.belt) / (GLASS.roofY - GLASS.belt);
    const half = GLASS.bottomHalf + (GLASS.topHalf - GLASS.bottomHalf) * t;
    position.setXYZ(i, side * half - originX, y, z);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A quad across the car: its near edge from (−a, y, z) to (+a, y, z), its far edge likewise (each [half-width, y, z]). */
function quad(a: [number, number, number], b: [number, number, number], c: [number, number, number], d: [number, number, number]): BufferGeometry {
  const p = [[-a[0], a[1], a[2]], [b[0], b[1], b[2]], [-c[0], c[1], c[2]], [d[0], d[1], d[2]]];
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([...p[0]!, ...p[1]!, ...p[3]!, ...p[0]!, ...p[3]!, ...p[2]!], 3));
  geometry.computeVertexNormals();
  return geometry;
}

/** A thin bar (a pillar) from `from` to `to`, `width` wide. */
function strip(from: [number, number, number], to: [number, number, number], width: number): BufferGeometry {
  const a = new Vector3(...from), b = new Vector3(...to);
  const geometry = new BoxGeometry(0.035, a.distanceTo(b), width);
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize()));
  const mid = a.add(b).multiplyScalar(0.5);
  geometry.translate(mid.x, mid.y, mid.z);
  return geometry;
}
