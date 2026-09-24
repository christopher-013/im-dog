/** Everything the player can do. Gameplay code reads actions, never raw keys. */
export const ACTIONS = [
  'moveForward',
  'moveBackward',
  'moveLeft',
  'moveRight',
  'walk',
  'run',
  'interact',
  'bark',
  'growl',
  'sniff',
  'jump',
  'pause',
  'toggleDebug',
  'menuConfirm',
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * Bindings use KeyboardEvent.code, i.e. the physical key position (WASD still works on AZERTY).
 * The first key of each action is the one shown in the UI.
 * Gamepad buttons use the standard Gamepad API layout. Analog sticks and the D-pad feed the
 * movement/look axes directly; buttons still pass through the same action layer as the keyboard.
 */
export const KEY_BINDINGS: Readonly<Record<Action, readonly string[]>> = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBackward: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  // Not Ctrl: Ctrl+W closes the browser tab. Not Alt: it focuses the browser menu on Windows.
  walk: ['KeyC', 'Gamepad:Button4', 'Gamepad:Button6'],
  run: ['ShiftLeft', 'ShiftRight', 'Gamepad:Button5', 'Gamepad:Button7'],
  interact: ['KeyE', 'Gamepad:Button0'],
  bark: ['KeyF', 'Gamepad:Button1'],
  growl: ['KeyG', 'Gamepad:Button3'],
  sniff: ['KeyQ', 'Gamepad:Button2'],
  jump: ['Space'],
  pause: ['Escape', 'Gamepad:Button9'],
  toggleDebug: ['Backquote', 'Gamepad:Button8'],
  menuConfirm: ['Enter', 'Space', 'Gamepad:Button0'],
};

export interface GamepadSettings {
  /** Radial stick deadzone, after which the remaining range is rescaled to 0..1. */
  deadzone: number;
  /** Camera contribution at full right-stick tilt, expressed as mouse-equivalent px/s. */
  lookPixelsPerSecond: number;
  /** Analog/trigger value considered pressed. */
  buttonThreshold: number;
}

export const GAMEPAD: GamepadSettings = {
  deadzone: 0.18,
  lookPixelsPerSecond: 720,
  buttonThreshold: 0.5,
};

export interface MouseSettings {
  /** Radians of camera rotation per pixel of mouse movement, at 1× scale. */
  sensitivity: number;
  /** Player's multiplier from the pause-menu slider. */
  sensitivityScale: number;
  invertY: boolean;
  /** Single mouse events larger than this (px) are clamped; some browsers spike when pointer lock engages. */
  maxDeltaPerEvent: number;
}

/** Mutable so a future settings screen can change it at runtime. */
export const MOUSE: MouseSettings = {
  sensitivity: 0.0024,
  sensitivityScale: 1,
  invertY: false,
  maxDeltaPerEvent: 250,
};

export interface ControlHint {
  label: string;
  /** Actions whose first key is shown, or a device name. */
  input: readonly Action[] | 'Mouse' | 'Wheel';
  /** False until the milestone that implements it lands; the UI marks it "soon". */
  ready: boolean;
}

export interface GamepadControlHint {
  label: string;
  input: string;
}

/** What the Controls screen shows. Flip `ready` as each milestone lands. */
export const CONTROL_HINTS: readonly ControlHint[] = [
  { label: 'Move (trot)', input: ['moveForward', 'moveLeft', 'moveBackward', 'moveRight'], ready: true },
  { label: 'Look around', input: 'Mouse', ready: true },
  { label: 'Zoom camera', input: 'Wheel', ready: true },
  { label: 'Run (hold)', input: ['run'], ready: true },
  { label: 'Walk / sneak (hold)', input: ['walk'], ready: true },
  { label: 'Interact · pick up · drop', input: ['interact'], ready: true },
  { label: 'Bark', input: ['bark'], ready: true },
  { label: 'Cute growl', input: ['growl'], ready: true },
  { label: 'Sniff', input: ['sniff'], ready: true },
  { label: 'Pause · free the mouse', input: ['pause'], ready: true },
  { label: 'Debug panel', input: ['toggleDebug'], ready: true },
];

/** Standard-layout controller labels (Xbox names first; position makes other pads unambiguous). */
export const GAMEPAD_CONTROL_HINTS: readonly GamepadControlHint[] = [
  { label: 'Move (trot)', input: 'Left stick / D-pad' },
  { label: 'Look around', input: 'Right stick' },
  { label: 'Interact · confirm', input: 'A / bottom button' },
  { label: 'Bark', input: 'B / right button' },
  { label: 'Sniff', input: 'X / left button' },
  { label: 'Cute growl', input: 'Y / top button' },
  { label: 'Walk / sneak (hold)', input: 'LB / LT' },
  { label: 'Run (hold)', input: 'RB / RT' },
  { label: 'Pause / resume', input: 'Menu / Start' },
  { label: 'Debug panel', input: 'View / Back' },
];
