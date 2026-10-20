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
import { familyCarPlate } from './familyCarPlate';

type Point = readonly [number, number, number];
const K = CARS.kitt;
/** Half the body's width, where its sides are. */
const W = K.width / 2;
/** The doors: from the A-pillar (their hinge) back to the B-pillar. */
const DOOR = { front: 0.42, back: -0.98 } as const;
/** The tail's face; the beak's tip (middle) and the nose's corners, set back. */
const TAIL = -2.37;
const NOSE = { tip: 2.36, corner: 2.24 } as const;
/** The windshield, from its base at the cowl up to the roof; the roof's height and where it ends (the hatch starts). */
const SCREEN = { base: 0.56, top: -0.2 } as const;
const ROOF = 1.26, ROOF_END = -0.9;
/** How far back the tail's face is at `x`: the middle furthest back, the corners swept forward. */
function tailZ(x: number): number {
  return TAIL + 0.1 * Math.pow(Math.min(1, Math.abs(x) / W), 2.5);
}
/** Where the rear hatch glass meets the deck. */
const HATCH_END = -2.02;
/** The hood: from the cowl (`SCREEN.base`) to its front edge, above the beak. */
const HOOD = { front: 2.16, cowl: 0.84, edge: 0.64 } as const;
/** The dash's face (toward the seats) and its back (at the firewall). */
const DASH = { face: 0.17, back: 0.5 } as const;
/** How steeply the hood falls toward its front corners (for the pop-up lamp lids lying on it). */
const HOOD_SLOPE = 1.25 * Math.atan2(HOOD.cowl - HOOD.edge, HOOD.front - SCREEN.base);
/** Wheel arch radius. */
const ARCH = 0.4;

/** The hood's surface: `u` cowl (0) to front edge (1), `v` −1..1 across. A gentle crown and a raised centre bulge. */
function hoodPoint(u: number, v: number): Point {
  const half = W - 0.05 * u * u;
  const x = v * half;
  const edge = HOOD.cowl + (HOOD.edge - HOOD.cowl) * Math.pow(u, 1.25);
  const crown = 0.035 * (1 - v * v);
  const bulge = 0.028 * (1 - smooth(0.24, 0.34, Math.abs(x))) * (1 - smooth(0.7, 0.95, u));
  return [x, edge + crown + bulge, SCREEN.base + (HOOD.front - SCREEN.base) * u];
}
/** How far forward the beak comes at `x`: flat across the middle (the scanner's), swept back at the corners. */
function beakZ(x: number): number {
  const out = Math.max(0, Math.abs(x) - 0.46) / (W - 0.46);
  return NOSE.tip - (NOSE.tip - NOSE.corner) * out * out;
}
/** The scanner's tilt (the beak's upper face leans back) and its centre, `out` m in front of the face. */
const BEAK_TILT = -Math.atan2(HOOD.edge + 0.035 - 0.47, NOSE.tip - HOOD.front);
function scannerAt(out: number): Point {
  const top = hoodPoint(1, 0);
  const y = (top[1] + 0.47) / 2, z = (top[2] + NOSE.tip) / 2;
  const n = new Vector3(0, NOSE.tip - top[2], top[1] - 0.47).normalize();
  return [0, y + n.y * out, z + n.z * out];
}
/** The rear hatch glass: `u` roof (0) to deck (1), `v` −1..1 across; a bubble that wraps down at its sides. */
function hatchPoint(u: number, v: number): Point {
  const half = 0.62 + (0.86 - 0.62) * u;
  const middle = ROOF + (0.88 - ROOF) * u + 0.05 * Math.sin(Math.PI * u);
  const wrap = (0.03 + 0.03 * u) * v * v;
  return [v * half, middle - wrap, ROOF_END + (HATCH_END - ROOF_END) * u];
}
function smooth(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

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
  readonly intro = K.intro;
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

    // ---- the body (proportions from the owner's side-on photo, scaled by its wheels)
    for (const side of [-1, 1] as const) {
      this.side(side, this.frontFender(), paint);
      this.side(side, this.rearQuarter(), paint);
      // Flared lips round the wheel arches, the crease along the flank and the black rocker under it.
      for (const axle of [K.frontAxle, K.rearAxle]) {
        const lip = this.add(new TorusGeometry(ARCH, 0.03, 6, 18, Math.PI), paint, [side * (W + 0.004), 0.33, axle]);
        lip.rotation.y = Math.PI / 2;
        // Wheel wells: dark liners over the tyres, so the arches never show daylight through the body.
        this.box([0.28, 0.03, 0.86], [side * 0.79, 0.745, axle], trim);
        this.box([0.02, 0.5, 0.86], [side * 0.65, 0.5, axle], trim);
      }
      this.pipe([[side * (W + 0.004), 0.5, 2.1], [side * (W + 0.004), 0.5, K.frontAxle + ARCH + 0.04]], 0.007, trim);
      this.pipe([[side * (W + 0.004), 0.5, K.frontAxle - ARCH - 0.04], [side * (W + 0.004), 0.5, DOOR.front]], 0.007, trim);
      this.pipe([[side * (W + 0.004), 0.5, DOOR.back], [side * (W + 0.004), 0.5, K.rearAxle + ARCH + 0.04]], 0.007, trim);
      this.box([0.05, 0.08, K.frontAxle - K.rearAxle - 2 * ARCH - 0.1], [side * (W - 0.03), 0.27, (K.frontAxle + K.rearAxle) / 2], trim);
      // Amber marker at the nose's corner, red at the tail's.
      this.box([0.012, 0.045, 0.16], [side * (W + 0.006), 0.42, 2.06], amber);
      this.box([0.012, 0.04, 0.12], [side * (W + 0.006), 0.6, tailZ(W) + 0.14], red);
    }
    // The long hood: a gentle crown, the raised centre bulge, the closed pop-up lamps near its front corners.
    this.surface((u, v) => hoodPoint(u, v), 12, 10, paint);
    for (const side of [-1, 1]) {
      const lid = hoodPoint(0.86, side * 0.62);
      this.box([0.4, 0.012, 0.26], [lid[0], lid[1] + 0.008, lid[2]], trim, this.object, [HOOD_SLOPE, 0, 0]);
      // The little triangle between the windshield's corner, the door's glass and the fender top.
      this.panel([[side * 0.78, 0.85, SCREEN.base], [side * 0.88, 0.83, DOOR.front + 0.05], [side * W, 0.83, DOOR.front + 0.05], [side * W, 0.84, SCREEN.base]], paint);
    }
    // The nose: the black beak with the scanner across it, a slotted mouth and the air dam under it.
    this.surface((u, v) => {
      const x = v * (W - 0.01), top = hoodPoint(1, v);
      return [x, top[1] + (0.47 - top[1]) * u, top[2] + (beakZ(x) - top[2]) * u];
    }, 2, 12, paint);
    this.surface((u, v) => {
      const x = v * (W - 0.03);
      return [x, 0.47 - 0.21 * u, beakZ(x) - (0.1 + 0.02 * u) * u];
    }, 2, 12, trim);
    for (let y = 0.3; y < 0.44; y += 0.035) this.box([1.36, 0.012, 0.02], [0, y, beakZ(0) - (0.47 - y) * 0.5 + 0.012], rubber);
    this.box([1.66, 0.05, 0.16], [0, 0.25, beakZ(0) - 0.2], trim);
    const slot = this.box([K.scanner.width + 0.06, K.scanner.height + 0.025, 0.01], scannerAt(0.004), trim, this.object, [BEAK_TILT, 0, 0]);
    slot.name = 'Scanner slot';

    // ---- the cabin: the raked windshield, the T-top roof with two glass panels, the big wraparound rear hatch
    this.surface((u, v) => {
      const half = 0.78 + (0.62 - 0.78) * u;
      return [v * half, 0.85 + (ROOF - 0.85) * u, SCREEN.base + (SCREEN.top - SCREEN.base) * u + 0.035 * (1 - v * v) * Math.sin(Math.PI * u)];
    }, 4, 8, glass);
    this.box([1.5, 0.02, 0.06], [0, 0.86, SCREEN.base - 0.02], trim);
    this.panel([[-0.62, ROOF, SCREEN.top], [0.62, ROOF, SCREEN.top], [0.64, ROOF + 0.01, SCREEN.top - 0.07], [-0.64, ROOF + 0.01, SCREEN.top - 0.07]], paint);
    this.panel([[-0.13, ROOF + 0.01, SCREEN.top - 0.07], [0.13, ROOF + 0.01, SCREEN.top - 0.07], [0.13, ROOF + 0.01, ROOF_END + 0.07], [-0.13, ROOF + 0.01, ROOF_END + 0.07]], paint);
    this.panel([[-0.66, ROOF + 0.01, ROOF_END + 0.07], [0.66, ROOF + 0.01, ROOF_END + 0.07], [0.64, ROOF, ROOF_END], [-0.64, ROOF, ROOF_END]], paint);
    for (const side of [-1, 1]) {
      this.panel([[side * 0.15, ROOF + 0.012, SCREEN.top - 0.07], [side * 0.6, ROOF + 0.008, SCREEN.top - 0.07], [side * 0.62, ROOF + 0.008, ROOF_END + 0.07], [side * 0.15, ROOF + 0.012, ROOF_END + 0.07]], darkGlass);
      this.panel([[side * 0.6, ROOF + 0.01, SCREEN.top], [side * 0.645, ROOF - 0.015, SCREEN.top + 0.03], [side * 0.67, ROOF - 0.015, DOOR.back + 0.02], [side * 0.62, ROOF + 0.01, ROOF_END]], paint);
      // A-pillar, B-pillar, the rear quarter window, and the sail panel down to the deck.
      this.panel([[side * 0.78, 0.85, SCREEN.base], [side * 0.62, ROOF, SCREEN.top], [side * 0.645, ROOF - 0.015, SCREEN.top + 0.03], [side * 0.88, 0.83, DOOR.front + 0.05]], paint);
      this.pipe([[side * 0.905, 0.82, DOOR.back - 0.01], [side * 0.67, ROOF - 0.01, DOOR.back + 0.02]], 0.03, trim);
      const edge = (u: number) => hatchPoint(u, side);
      this.panel([[side * 0.905, 0.83, DOOR.back - 0.04], [side * 0.67, ROOF - 0.02, DOOR.back], edge(0.42), [side * 0.905, 0.85, -1.6]], darkGlass);
      this.panel([edge(0.42), edge(1), [side * W, 0.86, HATCH_END], [side * 0.905, 0.85, -1.6]], paint);
      this.pipe([0, 0.2, 0.42, 0.6, 0.8, 1].map(edge), 0.02, trim);
      this.pipe([[side * 0.915, 0.82, DOOR.back], [side * 0.915, 0.86, HATCH_END]], 0.016, trim);
    }
    this.surface((u, v) => hatchPoint(u, v), 8, 10, darkGlass);
    // The tail (after the owner's rear three-quarter photo): a short deck, the wing across its end with little end
    // caps, a black lamp face with a red lens at each end (black ribs across them, a black panel between), the rounded
    // body-colour bumper under it with the KITT plate in its pocket, a black valance and twin pipes. Its corners sweep
    // forward (`tailZ`).
    this.surface((u, v) => [v * W, 0.875 - 0.015 * u + 0.012 * (1 - v * v), HATCH_END + (tailZ(v * W) + 0.04 - HATCH_END) * u], 2, 10, paint);
    this.surface((u, v) => [v * 0.84, 0.885 + 0.035 * u * u, -2.2 + (tailZ(v * 0.84) + 0.03 + 2.2) * u], 3, 10, paint);
    for (const side of [-1, 1]) {
      this.box([0.02, 0.06, 0.15], [side * 0.85, 0.89, tailZ(0.85) + 0.1], paint);
      this.box([0.06, 0.04, 0.05], [side * 0.6, 0.87, -2.26], trim);
    }
    this.surface((u, v) => [v * W, 0.86 - 0.32 * u, tailZ(v * W) + 0.04 * (1 - u)], 3, 12, trim);
    const strip = (x0: number, x1: number, y0: number, y1: number, out: number, material: Material) =>
      this.surface((u, v) => {
        const x = x0 + (x1 - x0) * (v + 1) / 2, y = y1 + (y0 - y1) * u;
        // On the lamp face (which leans back 4 cm over its height), `out` m proud of it.
        return [x, y, tailZ(x) + 0.04 * (1 - (0.86 - y) / 0.32) - out];
      }, 1, 6, material);
    for (const side of [-1, 1]) {
      const [a, b] = side < 0 ? [-0.86, -0.3] : [0.3, 0.86];
      strip(a, b, 0.58, 0.77, 0.006, red);
      for (const y of [0.612, 0.645, 0.678, 0.711, 0.744]) strip(a, b, y - 0.005, y + 0.005, 0.011, trim);
    }
    this.surface((u, v) => [v * W, 0.54 - 0.24 * u, tailZ(v * W) - 0.02 - 0.05 * Math.sin(Math.PI * u) * (1 - 0.6 * v * v)], 4, 12, paint);
    this.box([1.62, 0.06, 0.08], [0, 0.28, TAIL + 0.02], trim);
    this.box([0.36, 0.19, 0.02], [0, 0.43, TAIL - 0.068], trim);
    const plateArt = familyCarPlate(K.plate);
    if (plateArt) this.textures.push(plateArt);
    const plate = this.add(new PlaneGeometry(0.3, 0.15), this.lit(plateArt), [0, 0.43, TAIL - 0.08]);
    plate.rotation.y = Math.PI; plate.name = `${K.plate} license plate`; plate.userData.marking = K.plate;
    plate.castShadow = plate.receiveShadow = false;
    for (const x of [-0.45, -0.3]) this.add(new CylinderGeometry(0.035, 0.035, 0.12, 10), alloy, [x, 0.22, TAIL - 0.03]).rotation.x = Math.PI / 2;
    // Underneath, between the wheels.
    this.box([1.3, 0.08, 4.4], [0, 0.2, 0], trim);

    // ---- inside: the floor, the dash and its lit panels, the console with the voice box, the yoke, two seats
    this.box([1.66, 0.04, 1.75], [0, 0.17, -0.38], cabin);
    this.box([1.66, 0.6, 0.04], [0, 0.46, DASH.back], cabin);
    this.box([1.7, 0.07, DASH.back - DASH.face], [0, 0.79, (DASH.back + DASH.face) / 2], cabin);
    this.box([1.7, 0.24, 0.3], [0, 0.63, DASH.face + 0.15], cabin);
    this.box([1.6, 0.5, 0.05], [0, 0.48, ROOF_END - 0.22], cabin);
    this.box([1.6, 0.04, 0.85], [0, 0.7, ROOF_END - 0.68], cabin);
    const dashArt = kittDashTexture();
    if (dashArt) this.textures.push(dashArt);
    const dash = this.add(new PlaneGeometry(1.64, 0.2), this.lit(dashArt), [0, 0.655, DASH.face - 0.002]);
    dash.rotation.y = Math.PI; dash.name = 'Dash panels';
    // The centre stack under the dash (the voice box on its face) and the low console between the seats.
    this.box([0.36, 0.38, 0.2], [0, 0.37, DASH.face + 0.1], cabin);
    this.box([0.24, 0.2, 0.55], [0, 0.28, this.seats.driver.z + 0.08], cabin);
    const stack = new Group(); stack.name = 'Voice box console';
    stack.position.set(0, 0.37, DASH.face - 0.02); stack.rotation.order = 'YXZ'; stack.rotation.set(-0.1, Math.PI, 0);
    this.object.add(stack);
    const consoleArt = kittConsoleTexture();
    if (consoleArt) this.textures.push(consoleArt);
    const size = { w: 0.25, h: 0.37 };
    this.add(new PlaneGeometry(size.w, size.h), this.lit(consoleArt), [0, 0, 0], stack).name = 'Console buttons';
    this.voice.scale.set(CONSOLE_BARS.w * size.w, CONSOLE_BARS.h * size.h, 1);
    this.voice.position.set(0, (0.5 - (CONSOLE_BARS.y + CONSOLE_BARS.h / 2)) * size.h, 0.002);
    stack.add(this.voice);
    this.geometries.add(this.voice.geometry); this.materials.add(this.voice.material);
    // The yoke: an aircraft-style wheel, two grips and a bar across the top, on a column from the dash.
    const yoke = new Group(); yoke.name = 'Steering yoke';
    yoke.position.set(this.seats.driver.x, 0.71, DASH.face - 0.2); yoke.rotation.x = -0.45;
    this.object.add(yoke);
    this.box([0.3, 0.035, 0.035], [0, 0.08, 0], trim, yoke);
    for (const x of [-0.15, 0.15]) this.add(new RoundedBoxGeometry(0.045, 0.18, 0.05, 2, 0.015), trim, [x, 0, 0], yoke);
    this.box([0.18, 0.03, 0.03], [0, -0.07, 0], trim, yoke);
    this.box([0.11, 0.09, 0.05], [0, 0, 0.012], cabin, yoke);
    this.box([0.035, 0.022, 0.01], [0, 0.01, -0.016], red, yoke);
    this.pipe([[this.seats.driver.x, 0.71, DASH.face - 0.18], [this.seats.driver.x, 0.64, DASH.face + 0.02]], 0.025, trim);
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
      skin.moveTo(DOOR.back, 0.24); skin.lineTo(DOOR.back, 0.82); skin.lineTo(DOOR.front, 0.82); skin.lineTo(DOOR.front, 0.24); skin.lineTo(DOOR.back, 0.24);
      this.sideShape(side, skin, paint, door);
      this.panel([local([side * 0.86, 0.26, DOOR.back]), local([side * 0.86, 0.8, DOOR.back]), local([side * 0.86, 0.8, DOOR.front - 0.02]), local([side * 0.86, 0.26, DOOR.front - 0.02])], cabin, door);
      this.pipe([local([side * 0.915, 0.82, DOOR.front]), local([side * 0.915, 0.82, DOOR.back])], 0.016, trim, door);
      this.pipe([local([side * (W + 0.004), 0.5, DOOR.front]), local([side * (W + 0.004), 0.5, DOOR.back])], 0.007, trim, door);
      this.box([0.012, 0.03, 0.12], local([side * (W + 0.008), 0.72, DOOR.back + 0.22]), trim, door);
      this.box([0.08, 0.02, 0.03], local([side * (W + 0.03), 0.87, DOOR.front - 0.06]), trim, door);
      this.add(new RoundedBoxGeometry(0.06, 0.08, 0.15, 2, 0.02), paint, local([side * (W + 0.08), 0.89, DOOR.front - 0.08]), door);
      const pane = this.panel([local([side * 0.88, 0.83, DOOR.front + 0.05]), local([side * 0.645, ROOF - 0.015, SCREEN.top + 0.03]), local([side * 0.67, ROOF - 0.015, DOOR.back + 0.02]), local([side * 0.905, 0.82, DOOR.back])], glass, door);
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
    this.scanner.position.set(...scannerAt(0.012));
    this.scanner.rotation.x = BEAK_TILT;
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
  /** The cockpit scene as they pull out of the driveway: the voice box talks all through it. */
  setIntro(t: number | null): void {
    this.voice.material.uniforms.talk!.value = t === null ? 0 : smooth(0.2, 0.6, t);
  }

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

  /** The front fender's side, door to nose, its wheel arch cut out (z along, y up): the top follows the hood's edge. */
  private frontFender(): Shape {
    const s = new Shape(), a = K.frontAxle;
    s.moveTo(DOOR.front, 0.24); s.lineTo(DOOR.front, 0.82); s.lineTo(SCREEN.base, 0.84);
    for (let i = 1; i <= 8; i++) { const p = hoodPoint(i / 8, 1); s.lineTo(Math.min(p[2], NOSE.corner - 0.04), p[1]); }
    s.lineTo(NOSE.corner, 0.5); s.lineTo(NOSE.corner - 0.03, 0.26);
    s.lineTo(a + ARCH, 0.24); s.absarc(a, 0.33, ARCH, 0, Math.PI, false); s.lineTo(DOOR.front, 0.24);
    return s;
  }

  /** The rear quarter's side, door to tail, its wheel arch cut out. */
  private rearQuarter(): Shape {
    const s = new Shape(), a = K.rearAxle;
    s.moveTo(DOOR.back, 0.24); s.lineTo(DOOR.back, 0.82); s.lineTo(HATCH_END, 0.86); s.lineTo(tailZ(W) + 0.04, 0.86); s.lineTo(tailZ(W) - 0.02, 0.3);
    s.lineTo(a - ARCH, 0.24); s.absarc(a, 0.33, ARCH, Math.PI, 0, true); s.lineTo(DOOR.back, 0.24);
    return s;
  }

  /** A smooth surface over `u` 0..1 and `v` −1..1 (`nu` × `nv` cells), from `point(u, v)` in car space. */
  private surface(point: (u: number, v: number) => Point, nu: number, nv: number, material: Material): Mesh {
    const positions: number[] = [], uvs: number[] = [], index: number[] = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) {
      const p = point(i / nu, (j / nv) * 2 - 1);
      positions.push(...p); uvs.push(p[2], p[0]);
    }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j, b = a + nv + 1;
      index.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
    g.setIndex(index); g.computeVertexNormals();
    return this.add(g, material, [0, 0, 0]);
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
