import { describe, expect, it } from 'vitest';
import { MOKE_ANIMATION } from '../config/animation';
import { MokeAnimationController } from './MokeAnimationController';
import { availableTricks, pickTrick, TRICKS } from './Tricks';

const DT = 1 / 60;
const OPEN = { carrying: false, headroom: Infinity };
const IDLE = { speed: 0, turnRate: 0, headroom: Infinity };

/** Deterministic "random" sequence. */
function sequence(...values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length] ?? 0;
}

describe('picking a trick', () => {
  it('can do every trick in the open', () => {
    expect(availableTricks(OPEN)).toEqual([...TRICKS]);
  });

  it("doesn't roll onto his back with something in his mouth, or stand up under the furniture", () => {
    expect(availableTricks({ carrying: true, headroom: Infinity })).not.toContain('bellyUp');
    expect(availableTricks({ carrying: false, headroom: 0.4 })).not.toContain('beg');
    expect(availableTricks({ carrying: false, headroom: 0.4 })).toContain('paw');
  });

  it('never does the same trick twice in a row', () => {
    const random = sequence(0, 0.99, 0.5, 0.2, 0.7, 0.1, 0.9);
    let last = pickTrick(random, null, OPEN);
    for (let i = 0; i < 30; i++) {
      const next = pickTrick(random, last, OPEN);
      expect(next).not.toBe(last);
      last = next;
    }
  });

  it('covers all of them over time', () => {
    const seen = new Set<string>();
    let last = null;
    for (let i = 0; i < 40; i++) {
      last = pickTrick(sequence(i / 40), last, OPEN);
      if (last) seen.add(last);
    }
    expect(seen.size).toBe(TRICKS.length);
  });
});

describe('doing a trick', () => {
  it('eases in, holds, eases out and ends on its own', () => {
    const anim = new MokeAnimationController();
    expect(anim.trick('paw')).toBe(true);
    expect(anim.trick('beg')).toBe(false); // one at a time
    let peak = 0;
    const steps = Math.ceil(MOKE_ANIMATION.tricks.paw / DT) + 2;
    for (let i = 0; i < steps; i++) {
      anim.update(DT, IDLE);
      peak = Math.max(peak, anim.state.trickBlend);
    }
    expect(peak).toBeGreaterThan(0.99);
    expect(anim.state.trick).toBeNull();
    expect(anim.state.trickBlend).toBe(0);
    expect(anim.trick('beg')).toBe(true);
  });

  it('is cut short quickly when he wants to go somewhere', () => {
    const anim = new MokeAnimationController();
    anim.trick('bellyUp');
    for (let i = 0; i < 40; i++) anim.update(DT, IDLE);
    expect(anim.holdsStillForTrick).toBe(true);
    anim.cancelTrick();
    expect(anim.holdsStillForTrick).toBe(false); // he can move off straight away
    for (let t = 0; t <= MOKE_ANIMATION.tricks.cancelOut + DT; t += DT) anim.update(DT, IDLE);
    expect(anim.performingTrick).toBe(false);
  });
});
