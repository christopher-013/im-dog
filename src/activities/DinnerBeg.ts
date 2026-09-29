import type { Object3D } from 'three';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import type { Treat } from '../heist/Treat';
import type { HumanActivityController, HumanRole } from '../human/activities/HumanActivityController';
import type { HumanIntent, HumanSenses } from '../human/HumanBrain';
import type { Interactable } from '../interactions/Interactable';
import type { Vec3Like } from '../physics/CharacterBody';
import { DogActivity, type DogActivityContext } from './DogActivity';

interface DinnerDeps {
  routine: HumanActivityController;
  /** The human's hands: the bite goes in the one on Moke's side. */
  hands: { readonly left: Object3D; readonly right: Object3D };
  /** A bite of their dinner (a meatball). */
  treat: Treat;
  /** Moke sits up and begs (at the start, and again as the bite comes down). */
  onBeg(): void;
  onFed(): void;
}
type Tuning = typeof HOME_ACTIVITIES.dinner;
type Step = 'done' | 'refuse' | 'sigh' | 'take' | 'offer';

/**
 * Begging at the dinner table: with the human sat eating dinner at the dining table, Moke sits quietly beside their
 * chair for a moment, then begs (Sit & Beg, or the Trick action). "Moke… no begging at the table." He keeps looking
 * at them. A sigh. "Oh, alright. Just one bite." They pick a meatball off the plate and hold it down to his nose, never
 * getting up from their chair, and he learns BEGGING = FOOD. Then they carry on with dinner.
 */
export class DinnerBeg extends DogActivity {
  readonly id = 'dinnerBeg' as const;
  readonly name = 'Begging at Dinner';
  readonly needsHuman = true;
  readonly interactable: Interactable;
  private nearby = false;
  private waited = 0;
  private requested = false;
  private step: Step = 'done';
  private elapsed = 0;
  /** Which side of their chair he's on, in their own frame: 1 their left, -1 their right (that hand shares). */
  private side: 1 | -1 = 1;
  /** Their seat (where the prompt is), and where the hand is going. */
  private readonly seat = { x: 0, y: 0, z: 0 };
  private readonly reach = { x: 0, y: 0, z: 0 };
  private readonly role: HumanRole = { id: 'dinnerBeg', update: (dt, s, i) => this.drive(dt, s, i), cancel: () => this.cancel() };

  constructor(private readonly deps: DinnerDeps, private readonly tuning: Tuning = HOME_ACTIVITIES.dinner) {
    super(tuning.cooldown);
    const activity = this;
    this.interactable = {
      id: 'dinner:beg', type: 'BEG', label: 'Sit & Beg', interactionDistance: tuning.reach,
      // Beside a chair, its own legs and seat are in the way of a clear-path check: nearness is judged below.
      priority: 40, requiresFacing: false, requiresClearPath: false,
      get position() { return activity.seat; },
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
    if (this.running) return this.step === 'refuse' || this.step === 'sigh' ? 'Keep begging… those eyes are working.' : 'A bite of dinner, just for Moke!';
    if (this.nearby && this.state === 'AVAILABLE') return this.canBeg ? 'Beg for a bite of dinner!' : 'Sit quietly beside the dinner table…';
    return null;
  }

  override update(dt: number, ctx: DogActivityContext): void {
    const r = this.deps.routine;
    const seat = r.effect === 'meal' && r.place?.kind === 'diningChair' ? r.place.seat : undefined;
    if (seat) {
      this.seat.x = seat.x;
      this.seat.y = seat.height;
      this.seat.z = seat.z;
    }
    this.nearby = !!seat && !ctx.heistRunning && ctx.human.available && r.sitting && !ctx.moke.carrying && !ctx.moke.napSpot
      && ctx.moke.speed <= this.tuning.stillSpeed && this.beside(ctx.moke.position);
    this.waited = this.nearby ? this.waited + dt : 0;
    if (!this.nearby && !this.running) this.requested = false;
    super.update(dt, ctx);
  }

  protected wants(): boolean { return this.canBeg && this.requested; }

  protected onStart(ctx: DogActivityContext): void {
    const r = this.deps.routine;
    if (!r.claim(this.role)) { this.requested = false; this.enter('AVAILABLE'); return; }
    this.requested = false;
    this.waited = 0;
    // Their left is +x in their own frame: (cos f, -sin f) in the world.
    const f = r.place!.facing;
    const left = (ctx.moke.position.x - this.seat.x) * Math.cos(f) - (ctx.moke.position.z - this.seat.z) * Math.sin(f);
    this.side = left >= 0 ? 1 : -1;
    this.deps.treat.reset();
    this.elapsed = 0;
    this.step = 'refuse';
    this.deps.onBeg();
    r.say(this.tuning.lines.refuse, 'neutral');
  }

  protected onUpdate(): void {}

  protected onCancel(): void {
    this.step = 'done';
    this.requested = this.nearby = false;
    this.waited = 0;
    this.deps.treat.reset();
  }

  resetAll(): void { this.cancel(); this.onCancel(); this.enter('AVAILABLE'); }

  /** On the floor beside their chair (either side, or tucked in under the table by their knees), not behind it. */
  private beside(p: Vec3Like): boolean {
    const place = this.deps.routine.place;
    if (!place || p.y > this.tuning.floor) return false;
    const dx = p.x - this.seat.x;
    const dz = p.z - this.seat.z;
    const ahead = dx * Math.sin(place.facing) + dz * Math.cos(place.facing);
    return Math.hypot(dx, dz) <= this.tuning.reach && ahead >= -this.tuning.behind;
  }

  private drive(dt: number, s: HumanSenses, intent: HumanIntent): boolean {
    if (!this.running) return false;
    const r = this.deps.routine;
    const t = this.tuning;
    // They never get up: dinner's still on the table.
    if (!r.stayPut(intent)) {
      this.cancel();
      return false;
    }
    this.elapsed += dt;
    intent.prop = null;
    intent.pose = 'idle';
    intent.lookAt = s.moke;
    intent.lookWeight = 1;
    intent.reach = null;
    switch (this.step) {
      case 'refuse':
        // Looking down at him, fork down, not budging… yet.
        if (this.elapsed >= t.refuseTime) {
          this.step = 'sigh';
          this.elapsed = 0;
        }
        return true;
      case 'sigh':
        if (this.elapsed >= t.sighTime) {
          r.say(t.lines.giveIn, 'neutral', intent);
          this.step = 'take';
          this.elapsed = 0;
        }
        return true;
      case 'take': {
        // A meatball off the plate, with the hand on his side.
        const plate = r.place!.surface ?? this.seat;
        this.aside(plate, 0.1, plate.y + 0.03);
        intent.pose = 'share';
        intent.reach = this.reach;
        intent.lookAt = this.reach;
        if (this.elapsed >= t.takeTime) {
          this.deps.treat.holdIn(this.side > 0 ? this.deps.hands.left : this.deps.hands.right);
          this.step = 'offer';
          this.elapsed = 0;
          this.activate();
          this.deps.onBeg();
        }
        return true;
      }
      case 'offer': {
        // Down to his nose. He has to still be there, sitting up for it.
        this.reach.x = s.moke.x;
        this.reach.y = s.moke.y + t.offerHeight;
        this.reach.z = s.moke.z;
        intent.pose = 'share';
        intent.reach = this.reach;
        if (this.elapsed >= t.offerTime && this.beside(s.moke) && !s.mokeCarrying && !s.mokeLying) {
          this.deps.treat.feed();
          this.step = 'done';
          return false;
        }
        if (this.elapsed >= t.offerTimeout) {
          // He wandered off: it goes back on the plate.
          r.say(t.lines.keep, 'neutral');
          this.cancel();
          return false;
        }
        return true;
      }
      case 'done':
        return false;
    }
  }

  /** `p` moved `by` metres toward Moke's side of the chair (in their frame), at height `y`. */
  private aside(p: Vec3Like, by: number, y: number): void {
    const f = this.deps.routine.place!.facing;
    this.reach.x = p.x + Math.cos(f) * by * this.side;
    this.reach.y = y;
    this.reach.z = p.z - Math.sin(f) * by * this.side;
  }
}
