import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  DoubleSide,
  EquirectangularReflectionMapping,
  Float32BufferAttribute,
  Group,
  Matrix4,
  Mesh,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Quaternion,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  type Material,
  type Object3D,
  type Texture,
} from 'three';

/**
 * The family car (Phase 6, D34): an original, code-built black electric SUV modelled on the family's own Model X
 * (owner's photo, 2026-10-17; the photo is private and not in the repo). One smooth sculpted body: a rounded nose and
 * hood, swept-back headlamps with their light strip, a thin chrome strip across the nose, a dark lower intake with
 * chrome fog-lamp trim; a glasshouse in one arc, the panoramic windscreen sweeping up over the cream seats into the
 * roof and down the rear window, chrome along the windows; and the falcon-wing rear doors, each hinged at the roof's
 * spine and again at the top of its window, rising up and out like wings. No name, logo, badge or number plate.
 *
 * Its own space: +z is forward, +y up, the floor at y 0; the passenger (right-hand) side is −x. The passenger's front
 * door opens and its window rolls down (the dog sits there for a ride, head out of the window); the falcon doors rise;
 * the wheels turn. Materials and geometries are its own (dispose()).
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
  private readonly driverDoor = new Group();
  private readonly passengerWindow: Mesh;
  /** Each falcon door: the part that turns at the roof's spine, and the part that turns at the top of its window. */
  private readonly falcons: { hinge: Group; elbow: Group; side: 1 | -1 }[] = [];
  private readonly wheels: Group[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: Texture[] = [];
  private doorOpen = 0;
  private driverOpen = 0;
  private windowDown = 0;
  private falconOpen = 0;

  constructor() {
    this.object.name = 'Family car';
    const sky = this.reflections();
    const paint = this.material(new MeshPhysicalMaterial({
      color: '#07080b', metalness: 0.35, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.06, envMap: sky, envMapIntensity: 0.5, side: DoubleSide,
    }));
    const glassLook = { metalness: 0.6, roughness: 0.04, transparent: true, envMap: sky, envMapIntensity: 1.2, side: DoubleSide, depthWrite: false } as const;
    const windscreen = this.material(new MeshStandardMaterial({ color: '#18222c', opacity: 0.45, ...glassLook }));
    const glass = this.material(new MeshStandardMaterial({ color: '#0d1319', opacity: 0.8, ...glassLook }));
    // Up top and at the back the glass is black (the windscreen's tinted top over the front seats, the roof glass in
    // the falcon doors, the rear window): from outside the roof reads as glossy black.
    const roofGlass = this.material(new MeshStandardMaterial({ color: '#06080b', metalness: 0.6, roughness: 0.05, envMap: sky, envMapIntensity: 1.3, side: DoubleSide }));
    const trim = this.material(new MeshStandardMaterial({ color: '#050506', roughness: 0.4, side: DoubleSide }));
    const rubber = this.material(new MeshStandardMaterial({ color: '#141416', roughness: 0.9, side: DoubleSide }));
    const rim = this.material(new MeshStandardMaterial({ color: '#141518', metalness: 0.55, roughness: 0.36, envMap: sky, envMapIntensity: 0.8, side: DoubleSide }));
    const caliper = this.material(new MeshStandardMaterial({ color: '#c8161d', roughness: 0.4 }));
    const disc = this.material(new MeshStandardMaterial({ color: '#7b7f85', metalness: 0.8, roughness: 0.35 }));
    const chrome = this.material(new MeshStandardMaterial({ color: '#d6dae0', metalness: 1, roughness: 0.12, envMap: sky, envMapIntensity: 1.4 }));
    const lens = this.material(new MeshStandardMaterial({ color: '#1a1d22', metalness: 0.8, roughness: 0.1, envMap: sky, envMapIntensity: 1.3, side: DoubleSide }));
    const lamp = this.material(new MeshStandardMaterial({ color: '#ffffff', emissive: '#f4f8ff', emissiveIntensity: 1.4 }));
    const tail = this.material(new MeshStandardMaterial({ color: '#6a0a10', emissive: '#d0101e', emissiveIntensity: 0.8, roughness: 0.2 }));
    const seat = this.material(new MeshStandardMaterial({ color: '#ece6da', roughness: 0.7 }));
    const cabin = this.material(new MeshStandardMaterial({ color: '#202126', roughness: 0.85, side: DoubleSide }));

    // ---- The body: one smooth shell lofted along the car, open on top along the cabin (the glasshouse sits on it),
    // the wheel arches cut into its sides; the front doors' and the falcon doors' panels are cut out of it.
    const body = loftBody();
    this.add(this.geometry(body.body), paint, this.object).name = 'body';
    for (const axle of [AXLES.front, AXLES.rear]) {
      // The wheel wells' dark liners.
      const well = new CylinderGeometry(ARCH - 0.01, ARCH - 0.01, FamilyCar.SIZE.width - 0.14, 20, 1, true, 0, Math.PI);
      this.add(this.geometry(well.rotateZ(Math.PI / 2)), rubber, this.object, [0, WHEEL.radius - 0.02, axle]);
    }
    // ---- The glasshouse, likewise one shell: the windscreen, the falcon doors' tops and windows, the rear window,
    // the front doors' and the fixed rear windows, with the black pillars between.
    const house = loftGlasshouse();
    this.add(this.geometry(house.windscreen), windscreen, this.object).name = 'windshield';
    this.add(this.geometry(house.screenTop), roofGlass, this.object);
    this.add(this.geometry(house.rear), roofGlass, this.object).name = 'rear window';
    this.add(this.geometry(house.quarters), glass, this.object);
    this.add(this.geometry(house.pillars), trim, this.object).name = 'roof';

    // ---- Inside: the floor, the dash, the console, cream seats (two in front, two captain's chairs behind), the wheel.
    this.add(this.geometry(new BoxGeometry(1.7, 0.03, 3.4)), cabin, this.object, [0, 0.4, -0.55]);
    this.add(this.geometry(new BoxGeometry(1.66, 0.2, 0.42)), cabin, this.object, [0, 0.92, 1.12]);
    this.add(this.geometry(new BoxGeometry(0.22, 0.24, 0.9)), cabin, this.object, [0, 0.52, 0.55]);
    const seats: [number, number, number][] = [
      [FamilyCar.SEATS.passenger.x, FamilyCar.SEATS.passenger.y, FamilyCar.SEATS.passenger.z],
      [FamilyCar.SEATS.driver.x, FamilyCar.SEATS.driver.y, FamilyCar.SEATS.driver.z],
      [-0.45, 0.66, -0.78],
      [0.45, 0.66, -0.78],
    ];
    for (const [x, y, z] of seats) {
      this.add(this.geometry(roundedBox(0.5, 0.13, 0.5)), seat, this.object, [x, y - 0.065, z + 0.05]);
      this.add(this.geometry(roundedBox(0.48, 0.66, 0.12)), seat, this.object, [x, y + 0.31, z - 0.23], [0.2, 0, 0]);
      this.add(this.geometry(roundedBox(0.3, 0.2, 0.11)), seat, this.object, [x, y + 0.76, z - 0.33], [0.2, 0, 0]);
    }
    const wheel = this.add(this.geometry(new TorusGeometry(0.17, 0.022, 8, 24)), trim, this.object, [FamilyCar.SEATS.driver.x, 1.03, 0.9], [-1.0, 0, 0]);
    wheel.name = 'steering wheel';

    for (const side of [1, -1] as const) {
      // Chrome along the bottom of the windows (the fixed stretches; the doors carry their own).
      this.add(this.geometry(beltLine(side, GLASS.cowl, DOOR.front)), chrome, this.object);
      this.add(this.geometry(beltLine(side, FALCON.back, GLASS.tail + 0.08)), chrome, this.object);
      // The A-pillars, along the windscreen's sides, and chrome round the tops of the windows (the fixed stretches).
      this.add(this.geometry(houseLine(side, DOOR.back, GLASS.cowl - 0.02, 0.045)), trim, this.object);
      this.add(this.geometry(houseLine(side, DOOR.back, GLASS.cowl - 0.02, 0.008, -0.05)), chrome, this.object);
      this.add(this.geometry(houseLine(side, GLASS.tail + 0.1, FALCON.back - 0.08, 0.008, -0.05)), chrome, this.object);
      // Mirrors: a rounded black shell on a short stalk.
      const mirror = this.add(this.geometry(new SphereGeometry(1, 14, 10)), paint, this.object, [side * 1.05, 1.08, 1.12]);
      mirror.scale.set(0.12, 0.075, 0.075);
      this.add(this.geometry(new BoxGeometry(0.12, 0.03, 0.05)), trim, this.object, [side * 0.95, 1.06, 1.13]);
      // Door seams.
      for (const z of [DOOR.front, DOOR.back, FALCON.front, FALCON.back]) this.add(this.geometry(seam(side, z)), trim, this.object);
    }

    // ---- The front doors, each on a hinge at its front, its window in it.
    const hingeX = sideX(DOOR.front, 0.75);
    this.driverDoor.name = 'driver door';
    this.driverDoor.position.set(hingeX, 0, DOOR.front);
    this.object.add(this.driverDoor);
    const driverLocal: [number, number, number] = [-hingeX, 0, -DOOR.front];
    this.add(this.geometry(body.doors[1]), paint, this.driverDoor, driverLocal);
    this.add(this.geometry(doorCard(1, DOOR.back, DOOR.front)), cabin, this.driverDoor, driverLocal);
    this.add(this.geometry(beltLine(1, DOOR.front, DOOR.back + 0.01)), chrome, this.driverDoor, driverLocal);
    this.add(this.geometry(handle(1)), chrome, this.driverDoor, driverLocal);
    this.add(this.geometry(house.windows[1]), glass, this.driverDoor, driverLocal);
    this.passengerDoor.name = 'passenger door';
    this.passengerDoor.position.set(-hingeX, 0, DOOR.front);
    this.object.add(this.passengerDoor);
    const local: [number, number, number] = [hingeX, 0, -DOOR.front];
    this.add(this.geometry(body.doors[-1]), paint, this.passengerDoor, local);
    this.add(this.geometry(doorCard(-1, DOOR.back, DOOR.front)), cabin, this.passengerDoor, local);
    this.add(this.geometry(beltLine(-1, DOOR.front, DOOR.back + 0.01)), chrome, this.passengerDoor, local);
    this.add(this.geometry(handle(-1)), chrome, this.passengerDoor, local);
    this.passengerWindow = this.add(this.geometry(house.windows[-1]), glass, this.passengerDoor, local);
    this.passengerWindow.name = 'passenger window';

    // ---- The falcon doors. Each turns at the roof's spine (its top half), and its window and lower door turn the
    // other way at the top of the window: up, they stand tall and reach out over the side.
    for (const side of [1, -1] as const) {
      const spine = axis(houseRim(FALCON.front, Math.PI / 2), houseRim(FALCON.back, Math.PI / 2));
      const elbowAngle = side === 1 ? RIM.elbow : Math.PI - RIM.elbow;
      const rim = axis(houseRim(FALCON.front, elbowAngle), houseRim(FALCON.back, elbowAngle));
      const hingeRest = new Group();
      hingeRest.name = side === 1 ? 'falcon door (driver side)' : 'falcon door (passenger side)';
      hingeRest.applyMatrix4(spine);
      this.object.add(hingeRest);
      const hinge = new Group();
      hingeRest.add(hinge);
      const elbowRest = new Group();
      elbowRest.applyMatrix4(new Matrix4().copy(spine).invert().multiply(rim));
      hinge.add(elbowRest);
      const elbow = new Group();
      elbowRest.add(elbow);
      const fromSpine = new Matrix4().copy(spine).invert();
      const fromRim = new Matrix4().copy(rim).invert();
      this.add(this.geometry(house.falconTops[side]), roofGlass, hinge).applyMatrix4(fromSpine);
      const lower: [BufferGeometry, Material][] = [
        [house.falconWindows[side], glass],
        [body.falcons[side], paint],
        [doorCard(side, FALCON.back, FALCON.front), cabin],
        [beltLine(side, FALCON.front, FALCON.back), chrome],
        [houseLine(side, FALCON.back + 0.01, FALCON.front - 0.01, 0.03), trim],
        [houseLine(side, FALCON.back + 0.01, FALCON.front - 0.01, 0.008, -0.05), chrome],
      ];
      for (const [geometry, material] of lower) this.add(this.geometry(geometry), material, elbow).applyMatrix4(fromRim);
      this.falcons.push({ hinge, elbow, side });
    }

    // ---- Wheels: tyres round black turbine wheels (ten swept blades, dished toward the hub), and behind them the
    // brake discs and the red calipers, which stay put while the wheels turn.
    const W = FamilyCar.SIZE.width;
    const blades = this.geometry(turbine());
    const tyre = this.geometry(new CylinderGeometry(WHEEL.radius, WHEEL.radius, WHEEL.width, 32, 1, true).rotateZ(Math.PI / 2));
    const wall = this.geometry(new RingGeometry(WHEEL.rim, WHEEL.radius, 32).rotateY(Math.PI / 2));
    const barrel = this.geometry(new CylinderGeometry(WHEEL.rim, WHEEL.rim, WHEEL.width - 0.02, 28, 1, true).rotateZ(Math.PI / 2));
    const lip = this.geometry(new TorusGeometry(WHEEL.rim, 0.012, 6, 36).rotateY(Math.PI / 2));
    const brake = this.geometry(new CylinderGeometry(0.21, 0.21, 0.025, 24).rotateZ(Math.PI / 2));
    const clamp = this.geometry(new BoxGeometry(0.075, 0.16, 0.08));
    for (const [x, z] of [[1, AXLES.front], [-1, AXLES.front], [1, AXLES.rear], [-1, AXLES.rear]] as const) {
      const group = new Group();
      group.position.set(x * (W / 2 - 0.17), WHEEL.radius, z);
      this.object.add(group);
      this.wheels.push(group);
      const spin = new Group();
      group.add(spin);
      const face = x * (WHEEL.width / 2);
      this.add(tyre, rubber, spin);
      for (const at of [face, -face]) this.add(wall, rubber, spin, [at, 0, 0]);
      this.add(barrel, rim, spin);
      this.add(lip, rim, spin, [face - x * 0.006, 0, 0]);
      this.add(blades, rim, spin, [face - x * 0.012, 0, 0]).scale.x = x;
      this.add(brake, disc, group, [-x * 0.02, 0, 0]);
      // The caliper grips the disc toward the back of the car, just above the middle.
      this.add(clamp, caliper, group, [x * 0.01, 0.07, -0.16], [0.4, 0, 0]);
    }

    // ---- The nose: the headlamps (like the real car's: long and swept, thin toward the middle and taller at the
    // corner, wrapping round onto the fender; a smoked lens over chrome and a projector, and the thick light strip
    // along the bottom hooking up at the outer end), the thin chrome strip across the front, the dark lower intake,
    // chrome fog-lamp trim; at the back, the tail lamps and a chrome strip.
    for (const side of [1, -1] as const) {
      const at = (s: number, y: number, out: number) => lampPoint(side, s, y, out);
      const bottom = LAMP.s.map((s, i) => at(s, LAMP.bottom[i]!, 0.006));
      const top = LAMP.s.map((s, i) => at(s, LAMP.top[i]!, 0.004));
      this.add(this.geometry(ribbon(bottom, top)), lens, this.object);
      // The chrome inside it, and the projector's round lens at the corner.
      const inner = LAMP.s.slice(1, -1);
      this.add(this.geometry(ribbon(
        inner.map((s, i) => at(s, LAMP.bottom[i + 1]! + 0.018, 0.007)),
        inner.map((s, i) => at(s, LAMP.top[i + 1]! - 0.014, 0.007)),
      )), chrome, this.object);
      const eye = at(0.98, (LAMP.bottom[3]! + LAMP.top[3]!) / 2, 0.012);
      const projector = this.add(this.geometry(new SphereGeometry(1, 12, 8)), lens, this.object, [eye.x, eye.y, eye.z]);
      projector.scale.set(0.028, 0.028, 0.012);
      // The light strip: along the bottom, then curling up the outer end.
      const strip = [...bottom, at(LAMP.s[LAMP.s.length - 1]! + 0.04, LAMP.top[LAMP.top.length - 1]! - 0.01, 0.006)];
      this.add(this.geometry(new TubeGeometry(new CatmullRomCurve3(strip), 32, 0.016, 6)), lamp, this.object);
      for (let i = 0; i < 3; i++) {
        const at = onNose(side * (0.7 + i * 0.05), 0.36 + i * 0.025, 0.004);
        this.add(this.geometry(new BoxGeometry(0.012, 0.09, 0.012)), chrome, this.object, [at.x, at.y, at.z], [0.2, side * 0.5, side * 0.35]);
      }
      const tailLine = [[0.5, 1.02], [0.68, 1.015], [0.84, 1.0], [0.92, 0.97]].map(([x, y]) => onTail(side * x!, y!, 0.006));
      this.add(this.geometry(new TubeGeometry(new CatmullRomCurve3(tailLine), 16, 0.03, 6)), tail, this.object);
    }
    const nose = [-0.48, -0.24, 0, 0.24, 0.48].map((x) => onNose(x, 0.725 - 0.035 * Math.cos((x / 0.48) * (Math.PI / 2)), 0.006));
    this.add(this.geometry(new TubeGeometry(new CatmullRomCurve3(nose), 24, 0.008, 6)), chrome, this.object).name = 'nose strip';
    const intakeLow = [-0.62, -0.31, 0, 0.31, 0.62].map((x) => onNose(x, 0.36, 0.004));
    const intakeHigh = [-0.62, -0.31, 0, 0.31, 0.62].map((x) => onNose(x, 0.47, 0.004));
    this.add(this.geometry(ribbon(intakeLow, intakeHigh)), trim, this.object);
    const tailStrip = [-0.42, -0.21, 0, 0.21, 0.42].map((x) => onTail(x, 0.86, 0.006));
    this.add(this.geometry(new TubeGeometry(new CatmullRomCurve3(tailStrip), 20, 0.007, 6)), chrome, this.object);

    this.setFalconDoors(0);
  }

  /** The passenger's front door: 0 shut, 1 wide open. */
  setPassengerDoor(open: number): void {
    this.doorOpen = Math.min(1, Math.max(0, open));
    this.passengerDoor.rotation.y = this.doorOpen * DOOR.openAngle;
  }

  /** The driver's door: 0 shut, 1 wide open (it swings out the other way, on the other side). */
  setDriverDoor(open: number): void {
    this.driverOpen = Math.min(1, Math.max(0, open));
    this.driverDoor.rotation.y = -this.driverOpen * DOOR.openAngle;
  }

  get driverDoorOpen(): number {
    return this.driverOpen;
  }

  /** The passenger window: 0 up, 1 all the way down (into the door). */
  setPassengerWindow(down: number): void {
    this.windowDown = Math.min(1, Math.max(0, down));
    this.passengerWindow.position.y = -0.56 * this.windowDown;
    this.passengerWindow.visible = this.windowDown < 0.98;
  }

  /**
   * The falcon-wing doors (both): 0 shut, 1 up. Each one's top swings up about the roof's spine, and the rest folds
   * the other way at the top of the window, so the open door stands tall and reaches out over the side like a wing.
   */
  setFalconDoors(open: number): void {
    this.falconOpen = Math.min(1, Math.max(0, open));
    const k = this.falconOpen * this.falconOpen * (3 - 2 * this.falconOpen);
    for (const { hinge, elbow, side } of this.falcons) {
      hinge.rotation.z = side * FALCON.lift * k;
      elbow.rotation.z = -side * FALCON.fold * k;
    }
  }

  get passengerDoorOpen(): number {
    return this.doorOpen;
  }

  get passengerWindowDown(): number {
    return this.windowDown;
  }

  get falconDoorsOpen(): number {
    return this.falconOpen;
  }

  /** Turns the wheels for `distance` metres travelled (negative: backwards). */
  roll(distance: number): void {
    for (const wheel of this.wheels) wheel.children[0]!.rotation.x += distance / WHEEL.radius;
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.object.removeFromParent();
  }

  /** A soft sky and ground for the paint and glass to reflect (a small canvas, no image files). */
  private reflections(): Texture | null {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 64;
    const g = canvas.getContext('2d');
    if (!g) return null;
    const grad = g.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, '#9fc3e6');
    grad.addColorStop(0.45, '#e9f1f7');
    grad.addColorStop(0.5, '#dfe6ec');
    grad.addColorStop(0.53, '#8b8f86');
    grad.addColorStop(1, '#3a3b38');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 64);
    // A few soft bright panels (the sun, clouds), so the black paint shows its curves.
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [x, w] of [[14, 10], [52, 18], [96, 8]] as const) g.fillRect(x, 12, w, 14);
    const texture = new CanvasTexture(canvas);
    texture.mapping = EquirectangularReflectionMapping;
    texture.colorSpace = SRGBColorSpace;
    this.textures.push(texture);
    return texture;
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

const WHEEL = { radius: 0.37, width: 0.25, rim: 0.275 } as const;
const AXLES = { front: 1.49, rear: -1.48 } as const;
const ARCH = 0.45;
/** The front doors (car z from `back` to `front`), their bottom edge, and how far the passenger's opens. */
const DOOR = { front: 1.02, back: 0.06, sill: 0.42, openAngle: 1.15 } as const;
/** The falcon doors (car z from `back` to `front`), and how far each part turns when they're up (radians). */
const FALCON = { front: -0.02, back: -1.3, lift: 1.2, fold: 0.22 } as const;
/** The glasshouse: where it starts (the windscreen's foot) and ends (the rear window's), its highest point, and height. */
const GLASS = { cowl: 1.3, tail: -2.3, apex: -0.6, top: 1.68 } as const;
/**
 * Round the glasshouse (0 the driver's side at the window line, π/2 the top, π the passenger's): where the side
 * windows give way to the roof and the windscreen, and where each falcon door folds (its elbow).
 */
const RIM = { pillar: 0.62, elbow: 0.62 } as const;
/** The windscreen is clear down here (ahead of this z); above the front seats it's tinted black. */
const SCREEN_CLEAR = 0.62;
/** The car's ends (z). */
const ENDS = { nose: 2.53, tail: -2.52 } as const;
/**
 * The headlamps, along their length `s` (0 at the inner end, 1 at the nose's corner, past 1 wrapping back along the
 * fender; see `lampPoint`): the bottom edge (where the light strip runs) and the top edge's heights.
 */
const LAMP = {
  s: [0, 0.35, 0.7, 1.0, 1.14, 1.26],
  bottom: [0.775, 0.765, 0.775, 0.8, 0.83, 0.875],
  top: [0.812, 0.835, 0.868, 0.905, 0.915, 0.92],
} as const;

/**
 * A point on a headlamp (`side` +1 the driver's): `s` 0 → 1 across the nose from x 0.42 to its corner at x 0.86, and on
 * past 1 back along the side of the fender; at height `y`, `out` proud of the paint.
 */
function lampPoint(side: 1 | -1, s: number, y: number, out: number): Vector3 {
  if (s <= 1) return onNose(side * (0.42 + 0.44 * s), y, out);
  const corner = onNose(side * 0.86, y, 0);
  const z = corner.z - (s - 1) * 0.42;
  return new Vector3(side * (sideX(z, y) + out), y, z);
}

function smooth01(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return k * k * (3 - 2 * k);
}

/**
 * The body's top along its middle: the hood falling gently from the windscreen and curving down into the nose, the
 * window line along the cabin, and the tail rounding down at the back.
 */
function topAt(z: number): number {
  if (z > GLASS.cowl) {
    const hood = 1.07 - 0.18 * ((z - GLASS.cowl) / (2.22 - GLASS.cowl)) ** 1.3;
    return z <= 2.22 ? hood : 0.89 - 0.38 * ((z - 2.22) / (ENDS.nose - 2.22)) ** 2.2;
  }
  const line = 1.07 + 0.03 * ((GLASS.cowl - z) / 3.6);
  return z >= -2.2 ? line : line - 0.32 * ((-2.2 - z) / (-2.2 - ENDS.tail)) ** 2.2;
}

/** The window line: where the body's open top (and the glass) begins along the cabin. */
function beltAt(z: number): number {
  return topAt(z) - 0.03;
}

interface Section {
  hw: number;
  yc: number;
  hh: number;
  nUp: number;
  nLow: number;
}

/** The body's cross-section at `z`: a rounded box (a superellipse, squarer below), rounding off in plan at the ends. */
function section(z: number): Section {
  const top = topAt(z);
  const bottom = 0.22 + 0.12 * smooth01((z - 1.95) / 0.58) + 0.14 * smooth01((-1.95 - z) / 0.57);
  let hw = 0.99 - 0.05 * smooth01((z - 1.2) / 1.0) - 0.05 * smooth01((-1.6 - z) / 0.7);
  const e = z > 2.02 ? (z - 2.02) / (ENDS.nose - 2.02) : z < -2.28 ? (-2.28 - z) / (-2.28 - ENDS.tail) : 0;
  if (e > 0) hw *= (1 - Math.min(1, e) ** 2.7) ** (1 / 2.7);
  const nUp = 6 - 0.8 * smooth01((z - 1.2) / 0.6);
  return { hw, yc: (top + bottom) / 2, hh: Math.max(0.005, (top - bottom) / 2), nUp, nLow: 5 };
}

/** A point on the section at angle `a` (0 = the driver's side, π/2 the top). */
function sectionPoint(sec: Section, a: number, out: Vector3): Vector3 {
  const c = Math.cos(a), s = Math.sin(a);
  const n = s >= 0 ? sec.nUp : sec.nLow;
  const t = Math.sign(s) * Math.abs(s) ** (2 / n);
  // Tumblehome: the sides lean in toward the top.
  const x = sec.hw * Math.sign(c) * Math.abs(c) ** (2 / n) * (1 - 0.07 * Math.max(0, t));
  return out.set(x, sec.yc + sec.hh * t, 0);
}

/** How far out the body's side is at (z, y) (its half-width there). */
function sideX(z: number, y: number): number {
  const sec = section(z);
  const t = (y - sec.yc) / sec.hh;
  if (Math.abs(t) >= 1) return 0;
  const n = t >= 0 ? sec.nUp : sec.nLow;
  return sec.hw * (1 - Math.abs(t) ** n) ** (1 / n) * (1 - 0.07 * Math.max(0, t));
}

/** The point on the nose's surface at (x, y), pushed out `out` along z. */
function onNose(x: number, y: number, out: number): Vector3 {
  let lo = 1.4, hi: number = ENDS.nose;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (sideX(mid, y) >= Math.abs(x)) lo = mid;
    else hi = mid;
  }
  return new Vector3(x, y, lo + out);
}

/** The same at the tail. */
function onTail(x: number, y: number, out: number): Vector3 {
  let lo: number = ENDS.tail, hi = -1.8;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (sideX(mid, y) >= Math.abs(x)) hi = mid;
    else lo = mid;
  }
  return new Vector3(x, y, hi - out);
}

/** Sections along the car, from `from` to `to`, with one exactly on every door edge and break. */
function stations(from: number, to: number): number[] {
  const zs = new Set<number>();
  for (let z = from; z <= to + 1e-9; z += 0.04) zs.add(Math.round(z * 1000) / 1000);
  for (const z of [from, to, DOOR.front, DOOR.back, FALCON.front, FALCON.back, FALCON.front + 0.08, FALCON.back - 0.08, GLASS.cowl, GLASS.tail]) {
    if (z >= from && z <= to) zs.add(z);
  }
  return [...zs].sort((a, b) => a - b);
}

/**
 * A lofted shell: sections along z, each `around` points from `point(z, j)`, its quads sorted into parts by `pick`
 * (null leaves the quad out). Smooth normals from the whole shell, so the parts meet without a crease.
 */
function loft<K extends string>(zs: number[], around: number, closed: boolean, point: (z: number, j: number, out: Vector3) => Vector3, pick: (z: number, centre: Vector3, j: number) => K | null): Record<K, BufferGeometry> {
  const columns = closed ? around : around + 1;
  const positions: number[] = [];
  const p = new Vector3();
  for (const z of zs) {
    for (let j = 0; j < columns; j++) {
      point(z, j, p);
      positions.push(p.x, p.y, p.z);
    }
  }
  const index = (i: number, j: number) => i * columns + (closed ? j % around : j);
  const all: number[] = [];
  const parts = new Map<K, number[]>();
  const centre = new Vector3();
  for (let i = 0; i < zs.length - 1; i++) {
    for (let j = 0; j < around; j++) {
      const a = index(i, j), b = index(i + 1, j), c = index(i + 1, j + 1), d = index(i, j + 1);
      const tri = [a, b, c, a, c, d];
      all.push(...tri);
      centre.set((positions[a * 3]! + positions[c * 3]!) / 2, (positions[a * 3 + 1]! + positions[c * 3 + 1]!) / 2, (zs[i]! + zs[i + 1]!) / 2);
      const key = pick(centre.z, centre, j);
      if (key === null) continue;
      const list = parts.get(key) ?? [];
      list.push(...tri);
      parts.set(key, list);
    }
  }
  const shell = new BufferGeometry();
  shell.setAttribute('position', new Float32BufferAttribute(positions, 3));
  shell.setIndex(all);
  shell.computeVertexNormals();
  const out = {} as Record<K, BufferGeometry>;
  for (const [key, indices] of parts) {
    const g = new BufferGeometry();
    g.setAttribute('position', shell.attributes.position!.clone());
    g.setAttribute('normal', shell.attributes.normal!.clone());
    g.setIndex(indices);
    out[key] = g;
  }
  shell.dispose();
  return out;
}

/**
 * The body as lofted sections: the body itself, each front door's panel, each falcon door's lower panel. The top is
 * left open along the cabin (the glass sits on the window line), and the sides are lifted clear of each wheel.
 */
function loftBody(): { body: BufferGeometry; doors: Record<1 | -1, BufferGeometry>; falcons: Record<1 | -1, BufferGeometry> } {
  const around = 72;
  const parts = loft(stations(ENDS.tail, ENDS.nose), around, true, (z, j, out) => {
    sectionPoint(section(z), (j / around) * Math.PI * 2, out);
    for (const axle of [AXLES.front, AXLES.rear]) {
      const dz = z - axle;
      if (Math.abs(dz) < ARCH) out.y = Math.max(out.y, WHEEL.radius - 0.02 + Math.sqrt(ARCH * ARCH - dz * dz));
    }
    return out.setZ(z);
  }, (z, c) => {
    if (z < GLASS.cowl && z > GLASS.tail && c.y > beltAt(z) - 0.004) return null;
    const onSide = Math.abs(c.x) > 0.5 && c.y > DOOR.sill;
    const side = c.x > 0 ? 'R' : 'L';
    if (onSide && z > DOOR.back && z < DOOR.front) return `door${side}`;
    if (onSide && z > FALCON.back && z < FALCON.front) return `falcon${side}`;
    return 'body';
  });
  return { body: parts.body, doors: { 1: parts.doorR, [-1]: parts.doorL }, falcons: { 1: parts.falconR, [-1]: parts.falconL } };
}

/** The glasshouse's height along its middle: the windscreen sweeping up into the roof, down the rear window. */
function roofAt(z: number): number {
  const G = GLASS;
  if (z >= G.apex) return G.top - (G.top - beltAt(G.cowl)) * Math.min(1, (z - G.apex) / (G.cowl - G.apex)) ** 1.7;
  return G.top - (G.top - beltAt(G.tail)) * Math.min(1, (G.apex - z) / (G.apex - G.tail)) ** 2.9;
}

/**
 * A point round the glasshouse at `z` and angle `a` (0 the driver's side at the window line, π/2 the top, π the
 * passenger's): from the body's side at the window line, leaning in and rounding over the roof.
 */
function houseRim(z: number, a: number, out = new Vector3()): Vector3 {
  const belt = beltAt(z);
  const half = sideX(z, belt) - 0.01;
  const c = Math.cos(a), s = Math.max(0, Math.sin(a));
  const n = 4;
  const up = s ** (2 / n);
  return out.set(half * Math.sign(c) * Math.abs(c) ** (2 / n) * (1 - 0.13 * up), belt + (roofAt(z) - belt) * up, z);
}

/**
 * The glasshouse as a lofted shell, split into the windscreen (it runs back over the front seats), the front doors'
 * windows, the black pillars and the bar between windscreen and roof, the falcon doors' tops (each half of the roof)
 * and windows, the rear window, and the small fixed windows behind the falcon doors.
 */
function loftGlasshouse() {
  const around = 48;
  const parts = loft(stations(GLASS.tail, GLASS.cowl), around, false, (z, j, out) => houseRim(z, (j / around) * Math.PI, out), (z, c, j) => {
    const a = ((j + 0.5) / around) * Math.PI;
    const top = a > RIM.pillar && a < Math.PI - RIM.pillar;
    const side = c.x > 0 ? 'R' : 'L';
    if (z > FALCON.front + 0.08) {
      if (top) return z > SCREEN_CLEAR ? 'windscreen' : 'screenTop';
      return z > DOOR.back + 0.02 ? `window${side}` : 'pillars';
    }
    if (z > FALCON.front) return 'pillars';
    if (z > FALCON.back) {
      const elbow = a < RIM.elbow || a > Math.PI - RIM.elbow;
      return elbow ? `falconWindow${side}` : `falconTop${side}`;
    }
    if (z > FALCON.back - 0.08) return 'pillars';
    return top ? 'rear' : 'quarters';
  });
  return {
    windscreen: parts.windscreen,
    screenTop: parts.screenTop,
    windows: { 1: parts.windowR, [-1]: parts.windowL } as Record<1 | -1, BufferGeometry>,
    pillars: parts.pillars,
    falconTops: { 1: parts.falconTopR, [-1]: parts.falconTopL } as Record<1 | -1, BufferGeometry>,
    falconWindows: { 1: parts.falconWindowR, [-1]: parts.falconWindowL } as Record<1 | -1, BufferGeometry>,
    rear: parts.rear,
    quarters: parts.quarters,
  };
}

/** A frame on the line between two points: at its middle, its z along the line (a hinge's axis). */
function axis(front: Vector3, back: Vector3): Matrix4 {
  const dir = front.clone().sub(back).normalize();
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), dir);
  return new Matrix4().compose(front.clone().add(back).multiplyScalar(0.5), q, new Vector3(1, 1, 1));
}

/** A door's inside: a dark card just inboard of its panel, from its bottom edge to the window line. */
function doorCard(side: 1 | -1, back: number, front: number): BufferGeometry {
  const mid = (back + front) / 2;
  const x = side * (sideX(mid, 0.75) - 0.07);
  return new BoxGeometry(0.03, beltAt(mid) - DOOR.sill, front - back - 0.04).translate(x, (beltAt(mid) + DOOR.sill) / 2, mid);
}

/** A thin band along the body's side (`side`) at the window line, from z `a` to `b`: the chrome under the windows. */
function beltLine(side: 1 | -1, a: number, b: number): BufferGeometry {
  return band(side, a, b, (z) => beltAt(z) - 0.008, 0.014, false);
}

/** A door seam: a thin dark line up the body's side at `z`, from the sill to the window line. */
function seam(side: 1 | -1, z: number): BufferGeometry {
  return band(side, DOOR.sill - 0.02, beltAt(z) - 0.02, () => z, 0.006, true);
}

/**
 * A thin band lying on the body's side, proud of the paint: along z (from z `a` to `b` at height `at(z)`) or, when
 * `upright`, up it (from y `a` to `b` at z `at()`).
 */
function band(side: 1 | -1, a: number, b: number, at: (z: number) => number, width: number, upright: boolean): BufferGeometry {
  const steps = 16;
  const verts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const k = a + (b - a) * (i / steps);
    const z = upright ? at(0) : k;
    const y = upright ? k : at(k);
    const x = side * (sideX(z, y) + 0.004);
    if (upright) verts.push(x, y, z - width / 2, x, y, z + width / 2);
    else verts.push(x, y - width / 2, z, x, y + width / 2, z);
  }
  return quadStrip(verts, steps);
}

/**
 * A thin line along the glasshouse where the side windows meet the roof (`side`), from z `a` to `b`, `width` round it
 * (radians) and `shift` down the side from that edge: a pillar, the chrome round the windows.
 */
function houseLine(side: 1 | -1, a: number, b: number, width: number, shift = 0): BufferGeometry {
  const steps = 20;
  const verts: number[] = [];
  const angle = side === 1 ? RIM.pillar + shift : Math.PI - RIM.pillar - shift;
  const p = new Vector3(), q = new Vector3();
  for (let i = 0; i <= steps; i++) {
    const z = a + (b - a) * (i / steps);
    houseRim(z, angle - width, p);
    houseRim(z, angle + width, q);
    verts.push(p.x * 1.004, p.y + 0.002, p.z, q.x * 1.004, q.y + 0.002, q.z);
  }
  return quadStrip(verts, steps);
}

/** A front door's flush handle: a slim chrome bar near its back edge. */
function handle(side: 1 | -1): BufferGeometry {
  return band(side, DOOR.back + 0.1, DOOR.back + 0.38, () => 0.95, 0.022, false);
}

/**
 * A turbine wheel's face, in the wheel's plane (x 0, facing +x): ten blades sweeping round from the hub to the rim,
 * dished in toward the hub, and the hub's cap.
 */
function turbine(): BufferGeometry {
  const verts: number[] = [];
  const index: number[] = [];
  const blades = 10, steps = 6;
  for (let i = 0; i < blades; i++) {
    const a0 = (i / blades) * Math.PI * 2;
    const base = verts.length / 3;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const r = 0.065 + (WHEEL.rim - 0.075) * t;
      const a = a0 + 0.8 * t ** 1.25;
      const w = 0.015 + 0.03 * t;
      const x = -0.03 * (1 - t);
      const cy = r * Math.cos(a), cz = r * Math.sin(a);
      const py = -Math.sin(a) * w, pz = Math.cos(a) * w;
      verts.push(x, cy - py, cz - pz, x, cy + py, cz + pz);
      if (k < steps) {
        const p = base + k * 2;
        index.push(p, p + 1, p + 2, p + 1, p + 3, p + 2);
      }
    }
  }
  // The hub: a little disc.
  const hub = verts.length / 3;
  verts.push(-0.032, 0, 0);
  for (let k = 0; k <= 16; k++) {
    const a = (k / 16) * Math.PI * 2;
    verts.push(-0.032, 0.07 * Math.cos(a), 0.07 * Math.sin(a));
    if (k < 16) index.push(hub, hub + 1 + k, hub + 2 + k);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(verts, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** A strip of quads from pairs of points. */
function quadStrip(verts: number[], steps: number): BufferGeometry {
  const index: number[] = [];
  for (let i = 0; i < steps; i++) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(verts, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  return geometry;
}

/** A band between two curves of points (equal counts): a lens, an intake. */
function ribbon(a: Vector3[], b: Vector3[]): BufferGeometry {
  const ca = new CatmullRomCurve3(a), cb = new CatmullRomCurve3(b);
  const steps = 20;
  const verts: number[] = [];
  for (let i = 0; i <= steps; i++) {
    const p = ca.getPoint(i / steps), q = cb.getPoint(i / steps);
    verts.push(p.x, p.y, p.z, q.x, q.y, q.z);
  }
  return quadStrip(verts, steps);
}

/** A box with softened corners: seat cushions. */
function roundedBox(w: number, h: number, d: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d, 4, 4, 4);
  const pos = g.attributes.position!;
  const v = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const nx = v.x / (w / 2), ny = v.y / (h / 2), nz = v.z / (d / 2);
    const k = 1 - 0.12 * (Math.abs(nx * ny) + Math.abs(ny * nz) + Math.abs(nx * nz)) / 3;
    pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
  }
  g.computeVertexNormals();
  return g;
}
