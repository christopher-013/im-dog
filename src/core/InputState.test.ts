import { describe, expect, it } from 'vitest';
import { KEY_BINDINGS } from '../config/input';
import { codeFromKey, InputState, keyLabel } from './InputState';

const frame = (input: InputState) => input.beginFrame();

describe('InputState', () => {
  it('reports a press for exactly one frame, and holds while the key is down', () => {
    const input = new InputState(KEY_BINDINGS);
    input.keyDown('KeyF');
    frame(input);
    expect(input.wasPressed('bark')).toBe(true);
    expect(input.isDown('bark')).toBe(true);
    frame(input);
    expect(input.wasPressed('bark')).toBe(false);
    expect(input.isDown('bark')).toBe(true);
  });

  it('never misses a tap that starts and ends within one frame', () => {
    const input = new InputState(KEY_BINDINGS);
    input.keyDown('KeyE');
    input.keyUp('KeyE');
    frame(input);
    expect(input.wasPressed('interact')).toBe(true);
    expect(input.wasReleased('interact')).toBe(true);
    expect(input.isDown('interact')).toBe(false);
  });

  it('ignores OS key auto-repeat', () => {
    const input = new InputState(KEY_BINDINGS);
    input.keyDown('KeyQ');
    frame(input);
    input.keyDown('KeyQ');
    frame(input);
    expect(input.wasPressed('sniff')).toBe(false);
  });

  it('keeps an action held while any of its keys is down', () => {
    const input = new InputState(KEY_BINDINGS);
    input.keyDown('ShiftLeft');
    input.keyDown('ShiftRight');
    input.keyUp('ShiftLeft');
    frame(input);
    expect(input.isDown('run')).toBe(true);
    expect(input.wasReleased('run')).toBe(false);
    input.keyUp('ShiftRight');
    frame(input);
    expect(input.isDown('run')).toBe(false);
    expect(input.wasReleased('run')).toBe(true);
  });

  it('reports whether a key is bound, and ignores unbound keys', () => {
    const input = new InputState(KEY_BINDINGS);
    expect(input.keyDown('KeyZ')).toBe(false);
    expect(input.keyDown('KeyW')).toBe(true);
    expect(input.heldActions()).toEqual(['moveForward']);
  });

  it('normalizes diagonal movement so it is not faster than straight movement', () => {
    const input = new InputState(KEY_BINDINGS);
    input.keyDown('KeyW');
    input.keyDown('KeyD');
    const move = input.getMoveAxis({ x: 0, y: 0 });
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1);
    expect(move.x).toBeCloseTo(Math.SQRT1_2);
    expect(move.y).toBeCloseTo(Math.SQRT1_2);
  });

  it('cancels opposite directions', () => {
    const input = new InputState(KEY_BINDINGS);
    input.keyDown('KeyA');
    input.keyDown('KeyD');
    input.keyDown('KeyW');
    expect(input.getMoveAxis({ x: 9, y: 9 })).toEqual({ x: 0, y: 1 });
  });

  it('combines analog and keyboard movement and normalizes the result', () => {
    const input = new InputState(KEY_BINDINGS);
    input.setAnalogMove(0.5, 0.5);
    expect(input.getMoveAxis({ x: 0, y: 0 })).toEqual({ x: 0.5, y: 0.5 });
    input.keyDown('KeyD');
    const move = input.getMoveAxis({ x: 0, y: 0 });
    expect(Math.hypot(move.x, move.y)).toBeCloseTo(1);
    expect(move.x).toBeGreaterThan(move.y);
  });

  it('reports an analog movement start only when the axis leaves rest', () => {
    const input = new InputState(KEY_BINDINGS);
    input.setAnalogMove(0.4, 0);
    frame(input);
    expect(input.wasMoveStarted()).toBe(true);
    input.setAnalogMove(0.6, 0);
    frame(input);
    expect(input.wasMoveStarted()).toBe(false);
    input.setAnalogMove(0, 0);
    input.setAnalogMove(0, 0.4);
    frame(input);
    expect(input.wasMoveStarted()).toBe(true);
  });

  it('accumulates mouse movement per frame', () => {
    const input = new InputState(KEY_BINDINGS);
    input.addLook(3, -2);
    input.addLook(4, 1);
    frame(input);
    expect(input.getLookDelta({ x: 0, y: 0 })).toEqual({ x: 7, y: -1 });
    frame(input);
    expect(input.getLookDelta({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });

  it('accumulates wheel zoom per frame', () => {
    const input = new InputState(KEY_BINDINGS);
    input.addZoom(1);
    input.addZoom(0.5);
    frame(input);
    expect(input.getZoomDelta()).toBe(1.5);
    frame(input);
    expect(input.getZoomDelta()).toBe(0);
  });

  it('releaseAll lets go of every key (e.g. on window blur)', () => {
    const input = new InputState(KEY_BINDINGS);
    input.keyDown('KeyW');
    input.keyDown('ShiftLeft');
    input.addLook(50, 50);
    input.releaseAll();
    frame(input);
    expect(input.isDown('moveForward')).toBe(false);
    expect(input.isDown('run')).toBe(false);
    expect(input.getLookDelta({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
  });
});

describe('keyLabel', () => {
  it('turns KeyboardEvent codes into readable labels', () => {
    expect(keyLabel('KeyW')).toBe('W');
    expect(keyLabel('Digit1')).toBe('1');
    expect(keyLabel('ShiftLeft')).toBe('Shift');
    expect(keyLabel('Backquote')).toBe('`');
    expect(keyLabel('Escape')).toBe('Esc');
    expect(keyLabel('F13')).toBe('F13');
  });
});

describe('codeFromKey', () => {
  it('recovers a code when KeyboardEvent.code is empty', () => {
    expect(codeFromKey('w')).toBe('KeyW');
    expect(codeFromKey('W')).toBe('KeyW');
    expect(codeFromKey('7')).toBe('Digit7');
    expect(codeFromKey('`')).toBe('Backquote');
    expect(codeFromKey(' ')).toBe('Space');
    expect(codeFromKey('Shift')).toBe('ShiftLeft');
    expect(codeFromKey('Dead')).toBe('');
  });
});
