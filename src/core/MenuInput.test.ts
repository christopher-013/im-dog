import { describe, expect, it } from 'vitest';
import { KEY_BINDINGS, type Action } from '../config/input';
import { InputState } from './InputState';
import { menuCommand, type MenuState } from './MenuInput';

/** Presses keys for one frame and asks what they mean on the given screen. */
function commandFor(state: MenuState, keys: string[], controlsOpen = false) {
  const input = new InputState(KEY_BINDINGS);
  for (const key of keys) input.keyDown(key);
  input.beginFrame();
  return menuCommand(state, (action: Action) => input.wasPressed(action), controlsOpen);
}

describe('menu input', () => {
  it("leaves keyboard menus to the focused button: Enter and Space don't start or resume the game", () => {
    for (const key of ['Enter', 'Space']) {
      expect(commandFor('menu', [key])).toBeNull();
      expect(commandFor('paused', [key])).toBeNull();
    }
  });

  it("pauses on Esc, but Esc never resumes (it closes dialogs, and releases the mouse)", () => {
    expect(commandFor('playing', ['Escape'])).toBe('pause');
    expect(commandFor('paused', ['Escape'])).toBeNull();
    expect(commandFor('paused', ['Escape'], true)).toBeNull();
  });

  it('lets a controller start, pause and resume: A and Start', () => {
    expect(commandFor('menu', ['Gamepad:Button0'])).toBe('play');
    expect(commandFor('playing', ['Gamepad:Button9'])).toBe('pause');
    expect(commandFor('paused', ['Gamepad:Button9'])).toBe('resume');
    expect(commandFor('paused', ['Gamepad:Button0'])).toBe('resume');
  });

  it('closes the Controls dialog with A or Start instead of starting or resuming behind it', () => {
    expect(commandFor('menu', ['Gamepad:Button0'], true)).toBe('closeControls');
    expect(commandFor('paused', ['Gamepad:Button9'], true)).toBe('closeControls');
  });

  it('ignores everything while loading', () => {
    expect(commandFor('loading', ['Gamepad:Button0', 'Gamepad:Button9', 'Escape'])).toBeNull();
  });
});

describe('menu input on Choose Your Dog', () => {
  it('moves between the dogs with the arrow keys or A/D, the D-pad, and the shoulder buttons', () => {
    for (const key of ['ArrowLeft', 'KeyA', 'Gamepad:Button14', 'Gamepad:Button4']) expect(commandFor('select', [key]), key).toBe('prevDog');
    for (const key of ['ArrowRight', 'KeyD', 'Gamepad:Button15', 'Gamepad:Button5']) expect(commandFor('select', [key]), key).toBe('nextDog');
  });

  it('begins with A or Start on a controller; on a keyboard the focused BEGIN button answers Enter and Space', () => {
    expect(commandFor('select', ['Gamepad:Button0'])).toBe('begin');
    expect(commandFor('select', ['Gamepad:Button9'])).toBe('begin');
    for (const key of ['Enter', 'Space']) expect(commandFor('select', [key])).toBeNull();
  });

  it('goes back to the title with Esc or B, and back wins over anything pressed with it', () => {
    expect(commandFor('select', ['Escape'])).toBe('back');
    expect(commandFor('select', ['Gamepad:Button1'])).toBe('back');
    expect(commandFor('select', ['Gamepad:Button1', 'Gamepad:Button0'])).toBe('back');
  });

  it('only on that screen: the title still opens it with A, and the arrows mean nothing elsewhere', () => {
    expect(commandFor('menu', ['Gamepad:Button0'])).toBe('play');
    expect(commandFor('menu', ['ArrowRight'])).toBeNull();
    expect(commandFor('paused', ['Gamepad:Button5'])).toBeNull();
    expect(commandFor('playing', ['Gamepad:Button1'])).toBeNull();
  });
});
