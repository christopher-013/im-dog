import type { GameEvents } from '../core/GameEvents';
import type { DogLogicMemory } from '../heist/DogLogic';
import type { DogActivity, DogActivityContext } from './DogActivity';

/**
 * Runs the dog activities side by side (Phase 4). Only one at a time may borrow the human, and none that need them
 * while the Sock Heist does (the heist cancels any that are setting up). Activities start themselves when Moke does
 * the right thing; there's no menu.
 */
export class DogActivityDirector {
  constructor(readonly activities: readonly DogActivity[]) {}

  update(dt: number, ctx: DogActivityContext): void {
    // Sock Heist owns the human from the moment the sock is stolen.  A hunt that has already reached its
    // independent "find it" step no longer has a live HumanRole for HumanActivityController.interrupt() to
    // cancel, so enforce the priority here as well.  This keeps a hidden hunt treat from remaining active beside
    // the heist treat and gives every human-dependent activity the same interruption rule.
    if (ctx.heistRunning) {
      for (const activity of this.activities) {
        if (activity.needsHuman && activity.running) activity.cancel();
      }
    }
    for (const activity of this.activities) activity.update(dt, ctx);
    let humanBusy = this.activities.some((a) => a.needsHuman && a.running);
    for (const activity of this.activities) {
      if (activity.state !== 'AVAILABLE') continue;
      const allowed = activity.needsHuman ? !humanBusy && !ctx.heistRunning && ctx.human.available : true;
      if (activity.tryStart(ctx, allowed) && activity.needsHuman) humanBusy = true;
    }
  }

  /** The line for the HUD from whichever activity has one. */
  get objective(): string | null {
    for (const activity of this.activities) {
      const text = activity.running ? activity.objective : null;
      if (text) return text;
    }
    return null;
  }

  /** A replay or the heist taking over: call off anything in progress. */
  cancelAll(): void {
    for (const activity of this.activities) activity.cancel();
  }

  find<T extends DogActivity>(id: T['id']): T | undefined {
    return this.activities.find((a) => a.id === id) as T | undefined;
  }
}

/**
 * Records Dog Logic discoveries and announces them (the card). Some are shown every time they're re-earned
 * ("Still true. Moke checked."), others only once a session (things he'd otherwise keep "discovering").
 */
export class DogLogicBook {
  private readonly shownThisSession = new Set<string>();

  constructor(
    private readonly memory: DogLogicMemory,
    private readonly events: GameEvents,
  ) {}

  knows(id: string): boolean {
    return this.memory.has(id);
  }

  /** Learns `id` and shows it (unless `oncePerSession` and it was shown already). Returns true if brand new. */
  discover(id: string, oncePerSession = false): boolean {
    const first = this.memory.learn(id);
    if (oncePerSession && this.shownThisSession.has(id) && !first) return false;
    this.shownThisSession.add(id);
    this.events.emit('DOG_LOGIC_DISCOVERED', { id, first });
    return first;
  }
}
