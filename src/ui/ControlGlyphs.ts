import { KEY_BINDINGS, type Action } from '../config/input';
import type { InputMode } from '../core/InputMode';
import { keyLabel } from '../core/InputState';

/** Standard-layout controller buttons, Xbox names (position makes other pads unambiguous). */
const PAD_BUTTONS: Readonly<Record<number, string>> = {
  0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 8: 'View', 9: 'Menu', 10: 'L3', 11: 'R3',
};

/**
 * The key or button that does `action` in this input mode: "E" on a keyboard, "A" on a controller. Null on
 * touch, where the on-screen button itself is the prompt. The one place that knows how actions are shown,
 * so gameplay never contains "Press E".
 */
export function actionGlyph(action: Action, mode: InputMode): string | null {
  if (mode === 'touch') return null;
  const bindings = KEY_BINDINGS[action];
  if (mode === 'gamepad') {
    const pad = bindings.find((b) => b.startsWith('Gamepad:Button'));
    if (pad) return PAD_BUTTONS[Number(pad.slice('Gamepad:Button'.length))] ?? '?';
  }
  const keyboard = bindings.find((b) => !b.includes(':'));
  return keyboard ? keyLabel(keyboard) : null;
}

/** A short reminder of the controls for this mode, shown briefly when play starts. */
export function controlsSummary(mode: InputMode): string {
  const g = (action: Action) => actionGlyph(action, mode) ?? '?';
  if (mode === 'touch') return 'Left thumb: move · Right thumb: look · Push the stick far to run';
  if (mode === 'gamepad') {
    return `Left stick move · Right stick look · ${g('interact')} interact · ${g('bark')} bark · ${g('trick')} trick · ${g('sniff')} sniff`;
  }
  return `WASD move · Mouse look · ${g('interact')} interact · Shift run · ${g('sniff')} sniff · ${g('bark')} bark · ${g('trick')} trick`;
}

/** First-play onboarding rows: [what to press, what it does]. Touch shows its own on-screen hints instead. */
export function onboardingRows(mode: Exclude<InputMode, 'touch'>): readonly (readonly [string, string])[] {
  const g = (action: Action) => actionGlyph(action, mode) ?? '?';
  if (mode === 'gamepad') {
    return [
      ['Left stick', 'Move'],
      ['Right stick', 'Look'],
      [g('interact'), 'Interact'],
      [g('run'), 'Run'],
      [g('sniff'), 'Sniff'],
      [g('bark'), 'Bark'],
    ];
  }
  return [
    ['WASD', 'Move'],
    ['Mouse', 'Look'],
    [g('interact'), 'Interact'],
    [g('run'), 'Run'],
    [g('sniff'), 'Sniff'],
    [g('bark'), 'Bark'],
  ];
}
