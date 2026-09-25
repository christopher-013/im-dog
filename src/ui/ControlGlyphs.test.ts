import { describe, expect, it } from 'vitest';
import { actionGlyph, controlsSummary, onboardingRows } from './ControlGlyphs';

describe('input-aware control labels', () => {
  it('shows the key on a keyboard, the button on a controller, and nothing on touch', () => {
    expect(actionGlyph('interact', 'keyboard')).toBe('E');
    expect(actionGlyph('interact', 'gamepad')).toBe('A');
    expect(actionGlyph('interact', 'touch')).toBeNull();
    expect(actionGlyph('run', 'keyboard')).toBe('Shift');
    expect(actionGlyph('run', 'gamepad')).toBe('RB');
    expect(actionGlyph('sniff', 'gamepad')).toBe('R3');
  });

  it('never tells a touch player to press a key', () => {
    const touch = controlsSummary('touch');
    expect(touch).not.toMatch(/\b(press|WASD|Shift|E)\b/);
    expect(touch).toMatch(/thumb/i);
    expect(controlsSummary('keyboard')).toMatch(/E interact/);
    expect(controlsSummary('gamepad')).toMatch(/A interact/);
  });

  it('builds the first-play rows from the real bindings (sniff is R, not Q)', () => {
    const rows = Object.fromEntries(onboardingRows('keyboard').map(([key, label]) => [label, key]));
    expect(rows).toMatchObject({ Move: 'WASD', Look: 'Mouse', Interact: 'E', Run: 'Shift', Sniff: 'R', Bark: 'F' });
  });
});
