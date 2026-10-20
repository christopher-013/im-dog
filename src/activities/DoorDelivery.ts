import type { Object3D } from 'three';
import { HALLOWEEN_VISIT } from '../config/halloween';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import type { Treat } from '../heist/Treat';
import type { HumanActivityController, HumanRole } from '../human/activities/HumanActivityController';
import { flatDistance, hold, walkTo } from '../human/activities/intentHelpers';
import type { HumanIntent, HumanSenses } from '../human/HumanBrain';
import type { Interactable } from '../interactions/Interactable';
import type { Vec3Like } from '../physics/CharacterBody';
import { DogActivity, type DogActivityContext } from './DogActivity';

/** Who's at the door: the courier with a parcel, or (Halloween, D30) trick-or-treaters. */
export type Visit = 'courier' | 'trickOrTreat';

interface DeliveryView {
  arrive(visit: Visit): void;
  acknowledge(): void;
  open(on: boolean): void;
  /** The courier hands over the parcel. */
  takePackage(hand: Object3D): void;
  /** Trick-or-treaters: the candy bowl goes from its shelf into the human's hand (true), or back (false). */
  holdCandy(hand: Object3D | null): void;
  finish(): void;
  cancel(): void;
}
interface DeliveryDeps {
  routine: HumanActivityController;
  hand: Object3D;
  view: DeliveryView;
  onRing(): void;
  onBark(): void;
  /** Automatic guard performance after the player's first real bark (which already sounded). */
  onGuardVoice(kind: 'bark' | 'growl'): void;
  /** The visit went through (`visit` says who it was). */
  onDefended(visit: Visit): void;
  random?: () => number;
  /** Halloween (D30): is it on right now? The next visitors are trick-or-treaters while it is. */
  halloween?: () => boolean;
  /** Anything that should hold the bell for now (he's going for a ride): the visit waits until it's over. */
  canRing?: () => boolean;
  /** Halloween: the pumpkin biscuit the human brings him after the trick-or-treaters, and where it can go down. */
  biscuit?: { treat: Treat; scene: Object3D; openFloor(x: number, z: number): boolean };
}
type Step = 'done' | 'walk' | 'open' | 'exchange' | 'close' | 'biscuit';
type Tuning = typeof HOME_ACTIVITIES.delivery;

/** The bell waits independently; only an acknowledged delivery borrows the household human. */
export class DoorDelivery extends DogActivity {
  readonly id = 'doorDelivery' as const;
  readonly name = 'Protect the House';
  readonly needsHuman = true;
  /** Once he's barked at it, the human puts down a game of fetch or tug to answer it. */
  override readonly urgent = true;
  readonly interactable: Interactable;
  ringing = false;
  guarding = false;
  private acknowledged = false;
  private due: number;
  private nextRing = 0;
  private ringingFor = 0;
  private guardingFor = 0;
  private guardIndex = 1;
  private step: Step = 'done';
  private elapsed = 0;
  private collected = false;
  private approach: Vec3Like;
  /** Who rang this time. */
  visit: Visit = 'courier';
  private near = 0;
  private readonly role: HumanRole = { id: 'delivery', update: (dt, s, i) => this.drive(dt, s, i), cancel: () => this.cancel() };

  constructor(private readonly deps: DeliveryDeps, private readonly tuning: Tuning = HOME_ACTIVITIES.delivery) {
    super(tuning.cooldown);
    this.due = this.delay(tuning.firstDelay);
    this.approach = tuning.stand;
    const activity = this;
    this.interactable = {
      id: 'door:bark', type: 'BARK', label: 'Bark at the Door', position: tuning.stand,
      interactionDistance: tuning.reach, priority: 35, requiresFacing: false,
      get enabled() { return activity.ringing; },
      interact: () => deps.onBark(),
    };
  }

  /** Moke barked at the bell and the visit isn't over yet (the human's on the way, or at the door): worth waiting for. */
  get inProgress(): boolean {
    return this.acknowledged || this.running;
  }

  override get objective(): string | null {
    if (this.ringing) return this.visit === 'trickOrTreat' ? 'Ding-dong! Trick-or-treaters! Run to the front door and bark!' : 'Ding-dong! Run to the front door and bark!';
    if (this.step === 'biscuit') return 'A pumpkin biscuit, just for you! Go and get it!';
    if (this.guarding) return 'Moke is defending the house! Arf… grrr… arf!';
    if (this.acknowledged && !this.running) return 'Good bark! Your human will answer when free.';
    return this.running ? 'Your human is answering the door…' : null;
  }

  noteBark(at: Vec3Like): void {
    if (!this.ringing || flatDistance(at, this.tuning.stand) > this.tuning.reach) return;
    this.ringing = false;
    this.acknowledged = true;
    this.guarding = true;
    this.guardingFor = 0;
    this.guardIndex = 1;
    this.deps.view.acknowledge();
  }

  override update(dt: number, ctx: DogActivityContext): void {
    if (this.state === 'AVAILABLE') {
      if (!this.ringing && !this.acknowledged && !ctx.heistRunning && (this.deps.canRing?.() ?? true)) {
        this.due -= dt;
        if (this.due <= 0) {
          this.ringing = true;
          this.nextRing = 0;
          this.ringingFor = 0;
          this.visit = this.deps.halloween?.() && this.deps.biscuit ? 'trickOrTreat' : 'courier';
          this.deps.view.arrive(this.visit);
        }
      }
      if (this.ringing) {
        this.ringingFor += dt;
        if (this.ringingFor + 1e-9 >= this.tuning.unansweredTimeout) {
          // No human role was claimed: just leave quietly and schedule another visit, with no reward.
          this.onCancel();
        } else {
          this.nextRing -= dt;
          if (this.nextRing <= 1e-9) { this.deps.onRing(); this.nextRing = this.tuning.ringEvery; }
        }
      }
    }
    if (ctx.heistRunning && this.acknowledged && !this.running) {
      this.onCancel();
      this.enter('CANCELLED');
    }
    if (this.guarding) {
      this.guardingFor += dt;
      const voices = this.tuning.guardVoices;
      if (this.guardIndex < voices.length && this.guardingFor + 1e-9 >= this.guardIndex * this.tuning.guardEvery) {
        this.deps.onGuardVoice(voices[this.guardIndex]!);
        this.guardIndex++;
      }
      if (this.guardingFor + 1e-9 >= voices.length * this.tuning.guardEvery) this.guarding = false;
    }
    super.update(dt, ctx);
  }

  protected wants(): boolean { return this.acknowledged; }
  protected onStart(ctx: DogActivityContext): void {
    if (!this.deps.routine.claim(this.role, true)) { this.enter('AVAILABLE'); return; }
    this.approach = flatDistance(ctx.moke.position, this.tuning.stand) < 0.4 ? this.tuning.alternateStand : this.tuning.stand;
    this.collected = false;
    // Straight to the door (his guard barks carry on meanwhile), at a brisk pace.
    this.go('walk');
    this.deps.routine.say(this.visit === 'trickOrTreat' ? HALLOWEEN_VISIT.lines.coming : 'Coming, Moke! I’ll get the door.', 'happy');
  }
  protected onUpdate(): void {}
  protected onCancel(): void {
    // Answered (Moke barked at the door) but cut short: as long a break as a delivery that went through.
    const answered = this.acknowledged;
    this.go('done');
    this.deps.view.holdCandy(null);
    this.deps.biscuit?.treat.reset();
    this.ringing = this.acknowledged = this.guarding = false;
    this.ringingFor = this.guardingFor = 0;
    this.deps.view.cancel();
    this.schedule(answered);
  }

  resetAll(): void {
    this.cancel();
    this.onCancel();
    this.due = this.delay(this.tuning.firstDelay);
    this.enter('AVAILABLE');
  }

  private drive(dt: number, s: HumanSenses, intent: HumanIntent): boolean {
    this.elapsed += dt;
    const t = this.tuning;
    switch (this.step) {
      case 'walk':
        walkTo(intent, this.approach, t.answerSpeed, 0.12);
        if (s.arrived && flatDistance(s.position, this.approach) < 0.3) { this.activate(); this.go('open'); }
        else if (this.elapsed > t.walkTimeout || (s.stuck ?? 0) > 4) { this.cancel(); return false; }
        return true;
      case 'open':
        hold(intent, 'place', t.door, 0, t.handle);
        intent.reach = t.handle;
        this.deps.view.open(true);
        if (this.elapsed >= t.openTime) this.go('exchange');
        return true;
      case 'exchange':
        hold(intent, 'place', t.door, 0, t.handle);
        intent.reach = { x: t.door.x + 0.02, y: 1.02, z: t.door.z };
        if (this.visit === 'trickOrTreat') {
          // The candy bowl held out to the children while they pick.
          if (!this.collected) {
            this.collected = true;
            this.deps.view.holdCandy(this.deps.hand);
            this.deps.routine.say(HALLOWEEN_VISIT.lines.atDoor, 'happy');
          }
          if (this.elapsed >= HALLOWEEN_VISIT.exchangeTime) this.go('close');
          return true;
        }
        if (!this.collected && this.elapsed >= t.exchangeTime / 2) {
          this.collected = true;
          this.deps.view.takePackage(this.deps.hand);
          this.deps.routine.say('An Amazon package. Thank you!', 'happy');
        }
        if (this.elapsed >= t.exchangeTime) this.go('close');
        return true;
      case 'close':
        hold(intent, 'idle', s.moke, 0, s.moke);
        this.deps.view.open(false);
        if (this.elapsed < t.closeTime) return true;
        this.deps.view.finish();
        if (this.visit === 'trickOrTreat' && this.deps.biscuit) {
          // Bowl back on its shelf, a biscuit from the jar beside it, and off to find him.
          this.deps.view.holdCandy(null);
          this.deps.biscuit.treat.holdIn(this.deps.hand);
          this.deps.routine.say(HALLOWEEN_VISIT.lines.biscuit, 'happy');
          this.near = 0;
          this.go('biscuit');
          return true;
        }
        this.complete();
        return false;
      case 'biscuit':
        return this.bringBiscuit(dt, s, intent);
      case 'done': return false;
    }
  }

  /**
   * Halloween: walking over to him with the pumpkin biscuit and handing it over once he's close (kneeling to him);
   * if he won't come, it goes down on the floor beside them. Either way the visit's done.
   */
  private bringBiscuit(dt: number, s: HumanSenses, intent: HumanIntent): boolean {
    const b = HALLOWEEN_VISIT.biscuit;
    const biscuit = this.deps.biscuit!;
    const d = flatDistance(s.position, s.moke);
    const close = d <= b.reach && !s.mokeCarrying && !s.mokeLying;
    if (d > b.reach * 0.85) {
      walkTo(intent, s.moke, this.tuning.answerSpeed, b.reach * 0.75);
      intent.lookAt = s.moke;
    } else {
      hold(intent, 'offer', s.moke, close ? 1 : 0, s.moke);
      intent.reach = { x: s.moke.x, y: s.moke.y + 0.3, z: s.moke.z };
    }
    this.near = close ? this.near + dt : 0;
    if (this.near >= b.offerTime) {
      biscuit.treat.feed();
      this.complete();
      return false;
    }
    if (this.elapsed >= b.giveUpAfter || (s.stuck ?? 0) > 4) {
      for (const [dx, dz] of [[0.45, 0], [-0.45, 0], [0, 0.45], [0, -0.45]] as const) {
        if (!biscuit.openFloor(s.position.x + dx, s.position.z + dz)) continue;
        biscuit.treat.place({ x: s.position.x + dx, z: s.position.z + dz }, biscuit.scene);
        break;
      }
      if (biscuit.treat.state !== 'placed') biscuit.treat.reset();
      this.complete();
      return false;
    }
    return true;
  }

  /** The visit went through: the praise, the reward, the long wait before the next one. */
  private complete(): void {
    this.acknowledged = false;
    this.due = this.delay(this.tuning.successfulInterval);
    this.go('done');
    if (this.visit === 'courier') this.deps.routine.say('Our brave little protector!', 'happy');
    this.deps.onDefended(this.visit);
    this.succeed();
  }

  private go(step: Step): void { this.step = step; this.elapsed = 0; }
  private schedule(answered = false): void {
    this.due = this.delay(answered ? this.tuning.successfulInterval : this.tuning.interval);
  }

  private delay([min, max]: readonly [number, number]): number {
    return min + (this.deps.random ?? Math.random)() * (max - min);
  }
}
