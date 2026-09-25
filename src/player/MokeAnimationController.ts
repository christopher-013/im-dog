import { MOKE_ANIMATION } from '../config/animation';
import { MOVEMENT, type MovementTuning } from '../config/movement';
import { clamp, damp, smoothstep } from '../utils/math';
import { gaitForSpeed, type Gait } from './Locomotion';
import type { Trick } from './Tricks';

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
  /** Lying in his bed. Default false. */
  resting?: boolean;
  /** In the air (a jump, or dropping off the couch). Default false. */
  airborne?: boolean;
  /** Up (+) or down (−), m/s. Default 0. */
  verticalSpeed?: number;
  /**
   * Something interesting to glance at (see AttentionSystem), relative to his facing: yaw (positive = to his
   * left) and pitch (positive = up), radians. Null/undefined = nothing in particular.
   */
  look?: { yaw: number; pitch: number } | null;
}

/**
 * Model-independent body language. A visual renders it however it can: the toon Moke
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
  /** Positive = looking up (radians). */
  headPitch: number;
  /** 0..1: how intently he's looking at something in particular (eyes can follow too). */
  attention: number;
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
  /** 0..1: a playful growl pose in progress. */
  growl: number;
  /** 0..1: eating something off the floor (a treat): nose down, chewing. */
  eat: number;
  /** 0..1: in the air (a jump, or a drop off the couch): legs reaching, not walking. */
  air: number;
  /** −1..1: going up (+) or coming down (−) while in the air. */
  rise: number;
  /** 0..1: the little squash just after landing. */
  land: number;
  /** 0..1: lying down (sphinx pose, head resting, sleepy eyes). */
  rest: number;
  /** 0..1: sitting, because he's been standing still a while. */
  sit: number;
  /** 0..1: a stretch (play bow) in progress, before he sits. */
  stretch: number;
  /** The trick he's doing, or null. */
  trick: Trick | null;
  /** Seconds since the current trick started. */
  trickTime: number;
  /** 0..1: how fully he's in the trick (eases in at the start, out at the end or when cut short). */
  trickBlend: number;
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
    headPitch: 0,
    attention: 0,
    headTilt: 0,
    tailWag: MOKE_ANIMATION.idleTailWag,
    crouch: 0,
    carry: 0,
    sniff: 0,
    bark: 0,
    growl: 0,
    eat: 0,
    air: 0,
    rise: 0,
    land: 0,
    rest: 0,
    sit: 0,
    stretch: 0,
    trick: null,
    trickTime: 0,
    trickBlend: 0,
    time: 0,
  };

  private idleTime = 0;
  private nextIdleAction: number = MOKE_ANIMATION.idleActionEvery[0];
  private lookTarget = 0;
  private pitchTarget = 0;
  private looking = false;
  /** Standing-still personality: waiting → (stretching) → sitting. */
  private sitting = false;
  private stretchLeft = 0;
  private tiltTarget = 0;
  private tiltTimeLeft = 0;
  private sinceBark = Infinity;
  private sinceGrowl = Infinity;
  private sinceEat = Infinity;
  private sinceLand = Infinity;
  private wasAirborne = false;
  /** When the current trick ends (s of trick time), and how long its ease-out takes. */
  private trickEnd = 0;
  private trickOut: number = MOKE_ANIMATION.tricks.blendOut;
  private trickCancelled = false;

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
    this.updateLook(sample, s.gait === 'idle');
    s.headYaw = damp(s.headYaw, this.lookTarget, 5, dt);
    s.headPitch = damp(s.headPitch, this.pitchTarget, 5, dt);
    s.attention = damp(s.attention, this.looking ? 1 : 0, 4, dt);
    s.headTilt = damp(s.headTilt, this.tiltTarget, 6, dt);

    s.carry = damp(s.carry, sample.carrying ? 1 : 0, 10, dt);
    s.sniff = damp(s.sniff, sample.sniffing ? 1 : 0, 6, dt);
    // Lying down is a slow, contented flop; getting up is quicker.
    s.rest = damp(s.rest, sample.resting ? 1 : 0, sample.resting ? a.lieDownRate : a.getUpRate, dt);
    // A bark snaps in over a few frames, then eases out.
    this.sinceBark += dt;
    const b = this.sinceBark / a.barkDuration;
    s.bark = b >= 1 ? 0 : Math.min(1, b * 6) * (1 - b) * (1 - b);
    // A growl holds longer than a bark: quick mock-ferocious snap in, then a soft release.
    this.sinceGrowl += dt;
    const g = this.sinceGrowl / a.growlDuration;
    s.growl = g >= 1 ? 0 : Math.min(1, g * 9) * Math.min(1, (1 - g) * 5);
    // Eating: straight down to it, a good chew, and back up.
    this.sinceEat += dt;
    const e = this.sinceEat / a.eatDuration;
    s.eat = e >= 1 ? 0 : Math.min(1, e * 7) * Math.min(1, (1 - e) * 6);
    this.updateAir(dt, sample);
    this.updateTrick(dt);
    this.updateSitting(dt, sample);
    const wag = s.gait === 'idle' ? a.idleTailWag : a.movingTailWag;
    s.tailWag = damp(s.tailWag, Math.max(wag, s.carry * a.carryTailWag, s.bark, s.growl * 0.8, s.trickBlend * a.tricks.tailWag, s.eat), 3, dt);

    const crouchTarget = clamp((a.duckBelowHeadroom - sample.headroom) / a.duckRange, 0, 1);
    s.crouch = damp(s.crouch, crouchTarget, 10, dt);
    return s;
  }

  /** In the air: legs reaching and nose up on the way up, down on the way down; a quick squash on landing. */
  private updateAir(dt: number, sample: MokeMotionSample): void {
    const a = MOKE_ANIMATION;
    const s = this.state;
    const airborne = sample.airborne ?? false;
    s.air = damp(s.air, airborne ? 1 : 0, airborne ? 20 : 14, dt);
    s.rise = damp(s.rise, airborne ? clamp((sample.verticalSpeed ?? 0) / a.airPitchSpeed, -1, 1) : 0, 14, dt);
    if (this.wasAirborne && !airborne) this.sinceLand = 0;
    this.wasAirborne = airborne;
    this.sinceLand += dt;
    const l = this.sinceLand / a.landDuration;
    s.land = l >= 1 ? 0 : Math.min(1, l * 8) * (1 - l) * (1 - l);
  }

  /** A bark just happened (after the gameplay cooldown allowed it). */
  bark(): void {
    this.sinceBark = 0;
  }

  /** A tiny dog doing his very best to look intimidating. */
  growl(): void {
    this.sinceGrowl = 0;
  }

  /** Eats something off the floor (a treat). He stays put while he chews. */
  eat(): void {
    this.sinceEat = 0;
  }

  get eating(): boolean {
    return this.sinceEat < MOKE_ANIMATION.eatDuration;
  }

  /** He's in the middle of a trick (including easing out of one he cut short). */
  get performingTrick(): boolean {
    return this.state.trick !== null;
  }

  /** He's doing a trick and staying put for it (not one he's cut short to go somewhere). */
  get holdsStillForTrick(): boolean {
    return this.state.trick !== null && !this.trickCancelled;
  }

  /** Starts a trick, unless he's already doing one. */
  trick(trick: Trick): boolean {
    if (this.state.trick) return false;
    const s = this.state;
    s.trick = trick;
    s.trickTime = 0;
    s.trickBlend = 0;
    this.trickEnd = MOKE_ANIMATION.tricks[trick];
    this.trickOut = MOKE_ANIMATION.tricks.blendOut;
    this.trickCancelled = false;
    return true;
  }

  /** Cuts the current trick short (he wants to go somewhere): he's quickly back on his feet. */
  cancelTrick(): void {
    const s = this.state;
    const { cancelOut } = MOKE_ANIMATION.tricks;
    if (!s.trick || this.trickCancelled) return;
    this.trickCancelled = true;
    if (this.trickEnd - s.trickTime <= cancelOut) return;
    this.trickEnd = s.trickTime + cancelOut;
    this.trickOut = cancelOut;
  }

  private updateTrick(dt: number): void {
    const s = this.state;
    if (!s.trick) return;
    s.trickTime += dt;
    if (s.trickTime >= this.trickEnd) {
      s.trick = null;
      s.trickTime = 0;
      s.trickBlend = 0;
      return;
    }
    const easeIn = clamp(s.trickTime / MOKE_ANIMATION.tricks.blendIn, 0, 1);
    const easeOut = clamp((this.trickEnd - s.trickTime) / this.trickOut, 0, 1);
    s.trickBlend = smoothstep(0, 1, Math.min(easeIn, easeOut));
  }

  /** Glancing at something interesting overrides his idle looks and the head lead into turns. */
  private updateLook(sample: MokeMotionSample, idle: boolean): void {
    const a = MOKE_ANIMATION;
    const look = sample.look;
    if (!look) {
      if (this.looking && idle) this.lookTarget = 0; // done looking: face forward again
      this.looking = false;
      this.pitchTarget = 0;
      return;
    }
    if (!this.looking && idle && this.random() < a.noticeTiltChance) {
      this.tiltTarget = (this.random() < 0.5 ? -1 : 1) * a.headTiltAngle; // "huh?"
      this.tiltTimeLeft = a.headTiltHold;
    }
    this.looking = true;
    this.lookTarget = clamp(look.yaw, -a.maxHeadYaw, a.maxHeadYaw);
    this.pitchTarget = clamp(look.pitch, -a.lookMaxPitch, a.lookMaxPitch);
  }

  /**
   * Left alone, he sits down after a while, sometimes with a stretch first. Anything else he does (moving,
   * a trick, sniffing, resting) cancels it at once, so it never gets in the way of play.
   */
  private updateSitting(dt: number, sample: MokeMotionSample): void {
    const a = MOKE_ANIMATION;
    const s = this.state;
    const busy = s.gait !== 'idle' || s.trick !== null || sample.sniffing || sample.resting || s.eat > 0 || s.air > 0.05;
    if (busy) {
      this.sitting = false;
      this.stretchLeft = 0;
      this.idleTime = 0;
    } else if (!this.sitting && this.stretchLeft <= 0 && this.idleTime >= a.idleSitAfter) {
      if (this.random() < a.idleStretchChance) this.stretchLeft = a.stretchDuration;
      else this.sitting = true;
    }
    if (this.stretchLeft > 0) {
      this.stretchLeft -= dt;
      if (this.stretchLeft <= 0) this.sitting = true;
    }
    const u = this.stretchLeft > 0 ? 1 - this.stretchLeft / a.stretchDuration : 0;
    s.stretch = this.stretchLeft > 0 ? Math.sin(Math.PI * u) : 0;
    s.sit = damp(s.sit, this.sitting ? 1 : 0, this.sitting ? a.sitDownRate : a.standUpRate, dt);
  }

  /** Little signs of life while standing: glance around, and now and then a curious head tilt. */
  private updateIdle(dt: number): void {
    const a = MOKE_ANIMATION;
    this.idleTime += dt;

    if (this.tiltTimeLeft > 0) {
      this.tiltTimeLeft -= dt;
      if (this.tiltTimeLeft <= 0) this.tiltTarget = 0;
    }
    if (this.idleTime < this.nextIdleAction || this.looking) return;

    this.nextIdleAction = this.idleTime + a.idleActionEvery[0] + this.random() * a.idleActionEvery[1];
    if (this.random() < a.headTiltChance) {
      this.tiltTarget = (this.random() < 0.5 ? -1 : 1) * a.headTiltAngle;
      this.tiltTimeLeft = a.headTiltHold;
    } else {
      this.lookTarget = (this.random() * 2 - 1) * a.idleLookRange;
    }
  }
}
