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
  'sniff',
  'jump',
  'pause',
  'toggleDebug',
] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * Bindings use KeyboardEvent.code, i.e. the physical key position (WASD still works on AZERTY).
 * The first key of each action is the one shown in the UI.
 * Gamepad support later: add button ids here (e.g. 'Gamepad:A') and a gamepad source that feeds InputState.
 */
export const KEY_BINDINGS: Readonly<Record<Action, readonly string[]>> = {
  moveForward: ['KeyW', 'ArrowUp'],
  moveBackward: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  // Not Ctrl: Ctrl+W closes the browser tab. Not Alt: it focuses the browser menu on Windows.
  walk: ['KeyC'],
  run: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  bark: ['KeyF'],
  sniff: ['KeyQ'],
  jump: ['Space'],
  pause: ['Escape'],
  toggleDebug: ['Backquote'],
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

/** What the Controls screen shows. Flip `ready` as each milestone lands. */
export const CONTROL_HINTS: readonly ControlHint[] = [
  { label: 'Move (trot)', input: ['moveForward', 'moveLeft', 'moveBackward', 'moveRight'], ready: true },
  { label: 'Look around', input: 'Mouse', ready: true },
  { label: 'Zoom camera', input: 'Wheel', ready: true },
  { label: 'Run (hold)', input: ['run'], ready: true },
  { label: 'Walk / sneak (hold)', input: ['walk'], ready: true },
  { label: 'Interact · pick up · drop', input: ['interact'], ready: false },
  { label: 'Bark', input: ['bark'], ready: false },
  { label: 'Sniff', input: ['sniff'], ready: false },
  { label: 'Pause · free the mouse', input: ['pause'], ready: true },
  { label: 'Debug panel', input: ['toggleDebug'], ready: true },
];
