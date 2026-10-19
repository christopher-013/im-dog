import {
  AdditiveBlending, BackSide, BoxGeometry, BufferGeometry, CatmullRomCurve3, ConeGeometry, CylinderGeometry, DataTexture, DoubleSide,
  EquirectangularReflectionMapping, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, NormalBlending, PlaneGeometry,
  RepeatWrapping, RGBAFormat, Shape, ShapeGeometry, SRGBColorSpace, TorusGeometry, TubeGeometry, Vector3,
  type Material, type Object3D, type Texture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CARS } from '../config/cars';
import type { RideCar } from './RideCar';
import { deLoreanMarking } from './deLoreanMarkings';
import { hoverAltitude } from '../ride/hover';
import { fluxCapacitor } from './fluxCapacitor';

type Point = readonly [number, number, number];
const D = CARS.delorean;

/**
 * Original procedural DeLorean time-machine homage, using the owner's supplied photograph for shape reference only.
 * +z forward, passenger −x. Stainless wedge, gull-wing doors (one roof hinge each, not SUV falcon double hinges),
 * turbine wheels, exposed cables, blue flux bands, twin rear vents and a little lit Y behind the seats.
 * DMC/DeLorean badges and OUTATIME plate are generated artwork, explicitly requested by the owner.
 * No photograph, downloaded model/artwork, personal registration or film audio is included.
 * Static details are batched by material within each moving assembly; animated effects use no real lights.
 */
export class DeLoreanCar implements RideCar {
  readonly id = 'delorean' as const;
  readonly object = new Group();
  readonly seats = { passenger: new Vector3(...D.passenger), driver: new Vector3(...D.driver) };
  readonly window = new Vector3(...D.window);
  readonly headOut = D.headOut;
  readonly hover = D.hover;
  private readonly doors = { passenger: new Group(), driver: new Group() };
  private readonly wheels: Group[] = [];
  private readonly wheelPivots: { pivot: Group; side: number; x: number }[] = [];
  private readonly suspension = new Group();
  private readonly aura = new Group();
  private readonly glowMaterials: MeshBasicMaterial[] = [];
  private wheelGlow!: Mesh;
  private hoverNow = 0;
  private readonly geometries = new Set<BufferGeometry>();
  private readonly materials = new Set<Material>();
  private readonly reflection: DataTexture;
  private readonly detailTextures: Texture[] = [];
  private readonly passengerGlass!: Mesh;
  private passengerOpen = 0;
  private driverOpen = 0;
  private wingsOpen = 0;
  private windowDown = 0;
  private readonly flux = fluxCapacitor();

  constructor() {
    this.object.name = 'Silver time machine';
    this.reflection = this.sky();
    const silver = this.material('#bdc2c5', 0.52, 0.55);
    silver.roughnessMap = this.steelGrain();
    const dark = this.material('#191d21', 0.15, 0.6);
    const rubber = this.material('#141518', 0, 0.95);
    const alloy = this.material('#bfc3c7', 0.8, 0.27);
    const seat = this.material('#44484d', 0, 0.85);
    const glass = this.material('#354e5b', 0.35, 0.13);
    glass.transparent = true; glass.opacity = 0.43; glass.depthWrite = false;
    const blue = this.material('#b6edff', 0.2, 0.3, '#39baff', 2);
    const white = this.material('#e5eceb', 0.4, 0.20, '#fff1d0', 0.55);
    const red = this.material('#a91518', 0, 0.4, '#e72c27', 0.7);
    const amber = this.material('#d88724', 0, 0.5, '#e99c29', 0.5);
    const yellow = this.material('#c8b244', 0.1, 0.65);
    const cableRed = this.material('#a63f35', 0.1, 0.7);

    this.box([1.75, 0.12, 3.95], [0, 0.32, 0], dark);
    this.box([1.62, 0.08, 2.7], [0, 0.37, -0.1], dark);
    // The low, flat hood, sloping down toward the black full-width nose.
    this.panel([[-0.92, 0.65, 2.18], [0.92, 0.65, 2.18], [0.90, 0.84, 0.87], [-0.90, 0.84, 0.87]], silver);
    for (const x of [-0.67, 0.67]) this.pipe([[x, 0.657, 2.12], [x, 0.832, 0.92]], 0.004, dark);
    this.box([1.9, 0.23, 0.11], [0, 0.53, 2.16], dark);
    this.box([1.92, 0.12, 0.12], [0, 0.32, 2.18], silver);
    this.box([1.79, 0.12, 0.18], [0, 0.205, 2.10], dark);
    this.box([1.02, 0.16, 0.012], [0, 0.55, 2.225], rubber);
    for (let y = 0.49; y < 0.63; y += 0.027) this.box([1.0, 0.009, 0.014], [0, y, 2.236], alloy);
    this.marking('dmc', [0.30, 0.075], [0, 0.55, 2.252], 0, 'DMC grille badge');
    // The front time-circuit band is perforated silver hardware, with small fasteners along it.
    this.box([1.82, 0.085, 0.03], [0, 0.34, 2.258], alloy);
    for (let i = -12; i <= 12; i++) {
      this.box([0.014, 0.040, 0.004], [i * 0.068, 0.34, 2.276], dark);
      if (i % 3 === 0) this.box([0.013, 0.013, 0.009], [i * 0.068, 0.395, 2.27], alloy);
    }
    // Quad rectangular headlamps in black bezels, with little amber markers under the corners.
    for (const side of [-1, 1] as const) {
      this.box([0.49, 0.21, 0.03], [side * 0.69, 0.55, 2.227], silver);
      for (const x of [0.57, 0.80]) {
        this.box([0.215, 0.16, 0.037], [side * x, 0.55, 2.248], dark);
        this.box([0.185, 0.132, 0.039], [side * x, 0.55, 2.254], white);
        for (const dy of [-0.032, 0, 0.032]) this.box([0.178, 0.003, 0.002], [side * x, 0.55 + dy, 2.275], alloy);
      }
      this.box([0.16, 0.045, 0.015], [side * 0.78, 0.405, 2.25], amber);
      this.fender(side, true, silver);
      this.fender(side, false, silver);
      // Close the narrow ledge between hood and side panel: no view into the footwell beside the windshield.
      this.panel([[side * 0.90, 0.84, 0.87], [side * 0.92, 0.65, 2.18], [side * 0.96, 0.65, 2.19], [side * 0.96, 0.82, 0.76]], silver);
      this.box([0.07, 0.12, 1.37], [side * 0.94, 0.39, 0.04], dark);
      this.box([0.07, 0.05, 3.95], [side * 0.965, 0.28, 0.03], silver);
      // Front wheel's external wiring, fixed to its fender (never to the moving door).
      const wire: Point[] = [[side * 0.99, 0.39, 1.94], [side * 1.0, 0.70, 1.62], [side * 1.0, 0.78, 1.24], [side * 0.99, 0.68, 0.91]];
      this.pipe(wire, 0.018, dark);
      this.pipe(wire.map(([x, y, z]) => [x + side * 0.019, y + 0.014, z]), 0.006, cableRed);
      this.pipe(wire.map(([x, y, z]) => [x + side * 0.025, y - 0.009, z]), 0.005, yellow);
      this.box([0.13, 0.18, 0.18], [side * 0.98, 0.37, 1.97], dark);
      this.box([0.035, 0.13, 0.14], [side * 1.055, 0.37, 1.97], alloy);
      for (const z of [1.97, 1.90]) for (const y of [0.33, 0.40]) this.box([0.008, 0.012, 0.012], [side * 1.077, y, z], dark);
      // Wiring also follows the rocker panel back to the rear equipment, secured by pale clips.
      const sill: Point[] = [[side * 0.99, 0.43, 0.88], [side * 0.99, 0.25, 0.72], [side * 0.99, 0.25, -0.70], [side * 1.01, 0.67, -0.94]];
      this.pipe(sill, 0.015, dark);
      this.pipe(sill.map(([x, y, z]) => [x + side * 0.015, y + 0.012, z]), 0.005, cableRed);
      this.pipe(sill.map(([x, y, z]) => [x + side * 0.020, y - 0.008, z]), 0.005, yellow);
      for (const z of [-0.55, -0.15, 0.25, 0.65]) this.box([0.026, 0.045, 0.022], [side * 1.005, 0.26, z], alloy);
    }

    // Cabin: a steep, wide windshield and its black frame; roof is carried by the gull wings.
    const screen: Point[] = [[-0.88, 0.84, 0.89], [0.88, 0.84, 0.89], [0.68, 1.39, 0.35], [-0.68, 1.39, 0.35]];
    this.panel(screen, glass);
    for (let i = 0; i < 4; i++) this.pipe([screen[i]!, screen[(i + 1) % 4]!], 0.024, dark);
    this.box([0.30, 0.045, 1.01], [0, 1.407, -0.16], silver);
    this.box([1.7, 0.13, 0.29], [0, 0.79, 0.78], dark);
    this.box([0.20, 0.25, 0.75], [0, 0.47, 0.02], dark);
    // Dashboard's three original time-circuit readouts: coloured bars, no film dates or text texture.
    for (const [y, mat] of [[0.78, red], [0.73, amber], [0.68, blue]] as const) {
      for (let i = 0; i < 5; i++) this.box([0.023, 0.018, 0.012], [-0.10 + i * 0.048, y, 0.615], mat);
    }
    for (const s of Object.values(this.seats)) {
      this.add(new RoundedBoxGeometry(0.51, 0.10, 0.53, 2, 0.035), seat, [s.x, s.y - 0.05, s.z]);
      const back = this.add(new RoundedBoxGeometry(0.49, 0.56, 0.10, 2, 0.035), seat, [s.x, s.y + 0.26, s.z - 0.25]);
      back.rotation.x = 0.2;
      this.add(new RoundedBoxGeometry(0.29, 0.18, 0.10, 2, 0.035), seat, [s.x, s.y + 0.59, s.z - 0.31]);
      for (const x of [-0.14, -0.07, 0, 0.07, 0.14]) this.box([0.012, 0.009, 0.43], [s.x + x, s.y + 0.002, s.z], dark);
    }
    const steering = this.add(new TorusGeometry(0.15, 0.018, 6, 20), dark, [0.45, 0.76, 0.57]);
    steering.rotation.x = -0.85;
    this.pipe([[0.45, 0.76, 0.57], [0.45, 0.56, 0.76]], 0.025, dark);

    for (const [side, door] of [[-1, this.doors.passenger], [1, this.doors.driver]] as const) {
      door.name = side === -1 ? 'passenger gull wing' : 'driver gull wing';
      door.position.set(side * 0.15, 1.44, -0.15);
      this.object.add(door);
      // Vertices below are in car space, converted once to the roof hinge's local coordinates.
      const local = (p: Point): Point => [p[0] - door.position.x, p[1] - door.position.y, p[2] - door.position.z];
      const panel = (points: Point[], mat: Material) => this.panel(points.map(local), mat, door);
      panel([[side * 0.91, 0.35, 0.61], [side * 0.93, 0.81, 0.75], [side * 0.93, 0.81, -0.67], [side * 0.91, 0.35, -0.54]], silver);
      panel([[side * 0.89, 0.38, 0.62], [side * 0.89, 0.79, 0.73], [side * 0.89, 0.79, -0.65], [side * 0.89, 0.38, -0.54]], dark);
      const points: Point[] = [[side * 0.93, 0.82, 0.74], [side * 0.70, 1.39, 0.34], [side * 0.70, 1.39, -0.64], [side * 0.93, 0.82, -0.66]];
      // The DMC door has a small inset opening, not one large disappearing side window.
      const inset: Point[] = [[side * 0.914, 0.86, 0.36], [side * 0.789, 1.17, 0.25], [side * 0.789, 1.17, -0.45], [side * 0.914, 0.86, -0.45]];
      for (let i = 0; i < 4; i++) {
        panel([points[i]!, points[(i + 1) % 4]!, inset[(i + 1) % 4]!, inset[i]!], glass);
        this.pipe([local(inset[i]!), local(inset[(i + 1) % 4]!)], 0.009, dark, door);
      }
      const window = this.panel(inset.map(local), glass, door);
      if (side === -1) this.passengerGlass = window;
      for (let i = 0; i < 4; i++) this.pipe([local(points[i]!), local(points[(i + 1) % 4]!)], 0.020, silver, door);
      panel([[side * 0.15, 1.42, 0.34], [side * 0.70, 1.41, 0.34], [side * 0.70, 1.41, -0.66], [side * 0.15, 1.42, -0.66]], silver);
      const roofEdge: Point[] = [[side * 0.15, 1.42, 0.34], [side * 0.45, 1.42, 0.34], [side * 0.66, 1.41, 0.34], [side * 0.70, 1.39, 0.34]];
      this.pipe(roofEdge.map(local), 0.018, silver, door);
      this.box([0.025, 0.035, 0.16], local([side * 0.951, 0.74, -0.40]), dark, door);
      this.box([0.028, 0.052, 1.39], local([side * 0.948, 0.56, 0.04]), dark, door);
      this.box([0.16, 0.085, 0.17], local([side * 1.01, 0.88, 0.69]), dark, door);
      // Open door's interior trim and amber courtesy lamp are visible above them in the garage.
      this.box([0.035, 0.07, 0.09], local([side * 0.88, 0.54, -0.48]), amber, door);
      this.box([0.04, 0.07, 0.42], local([side * 0.86, 0.66, -0.03]), seat, door);
      for (const z of [-0.46, 0.54]) this.pipe([local([side * 0.86, 0.50, z]), local([side * 0.86, 0.75, z])], 0.018, dark, door);
    }

    // A complete fixed rear body joins the gull-wing jambs to the hatch, fenders and tail.
    // Equipment is OUTSIDE this shell, not an open view through the cabin behind the seats.
    const rearGlass = this.material('#17232b', 0.35, 0.16);
    rearGlass.transparent = true; rearGlass.opacity = 0.86; rearGlass.depthWrite = false;
    this.rearBody(silver, dark, rearGlass);
    // The time-machine equipment lives behind the cabin, leaving the doors and both passengers clear.
    this.box([1.82, 0.16, 1.0], [0, 0.72, -1.64], silver);
    this.box([1.59, 0.06, 1.03], [0, 0.84, -1.54], dark);
    // Twin tall, rear-facing angular exhaust stacks: silver outer shells, black vanes inside.
    for (const side of [-1, 1] as const) {
      const vent = new Group(); vent.position.set(side * 0.48, 1.03, -1.86); vent.rotation.x = -0.24;
      this.object.add(vent);
      // Tall flared exhaust mouths: open black cells, two internal uprights and three shelves.
      this.panel([[-0.29, -0.27, -0.22], [-0.29, 0.42, -0.22], [-0.23, 0.32, 0.22], [-0.23, -0.27, 0.22]], silver, vent);
      this.panel([[0.29, -0.27, -0.22], [0.29, 0.42, -0.22], [0.23, 0.32, 0.22], [0.23, -0.27, 0.22]], silver, vent);
      this.panel([[-0.29, 0.42, -0.22], [0.29, 0.42, -0.22], [0.23, 0.32, 0.22], [-0.23, 0.32, 0.22]], silver, vent);
      this.box([0.55, 0.64, 0.025], [0, 0.055, 0.20], dark, vent);
      this.box([0.57, 0.025, 0.44], [0, -0.26, 0], dark, vent);
      for (const x of [-0.095, 0.095]) this.box([0.012, 0.67, 0.41], [x, 0.07, -0.015], dark, vent);
      for (const y of [-0.10, 0.07, 0.24]) this.box([0.57, 0.014, 0.43], [0, y, -0.015], dark, vent);
      this.pipe([[side * 0.84, 0.38, -2.08], [side * 1.00, 0.62, -1.90], [side * 1.0, 0.89, -1.32], [side * 0.78, 1.43, -0.72], [side * 0.22, 1.47, -0.72]], 0.033, alloy);
      this.pipe([[side * 0.87, 0.38, -2.08], [side * 1.03, 0.62, -1.90], [side * 1.03, 0.89, -1.32], [side * 0.81, 1.43, -0.72], [side * 0.22, 1.49, -0.72]], 0.015, blue);
      this.pipe([[side * 0.97, 0.36, 1.98], [side * 0.97, 0.31, 2.24], [side * 0.42, 0.31, 2.27], [0, 0.31, 2.27]], 0.015, blue);
      this.pipe([[side * 0.94, 0.69, -0.73], [side * 1.02, 0.72, -1.19], [side * 1.02, 0.65, -1.70]], 0.017, dark);
      this.pipe([[side * 0.94, 0.72, -0.73], [side * 1.04, 0.75, -1.19], [side * 1.04, 0.68, -1.70]], 0.007, yellow);
      for (const z of [-1.14, -1.40, -1.66]) this.box([0.045, 0.09, 0.05], [side * 1.03, 0.70, z], alloy);
    }
    this.box([0.33, 0.37, 0.10], [0, 0.99, -0.65], dark);
    // The Y faces the passengers/windshield, not backwards through the rear body.
    // Animated Y is added after batching so its time uniform stays independently controlled.
    // Classic circular reactor deck, wiring looms and silver tanks between the two rear vents.
    this.add(new CylinderGeometry(0.245, 0.245, 0.12, 24), dark, [0, 0.95, -1.30]);
    const reactor = this.add(new TorusGeometry(0.18, 0.024, 6, 24), alloy, [0, 1.018, -1.30]); reactor.rotation.x = Math.PI / 2;
    this.add(new CylinderGeometry(0.10, 0.10, 0.035, 20), yellow, [0, 1.025, -1.30]);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      this.box([0.045, 0.04, 0.045], [Math.sin(a) * 0.23, 1.02, -1.30 + Math.cos(a) * 0.23], alloy);
    }
    for (const side of [-1, 1]) {
      const tank = this.add(new CylinderGeometry(0.075, 0.075, 0.52, 12), alloy, [side * 0.31, 0.96, -1.12]); tank.rotation.x = Math.PI / 2;
      this.box([0.19, 0.16, 0.22], [side * 0.52, 0.93, -1.20], cableRed);
      this.pipe([[side * 0.12, 1.02, -1.08], [side * 0.40, 1.07, -0.99], [side * 0.67, 0.91, -1.42]], 0.018, yellow);
      this.pipe([[side * 0.12, 1.02, -1.53], [side * 0.40, 1.10, -1.64], [side * 0.67, 0.93, -1.46]], 0.025, dark);
    }
    this.box([1.89, 0.23, 0.12], [0, 0.54, -2.16], dark);
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) this.box([0.12, 0.12, 0.035], [side * (0.38 + i * 0.14), 0.59, -2.235], i === 3 ? amber : red);
    }
    this.box([1.91, 0.10, 0.16], [0, 0.33, -2.18], silver);
    this.box([0.44, 0.245, 0.015], [0, 0.55, -2.23], dark);
    this.marking('plate', [0.40, 0.20], [0, 0.55, -2.243], Math.PI, 'OUTATIME license plate');
    this.marking('rear', [0.42, 0.10], [0.60, 0.37, -2.269], Math.PI, 'DeLorean rear badge');
    for (const side of [-1, 1]) {
      this.pipe([[side * 0.75, 0.24, -2.14], [side * 0.42, 0.18, -2.20], [side * 0.20, 0.24, -2.18]], 0.04, alloy);
    }

    // Fine radial turbine slots, dark recessed dishes and five visible lug bolts, rather than wagon-wheel spokes.
    this.suspension.name = 'Hover suspension'; this.suspension.position.y = 0.45;
    this.object.add(this.suspension);
    for (const x of [-0.91, 0.91]) for (const z of [D.frontAxle, D.rearAxle]) {
      const pivot = new Group(); pivot.position.set(x, D.wheelRadius, z);
      pivot.name = `Hover wheel pivot ${x < 0 ? 'passenger' : 'driver'} ${z > 0 ? 'front' : 'rear'}`;
      const wheel = new Group(); pivot.add(wheel);
      this.object.add(pivot); this.wheels.push(wheel);
      this.wheelPivots.push({ pivot, side: Math.sign(x), x });
      // Fixed upper struts are exposed as the tyres rotate down/out, rather than hovering unattached.
      this.box([0.065, 0.30, 0.09], [x, -0.15, z], alloy, this.suspension);
      this.box([0.23, 0.055, 0.08], [x, -0.05, z], dark, this.suspension);
      const tire = this.add(new CylinderGeometry(D.wheelRadius, D.wheelRadius, D.wheelWidth, 24), rubber, [0, 0, 0], wheel);
      tire.rotation.z = Math.PI / 2;
      const sign = Math.sign(x), face = sign * (D.wheelWidth / 2 + 0.003);
      const disc = this.add(new CylinderGeometry(0.235, 0.235, 0.016, 24), dark, [face, 0, 0], wheel);
      disc.rotation.z = Math.PI / 2;
      const rim = this.add(new TorusGeometry(0.237, 0.014, 6, 24), alloy, [face + sign * 0.012, 0, 0], wheel);
      rim.rotation.y = Math.PI / 2;
      for (let i = 0; i < 48; i++) {
        const a = i * Math.PI / 24;
        const blade = this.box([0.022, 0.15, 0.007], [face + sign * 0.009, Math.cos(a) * 0.15, Math.sin(a) * 0.15], alloy, wheel);
        blade.rotation.x = a + 0.08;
      }
      const hub = this.add(new CylinderGeometry(0.066, 0.066, 0.034, 16), alloy, [face, 0, 0], wheel);
      hub.rotation.z = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 2 / 5;
        this.box([0.008, 0.013, 0.013], [face + sign * 0.022, Math.sin(a) * 0.044, Math.cos(a) * 0.044], dark, wheel);
      }
    }
    // Keep the movable window separate; everything else can share one draw per material/assembly.
    this.passengerGlass!.name = 'passenger window';
    this.batch(this.object);
    this.object.add(this.flux);
    this.geometries.add(this.flux.geometry); this.materials.add(this.flux.material);
    this.buildHoverAura();
    this.setHover(0, 0);
  }

  setPassengerDoor(open: number): void { this.passengerOpen = clamp(open); this.poseDoors(); }
  setDriverDoor(open: number): void { this.driverOpen = clamp(open); this.poseDoors(); }
  setFalconDoors(open: number): void { this.wingsOpen = clamp(open); this.poseDoors(); }
  setPassengerWindow(down: number): void {
    this.windowDown = clamp(down);
    // The small inset pane opens for the shared head-out ride; the surrounding glass stays in the gull wing.
    this.passengerGlass.visible = this.windowDown < 0.98;
  }
  get passengerDoorOpen(): number { return this.passengerOpen; }
  get driverDoorOpen(): number { return this.driverOpen; }
  get falconDoorsOpen(): number { return this.wingsOpen; }
  get passengerWindowDown(): number { return this.windowDown; }
  roll(distance: number): void { for (const wheel of this.wheels) wheel.rotation.x += distance / D.wheelRadius * (1 - this.hoverNow); }
  get hoverAmount(): number { return this.hoverNow; }
  updatePresentation(time: number): void { this.flux.material.uniforms.time!.value = time; }
  setHover(amount: number, time: number): void {
    this.hoverNow = clamp(amount);
    const k = this.hoverNow * this.hoverNow * (3 - 2 * this.hoverNow);
    for (const { pivot, side, x } of this.wheelPivots) {
      pivot.position.x = x + side * D.hover.wheelOut * k;
      pivot.position.y = D.wheelRadius - D.hover.wheelDrop * k;
      // Outer turbine faces turn downward. Spin is on the child, independent of this folding axle.
      pivot.rotation.z = -side * Math.PI / 2 * k;
    }
    this.suspension.visible = k > 0.001;
    this.suspension.scale.y = k;
    this.aura.visible = k > 0.001;
    const pulse = 0.92 + 0.08 * Math.sin(time * 4);
    this.glowMaterials.forEach((m, i) => { m.opacity = k * pulse * (i === 0 ? D.hover.poolOpacity : D.hover.plumeOpacity); });
    // Track the road, not the chassis: four separate blue pools stay under the hovering tyres as it bobs.
    this.wheelGlow.position.y = 0.05 - hoverAltitude(time, D.hover);
  }
  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.reflection.dispose();
    for (const texture of this.detailTextures) texture.dispose();
    this.object.removeFromParent();
  }

  /** Two cheap transparent draws: four merged road pools and four fading thruster plumes. No lights. */
  private buildHoverAura(): void {
    this.aura.name = 'Hover aura'; this.object.add(this.aura);
    for (const plume of [false, true]) {
      const size = 32, data = new Uint8Array(size * size * 4);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const radius = Math.hypot((x / (size - 1) - 0.5) * 2, (y / (size - 1) - 0.5) * 2);
        const a = plume ? (y / (size - 1)) ** 1.5 : Math.max(0, 1 - radius) ** 1.4;
        data.set([a * 255, a * 255, a * 255, 255], (y * size + x) * 4);
      }
      const mask = new DataTexture(data, size, size, RGBAFormat); mask.needsUpdate = true;
      this.detailTextures.push(mask);
      const material = new MeshBasicMaterial({ color: D.hover.color, alphaMap: mask, transparent: true,
        opacity: 0, depthWrite: false, blending: plume ? AdditiveBlending : NormalBlending, side: DoubleSide, toneMapped: false });
      this.materials.add(material); this.glowMaterials.push(material);
      let geometry: BufferGeometry;
      {
        const parts = this.wheelPivots.map(({ x, side, pivot }) => plume
          ? new ConeGeometry(0.33, 0.75, 12, 1, true).translate(x + side * D.hover.wheelOut, -0.22, pivot.position.z)
          : new PlaneGeometry(1.1, 1.1).rotateX(-Math.PI / 2).translate(x + side * D.hover.wheelOut, 0, pivot.position.z));
        geometry = mergeGeometries(parts)!;
        parts.forEach((g) => g.dispose());
      }
      const mesh = this.add(geometry, material, [0, 0, 0], this.aura);
      mesh.name = plume ? 'Hover thrusters' : 'Hover underglow'; mesh.castShadow = mesh.receiveShadow = false;
      if (!plume) this.wheelGlow = mesh;
    }
  }

  private poseDoors(): void {
    // Greeting and boarding commands refer to the SAME two gull wings. A front-door close must not cancel greeting.
    this.doors.passenger.rotation.z = -D.doorLift * Math.max(this.wingsOpen, this.passengerOpen);
    this.doors.driver.rotation.z = D.doorLift * Math.max(this.wingsOpen, this.driverOpen);
  }

  /** Fixed rear shell: no rear-quarter holes or floating window edges, even with the gull wings raised. */
  private rearBody(silver: Material, trim: Material, glass: Material): void {
    const body = new Group(); body.name = 'fixed rear body'; this.object.add(body);
    const frame = (outer: Point[], inner: Point[]) => {
      for (let i = 0; i < 4; i++) this.panel([outer[i]!, outer[(i + 1) % 4]!, inner[(i + 1) % 4]!, inner[i]!], silver, body);
      return this.panel(inner, glass, body);
    };
    // Rear roof crossmember and a solid bulkhead below the rear glass. These do not travel with the doors.
    this.box([1.42, 0.06, 0.15], [0, 1.395, -0.735], silver, body);
    this.box([1.45, 0.035, 0.14], [0, 1.35, -0.735], trim, body);
    this.box([1.51, 0.63, 0.075], [0, 0.715, -0.73], trim, body);
    const hatch: Point[] = [[-0.70, 1.38, -0.80], [0.70, 1.38, -0.80], [0.88, 0.86, -1.33], [-0.88, 0.86, -1.33]];
    const pane: Point[] = [[-0.61, 1.31, -0.871], [0.61, 1.31, -0.871], [0.77, 0.94, -1.248], [-0.77, 0.94, -1.248]];
    frame(hatch, pane).name = 'framed rear windshield';
    for (let i = 1; i < 7; i++) {
      const t = i / 7, half = 0.61 + 0.16 * t, y = 1.31 - 0.37 * t + 0.002, z = -0.871 - 0.377 * t - 0.002;
      this.pipe([[-half, y, z], [half, y, z]], 0.002, trim, body);
    }
    for (const side of [-1, 1]) {
      // Broad B/C pillars and the inset fixed quarter pane: the sloping buttress continues into the rear fender.
      const outer: Point[] = [[side * 0.94, 0.83, -0.69], [side * 0.70, 1.40, -0.69], [side * 0.88, 1.02, -1.34], [side * 0.97, 0.83, -1.57]];
      const inner: Point[] = [[side * 0.926, 0.88, -0.86], [side * 0.766, 1.25, -0.85], [side * 0.873, 1.02, -1.23], [side * 0.942, 0.88, -1.40]];
      frame(outer, inner).name = side < 0 ? 'passenger rear quarter window' : 'driver rear quarter window';
      for (let i = 0; i < 4; i++) this.pipe([inner[i]!, inner[(i + 1) % 4]!], 0.009, trim, body);
      // Door jamb has actual depth, rather than a freestanding line at the end of the door's glass.
      this.panel([[side * 0.94, 0.83, -0.69], [side * 0.70, 1.40, -0.69], [side * 0.65, 1.35, -0.72], [side * 0.88, 0.80, -0.72]], trim, body);
      this.panel([[side * 0.94, 0.36, -0.69], [side * 0.94, 0.83, -0.69], [side * 0.88, 0.80, -0.76], [side * 0.88, 0.36, -0.76]], silver, body);
      // Seal the shoulder above the wheel and the exposed top edge of the original thin fender panel.
      this.panel([[side * 0.97, 0.83, -0.69], [side * 0.97, 0.83, -1.57], [side * 0.86, 0.86, -1.57], [side * 0.81, 0.86, -0.78]], silver, body);
      this.panel([[side * 0.97, 0.83, -1.57], [side * 0.96, 0.80, -2.19], [side * 0.86, 0.80, -2.19], [side * 0.86, 0.86, -1.57]], silver, body);
      this.panel([[side * 0.97, 0.83, -1.57], [side * 0.88, 1.02, -1.34], [side * 0.82, 1.00, -1.34], [side * 0.86, 0.86, -1.57]], silver, body);
      // Rolled wheel-arch lip: a narrow strip returns inward over the tire instead of a paper-thin silhouette.
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 16, b = (i + 1) * Math.PI / 16;
        const ay = 0.32 + 0.38 * Math.sin(a), az = D.rearAxle + 0.38 * Math.cos(a);
        const by = 0.32 + 0.38 * Math.sin(b), bz = D.rearAxle + 0.38 * Math.cos(b);
        this.panel([[side * 0.968, ay, az], [side * 0.968, by, bz], [side * 0.925, by, bz], [side * 0.925, ay, az]], silver, body);
      }
      this.panel([[side * 0.96, 0.80, -2.19], [side * 0.96, 0.35, -2.19], [side * 0.89, 0.35, -2.23], [side * 0.89, 0.80, -2.23]], silver, body);
    }
    this.box([1.85, 0.14, 0.13], [0, 0.73, -2.165], silver, body);
  }

  private fender(side: number, front: boolean, material: Material): void {
    const axle = front ? D.frontAxle : D.rearAxle;
    const start = front ? 0.76 : -2.19, end = front ? 2.19 : -0.69;
    const shape = new Shape();
    shape.moveTo(start, 0.35); shape.lineTo(start, front ? 0.82 : 0.80);
    shape.lineTo(end, front ? 0.65 : 0.83); shape.lineTo(end, 0.35);
    // Wheel-arch cutout follows the upper half of the tire; a dark floor never spans the visible wheels.
    shape.lineTo(axle + 0.38, 0.35);
    shape.absarc(axle, 0.32, 0.38, 0, Math.PI, false);
    shape.lineTo(start, 0.35);
    const g = new ShapeGeometry(shape, 10); g.rotateY(-Math.PI / 2);
    this.add(g, material, [side * 0.96, 0, 0]);
  }

  private material(color: string, metalness: number, roughness: number, emissive = '#000000', emissiveIntensity = 0): MeshStandardMaterial {
    const m = new MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity, side: DoubleSide, envMap: this.reflection, envMapIntensity: 0.85 });
    // Thin two-sided panels otherwise shadow their own lit surface, particularly under the ride's low sun.
    m.shadowSide = BackSide;
    this.materials.add(m); return m;
  }
  private add(g: BufferGeometry, material: Material, at: Point, parent: Object3D = this.object): Mesh {
    this.geometries.add(g);
    const m = new Mesh(g, material); m.position.set(...at); m.castShadow = !material.transparent; m.receiveShadow = true;
    parent.add(m); return m;
  }
  private box(size: Point, at: Point, material: Material, parent: Object3D = this.object, rotation?: Point): Mesh {
    const m = this.add(new BoxGeometry(...size), material, at, parent);
    if (rotation) m.rotation.set(...rotation); return m;
  }
  private panel(points: Point[], material: Material, parent: Object3D = this.object): Mesh {
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(points.flat(), 3));
    const horizontal = Math.abs(points[0]![1] - points[2]![1]) < 0.3;
    g.setAttribute('uv', new Float32BufferAttribute(points.flatMap((p) => [p[2] * 0.75, (horizontal ? p[0] : p[1]) * 0.75]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
    return this.add(g, material, [0, 0, 0], parent);
  }
  private pipe(points: Point[], radius: number, material: Material, parent: Object3D = this.object): void {
    const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)), false, 'centripetal');
    this.add(new TubeGeometry(curve, Math.max(1, (points.length - 1) * 5), radius, 5, false), material, [0, 0, 0], parent);
  }
  private batch(parent: Group): void {
    const byMaterial = new Map<Material, Mesh[]>();
    for (const child of [...parent.children]) {
      if (child instanceof Group) this.batch(child);
      if (!(child instanceof Mesh) || child === this.passengerGlass || child.userData.marking) continue;
      const mat = child.material as Material;
      const group = byMaterial.get(mat) ?? []; group.push(child); byMaterial.set(mat, group);
    }
    for (const [mat, meshes] of byMaterial) {
      if (meshes.length < 2) continue;
      const parts = meshes.map((mesh) => {
        mesh.updateMatrix();
        const g = mesh.geometry.clone().applyMatrix4(mesh.matrix);
        // UVs are needed for brushed stainless. All primitives and panels supply them.
        return g;
      });
      const merged = mergeGeometries(parts);
      for (const p of parts) p.dispose();
      if (!merged) throw new Error('Could not batch car geometry');
      for (const mesh of meshes) { mesh.removeFromParent(); mesh.geometry.dispose(); this.geometries.delete(mesh.geometry); }
      this.add(merged, mat, [0, 0, 0], parent);
    }
  }
  private marking(kind: 'dmc' | 'rear' | 'plate', size: readonly [number, number], at: Point, heading: number, name: string): void {
    const texture = deLoreanMarking(kind);
    if (texture) this.detailTextures.push(texture);
    const material = new MeshBasicMaterial({ color: '#ffffff', map: texture, transparent: kind !== 'plate', alphaTest: 0.1, toneMapped: false });
    this.materials.add(material);
    const mesh = this.add(new PlaneGeometry(...size), material, at);
    mesh.rotation.y = heading; mesh.name = name;
    mesh.userData.marking = kind === 'plate' ? 'OUTATIME' : kind === 'dmc' ? 'DMC' : 'DeLorean';
    mesh.castShadow = mesh.receiveShadow = false;
  }
  private steelGrain(): DataTexture {
    // Fine deterministic longitudinal brushing; a small shared roughness map, not a photo or a per-frame shader.
    const width = 32, height = 256, data = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const grain = 155 + ((y * 73 + Math.floor(x / 8) * 11) % 83);
      data.set([grain, grain, grain, 255], (y * width + x) * 4);
    }
    const texture = new DataTexture(data, width, height, RGBAFormat);
    texture.wrapS = texture.wrapT = RepeatWrapping; texture.needsUpdate = true;
    this.detailTextures.push(texture); return texture;
  }
  private sky(): DataTexture {
    const w = 32, h = 16, pixels = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sky = y < h / 2, band = x % 8 < 2 ? 28 : 0;
      const i = (y * w + x) * 4;
      pixels.set([sky ? 150 + band : 78, sky ? 178 + band : 82, sky ? 202 + band : 78, 255], i);
    }
    const texture = new DataTexture(pixels, w, h, RGBAFormat);
    texture.mapping = EquirectangularReflectionMapping; texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true;
    return texture;
  }
}

function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }
