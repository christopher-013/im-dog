import { HUMAN } from '../config/human';
import { RIDE } from '../config/ride';
import type { HumanActivityController, HumanRole } from '../human/activities/HumanActivityController';
import { flatDistance, hold, walkTo } from '../human/activities/intentHelpers';
import type { HumanIntent, HumanSenses } from '../human/HumanBrain';
import type { Interactable } from '../interactions/Interactable';
import type { Vec3Like } from '../physics/CharacterBody';
import { DogActivity, type DogActivityContext } from './DogActivity';

interface RideOfferDeps {
  routine: HumanActivityController;
  /** The harness and leash go on (true) or come off (false): presentation, and the leash walk, are the game's. */
  onHarness(on: boolean): void;
  /** At the Garage door, both of them: the ride itself (the cinematic and the drive) takes over from here. */
  onAtDoor(): void;
  /** Anything else that should hold off an offer right now (the course, a show on TV…). */
  canOffer?(): boolean;
  /** Direct request accepted: stand up, stop other poses and look at the door. No bark/second confirmation. */
  onGarageRequest?(): void;
  random?: () => number;
}

type Step = 'done' | 'approach' | 'ask' | 'harness' | 'lead' | 'away';

/**
 * Going for a ride (Phase 6, D33), its first part: now and then (every 5–10 minutes of play, owner) the human comes
 * over: "Moke, want to go for a ride?". **Go for a Ride!** (or a bark) is a yes; wandering off or ignoring them is a
 * no ("Okay, maybe later."). Yes: they kneel and put his harness on, clip on the leash, and walk him to the Garage
 * door (the game keeps him at their side on the leash). There the ride takes over (`onAtDoor`), and the human stays
 * borrowed until the game calls `home()`. Go On A Drive at the Garage door commits immediately, holds the dog
 * nearby and brings the human over at a brisk walk; that path skips the question/answer step.
 */
export class RideOffer extends DogActivity {
  readonly id = 'rideOffer' as const;
  readonly name = 'Go for a Ride';
  readonly needsHuman = true;
  readonly interactable: Interactable;
  readonly garageRide: Interactable;
  /** Committed at the Garage door: the human comes as soon as they're free. */
  requested = false;
  private requestElapsed = 0;
  private step: Step = 'done';
  private elapsed = 0;
  private due: number;
  private arrivedFor = 0;
  private readonly role: HumanRole = { id: 'ride', update: (dt, s, i) => this.drive(dt, s, i), cancel: () => this.cancel() };
  private humanAt: Vec3Like = { x: 0, y: 0, z: 0 };
  private humanHeading = 0;
  private said = false;

  constructor(private readonly deps: RideOfferDeps, private readonly tuning = RIDE) {
    super(0);
    this.due = this.delay();
    const offer = this;
    this.interactable = {
      id: 'ride:yes', type: 'RIDE', label: 'Go for a Ride!', interactionDistance: tuning.answerReach, priority: 40, requiresFacing: false,
      get position() { return offer.humanAt; },
      get enabled() { return offer.asking; },
      interact: () => offer.accept(),
    };
    const ask = tuning.askAt;
    this.garageRide = {
      id: 'garage:ride', type: 'RIDE', label: 'Go On A Drive', interactionDistance: ask.reach, priority: 30, requiresFacing: false,
      position: { x: ask.x, y: 0, z: ask.z },
      get enabled() { return offer.state === 'AVAILABLE' && !offer.requested && deps.routine.available && (deps.canOffer?.() ?? true); },
      interact: () => offer.request(),
    };
  }

  /** One action commits the ride; repeat presses cannot start another one. */
  request(): void {
    if (!this.garageRide.enabled) return;
    this.requested = true;
    this.requestElapsed = 0;
    this.due = 0;
    this.deps.onGarageRequest?.();
  }

  /** They're asking right now ("want to go for a ride?"), waiting for his answer. */
  get asking(): boolean {
    return this.running && this.step === 'ask' && this.said;
  }

  /** Playful request barks only until the human arrives and starts harness preparation, not through boarding. */
  get anticipatingRide(): boolean {
    return this.requested && (this.state === 'AVAILABLE' || (this.running && this.step === 'approach'));
  }

  /** The harness is on and they're walking him to the Garage door: he follows on the leash. */
  get leading(): boolean {
    return this.running && this.step === 'lead';
  }

  /** He's said yes: from the harness going on until he's home, he's the ride's (FSD hands over). */
  get holdsDog(): boolean {
    return this.waitingForHuman || (this.running && (this.step === 'lead' || this.step === 'away'));
  }

  /** Remain where he chose the door action, or while the harness is being fitted (never steered by input/FSD). */
  get waitingForHuman(): boolean {
    return (this.requested && this.state === 'AVAILABLE') ||
      (this.running && (this.step === 'harness' || (this.requested && this.step === 'approach')));
  }

  /** Out on the ride (from the Garage door until `home()`). */
  get away(): boolean {
    return this.running && this.step === 'away';
  }

  /** Where the human is (the leash's other end). */
  get human(): Vec3Like {
    return this.humanAt;
  }

  /**
   * Where he walks on the leash: at heel, a little behind the human on their leash hand's side (their left), so he's
   * never in their way.
   */
  heel(out: { x: number; y: number; z: number }): { x: number; y: number; z: number } {
    const h = this.humanAt, a = this.humanHeading;
    out.x = h.x - Math.sin(a) * 0.65 + Math.cos(a) * 0.4;
    out.y = 0;
    out.z = h.z - Math.cos(a) * 0.65 - Math.sin(a) * 0.4;
    return out;
  }

  override get objective(): string | null {
    if (this.asking) return 'Want to go for a ride? Say yes!';
    if (this.running && this.step === 'approach' && this.requested) return 'Going on a drive! Your human is coming…';
    if (this.leading) return 'Off to the Garage on your leash…';
    return null;
  }

  /** A bark near them while they ask is a yes too; a bark at the Garage door asks for a ride. */
  noteBark(at: Vec3Like): void {
    if (this.asking && flatDistance(at, this.humanAt) <= this.tuning.answerReach) this.accept();
    else if (flatDistance(at, { x: this.tuning.askAt.x, y: 0, z: this.tuning.askAt.z }) <= this.tuning.askAt.reach) this.request();
  }

  /** Home again: the human's done, and the next offer is 5–10 minutes away. */
  home(): void {
    if (!this.away) return;
    this.requested = false;
    this.step = 'done';
    this.due = this.delay();
    this.succeed();
  }

  /** Sooner (tests, or the development console). */
  offerIn(seconds: number): void {
    this.due = seconds;
  }

  override update(dt: number, ctx: DogActivityContext): void {
    if (this.requested && this.state === 'AVAILABLE') {
      this.requestElapsed += dt;
      if (ctx.heistRunning || !(this.deps.canOffer?.() ?? true) || this.requestElapsed > this.tuning.requestWait) this.cancel();
    }
    if (this.state === 'AVAILABLE' && !ctx.heistRunning) this.due -= dt;
    super.update(dt, ctx);
  }

  override cancel(): void {
    // A direct request already holds the dog before the director can claim the human.
    if (this.requested && this.state === 'AVAILABLE') this.onCancel();
    else super.cancel();
  }

  protected wants(): boolean {
    return this.due <= 0 && (this.deps.canOffer?.() ?? true);
  }

  protected onStart(): void {
    if (!this.deps.routine.claim(this.role)) {
      this.enter('AVAILABLE');
      return;
    }
    this.said = false;
    this.go('approach');
  }

  protected onUpdate(): void {}

  protected onCancel(): void {
    this.requested = false;
    if (this.step === 'lead' || this.step === 'harness') this.deps.onHarness(false);
    this.step = 'done';
    this.due = this.delay();
  }

  private accept(): void {
    if (!this.asking) return;
    this.go('harness');
  }

  private drive(dt: number, s: HumanSenses, intent: HumanIntent): boolean {
    this.elapsed += dt;
    this.humanAt = s.position;
    this.humanHeading = s.heading;
    const t = this.tuning;
    const d = flatDistance(s.position, s.moke);
    switch (this.step) {
      case 'approach':
        walkTo(intent, s.moke, this.requested ? t.requestSpeed : HUMAN.move.walkSpeed, t.askFrom * 0.8);
        intent.lookAt = s.moke;
        if (d <= t.askFrom) {
          this.deps.routine.say(this.requested ? t.lines.asked : t.lines.ask, 'happy', intent);
          this.said = true;
          this.activate();
          this.go(this.requested ? 'harness' : 'ask');
        } else if (this.elapsed > t.walkTimeout || (s.stuck ?? 0) > 4) {
          this.cancel();
          return false;
        }
        return true;
      case 'ask':
        hold(intent, 'call', s.moke, 0, s.moke);
        if (this.elapsed > t.answerWithin || d > t.walkAwayAt) {
          this.deps.routine.say(t.lines.no, 'happy', intent);
          this.cancel();
          return false;
        }
        return true;
      case 'harness':
        // Over to him, down on one knee, harness on.
        if (d > 0.6) {
          walkTo(intent, s.moke, this.requested ? t.requestSpeed : HUMAN.move.walkSpeed, 0.45);
          if (this.elapsed > t.walkTimeout / 2) {
            this.cancel();
            return false;
          }
          this.arrivedFor = 0;
          return true;
        }
        hold(intent, 'offer', s.moke, 1, s.moke);
        intent.reach = { x: s.moke.x, y: s.moke.y + 0.25, z: s.moke.z };
        this.arrivedFor += dt;
        if (this.arrivedFor >= t.harnessTime) {
          this.deps.onHarness(true);
          this.deps.routine.say(t.lines.yes, 'happy', intent);
          this.go('lead');
        }
        return true;
      case 'lead': {
        const door = { x: t.doorStand.x, y: 0, z: t.doorStand.z };
        const there = flatDistance(s.position, door) < 0.3;
        if (!there) walkTo(intent, door, HUMAN.move.walkSpeed * 0.85, 0.12);
        else hold(intent, 'idle', s.moke, 0, s.moke);
        this.arrivedFor = there ? this.arrivedFor + dt : 0;
        // Both at the door (or he's dawdled too long: the leash brings him), and the ride takes over. Held up on the
        // way, the ride starts anyway (it cuts to the two of them at the door).
        if ((there && (d < t.leash + 0.9 || this.arrivedFor > t.waitForHim)) || this.elapsed > t.walkTimeout || (s.stuck ?? 0) > 6) {
          this.go('away');
          this.deps.onAtDoor();
        }
        return true;
      }
      case 'away':
        hold(intent, 'idle', s.moke, 0, s.moke);
        return true;
      case 'done':
        return false;
    }
  }

  private go(step: Step): void {
    this.step = step;
    this.elapsed = 0;
    this.arrivedFor = 0;
  }

  private delay(): number {
    const [min, max] = this.tuning.offerEvery;
    return min + (this.deps.random ?? Math.random)() * (max - min);
  }
}
