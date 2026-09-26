import { Vector3 } from 'three';
import { HUMAN_ANIMATION } from '../config/humanAnimation';
import { clamp, damp, lerp, smoothstep } from '../utils/math';
import { jointPosition, solveArm, type JointAngles, type Side } from './humanIK';
import {
  FOREARM_TO_PALM,
  HIP_ABOVE_SEAT,
  HIP_HEIGHT,
  HUMAN_JOINTS,
  LEG_LENGTH,
  UPPER_ARM,
  type HumanAnimState,
  type HumanAnimationState,
  type HumanFace,
  type HumanPose,
  type HumanProp,
  type HumanSitStyle,
} from './HumanRig';

/** A point in the character's own space: root at the feet, facing +z, their left +x (m). */
export interface LocalPoint {
  x: number;
  y: number;
  z: number;
}

/** What the animation needs each frame: plain numbers and names from the body and the brain, no meshes. */
export interface HumanVisualState {
  /** Ground speed along their facing (m/s; negative walking backward), as the body actually moved. */
  speed: number;
  /** Sideways speed (m/s, + toward their left). */
  sideSpeed: number;
  /** How fast the body is turning (rad/s, + to their left). */
  turnRate: number;
  /** 0 standing … 1 kneeling. */
  crouch: number;
  pose: HumanPose;
  /** A glance round the room (rad, + = their left), when they're not looking at anything in particular. */
  headYaw: number;
  /** 0 standing … 1 seated, how they sit, and the seat's height (m). */
  sit: number;
  sitStyle: HumanSitStyle;
  seatHeight: number;
  /** Something to look at (character space), and how much (0 ignore … 0.3 a glance … 1 full attention). */
  look: LocalPoint | null;
  lookWeight: number;
  /** Something to reach for with the right hand (petting Moke, holding out a treat), character space. */
  reach: LocalPoint | null;
  /** Saying something right now (mouth moves). */
  talking: boolean;
  /** Held for the activity (book, phone, mug…). */
  prop: HumanProp | null;
  /** The work surface in front of them for kitchen and table actions (m above the floor). */
  surface: number;
}

export function createVisualState(): HumanVisualState {
  return {
    speed: 0,
    sideSpeed: 0,
    turnRate: 0,
    crouch: 0,
    pose: 'idle',
    headYaw: 0,
    sit: 0,
    sitStyle: 'upright',
    seatHeight: 0.45,
    look: null,
    lookWeight: 0,
    reach: null,
    talking: false,
    prop: null,
    surface: 0.92,
  };
}

type Mood = Pick<HumanFace, 'smile' | 'brows' | 'jawOpen' | 'mouthWide' | 'lids'> & { eyesDown: number };
type Hips = { x: number; y: number; z: number };

const zeroAngles = (): JointAngles => Object.fromEntries(HUMAN_JOINTS.map((j) => [j, { x: 0, y: 0, z: 0 }])) as JointAngles;
function copyAngles(from: JointAngles, to: JointAngles): void {
  for (const j of HUMAN_JOINTS) {
    to[j].x = from[j].x;
    to[j].y = from[j].y;
    to[j].z = from[j].z;
  }
}

/** Blend times per action (s): quick reactions, slow settling into lounging. */
const BLEND_TIME: Partial<Record<HumanPose, number>> = {
  surprised: HUMAN_ANIMATION.blend.quick,
  lunge: HUMAN_ANIMATION.blend.quick,
  stumble: HUMAN_ANIMATION.blend.quick,
  windup: HUMAN_ANIMATION.blend.quick,
  throw: 0.12,
  pet: 0.4,
  relax: HUMAN_ANIMATION.blend.slow,
  watch: HUMAN_ANIMATION.blend.slow,
};

/** Actions whose hands are busy (no walking arm swing). */
const HANDS_BUSY = new Set<HumanPose>(['read', 'phone', 'sip', 'cook', 'prep', 'eat', 'fold', 'rummage', 'tidy', 'fridge', 'offer', 'take', 'place']);

const ELBOW_POLE = { L: new Vector3(0.55, -0.55, -0.5), R: new Vector3(-0.55, -0.55, -0.5) };
const OUT_POLE = { L: new Vector3(0.9, -0.2, -0.35), R: new Vector3(-0.9, -0.2, -0.35) };
const UP_POLE = { L: new Vector3(0.9, 0.4, -0.2), R: new Vector3(-0.9, 0.4, -0.2) };

const MOOD_KEYS = ['smile', 'brows', 'jawOpen', 'mouthWide', 'lids', 'eyesDown'] as const;

/**
 * The human's animation, apart from any mesh (as MokeAnimationController is for Moke). One coherent pose each frame,
 * built in layers that never fight: **posture** (standing, walking with speed-matched steps, stepping round a turn,
 * sitting, kneeling) → **action** (the activity's upper body, crossfaded; hands placed by two-bone IK where they must
 * hold or touch something) → **attention** (eyes, then head and neck, then upper body, with human limits and a
 * smoothly changing weight) → a little **life** (breathing, weight shifts, blinks) → gentle per-joint smoothing.
 * Gameplay asks for semantic states (a pose name, speed, sitting, a look target); this decides how they look.
 */
export class HumanAnimationController {
  readonly state: HumanAnimationState = {
    joints: zeroAngles(),
    hipsX: 0,
    hipsY: HIP_HEIGHT,
    hipsZ: 0,
    face: { jawOpen: 0, mouthWide: 0.4, smile: 0.4, lids: 0, brows: 0, eyeYaw: 0, eyePitch: 0 },
    prop: null,
  };
  /** What the body is showing (debug). */
  animState: HumanAnimState = 'IDLE';
  /** Current attention weight on the look target (0..1), and where the gaze points (rad, relative to the body). */
  attention = 0;
  gazeYaw = 0;
  gazePitch = 0;
  /** The action being blended in (debug). */
  action: HumanPose = 'idle';

  private readonly target = zeroAngles();
  private readonly scratch = zeroAngles();
  private readonly posture = zeroAngles();
  private readonly weights = new Map<HumanPose, number>([['idle', 1]]);
  private readonly hips: Hips = { x: 0, y: HIP_HEIGHT, z: 0 };
  private readonly actionHips: Hips = { x: 0, y: HIP_HEIGHT, z: 0 };
  private readonly mood: Mood = { smile: 0.4, brows: 0, jawOpen: 0, mouthWide: 0.4, lids: 0, eyesDown: 0 };
  private readonly moodSum: Mood = { smile: 0.4, brows: 0, jawOpen: 0, mouthWide: 0.4, lids: 0, eyesDown: 0 };
  private time = 0;
  private walkPhase = 0;
  private stepPhase = 0;
  private walkWeight = 0;
  private stepWeight = 0;
  private sitAmount = 0;
  private sitTrend = 0;
  private kneel = 0;
  private blinkIn = 3;
  private blinkLeft = 0;
  private dartIn = 2;
  private dartYaw = 0;
  private shiftIn = 6;
  private shift = 0;
  private shiftTarget = 0;
  private eyeYawWant = 0;
  private eyePitchWant = 0;
  private readonly v = new Vector3();
  private readonly w = new Vector3();

  constructor(private readonly random: () => number = Math.random) {}

  /** How much of the walk cycle is showing (0..1): debug and tests. */
  get walking(): number {
    return this.walkWeight;
  }

  /** The action weights being blended (debug). */
  get blend(): ReadonlyMap<HumanPose, number> {
    return this.weights;
  }

  update(dt: number, s: HumanVisualState): HumanAnimationState {
    this.time += dt;
    this.updateWeights(dt, s.pose);
    this.buildPosture(dt, s);

    // Each action with any weight builds its own full pose over the shared posture; the blend is their weighted mix.
    const t = this.target;
    for (const j of HUMAN_JOINTS) t[j].x = t[j].y = t[j].z = 0;
    let hipsForward = 0;
    let total = 0;
    const m = this.moodSum;
    for (const k of MOOD_KEYS) m[k] = 0;
    for (const [pose, weight] of this.weights) {
      if (weight <= 1e-3) continue;
      copyAngles(this.posture, this.scratch);
      this.actionHips.x = this.hips.x;
      this.actionHips.y = this.hips.y;
      this.actionHips.z = this.hips.z;
      this.setMood(0.4, 0, 0, 0.4, 0);
      this.buildAction(pose, s, this.scratch, this.actionHips);
      for (const j of HUMAN_JOINTS) {
        t[j].x += this.scratch[j].x * weight;
        t[j].y += this.scratch[j].y * weight;
        t[j].z += this.scratch[j].z * weight;
      }
      hipsForward += (this.actionHips.z - this.hips.z) * weight;
      for (const k of MOOD_KEYS) m[k] += this.mood[k] * weight;
      total += weight;
    }
    if (total > 0) {
      for (const j of HUMAN_JOINTS) {
        t[j].x /= total;
        t[j].y /= total;
        t[j].z /= total;
      }
      hipsForward /= total;
      for (const k of MOOD_KEYS) m[k] /= total;
    }

    this.walkOverlay(s, t);
    this.attend(dt, s, t);
    this.life(dt, s, t);

    // Gentle final smoothing: the crossfade does the real blending; this only removes leftover pops.
    const rate = HUMAN_ANIMATION.jointSmoothing;
    const joints = this.state.joints;
    for (const j of HUMAN_JOINTS) {
      const c = joints[j];
      c.x = damp(c.x, t[j].x, rate, dt);
      c.y = damp(c.y, t[j].y, rate, dt);
      c.z = damp(c.z, t[j].z, rate, dt);
    }
    this.state.hipsX = damp(this.state.hipsX, this.hips.x, 12, dt);
    this.state.hipsY = damp(this.state.hipsY, this.hips.y, 16, dt);
    this.state.hipsZ = damp(this.state.hipsZ, this.hips.z + hipsForward, 12, dt);
    this.face(dt, s);
    this.state.prop = s.prop;
    this.animState = this.describe(s);
    return this.state;
  }

  // ---------------------------------------------------------------- actions: crossfade weights

  private updateWeights(dt: number, pose: HumanPose): void {
    if (!this.weights.has(pose)) this.weights.set(pose, 0);
    this.action = pose;
    const time = BLEND_TIME[pose] ?? HUMAN_ANIMATION.blend.default;
    for (const [p, w] of this.weights) {
      const next = p === pose ? Math.min(1, w + dt / time) : Math.max(0, w - dt / time);
      if (next <= 0 && p !== pose) this.weights.delete(p);
      else this.weights.set(p, next);
    }
  }

  // ---------------------------------------------------------------- posture: standing, walking, sitting, kneeling

  private buildPosture(dt: number, s: HumanVisualState): void {
    const p = this.posture;
    for (const j of HUMAN_JOINTS) p[j].x = p[j].y = p[j].z = 0;
    const hips = this.hips;
    hips.x = 0;
    hips.z = 0;
    this.sitTrend = s.sit - this.sitAmount;
    this.sitAmount = s.sit;
    const sit = smoothstep(0, 1, s.sit);
    this.kneel = damp(this.kneel, s.crouch * (1 - sit), 7, dt);
    const kneel = smoothstep(0, 1, this.kneel);

    // Walking: step length from speed, cadence from step length, so each stance foot stays put on the floor.
    const W = HUMAN_ANIMATION.walk;
    const speed = Math.abs(s.speed);
    const moving = speed > 0.04 && sit < 0.6;
    this.walkWeight = damp(this.walkWeight, moving ? smoothstep(0.04, 0.5, speed) : 0, 8, dt);
    const stepLength = clamp(W.baseStep + W.stepPerSpeed * speed, W.baseStep, W.maxStep);
    if (speed > 0.02) this.walkPhase += ((Math.PI * speed) / stepLength) * dt * (s.speed < 0 ? -1 : 1);
    const stride = this.walkWeight * (1 - kneel);
    const a = Math.asin(Math.min(0.9, stepLength / (2 * LEG_LENGTH))) * stride;
    const phi = this.walkPhase;
    for (const [side, offset] of [
      ['L', 0],
      ['R', Math.PI],
    ] as const) {
      const f = phi + offset;
      const swing = Math.max(0, Math.cos(f));
      p[`hip${side}`].x += -a * Math.sin(f);
      p[`knee${side}`].x += 0.06 * stride + W.kneeLift * swing * swing * stride;
      p[`ankle${side}`].x += swing > 0 ? -0.18 * swing * stride : 0.3 * Math.max(0, -Math.sin(f)) * -Math.cos(f) * stride;
    }
    // The stance leg is tilted: the hips drop to keep that foot on the floor (softened by the heel/toe roll).
    const tilt = a * Math.abs(Math.sin(phi));
    hips.y = HIP_HEIGHT - LEG_LENGTH * (1 - Math.cos(tilt)) * W.bob - 0.012 * stride;
    p.hips.y += -W.pelvisTurn * a * Math.sin(phi);
    p.hips.z += -0.04 * Math.cos(phi) * stride;
    hips.x += -W.sway * Math.cos(phi) * stride;
    p.spine.x += 0.035 * speed * stride;

    // Turning on the spot or side-stepping: little steps, never a frozen pivot.
    const T = HUMAN_ANIMATION.step;
    const turning = Math.abs(s.turnRate) > T.minTurnRate || Math.abs(s.sideSpeed) > T.minSideSpeed;
    this.stepWeight = damp(this.stepWeight, turning && this.walkWeight < 0.4 && sit < 0.3 && kneel < 0.3 ? 1 : 0, 10, dt);
    if (this.stepWeight > 0.01) {
      this.stepPhase += dt * T.rate * (0.6 + Math.min(1.5, Math.abs(s.turnRate) * 0.4 + Math.abs(s.sideSpeed) * 3));
      const sw = this.stepWeight;
      const lift = Math.sin(this.stepPhase);
      const liftL = Math.max(0, lift) * sw;
      const liftR = Math.max(0, -lift) * sw;
      p.hipL.x -= 0.35 * liftL;
      p.kneeL.x += T.kneeLift * liftL;
      p.hipR.x -= 0.35 * liftR;
      p.kneeR.x += T.kneeLift * liftR;
      const turnDir = Math.sign(s.turnRate);
      p.hipL.y += T.turnFoot * turnDir * liftL;
      p.hipR.y += T.turnFoot * turnDir * liftR;
      const sideDir = Math.sign(s.sideSpeed);
      p.hipL.z += 0.18 * sideDir * liftL;
      p.hipR.z += 0.18 * sideDir * liftR;
      hips.y -= 0.01 * sw;
    }

    // Kneeling on one knee (the right): the left foot flat in front, the right shin along the floor.
    if (kneel > 0.001) {
      p.hipL.x += -1.45 * kneel;
      p.kneeL.x += 1.5 * kneel;
      p.hipR.x += -0.18 * kneel;
      p.kneeR.x += 1.95 * kneel;
      p.ankleR.x += 0.75 * kneel;
      p.hipL.z += 0.06 * kneel;
      hips.y = lerp(hips.y, 0.56, kneel);
      hips.z = lerp(hips.z, -0.02, kneel);
    }

    // Sitting: thighs forward, shins down to the floor (or the stool's footrest), hips onto the seat.
    if (sit > 0.001) {
      const style = s.sitStyle;
      const thigh = style === 'lounge' ? -1.5 : style === 'stool' ? -1.35 : -1.52;
      const kneeBend = style === 'lounge' ? 0.15 : style === 'stool' ? 1.25 : 1.5;
      p.hipL.x = lerp(p.hipL.x, thigh, sit);
      p.hipR.x = lerp(p.hipR.x, thigh, sit);
      p.hipL.z = lerp(p.hipL.z, 0.06, sit);
      p.hipR.z = lerp(p.hipR.z, -0.04, sit);
      p.kneeL.x = lerp(p.kneeL.x, kneeBend, sit);
      p.kneeR.x = lerp(p.kneeR.x, kneeBend + (style === 'upright' ? 0.1 : 0), sit);
      p.ankleL.x = lerp(p.ankleL.x, style === 'lounge' ? -0.2 : 0.03, sit);
      p.ankleR.x = lerp(p.ankleR.x, style === 'lounge' ? -0.2 : -0.05, sit);
      p.spine.x = lerp(p.spine.x, style === 'lounge' ? -0.35 : -0.06, sit);
      hips.y = lerp(hips.y, s.seatHeight + HIP_ABOVE_SEAT, sit);
    }
    // Standing still: knees soft, not locked.
    const still = (1 - this.walkWeight) * (1 - sit) * (1 - kneel) * (1 - this.stepWeight);
    p.kneeL.x += 0.04 * still;
    p.kneeR.x += 0.04 * still;
    p.hipL.x -= 0.02 * still;
    p.hipR.x -= 0.02 * still;
  }

  // ---------------------------------------------------------------- actions: the upper body

  /** Relaxed arms: hanging a touch out from the body, elbows soft, fingers gently curled. */
  private relaxedArms(t: JointAngles): void {
    t.shoulderL.z = 0.1;
    t.shoulderR.z = -0.1;
    t.shoulderL.x = 0.03;
    t.shoulderR.x = 0.03;
    t.elbowL.x = -0.18;
    t.elbowR.x = -0.18;
    t.wristL.z = -0.05;
    t.wristR.z = 0.05;
    t.fingersL.x = -0.4;
    t.fingersR.x = -0.4;
    t.thumbL.x = -0.2;
    t.thumbR.x = -0.2;
  }

  /** Spread a bend over the lower and upper back. */
  private back(t: JointAngles, x: number, y = 0, z = 0): void {
    t.spine.x += x * 0.55;
    t.chest.x += x * 0.45;
    t.spine.y += y * 0.45;
    t.chest.y += y * 0.55;
    t.spine.z += z * 0.6;
    t.chest.z += z * 0.4;
  }

  private setMood(smile: number, brows: number, jawOpen: number, mouthWide: number, lids: number, eyesDown = 0): void {
    const m = this.mood;
    m.smile = smile;
    m.brows = brows;
    m.jawOpen = jawOpen;
    m.mouthWide = mouthWide;
    m.lids = lids;
    m.eyesDown = eyesDown;
  }

  /** A point in front of the chest, in character space (for holding things). */
  private chestPoint(t: JointAngles, hips: Hips, dx: number, dy: number, dz: number, out: Vector3): Vector3 {
    jointPosition(t, hips, 'chest', out);
    out.x += dx;
    out.y += dy;
    out.z += dz;
    return out;
  }

  /** Two-bone IK for a hand onto a character-space point. */
  private hand(t: JointAngles, hips: Hips, side: Side, target: Vector3, pole = ELBOW_POLE[side]): number {
    return solveArm(t, hips, side, target, pole);
  }

  /** Lean the back forward until `target` is comfortably within the right arm's reach (petting, putting things down). */
  private leanToReach(t: JointAngles, hips: Hips, target: Vector3, side: Side = 'R'): void {
    const reach = (UPPER_ARM + FOREARM_TO_PALM) * HUMAN_ANIMATION.reach.comfort;
    for (let i = 0; i < 11; i++) {
      jointPosition(t, hips, side === 'R' ? 'shoulderR' : 'shoulderL', this.w);
      if (this.w.distanceTo(target) <= reach || t.spine.x + t.chest.x >= HUMAN_ANIMATION.reach.maxLean) return;
      this.back(t, 0.1);
    }
  }

  private buildAction(pose: HumanPose, s: HumanVisualState, t: JointAngles, hips: Hips): void {
    const time = this.time;
    const v = this.v;
    const seated = smoothstep(0.35, 1, this.sitAmount);
    const standing = 1 - seated;
    this.relaxedArms(t);
    switch (pose) {
      case 'idle':
        break;
      case 'fold': {
        // Folding clothes at the basket: bent a little, hands working together at waist height.
        const fold = Math.sin(time * 2.2);
        this.back(t, 0.28);
        t.neck.x += 0.25;
        this.hand(t, hips, 'L', v.set(0.13 + 0.05 * fold, 0.86 + 0.04 * Math.abs(fold), 0.38));
        this.hand(t, hips, 'R', v.set(-0.13 - 0.05 * fold, 0.86 + 0.04 * Math.abs(fold), 0.38));
        this.setMood(0.3, 0, 0, 0.4, 0.1, 0.35);
        break;
      }
      case 'surprised':
        // Hands up by the shoulders, palms out: startled, not reaching.
        this.back(t, -0.08);
        t.clavicleL.z = 0.12;
        t.clavicleR.z = -0.12;
        this.hand(t, hips, 'L', this.chestPoint(t, hips, 0.22, 0.12, 0.2, v), OUT_POLE.L);
        this.hand(t, hips, 'R', this.chestPoint(t, hips, -0.22, 0.12, 0.2, v), OUT_POLE.R);
        t.wristL.x = t.wristR.x = 0.6;
        t.fingersL.x = t.fingersR.x = 0.05;
        this.setMood(0, 1, 0.75, 0, 0);
        break;
      case 'chase':
        this.back(t, 0.2);
        t.shoulderL.x = -0.35;
        t.shoulderR.x = -0.35;
        t.elbowL.x = t.elbowR.x = -1.2;
        t.fingersL.x = t.fingersR.x = -0.6;
        this.setMood(0.2, 0.3, 0.25, 0.5, 0);
        break;
      case 'lunge':
        this.back(t, 0.55);
        t.neck.x -= 0.25;
        hips.z += 0.1;
        this.hand(t, hips, 'L', v.set(0.12, 0.5, 0.62), OUT_POLE.L);
        this.hand(t, hips, 'R', v.set(-0.12, 0.5, 0.62), OUT_POLE.R);
        t.fingersL.x = t.fingersR.x = 0.1;
        t.hipL.x += -0.45;
        t.kneeL.x += 0.55;
        t.hipR.x += 0.15;
        this.setMood(0, 0.8, 0.5, 0.2, 0);
        break;
      case 'stumble':
        this.back(t, -0.12, 0, Math.sin(time * 8) * 0.1);
        t.shoulderL.z = 0.85 + Math.sin(time * 6) * 0.25;
        t.shoulderR.z = -0.85 + Math.sin(time * 6) * 0.25;
        t.elbowL.x = t.elbowR.x = -0.35;
        this.setMood(0, 1, 0.6, 0.3, 0);
        break;
      case 'shrug':
        t.clavicleL.z = 0.18;
        t.clavicleR.z = -0.18;
        t.neck.z = 0.12;
        t.shoulderL.z = 0.25;
        t.shoulderR.z = -0.25;
        t.elbowL.x = t.elbowR.x = -1.35;
        t.elbowL.y = 0.45;
        t.elbowR.y = -0.45;
        t.wristL.z = -0.35;
        t.wristR.z = 0.35;
        t.fingersL.x = t.fingersR.x = -0.1;
        this.setMood(0.15, 0.6, 0.1, 0.5, 0);
        break;
      case 'search':
        // A hand shading the eyes (the brain turns the head to scan).
        this.back(t, 0.08);
        this.hand(t, hips, 'R', this.chestPoint(t, hips, -0.07, 0.43, 0.14, v), UP_POLE.R);
        t.wristR.x = -0.3;
        t.fingersR.x = 0;
        this.setMood(0, 0.5, 0, 0.3, 0.2);
        break;
      case 'peek':
        // Bent right down, hands on knees, peering under the furniture.
        this.back(t, 0.95 * standing + 0.4 * seated);
        t.neck.x -= 0.55;
        t.head.x -= 0.15;
        jointPosition(t, hips, 'kneeL', v);
        this.hand(t, hips, 'L', v.set(v.x + 0.02, v.y + 0.08, v.z + 0.06), OUT_POLE.L);
        jointPosition(t, hips, 'kneeR', v);
        this.hand(t, hips, 'R', v.set(v.x - 0.02, v.y + 0.08, v.z + 0.06), OUT_POLE.R);
        this.setMood(0.1, 0.6, 0.1, 0.3, 0);
        break;
      case 'rummage': {
        const wiggle = Math.sin(time * 7);
        this.back(t, 0.18);
        t.neck.x += 0.25;
        this.hand(t, hips, 'R', v.set(-0.06 + 0.03 * wiggle, s.surface + 0.06, 0.48));
        t.fingersR.x = -0.5 - 0.4 * Math.max(0, wiggle);
        this.hand(t, hips, 'L', v.set(0.2, s.surface + 0.02, 0.4));
        this.setMood(0.4, 0.2, 0, 0.4, 0, 0.4);
        break;
      }
      case 'offer': {
        // Holding a treat out low toward Moke.
        const to = s.reach ?? { x: 0, y: 0.32, z: 0.6 };
        v.set(to.x * 0.6, Math.max(0.28, to.y + 0.1), Math.min(to.z * 0.8, 0.62));
        this.leanToReach(t, hips, v);
        this.hand(t, hips, 'R', v, OUT_POLE.R);
        t.wristR.x = -0.35;
        t.fingersR.x = -0.9;
        this.setMood(0.8, 0.4, 0.15, 0.7, 0);
        break;
      }
      case 'take':
        this.back(t, 0.3);
        this.hand(t, hips, 'L', v.set(0.1, 0.42, 0.45), OUT_POLE.L);
        this.hand(t, hips, 'R', v.set(-0.1, 0.42, 0.45), OUT_POLE.R);
        this.setMood(0.9, 0.3, 0.1, 0.7, 0);
        break;
      case 'place': {
        // Putting something down on the floor in front.
        v.set(-0.08, 0.14, 0.5);
        this.leanToReach(t, hips, v);
        this.hand(t, hips, 'R', v, OUT_POLE.R);
        t.fingersR.x = -0.2;
        this.setMood(0.7, 0.2, 0, 0.5, 0, 0.5);
        break;
      }
      case 'tidy':
        this.back(t, 0.45);
        t.neck.x += 0.2;
        this.hand(t, hips, 'L', v.set(0.14, 0.45, 0.45), OUT_POLE.L);
        this.hand(t, hips, 'R', v.set(-0.14, 0.45, 0.45), OUT_POLE.R);
        this.setMood(0.3, 0, 0, 0.4, 0, 0.4);
        break;
      case 'read': {
        // A book open in both hands at chest height; a page turns now and then.
        const turn = smoothstep(0.86, 0.94, (time / 7) % 1) * (1 - smoothstep(0.94, 1, (time / 7) % 1));
        this.back(t, 0.06 - seated * 0.14);
        t.neck.x += 0.32;
        t.head.x += 0.12;
        this.hand(t, hips, 'L', this.chestPoint(t, hips, 0.1, -0.2, 0.3, v));
        this.hand(t, hips, 'R', this.chestPoint(t, hips, -0.1 + turn * 0.12, -0.2 + turn * 0.03, 0.3, v));
        t.wristL.x = t.wristR.x = 0.25;
        t.wristL.z = -0.35;
        t.wristR.z = 0.35;
        t.fingersL.x = t.fingersR.x = -0.75;
        this.setMood(0.3, 0.1, 0, 0.4, 0.12, 0.45);
        break;
      }
      case 'phone': {
        const tap = Math.max(0, Math.sin(time * 7)) * (Math.sin(time * 0.9) > -0.3 ? 1 : 0);
        this.back(t, 0.08 - seated * 0.1);
        t.neck.x += 0.38;
        t.head.x += 0.12;
        this.hand(t, hips, 'R', this.chestPoint(t, hips, -0.04, -0.17, 0.27, v));
        this.hand(t, hips, 'L', this.chestPoint(t, hips, 0.05, -0.22, 0.25, v));
        t.wristR.x = 0.35;
        t.wristR.z = 0.3;
        t.fingersR.x = -0.9;
        t.thumbR.x = -0.3 - tap * 0.35;
        t.wristL.z = -0.3;
        this.setMood(0.25, -0.1, 0, 0.4, 0.1, 0.5);
        break;
      }
      case 'watch':
      case 'relax':
        if (pose === 'watch' || seated < 0.5) {
          // Leaning back, hands resting on the thighs (or hanging, standing), eyes on the screen.
          this.back(t, -0.22 * seated);
          if (seated > 0.5) this.handsOnThighs(t, hips, v);
          this.setMood(0.4 + Math.max(0, Math.sin(time * 0.37)) * 0.25, 0.1, 0, 0.5, 0.08);
        } else {
          // Stretched out, hands laced behind the head.
          this.back(t, -0.28);
          t.neck.x -= 0.05;
          this.hand(t, hips, 'L', this.chestPoint(t, hips, 0.07, 0.4, -0.12, v), UP_POLE.L);
          this.hand(t, hips, 'R', this.chestPoint(t, hips, -0.07, 0.4, -0.12, v), UP_POLE.R);
          t.fingersL.x = t.fingersR.x = -0.5;
          this.setMood(0.6, 0.1, 0, 0.5, 0.35);
        }
        break;
      case 'sip': {
        // A mug at the chest, lifted for a sip every few seconds.
        const cycle = (time / 6) % 1;
        const sipping = smoothstep(0.0, 0.14, cycle) * (1 - smoothstep(0.3, 0.44, cycle));
        jointPosition(t, hips, 'head', this.w);
        this.chestPoint(t, hips, -0.07, -0.12, 0.26, v);
        v.lerp(this.w.set(this.w.x - 0.02, this.w.y - 0.02, this.w.z + 0.13), sipping);
        this.hand(t, hips, 'R', v);
        t.wristR.z = 0.25;
        t.fingersR.x = -1.1;
        t.neck.x -= sipping * 0.15;
        if (seated > 0.5) this.handsOnThighs(t, hips, v, 'L');
        this.setMood(0.45, 0.1, 0, 0.3, sipping * 0.4);
        break;
      }
      case 'cook': {
        // Stirring the pot on the front burner, the other hand on the counter.
        const a = time * 3.2;
        this.back(t, 0.18);
        t.neck.x += 0.3;
        this.hand(t, hips, 'R', v.set(-0.08 + Math.cos(a) * 0.05, s.surface + 0.12, 0.47 + Math.sin(a) * 0.04));
        t.fingersR.x = -1.0;
        this.hand(t, hips, 'L', v.set(0.3, s.surface + 0.02, 0.32));
        t.fingersL.x = -0.2;
        this.setMood(0.4, 0.1, 0, 0.4, 0.1, 0.35);
        break;
      }
      case 'prep': {
        // Chopping on the counter: the left hand steadies, the right chops.
        const chop = Math.abs(Math.sin(time * 8));
        this.back(t, 0.22);
        t.neck.x += 0.35;
        this.hand(t, hips, 'L', v.set(0.1, s.surface + 0.04, 0.4));
        this.hand(t, hips, 'R', v.set(-0.1, s.surface + 0.04 + chop * 0.07, 0.4));
        t.fingersR.x = -1.1;
        t.fingersL.x = -0.3;
        this.setMood(0.35, 0.1, 0, 0.4, 0.15, 0.5);
        break;
      }
      case 'eat': {
        // Fork from the plate to the mouth, then a chew; the other hand on the table.
        const cycle = (time / 3.6) % 1;
        const up = smoothstep(0.05, 0.22, cycle) * (1 - smoothstep(0.34, 0.5, cycle));
        this.back(t, 0.12);
        jointPosition(t, hips, 'head', this.w);
        v.set(-0.07, s.surface + 0.05, 0.42).lerp(this.w.set(this.w.x - 0.02, this.w.y - 0.04, this.w.z + 0.12), up);
        this.hand(t, hips, 'R', v);
        t.fingersR.x = -1.1;
        this.hand(t, hips, 'L', v.set(0.17, s.surface + 0.02, 0.33));
        const chew = cycle > 0.5 && cycle < 0.85 ? Math.max(0, Math.sin(time * 13)) * 0.25 : 0;
        this.setMood(0.45, 0.1, chew, 0.3, 0.1, 0.4 * (1 - up));
        break;
      }
      case 'fridge':
        // One hand on the door, the other reaching in.
        this.back(t, 0.15);
        this.hand(t, hips, 'L', v.set(0.28, 1.05, 0.42), OUT_POLE.L);
        this.hand(t, hips, 'R', v.set(-0.06, 1.12, 0.55));
        t.fingersR.x = -0.5;
        this.setMood(0.3, 0.4, 0, 0.4, 0);
        break;
      case 'pet': {
        // A hand down onto Moke's back, patting and scritching; the back bends (or they kneel) to get there.
        const pat = Math.sin(time * 6.5);
        const to = s.reach ?? { x: -0.05, y: 0.34, z: 0.45 };
        v.set(to.x, to.y + 0.02 + Math.max(0, pat) * 0.035, to.z + pat * 0.03);
        this.leanToReach(t, hips, v);
        t.neck.x += 0.2;
        this.hand(t, hips, 'R', v, OUT_POLE.R);
        t.wristR.x = 0.25;
        t.fingersR.x = -0.3 - Math.max(0, -pat) * 0.35;
        if (seated > 0.5) this.handsOnThighs(t, hips, this.w, 'L');
        this.setMood(1, 0.45, 0.2, 0.8, 0.3, 0.3);
        break;
      }
      case 'call': {
        // "Come here!": patting their knees (standing) or thigh (sitting).
        const pat = Math.max(0, Math.sin(time * 9));
        if (seated > 0.5) {
          this.handsOnThighs(t, hips, v, 'R', 0.04 * pat);
        } else {
          this.back(t, 0.38);
          jointPosition(t, hips, 'kneeL', v);
          this.hand(t, hips, 'L', v.set(v.x + 0.02, v.y + 0.1 + 0.05 * pat, v.z + 0.08), OUT_POLE.L);
          jointPosition(t, hips, 'kneeR', v);
          this.hand(t, hips, 'R', v.set(v.x - 0.02, v.y + 0.1 + 0.05 * pat, v.z + 0.08), OUT_POLE.R);
        }
        t.fingersL.x = t.fingersR.x = -0.1;
        this.setMood(0.9, 0.6, 0.35, 0.7, 0);
        break;
      }
      case 'shoo': {
        // "Not now, buddy": a small wave of one hand at chest height, eyes staying on what they were doing.
        const flick = Math.sin(time * 9);
        this.hand(t, hips, 'R', this.chestPoint(t, hips, -0.16, -0.08, 0.26, v));
        t.wristR.y = flick * 0.45;
        t.wristR.x = -0.3;
        t.fingersR.x = -0.1;
        this.setMood(0.25, -0.35, 0.1, 0.4, 0.15);
        break;
      }
      case 'laugh': {
        const shake = Math.sin(time * 14) * 0.04;
        this.back(t, -0.1 + shake);
        t.neck.x -= 0.2;
        t.clavicleL.z = 0.06 + shake;
        t.clavicleR.z = -0.06 - shake;
        this.hand(t, hips, 'L', this.chestPoint(t, hips, 0.03, -0.26, 0.19, v));
        t.fingersL.x = -0.3;
        this.setMood(1, 0.5, 0.45 + Math.abs(Math.sin(time * 11)) * 0.25, 1, 0.55);
        break;
      }
      case 'windup':
        // Arm back, ready to throw, the other hand pointing where it'll go.
        this.back(t, 0.05, -0.4);
        t.shoulderR.z = -0.55;
        t.shoulderR.x = 0.75;
        t.elbowR.x = -1.45;
        t.fingersR.x = -1.1;
        this.hand(t, hips, 'L', this.chestPoint(t, hips, 0.15, 0.05, 0.5, v), OUT_POLE.L);
        t.fingersL.x = 0;
        this.setMood(0.9, 0.7, 0.3, 0.8, 0);
        break;
      case 'throw':
        this.back(t, 0.2, 0.35);
        this.hand(t, hips, 'R', this.chestPoint(t, hips, 0.05, 0.05, 0.6, v), OUT_POLE.R);
        t.fingersR.x = 0.1;
        t.shoulderL.z = 0.3;
        this.setMood(1, 0.6, 0.45, 0.9, 0);
        break;
      case 'point': {
        // Pointing at what they're looking at (a hidden treat), arm out but not locked.
        const at = s.look ?? { x: 0, y: 0.2, z: 1.5 };
        jointPosition(t, hips, 'shoulderR', this.w);
        v.set(at.x, at.y, at.z).sub(this.w).normalize().multiplyScalar(0.55).add(this.w);
        this.hand(t, hips, 'R', v, OUT_POLE.R);
        t.fingersR.x = 0;
        this.setMood(0.7, 0.4, 0.2, 0.6, 0);
        break;
      }
      case 'cheer': {
        // "Good boy!": a couple of claps in front of the chest (no arms flung out).
        const clap = Math.abs(Math.sin(time * 7));
        this.hand(t, hips, 'L', this.chestPoint(t, hips, 0.03 + 0.07 * clap, -0.12, 0.28, v));
        this.hand(t, hips, 'R', this.chestPoint(t, hips, -0.03 - 0.07 * clap, -0.12, 0.28, v));
        t.wristL.z = -0.9;
        t.wristR.z = 0.9;
        t.fingersL.x = t.fingersR.x = 0;
        this.setMood(1, 0.7, 0.4, 0.9, 0.2);
        break;
      }
    }
  }

  /** Hands resting on the tops of the thighs (sitting), or just one; `bob` pats. */
  private handsOnThighs(t: JointAngles, hips: Hips, v: Vector3, only?: Side, bob = 0): void {
    for (const side of ['L', 'R'] as const) {
      if (only && only !== side) continue;
      jointPosition(t, hips, side === 'L' ? 'hipL' : 'hipR', this.w);
      jointPosition(t, hips, side === 'L' ? 'kneeL' : 'kneeR', v);
      v.lerp(this.w, 0.38);
      v.y += 0.085 + bob;
      v.x += side === 'L' ? -0.01 : 0.01;
      this.hand(t, hips, side, v, OUT_POLE[side]);
      (side === 'L' ? t.wristL : t.wristR).x = 0.35;
      (side === 'L' ? t.fingersL : t.fingersR).x = -0.35;
    }
  }

  // ---------------------------------------------------------------- walking arms, attention, life

  /** Arms swing opposite the legs and the chest counter-turns, unless the hands are busy. */
  private walkOverlay(s: HumanVisualState, t: JointAngles): void {
    const W = HUMAN_ANIMATION.walk;
    const busy = HANDS_BUSY.has(s.pose) ? 1 : 0;
    const stride = this.walkWeight * (1 - smoothstep(0, 1, this.kneel));
    if (stride < 0.01) return;
    const speed = Math.abs(s.speed);
    const stepLength = clamp(W.baseStep + W.stepPerSpeed * speed, W.baseStep, W.maxStep);
    const a = Math.asin(Math.min(0.9, stepLength / (2 * LEG_LENGTH))) * stride;
    const sin = Math.sin(this.walkPhase);
    t.chest.y += W.chestTurn * a * sin;
    t.neck.y -= W.chestTurn * a * sin * 0.7;
    const arms = W.armSwing * a * (1 - busy);
    t.shoulderL.x += arms * sin;
    t.shoulderR.x -= arms * sin;
    t.elbowL.x -= (0.2 + Math.max(0, -sin) * 0.25) * stride * (1 - busy);
    t.elbowR.x -= (0.2 + Math.max(0, sin) * 0.25) * stride * (1 - busy);
  }

  /**
   * Where they look, spread over eyes → head and neck → upper body, each within human limits, with a weight that
   * comes and goes smoothly. A glance round the room is the same thing with no target.
   */
  private attend(dt: number, s: HumanVisualState, t: JointAngles): void {
    const L = HUMAN_ANIMATION.look;
    let wantYaw = 0;
    let wantPitch = 0;
    let wantWeight = 0;
    if (s.look && s.lookWeight > 0) {
      jointPosition(t, this.hips, 'head', this.w);
      const dx = s.look.x - this.w.x;
      const dy = s.look.y - (this.w.y + 0.08);
      const dz = s.look.z - this.w.z;
      wantYaw = Math.atan2(dx, dz);
      wantPitch = Math.atan2(dy, Math.max(0.2, Math.hypot(dx, dz)));
      wantWeight = s.lookWeight;
    } else if (Math.abs(s.headYaw) > 0.02) {
      wantYaw = s.headYaw;
      wantWeight = 1;
    }
    this.attention = damp(this.attention, wantWeight, L.attentionRate, dt);
    // The gaze turns at a human speed: never a snap.
    const maxStep = L.headSpeed * dt;
    this.gazeYaw += clamp(wantYaw - this.gazeYaw, -maxStep, maxStep);
    this.gazePitch += clamp(wantPitch - this.gazePitch, -maxStep, maxStep);
    const w = this.attention;
    if (w < 1e-3) {
      this.eyeYawWant = 0;
      this.eyePitchWant = 0;
      return;
    }

    // Yaw: eyes first, then head and neck, then the upper body; what's left over is out of reach.
    const yaw = this.gazeYaw;
    const eyesYaw = clamp(yaw, -L.eyes.yaw, L.eyes.yaw) * 0.6;
    const headYaw = clamp(yaw - eyesYaw, -L.headNeck.yaw, L.headNeck.yaw);
    const torsoYaw = clamp(yaw - eyesYaw - headYaw, -L.torso.yaw, L.torso.yaw);
    t.neck.y += headYaw * 0.55 * w;
    t.head.y += headYaw * 0.45 * w;
    t.chest.y += torsoYaw * 0.6 * w;
    t.spine.y += torsoYaw * 0.4 * w;
    // Pitch: nod (x positive is down), then bend the back to look well down at something small and close.
    const pitch = this.gazePitch;
    const eyesPitch = clamp(pitch, -L.eyes.pitch, L.eyes.pitch) * 0.5;
    const nod = clamp(pitch - eyesPitch, -L.headNeck.down, L.headNeck.up);
    const bend = clamp(pitch - eyesPitch - nod, -L.torso.down, 0);
    t.neck.x = lerp(t.neck.x, -nod * 0.55, w);
    t.head.x = lerp(t.head.x, -nod * 0.45, w);
    t.chest.x += -bend * 0.6 * w;
    t.spine.x += -bend * 0.4 * w;
    this.eyeYawWant = eyesYaw / 0.6;
    this.eyePitchWant = eyesPitch / 0.5;
  }

  /** Breathing, and a slow shift of weight from one foot to the other while standing about. */
  private life(dt: number, s: HumanVisualState, t: JointAngles): void {
    const I = HUMAN_ANIMATION.idle;
    const breath = Math.sin(this.time * 1.5);
    t.chest.x += I.breathe * breath;
    t.clavicleL.z += 0.008 * breath;
    t.clavicleR.z -= 0.008 * breath;
    const standing = (1 - this.walkWeight) * (1 - smoothstep(0, 1, s.sit)) * (1 - this.kneel) * (1 - this.stepWeight);
    this.shiftIn -= dt;
    if (this.shiftIn <= 0) {
      const [min, max] = I.shiftEvery;
      this.shiftIn = min + this.random() * (max - min);
      this.shiftTarget = this.random() < 0.5 ? -1 : 1;
    }
    this.shift = damp(this.shift, this.shiftTarget, 1.2, dt);
    if (standing > 0.01) {
      const k = this.shift * standing;
      this.hips.x += I.shift * k;
      t.hips.z += 0.035 * k;
      t.spine.z -= 0.03 * k;
      // The unweighted leg's knee softens a little.
      t.kneeL.x += 0.08 * Math.max(0, -k);
      t.kneeR.x += 0.08 * Math.max(0, k);
    }
  }

  private face(dt: number, s: HumanVisualState): void {
    const f = this.state.face;
    const m = this.moodSum;
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkLeft = 0.13;
      this.blinkIn = 2.2 + this.random() * 3.5;
    }
    this.blinkLeft -= dt;
    const blink = this.blinkLeft > 0 ? 1 : 0;
    f.lids = damp(f.lids, Math.max(m.lids, blink), blink ? 40 : 14, dt);
    f.smile = damp(f.smile, m.smile, 6, dt);
    f.brows = damp(f.brows, m.brows, 8, dt);
    f.mouthWide = damp(f.mouthWide, m.mouthWide, 8, dt);
    const talk = s.talking ? 0.12 + Math.abs(Math.sin(this.time * 17)) * 0.25 * (0.6 + 0.4 * Math.sin(this.time * 5.3)) : 0;
    f.jawOpen = damp(f.jawOpen, Math.max(m.jawOpen, talk), 18, dt);
    // Eyes: toward what they're attending to, otherwise the activity's gaze (down at a book) with small darts.
    this.dartIn -= dt;
    if (this.dartIn <= 0) {
      this.dartIn = 1.5 + this.random() * 3;
      this.dartYaw = (this.random() * 2 - 1) * 0.15;
    }
    const L = HUMAN_ANIMATION.look;
    const w = this.attention;
    const yaw = lerp(this.dartYaw, this.eyeYawWant, w);
    const pitch = lerp(-m.eyesDown * L.eyes.pitch * 2, this.eyePitchWant, w);
    f.eyeYaw = damp(f.eyeYaw, clamp(yaw, -L.eyes.yaw, L.eyes.yaw), L.eyeSpeed, dt);
    f.eyePitch = damp(f.eyePitch, clamp(pitch, -L.eyes.pitch * 2, L.eyes.pitch), L.eyeSpeed, dt);
  }

  /** The semantic state the body is showing (debug panel). */
  private describe(s: HumanVisualState): HumanAnimState {
    if (s.sit > 0.02 && s.sit < 0.98) return this.sitTrend >= 0 ? 'SIT_DOWN' : 'STAND_UP';
    const sitting = s.sit >= 0.98;
    switch (s.pose) {
      case 'read':
        return 'READ';
      case 'phone':
        return 'PHONE';
      case 'watch':
        return 'WATCH_TV';
      case 'relax':
        return 'RELAX';
      case 'sip':
        return 'SIP';
      case 'cook':
        return 'COOK';
      case 'prep':
        return 'PREP';
      case 'eat':
        return 'EAT';
      case 'fridge':
        return 'FRIDGE';
      case 'fold':
        return 'FOLD';
      case 'pet':
        return 'PET_MOKE';
      case 'call':
        return 'CALL_MOKE';
      case 'windup':
      case 'throw':
      case 'laugh':
        return 'PLAY_WITH_MOKE';
      case 'idle':
        if (this.walkWeight > 0.3) return 'WALK';
        if (this.stepWeight > 0.3) return 'TURN';
        if (this.kneel > 0.5) return 'KNEEL';
        if (this.attention > 0.3 && s.look) return 'LOOK_AT_MOKE';
        return sitting ? 'SIT' : 'IDLE';
      default:
        return 'HEIST';
    }
  }
}
