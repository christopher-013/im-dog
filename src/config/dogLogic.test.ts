import { describe, expect, it } from 'vitest';
import html from '../../index.html?raw';
import { DOG_LOGIC } from './dogLogic';

describe('Dog Logic entries', () => {
  it('have unique ids, and every icon they use is drawn in index.html', () => {
    expect(new Set(DOG_LOGIC.map((e) => e.id)).size).toBe(DOG_LOGIC.length);
    for (const entry of DOG_LOGIC) {
      for (const term of [...entry.left, entry.right]) expect(html, `${entry.id}: #icon-${term.icon}`).toContain(`<symbol id="icon-${term.icon}"`);
    }
  });

  it('include Malibu, Moke\'s bird friend', () => {
    const malibu = DOG_LOGIC.find((e) => e.id === 'malibu=friend');
    expect(malibu?.left[0]?.word).toBe('MALIBU');
    expect(malibu?.right.word).toBe('FRIEND');
  });
});
