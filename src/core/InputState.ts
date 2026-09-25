import type { Action } from '../config/input';

export interface Vec2Like {
  x: number;
  y: number;
}

/** Analog movement sources that can be in use at the same time (a controller stick and the touch joystick). */
export type AnalogSource = 'gamepad' | 'touch';

/**
 * DOM-free input state. Keyboard, mouse, gamepad and touch sources feed it raw key ids (touch buttons are
 * virtual `Touch:…` keys), analog movement and look deltas; gameplay reads actions and device-independent axes.
 *
 * Call beginFrame() once per rendered frame. Press/release edges and the look delta then hold
 * for that whole frame, so a quick tap is never missed and never counted twice, however many
 * fixed simulation steps the frame runs.
 */
export class InputState {
  private readonly actionsByKey = new Map<string, Action[]>();
  private readonly keysDown = new Set<string>();
  /** How many held keys currently drive each action (two Shift keys, W + ArrowUp, ...). */
  private readonly heldCount = new Map<Action, number>();

  private pendingPressed = new Set<Action>();
  private framePressed = new Set<Action>();
  private pendingReleased = new Set<Action>();
  private frameReleased = new Set<Action>();

  private pendingLookX = 0;
  private pendingLookY = 0;
  private lookX = 0;
  private lookY = 0;
  private pendingZoom = 0;
  private zoom = 0;
  private readonly analog: Record<AnalogSource, Vec2Like> = { gamepad: { x: 0, y: 0 }, touch: { x: 0, y: 0 } };
  private pendingMoveStarted = false;
  private frameMoveStarted = false;

  constructor(bindings: Readonly<Record<Action, readonly string[]>>) {
    for (const [action, keys] of Object.entries(bindings) as [Action, readonly string[]][]) {
      for (const key of keys) {
        const actions = this.actionsByKey.get(key) ?? [];
        actions.push(action);
        this.actionsByKey.set(key, actions);
      }
    }
  }

  /** Returns true if the key is bound to something (so the caller can suppress browser defaults). */
  keyDown(key: string): boolean {
    return this.hold(key, true);
  }

  /**
   * Marks a key held again without counting a new press: for a controller button that's still held after
   * releaseAll() (pause, focus loss). Keyboards get this for free from OS key repeat; controllers don't.
   */
  keyHeld(key: string): void {
    this.hold(key, false);
  }

  isKeyDown(key: string): boolean {
    return this.keysDown.has(key);
  }

  private hold(key: string, isPress: boolean): boolean {
    const actions = this.actionsByKey.get(key);
    if (!actions) return false;
    if (this.keysDown.has(key)) return true; // OS auto-repeat
    this.keysDown.add(key);
    for (const action of actions) {
      const count = this.heldCount.get(action) ?? 0;
      this.heldCount.set(action, count + 1);
      if (count === 0 && isPress) this.pendingPressed.add(action);
    }
    return true;
  }

  keyUp(key: string): void {
    if (!this.keysDown.delete(key)) return;
    for (const action of this.actionsByKey.get(key) ?? []) {
      const count = (this.heldCount.get(action) ?? 1) - 1;
      if (count > 0) {
        this.heldCount.set(action, count);
      } else {
        this.heldCount.delete(action);
        this.pendingReleased.add(action);
      }
    }
  }

  addLook(dx: number, dy: number): void {
    this.pendingLookX += dx;
    this.pendingLookY += dy;
  }

  /** Sets one source's analog movement axis (x = right, y = forward). Sources add up, like keys do. */
  setAnalogMove(x: number, y: number, source: AnalogSource = 'gamepad'): void {
    const axis = this.analog[source];
    const wasMoving = Math.hypot(axis.x, axis.y) > 0.001;
    const moving = Math.hypot(x, y) > 0.001;
    axis.x = x;
    axis.y = y;
    if (!wasMoving && moving) this.pendingMoveStarted = true;
  }

  /** Mouse-wheel zoom in notches (positive = zoom out). */
  addZoom(steps: number): void {
    this.pendingZoom += steps;
  }

  /** Releases everything, e.g. when the window loses focus and keyup events would be lost. */
  releaseAll(): void {
    for (const key of [...this.keysDown]) this.keyUp(key);
    this.pendingLookX = 0;
    this.pendingLookY = 0;
    this.pendingZoom = 0;
    for (const axis of Object.values(this.analog)) {
      axis.x = 0;
      axis.y = 0;
    }
    this.pendingMoveStarted = false;
  }

  beginFrame(): void {
    [this.framePressed, this.pendingPressed] = [this.pendingPressed, this.framePressed];
    this.pendingPressed.clear();
    [this.frameReleased, this.pendingReleased] = [this.pendingReleased, this.frameReleased];
    this.pendingReleased.clear();

    this.lookX = this.pendingLookX;
    this.lookY = this.pendingLookY;
    this.pendingLookX = 0;
    this.pendingLookY = 0;
    this.zoom = this.pendingZoom;
    this.pendingZoom = 0;
    this.frameMoveStarted = this.pendingMoveStarted;
    this.pendingMoveStarted = false;
  }

  isDown(action: Action): boolean {
    return this.heldCount.has(action);
  }

  /** True during the frame in which the action went from up to down. */
  wasPressed(action: Action): boolean {
    return this.framePressed.has(action);
  }

  wasReleased(action: Action): boolean {
    return this.frameReleased.has(action);
  }

  /** Movement intent: x = right, y = forward. Diagonals are normalized so they aren't faster. */
  getMoveAxis(out: Vec2Like): Vec2Like {
    const { gamepad, touch } = this.analog;
    const x = gamepad.x + touch.x + (this.isDown('moveRight') ? 1 : 0) - (this.isDown('moveLeft') ? 1 : 0);
    const y = gamepad.y + touch.y + (this.isDown('moveForward') ? 1 : 0) - (this.isDown('moveBackward') ? 1 : 0);
    const length = Math.hypot(x, y);
    const scale = length > 1 ? 1 / length : 1;
    out.x = x * scale;
    out.y = y * scale;
    return out;
  }

  /** True once when an analog movement control leaves its deadzone. */
  wasMoveStarted(): boolean {
    return this.frameMoveStarted;
  }

  /** Mouse movement this frame, in pixels (x = right, y = down). */
  getLookDelta(out: Vec2Like): Vec2Like {
    out.x = this.lookX;
    out.y = this.lookY;
    return out;
  }

  /** Wheel notches this frame (positive = zoom out). */
  getZoomDelta(): number {
    return this.zoom;
  }

  heldActions(): Action[] {
    return [...this.heldCount.keys()];
  }
}

const KEY_NAMES: Readonly<Record<string, string>> = {
  ShiftLeft: 'Shift',
  ShiftRight: 'Shift',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl',
  AltLeft: 'Alt',
  AltRight: 'Alt',
  Space: 'Space',
  Escape: 'Esc',
  Backquote: '`',
  Enter: 'Enter',
  Tab: 'Tab',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
};

/** Human label for a KeyboardEvent.code, e.g. 'KeyW' → 'W'. */
export function keyLabel(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  return KEY_NAMES[code] ?? code;
}

const CODE_FOR_KEY: Readonly<Record<string, string>> = {
  '`': 'Backquote',
  '~': 'Backquote',
  ' ': 'Space',
  Shift: 'ShiftLeft',
  Escape: 'Escape',
  Enter: 'Enter',
  Tab: 'Tab',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
};

/**
 * Some synthetic, remote-desktop or assistive-tech key events arrive with an empty
 * KeyboardEvent.code. Recover a best-guess code from KeyboardEvent.key instead.
 */
export function codeFromKey(key: string): string {
  if (/^[a-z]$/i.test(key)) return `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return `Digit${key}`;
  return CODE_FOR_KEY[key] ?? '';
}
