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
