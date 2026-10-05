import type { Object3D } from 'three';
import { COURSE_REWARD } from '../config/obstacleCourse';
import { HUMAN } from '../config/human';
import type { Treat } from '../heist/Treat';
import type { HumanActivityController, HumanRole } from '../human/activities/HumanActivityController';
import { flatDistance, hold, walkTo } from '../human/activities/intentHelpers';
import type { HumanIntent, HumanSenses } from '../human/HumanBrain';
import type { Vec3Like } from '../physics/CharacterBody';
import { DogActivity } from './DogActivity';

interface RewardDeps {
  routine: HumanActivityController;
  hand: Object3D;
  /** The hamburger patty (a Treat). */
  treat: Treat;
  scene: Object3D;
  /** Is Moke indoors (not in the backyard)? */
  inside: (p: Vec3Like) => boolean;
  openFloor: (x: number, z: number) => boolean;
  onFed(): void;
}
type Tuning = typeof COURSE_REWARD;
type Step = 'walk' | 'wait' | 'done';

/**
 * After Liam's Obstacle Course (Phase 5): the human goes and waits just inside the open slider with a hamburger patty,
 * and gives it to Moke when he comes back in. Never a soft-lock: if he stays out, it goes down on the floor there for
 * him; if the Sock Heist needs the human, it waits for later (the reward is kept until he's had it).
 */
export class CourseReward extends DogActivity {
  readonly id = 'courseReward' as const;
  readonly name = 'Course Reward';
  readonly needsHuman = true;
  /** He's earned it and hasn't had it yet. */
  pending = false;
  private step: Step = 'done';
  private elapsed = 0;
  private near = 0;
  private foodTime = 0;
  private mokeInside = false;
  private readonly role: HumanRole = { id: 'courseReward', update: (dt, s, i) => this.drive(dt, s, i), cancel: () => this.cancel() };

  constructor(private readonly deps: RewardDeps, private readonly tuning: Tuning = COURSE_REWARD) {
    super(tuning.cooldown);
    deps.treat.onEat = () => {
      if (!this.running) return;
      this.pending = false;
      this.step = 'done';
      this.deps.onFed();
      this.succeed();
    };
  }

  /** The course is done: there's a hamburger patty in it for him. */
  earn(): void {
    this.pending = true;
  }

  override get objective(): string | null {
    if (!this.running) return null;
    if (this.deps.treat.state === 'placed') return 'Your hamburger patty is by the patio doors. Eat it!';
    if (this.step === 'wait' && !this.mokeInside) return 'Head back inside: someone is waiting with something good…';
    return null;
  }

  protected wants(): boolean {
    return this.pending;
  }

  protected onStart(): void {
    if (!this.deps.routine.claim(this.role)) {
      this.enter('AVAILABLE');
      return;
    }
    this.deps.treat.reset();
    this.step = 'walk';
    this.elapsed = this.near = this.foodTime = 0;
  }

  protected onUpdate(dt: number): void {
    if (this.deps.treat.state === 'placed') {
      this.foodTime += dt;
      if (this.foodTime >= this.tuning.foodTimeout) this.cancel();
    }
  }

  protected onCancel(): void {
    this.step = 'done';
    this.deps.treat.reset();
  }

  resetAll(): void {
    this.cancel();
    this.onCancel();
    this.pending = false;
    this.enter('AVAILABLE');
  }

  private drive(dt: number, s: HumanSenses, intent: HumanIntent): boolean {
    this.elapsed += dt;
    const t = this.tuning;
    this.mokeInside = this.deps.inside(s.moke);
    switch (this.step) {
      case 'walk':
        walkTo(intent, t.waitAt, HUMAN.move.walkSpeed, 0.15);
        if (flatDistance(s.position, t.waitAt) < 0.3 || (s.arrived && this.elapsed > 0.5)) {
          this.deps.treat.holdIn(this.deps.hand);
          this.deps.routine.say(t.lines.waiting, 'happy');
          this.activate();
          this.go('wait');
        } else if (this.elapsed > t.walkTimeout || (s.stuck ?? 0) > 4) {
          this.cancel();
          return false;
        }
        return true;
      case 'wait': {
        // Holding it out toward him (toward the doors while he's still outside), kneeling once he's close.
        const close = this.mokeInside && flatDistance(s.moke, s.position) <= t.reach && !s.mokeCarrying && !s.mokeLying;
        hold(intent, 'offer', s.moke, close ? 1 : 0, s.moke);
        intent.reach = { x: s.moke.x, y: s.moke.y + 0.3, z: s.moke.z };
        this.near = close ? this.near + dt : 0;
        if (this.near >= t.offerTime) {
          this.deps.routine.say(t.lines.give, 'happy');
          this.deps.treat.feed();
          this.step = 'done';
          return false;
        }
        if (this.elapsed >= t.waitTimeout) {
          // He's stayed out: it goes down on the floor here for him.
          for (const dx of [-0.5, -0.8, -0.3]) {
            if (!this.deps.openFloor(s.position.x + dx, s.position.z)) continue;
            this.deps.treat.place({ x: s.position.x + dx, z: s.position.z }, this.deps.scene);
            break;
          }
          if (this.deps.treat.state !== 'placed') this.cancel();
          this.step = 'done';
          return false;
        }
        return true;
      }
      case 'done':
        return false;
    }
  }

  private go(step: Step): void {
    this.step = step;
    this.elapsed = 0;
  }
}
