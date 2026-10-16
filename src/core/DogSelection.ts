import type { DogId } from '../config/dogs';

/**
 * Which dog is highlighted on the Choose Your Dog screen: left and right wrap round, and picking one directly
 * (a click or tap on it) highlights it. Pure state, so the screen, the input and the tests share it.
 */
export class DogSelection {
  private index: number;

  constructor(
    readonly dogs: readonly DogId[],
    initial: DogId,
  ) {
    if (dogs.length === 0) throw new Error('DogSelection: no dogs');
    this.index = Math.max(0, dogs.indexOf(initial));
  }

  get current(): DogId {
    return this.dogs[this.index]!;
  }

  get position(): number {
    return this.index;
  }

  /** Moves the highlight; returns true if it changed. */
  next(): boolean {
    return this.select((this.index + 1) % this.dogs.length);
  }

  prev(): boolean {
    return this.select((this.index - 1 + this.dogs.length) % this.dogs.length);
  }

  /** Highlights the dog at `index` (a click or tap on it). Returns true if it changed. */
  select(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= this.dogs.length || index === this.index) return false;
    this.index = index;
    return true;
  }
}

/** A finished drag on the dogs: −1 (swiped right: the previous dog), 1 (swiped left: the next), or 0 (not a swipe). */
export function swipeStep(dx: number, dy: number, min: number): -1 | 0 | 1 {
  if (Math.abs(dx) < min || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}
