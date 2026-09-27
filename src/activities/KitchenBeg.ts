import type { Object3D } from 'three';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import type { Treat } from '../heist/Treat';
import type { HumanActivityController, HumanRole } from '../human/activities/HumanActivityController';
import { flatDistance, hold } from '../human/activities/intentHelpers';
import type { HumanIntent, HumanSenses } from '../human/HumanBrain';
import type { Interactable } from '../interactions/Interactable';
import type { Vec3Like } from '../physics/CharacterBody';
import { DogActivity, type DogActivityContext } from './DogActivity';

interface KitchenDeps {
  routine: HumanActivityController;
  hand: Object3D;
  humanPosition: () => Vec3Like;
  treat: Treat;
  scene: Object3D;
  openFloor: (x: number, z: number) => boolean;
  clearPath: (from: Vec3Like, to: Vec3Like) => boolean;
  onBeg(): void;
  onFed(): void;
}
type Tuning = typeof HOME_ACTIVITIES.kitchen;
type Step = 'done' | 'take' | 'offer';

/** Wait patiently beside meal prep, then explicitly beg. One carrot, one reward, no input-spam duplicates. */
export class KitchenBeg extends DogActivity {
  readonly id = 'kitchenBeg' as const;
  readonly name = 'Dinner Helper';
  readonly needsHuman = true;
  readonly interactable: Interactable;
  private nearby = false;
  private waited = 0;
  private requested = false;
  private step: Step = 'done';
  private elapsed = 0;
  private foodTime = 0;
  private board: Vec3Like | null = null;
  private readonly role: HumanRole = { id: 'kitchenBeg', update: (dt, s, i) => this.drive(dt, s, i), cancel: () => this.cancel() };

  constructor(private readonly deps: KitchenDeps, private readonly tuning: Tuning = HOME_ACTIVITIES.kitchen) {
    super(tuning.cooldown);
    const activity = this;
    this.interactable = {
      id: 'kitchen:beg', type: 'BEG', label: 'Beg for a Carrot', interactionDistance: tuning.reach,
      priority: 40, requiresFacing: false, requiresClearPath: true,
      get position() { return deps.humanPosition(); },
      get enabled() { return activity.canBeg; },
      interact: () => this.requestBeg(),
    };
    deps.treat.onEat = () => {
      if (!this.running) return;
      this.deps.onFed();
      this.succeed();
      this.step = 'done';
    };
  }

  get canBeg(): boolean { return this.state === 'AVAILABLE' && this.waited >= this.tuning.wait && this.nearby; }

  /** Also used by the normal Trick action when this contextual action is ready. */
  requestBeg(): boolean {
    if (!this.canBeg) return false;
    this.requested = true;
    return true;
  }

  override get objective(): string | null {
    if (this.running) return this.deps.treat.state === 'placed' ? 'Your carrot is by the island. Eat it!' : 'A tiny carrot for a very patient Moke…';
    if (this.nearby && this.state === 'AVAILABLE') return this.canBeg ? 'Good waiting! Beg for a carrot.' : 'Stay beside your chopping human for a moment…';
    return null;
  }

  override update(dt: number, ctx: DogActivityContext): void {
    const r = this.deps.routine;
    this.nearby = !ctx.heistRunning && ctx.human.available && !ctx.moke.carrying && !ctx.moke.napSpot && r.effect === 'prep'
      && r.place?.kind === 'islandPrep' && flatDistance(ctx.moke.position, ctx.human.position) <= this.tuning.reach
      && ctx.moke.speed <= this.tuning.stillSpeed && this.deps.clearPath(ctx.moke.position, ctx.human.position);
    this.waited = this.nearby ? this.waited + dt : 0;
    if (!this.nearby && !this.running) this.requested = false;
    super.update(dt, ctx);
  }

  protected wants(): boolean { return this.canBeg && this.requested; }
  protected onStart(): void {
    if (!this.deps.routine.claim(this.role)) { this.requested = false; this.enter('AVAILABLE'); return; }
    this.requested = false;
    this.waited = 0;
    this.board = this.deps.routine.place?.surface ?? null;
    this.deps.treat.reset();
    this.elapsed = this.foodTime = 0;
    this.step = 'take';
    this.deps.onBeg();
    this.deps.routine.say('Such good waiting! A little carrot for you.', 'happy');
  }

  protected onUpdate(dt: number): void {
    if (this.state === 'ACTIVE' && this.deps.treat.state === 'placed') {
      this.foodTime += dt;
      if (this.foodTime >= this.tuning.foodTimeout) this.cancel();
    }
  }

  protected onCancel(): void {
    this.step = 'done';
    this.requested = this.nearby = false;
    this.waited = 0;
    this.deps.treat.reset();
  }

  resetAll(): void { this.cancel(); this.onCancel(); this.enter('AVAILABLE'); }

  private drive(dt: number, s: HumanSenses, intent: HumanIntent): boolean {
    this.elapsed += dt;
    switch (this.step) {
      case 'take':
        // The knife is put away before reaching for a small carrot bite on the board.
        hold(intent, 'place', this.board, 0, this.board);
        intent.reach = this.board;
        if (this.elapsed >= this.tuning.takeTime) {
          this.deps.treat.holdIn(this.deps.hand);
          this.step = 'offer'; this.elapsed = 0; this.activate();
        }
        return true;
      case 'offer': {
        const near = flatDistance(s.moke, s.position) <= this.tuning.reach && !s.mokeCarrying && !s.mokeLying
          && this.deps.clearPath(s.moke, s.position);
        hold(intent, 'offer', s.moke, 1, s.moke);
        intent.reach = { x: s.moke.x, y: s.moke.y + 0.3, z: s.moke.z };
        if (near && this.elapsed >= this.tuning.offerTime) {
          this.deps.treat.feed();
          this.step = 'done';
          return false;
        }
        if (this.elapsed >= this.tuning.offerTimeout) {
          // If he wanders off, leave it on reachable floor, never on/under the island or inside a wall.
          let placed = false;
          for (const dz of [-0.5, 0.5, -0.8, 0.8]) {
            const x = s.position.x, z = s.position.z + dz;
            if (!this.deps.openFloor(x, z)) continue;
            this.deps.treat.place({ x, z }, this.deps.scene);
            placed = true; break;
          }
          if (!placed) this.cancel();
          this.step = 'done';
          return false;
        }
        return true;
      }
      case 'done': return false;
    }
  }
}
