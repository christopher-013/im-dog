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
  'trick',
  'sniff',
  'jump',
  'pause',
  'resume',
  'toggleDebug',
  'menuConfirm',
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * Bindings use KeyboardEvent.code, i.e. the physical key position (WASD still works on AZERTY).
 * The first key of each action is the one shown in the UI.
 * Gamepad buttons use the standard Gamepad API layout. Analog sticks and the D-pad feed the
 * movement/look axes directly; buttons still pass through the same action layer as the keyboard.
 * Touch buttons are virtual `Touch:…` keys (see core/TouchInput.ts); the touch joystick and camera drag
 * feed the movement/look axes, exactly like a controller.
 */
export const KEY_BINDINGS: Readonly<Record<Action, readonly string[]>> = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBackward: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  // Not Ctrl: Ctrl+W closes the browser tab. Not Alt: it focuses the browser menu on Windows.
  walk: ['KeyC', 'Gamepad:Button4', 'Gamepad:Button6'],
  // Touch: the Run toggle button, or the joystick pushed past its rim.
  run: ['ShiftLeft', 'ShiftRight', 'Gamepad:Button5', 'Gamepad:Button7', 'Touch:run', 'Touch:sprint'],
  interact: ['KeyE', 'Gamepad:Button0', 'Touch:interact'],
  // One button for his voice: a bark or a growl, at random (see player/Bark.ts).
  bark: ['KeyF', 'Gamepad:Button3', 'Touch:bark'],
  trick: ['KeyQ', 'Gamepad:Button2', 'Touch:trick'],
  // Right stick press: all four face buttons are taken.
  sniff: ['KeyR', 'Gamepad:Button11', 'Touch:sniff'],
  jump: ['Space', 'Gamepad:Button1', 'Touch:jump'],
  pause: ['Escape', 'Gamepad:Button9', 'Touch:pause'],
  // Controller-only: keyboard menus use the focused button (Enter/Space), and Esc can't resume (see MenuInput.ts).
  resume: ['Gamepad:Button9'],
  toggleDebug: ['Backquote', 'Gamepad:Button8'],
  menuConfirm: ['Gamepad:Button0'],
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

/** Touch controls (phones and tablets). Distances are CSS pixels. */
export const TOUCH = {
  /** A touch that starts in this left fraction of the screen drives the joystick; the rest looks around. */
  joystickZone: 0.42,
  /** How far the knob travels from where the thumb landed. */
  joystickRadius: 56,
  /** Joystick deadzone (fraction of the radius); the rest is rescaled to 0..1, like a controller stick. */
  deadzone: 0.14,
  /** Pushing the thumb this far past the rim (× radius) makes Moke run, with no second finger needed. */
  sprintBeyond: 1.35,
  /** Camera drag speed, in mouse-equivalent pixels per touch pixel (phone screens are small). */
  lookScale: 1.9,
  /** A single touch move larger than this (px) is clamped, like a mouse spike. */
  maxLookPerEvent: 90,
  /** Holding the paw button this long (s) pops out the other buttons (jump, bark, sniff, trick, run); a quicker tap interacts. */
  menuHoldTime: 0.3,
  /** Popped-out buttons tuck themselves back into the paw after this long unused (s). */
  menuIdleClose: 2.5,
} as const;

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
  { label: 'Jump (up onto the couch or coffee table)', input: ['jump'], ready: true },
  { label: 'Interact · pick up · drop · give · eat', input: ['interact'], ready: true },
  { label: 'Bark or growl (random)', input: ['bark'], ready: true },
  { label: 'Do a trick', input: ['trick'], ready: true },
  { label: 'Sniff', input: ['sniff'], ready: true },
  { label: 'Pause · free the mouse', input: ['pause'], ready: true },
  { label: 'Debug panel', input: ['toggleDebug'], ready: true },
];

/** What the Controls screen shows for touch play. */
export const TOUCH_CONTROL_HINTS: readonly GamepadControlHint[] = [
  { label: 'Move (trot)', input: 'Left thumb: drag anywhere on the left' },
  { label: 'Run', input: 'Push the stick past its ring, or RUN (hold the paw button)' },
  { label: 'Look around', input: 'Right thumb: drag anywhere on the right' },
  { label: 'Interact · pick up · drop · give · eat', input: 'Tap the paw button (it says what it will do)' },
  { label: 'Jump · bark or growl · sniff · trick · run', input: 'Hold the paw button: they pop out. Slide onto one and let go, or tap one.' },
  { label: 'Pause', input: 'II, top corner' },
];

/** Standard-layout controller labels (Xbox names first; position makes other pads unambiguous). */
export const GAMEPAD_CONTROL_HINTS: readonly GamepadControlHint[] = [
  { label: 'Move (trot)', input: 'Left stick / D-pad' },
  { label: 'Look around', input: 'Right stick' },
  { label: 'Interact · confirm', input: 'A / bottom button' },
  { label: 'Jump', input: 'B / right button' },
  { label: 'Do a trick', input: 'X / left button' },
  { label: 'Bark or growl (random)', input: 'Y / top button' },
  { label: 'Walk / sneak (hold)', input: 'LB / LT' },
  { label: 'Run (hold)', input: 'RB / RT' },
  { label: 'Sniff', input: 'Press the right stick' },
  { label: 'Pause / resume', input: 'Menu / Start' },
  { label: 'Debug panel', input: 'View / Back' },
];
