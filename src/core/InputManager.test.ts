import { describe, expect, it } from 'vitest';
import { typingInto } from './InputManager';

describe('typingInto (keys typed into a form are words, not actions)', () => {
  it('knows text fields: textareas, text-type inputs, editable content', () => {
    expect(typingInto({ tagName: 'TEXTAREA' } as unknown as EventTarget)).toBe(true);
    for (const type of ['text', 'email', 'search', 'number']) expect(typingInto({ tagName: 'INPUT', type } as unknown as EventTarget), type).toBe(true);
    expect(typingInto({ tagName: 'DIV', isContentEditable: true } as unknown as EventTarget)).toBe(true);
  });

  it('lets everything else through to the game: the page, buttons, checkboxes, sliders', () => {
    expect(typingInto(null)).toBe(false);
    expect(typingInto({} as EventTarget)).toBe(false);
    expect(typingInto({ tagName: 'BUTTON' } as unknown as EventTarget)).toBe(false);
    expect(typingInto({ tagName: 'CANVAS' } as unknown as EventTarget)).toBe(false);
    for (const type of ['checkbox', 'range', 'radio']) expect(typingInto({ tagName: 'INPUT', type } as unknown as EventTarget), type).toBe(false);
  });
});
