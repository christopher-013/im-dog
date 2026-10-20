import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  AdditiveBlending,
  Quaternion,
  Scene,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Vector3,
  type Material,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32 } from '../utils/random';
import { fitVerticalFov } from '../camera/ThirdPersonCamera';
import type { CarId } from '../config/cars';
import { createCar } from '../world/cars';
import type { RideCar } from '../world/RideCar';
import { BeachLife } from './beachLife';
import { BEACH, BIKE_LANE, coastX, drivePath, LAGOON, landHeight, ROAD_HALF, roadAt, routeCurve, samplePath, smooth } from './coastRoute';
import { palmGeometry, type PalmKind } from './palms';
import { Traffic } from './traffic';
import { hoverAltitude, hoverDeployment } from './hover';
import { departureHome } from './departureHome';
import { DEPARTURE_HOME, RIDE } from '../config/ride';
import { departureRoute } from './departureRoute';

/**
 * The camera shots, in the order "change the view" goes through them: alongside (just behind his window on the sea
 * side, looking ahead with him, the beach and the sea on the right), his face (from low down just ahead of his door,
 * looking up and back at him against the sky, the beach behind him), behind the car, and a drone high over the beach behind it.
 */
export const DRIVE_VIEWS = ['alongside', 'face', 'cabin', 'chase', 'drone'] as const;
export type DriveView = (typeof DRIVE_VIEWS)[number];

/** Each shot in the car's space (+z ahead, −x the passenger side, the sea's): where the camera is, what it looks at. */
const SHOTS: Record<DriveView, { pos: readonly [number, number, number]; look: readonly [number, number, number]; fov: number }> = {
  alongside: { pos: [-2.55, 1.6, -2.6], look: [-0.9, 1.15, 6], fov: 55 },
  face: { pos: [-2.35, 1.35, 1.15], look: [-1.12, 1.4, 0.45], fov: 42 },
  /** Inside (only a car with a `cabinView`; this is just its stand-in). */
  cabin: { pos: [0, 1.1, -1.0], look: [0, 0.6, 0.6], fov: 62 },
  chase: { pos: [-1.0, 3.1, -9.5], look: [-0.7, 1.3, 9], fov: 55 },
  drone: { pos: [-17, 16, -15], look: [-6, 0, 22], fov: 55 },
};

/**
 * How fast the car goes (m/s), and how long it takes to get up to speed (s). 25.5 m/s (about 57 mph): the whole coast
 * in under a minute (owner, 2026-10-17: "about 20sec shorter" than at 18.5, every stretch of it kept).
 */
export const SPEED = { cruise: 25.5, ease: 5 } as const;
/**
 * The sunset (owner, 2026-10-17: "during sunset at the golden hour, and the drive ends just as the sun is setting"):
 * the way the sun is (x, z: southwest, out over the sea, ahead and to the right going south, so it's in view), how high it is at
 * the start and at the end (radians), and the colours and strengths from the start to the end.
 */
const SUNSET = {
  toward: [-0.36, 0.93] as const,
  elevation: [0.16, -0.004] as const,
  sunLight: ['#ffd08a', '#ff7a3c'] as const,
  sunIntensity: [2.3, 0.95] as const,
  skyLight: ['#a9b8d6', '#6f6f9c'] as const,
  groundLight: ['#a07a5a', '#5e4436'] as const,
  skyIntensity: [1.05, 0.6] as const,
  zenith: ['#5b86c4', '#2f3c72'] as const,
  horizon: ['#f6c896', '#ef8d63'] as const,
  skyGlow: ['#ffe0a0', '#ffa45a'] as const,
  disc: ['#fff1c4', '#ffc070'] as const,
  glow: ['#ffc27a', '#ff8a4a'] as const,
  clouds: ['#ffe9d6', '#ffa08a'] as const,
  headland: ['#b49aa8', '#7c6388'] as const,
  sea: ['#ffffff', '#f2c4b0'] as const,
};
const tmpColor = new Color();
/** How far off the sun's disc is drawn (m): inside the sky, beyond everything else. */
const SUN_DISTANCE = 2600;
const tmpPos = new Vector3();
const tmpDir = new Vector3();
const tmpA = new Vector3();
const tmpB = new Vector3();
const tmpLook = new Vector3();
const UP = new Vector3(0, 1, 0);

/**
 * The drive (Phase 6, D33/D34): a stylized homage to the coast road south from Del Mar along Torrey Pines State Beach
 * and up the grade to the reserve, built in code (no map data, no photos), its own scene, loaded only for a ride. The
 * family car keeps to the right-hand lane with the sea on the passenger side, just under a minute, one way (home is a
 * fade). Whoever runs the ride puts the dog and the human into `dogSeat` and `driverSeat` (the car's space) and poses
 * them; this scene moves the car, the sea, the people, the traffic, the birds and the camera.
 */
export class CoastDrive {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(55, 16 / 9, 0.1, 3200);
  readonly car: RideCar;
  /** In the car's space: put the dog's visual in here (the passenger seat), and the human's (the driver's). */
  readonly dogSeat = new Group();
  readonly driverSeat = new Group();
  view: DriveView = 'alongside';
  private readonly curve = routeCurve();
  private readonly departure = departureRoute(drivePath(this.curve));
  private readonly path = this.departure.path;
  private distance = 0;
  private speed = 0;
  private time = 0;
  private skipping = false;
  private readonly sun = new DirectionalLight('#ffd08a', 2.3);
  private readonly sky = new HemisphereLight('#9fb6d8', '#a07a5a', 1.05);
  /** The sunset (the drive's light, sky and haze, by how far along it is): see `light()`. */
  private readonly sunset: {
    dir: Vector3;
    dome: Mesh<BufferGeometry, MeshBasicMaterial>;
    disc: Mesh<CircleGeometry, MeshBasicMaterial>;
    glow: Sprite;
    clouds: MeshBasicMaterial;
    headland: MeshBasicMaterial;
    sea: MeshStandardMaterial | null;
    shown: number;
  };
  private readonly seaTime = { value: 0 };
  private readonly foam: Mesh<BufferGeometry, MeshBasicMaterial>[] = [];
  private readonly surf: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly birds: Group[] = [];
  private readonly life = new BeachLife();
  private readonly traffic: Traffic;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private readonly textures: CanvasTexture[] = [];
  /** The land's heights as built (the road cut in): for keeping the camera above it. */
  private ground!: { minX: number; minZ: number; step: number; nx: number; nz: number; h: Float32Array };
  /** The view it's gliding from (car space), and how far into the glide (0..1; 1 = there). */
  private readonly from = { pos: new Vector3(), look: new Vector3(), fov: 55, clearance: 0.3 };
  private blend = 1;
  private blendSeconds: number = RIDE.cameraTour.manualBlend;
  /** The takeoff shot was skipped (Change View). */
  private revealSkipped = false;
  /** When the cockpit scene ends (s into the drive; 0 for a car without one), and whether it was cut short. */
  private introEnd = 0;
  private introCut = false;

  constructor(car: CarId = 'family') {
    this.car = createCar(car);
    this.introEnd = this.car.intro?.seconds ?? 0;
    this.scene.name = 'Coast drive';
    this.scene.fog = new Fog('#f2c7a0', 220, 1700);
    const clouds = this.clouds();
    const headland = this.headland();
    this.sunset = { dir: new Vector3(), dome: this.dome(), ...this.sunDisc(), clouds: clouds.material, headland: headland.material, sea: null, shown: -1 };
    this.scene.add(this.sunset.dome, this.sunset.disc, this.sunset.glow, clouds.group, headland.mesh);
    this.scene.add(this.sky);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const s = this.sun.shadow.camera;
    s.left = s.bottom = -22;
    s.right = s.top = 22;
    s.near = 1;
    s.far = 320;
    this.scene.add(this.sun, this.sun.target);

    this.scene.add(this.terrain());
    const sea = this.sea();
    this.sunset.sea = sea.material as MeshStandardMaterial;
    this.scene.add(sea);
    this.surf = this.shoreRibbon(0.5, 7, 0.7);
    this.scene.add(this.surf);
    for (let i = 0; i < 3; i++) {
      const band = this.shoreRibbon(0.48, 2.2, 0);
      this.foam.push(band);
      this.scene.add(band);
    }
    this.scene.add(this.road());
    this.scene.add(this.palms(), this.scrub(), this.houses(), this.signs(), this.flock());
    this.scene.add(this.life.object);
    this.traffic = new Traffic(this.curve, SPEED.cruise);
    this.scene.add(this.traffic.object);

    this.car.object.add(this.dogSeat, this.driverSeat);
    this.dogSeat.position.copy(this.car.seats.passenger);
    this.driverSeat.position.copy(this.car.seats.driver);
    this.car.setPassengerWindow(1);
    this.scene.add(this.car.object);
    this.light(0);
    this.place(0);
    // Fixed in the world at home, never parented to the moving/hovering car.
    const home = departureHome(this.departure.heightAt);
    home.position.copy(this.departure.origin);
    home.rotation.y = this.departure.yaw;
    home.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      this.geometries.push(node.geometry);
      this.materials.push(node.material as Material);
    });
    this.scene.add(home);
    this.aim();
  }

  /** The whole way (m) and how far along it the car is (0..1). */
  get length(): number {
    return this.path.length;
  }

  get progress(): number {
    return this.distance / this.path.length;
  }

  /** There: stopped at the top of the grade. */
  get done(): boolean {
    return this.distance >= this.path.length - 0.01;
  }

  get revealingHover(): boolean {
    const h = this.car.hover;
    return !!h && !this.revealSkipped && this.hoverTime < h.revealSeconds + h.revealBlend;
  }

  /** The car's cockpit scene as it pulls out of the driveway (owner, 2026-10-20), if it has one: playing now. */
  get introPlaying(): boolean {
    return !!this.car.intro && this.time < this.introEnd;
  }

  /** The takeoff's own clock: it starts once the cockpit scene's over. */
  private get hoverTime(): number {
    return this.time - this.introEnd;
  }

  /**
   * Change View during the cockpit scene: on to what comes next (the takeoff, or the road), gliding there. The car
   * carries on as usual. False if there's no cockpit scene playing.
   */
  skipIntro(): boolean {
    if (!this.introPlaying) return false;
    this.currentShot(tmpA, tmpB);
    this.from.pos.copy(tmpA); this.from.look.copy(tmpB);
    this.from.fov = this.camera.fov;
    this.from.clearance = this.cameraClearance();
    this.introEnd = this.time;
    this.introCut = true;
    this.blend = 0;
    this.blendSeconds = RIDE.cameraTour.manualBlend;
    return true;
  }

  /**
   * Change View during the takeoff shot (owner, 2026-10-20): glide straight on to the road views. The car still
   * takes off as usual; only the camera moves on. False if there's no takeoff shot showing.
   */
  skipReveal(): boolean {
    if (!this.revealingHover) return false;
    this.currentShot(tmpA, tmpB);
    this.from.pos.copy(tmpA); this.from.look.copy(tmpB);
    this.from.fov = this.camera.fov;
    this.from.clearance = this.cameraClearance();
    this.revealSkipped = true;
    this.blend = 0;
    this.blendSeconds = RIDE.cameraTour.manualBlend;
    return true;
  }

  /**
   * About how many seconds of the drive are left from here: the rest of the slow street out of the neighbourhood, the
   * coast at cruising speed, and a little for the easing to a stop at the top (for the camera tour's even shares;
   * measured: about 12 s a view, all five, in each car).
   */
  get remainingSeconds(): number {
    const left = this.path.length - this.distance;
    const street = Math.min(left, Math.max(0, this.departure.joinDistance + 5 - this.distance));
    return street / DEPARTURE_HOME.street.speed + (left - street) / SPEED.cruise + Math.min(2, left / 30);
  }

  /** Roughly how long the whole drive takes at the usual speeds (s). */
  get expectedDuration(): number {
    return this.path.length / SPEED.cruise + SPEED.ease + 6 + (this.car.hover?.revealSeconds ?? 0) + (this.car.intro?.seconds ?? 0) * 0.7 +
      this.departure.joinDistance * (1 / DEPARTURE_HOME.street.speed - 1 / SPEED.cruise);
  }

  /** The views this car has, in Change View's order (Inside only where the car has a cabin to show). */
  get views(): readonly DriveView[] {
    return this.car.cabinView ? DRIVE_VIEWS : DRIVE_VIEWS.filter((v) => v !== 'cabin');
  }

  /** Next camera shot (gliding over from this one). */
  nextView(): void {
    const views = this.views;
    this.setView(views[(views.indexOf(this.view) + 1) % views.length]!);
  }

  setView(view: DriveView, blendSeconds: number = RIDE.cameraTour.manualBlend): void {
    if (view === this.view || !this.views.includes(view)) return;
    // Sample into scratch vectors first: manual input can interrupt a still-blending automatic shot.
    this.currentShot(tmpA, tmpB);
    this.from.pos.copy(tmpA); this.from.look.copy(tmpB);
    this.from.fov = this.camera.fov;
    this.from.clearance = this.cameraClearance();
    this.view = view;
    this.blend = 0;
    this.blendSeconds = blendSeconds;
  }

  /** Head home now: straight on to the last stretch. */
  skipHome(): void {
    if (this.skipping) return;
    this.skipping = true;
    this.distance = Math.max(this.distance, this.path.length - SPEED.cruise * 12);
  }

  /** The car's window in the world (for a look-at). */
  windowWorld(out: Vector3): Vector3 {
    return this.car.object.localToWorld(out.copy(this.car.window));
  }

  /** The ground's height as built, road and all (bilinear over the land's grid; the sea's 0 where it's lower). */
  groundAt(x: number, z: number): number {
    const g = this.ground;
    const fx = Math.min(g.nx - 1.001, Math.max(0, (x - g.minX) / g.step));
    const fz = Math.min(g.nz - 1.001, Math.max(0, (z - g.minZ) / g.step));
    const ix = Math.floor(fx), iz = Math.floor(fz);
    const kx = fx - ix, kz = fz - iz;
    const at = (i: number, j: number) => g.h[j * g.nx + i]!;
    const h = (at(ix, iz) * (1 - kx) + at(ix + 1, iz) * kx) * (1 - kz) + (at(ix, iz + 1) * (1 - kx) + at(ix + 1, iz + 1) * kx) * kz;
    return Math.max(h, 0.5);
  }

  update(dt: number, aspect: number): void {
    this.time += dt;
    const hover = this.car.hover;
    this.car.setHover?.(hover ? hoverDeployment(this.hoverTime, hover) : 0, this.hoverTime);
    this.car.updatePresentation?.(this.time);
    this.car.setIntro?.(this.introPlaying ? this.time : null);
    // Speed: easing up from the start, easing to a stop at the top.
    const left = this.path.length - this.distance;
    const target = Math.min(this.distance < this.departure.joinDistance + 5 ? DEPARTURE_HOME.street.speed : SPEED.cruise, 1.2 + left * 0.4);
    // The cockpit scene: a slow roll out of the driveway (easing to a halt before a takeoff). Then the coupe deploys on
    // the road before accelerating; other vehicles keep their usual start.
    const intro = this.car.intro;
    let goal = target;
    if (intro && this.introPlaying) goal = Math.min(target, intro.creep * (intro.stop ? 1 - smooth(intro.seconds - 1.6, intro.seconds, this.time) : 1));
    else if (hover && this.hoverTime < hover.revealSeconds) goal = 0;
    this.speed += (goal - this.speed) * Math.min(1, dt / (this.time < SPEED.ease ? 1.6 : 0.9));
    // Within a hand's breadth of the end: there.
    const step = left < 0.2 ? left : Math.min(left, this.speed * dt);
    if (left < 0.2) this.speed = 0;
    this.distance += step;
    this.car.roll(step);
    this.light(this.progress);
    this.place(this.distance);
    this.seaTime.value = this.time;
    this.animateShore();
    this.animateBirds();
    this.life.update(dt, this.time);
    this.traffic.update(dt, this.distance);
    this.blend = Math.min(1, this.blend + dt / this.blendSeconds);
    this.camera.aspect = aspect;
    this.aim();
  }

  dispose(): void {
    this.dogSeat.clear();
    this.driverSeat.clear();
    this.car.dispose();
    this.life.dispose();
    this.traffic.dispose();
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
    const hover = this.car.hover;
    const altitude = hover ? hoverAltitude(this.hoverTime, hover) : 0;
    car.position.y += altitude;
    // Nose along the way (smoothly: the heading comes from either side of here), pitched with the slope.
    tmpA.copy(tmpPos).add(tmpDir); tmpA.y += altitude;
    car.lookAt(tmpA);
    // The sun's shadow box follows the car (the low sun, out over the sea).
    this.sun.position.copy(tmpPos).addScaledVector(this.sunset.dir, 150);
    this.sun.target.position.copy(tmpPos);
    this.sun.target.updateMatrixWorld();
  }

  /** The shot as it is now (car space), mid-glide or not. */
  private currentShot(pos: Vector3, look: Vector3): number {
    const shot = this.view === 'cabin' ? this.car.cabinView ?? SHOTS.cabin : SHOTS[this.view];
    pos.set(shot.pos[0], shot.pos[1], shot.pos[2]);
    look.set(shot.look[0], shot.look[1], shot.look[2]);
    // Keep the window close-ups on the passenger, not the taller SUV's empty roofline.
    if (this.view === 'face' || this.view === 'alongside') {
      const dy = this.car.window.y - 1.22;
      const dz = this.car.seats.passenger.z - 0.42;
      pos.y += dy; look.y += dy;
      pos.z += dz; look.z += dz;
    }
    // A portrait phone still needs enough horizontal room for the face as he turns toward the scenery.
    let fov = this.view === 'face' ? fitVerticalFov(shot.fov, 40, this.camera.aspect, 95) : shot.fov;
    // Inside on a portrait phone: wide enough for the dash from the yoke to the voice box.
    if (this.view === 'cabin') fov = fitVerticalFov(shot.fov, 64, this.camera.aspect, 105);
    // Alongside on a narrow (portrait) screen: he'd be out of the picture, off to its side. Turn toward his window,
    // keeping the road ahead in it, and widen a little. Unchanged from about 4:3 up.
    if (this.view === 'alongside' && this.camera.aspect < 1.3) {
      const turn = Math.min(1, (1.3 - this.camera.aspect) / 0.8) * 0.75;
      look.lerp(tmpLook.copy(this.car.window), turn);
      fov = fitVerticalFov(shot.fov, 40, this.camera.aspect, 75);
    }
    if (this.blend < 1) {
      const k = this.blend * this.blend * (3 - 2 * this.blend);
      pos.lerpVectors(this.from.pos, pos, k); look.lerpVectors(this.from.look, look, k);
      fov = this.from.fov + (fov - this.from.fov) * k;
    }
    const hover = this.car.hover;
    // The takeoff shot, on its own clock (after any cockpit scene).
    if (hover && !this.revealSkipped && this.hoverTime >= 0 && this.hoverTime < hover.revealSeconds + hover.revealBlend) {
      const k = smooth(hover.revealSeconds, hover.revealSeconds + hover.revealBlend, this.hoverTime);
      pos.lerpVectors(tmpPos.set(...hover.camera.pos), pos, k);
      look.lerpVectors(tmpDir.set(...hover.camera.look), look, k);
      const revealFov = fitVerticalFov(hover.camera.fov, 68, this.camera.aspect, 115);
      fov = revealFov + (fov - revealFov) * k;
    }
    // The cockpit scene, and (when it ends by itself) its glide out into the road's view.
    const intro = this.car.intro;
    if (intro && !this.introCut && !(hover && this.hoverTime >= 0) && this.time < this.introEnd + intro.blend) {
      const introFov = this.introShot(Math.min(this.time, this.introEnd), tmpPos, tmpDir);
      const k = intro.blend > 0 ? smooth(this.introEnd, this.introEnd + intro.blend, this.time) : 0;
      pos.lerpVectors(tmpPos, pos, k);
      look.lerpVectors(tmpDir, look, k);
      fov = introFov + (fov - introFov) * k;
    }
    return fov;
  }

  /** The cockpit scene's camera `t` s in: gliding from one of the car's shots to the next. */
  private introShot(t: number, pos: Vector3, look: Vector3): number {
    const shots = this.car.intro!.shots;
    let i = 0;
    while (i < shots.length - 1 && t >= shots[i + 1]!.at) i++;
    const a = shots[i]!, b = shots[Math.min(i + 1, shots.length - 1)]!;
    const k = b === a ? 0 : smooth(a.at, b.at, t);
    pos.set(...a.pos).lerp(tmpLook.set(...b.pos), k);
    look.set(...a.look).lerp(tmpLook.set(...b.look), k);
    // A portrait phone still gets the panel's width.
    return fitVerticalFov(a.fov + (b.fov - a.fov) * k, 52, this.camera.aspect, 100);
  }

  /** Blend the drone's terrain clearance too, so a slow glide doesn't jump ten metres at its start/end. */
  private cameraClearance(): number {
    const target = this.view === 'drone' ? 10 : 0.3;
    const k = this.blend * this.blend * (3 - 2 * this.blend);
    return this.from.clearance + (target - this.from.clearance) * k;
  }

  private aim(): void {
    const car = this.car.object;
    car.updateMatrixWorld();
    const cam = this.camera;
    cam.fov = this.currentShot(tmpA, tmpB);
    car.localToWorld(tmpA);
    car.localToWorld(tmpB);
    // Never under the ground (the drone over the bluffs, a shot on a bank): lifted clear of it.
    const clear = this.groundAt(tmpA.x, tmpA.z) + this.cameraClearance();
    if (tmpA.y < clear) tmpA.y = clear;
    cam.position.copy(tmpA);
    cam.up.copy(UP);
    cam.lookAt(tmpB);
    cam.updateProjectionMatrix();
    // The sun, out at the sky's distance the way it is from wherever the camera is.
    const { disc, glow, dir } = this.sunset;
    disc.position.copy(cam.position).addScaledVector(dir, SUN_DISTANCE);
    disc.lookAt(cam.position);
    glow.position.copy(disc.position);
  }

  private animateShore(): void {
    // The surf line breathes in and out; three lines of white water roll in to the beach and fade on the sand.
    this.surf.material.opacity = 0.6 + 0.25 * Math.sin(this.time * 1.4);
    this.foam.forEach((band, i) => {
      const k = ((this.time * 0.16 + i / 3) % 1 + 1) % 1; // 0 → 1 as it comes in
      band.position.x = -26 * (1 - k);
      band.material.opacity = 0.75 * Math.sin(Math.PI * Math.min(1, k * 1.15));
    });
  }

  private animateBirds(): void {
    // Pelicans gliding down the coast in lines, gulls wheeling over the beach.
    this.birds.forEach((flock, i) => {
      const t = this.time * (0.22 + i * 0.05) + i * 4;
      const z = BEACH.zMin + ((t * 40) % (BEACH.zMax - BEACH.zMin + 300));
      flock.position.set(coastX(z) - 6 + i * 18, 18 + 4 * Math.sin(t * 0.8 + i), z);
      flock.children.forEach((bird, j) => {
        bird.rotation.z = 0.35 * Math.sin(this.time * (i === 2 ? 7 : 2.4) + j);
      });
    });
  }

  // ---- building the world

  /** The sky: a dome round the camera, coloured each moment by `light()` (vertex colours). */
  private dome(): Mesh<BufferGeometry, MeshBasicMaterial> {
    const geometry = this.geometry(new SphereGeometry(2800, 40, 20));
    geometry.setAttribute('color', new Float32BufferAttribute(new Float32Array(geometry.attributes.position!.count * 3), 3));
    const dome = new Mesh(geometry, this.material(new MeshBasicMaterial({ vertexColors: true, side: BackSide, fog: false, depthWrite: false })));
    dome.renderOrder = -2;
    dome.frustumCulled = false;
    // It follows the camera, so there's always sky all round, however far along the road.
    dome.onBeforeRender = (_r, _s, camera) => dome.position.copy(camera.position);
    return dome;
  }

  /** The sun itself, low over the sea, and its glow (out at the sky's distance the way the sun is). */
  private sunDisc(): { disc: Mesh<CircleGeometry, MeshBasicMaterial>; glow: Sprite } {
    const disc = new Mesh(this.geometry(new CircleGeometry(48, 40)), this.material(new MeshBasicMaterial({ color: '#fff1c4', fog: false, depthWrite: false })));
    disc.renderOrder = -1;
    disc.frustumCulled = false;
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    let map: CanvasTexture | null = null;
    const g = canvas?.getContext('2d');
    if (canvas && g) {
      canvas.width = canvas.height = 128;
      const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,0.9)');
      grad.addColorStop(0.25, 'rgba(255,255,255,0.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      map = new CanvasTexture(canvas);
      this.textures.push(map);
    }
    const glow = new Sprite(this.material(new SpriteMaterial({ map, color: '#ffc27a', fog: false, depthWrite: false, transparent: true, blending: AdditiveBlending })));
    glow.scale.setScalar(900);
    glow.renderOrder = -1;
    glow.frustumCulled = false;
    // (They follow the camera: see `aim()`.)
    return { disc, glow };
  }

  /**
   * The light at `k` of the way along (0 → 1): golden hour turning to sunset. The sun sinks from about 9° up over the
   * sea ahead and to the right to the horizon as the drive ends; the light warms and dims, the sky glows round the sun
   * (and darkens overhead), the haze, the clouds and the far headland go with it.
   */
  private light(k: number): void {
    const S = SUNSET;
    k = Math.min(1, Math.max(0, k));
    const e = k * k * (3 - 2 * k) * 0.35 + k * 0.65;
    const elevation = S.elevation[0] + (S.elevation[1] - S.elevation[0]) * e;
    const dir = this.sunset.dir.set(S.toward[0] * Math.cos(elevation), Math.sin(elevation), S.toward[1] * Math.cos(elevation)).normalize();
    const mix = (pair: readonly [string, string], out: Color) => out.set(pair[0]).lerp(tmpColor.set(pair[1]), e);
    mix(S.sunLight, this.sun.color);
    this.sun.intensity = S.sunIntensity[0] + (S.sunIntensity[1] - S.sunIntensity[0]) * e;
    mix(S.skyLight, this.sky.color);
    mix(S.groundLight, this.sky.groundColor);
    this.sky.intensity = S.skyIntensity[0] + (S.skyIntensity[1] - S.skyIntensity[0]) * e;
    const horizon = mix(S.horizon, new Color());
    (this.scene.fog as Fog).color.copy(horizon);
    mix(S.disc, this.sunset.disc.material.color);
    mix(S.glow, this.sunset.glow.material.color);
    mix(S.clouds, this.sunset.clouds.color);
    mix(S.headland, this.sunset.headland.color);
    if (this.sunset.sea) mix(S.sea, this.sunset.sea.color);
    // The sky's colours: only every so often (it changes slowly).
    if (Math.abs(k - this.sunset.shown) < 0.01) return;
    this.sunset.shown = k;
    const zenith = mix(S.zenith, new Color()), glow = mix(S.skyGlow, new Color());
    const pos = this.sunset.dome.geometry.attributes.position!;
    const colors = this.sunset.dome.geometry.attributes.color!;
    const d = new Vector3(), c = new Color();
    for (let i = 0; i < pos.count; i++) {
      d.fromBufferAttribute(pos, i).normalize();
      const up = Math.max(0, d.y);
      c.copy(horizon).lerp(zenith, Math.pow(up, 0.5));
      const toSun = Math.acos(Math.min(1, Math.max(-1, d.dot(dir))));
      c.lerp(glow, Math.exp(-(toSun * toSun) / 0.3) * (1 - up * 0.7));
      if (d.y < 0) c.multiplyScalar(0.85);
      colors.setXYZ(i, c.r, c.g, c.b);
    }
    colors.needsUpdate = true;
  }

  /** A few fair-weather clouds, far off over the sea (lit by the sunset: see `light()`). */
  private clouds(): { group: Group; material: MeshBasicMaterial } {
    const group = new Group();
    const rand = mulberry32(31);
    const material = this.material(new MeshBasicMaterial({ color: '#ffffff', fog: false, transparent: true, opacity: 0.92 }));
    const puff = new SphereGeometry(1, 10, 7);
    for (let i = 0; i < 14; i++) {
      const parts = Array.from({ length: 5 }, (_, k) => puff.clone().scale(1 + rand() * 0.6, 0.55 + rand() * 0.2, 0.9).translate(k * 1.3 - 2.6, rand() * 0.4, (rand() - 0.5) * 0.8));
      const cloud = new Mesh(this.geometry(mergeGeometries(parts)!), material);
      for (const p of parts) p.dispose();
      const a = -Math.PI * 0.95 + rand() * Math.PI * 1.2;
      const r = 1300 + rand() * 900;
      cloud.position.set(-300 + Math.cos(a) * r, 240 + rand() * 260, 400 + Math.sin(a) * r);
      cloud.scale.setScalar(26 + rand() * 30);
      cloud.lookAt(-300, cloud.position.y, 400);
      group.add(cloud);
    }
    puff.dispose();
    return { group, material };
  }

  /** The headland far down the coast (La Jolla), hazy in the distance (its colour by the sunset: see `light()`). */
  private headland(): { mesh: Mesh; material: MeshBasicMaterial } {
    const material = this.material(new MeshBasicMaterial({ color: '#a4b9c6', fog: false }));
    const mesh = new Mesh(this.geometry(new SphereGeometry(1, 28, 10, 0, Math.PI * 2, 0, Math.PI / 2)), material);
    mesh.scale.set(620, 95, 480);
    mesh.position.set(-560, -6, 2500);
    return { mesh, material };
  }

  /** The land: one height field, the road cut in, coloured by what it is. */
  private terrain(): Mesh {
    const origin = this.departure.origin;
    const yaw = this.departure.yaw, cos = Math.cos(yaw), sin = Math.sin(yaw);
    const lot = DEPARTURE_HOME.lot;
    // (West of the shore it's under the sea, which hides it: only a strip of sea floor is needed.)
    const minX = -385, maxX = 100, minZ = -520, maxZ = 1720, step = 5;
    const nx = Math.round((maxX - minX) / step) + 1, nz = Math.round((maxZ - minZ) / step) + 1;
    // The road's middle every 3 m, bucketed by z, to cut it into the land.
    const samples: Vector3[] = [];
    for (let s = 0, L = this.curve.getLength(); s <= L; s += 3) samples.push(this.curve.getPointAt(s / L));
    const buckets = new Map<number, Vector3[]>();
    for (const p of samples) {
      const b = Math.floor(p.z / 20);
      for (const k of [b - 2, b - 1, b, b + 1, b + 2]) {
        const list = buckets.get(k) ?? [];
        list.push(p);
        buckets.set(k, list);
      }
    }
    const h = new Float32Array(nx * nz);
    const nearRoad = new Float32Array(nx * nz);
    for (let j = 0; j < nz; j++) {
      for (let i = 0; i < nx; i++) {
        const x = minX + i * step, z = minZ + j * step;
        let y = landHeight(x, z);
        let best = Infinity, roadY = 0;
        for (const p of buckets.get(Math.floor(z / 20)) ?? []) {
          const d = (p.x - x) ** 2 + (p.z - z) ** 2;
          if (d < best) { best = d; roadY = p.y; }
        }
        best = Math.sqrt(best);
        // Level with the road across it and its shoulders, blending back into the land beyond.
        const k = 1 - smooth(ROAD_HALF + 2.5, ROAD_HALF + 15, best);
        y = y * (1 - k) + (roadY - 0.25) * k;
        // The house lot is level with the driveway instead of being buried by the coast's rolling terrain.
        const dx = x - origin.x, dz = z - origin.z;
        const lx = cos * dx - sin * dz, lz = sin * dx + cos * dz;
        const edge = Math.min(lx - lot.minX, lot.maxX - lx, lz - lot.minZ, lot.maxZ - lz);
        let level = smooth(-lot.blend, 0, edge);
        if (lx > 0 && best < ROAD_HALF + 2.5) level = 0; // preserve the existing downhill road cut
        y += (origin.y + this.departure.heightAt(lx) - 0.16 - y) * level;
        h[j * nx + i] = y;
        nearRoad[j * nx + i] = best;
      }
    }
    this.ground = { minX, minZ, step, nx, nz, h };

    const geometry = this.geometry(new PlaneGeometry(maxX - minX, maxZ - minZ, nx - 1, nz - 1).rotateX(-Math.PI / 2));
    geometry.translate((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
    const pos = geometry.attributes.position!;
    const colors = new Float32Array(pos.count * 3);
    const sand = new Color('#ead9ac'), wetSand = new Color('#cdb581'), stone = new Color('#d7a567'), stoneDark = new Color('#b98550');
    const scrub = new Color('#8f9c5c'), scrubDark = new Color('#6f8148'), lawn = new Color('#7aa94f'), seabed = new Color('#3e8a94');
    const iceplant = new Color('#6f9a3e'), path = new Color('#cbb78f'), marsh = new Color('#86a65a');
    const c = new Color();
    const cell = (x: number, z: number) => {
      const i = Math.min(nx - 1, Math.max(0, Math.round((x - minX) / step)));
      const j = Math.min(nz - 1, Math.max(0, Math.round((z - minZ) / step)));
      return j * nx + i;
    };
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), z = pos.getZ(v);
      const idx = cell(x, z);
      const y = h[idx]!;
      pos.setY(v, y);
      const shore = x - coastX(z);
      const steep = Math.max(Math.abs(h[cell(x + step, z)]! - h[cell(x - step, z)]!), Math.abs(h[cell(x, z + step)]! - h[cell(x, z - step)]!)) / (2 * step);
      const road = nearRoad[idx]!;
      const west = x < roadAt(z).x;
      const l = ((x - LAGOON.x) / LAGOON.rx) ** 2 + ((z - LAGOON.z) / LAGOON.rz) ** 2;
      if (y < -0.25) c.copy(seabed);
      else if (shore < 7) c.copy(wetSand);
      else if (road < ROAD_HALF + 2.5) c.copy(path);
      else if (steep > 0.9) c.copy(stone).lerp(stoneDark, 0.5 + 0.5 * Math.sin(y * 0.8 + x * 0.1));
      else if (west && road < ROAD_HALF + 9 && z > -260 && z < 850) c.copy(iceplant);
      else if (z < -260 && shore > 60) c.copy(lawn);
      else if (y < 3.2 && (west || shore < 70)) c.copy(sand);
      else if (l < 2.6) c.copy(marsh);
      else if (steep > 0.5) c.copy(stone).lerp(scrub, 0.55 + 0.25 * Math.sin(x * 0.11 + z * 0.07));
      else c.copy(scrub).lerp(scrubDark, 0.5 + 0.5 * Math.sin(x * 0.07) * Math.sin(z * 0.05));
      colors.set([c.r, c.g, c.b], v * 3);
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    const mesh = new Mesh(geometry, this.material(new MeshStandardMaterial({ vertexColors: true, roughness: 0.95 })));
    mesh.receiveShadow = true;
    mesh.name = 'land';
    // The lagoon: still water in its basin.
    const lagoon = new Mesh(this.geometry(new CircleGeometry(1, 40).rotateX(-Math.PI / 2)), this.material(new MeshStandardMaterial({ color: '#4c9c9a', roughness: 0.15 })));
    lagoon.scale.set(LAGOON.rx * 1.1, 1, LAGOON.rz * 1.1);
    lagoon.position.set(LAGOON.x, LAGOON.y, LAGOON.z);
    mesh.add(lagoon);
    return mesh;
  }

  /**
   * The sea: turquoise in the shallows, deep blue out to the horizon, with a long swell rolling through it (moved on
   * the GPU: the same sum as `waveHeight`, so nothing to update on the CPU but the time).
   */
  private sea(): Mesh {
    const geometry = this.geometry(new PlaneGeometry(1600, 3600, 80, 180).rotateX(-Math.PI / 2));
    geometry.translate(-1100, 0, 900);
    const pos = geometry.attributes.position!;
    const colors = new Float32Array(pos.count * 3);
    const shallow = new Color('#46b4b6'), mid = new Color('#2b88b8'), deep = new Color('#1d5b94'), c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const out = coastX(pos.getZ(i)) - pos.getX(i);
      c.copy(shallow).lerp(mid, smooth(5, 70, out)).lerp(deep, smooth(120, 600, out));
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geometry.setAttribute('color', new BufferAttribute(colors, 3));
    const material = this.material(new MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.12 }));
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.seaTime;
      shader.vertexShader = `uniform float uTime;\n${shader.vertexShader}`
        .replace(
          '#include <beginnormal_vertex>',
          `float wa = position.x * 0.05 + uTime * 1.1;
          float wb = position.z * 0.07 - uTime * 0.8;
          float wc = (position.x + position.z) * 0.2 + uTime * 2.0;
          float dhx = 0.22 * 0.05 * cos(wa) + 0.06 * 0.2 * cos(wc);
          float dhz = 0.15 * 0.07 * cos(wb) + 0.06 * 0.2 * cos(wc);
          vec3 objectNormal = normalize(vec3(-dhx, 1.0, -dhz));`,
        )
        .replace(
          '#include <begin_vertex>',
          `vec3 transformed = vec3(position);
          transformed.y += 0.22 * sin(wa) + 0.15 * sin(wb) + 0.06 * sin(wc);`,
        );
    };
    const mesh = new Mesh(geometry, material);
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.name = 'ocean';
    return mesh;
  }

  /** White water along the shore: a ribbon `width` wide on the sea side of the waterline. */
  private shoreRibbon(y: number, width: number, opacity: number): Mesh<BufferGeometry, MeshBasicMaterial> {
    const pts: number[] = [];
    for (let z = -520; z <= 1300; z += 5) {
      const x = coastX(z);
      pts.push(x - width, y, z, x + 0.5, y, z);
    }
    const index: number[] = [];
    for (let i = 0; i < pts.length / 6 - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const geometry = this.geometry(new BufferGeometry());
    geometry.setAttribute('position', new Float32BufferAttribute(pts, 3));
    geometry.setIndex(index);
    const mesh = new Mesh(geometry, this.material(new MeshBasicMaterial({ color: '#f6fbff', transparent: true, opacity, side: DoubleSide, depthWrite: false })));
    mesh.name = 'surf';
    return mesh;
  }

  /** The road: asphalt, a double yellow line, bike lanes, white edges; the rail along the beach and over the lagoon. */
  private road(): Group {
    const group = new Group();
    group.name = 'road';
    const curve = this.curve;
    const L = curve.getLength();
    const n = Math.ceil(L / 2);
    const points: Vector3[] = [], rights: Vector3[] = [];
    const tangent = new Vector3();
    for (let i = 0; i <= n; i++) {
      points.push(curve.getPointAt(i / n));
      curve.getTangentAt(i / n, tangent);
      const len = Math.hypot(tangent.x, tangent.z) || 1;
      rights.push(new Vector3(-tangent.z / len, 0, tangent.x / len));
    }
    const ribbon = (offset: number, half: number, y: number, color: string, keep: (z: number) => boolean = () => true) => {
      const verts: number[] = [];
      const index: number[] = [];
      for (let i = 0; i <= n; i++) {
        const p = points[i]!, r = rights[i]!;
        for (const side of [-1, 1]) verts.push(p.x + r.x * (offset + side * half), p.y + y, p.z + r.z * (offset + side * half));
        if (i < n && keep(p.z)) index.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2);
      }
      const geometry = this.geometry(new BufferGeometry());
      geometry.setAttribute('position', new Float32BufferAttribute(verts, 3));
      geometry.setIndex(index);
      geometry.computeVertexNormals();
      const mesh = new Mesh(geometry, this.material(new MeshStandardMaterial({ color, roughness: 0.9, side: DoubleSide })));
      mesh.receiveShadow = true;
      group.add(mesh);
    };
    ribbon(0, ROAD_HALF, 0.02, '#3a3c41');
    for (const off of [0.12, -0.12]) ribbon(off, 0.07, 0.04, '#e9c13c');
    for (const off of [BIKE_LANE, -BIKE_LANE]) ribbon(off, 0.07, 0.04, '#f2f2ee');
    for (const off of [ROAD_HALF - 0.2, -(ROAD_HALF - 0.2)]) ribbon(off, 0.08, 0.04, '#f2f2ee');

    // The rail: wooden posts and a steel beam, on the beach side all along the beach, and both sides over the lagoon.
    const onLagoon = (z: number) => Math.abs(z - LAGOON.z) < LAGOON.rz * 1.15;
    const posts: Matrix4[] = [];
    const q = new Quaternion();
    const beam: number[] = [];
    const beamIndex: number[] = [];
    for (const side of [1, -1]) {
      const along = (z: number) => (side === 1 ? z > BEACH.zMin - 60 && z < BEACH.zMax + 90 : onLagoon(z));
      let prev = -1;
      for (let i = 0; i <= n; i++) {
        const p = points[i]!, r = rights[i]!;
        const ok = along(p.z);
        const x = p.x + r.x * side * (ROAD_HALF + 0.7), z = p.z + r.z * side * (ROAD_HALF + 0.7);
        const base = beam.length / 3;
        beam.push(x, p.y + 0.5, z, x, p.y + 0.78, z);
        if (ok && prev >= 0) beamIndex.push(prev, prev + 1, base, prev + 1, base + 1, base);
        prev = ok ? base : -1;
        if (ok && i % 2 === 0) posts.push(new Matrix4().compose(new Vector3(x, p.y + 0.35, z), q.setFromAxisAngle(UP, Math.atan2(r.x, r.z)), new Vector3(1, 1, 1)));
      }
    }
    const beamGeometry = this.geometry(new BufferGeometry());
    beamGeometry.setAttribute('position', new Float32BufferAttribute(beam, 3));
    beamGeometry.setIndex(beamIndex);
    beamGeometry.computeVertexNormals();
    group.add(new Mesh(beamGeometry, this.material(new MeshStandardMaterial({ color: '#d9dde1', emissive: '#4a4e52', metalness: 0.2, roughness: 0.5, side: DoubleSide }))));
    const postMesh = new InstancedMesh(this.geometry(new BoxGeometry(0.18, 0.95, 0.18)), this.material(new MeshStandardMaterial({ color: '#7a5a3c', roughness: 0.95 })), posts.length);
    posts.forEach((m, i) => postMesh.setMatrixAt(i, m));
    postMesh.castShadow = true;
    group.add(postMesh);
    return group;
  }

  /**
   * The palms (owner: every tree a Southern California palm): tall Mexican fan palms lining the streets and the coast
   * road, Canary Island date palms by the lagoon and at the top, queen palms in the gardens round home. Instanced, in
   * stretches along the road so the ones out of view aren't drawn.
   */
  private palms(): Group {
    const group = new Group();
    group.name = 'palms';
    const rand = mulberry32(7);
    const L = this.curve.getLength();
    const kinds: { kind: PalmKind; height: number; seed: number }[] = [
      { kind: 'fan', height: 14, seed: 3 },
      { kind: 'fan', height: 19, seed: 5 },
      { kind: 'date', height: 7.5, seed: 9 },
      { kind: 'queen', height: 9.5, seed: 13 },
    ];
    const geometries = kinds.map((k) => this.geometry(palmGeometry(k.kind, k.height, k.seed)));
    const material = this.material(new MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: DoubleSide }));
    const stretch = 300;
    const spots = new Map<string, Matrix4[]>();
    const q = new Quaternion();
    const plant = (type: number, x: number, z: number) => {
      if (this.inDepartureLot(x, z)) return;
      const y = this.groundAt(x, z);
      if (y < 0.6 || x < coastX(z) + 6) return;
      const key = `${type}:${Math.floor(z / stretch)}`;
      const list = spots.get(key) ?? [];
      list.push(new Matrix4().compose(new Vector3(x, y - 0.1, z), q.setFromAxisAngle(UP, rand() * Math.PI * 2), new Vector3().setScalar(0.85 + rand() * 0.3)));
      spots.set(key, list);
    };
    const along = (s: number, side: number, off: number) => {
      const u = Math.min(1, Math.max(0, s / L));
      const p = this.curve.getPointAt(u);
      const t = this.curve.getTangentAt(u);
      const len = Math.hypot(t.x, t.z) || 1;
      return { x: p.x + (-t.z / len) * side * off, z: p.z + (t.x / len) * side * off };
    };
    const lagoonAt = (z: number) => Math.abs(z - LAGOON.z) < LAGOON.rz * 1.3;
    for (let s = 8; s < L; s += 14 + rand() * 10) {
      const at0 = along(s, 1, 0);
      const town = at0.z < -230;
      for (const side of [-1, 1]) {
        const off = ROAD_HALF + 3.5 + rand() * 3;
        const at = along(s, side, off);
        if (town) {
          // Home's street: fan palms and queen palms down both sides.
          if (rand() < 0.75) plant(rand() < 0.6 ? (rand() < 0.5 ? 0 : 1) : 3, at.x, at.z);
        } else if (side === -1) {
          // Inland of the coast road: the tall fan palms in a long row (a date palm here and there by the lagoon).
          if (lagoonAt(at.z)) { if (rand() < 0.35) plant(2, at.x + 8, at.z); }
          else if (rand() < 0.8) plant(rand() < 0.5 ? 0 : 1, at.x, at.z);
        }
        // (Nothing on the beach side: the sea's view stays open.)
      }
      // Further inland: clumps on the slopes and in the gardens.
      if (rand() < 0.35) {
        const far = along(s, -1, 25 + rand() * 60);
        plant(town ? 3 : rand() < 0.6 ? 1 : 2, far.x, far.z);
      }
    }
    // At the top: a few date palms round the reserve's entrance.
    for (let i = 0; i < 6; i++) {
      const at = along(L - 40 + i * 6, i % 2 ? 1 : -1, ROAD_HALF + 5 + rand() * 4);
      plant(2, at.x, at.z);
    }
    for (const [key, list] of spots) {
      const type = Number(key.split(':')[0]);
      const mesh = new InstancedMesh(geometries[type]!, material, list.length);
      list.forEach((m, i) => mesh.setMatrixAt(i, m));
      mesh.computeBoundingSphere();
      mesh.castShadow = true;
      group.add(mesh);
    }
    return group;
  }

  /** Coastal scrub and ice plant: low grey-green bushes on the bluffs and the banks. */
  private scrub(): InstancedMesh {
    const rand = mulberry32(17);
    const list: Matrix4[] = [];
    const colors: Color[] = [];
    const shades = ['#7f9157', '#6c7f48', '#97a46a', '#5f7444', '#a3a774'];
    const q = new Quaternion();
    const e = new Euler();
    for (let i = 0; i < 900; i++) {
      const z = -300 + rand() * 1550;
      const road = roadAt(z);
      const x = road.x - 30 + rand() * 230;
      const y = this.groundAt(x, z);
      if (Math.abs(x - road.x) < ROAD_HALF + 5 || y < 2 || x < coastX(z) + 30) continue;
      list.push(new Matrix4().compose(new Vector3(x, y - 0.2, z), q.setFromEuler(e.set(0, rand() * 6, 0)), new Vector3(1.2 + rand() * 2, 0.6 + rand() * 0.8, 1.2 + rand() * 2)));
      colors.push(new Color(shades[Math.floor(rand() * shades.length)]!));
    }
    const mesh = new InstancedMesh(this.geometry(new IcosahedronGeometry(1, 0)), this.material(new MeshStandardMaterial({ roughness: 1, flatShading: true })), list.length);
    list.forEach((m, i) => { mesh.setMatrixAt(i, m); mesh.setColorAt(i, colors[i]!); });
    mesh.computeBoundingSphere();
    return mesh;
  }

  /** Home's neighbourhood: white stucco houses with tiled roofs up the hill. */
  private houses(): Group {
    const group = new Group();
    group.name = 'houses';
    const rand = mulberry32(5);
    const L = this.curve.getLength();
    const walls = ['#f6efe4', '#f3e7d3', '#efe4d6', '#fbf7f0', '#e9dccb'];
    const roofs = ['#b5653f', '#a65a3a', '#c06b45'];
    const tangent = new Vector3();
    for (let s = 10; s < 330; s += 24) {
      const u = s / L;
      const p = this.curve.getPointAt(u);
      // Only up the hill round home, not down by the coast.
      if (p.z > -300 || s < DEPARTURE_HOME.street.extent + 20) continue;
      this.curve.getTangentAt(u, tangent);
      const len = Math.hypot(tangent.x, tangent.z) || 1;
      for (const side of [-1, 1]) {
        if (rand() < 0.15) continue;
        const off = 17 + rand() * 6 + 5;
        const x = p.x + (-tangent.z / len) * side * off, z = p.z + (tangent.x / len) * side * off;
        const house = new Group();
        const w = 10 + rand() * 4, d = 8 + rand() * 3, h = 3.3 + rand() * 1.5;
        const body = new Mesh(this.geometry(new BoxGeometry(w, h, d)), this.material(new MeshStandardMaterial({ color: walls[Math.floor(rand() * walls.length)]!, roughness: 0.9 })));
        body.position.y = h / 2;
        const roof = new Mesh(this.geometry(new BoxGeometry(w + 1, 0.5, d + 1)), this.material(new MeshStandardMaterial({ color: roofs[Math.floor(rand() * roofs.length)]!, roughness: 0.8 })));
        roof.position.y = h + 0.25;
        const ridge = new Mesh(this.geometry(new BoxGeometry(w + 1, 1.2, d * 0.6)), roof.material);
        ridge.position.y = h + 0.8;
        // Windows on the side facing the road.
        const glass = this.material(new MeshStandardMaterial({ color: '#5f7d93', roughness: 0.2, metalness: 0.3 }));
        for (let k = 0; k < 3; k++) {
          const win = new Mesh(this.geometry(new BoxGeometry(1.3, 1.1, 0.1)), glass);
          win.position.set(-w / 2 + (k + 0.7) * (w / 3.2), h * 0.55, side * -(d / 2 + 0.03));
          house.add(win);
        }
        house.add(body, roof, ridge);
        house.position.set(x, this.groundAt(x, z) - 0.2, z);
        house.rotation.y = Math.atan2(tangent.x, tangent.z);
        body.castShadow = roof.castShadow = true;
        group.add(house);
      }
    }
    return group;
  }

  /** The detailed home/driveways own this lot; don't plant generic coast palms through them. */
  private inDepartureLot(x: number, z: number): boolean {
    const dx = x - this.departure.origin.x, dz = z - this.departure.origin.z;
    const cos = Math.cos(this.departure.yaw), sin = Math.sin(this.departure.yaw);
    const lx = cos * dx - sin * dz, lz = sin * dx + cos * dz, lot = DEPARTURE_HOME.lot;
    return lx > lot.minX && lx < lot.maxX && lz > lot.minZ && lz < lot.maxZ;
  }

  /** Signs: the lagoon, the beach, and the reserve at the top (place names only; original signs). */
  private signs(): Group {
    const group = new Group();
    const L = this.curve.getLength();
    const at = (z: number) => {
      // Arc length where the road passes z (it heads steadily south).
      let lo = 0, hi = L;
      for (let i = 0; i < 30; i++) {
        const mid = (lo + hi) / 2;
        if (this.curve.getPointAt(mid / L).z < z) lo = mid;
        else hi = mid;
      }
      return lo;
    };
    group.add(this.sign('LOS PEÑASQUITOS LAGOON', at(LAGOON.z - LAGOON.rz), -1));
    group.add(this.sign('TORREY PINES STATE BEACH', at(BEACH.zMin + 30), 1));
    group.add(this.sign('TORREY PINES STATE NATURAL RESERVE', L - 70, 1));
    return group;
  }

  private sign(text: string, s: number, side: number): Group {
    const group = new Group();
    const L = this.curve.getLength();
    const u = Math.min(1, Math.max(0, s / L));
    const p = this.curve.getPointAt(u);
    const tangent = this.curve.getTangentAt(u);
    const len = Math.hypot(tangent.x, tangent.z) || 1;
    const x = p.x + (-tangent.z / len) * side * (ROAD_HALF + 2.2), z = p.z + (tangent.x / len) * side * (ROAD_HALF + 2.2);
    const board = new Mesh(this.geometry(new BoxGeometry(4.6, 1.2, 0.12)), this.material(new MeshStandardMaterial({ color: '#6b4a2f', roughness: 0.9 })));
    board.position.y = 1.7;
    group.add(board);
    const canvas = typeof document !== 'undefined' ? document.createElement('canvas') : null;
    const g = canvas?.getContext('2d');
    if (canvas && g) {
      canvas.width = 1024;
      canvas.height = 256;
      g.fillStyle = '#6b4a2f';
      g.fillRect(0, 0, 1024, 256);
      g.strokeStyle = '#e8d9b4';
      g.lineWidth = 10;
      g.strokeRect(14, 14, 996, 228);
      g.fillStyle = '#f2e6c8';
      g.font = 'bold 64px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const words = text.split(' ');
      const half = Math.ceil(words.length / 2);
      const lines = text.length > 22 ? [words.slice(0, half).join(' '), words.slice(half).join(' ')] : [text];
      lines.forEach((line, i) => g.fillText(line, 512, 128 + (i - (lines.length - 1) / 2) * 76));
      const texture = new CanvasTexture(canvas);
      this.textures.push(texture);
      // Facing the oncoming car (back up the road).
      const face = new Mesh(this.geometry(new PlaneGeometry(4.5, 1.12)), this.material(new MeshBasicMaterial({ map: texture })));
      face.position.set(0, 1.7, -0.065);
      face.rotation.y = Math.PI;
      group.add(face);
    }
    for (const dx of [-1.7, 1.7]) {
      const post = new Mesh(this.geometry(new BoxGeometry(0.16, 1.7, 0.16)), this.material(new MeshStandardMaterial({ color: '#5a3e27' })));
      post.position.set(dx, 0.85, 0);
      group.add(post);
    }
    group.rotation.y = Math.atan2(tangent.x, tangent.z) - side * 0.35;
    group.position.set(x, this.groundAt(x, z), z);
    return group;
  }

  /** Two lines of pelicans and a few gulls. */
  private flock(): Group {
    const group = new Group();
    const wing = this.geometry(new BoxGeometry(1.6, 0.05, 0.35));
    const pelican = this.material(new MeshStandardMaterial({ color: '#7d7a73' }));
    const gull = this.material(new MeshStandardMaterial({ color: '#f4f4f2' }));
    for (let f = 0; f < 3; f++) {
      const flock = new Group();
      const n = f === 2 ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const bird = new Mesh(wing, f === 2 ? gull : pelican);
        bird.position.set(i * 2.5, 0, -i * 3.2);
        flock.add(bird);
      }
      this.birds.push(flock);
      group.add(flock);
    }
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
