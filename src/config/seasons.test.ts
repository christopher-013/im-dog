import { describe, expect, it } from 'vitest';
import { halloweenOn, isHalloweenDate } from './seasons';

describe('Halloween by the calendar (D30)', () => {
  it('is on from 17 October to 1 November, both included, any year', () => {
    expect(isHalloweenDate(new Date(2026, 9, 16, 23, 59))).toBe(false);
    expect(isHalloweenDate(new Date(2026, 9, 17, 0, 0))).toBe(true);
    expect(isHalloweenDate(new Date(2026, 9, 31, 20))).toBe(true);
    expect(isHalloweenDate(new Date(2027, 10, 1, 23, 59))).toBe(true);
    expect(isHalloweenDate(new Date(2027, 10, 2, 0, 0))).toBe(false);
    expect(isHalloweenDate(new Date(2026, 6, 4))).toBe(false);
  });

  it('follows the setting: auto by the date, or always on, or always off', () => {
    const july = new Date(2026, 6, 4), halloween = new Date(2026, 9, 31);
    expect(halloweenOn('auto', july)).toBe(false);
    expect(halloweenOn('auto', halloween)).toBe(true);
    expect(halloweenOn('on', july)).toBe(true);
    expect(halloweenOn('off', halloween)).toBe(false);
  });
});
