/** Which kind of controls the player is using right now: drives prompts, hints and the on-screen touch controls. */
export type InputMode = 'keyboard' | 'touch' | 'gamepad';

export const INPUT_MODES: readonly InputMode[] = ['keyboard', 'touch', 'gamepad'];

/** What the browser can tell us about the device (capabilities, not the user-agent string). */
export interface InputEnvironment {
  /** `(pointer: coarse)`: the primary pointer is a finger. */
  readonly primaryPointerCoarse: boolean;
  /** `navigator.maxTouchPoints`. */
  readonly maxTouchPoints: number;
  /** `?input=touch|keyboard|gamepad`, for testing a layout on any device. Anything else is ignored. */
  readonly forced: string | null;
}

export function isInputMode(value: string | null): value is InputMode {
  return value !== null && (INPUT_MODES as readonly string[]).includes(value);
}

/**
 * The mode to start in. Phones and tablets (a finger is the primary pointer) start with touch controls;
 * everything else, including touchscreen laptops, starts with keyboard and mouse. Either switches as soon as
 * the player actually uses the other (see InputModeTracker).
 */
export function initialInputMode(env: InputEnvironment): InputMode {
  if (isInputMode(env.forced)) return env.forced;
  return env.primaryPointerCoarse && env.maxTouchPoints > 0 ? 'touch' : 'keyboard';
}

/** Follows the device the player last used. A forced mode (`?input=`) never changes. */
export class InputModeTracker {
  constructor(
    private current: InputMode,
    private readonly locked = false,
  ) {}

  get mode(): InputMode {
    return this.current;
  }

  /** Reports that `device` was just used. Returns true if that changed the mode. */
  use(device: InputMode): boolean {
    if (this.locked || device === this.current) return false;
    this.current = device;
    return true;
  }
}
