import { describe, expect, it } from 'vitest';
import { initialInputMode, InputModeTracker } from './InputMode';

describe('input mode', () => {
  it('starts phones and tablets on touch, and everything else (touchscreen laptops too) on keyboard', () => {
    expect(initialInputMode({ primaryPointerCoarse: true, maxTouchPoints: 5, forced: null })).toBe('touch');
    expect(initialInputMode({ primaryPointerCoarse: false, maxTouchPoints: 10, forced: null })).toBe('keyboard');
    expect(initialInputMode({ primaryPointerCoarse: false, maxTouchPoints: 0, forced: null })).toBe('keyboard');
  });

  it('can be forced for testing, and ignores nonsense', () => {
    expect(initialInputMode({ primaryPointerCoarse: false, maxTouchPoints: 0, forced: 'touch' })).toBe('touch');
    expect(initialInputMode({ primaryPointerCoarse: true, maxTouchPoints: 5, forced: 'banana' })).toBe('touch');
  });

  it('follows the device the player last used', () => {
    const modes = new InputModeTracker('keyboard');
    expect(modes.use('touch')).toBe(true);
    expect(modes.mode).toBe('touch');
    expect(modes.use('touch')).toBe(false);
    expect(modes.use('gamepad')).toBe(true);
    expect(modes.use('keyboard')).toBe(true);
  });

  it('stays put when forced', () => {
    const modes = new InputModeTracker('touch', true);
    expect(modes.use('keyboard')).toBe(false);
    expect(modes.mode).toBe('touch');
  });
});
