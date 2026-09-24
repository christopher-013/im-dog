import { describe, expect, it } from 'vitest';
import { BarkTimer } from './Bark';

describe('BarkTimer', () => {
  it('barks, then waits out the cooldown before barking again', () => {
    const bark = new BarkTimer(0.3);
    expect(bark.tryBark()).toBe(true);
    expect(bark.tryBark()).toBe(false);
    bark.update(0.2);
    expect(bark.tryBark()).toBe(false);
    bark.update(0.11);
    expect(bark.tryBark()).toBe(true);
    expect(bark.count).toBe(2);
  });
});
