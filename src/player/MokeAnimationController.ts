import { MOKE_ANIMATION } from '../config/animation';
import { MOVEMENT, type MovementTuning } from '../config/movement';
import { clamp, damp, smoothstep } from '../utils/math';
import { gaitForSpeed, type Gait } from './Locomotion';

/** What the controller reports each frame. */
export interface MokeMotionSample {
  /** Actual ground speed (m/s). */
  speed: number;
  /** Positive = turning left (rad/s). */
  turnRate: number;
  /** Free space above Moke's feet (m). */
  headroom: number;
  /** Something in his mouth. Default false. */
  carrying?: boolean;
  /** Sniff mode is on. Default false. */
  sniffing?: boolean;
}

/**
 * Model-independent body language. A visual renders it however it can: the placeholder
 * procedurally, a future moke.glb with animation clips plus bone tweaks.
 */
export interface MokeAnimationState {
  /** Smoothed ground speed (m/s). */
  speed: number;
  gait: Gait;
  /** 0 = trot-like, 1 = full run. */
  runBlend: number;
  /** Roll into turns (radians). Positive = leaning left. */
  lean: number;
  /** Positive = looking left (radians). */
  headYaw: number;
  /** Curious head tilt (radians). Positive = tilting toward his left. */
  headTilt: number;
  /** Tail wag intensity, 0..1. */
  tailWag: number;
  /** 0 = standing tall, 1 = fully ducked under something low. */
  crouch: number;
  /** 0..1: something in his mouth (head carried proudly, mouth closed on it). */
  carry: number;
  /** 0..1: nose down, sniffing. */
  sniff: number;
  /** 0..1: a bark in progress (a quick jolt up that settles). */
  bark: number;
  /** Seconds since creation, for cyclic motion. */
  time: number;
}

export class MokeAnimationController {
  readonly state: MokeAnimationState = {
    speed: 0,
    gait: 'idle',
    runBlend: 0,
    lean: 0,
    headYaw: 0,
    headTilt: 0,
    tailWag: MOKE_ANIMATION.idleTailWag,
    crouch: 0,
    carry: 0,
    sniff: 0,
    bark: 0,
    time: 0,
  };

  private idleTime = 0;
  private nextIdleAction: number = MOKE_ANIMATION.idleActionEvery[0];
  private lookTarget = 0;
  private tiltTarget = 0;
  private tiltTimeLeft = 0;
  private sinceBark = Infinity;

  constructor(
    private readonly tuning: MovementTuning = MOVEMENT,
    private readonly random: () => number = Math.random,
  ) {}

  update(dt: number, sample: MokeMotionSample): MokeAnimationState {
    const s = this.state;
    const a = MOKE_ANIMATION;
    s.time += dt;

    s.speed = damp(s.speed, sample.speed, 12, dt);
    s.gait = gaitForSpeed(s.speed, this.tuning);
    s.runBlend = smoothstep(this.tuning.trotSpeed, this.tuning.runSpeed, s.speed);

    const leanTarget = clamp(sample.turnRate * s.speed * a.leanPerTurnSpeed, -a.maxLean, a.maxLean);
    s.lean = damp(s.lean, leanTarget, 8, dt);

    if (s.gait === 'idle') {
      this.updateIdle(dt);
    } else {
      this.idleTime = 0;
      this.nextIdleAction = a.idleActionEvery[0];
      this.tiltTarget = 0;
      this.tiltTimeLeft = 0;
      this.lookTarget = clamp(sample.turnRate * a.headLeadIntoTurn, -a.maxHeadYaw, a.maxHeadYaw);
    }
    s.headYaw = damp(s.headYaw, this.lookTarget, 5, dt);
    s.headTilt = damp(s.headTilt, this.tiltTarget, 6, dt);

    s.carry = damp(s.carry, sample.carrying ? 1 : 0, 10, dt);
    s.sniff = damp(s.sniff, sample.sniffing ? 1 : 0, 6, dt);
    // A bark snaps in over a few frames, then eases out.
    this.sinceBark += dt;
    const b = this.sinceBark / a.barkDuration;
    s.bark = b >= 1 ? 0 : Math.min(1, b * 6) * (1 - b) * (1 - b);
    const wag = s.gait === 'idle' ? a.idleTailWag : a.movingTailWag;
    s.tailWag = damp(s.tailWag, Math.max(wag, s.carry * a.carryTailWag, s.bark), 3, dt);

    const crouchTarget = clamp((a.duckBelowHeadroom - sample.headroom) / a.duckRange, 0, 1);
    s.crouch = damp(s.crouch, crouchTarget, 10, dt);
    return s;
  }

  /** A bark just happened (after the gameplay cooldown allowed it). */
  bark(): void {
    this.sinceBark = 0;
  }

  /** Little signs of life while standing: glance around, and now and then a curious head tilt. */
  private updateIdle(dt: number): void {
    const a = MOKE_ANIMATION;
    this.idleTime += dt;

    if (this.tiltTimeLeft > 0) {
      this.tiltTimeLeft -= dt;
      if (this.tiltTimeLeft <= 0) this.tiltTarget = 0;
    }
    if (this.idleTime < this.nextIdleAction) return;

    this.nextIdleAction = this.idleTime + a.idleActionEvery[0] + this.random() * a.idleActionEvery[1];
    if (this.random() < a.headTiltChance) {
      this.tiltTarget = (this.random() < 0.5 ? -1 : 1) * a.headTiltAngle;
      this.tiltTimeLeft = a.headTiltHold;
    } else {
      this.lookTarget = (this.random() * 2 - 1) * a.idleLookRange;
    }
  }
}
