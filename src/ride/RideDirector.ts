import { PerspectiveCamera, Quaternion, Vector3, type Object3D, type Scene, type WebGLRenderer } from 'three';
import { RIDE } from '../config/ride';
import { createVisualState, HumanAnimationController } from '../human/HumanAnimationController';
import type { HumanVisual } from '../human/StylizedHumanVisual';
import { MokeAnimationController } from '../player/MokeAnimationController';
import type { MokeVisual } from '../player/MokeVisual';
import { FamilyCar } from '../world/FamilyCar';
import type { GarageView } from '../world/GarageView';
import { GARAGE } from '../world/home/layout';
import type { CoastDrive } from './CoastDrive';

type V2 = readonly [number, number];
type Phase = 'off' | 'out' | 'loading' | 'drive' | 'home';

/** Positions in the house and the Garage (x, z), and the shots (camera, look-at). */
const SPOTS = {
  humanAtDoor: [2.45, 2.45] as V2,
  dogAtDoor: [2.05, 2.35] as V2,
  /** Through the door, down the passenger side to the front of its open door. */
  humanToCar: [[2.45, 2.45], [2.45, 3.45], [3.0, 4.3], [3.0, 5.15]] as V2[],
  dogToCar: [[2.05, 2.35], [2.45, 3.3], [2.95, 4.4], [2.95, 5.85]] as V2[],
  /** Round the front of the car to the driver's door. */
  humanRound: [[3.0, 5.15], [3.0, 4.0], [1.42, 3.6], [0.15, 4.0], [0.15, 5.3]] as V2[],
  shots: {
    livingRoom: { cam: [1.0, 1.55, 0.9], look: [2.5, 1.0, 3.2] },
    passengerSide: { cam: [3.2, 1.75, 3.55], look: [2.2, 0.7, 5.9] },
    front: { cam: [-0.55, 1.65, 3.4], look: [1.6, 0.9, 7.0] },
  },
} as const;

/** The car backs out to here before the drive, and drives in from here after it (z). */
const OUTSIDE_Z = GARAGE.zMax + 4.5;

export interface RideCast {
  /** The dog's visual (it's posed by the ride while it runs; costume, harness and all). */
  readonly dog: MokeVisual;
  readonly human: HumanVisual;
  /** The house's scene: where the two of them go back to. */
  readonly scene: Scene;
  readonly garage: GarageView;
}

export interface RideHooks {
  /** The drive itself, loaded only now (its own chunk). */
  loadDrive(): Promise<typeof import('./CoastDrive')>;
  /** The ride's song on or off. */
  music(on: boolean): void;
  /** Black over everything (0..1). */
  fade(alpha: number): void;
  /** The human says something. */
  say(text: string): void;
  /** Off for the drive / back on the leash (null: the leash to their hand is off). */
  leash(hand: Object3D | null): void;
  /** Took the harness off at the end. */
  harnessOff(): void;
  /** All over: they're back in the living room at these spots (the game puts their bodies there and carries on). */
  done(dogAt: V2, dogHeading: number, humanAt: V2, humanHeading: number): void;
}

/**
 * Going for a ride (Phase 6, D33), from the Garage door on: the cinematic out to the car (the door opens on the car
 * waiting, it raises its falcon-wing doors to greet them, he trots down its side and hops in, the human walks round and gets in, the roll-up door goes up and they
 * back out), the drive along the coast (`CoastDrive`, loaded now), and the cinematic home again (in, out, back through
 * the door, harness off). While it runs the house stands still; the game hands its two visuals over and takes them
 * back at the end. Input is just the ride's own: bark, head in or out, change the view, head home.
 */
export class RideDirector {
  readonly camera = new PerspectiveCamera(55, 16 / 9, 0.05, 400);
  private phase: Phase = 'off';
  private time = 0;
  private drive: CoastDrive | null = null;
  private readonly dogAnim = new MokeAnimationController();
  private readonly humanAnim = new HumanAnimationController();
  private readonly humanPose = createVisualState();
  private headOut = true;
  private autoViewIn = 15;
  private autoBarkIn = 20;
  private said = new Set<string>();
  private readonly lastDog = new Vector3();
  private readonly lastHuman = new Vector3();
  private readonly tmp = new Vector3();
  /** Where he's turning his head on the road (radians: + to his left, + up), where it's got to, and since when. */
  private readonly lookAim = { yaw: 0, pitch: 0 };
  private readonly lookNow = { yaw: 0, pitch: 0 };
  private sinceLook = 99;
  private autoLookIn = 3;
  private readonly eye = new Vector3();
  private readonly eyeLook = new Vector3();
  private readonly eyeTurn = new Quaternion();

  constructor(private readonly cast: RideCast, private readonly hooks: RideHooks) {}

  get active(): boolean {
    return this.phase !== 'off';
  }

  /** Out on the road (the pause screen offers "Head home"). */
  get driving(): boolean {
    return this.phase === 'drive';
  }

  /** At the Garage door: off we go. */
  start(): void {
    if (this.active) return;
    this.phase = 'out';
    this.time = 0;
    this.said.clear();
    this.headOut = true;
    this.lookAim.yaw = this.lookAim.pitch = this.lookNow.yaw = this.lookNow.pitch = 0;
    this.sinceLook = 99;
    const g = this.cast.garage;
    g.setHouseDoor(0);
    g.setRollUp(0);
    g.car.setPassengerDoor(0);
    g.car.setPassengerWindow(0);
    g.car.setFalconDoors(0);
    this.place(this.cast.dog.object, SPOTS.dogAtDoor, 0);
    this.place(this.cast.human.object, SPOTS.humanAtDoor, 0);
    this.lastDog.copy(this.cast.dog.object.position);
    this.lastHuman.copy(this.cast.human.object.position);
    this.cast.human.setSeeThrough(false);
    this.hooks.music(true);
  }

  /** Bark (the dog's bark sound is the game's; this is his body). */
  bark(): void {
    this.dogAnim.bark();
  }

  /** Head in or out of the window (on the road). */
  toggleHead(): void {
    if (this.phase === 'drive') this.headOut = !this.headOut;
  }

  nextView(): void {
    this.drive?.nextView();
  }

  /**
   * Look around (on the road): turns his head, by these angles (radians: `yaw` + to his left, `pitch` + up), within
   * what a dog can turn. His own view (the "his view" shot) follows his head.
   */
  look(yaw: number, pitch: number): void {
    if (this.phase !== 'drive' || (yaw === 0 && pitch === 0)) return;
    const L = RIDE.look;
    this.lookAim.yaw = Math.min(L.yaw[1], Math.max(L.yaw[0], this.lookAim.yaw + yaw));
    this.lookAim.pitch = Math.min(L.pitch[1], Math.max(L.pitch[0], this.lookAim.pitch + pitch));
    this.sinceLook = 0;
  }

  /** "Head home" from the pause screen: on to the last stretch. */
  headHome(): void {
    this.drive?.skipHome();
  }

  /**
   * Each rendered frame while it's active (dt 0 when paused). `auto`: FSD's playing, so the ride changes the view and
   * barks now and then by itself.
   */
  update(dt: number, aspect: number, auto: boolean): void {
    if (!this.active) return;
    this.time += dt;
    // Solid all the way: the game fades the human while they're between its camera and the dog, and the ride can
    // begin in the middle of a frame that has just faded them (the game's fading doesn't run again until it's over).
    this.cast.human.setSeeThrough(false);
    if (this.phase === 'out') this.updateOut(dt);
    else if (this.phase === 'drive') this.updateDrive(dt, aspect, auto);
    else if (this.phase === 'home') this.updateHome(dt);
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  render(renderer: WebGLRenderer): void {
    if (this.phase === 'drive' && this.drive) renderer.render(this.drive.scene, this.drive.camera);
    else renderer.render(this.cast.scene, this.camera);
  }

  dispose(): void {
    this.drive?.dispose();
    this.drive = null;
  }

  // ---- out to the car

  private updateOut(dt: number): void {
    const t = this.time;
    const g = this.cast.garage;
    const car = g.car;
    // The living room: they open the door onto the Garage.
    if (t < 2.6) {
      this.shot(SPOTS.shots.livingRoom);
      g.setHouseDoor(smoothRange(1.0, 2.1, t));
      this.poseHuman(dt, SPOTS.humanAtDoor, 0, { pose: t < 2 ? 'place' : 'idle', reach: t < 1.6 ? [0.0, 1.0, 0.45] : null });
      this.poseDog(dt, SPOTS.dogAtDoor, 0.3, { wag: 1 });
      this.hooks.leash(this.cast.human.hands.left);
      if (t > 0.3) this.sayOnce('Come on, Moke! The car’s in here.');
      return;
    }
    // The Garage: the car greets them, raising its falcon-wing doors; down the passenger side, the front door opens,
    // he hops in.
    if (t < 9) {
      this.shot(SPOTS.shots.passengerSide);
      car.setFalconDoors(smoothRange(3.0, 4.6, t));
      const h = along(SPOTS.humanToCar, (t - 2.6) / 3);
      const d = along(SPOTS.dogToCar, (t - 2.8) / 3.2);
      car.setPassengerDoor(smoothRange(5.6, 6.4, t) - smoothRange(7.6, 8.3, t));
      this.poseHuman(dt, h.at, h.heading, { pose: t > 5.6 && t < 6.6 ? 'place' : 'idle', reach: t > 5.6 && t < 6.6 ? [-0.2, 0.95, 0.5] : null });
      if (t < 6.6) {
        this.poseDog(dt, d.at, d.heading, { wag: 1 });
      } else {
        // The hop: from beside the car up onto the passenger seat, turning to face forward.
        this.hooks.leash(null);
        const k = smoothRange(6.6, 7.3, t);
        const seat = car.object.localToWorld(this.tmp.copy(FamilyCar.SEATS.passenger));
        const from = SPOTS.dogToCar[SPOTS.dogToCar.length - 1]!;
        const x = from[0] + (seat.x - from[0]) * k;
        const z = from[1] + (seat.z - from[1]) * k;
        const y = seat.y * k + Math.sin(Math.PI * k) * 0.45;
        this.poseDog(dt, [x, z], lerpAngle(-Math.PI / 2, Math.PI, k), { y, air: k > 0 && k < 1, wag: 1, sit: t > 7.4 ? 1 : 0 });
      }
      return;
    }
    // The front: the falcon doors come down, round the car to the driver's side and in; the roll-up door goes up;
    // backing out.
    this.shot(SPOTS.shots.front);
    car.setFalconDoors(1 - smoothRange(9.4, 10.8, t));
    const seat = car.object.localToWorld(this.tmp.copy(FamilyCar.SEATS.passenger));
    this.poseDog(dt, [seat.x, seat.z], Math.PI, { y: seat.y, sit: 1, wag: 0.8 });
    if (t < 12) {
      const h = along(SPOTS.humanRound, (t - 9) / 2.8);
      this.poseHuman(dt, h.at, h.heading, {});
    } else {
      this.sitAtWheel(dt, car.object);
    }
    g.setRollUp(smoothRange(12, 13.5, t));
    const back = smoothRange(13.4, 17, t);
    this.moveCar(GARAGE.car.z + (OUTSIDE_Z - GARAGE.car.z) * back);
    this.hooks.fade(smoothRange(15.8, 17, t));
    if (t >= 17.2) void this.beginDrive();
  }

  // ---- the drive

  private async beginDrive(): Promise<void> {
    this.phase = 'loading';
    const { CoastDrive } = await this.hooks.loadDrive();
    const drive = (this.drive = new CoastDrive());
    // Into the car: the dog in his seat, the human at the wheel.
    drive.dogSeat.add(this.cast.dog.object);
    this.sitAtWheel(0, drive.driverSeat, true);
    this.phase = 'drive';
    this.time = 0;
    this.sayOnce('Windows down! Here we go, Moke!');
  }

  private updateDrive(dt: number, aspect: number, auto: boolean): void {
    const drive = this.drive!;
    // Fading in from the Garage, and out again at the end.
    const left = drive.length * (1 - drive.progress);
    this.hooks.fade(Math.max(1 - this.time / 1.2, smoothRange(40, 8, left)));
    if (auto && dt > 0) {
      this.autoViewIn -= dt;
      this.autoBarkIn -= dt;
      if (this.autoViewIn <= 0) { drive.nextView(); this.autoViewIn = 12 + Math.random() * 8; }
      if (this.autoBarkIn <= 0) { this.dogAnim.bark(); this.autoBarkIn = 18 + Math.random() * 15; }
    }
    // Looking around: where the player turns his head; left alone (or with FSD playing), he takes in the beach and
    // the sea by himself, a new look every few seconds.
    this.sinceLook += dt;
    this.autoLookIn -= dt;
    if (this.sinceLook > RIDE.look.idle && this.autoLookIn <= 0) {
      const L = RIDE.look.wander;
      this.lookAim.yaw = L.yaw[0] + Math.random() * (L.yaw[1] - L.yaw[0]);
      this.lookAim.pitch = L.pitch[0] + Math.random() * (L.pitch[1] - L.pitch[0]);
      this.autoLookIn = L.every[0] + Math.random() * (L.every[1] - L.every[0]);
    }
    const ease = 1 - Math.exp(-RIDE.look.ease * dt);
    this.lookNow.yaw += (this.lookAim.yaw - this.lookNow.yaw) * ease;
    this.lookNow.pitch += (this.lookAim.pitch - this.lookNow.pitch) * ease;
    drive.update(dt, aspect);
    drive.car.setPassengerWindow(1);
    // The dog: head out in the wind (standing up on the seat), or sitting back.
    const pose = this.headOut ? RIDE.dogInCar.headOut : RIDE.dogInCar.headIn;
    const dog = this.cast.dog.object;
    dog.position.set(pose.x, pose.y, pose.z);
    dog.rotation.set(0, pose.heading, 0);
    const s = this.dogAnim.update(dt, { speed: 0, turnRate: 0, headroom: 2 });
    s.sit = this.headOut ? 0 : 1;
    s.rest = 0;
    s.crouch = 0;
    s.tailWag = Math.max(s.tailWag, 0.9);
    s.wind = this.headOut ? 1 : 0.15;
    s.headYaw = this.lookNow.yaw;
    s.headPitch = (this.headOut ? 0.12 : 0) + this.lookNow.pitch;
    s.attention = 1;
    this.cast.dog.update(dt, s);
    this.seeThroughHisEyes(drive);
    this.sitAtWheel(dt, drive.driverSeat, true);
    if (drive.done && dt >= 0) this.endDrive();
  }

  /** His view: from just in front of his eyes, the way his head points (the drive's "his view" shot). */
  private seeThroughHisEyes(drive: CoastDrive): void {
    const head = this.cast.dog.attachments.head;
    if (!head) return;
    this.cast.dog.object.updateMatrixWorld(true);
    head.getWorldPosition(this.eye);
    head.getWorldQuaternion(this.eyeTurn);
    const ahead = this.tmp.set(0, 0, 1).applyQuaternion(this.eyeTurn);
    const [down, forward] = RIDE.look.eyes;
    this.eye.addScaledVector(ahead, forward).add(new Vector3(0, -down, 0).applyQuaternion(this.eyeTurn));
    this.eyeLook.copy(this.eye).addScaledVector(ahead, 10);
    const car = drive.car.object;
    drive.setEyes(car.worldToLocal(this.eye), car.worldToLocal(this.eyeLook));
  }

  private endDrive(): void {
    const drive = this.drive!;
    // Back into the house's scene, the car outside the Garage's open roll-up door, everything ready to drive in.
    drive.dogSeat.remove(this.cast.dog.object);
    drive.driverSeat.remove(this.cast.human.object);
    this.cast.scene.add(this.cast.dog.object);
    drive.dispose();
    this.drive = null;
    const g = this.cast.garage;
    this.sitAtWheel(0, g.car.object);
    g.setRollUp(1);
    g.car.setPassengerWindow(0);
    this.moveCar(OUTSIDE_Z);
    this.phase = 'home';
    this.time = 0;
    this.said.clear();
  }

  // ---- home again

  private updateHome(dt: number): void {
    const t = this.time;
    const g = this.cast.garage;
    const car = g.car;
    this.hooks.fade(1 - smoothRange(0.2, 1.2, t));
    if (t < 7) {
      this.shot(SPOTS.shots.front);
      this.moveCar(OUTSIDE_Z + (GARAGE.car.z - OUTSIDE_Z) * smoothRange(0.4, 4, t));
      g.setRollUp(1 - smoothRange(4.2, 5.6, t));
      const seat = car.object.localToWorld(this.tmp.copy(FamilyCar.SEATS.passenger));
      this.poseDog(dt, [seat.x, seat.z], Math.PI, { y: seat.y, sit: 1, wag: 1 });
      if (t > 4.6) {
        this.cast.human.object.visible = true;
        const back = [...SPOTS.humanRound].reverse();
        const h = along(back, (t - 4.6) / 2.4);
        this.poseHuman(dt, h.at, h.heading, {});
      } else this.sitAtWheel(dt, car.object);
      return;
    }
    if (t < 13) {
      this.shot(SPOTS.shots.passengerSide);
      // Parked: up go the falcon doors, and down again as they head in.
      car.setFalconDoors(smoothRange(7.0, 8.3, t) - smoothRange(11.4, 12.8, t));
      car.setPassengerDoor(smoothRange(7.2, 7.9, t) - smoothRange(9.2, 9.9, t));
      const human = SPOTS.humanToCar[SPOTS.humanToCar.length - 1]!;
      if (t < 10) this.poseHuman(dt, human, Math.PI * 0.75, { pose: t > 7.2 && t < 8 ? 'place' : 'idle', reach: t > 7.2 && t < 8 ? [-0.2, 0.95, 0.5] : null });
      else {
        const h = along([...SPOTS.humanToCar].reverse(), (t - 10) / 3);
        this.poseHuman(dt, h.at, h.heading, {});
      }
      const seat = car.object.localToWorld(this.tmp.copy(FamilyCar.SEATS.passenger));
      const spot = SPOTS.dogToCar[SPOTS.dogToCar.length - 1]!;
      if (t < 8.2) this.poseDog(dt, [seat.x, seat.z], Math.PI, { y: seat.y, sit: 1, wag: 1 });
      else if (t < 8.9) {
        // The hop down.
        const k = smoothRange(8.2, 8.9, t);
        this.poseDog(dt, [seat.x + (spot[0] - seat.x) * k, seat.z + (spot[1] - seat.z) * k], lerpAngle(Math.PI, Math.PI / 2, k), { y: seat.y * (1 - k) + Math.sin(Math.PI * k) * 0.35, air: true, wag: 1 });
      } else {
        this.hooks.leash(this.cast.human.hands.left);
        const d = along([...SPOTS.dogToCar].reverse(), (t - 9.6) / 3.2);
        this.poseDog(dt, d.at, d.heading, { wag: 1 });
      }
      return;
    }
    // Back in the living room: the door shuts behind them, harness off, and that's the ride.
    this.shot(SPOTS.shots.livingRoom);
    g.setHouseDoor(1 - smoothRange(13.4, 14.4, t));
    const kneel = t > 14.6 && t < 16.4;
    this.poseHuman(dt, SPOTS.humanAtDoor, Math.PI * 1.15, { crouch: kneel ? 1 : 0, pose: kneel ? 'offer' : 'idle', reach: kneel ? [-0.25, 0.3, 0.45] : null });
    this.poseDog(dt, SPOTS.dogAtDoor, Math.PI * 0.55, { wag: 1, sit: t > 14.4 ? 1 : 0 });
    if (t > 14.8) this.sayOnce('Best ride ever, Moke!');
    if (t > 15.8 && !this.said.has('off')) {
      this.said.add('off');
      this.hooks.harnessOff();
    }
    if (t > 16.8) this.finish();
  }

  private finish(): void {
    this.phase = 'off';
    this.cast.human.object.visible = true;
    this.hooks.fade(0);
    this.hooks.music(false);
    this.cast.garage.setHouseDoor(0);
    this.cast.garage.car.setFalconDoors(0);
    this.moveCar(GARAGE.car.z);
    this.hooks.done(SPOTS.dogAtDoor, Math.PI * 0.55, SPOTS.humanAtDoor, Math.PI * 1.15);
  }

  // ---- helpers

  private shot(s: { cam: readonly number[]; look: readonly number[] }): void {
    this.camera.position.set(s.cam[0]!, s.cam[1]!, s.cam[2]!);
    this.camera.lookAt(s.look[0]!, s.look[1]!, s.look[2]!);
    this.camera.fov = 58;
  }

  private moveCar(z: number): void {
    const car = this.cast.garage.car;
    const before = car.object.position.z;
    car.object.position.z = z;
    // Nose-in toward the house: backing out (z growing) rolls the wheels backwards.
    car.roll(-(z - before));
  }

  private place(object: Object3D, at: V2, heading: number, y = 0): void {
    object.position.set(at[0], y, at[1]);
    object.rotation.set(0, heading, 0);
  }

  private poseDog(dt: number, at: V2, heading: number, o: { y?: number; air?: boolean; wag?: number; sit?: number }): void {
    const dog = this.cast.dog.object;
    if (dog.parent !== this.cast.scene) this.cast.scene.add(dog);
    this.place(dog, at, heading, o.y ?? 0);
    const speed = dt > 0 ? Math.hypot(dog.position.x - this.lastDog.x, dog.position.z - this.lastDog.z) / dt : 0;
    this.lastDog.copy(dog.position);
    const s = this.dogAnim.update(dt, { speed: o.air ? 0 : Math.min(speed, 3), turnRate: 0, headroom: 2, airborne: !!o.air });
    s.sit = o.sit ?? 0;
    s.rest = 0;
    s.tailWag = Math.max(s.tailWag, o.wag ?? 0);
    s.wind = 0;
    this.cast.dog.update(dt, s);
  }

  /**
   * The human in the driver's seat, sitting back with their hands on the wheel: `parent` is the car (the Garage's) or
   * the drive's driver seat (`inSeat`: already at the seat).
   */
  private sitAtWheel(dt: number, parent: Object3D, inSeat = false): void {
    const human = this.cast.human.object;
    if (human.parent !== parent) parent.add(human);
    human.visible = true;
    const seat = FamilyCar.SEATS.driver;
    if (inSeat) human.position.set(0, -0.17, -0.08);
    else human.position.set(seat.x, seat.y - 0.17, seat.z - 0.08);
    human.rotation.set(0, 0, 0);
    const p = this.humanPose;
    p.sit = 1;
    p.sitStyle = 'lounge';
    p.seatHeight = 0.17;
    p.speed = 0;
    p.crouch = 0;
    p.pose = 'idle';
    p.reach = null;
    this.cast.human.apply(dt, this.humanAnim.update(dt, p));
  }

  private poseHuman(dt: number, at: V2, heading: number, o: { pose?: import('../human/HumanRig').HumanPose; reach?: readonly number[] | null; crouch?: number }): void {
    const human = this.cast.human.object;
    if (human.parent !== this.cast.scene) this.cast.scene.add(human);
    human.visible = true;
    this.place(human, at, heading);
    const speed = dt > 0 ? Math.hypot(human.position.x - this.lastHuman.x, human.position.z - this.lastHuman.z) / dt : 0;
    this.lastHuman.copy(human.position);
    const p = this.humanPose;
    p.speed = Math.min(speed, 1.6);
    p.pose = o.pose ?? 'idle';
    p.crouch = o.crouch ?? 0;
    p.sit = 0;
    p.sitStyle = 'upright';
    p.seatHeight = 0.45;
    p.reach = o.reach ? { x: o.reach[0]!, y: o.reach[1]!, z: o.reach[2]! } : null;
    this.cast.human.apply(dt, this.humanAnim.update(dt, p));
  }

  private sayOnce(text: string): void {
    if (this.said.has(text)) return;
    this.said.add(text);
    this.hooks.say(text);
  }
}


/** Where along a path (0..1 of the way), and which way he'd be facing. */
function along(path: readonly V2[], f: number): { at: V2; heading: number } {
  const k = Math.min(1, Math.max(0, f));
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const l = Math.hypot(path[i]![0] - path[i - 1]![0], path[i]![1] - path[i - 1]![1]);
    lengths.push(l);
    total += l;
  }
  let d = smoothstep01(k) * total;
  for (let i = 0; i < lengths.length; i++) {
    const a = path[i]!, b = path[i + 1]!;
    if (d <= lengths[i]! || i === lengths.length - 1) {
      const u = lengths[i]! > 0 ? Math.min(1, d / lengths[i]!) : 1;
      return { at: [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u], heading: Math.atan2(b[0] - a[0], b[1] - a[1]) };
    }
    d -= lengths[i]!;
  }
  const last = path[path.length - 1]!;
  return { at: last, heading: 0 };
}

function smoothstep01(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 0 before `a`, 1 after `b`, smooth between (`a` > `b` runs backwards). */
function smoothRange(a: number, b: number, t: number): number {
  return smoothstep01(Math.min(1, Math.max(0, (t - a) / (b - a))));
}

function lerpAngle(a: number, b: number, k: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
