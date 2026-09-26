import { HUMAN_ACTIVITIES, ROUTINE, type ActivityStep, type HumanActivityDef, type HumanActivityId } from '../../config/activities';
import { HUMAN } from '../../config/human';
import type { GameEvents, Speech } from '../../core/GameEvents';
import type { Vec3Like } from '../../physics/CharacterBody';
import { angleDelta, clamp } from '../../utils/math';
import { roomAt } from '../../world/home/layout';
import type { HomePlace, Spot } from '../../world/home/places';
import { TALK_TIME, type HumanIdleDriver, type HumanIntent, type HumanSenses, type SeatSpec } from '../HumanBrain';
import { ActivityScheduler } from './ActivityScheduler';

/** Where the routine is with the current activity. */
export type RoutinePhase = 'pause' | 'walking' | 'settling' | 'doing' | 'leaving';

/**
 * Something that takes the human over for a while (a dog activity: hiding a treat, playing fetch). It fills in the
 * intent each step; the routine waits, remembering where it was, and carries on afterwards.
 */
export interface HumanRole {
  readonly id: string;
  /** Drives the human for this step. Returns false once it's finished. */
  update(dt: number, s: HumanSenses, intent: HumanIntent): boolean;
  /** The human is needed elsewhere (Sock Heist) or the game reset: stop at once. */
  cancel(): void;
}

/** A short moment with Moke on top of whatever they're doing (M4.5): see HumanReactions. */
export interface ReactionLayer {
  /**
   * Adjusts the intent for Moke. Returns 'look' while only their eyes and head are on him, 'pose' while it has taken
   * over the body (petting, praise; the activity's clock waits), null when there's nothing.
   */
  update(dt: number, s: HumanSenses, intent: HumanIntent, routine: HumanActivityController): 'look' | 'pose' | null;
  reset(): void;
  /** Busy with Moke right now (petting him): not to be interrupted by a dog activity. */
  readonly busy?: boolean;
}

interface Saved {
  readonly activity: HumanActivityDef;
  readonly stepIndex: number;
  readonly stepLeft: number;
  readonly at: number;
}

type Tuning = typeof ROUTINE;

const distance = (a: Vec3Like, b: Vec3Like) => Math.hypot(a.x - b.x, a.z - b.z);

/**
 * The human's daily life (Phase 4): plugged into HumanBrain as its idle behaviour, so the Sock Heist still takes
 * over the moment they spot Moke with the sock, and hands back afterwards. Each activity is data (config/
 * activities.ts): steps at kinds of place, a pose, a prop, a duration. The routine walks there (NavGrid, no
 * teleporting), sits or lines up, does it (glancing round now and then), gets up, pauses, and the scheduler picks
 * the next. Moke can interrupt (reactions); dog activities can borrow the human (roles). Nothing is lost: an
 * interrupted activity resumes.
 */
export class HumanActivityController implements HumanIdleDriver {
  activity: HumanActivityDef | null = null;
  phase: RoutinePhase = 'pause';
  place: HomePlace | null = null;
  stepIndex = 0;
  /** Seconds left in the current step (while doing it). */
  stepLeft = 0;
  /** The last activity finished. */
  last: HumanActivityId | null = null;
  /** Seconds of play so far. */
  now = 0;
  role: HumanRole | null = null;
  reactions: ReactionLayer | null = null;
  /** In charge right now (false while the Sock Heist has the human). */
  driving = true;
  /** Counts, for tests and the debug panel. */
  readonly stats = { started: 0, finished: 0, gaveUp: 0, resumed: 0 };

  private readonly scheduler: ActivityScheduler;
  private phaseTime = 0;
  private pauseLeft = 1;
  private saved: Saved | null = null;
  private glanceIn = 5;
  private glanceLeft = 0;
  private glanceYaw = 0;
  private readonly facePoint: Vec3Like = { x: 0, y: 0, z: 0 };
  private seatSpec: SeatSpec | null = null;
  /** A breather before starting (s): longer when carrying straight on from the last activity in the same seat. */
  private settleDelay = 0.3;
  /** A reaction had the body last step (the activity's clock waits). */
  private held = false;
  private mokeAt: Vec3Like = { x: 0, y: 0, z: 0 };
  private mokeSeated = false;

  constructor(
    private readonly places: readonly HomePlace[],
    private readonly events: GameEvents,
    private readonly random: () => number = Math.random,
    activities: readonly HumanActivityDef[] = HUMAN_ACTIVITIES,
    private readonly tuning: Tuning = ROUTINE,
  ) {
    this.scheduler = new ActivityScheduler(places, activities, random, tuning);
  }

  /** The current step (null between activities). */
  get step(): ActivityStep | null {
    return this.activity?.steps[this.stepIndex] ?? null;
  }

  /** What the current step shows or smells of, while it's being done (cooking, a meal, the TV). */
  get effect(): ActivityStep['effect'] | null {
    return this.phase === 'doing' ? (this.step?.effect ?? null) : null;
  }

  /** Busy with something Moke can interrupt, and nothing else has the human. */
  get available(): boolean {
    return this.driving && !this.role;
  }

  /** Seated for the current activity. */
  get sitting(): boolean {
    return (this.phase === 'doing' || this.phase === 'settling') && !!this.place?.seat;
  }

  // ---------------------------------------------------------------- HumanIdleDriver

  drive(dt: number, s: HumanSenses, intent: HumanIntent): number {
    this.now += dt;
    this.driving = true;
    this.mokeAt = s.moke;
    this.mokeSeated = s.moke.y > 0.25;
    intent.crouch = 0;
    if (this.role) {
      if (this.role.update(dt, s, intent)) return intent.headYaw;
      this.role = null;
      this.restore(s);
    }
    this.routine(dt, s, intent);
    const reacting = this.reactions?.update(dt, s, intent, this) ?? null;
    this.held = reacting === 'pose';
    return reacting ? this.headYawFor(intent, s) : this.glance(dt, s);
  }

  interrupt(): void {
    this.save();
    this.role?.cancel();
    this.role = null;
    this.reactions?.reset();
    this.driving = false;
  }

  resume(s: HumanSenses): void {
    this.driving = true;
    this.restore(s);
  }

  reset(): void {
    this.role?.cancel();
    this.role = null;
    this.reactions?.reset();
    this.saved = null;
    this.driving = true;
    const laundry = this.places.find((p) => p.kind === 'laundry');
    const fold = HUMAN_ACTIVITIES.find((a) => a.id === 'foldLaundry');
    if (laundry && fold) this.start(fold, laundry, 'settling');
    else this.pause();
  }

  /** A dog activity takes the human over. False if they're not available (the Sock Heist, another role). */
  claim(role: HumanRole): boolean {
    if (!this.driving || this.role || this.reactions?.busy) return false;
    this.save();
    this.role = role;
    this.reactions?.reset();
    return true;
  }

  /** Says something (a speech bubble), mouth moving. */
  say(text: string, mood: Speech['mood'], intent?: HumanIntent): void {
    if (intent) intent.talking = TALK_TIME;
    this.events.emit('HUMAN_SAID', { text, mood });
  }

  /** Cuts the current step short (Moke made it impossible, or a reaction ended it). */
  finishStep(): void {
    if (this.phase === 'doing' || this.phase === 'settling') this.stepLeft = 0;
  }

  // ---------------------------------------------------------------- the routine

  private routine(dt: number, s: HumanSenses, intent: HumanIntent): void {
    this.phaseTime += dt;
    switch (this.phase) {
      case 'pause':
        this.stand(intent);
        if ((this.pauseLeft -= dt) <= 0) this.chooseNext(s);
        break;
      case 'walking': {
        const place = this.place!;
        intent.goal = place.stand;
        intent.speed = HUMAN.move.walkSpeed;
        intent.stopWithin = 0.12;
        intent.face = null;
        intent.pose = 'idle';
        intent.prop = null;
        intent.seat = null;
        intent.lookAt = null;
        const there = s.arrived && distance(s.position, place.stand) < 0.35 && this.phaseTime > 0.1;
        if (there) this.enter('settling');
        else if ((s.stuck ?? 0) > this.tuning.stuckTimeout || this.phaseTime > this.tuning.walkTimeout) this.giveUp(s);
        break;
      }
      case 'settling': {
        const place = this.place!;
        if (!this.stillFree(place)) {
          this.moveOver(s, intent);
          break;
        }
        this.holdPlace(intent, place);
        intent.pose = 'idle';
        const ready = place.seat ? !!s.seated && this.phaseTime > this.settleDelay : this.phaseTime > Math.max(0.5, this.settleDelay) && Math.abs(angleDelta(s.heading, place.facing)) < 0.35;
        if (ready || this.phaseTime > 6) this.enter('doing');
        break;
      }
      case 'doing': {
        const place = this.place!;
        const step = this.step!;
        this.holdPlace(intent, place);
        intent.pose = step.pose;
        intent.prop = step.prop ?? null;
        intent.lookAt = step.lookAtFocus && place.look ? place.look : null;
        if (!this.held) this.stepLeft -= dt;
        if (this.stepLeft <= 0 && !this.carryOn(s)) this.enter('leaving');
        break;
      }
      case 'leaving':
        this.stand(intent);
        intent.goal = null;
        if (!s.seated && this.phaseTime > 0.25) this.nextStep(s);
        break;
    }
  }

  private chooseNext(s: HumanSenses): void {
    const choice = this.scheduler.choose({
      position: s.position,
      room: roomAt(s.position.x, s.position.z).id,
      now: this.now,
      last: this.last,
      isFree: (p) => this.isFree(p),
    });
    if (!choice) {
      this.pause();
      return;
    }
    this.start(choice.activity, choice.place, 'walking');
    const lines = choice.activity.lines;
    if (lines && this.random() < this.tuning.lineChance) this.say(lines[Math.floor(this.random() * lines.length)]!, 'neutral');
  }

  private start(activity: HumanActivityDef, place: HomePlace, phase: RoutinePhase): void {
    this.stats.started++;
    const samePlace = place === this.place && this.seatSpec !== null;
    this.activity = activity;
    this.stepIndex = 0;
    this.place = place;
    this.stepLeft = this.duration(activity.steps[0]!);
    // Same seat: keep sitting (the body only stands when the seat changes).
    if (!samePlace) this.seatSpec = this.specFor(place);
    this.settleDelay = 0.3;
    this.enter(phase);
  }

  /**
   * An activity's last step is over and they're sitting: often the next thing happens right there (a book after
   * the TV), so they stay put, have a breather, and start it without getting up.
   */
  private carryOn(s: HumanSenses): boolean {
    const activity = this.activity;
    const place = this.place;
    if (!activity || !place?.seat || this.stepIndex + 1 < activity.steps.length || this.random() > 0.7) return false;
    this.scheduler.markDone(activity.id, this.now);
    this.stats.finished++;
    this.last = activity.id;
    const next = this.scheduler.choose({
      position: s.position,
      room: place.room,
      now: this.now,
      last: this.last,
      isFree: (p) => p === place,
    });
    if (!next) return false;
    this.start(next.activity, place, 'settling');
    const [min, max] = this.tuning.pause;
    this.settleDelay = min + this.random() * (max - min);
    return true;
  }

  private nextStep(s: HumanSenses): void {
    const activity = this.activity;
    if (activity && this.stepIndex + 1 < activity.steps.length) {
      this.stepIndex++;
      const step = activity.steps[this.stepIndex]!;
      const place = this.scheduler.nearestPlace(step.places, s.position, (p) => this.isFree(p));
      if (place) {
        this.place = place;
        this.seatSpec = this.specFor(place);
        this.stepLeft = this.duration(step);
        this.enter('walking');
        return;
      }
    }
    this.finish();
  }

  private finish(): void {
    if (this.activity) {
      this.stats.finished++;
      this.scheduler.markDone(this.activity.id, this.now);
      this.last = this.activity.id;
    }
    this.pause();
  }

  /** Can't get there: this activity goes on cooldown and they do something else. No teleporting. */
  private giveUp(s: HumanSenses): void {
    this.stats.gaveUp++;
    if (this.activity) this.scheduler.markDone(this.activity.id, this.now);
    this.activity = null;
    this.place = null;
    this.pause();
    this.pauseLeft = 0.5;
    void s;
  }

  private pause(): void {
    this.activity = null;
    this.place = null;
    this.seatSpec = null;
    const [min, max] = this.tuning.pause;
    this.pauseLeft = min + this.random() * (max - min);
    this.enter('pause');
  }

  private enter(phase: RoutinePhase): void {
    this.phase = phase;
    this.phaseTime = 0;
  }

  // ---------------------------------------------------------------- interruptions

  private save(): void {
    if (this.activity && this.place && (this.phase === 'doing' || this.phase === 'settling' || this.phase === 'walking')) {
      this.saved = { activity: this.activity, stepIndex: this.stepIndex, stepLeft: Math.max(this.stepLeft, 8), at: this.now };
    }
  }

  /** Back to what they were doing (walking back to it if need be), or on to something new. */
  private restore(s: HumanSenses): void {
    const saved = this.saved;
    this.saved = null;
    if (saved && this.now - saved.at < 120) {
      const step = saved.activity.steps[saved.stepIndex]!;
      const place = this.scheduler.nearestPlace(step.places, s.position, (p) => this.isFree(p));
      if (place) {
        this.activity = saved.activity;
        this.stepIndex = saved.stepIndex;
        this.stepLeft = saved.stepLeft;
        this.place = place;
        this.seatSpec = this.specFor(place);
        this.stats.resumed++;
        this.enter(distance(s.position, place.stand) < 0.35 ? 'settling' : 'walking');
        return;
      }
    }
    // Right by the laundry (a sock just went back in the basket): carry on folding.
    const laundry = this.places.find((p) => p.kind === 'laundry');
    const fold = HUMAN_ACTIVITIES.find((a) => a.id === 'foldLaundry');
    if (laundry && fold && distance(s.position, laundry.stand) < 0.9) {
      this.start(fold, laundry, 'settling');
      return;
    }
    this.pause();
  }

  // ---------------------------------------------------------------- helpers

  /** Stay at the place: seated on its seat, or standing at it facing its way. */
  private holdPlace(intent: HumanIntent, place: HomePlace): void {
    intent.goal = place.stand;
    intent.speed = HUMAN.move.walkSpeed;
    intent.stopWithin = 0.12;
    intent.seat = this.seatSpec;
    if (place.seat) {
      intent.face = null;
    } else {
      this.facePoint.x = place.stand.x + Math.sin(place.facing);
      this.facePoint.z = place.stand.z + Math.cos(place.facing);
      intent.face = this.facePoint;
    }
  }

  private stand(intent: HumanIntent): void {
    intent.goal = null;
    intent.speed = 0;
    intent.face = null;
    intent.seat = null;
    intent.pose = 'idle';
    intent.prop = null;
    intent.lookAt = null;
  }

  /** Moke is lying where they meant to sit: another seat like it, or something else altogether. */
  private moveOver(s: HumanSenses, intent: HumanIntent): void {
    const step = this.step;
    const other = step ? this.scheduler.nearestPlace(step.places, s.position, (p) => this.isFree(p), this.place ?? undefined) : null;
    if (this.random() < 0.6) this.say(this.random() < 0.5 ? 'Oh! You took my spot.' : 'Scoot over, Moke.', 'happy', intent);
    if (other) {
      this.place = other;
      this.seatSpec = this.specFor(other);
      this.enter('walking');
    } else {
      this.giveUp(s);
    }
  }

  private isFree(place: HomePlace): boolean {
    const r = this.tuning.occupiedRadius;
    const m = this.mokeAt;
    if (place.seat && this.mokeSeated && Math.hypot(m.x - place.seat.x, m.z - place.seat.z) < r + 0.1) return false;
    return Math.hypot(m.x - place.stand.x, m.z - place.stand.z) >= r * 0.6 || this.place === place;
  }

  private stillFree(place: HomePlace): boolean {
    if (!place.seat) return true;
    const m = this.mokeAt;
    return !(this.mokeSeated && Math.hypot(m.x - place.seat.x, m.z - place.seat.z) < this.tuning.occupiedRadius + 0.1);
  }

  private specFor(place: HomePlace): SeatSpec | null {
    return place.seat ? { x: place.seat.x, z: place.seat.z, height: place.seat.height, style: place.seat.style, facing: place.facing } : null;
  }

  private duration(step: ActivityStep): number {
    const [min, max] = step.seconds;
    return min + this.random() * (max - min);
  }

  /** Now and then a look round the room, more often in activities that don't need their full attention. */
  private glance(dt: number, s: HumanSenses): number {
    const attention = this.phase === 'doing' ? (this.activity?.attention ?? 0.5) : 0.8;
    if (this.glanceLeft > 0) {
      this.glanceLeft -= dt;
      return this.glanceLeft > 0 ? this.glanceYaw : 0;
    }
    this.glanceIn -= dt * (0.3 + attention);
    if (this.glanceIn <= 0) {
      const [min, max] = this.tuning.glanceEvery;
      this.glanceIn = min + this.random() * (max - min);
      this.glanceLeft = this.tuning.glanceTime;
      // A look round the room they're in (that's when a sneaky dog gets spotted), as far as the neck turns.
      const room = roomAt(s.position.x, s.position.z);
      const toRoom = angleDelta(s.heading, Math.atan2((room.minX + room.maxX) / 2 - s.position.x, (room.minZ + room.maxZ) / 2 - s.position.z));
      this.glanceYaw = clamp(toRoom + (this.random() - 0.5) * 0.8, -HUMAN.glance.angle, HUMAN.glance.angle);
      return this.glanceYaw;
    }
    return 0;
  }

  /** While reacting, turn the head toward what they're looking at (within the neck's reach). */
  private headYawFor(intent: HumanIntent, s: HumanSenses): number {
    const at = intent.lookAt;
    if (!at) return 0;
    return clamp(angleDelta(s.heading, Math.atan2(at.x - s.position.x, at.z - s.position.z)), -1.1, 1.1);
  }
}

export type { Spot };
