import { describe, expect, it } from 'vitest';
import { GAMEPAD, KEY_BINDINGS } from '../config/input';
import { GamepadInput, applyStickDeadzone, type GamepadLike } from './GamepadInput';
import { InputState } from './InputState';

const pad = (axes: readonly number[] = [0, 0, 0, 0], down: readonly number[] = []): GamepadLike => ({
  connected: true,
  id: 'Test USB Controller',
  index: 0,
  mapping: 'standard',
  axes,
  buttons: Array.from({ length: 16 }, (_, index) => ({
    pressed: down.includes(index),
    value: down.includes(index) ? 1 : 0,
  })),
});

describe('applyStickDeadzone', () => {
  it('removes drift and rescales the usable range', () => {
    expect(applyStickDeadzone(GAMEPAD.deadzone / 2, 0)).toEqual({ x: 0, y: 0 });
    expect(applyStickDeadzone(1, 0)).toEqual({ x: 1, y: 0 });
    expect(applyStickDeadzone(0.5, 0).x).toBeCloseTo((0.5 - GAMEPAD.deadzone) / (1 - GAMEPAD.deadzone));
  });
});

describe('GamepadInput', () => {
  it('detects a controller and maps the left stick and D-pad to movement', () => {
    const input = new InputState(KEY_BINDINGS);
    const gamepad = new GamepadInput();
    gamepad.update([pad([0.5, -0.5, 0, 0], [15])], input, 1 / 60);
    expect(gamepad.connected).toBe(true);
    expect(gamepad.name).toBe('Test USB Controller');
    const move = input.getMoveAxis({ x: 0, y: 0 });
    expect(move.x).toBeGreaterThan(0);
    expect(move.y).toBeGreaterThan(0);
    expect(Math.hypot(move.x, move.y)).toBeLessThanOrEqual(1);
  });

  it('maps standard face and shoulder buttons through action bindings', () => {
    const input = new InputState(KEY_BINDINGS);
    const gamepad = new GamepadInput();
    gamepad.update([pad(undefined, [0, 1, 2, 3, 5, 6, 7, 9, 11])], input, 1 / 60);
    input.beginFrame();
    expect(input.wasPressed('interact')).toBe(true);
    expect(input.wasPressed('menuConfirm')).toBe(true);
    expect(input.isDown('bark')).toBe(true);
    expect(input.isDown('trick')).toBe(true);
    expect(input.isDown('sniff')).toBe(true); // right stick press
    expect(input.isDown('growl')).toBe(true);
    expect(input.isDown('walk')).toBe(true);
    expect(input.isDown('run')).toBe(true);
    expect(input.wasPressed('pause')).toBe(true);
  });

  it('turns the right stick into frame-rate-independent look deltas', () => {
    const input = new InputState(KEY_BINDINGS);
    const gamepad = new GamepadInput();
    gamepad.update([pad([0, 0, 1, -1])], input, 0.25);
    input.beginFrame();
    const look = input.getLookDelta({ x: 0, y: 0 });
    expect(look.x).toBeGreaterThan(0);
    expect(look.y).toBeLessThan(0);
    expect(Math.hypot(look.x, look.y)).toBeLessThanOrEqual(GAMEPAD.lookPixelsPerSecond * 0.25 + 0.001);
  });

  it('releases held controls when the controller disconnects', () => {
    const input = new InputState(KEY_BINDINGS);
    const gamepad = new GamepadInput();
    gamepad.update([pad([1, 0, 0, 0], [5])], input, 1 / 60);
    expect(input.isDown('run')).toBe(true);
    gamepad.update([], input, 1 / 60);
    expect(gamepad.connected).toBe(false);
    expect(input.isDown('run')).toBe(false);
    expect(input.getMoveAxis({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});
