import { ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type BufferGeometry, type Object3D } from 'three';
import type { Vec3Like } from '../physics/CharacterBody';
import { angleDelta, clamp, damp } from '../utils/math';
import { mulberry32 } from '../utils/random';
import { CAGE } from './home/gymAndYard';

/** The bird's behaviour tuning (seconds, metres, radians). */
export const CONURE = {
  /** Seconds sitting still between moves (min, random extra). */
  sit: [1.2, 3.5] as const,
  /** A hop between perches: its duration and how high it arcs. */
  hopTime: 0.42,
  hopHeight: 0.07,
  /** A side-step along the same perch. */
  stepTime: 0.28,
  /** Moke within this distance: the bird turns to watch him. */
  watchDistance: 3.2,
  /** A bark within this distance startles it up to the top perch. */
  startleDistance: 6,
  /** How far it can turn its head toward something (rad). */
  maxHeadYaw: 1.3,
  /** Playing with Moke: how long, one bounce (up and down) and how high, and a chirp this often. */
  playTime: 2.8,
  bounceTime: 0.3,
  bounceHeight: 0.06,
  chirpEvery: 0.55,
  /** Moke must be at least this close to the cage's middle to start a game (m). */
  playReach: 1.6,
  /** "Play with Malibu" shows when his feet are this close to the cage's front (m). */
  frontReach: 0.85,
} as const;

/** Where the bird can stand, in the cage's own space (front +z): along the perches, the swing, the floor. */
interface Perch {
  y: number;
  z: number;
  x0: number;
  x1: number;
}
const PERCHES: readonly Perch[] = [
  ...CAGE.perches,
  CAGE.swing,
  { y: CAGE.floorY + 0.004, z: 0.02, x0: -0.3, x1: 0.3 },
];
/** The lowest perch: closest to Moke on his hind legs, where it plays with him. */
const PLAY = CAGE.perches.reduce((best, p) => (p.y < best.y ? p : best), CAGE.perches[0]);
/** The top perch: where it flees to when startled. */
const TOP = CAGE.perches.reduce((best, p) => (p.y > best.y ? p : best), CAGE.perches[0]);

type Mode = 'sit' | 'hop' | 'step';

const COLORS = {
  green: '#4f9a3c',
  cheek: '#7ab84a',
  cap: '#6e6052',
  chest: '#8f9c7c',
  belly: '#8e2a2c',
  flight: '#3d6eb2',
  tail: '#7a2330',
  beak: '#3a3437',
  eyeRing: '#f4f1ea',
  eye: '#140f0e',
  feet: '#8d8783',
} as const;

/**
 * Malibu, Moke's friend: the household's green-cheeked conure, in its cage in the gym (built from the owner's photo;
 * original geometry, no files). Presentation and a little life of its own, nothing gameplay depends on: it hops
 * between the perches, the swing and the cage floor, side-steps, bobs and tilts its head, watches Moke when he comes
 * close and flutters up to the top perch when he barks. When Moke stands up to play (`play`), it hops down to the
 * perch nearest him and bounces up and down, flapping and chirping (`onChirp`). It never leaves the cage.
 */
export class ConureView {
  /** Placed and turned like the cage (its front facing into the room). */
  readonly object = new Group();
  private readonly bird = new Group();
  private readonly body = new Group();
  private readonly head = new Group();
  private readonly wings: Group[] = [];
  private readonly tail = new Group();
  private readonly materials = new Map<string, MeshStandardMaterial>();
  private readonly geometries: BufferGeometry[] = [];
  private readonly random: () => number;
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private readonly local = new Vector3();

  private mode: Mode = 'sit';
  private modeTime = 0;
  private sitFor = 1;
  private perch: Perch = PERCHES[0]!;
  private facing = 0;
  private headYaw = 0;
  private headTilt = 0;
  private tiltTarget = 0;
  private flap = 0;
  private time = 0;
  private startled = false;
  private playLeft = 0;
  private chirpIn = 0;
  private bounceTime = 0;
  /** Each chirp while playing (the game plays the sound). */
  onChirp: (() => void) | null = null;

  constructor(at: { x: number; z: number }, turn: number, seed = 7) {
    this.random = mulberry32(seed);
    this.object.name = 'Malibu and cage';
    this.object.position.set(at.x, 0, at.z);
    this.object.rotation.y = turn;
    this.bird.name = 'Malibu';
    this.object.add(this.bird);
    this.build();
    this.to.set(0, this.perch.y, this.perch.z);
    this.bird.position.copy(this.to);
    this.sitFor = this.nextSit();
  }

  /** Where the bird is now, in world space (tests, debug). */
  worldPosition(out: Vector3): Vector3 {
    this.object.updateMatrixWorld(true);
    return this.bird.getWorldPosition(out);
  }

  /** In the cage's space (tests). */
  get cagePosition(): Readonly<Vector3> {
    return this.bird.position;
  }

  get state(): Mode {
    return this.mode;
  }

  /** Playing with Moke right now. */
  get playing(): boolean {
    return this.playLeft > 0;
  }

  /** Can Moke, standing here, start a game? Close enough, and it isn't already playing. */
  canPlay(moke: Vec3Like): boolean {
    return !this.playing && Math.hypot(moke.x - this.object.position.x, moke.z - this.object.position.z) <= CONURE.playReach;
  }

  /** Moke stood up at the cage to play: down to the low perch, as near him as it goes, then bouncing and chirping. */
  play(moke: Vec3Like): void {
    this.object.updateMatrixWorld(true);
    this.local.set(moke.x, 0, moke.z);
    this.object.worldToLocal(this.local);
    this.playLeft = CONURE.playTime;
    this.chirpIn = 0.12;
    this.bounceTime = 0;
    this.startled = false;
    this.tiltTarget = 0;
    const p = this.bird.position;
    this.from.copy(p);
    this.to.set(clamp(this.local.x, PLAY.x0 + 0.04, PLAY.x1 - 0.04), PLAY.y, PLAY.z);
    this.perch = PLAY;
    this.enter('hop');
  }

  /** Moke barked nearby: a fright, then up to the top perch. */
  startle(moke: Vec3Like): void {
    this.object.updateMatrixWorld(true);
    if (Math.hypot(moke.x - this.object.position.x, moke.z - this.object.position.z) > CONURE.startleDistance) return;
    this.startled = true;
    this.playLeft = 0;
    this.tiltTarget = 0;
    this.go('hop', { ...TOP, x0: TOP.x0 + 0.05, x1: TOP.x1 - 0.05 });
  }

  /** Each rendered frame (dt 0 while paused). */
  update(dt: number, moke: Vec3Like | null): void {
    if (dt <= 0) return;
    this.time += dt;
    this.modeTime += dt;
    const c = CONURE;
    const p = this.bird.position;

    const wasPlaying = this.playing;
    if (wasPlaying) {
      this.playLeft = Math.max(0, this.playLeft - dt);
      this.chirpIn -= dt;
      if (this.chirpIn <= 0 && this.playLeft > 0) {
        this.chirpIn += c.chirpEvery;
        this.onChirp?.();
      }
    }

    if (this.mode === 'sit') {
      if (this.playing) {
        // Bouncing on the spot: little springy hops, feet back on the perch between them.
        this.bounceTime += dt;
        p.copy(this.to);
        p.y += Math.abs(Math.sin((this.bounceTime / c.bounceTime) * Math.PI)) * c.bounceHeight;
      } else if (wasPlaying) {
        p.copy(this.to);
        this.enter('sit');
      } else if (this.modeTime >= this.sitFor) this.decide();
    } else {
      const duration = this.mode === 'hop' ? c.hopTime * (this.startled ? 0.7 : 1) : c.stepTime;
      const t = Math.min(1, this.modeTime / duration);
      p.lerpVectors(this.from, this.to, t);
      const arc = this.mode === 'hop' ? c.hopHeight + Math.max(0, this.to.y - this.from.y) * 0.4 : 0.012;
      p.y += Math.sin(t * Math.PI) * arc;
      if (t >= 1) {
        p.copy(this.to);
        this.enter('sit');
        this.startled = false;
      }
    }

    // Face along a move; when sitting, face out of the cage, or toward Moke if he's close.
    let lookYaw = 0;
    if (moke) {
      this.local.set(moke.x, 0.3, moke.z);
      this.object.worldToLocal(this.local);
      const d = Math.hypot(this.local.x - p.x, this.local.z - p.z);
      if (d < CONURE.watchDistance || this.playing) lookYaw = Math.atan2(this.local.x - p.x, this.local.z - p.z);
    }
    const moving = this.mode !== 'sit';
    const moveYaw = moving ? Math.atan2(this.to.x - this.from.x, this.to.z - this.from.z || 0.001) : 0;
    const bodyTarget = moving && Math.abs(this.to.x - this.from.x) > 0.01 ? moveYaw : clamp(lookYaw * (this.playing ? 0.8 : 0.4), -1.1, 1.1);
    this.facing += angleDelta(this.facing, bodyTarget) * (1 - Math.exp(-8 * dt));
    this.bird.rotation.y = this.facing;
    const headTarget = clamp(angleDelta(this.facing, lookYaw), -CONURE.maxHeadYaw, CONURE.maxHeadYaw);
    this.headYaw = damp(this.headYaw, lookYaw !== 0 ? headTarget : 0, 6, dt);
    this.headTilt = damp(this.headTilt, this.tiltTarget, 7, dt);
    // A conure's constant little bob, quicker when it's excited.
    const bob = Math.sin(this.time * (this.startled || moke ? 9 : 5)) * 0.004;
    this.head.rotation.set(0.1 + bob * 12, this.headYaw, this.headTilt);
    this.body.position.y = moving ? 0 : bob * 0.5;

    // Wings flap on a hop, twitch now and then otherwise; the tail balances.
    this.flap = damp(this.flap, this.mode === 'hop' ? 1 : this.playing ? 0.7 : 0, 14, dt);
    const beat = this.flap * (0.5 + 0.5 * Math.sin(this.time * 38));
    for (const [i, wing] of this.wings.entries()) {
      const side = i === 0 ? 1 : -1;
      wing.rotation.z = side * (0.05 + beat * 1.25);
      wing.rotation.y = side * beat * 0.35;
    }
    this.tail.rotation.x = 0.35 + (moving ? -0.25 : 0.03 * Math.sin(this.time * 2.3));
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials.values()) m.dispose();
    this.object.removeFromParent();
  }

  // ------------------------------------------------------------------ behaviour

  private decide(): void {
    const r = this.random();
    if (r < 0.2) {
      // A curious head tilt, and sit a while longer.
      this.tiltTarget = this.tiltTarget === 0 ? (this.random() < 0.5 ? -1 : 1) * 0.55 : 0;
      this.enter('sit');
    } else if (r < 0.55) {
      this.tiltTarget = 0;
      this.go('step', this.perch);
    } else {
      this.tiltTarget = 0;
      const others = PERCHES.filter((p) => p !== this.perch);
      this.go('hop', others[Math.floor(this.random() * others.length)]!);
    }
  }

  /** Moves to a random spot on `perch` (a short side-step if it's the same one). */
  private go(mode: 'hop' | 'step', perch: Perch): void {
    const p = this.bird.position;
    this.from.copy(p);
    let x = perch.x0 + (perch.x1 - perch.x0) * this.random();
    if (mode === 'step') x = clamp(p.x + (this.random() < 0.5 ? -1 : 1) * (0.05 + this.random() * 0.08), perch.x0, perch.x1);
    this.to.set(x, perch.y, perch.z);
    this.perch = perch;
    this.enter(mode);
  }

  private enter(mode: Mode): void {
    this.mode = mode;
    this.modeTime = 0;
    if (mode === 'sit') this.sitFor = this.nextSit();
  }

  private nextSit(): number {
    return CONURE.sit[0] + this.random() * CONURE.sit[1];
  }

  // ------------------------------------------------------------------ the bird

  /** About 26 cm long with its tail; its feet at the origin, facing +z, perched upright (leaning a little forward). */
  private build(): void {
    const part = (parent: Object3D, geometry: BufferGeometry, color: string, at: [number, number, number], scale: [number, number, number] = [1, 1, 1]) => {
      this.geometries.push(geometry);
      let material = this.materials.get(color);
      if (!material) {
        material = new MeshStandardMaterial({ color, roughness: color === COLORS.beak || color === COLORS.eye ? 0.35 : 0.85 });
        this.materials.set(color, material);
      }
      const mesh = new Mesh(geometry, material);
      mesh.position.set(...at);
      mesh.scale.set(...scale);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    this.bird.add(this.body);
    this.body.rotation.x = 0.28;
    // Feet gripping the perch.
    for (const side of [-1, 1]) part(this.body, new SphereGeometry(0.009, 8, 6), COLORS.feet, [side * 0.013, 0.004, 0.004], [1, 0.6, 1.6]);
    // Body: green, a grey-green scalloped chest, the maroon belly patch.
    part(this.body, new SphereGeometry(0.03, 16, 12), COLORS.green, [0, 0.05, 0], [1, 1.55, 1.05]);
    part(this.body, new SphereGeometry(0.024, 14, 10), COLORS.chest, [0, 0.074, 0.013], [1.05, 1, 0.8]);
    part(this.body, new SphereGeometry(0.02, 14, 10), COLORS.belly, [0, 0.038, 0.019], [1.1, 1.2, 0.6]);
    // Wings, folded along the sides, blue flight feathers at their tips; each pivots at the shoulder.
    for (const side of [1, -1]) {
      const wing = new Group();
      wing.position.set(side * 0.026, 0.08, -0.004);
      this.body.add(wing);
      part(wing, new SphereGeometry(0.02, 12, 8), COLORS.green, [side * 0.003, -0.026, -0.006], [0.45, 1.6, 0.95]);
      part(wing, new SphereGeometry(0.012, 10, 8), COLORS.flight, [side * 0.002, -0.056, -0.014], [0.45, 1.5, 0.8]);
      this.wings.push(wing);
    }
    // The long maroon tail, pointing down and back.
    this.tail.position.set(0, 0.022, -0.018);
    this.body.add(this.tail);
    part(this.tail, new ConeGeometry(0.014, 0.13, 8), COLORS.tail, [0, -0.06, 0], [1, 1, 0.45]).rotation.x = Math.PI;
    part(this.tail, new ConeGeometry(0.009, 0.05, 8), COLORS.green, [0, -0.012, 0.002], [1, 1, 0.5]).rotation.x = Math.PI;
    // Head: green cheeks, a grey-brown cap over the crown and nape, white eye rings, a dark hooked beak.
    this.head.position.set(0, 0.1, 0.004);
    this.body.add(this.head);
    part(this.head, new SphereGeometry(0.023, 16, 12), COLORS.cheek, [0, 0.012, 0.004]);
    part(this.head, new SphereGeometry(0.0235, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), COLORS.cap, [0, 0.014, -0.002], [1.02, 1.05, 1.08]);
    for (const side of [1, -1]) {
      part(this.head, new SphereGeometry(0.0062, 10, 8), COLORS.eyeRing, [side * 0.017, 0.016, 0.012], [0.5, 1, 1]);
      part(this.head, new SphereGeometry(0.0036, 8, 6), COLORS.eye, [side * 0.0198, 0.016, 0.0125], [0.5, 1, 1]);
    }
    part(this.head, new SphereGeometry(0.0085, 10, 8), COLORS.beak, [0, 0.008, 0.024], [0.8, 1, 0.9]);
    part(this.head, new ConeGeometry(0.0065, 0.017, 8), COLORS.beak, [0, 0.0, 0.028], [0.8, 1, 0.8]).rotation.x = Math.PI - 0.5;
    // A pale cere just above the beak.
    part(this.head, new CylinderGeometry(0.005, 0.005, 0.003, 8), COLORS.eyeRing, [0, 0.0155, 0.026], [1, 1, 0.6]).rotation.x = Math.PI / 2 - 0.4;
  }
}
