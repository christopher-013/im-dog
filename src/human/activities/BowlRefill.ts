import { BOWL_REFILL } from '../../config/activities';
import { HUMAN } from '../../config/human';
import type { Vec3Like } from '../../physics/CharacterBody';
import type { BowlKind } from '../../world/DogBowls';
import type { HumanIntent, HumanSenses } from '../HumanBrain';
import type { HumanProp } from '../HumanRig';
import type { HumanActivityController, HumanRole } from './HumanActivityController';
import { flatDistance, hold, walkTo } from './intentHelpers';

/** The bits of the bowls the errand needs. */
export interface RefillableBowls {
  position(kind: BowlKind): Vec3Like;
  refill(kind: BowlKind): void;
}

export interface BowlRefillDeps {
  readonly routine: HumanActivityController;
  readonly bowls: RefillableBowls;
  /** Where they kneel to fill the bowls. */
  readonly stand: Vec3Like;
  /** Where they get each from (standing there, facing what they fetch it from): kibble, water. */
  readonly sources: Readonly<Record<BowlKind, { readonly stand: Vec3Like; readonly facing: number }>>;
  /** Poured in (for the sound). */
  readonly onPour?: (kind: BowlKind) => void;
  readonly random?: () => number;
}

type Step = 'toSource' | 'fetch' | 'toBowls' | 'pour';

const PROP: Record<BowlKind, HumanProp> = { food: 'scoop', water: 'pitcher' };
const LINES: Record<BowlKind, readonly string[]> = {
  food: ['Hungry boy! More coming.', 'All gone already? Okay, okay.', 'Refill for the good boy.'],
  water: ['Thirsty? Fresh water, coming up.', 'Let me get you some water.', 'All that running around, huh?'],
};
const DONE = ['There you go, Moke.', 'Enjoy, buddy.', 'All full again.'];

/**
 * The human refills Moke's bowls after he empties one: a little errand that borrows them from the daily routine
 * (like a dog activity's role): walk to the kitchen (the kibble at the counter, water at the sink), get it, carry it
 * to the bowls, kneel and pour. Both bowls empty: one trip after the other. The routine carries on afterwards; the
 * Sock Heist can take them mid-errand, and the bowl waits for later.
 */
export class BowlRefill {
  /** What they're doing for it (debug): null when not on the errand. */
  step: Step | null = null;
  private readonly queue: BowlKind[] = [];
  private current: BowlKind | null = null;
  private stepTime = 0;
  private waitLeft = 0;
  private poured = false;
  private readonly random: () => number;
  private readonly facePoint = { x: 0, y: 0, z: 0 };
  private readonly pourAt = { x: 0, y: 0, z: 0 };
  readonly role: HumanRole = {
    id: 'refillBowls',
    update: (dt, s, intent) => this.drive(dt, s, intent),
    cancel: () => this.cancelled(),
  };

  constructor(
    private readonly deps: BowlRefillDeps,
    private readonly tuning: typeof BOWL_REFILL = BOWL_REFILL,
  ) {
    this.random = deps.random ?? Math.random;
  }

  /** Waiting to be filled, or being filled now. */
  get pending(): readonly BowlKind[] {
    return this.current ? [this.current, ...this.queue] : this.queue;
  }

  /** On the errand right now. */
  get busy(): boolean {
    return this.step !== null;
  }

  /** A bowl was emptied: they come to fill it after a short while, as soon as they're free. */
  request(kind: BowlKind): void {
    if (this.current === kind || this.queue.includes(kind)) return;
    if (!this.busy && this.queue.length === 0) this.waitLeft = this.tuning.delay;
    this.queue.push(kind);
  }

  /** Each fixed step: once it's time, borrow the human when they're free (busy with Moke or the heist: later). */
  update(dt: number): void {
    if (this.busy || this.queue.length === 0) return;
    this.waitLeft -= dt;
    if (this.waitLeft > 0) return;
    if (!this.deps.routine.claim(this.role)) {
      this.waitLeft = this.tuning.retry;
      return;
    }
    this.next();
    const kind = this.current!;
    this.deps.routine.say(pick(this.random, LINES[kind]), 'happy');
  }

  private next(): boolean {
    this.current = this.queue.shift() ?? null;
    if (!this.current) {
      this.step = null;
      return false;
    }
    this.goStep('toSource');
    return true;
  }

  private drive(dt: number, s: HumanSenses, intent: HumanIntent): boolean {
    const kind = this.current;
    if (!kind) return false;
    this.stepTime += dt;
    const t = this.tuning;
    const source = this.deps.sources[kind];
    const stand = this.deps.stand;
    switch (this.step) {
      case 'toSource':
        walkTo(intent, source.stand, HUMAN.move.walkSpeed, 0.15);
        if ((s.arrived && flatDistance(s.position, source.stand) < 0.4) || this.stepTime > t.walkTimeout) this.goStep('fetch');
        return true;
      case 'fetch':
        this.facePoint.x = source.stand.x + Math.sin(source.facing);
        this.facePoint.z = source.stand.z + Math.cos(source.facing);
        hold(intent, 'rummage', this.facePoint);
        if (this.stepTime > t.fetchTime) this.goStep('toBowls');
        return true;
      case 'toBowls':
        walkTo(intent, stand, HUMAN.move.walkSpeed, 0.15);
        intent.prop = PROP[kind];
        if ((s.arrived && flatDistance(s.position, stand) < 0.4) || this.stepTime > t.walkTimeout) this.goStep('pour');
        return true;
      case 'pour': {
        const bowl = this.deps.bowls.position(kind);
        hold(intent, 'place', bowl, 1);
        intent.prop = PROP[kind];
        // The hand over the bowl, just above its rim.
        this.pourAt.x = bowl.x;
        this.pourAt.y = t.pourHeight;
        this.pourAt.z = bowl.z;
        intent.reach = this.pourAt;
        if (!this.poured && this.stepTime > t.pourAt) {
          this.poured = true;
          this.deps.bowls.refill(kind);
          this.deps.onPour?.(kind);
        }
        if (this.stepTime < t.pourTime) return true;
        if (this.next()) return true;
        this.deps.routine.say(pick(this.random, DONE), 'happy');
        return false;
      }
      default:
        return false;
    }
  }

  /** Taken off the errand (the Sock Heist): the bowl waits, and they come back to it later. */
  private cancelled(): void {
    if (this.current && !(this.step === 'pour' && this.poured)) this.queue.unshift(this.current);
    this.current = null;
    this.step = null;
    this.waitLeft = this.tuning.retry;
  }

  private goStep(step: Step): void {
    this.step = step;
    this.stepTime = 0;
    if (step === 'toSource') this.poured = false;
  }
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[Math.floor(random() * items.length)]!;
}
