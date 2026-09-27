import type { Object3D } from 'three';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import type { HumanActivityController, HumanRole } from '../human/activities/HumanActivityController';
import { flatDistance, hold, walkTo } from '../human/activities/intentHelpers';
import type { HumanIntent, HumanSenses } from '../human/HumanBrain';
import type { Interactable } from '../interactions/Interactable';
import type { Vec3Like } from '../physics/CharacterBody';
import { DogActivity, type DogActivityContext } from './DogActivity';

interface DeliveryView {
  arrive(): void;
  acknowledge(): void;
  open(on: boolean): void;
  takePackage(hand: Object3D): void;
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
  onDefended(): void;
  random?: () => number;
}
type Step = 'done' | 'guard' | 'walk' | 'open' | 'exchange' | 'close';
type Tuning = typeof HOME_ACTIVITIES.delivery;

/** The bell waits independently; only an acknowledged delivery borrows the household human. */
export class DoorDelivery extends DogActivity {
  readonly id = 'doorDelivery' as const;
  readonly name = 'Protect the House';
  readonly needsHuman = true;
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

  override get objective(): string | null {
    if (this.ringing) return 'Ding-dong! Run to the front door and bark!';
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
      if (!this.ringing && !this.acknowledged && !ctx.heistRunning) {
        this.due -= dt;
        if (this.due <= 0) {
          this.ringing = true;
          this.nextRing = 0;
          this.ringingFor = 0;
          this.deps.view.arrive();
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
    if (!this.deps.routine.claim(this.role)) { this.enter('AVAILABLE'); return; }
    this.approach = flatDistance(ctx.moke.position, this.tuning.stand) < 0.4 ? this.tuning.alternateStand : this.tuning.stand;
    this.collected = false;
    this.go(this.guarding ? 'guard' : 'walk');
    this.deps.routine.say('What is it, brave little Moke?', 'happy');
  }
  protected onUpdate(): void {}
  protected onCancel(): void {
    this.go('done');
    this.ringing = this.acknowledged = this.guarding = false;
    this.ringingFor = this.guardingFor = 0;
    this.deps.view.cancel();
    this.schedule();
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
      case 'guard':
        hold(intent, 'idle', s.moke, 0, s.moke);
        if (!this.guarding) {
          this.deps.routine.say('Thanks, Moke! I’ll get the door.', 'happy');
          this.go('walk');
        }
        return true;
      case 'walk':
        walkTo(intent, this.approach, undefined, 0.12);
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
        this.acknowledged = false;
        this.due = this.delay(this.tuning.successfulInterval);
        this.go('done');
        this.deps.routine.say('Our brave little protector!', 'happy');
        this.deps.onDefended();
        this.succeed();
        return false;
      case 'done': return false;
    }
  }

  private go(step: Step): void { this.step = step; this.elapsed = 0; }
  private schedule(): void {
    this.due = this.delay(this.tuning.interval);
  }

  private delay([min, max]: readonly [number, number]): number {
    return min + (this.deps.random ?? Math.random)() * (max - min);
  }
}
