import type { Vec3Like } from '../physics/CharacterBody';

/**
 * A dog activity's life (Phase 4): AVAILABLE (waiting for its natural trigger) → STARTING (setting up: the human
 * fetching a treat, Moke settling in) → ACTIVE → SUCCESS or CANCELLED (a moment for feedback) → COOLDOWN →
 * READY_AGAIN → AVAILABLE. No menu starts them: they happen when Moke does the right thing in the right place.
 */
export const DOG_ACTIVITY_STATES = ['AVAILABLE', 'STARTING', 'ACTIVE', 'SUCCESS', 'CANCELLED', 'COOLDOWN', 'READY_AGAIN'] as const;
export type DogActivityState = (typeof DOG_ACTIVITY_STATES)[number];

export type DogActivityId = 'treatHunt' | 'perfectNap' | 'makeHumanPlay';

/** What every dog activity can see each fixed step (built by the director from the game). */
export interface DogActivityContext {
  readonly moke: {
    readonly position: Vec3Like;
    readonly speed: number;
    /** What's in his mouth (a prop id), or null. */
    readonly carrying: string | null;
    readonly barked: boolean;
    readonly trick: boolean;
    readonly sniffing: boolean;
    /** Lying down on a nap spot (its id), or null. */
    readonly napSpot: string | null;
  };
  readonly human: {
    readonly position: Vec3Like;
    /** Free for Moke (not in the Sock Heist, not busy with another dog activity). */
    readonly available: boolean;
    /** Can they see Moke right now? */
    readonly seesMoke: boolean;
    /** Giving Moke their attention (after barks, praise…). */
    readonly engaged: boolean;
  };
  /** The Sock Heist is going on (dog activities that need the human wait or step aside). */
  readonly heistRunning: boolean;
}

/**
 * Base class: the lifecycle and its timers. Subclasses decide when they want to start (`wants`), how they run
 * (`onUpdate`), and clean up when cancelled (`onCancel`).
 */
export abstract class DogActivity {
  abstract readonly id: DogActivityId;
  abstract readonly name: string;
  /** Uses the human (only one such activity at a time). */
  abstract readonly needsHuman: boolean;
  state: DogActivityState = 'AVAILABLE';
  stateTime = 0;
  /** How many times it's gone well. */
  successes = 0;

  constructor(
    /** Seconds before it can happen again after it ends. */
    protected readonly cooldown: number,
    /** How long SUCCESS / CANCELLED last (the feedback moment). */
    protected readonly settleTime = 2,
  ) {}

  /** A short line for the HUD while it runs, or null. */
  get objective(): string | null {
    return null;
  }

  get running(): boolean {
    return this.state === 'STARTING' || this.state === 'ACTIVE';
  }

  /** The natural trigger: should it start now? (Called only while AVAILABLE and allowed.) */
  protected abstract wants(ctx: DogActivityContext): boolean;
  /** Called on entering STARTING. */
  protected abstract onStart(ctx: DogActivityContext): void;
  /** Runs while STARTING or ACTIVE. */
  protected abstract onUpdate(dt: number, ctx: DogActivityContext): void;
  /** Stop and tidy up (put things back). */
  protected abstract onCancel(): void;
  /** Sees every step, whatever the state (to notice edges: lying down, dropping a toy…). */
  protected observe(_ctx: DogActivityContext): void {}

  /** Tries the trigger (the director says whether starting is allowed right now). */
  tryStart(ctx: DogActivityContext, allowed: boolean): boolean {
    if (this.state !== 'AVAILABLE' || !allowed || !this.wants(ctx)) return false;
    this.enter('STARTING');
    this.onStart(ctx);
    return true;
  }

  update(dt: number, ctx: DogActivityContext): void {
    this.stateTime += dt;
    this.observe(ctx);
    switch (this.state) {
      case 'STARTING':
      case 'ACTIVE':
        this.onUpdate(dt, ctx);
        break;
      case 'SUCCESS':
      case 'CANCELLED':
        if (this.stateTime >= this.settleTime) this.enter('COOLDOWN');
        break;
      case 'COOLDOWN':
        if (this.stateTime >= this.cooldown) this.enter('READY_AGAIN');
        break;
      case 'READY_AGAIN':
        this.enter('AVAILABLE');
        break;
      case 'AVAILABLE':
        break;
    }
  }

  /** Stops it wherever it is (the Sock Heist needs the human, a replay). */
  cancel(): void {
    if (!this.running) return;
    this.onCancel();
    this.enter('CANCELLED');
  }

  protected activate(): void {
    if (this.state === 'STARTING') this.enter('ACTIVE');
  }

  protected succeed(): void {
    if (!this.running) return;
    this.successes++;
    this.enter('SUCCESS');
  }

  protected enter(state: DogActivityState): void {
    this.state = state;
    this.stateTime = 0;
  }
}
