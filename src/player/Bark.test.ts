import { describe, expect, it } from 'vitest';
import { BarkTimer, barkOrGrowl } from './Bark';

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

describe('the bark button', () => {
  it('barks or growls at random', () => {
    expect(barkOrGrowl(() => 0.2, 0.5)).toBe('growl');
    expect(barkOrGrowl(() => 0.7, 0.5)).toBe('bark');
    let growls = 0;
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1000; i++) if (barkOrGrowl(random) === 'growl') growls++;
    expect(growls).toBeGreaterThan(400);
    expect(growls).toBeLessThan(600);
  });
});
