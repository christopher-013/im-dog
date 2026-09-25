import { KEY_BINDINGS, MOUSE } from '../config/input';
import { clamp } from '../utils/math';
import { GamepadInput } from './GamepadInput';
import { initialInputMode, InputModeTracker, isInputMode, type InputMode } from './InputMode';
import { codeFromKey, InputState } from './InputState';
import { TouchInput } from './TouchInput';

const keyCode = (e: KeyboardEvent): string => e.code || codeFromKey(e.key);

/**
 * Browser wiring for keyboard + mouse (including pointer lock), controllers and touch.
 * All game-facing state lives in `state` (InputState), which knows nothing about the DOM: every device
 * feeds the same actions and axes, so gameplay never asks which one it was. `mode` follows the device the
 * player last used, for prompts and the on-screen touch controls.
 */
export class InputManager {
  readonly state = new InputState(KEY_BINDINGS);
  readonly gamepad = new GamepadInput();
  readonly touch: TouchInput;

  /** Called when the player switches between keyboard/mouse, touch and controller. */
  onModeChange: ((mode: InputMode) => void) | null = null;
  onPointerLockChange: ((locked: boolean) => void) | null = null;
  onPointerLockError: (() => void) | null = null;

  /**
   * True while the player is actually playing. Bound keys then stop triggering browser defaults
   * (Space scrolling, etc.), and the touch controls come alive. Off in menus so buttons stay keyboard-
   * and tap-friendly.
   */
  private gameplayFocusNow = false;
  private readonly modes: InputModeTracker;
  /** Fallback when pointer lock is unavailable: look around by dragging with the left button. */
  private dragLooking = false;
  private readonly listeners = new AbortController();

  constructor(
    private readonly surface: HTMLElement,
    touchRoot: HTMLElement,
  ) {
    const opts = { signal: this.listeners.signal };
    const forced = new URLSearchParams(location.search).get('input');
    this.modes = new InputModeTracker(
      initialInputMode({
        primaryPointerCoarse: matchMedia('(pointer: coarse)').matches,
        maxTouchPoints: navigator.maxTouchPoints ?? 0,
        forced,
      }),
      isInputMode(forced),
    );
    this.touch = new TouchInput(touchRoot, this.state, this.listeners.signal, { acceptMouse: forced === 'touch' });
    this.touch.onTouch = () => this.useMode('touch');

    window.addEventListener('keydown', this.handleKeyDown, opts);
    window.addEventListener('keyup', (e) => this.state.keyUp(keyCode(e)), opts);
    window.addEventListener('blur', this.releaseAll, opts);
    document.addEventListener('visibilitychange', () => document.hidden && this.releaseAll(), opts);
    // A rotation can strand a thumb's touch; start fresh. (Not every browser fires orientationchange, so the
    // portrait/landscape media query too.)
    window.addEventListener('orientationchange', () => this.touch.reset(), opts);
    matchMedia('(orientation: portrait)').addEventListener('change', () => this.touch.reset(), opts);

    // Which device is in use: a finger on the screen, or a real mouse moving (touch taps also fire mouse events).
    window.addEventListener('pointerdown', (e) => this.useMode(e.pointerType === 'mouse' ? 'keyboard' : 'touch'), { ...opts, capture: true });
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && (e.movementX !== 0 || e.movementY !== 0)) this.useMode('keyboard');
    }, opts);

    document.addEventListener('mousemove', this.handleMouseMove, opts);
    surface.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.gameplayFocusNow && this.mode === 'keyboard' && !this.isPointerLocked) this.dragLooking = true;
    }, opts);
    window.addEventListener('mouseup', (e) => e.button === 0 && (this.dragLooking = false), opts);
    surface.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
    surface.addEventListener('wheel', this.handleWheel, { signal: this.listeners.signal, passive: false });

    document.addEventListener('pointerlockchange', this.handlePointerLockChange, opts);
    document.addEventListener('pointerlockerror', () => this.onPointerLockError?.(), opts);
  }

  get mode(): InputMode {
    return this.modes.mode;
  }

  get gameplayFocus(): boolean {
    return this.gameplayFocusNow;
  }

  set gameplayFocus(on: boolean) {
    this.gameplayFocusNow = on;
    this.touch.enabled = on;
  }

  get isPointerLocked(): boolean {
    return document.pointerLockElement === this.surface;
  }

  get pointerLockSupported(): boolean {
    return typeof this.surface.requestPointerLock === 'function';
  }

  beginFrame(dt: number): void {
    const pads = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    this.gamepad.update(pads, this.state, dt);
    if (this.gamepad.used) this.useMode('gamepad');
    this.touch.update();
    this.state.beginFrame();
  }

  /**
   * Must be called from a user gesture (click). Prefers raw, un-accelerated mouse input where
   * the browser supports it. Failures (e.g. Chrome's ~1 s cooldown after Esc) go to onPointerLockError.
   * Never on touch: phones look around by dragging, and don't need (or have) pointer lock.
   */
  async requestPointerLock(): Promise<void> {
    if (this.mode === 'touch' || !this.pointerLockSupported || this.isPointerLocked) return;
    try {
      await this.surface.requestPointerLock({ unadjustedMovement: true });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'NotSupportedError') {
        try {
          await this.surface.requestPointerLock();
          return;
        } catch {
          // fall through to the error callback
        }
      }
      this.onPointerLockError?.();
    }
  }

  exitPointerLock(): void {
    if (this.isPointerLocked) document.exitPointerLock();
  }

  /** Lets go of everything held on every device (focus loss, pause, rotation). */
  readonly releaseAll = (): void => {
    this.dragLooking = false;
    this.touch.reset();
    this.state.releaseAll();
  };

  dispose(): void {
    this.exitPointerLock();
    this.gamepad.reset(this.state);
    this.listeners.abort();
  }

  private useMode(mode: InputMode): void {
    if (this.modes.use(mode)) this.onModeChange?.(mode);
  }

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    // Leave browser/OS shortcuts (Ctrl+R, Cmd+W, Alt+Tab...) alone.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (!e.repeat) this.useMode('keyboard');
    const bound = this.state.keyDown(keyCode(e));
    if (bound && this.gameplayFocusNow) e.preventDefault();
  };

  private readonly handleMouseMove = (e: MouseEvent): void => {
    if (this.isPointerLocked) {
      const max = MOUSE.maxDeltaPerEvent;
      this.state.addLook(clamp(e.movementX, -max, max), clamp(e.movementY, -max, max));
    } else if (this.dragLooking) {
      this.state.addLook(e.movementX, e.movementY);
    }
  };

  private readonly handleWheel = (e: WheelEvent): void => {
    if (!this.gameplayFocusNow) return;
    e.preventDefault();
    // Normalize to wheel "notches": ~100 px per notch in Chromium, ~3 lines in Firefox.
    const perNotch = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 3 : e.deltaMode === WheelEvent.DOM_DELTA_PAGE ? 1 : 100;
    this.state.addZoom(clamp(e.deltaY / perNotch, -3, 3));
  };

  private readonly handlePointerLockChange = (): void => {
    const locked = this.isPointerLocked;
    if (!locked) this.releaseAll();
    this.onPointerLockChange?.(locked);
  };
}
