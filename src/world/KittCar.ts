import {
  BackSide, BoxGeometry, BufferGeometry, CatmullRomCurve3, CylinderGeometry, DataTexture, DoubleSide,
  EquirectangularReflectionMapping, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial, PlaneGeometry,
  RGBAFormat, Shape, ShapeGeometry, SRGBColorSpace, TorusGeometry, TubeGeometry, Vector3,
  type Material, type Object3D, type Texture,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { CARS } from '../config/cars';
import type { RideCar } from './RideCar';
import { CONSOLE_BARS, kittConsoleTexture, kittDashTexture } from './kittDash';
import { kittScanner, kittVoice } from './kittLights';

type Point = readonly [number, number, number];
const K = CARS.kitt;
/** Half the body's width, where its sides are. */
const W = K.width / 2;
/** The doors: from the A-pillar (their hinge) back to the B-pillar. */
const DOOR = { front: 0.62, back: -0.78 } as const;
const NOSE = 2.32, TAIL = -2.34;

/**
 * The black talking car (owner, 2026-10-20; D37): an original, code-built homage to KITT from Knight Rider: a low,
 * glossy black early-80s T-top coupe with a long wedge nose, the red scanner sweeping across it, black and silver
 * slotted wheels, a big curved rear hatch, and inside, a lit-up dash, an aircraft-style yoke and the voice box with
 * its three columns of red bars between the seats. No photograph, logo, badge, show audio or downloaded model.
 * +z forward, passenger −x. Conventional doors on front hinges (they open together to greet, like the other cars'
 * wings). Static parts are batched by material within each moving assembly; the lights are shaders, not lamps.
 */
export class KittCar implements RideCar {
  readonly id = 'kitt' as const;
  readonly object = new Group();
  readonly seats = { passenger: new Vector3(...K.passenger), driver: new Vector3(...K.driver) };
  readonly window = new Vector3(...K.window);
  readonly headOut = K.headOut;
  readonly cabinView = K.cabinView;
  private readonly doors = { passenger: new Group(), driver: new Group() };
  private readonly wheels: Group[] = [];
  private readonly geometries = new Set<BufferGeometry>();
  private readonly materials = new Set<Material>();
  private readonly textures: Texture[] = [];
  private readonly reflection: DataTexture;
  private readonly passengerGlass: Mesh;
  private readonly scanner = kittScanner();
  private readonly voice = kittVoice();
  private passengerOpen = 0;
  private driverOpen = 0;
  private greetOpen = 0;
  private windowDown = 0;

  constructor() {
    this.object.name = 'Black talking car';
    this.reflection = this.sky();
    // Glossy black, clear-coated like the family car's, so its curves catch the sky.
    const paint = new MeshPhysicalMaterial({
      color: '#15171c', metalness: 0.3, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.05,
      envMap: this.reflection, envMapIntensity: 2.6, side: DoubleSide,
    });
    paint.shadowSide = BackSide;
    this.materials.add(paint);
    const trim = this.material('#050506', 0.2, 0.55);
    const rubber = this.material('#121315', 0, 0.95);
    const alloy = this.material('#c9cdd1', 0.85, 0.25);
    const cabin = this.material('#19191c', 0.05, 0.8);
    const seat = this.material('#77736b', 0, 0.85);
    const glass = this.material('#1f2b33', 0.35, 0.08);
    glass.transparent = true; glass.opacity = 0.46; glass.depthWrite = false; glass.envMapIntensity = 1.3;
    const darkGlass = this.material('#11181d', 0.35, 0.1);
    darkGlass.transparent = true; darkGlass.opacity = 0.72; darkGlass.depthWrite = false;
    const red = this.material('#8e0c0f', 0, 0.35, '#ff2418', 0.9);
    const amber = this.material('#b8661a', 0, 0.45, '#ff9a2a', 0.55);

    // ---- the body
    for (const side of [-1, 1] as const) {
      this.side(side, this.frontFender(), paint);
      this.side(side, this.rearQuarter(), paint);
      // The crease along the flank and the black rocker under it.
      this.pipe([[side * (W + 0.004), 0.47, 2.25], [side * (W + 0.004), 0.47, DOOR.front]], 0.008, trim);
      this.pipe([[side * (W + 0.004), 0.47, DOOR.back], [side * (W + 0.004), 0.47, -2.2]], 0.008, trim);
      this.box([0.05, 0.08, 1.38], [side * (W - 0.03), 0.27, -0.08], trim);
      // Wheel wells: dark liners over the tyres, so the arches never show daylight through the body.
      for (const axle of [K.frontAxle, K.rearAxle]) {
        this.box([0.28, 0.03, 0.86], [side * 0.79, 0.745, axle], trim);
        this.box([0.02, 0.5, 0.86], [side * 0.65, 0.5, axle], trim);
      }
      // Amber marker at the nose's corner, red at the tail's.
      this.box([0.012, 0.045, 0.16], [side * (W + 0.006), 0.39, NOSE - 0.18], amber);
      this.box([0.012, 0.04, 0.12], [side * (W + 0.006), 0.52, -2.12], red);
      // The beltline under the side glass, behind the door.
      this.pipe([[side * 0.915, 0.795, DOOR.back], [side * 0.915, 0.82, -1.95]], 0.018, trim);
    }
    // The long hood falling to the nose, its raised centre and the closed pop-up lamps near its front corners.
    const hoodY = (z: number) => 0.76 - (z - DOOR.front) * (0.24 / (NOSE - DOOR.front));
    this.panel([[-W, 0.76, DOOR.front], [W, 0.76, DOOR.front], [W, 0.52, NOSE], [-W, 0.52, NOSE]], paint);
    this.panel([[-0.3, hoodY(0.75) + 0.03, 0.75], [0.3, hoodY(0.75) + 0.03, 0.75], [0.26, hoodY(2.1) + 0.03, 2.1], [-0.26, hoodY(2.1) + 0.03, 2.1]], paint);
    for (const side of [-1, 1]) {
      this.panel([[side * 0.3, hoodY(0.75) + 0.03, 0.75], [side * 0.3, hoodY(0.75), 0.75], [side * 0.26, hoodY(2.1), 2.1], [side * 0.26, hoodY(2.1) + 0.03, 2.1]], paint);
      this.box([0.42, 0.012, 0.3], [side * 0.58, hoodY(2.05) + 0.006, 2.05], trim, this.object, [0.134, 0, 0]);
    }
    for (const x of [-0.12, 0, 0.12]) this.box([0.06, 0.012, 0.2], [x, hoodY(1.85) + 0.04, 1.85], trim, this.object, [0.134, 0, 0]);
    // The nose: a sharp black beak over a slotted mouth, the scanner's dark slot across it, an air dam under it.
    this.panel([[-W, 0.52, NOSE], [W, 0.52, NOSE], [W * 0.97, 0.4, NOSE + 0.07], [-W * 0.97, 0.4, NOSE + 0.07]], paint);
    this.panel([[-W * 0.97, 0.4, NOSE + 0.07], [W * 0.97, 0.4, NOSE + 0.07], [W * 0.94, 0.25, NOSE - 0.02], [-W * 0.94, 0.25, NOSE - 0.02]], trim);
    for (let y = 0.27; y < 0.38; y += 0.035) this.box([1.5, 0.012, 0.02], [0, y, NOSE + 0.035 + (y - 0.22) * 0.35], rubber);
    const tilt = -Math.atan2(0.07, 0.12);
    const beak = new Vector3(0, 0.07, 0.12).normalize();
    const slot = this.box([K.scanner.width + 0.06, K.scanner.height + 0.025, 0.01], [0, 0.46 + beak.y * 0.004, NOSE + 0.035 + beak.z * 0.004], trim, this.object, [tilt, 0, 0]);
    slot.name = 'Scanner slot';
    this.box([1.72, 0.05, 0.16], [0, 0.245, NOSE - 0.14], trim);

    // ---- the cabin: steep windshield, T-top roof with two glass panels, side and quarter glass, the big rear hatch
    this.panel([[-0.8, 0.76, 0.64], [0.8, 0.76, 0.64], [0.62, 1.29, -0.1], [-0.62, 1.29, -0.1]], glass);
    this.box([1.6, 0.02, 0.08], [0, 0.77, 0.66], trim);
    this.panel([[-0.14, 1.3, -0.1], [0.14, 1.3, -0.1], [0.14, 1.3, -0.86], [-0.14, 1.3, -0.86]], paint);
    this.panel([[-0.64, 1.29, -0.1], [0.64, 1.29, -0.1], [0.64, 1.3, -0.17], [-0.64, 1.3, -0.17]], paint);
    this.panel([[-0.66, 1.3, -0.8], [0.66, 1.3, -0.8], [0.66, 1.29, -0.88], [-0.66, 1.29, -0.88]], paint);
    for (const side of [-1, 1]) {
      this.panel([[side * 0.15, 1.305, -0.17], [side * 0.6, 1.3, -0.17], [side * 0.62, 1.3, -0.8], [side * 0.15, 1.305, -0.8]], darkGlass);
      this.panel([[side * 0.6, 1.3, -0.1], [side * 0.66, 1.285, -0.08], [side * 0.68, 1.285, -0.86], [side * 0.62, 1.3, -0.86]], paint);
      // A-pillar, B-pillar, the rear quarter window and the sail panel behind it.
      this.panel([[side * 0.8, 0.76, 0.64], [side * 0.62, 1.29, -0.1], [side * 0.66, 1.285, -0.08], [side * 0.9, 0.77, 0.6]], paint);
      this.pipe([[side * 0.905, 0.8, -0.8], [side * 0.68, 1.29, -0.82]], 0.03, trim);
      this.panel([[side * 0.905, 0.8, -0.84], [side * 0.68, 1.28, -0.86], [side * 0.8, 0.95, -1.4], [side * 0.91, 0.82, -1.5]], darkGlass);
      this.panel([[side * 0.8, 0.95, -1.4], [side * 0.84, 0.85, -1.95], [side * 0.92, 0.82, -1.95], [side * 0.91, 0.82, -1.5]], paint);
      this.pipe([[side * 0.66, 1.3, -0.88], [side * 0.84, 0.85, -1.95]], 0.02, trim);
    }
    this.panel([[-0.66, 1.29, -0.88], [0.66, 1.29, -0.88], [0.84, 0.85, -1.95], [-0.84, 0.85, -1.95]], darkGlass);
    // The tail: a short deck, the lip spoiler, the full-width red lamp band with its louvres, the bumper.
    this.panel([[-W, 0.84, -1.95], [W, 0.84, -1.95], [W, 0.8, TAIL], [-W, 0.8, TAIL]], paint);
    this.box([1.76, 0.03, 0.16], [0, 0.89, -2.24], paint, this.object, [-0.1, 0, 0]);
    for (const x of [-0.7, 0.7]) this.box([0.05, 0.06, 0.06], [x, 0.85, -2.24], trim);
    this.panel([[-W, 0.8, TAIL], [W, 0.8, TAIL], [W, 0.28, TAIL - 0.03], [-W, 0.28, TAIL - 0.03]], paint);
    this.box([1.62, 0.13, 0.02], [0, 0.64, TAIL - 0.02], red);
    for (const y of [0.61, 0.64, 0.67]) this.box([1.62, 0.006, 0.01], [0, y, TAIL - 0.035], trim);
    this.box([0.36, 0.18, 0.02], [0, 0.42, TAIL - 0.025], trim);
    this.box([1.8, 0.08, 0.06], [0, 0.3, TAIL - 0.02], trim);
    for (const x of [-0.45, -0.3]) this.add(new CylinderGeometry(0.035, 0.035, 0.1, 10), alloy, [x, 0.22, TAIL - 0.04]).rotation.x = Math.PI / 2;
    // Underneath, between the wheels.
    this.box([1.3, 0.08, 4.5], [0, 0.2, 0.03], trim);

    // ---- inside: the floor, the dash and its lit panels, the console with the voice box, the yoke, two seats
    this.box([1.66, 0.04, 1.62], [0, 0.17, -0.17], cabin);
    this.box([1.66, 0.6, 0.04], [0, 0.46, DOOR.front], cabin);
    this.box([1.7, 0.07, 0.4], [0, 0.765, 0.44], cabin);
    this.box([1.7, 0.24, 0.3], [0, 0.6, 0.48], cabin);
    this.box([1.6, 0.5, 0.05], [0, 0.48, -0.96], cabin);
    this.box([1.6, 0.04, 0.98], [0, 0.7, -1.45], cabin);
    const dashArt = kittDashTexture();
    if (dashArt) this.textures.push(dashArt);
    const dash = this.add(new PlaneGeometry(1.64, 0.22), this.lit(dashArt), [0, 0.63, 0.328]);
    dash.rotation.y = Math.PI; dash.name = 'Dash panels';
    // The centre stack under the dash (the voice box on its face) and the low console between the seats.
    this.box([0.36, 0.42, 0.2], [0, 0.39, 0.44], cabin);
    this.box([0.24, 0.2, 0.5], [0, 0.28, -0.2], cabin);
    const stack = new Group(); stack.name = 'Voice box console';
    stack.position.set(0, 0.39, 0.3); stack.rotation.order = 'YXZ'; stack.rotation.set(-0.1, Math.PI, 0);
    this.object.add(stack);
    const consoleArt = kittConsoleTexture();
    if (consoleArt) this.textures.push(consoleArt);
    const size = { w: 0.26, h: 0.39 };
    this.add(new PlaneGeometry(size.w, size.h), this.lit(consoleArt), [0, 0, 0], stack).name = 'Console buttons';
    this.voice.scale.set(CONSOLE_BARS.w * size.w, CONSOLE_BARS.h * size.h, 1);
    this.voice.position.set(0, (0.5 - (CONSOLE_BARS.y + CONSOLE_BARS.h / 2)) * size.h, 0.002);
    stack.add(this.voice);
    this.geometries.add(this.voice.geometry); this.materials.add(this.voice.material);
    // The yoke: an aircraft-style wheel, two grips and a bar across the top, on a column from the dash.
    const yoke = new Group(); yoke.name = 'Steering yoke';
    yoke.position.set(this.seats.driver.x, 0.69, 0.2); yoke.rotation.x = -0.45;
    this.object.add(yoke);
    this.box([0.3, 0.035, 0.035], [0, 0.08, 0], trim, yoke);
    for (const x of [-0.15, 0.15]) this.add(new RoundedBoxGeometry(0.045, 0.18, 0.05, 2, 0.015), trim, [x, 0, 0], yoke);
    this.box([0.18, 0.03, 0.03], [0, -0.07, 0], trim, yoke);
    this.box([0.11, 0.09, 0.05], [0, 0, 0.012], cabin, yoke);
    this.box([0.035, 0.022, 0.01], [0, 0.01, -0.016], red, yoke);
    this.pipe([[this.seats.driver.x, 0.69, 0.22], [this.seats.driver.x, 0.62, 0.42]], 0.025, trim);
    for (const s of Object.values(this.seats)) {
      this.add(new RoundedBoxGeometry(0.48, 0.1, 0.5, 2, 0.035), seat, [s.x, s.y - 0.05, s.z]);
      const back = this.add(new RoundedBoxGeometry(0.46, 0.58, 0.1, 2, 0.035), seat, [s.x, s.y + 0.26, s.z - 0.27]);
      back.rotation.x = 0.25;
      this.add(new RoundedBoxGeometry(0.26, 0.16, 0.08, 2, 0.03), seat, [s.x, s.y + 0.6, s.z - 0.36]);
      for (const x of [-0.21, 0.21]) this.add(new RoundedBoxGeometry(0.06, 0.12, 0.46, 2, 0.025), seat, [s.x + x, s.y + 0.02, s.z]);
      const base = Math.max(0.02, s.y - 0.1 - 0.19);
      this.box([0.4, base, 0.44], [s.x, 0.19 + base / 2, s.z], cabin);
    }

    // ---- the doors: hinged at the A-pillar, each with its outer skin, glass, mirror, handle and inner panel
    let passengerGlass: Mesh | null = null;
    for (const [side, door] of [[-1, this.doors.passenger], [1, this.doors.driver]] as const) {
      door.name = side < 0 ? 'passenger door' : 'driver door';
      door.position.set(side * W, 0, DOOR.front);
      this.object.add(door);
      const local = (p: Point): Point => [p[0] - door.position.x, p[1], p[2] - door.position.z];
      const skin = new Shape();
      skin.moveTo(DOOR.back, 0.24); skin.lineTo(DOOR.back, 0.795); skin.lineTo(DOOR.front, 0.765); skin.lineTo(DOOR.front, 0.24); skin.lineTo(DOOR.back, 0.24);
      this.sideShape(side, skin, paint, door);
      this.panel([local([side * 0.86, 0.26, DOOR.back]), local([side * 0.86, 0.78, DOOR.back]), local([side * 0.86, 0.75, DOOR.front - 0.02]), local([side * 0.86, 0.26, DOOR.front - 0.02])], cabin, door);
      this.pipe([local([side * 0.915, 0.765, DOOR.front]), local([side * 0.915, 0.795, DOOR.back])], 0.018, trim, door);
      this.pipe([local([side * (W + 0.004), 0.47, DOOR.front]), local([side * (W + 0.004), 0.47, DOOR.back])], 0.008, trim, door);
      this.box([0.012, 0.03, 0.12], local([side * (W + 0.008), 0.68, -0.6]), trim, door);
      this.box([0.08, 0.02, 0.03], local([side * (W + 0.03), 0.84, 0.47]), trim, door);
      this.add(new RoundedBoxGeometry(0.06, 0.08, 0.15, 2, 0.02), paint, local([side * (W + 0.08), 0.86, 0.45]), door);
      const pane = this.panel([local([side * 0.89, 0.78, 0.58]), local([side * 0.66, 1.28, -0.08]), local([side * 0.68, 1.28, DOOR.back]), local([side * 0.905, 0.8, DOOR.back])], glass, door);
      if (side < 0) passengerGlass = pane;
    }
    this.passengerGlass = passengerGlass!;
    this.passengerGlass.name = 'passenger window';

    // ---- wheels: black dished centres, a ring of fine silver slots near the rim, five dark holes
    for (const x of [-(W - 0.12), W - 0.12]) for (const z of [K.frontAxle, K.rearAxle]) {
      const wheel = new Group(); wheel.position.set(x, K.wheelRadius, z);
      this.object.add(wheel); this.wheels.push(wheel);
      const sign = Math.sign(x), face = sign * (K.wheelWidth / 2 + 0.003);
      this.add(new CylinderGeometry(K.wheelRadius, K.wheelRadius, K.wheelWidth, 24), rubber, [0, 0, 0], wheel).rotation.z = Math.PI / 2;
      this.add(new CylinderGeometry(0.245, 0.245, 0.014, 24), trim, [face, 0, 0], wheel).rotation.z = Math.PI / 2;
      this.add(new TorusGeometry(0.24, 0.012, 6, 28), alloy, [face + sign * 0.006, 0, 0], wheel).rotation.y = Math.PI / 2;
      for (let i = 0; i < 30; i++) {
        const a = (i * Math.PI * 2) / 30;
        const blade = this.box([0.006, 0.034, 0.014], [face + sign * 0.009, Math.cos(a) * 0.212, Math.sin(a) * 0.212], alloy, wheel);
        blade.rotation.x = a;
      }
      this.add(new CylinderGeometry(0.16, 0.17, 0.03, 20), paint, [face + sign * 0.01, 0, 0], wheel).rotation.z = Math.PI / 2;
      for (let i = 0; i < 5; i++) {
        const a = (i * Math.PI * 2) / 5;
        this.box([0.008, 0.03, 0.03], [face + sign * 0.026, Math.sin(a) * 0.085, Math.cos(a) * 0.085], rubber, wheel);
      }
    }

    this.batch(this.object);
    // The scanner, on the beak's face just in front of its slot (after batching: its shader is its own).
    this.scanner.position.set(0, 0.46 + beak.y * 0.012, NOSE + 0.035 + beak.z * 0.012);
    this.scanner.rotation.x = tilt;
    this.object.add(this.scanner);
    this.geometries.add(this.scanner.geometry); this.materials.add(this.scanner.material);
  }

  setPassengerDoor(open: number): void { this.passengerOpen = clamp(open); this.poseDoors(); }
  setDriverDoor(open: number): void { this.driverOpen = clamp(open); this.poseDoors(); }
  /** The greeting: both doors swing open together (it has no wings), and shut again. */
  setFalconDoors(open: number): void { this.greetOpen = clamp(open); this.poseDoors(); }
  setPassengerWindow(down: number): void {
    this.windowDown = clamp(down);
    this.passengerGlass.visible = this.windowDown < 0.98;
  }
  get passengerDoorOpen(): number { return this.passengerOpen; }
  get driverDoorOpen(): number { return this.driverOpen; }
  get falconDoorsOpen(): number { return this.greetOpen; }
  get passengerWindowDown(): number { return this.windowDown; }
  roll(distance: number): void { for (const wheel of this.wheels) wheel.rotation.x += distance / K.wheelRadius; }
  /** The scanner sweeps and the voice box talks, on game time (frozen by pause). */
  updatePresentation(time: number): void {
    this.scanner.material.uniforms.time!.value = time;
    this.voice.material.uniforms.time!.value = time;
  }
  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    for (const t of this.textures) t.dispose();
    this.reflection.dispose();
    this.object.removeFromParent();
  }

  private poseDoors(): void {
    // Out on their front hinges: the passenger's swings out to −x, the driver's to +x.
    this.doors.passenger.rotation.y = K.doorSwing * Math.max(this.greetOpen, this.passengerOpen);
    this.doors.driver.rotation.y = -K.doorSwing * Math.max(this.greetOpen, this.driverOpen);
  }

  /** The front fender's side, nose to door, its wheel arch cut out (z along, y up). */
  private frontFender(): Shape {
    const s = new Shape(), a = K.frontAxle;
    s.moveTo(DOOR.front, 0.24); s.lineTo(DOOR.front, 0.765); s.lineTo(NOSE, 0.52); s.lineTo(NOSE + 0.07, 0.4); s.lineTo(NOSE - 0.02, 0.25);
    s.lineTo(a + 0.4, 0.22); s.absarc(a, 0.33, 0.4, 0, Math.PI, false); s.lineTo(DOOR.front, 0.24);
    return s;
  }

  /** The rear quarter's side, door to tail, its wheel arch cut out. */
  private rearQuarter(): Shape {
    const s = new Shape(), a = K.rearAxle;
    s.moveTo(DOOR.back, 0.24); s.lineTo(DOOR.back, 0.795); s.lineTo(-1.95, 0.84); s.lineTo(TAIL, 0.8); s.lineTo(TAIL - 0.03, 0.28);
    s.lineTo(a - 0.4, 0.24); s.absarc(a, 0.33, 0.4, Math.PI, 0, true); s.lineTo(DOOR.back, 0.24);
    return s;
  }

  private side(side: number, shape: Shape, material: Material): void {
    this.sideShape(side, shape, material, this.object);
  }

  /** A side profile (shape x = z) stood up on the car's side `side` (−1 passenger, 1 driver), in `parent`'s space. */
  private sideShape(side: number, shape: Shape, material: Material, parent: Object3D): void {
    const g = new ShapeGeometry(shape, 10); g.rotateY(-Math.PI / 2);
    this.add(g, material, [side * W - parent.position.x, 0, -parent.position.z], parent);
  }

  /** Unlit art (the dash's lights glow whatever the sun does); plain dark where there's no canvas. */
  private lit(map: Texture | null): MeshBasicMaterial {
    const m = new MeshBasicMaterial({ color: map ? '#ffffff' : '#141416', map, toneMapped: false });
    this.materials.add(m);
    return m;
  }

  private material(color: string, metalness: number, roughness: number, emissive = '#000000', emissiveIntensity = 0): MeshStandardMaterial {
    const m = new MeshStandardMaterial({ color, metalness, roughness, emissive, emissiveIntensity, side: DoubleSide, envMap: this.reflection, envMapIntensity: 0.85 });
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
    g.setAttribute('uv', new Float32BufferAttribute(points.flatMap((p) => [p[2], p[1]]), 2));
    g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
    return this.add(g, material, [0, 0, 0], parent);
  }
  private pipe(points: Point[], radius: number, material: Material, parent: Object3D = this.object): void {
    const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)), false, 'centripetal');
    this.add(new TubeGeometry(curve, Math.max(1, (points.length - 1) * 4), radius, 5, false), material, [0, 0, 0], parent);
  }
  /** One draw per material within each assembly (body, each door, each wheel, the yoke, the console). */
  private batch(parent: Object3D): void {
    const byMaterial = new Map<Material, Mesh[]>();
    for (const child of [...parent.children]) {
      if (child instanceof Group) this.batch(child);
      if (!(child instanceof Mesh) || child === this.passengerGlass || child.name) continue;
      const mat = child.material as Material;
      const group = byMaterial.get(mat) ?? []; group.push(child); byMaterial.set(mat, group);
    }
    for (const [mat, meshes] of byMaterial) {
      if (meshes.length < 2) continue;
      const parts = meshes.map((mesh) => {
        mesh.updateMatrix();
        const g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
        return g.applyMatrix4(mesh.matrix);
      });
      // Every part needs the same attributes to merge (shapes and panels have no normals until computed).
      for (const p of parts) { if (!p.attributes.normal) p.computeVertexNormals(); if (!p.attributes.uv) p.setAttribute('uv', new Float32BufferAttribute(new Float32Array(p.attributes.position!.count * 2), 2)); }
      const merged = mergeGeometries(parts);
      for (const p of parts) p.dispose();
      if (!merged) throw new Error('Could not batch car geometry');
      for (const mesh of meshes) { mesh.removeFromParent(); mesh.geometry.dispose(); this.geometries.delete(mesh.geometry); }
      this.add(merged, mat, [0, 0, 0], parent);
    }
  }
  private sky(): DataTexture {
    // A soft sky over dark ground, with bright bands for the black paint to catch (reflections only, no image).
    const w = 32, h = 16, pixels = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const sky = y < h / 2, band = x % 8 < 2 ? 30 : 0;
      pixels.set([sky ? 190 + band : 55, sky ? 205 + band : 57, sky ? 225 + band : 55, 255], (y * w + x) * 4);
    }
    const texture = new DataTexture(pixels, w, h, RGBAFormat);
    texture.mapping = EquirectangularReflectionMapping; texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true;
    return texture;
  }
}

function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }
