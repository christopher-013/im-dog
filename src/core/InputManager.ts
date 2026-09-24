import { KEY_BINDINGS, MOUSE } from '../config/input';
import { clamp } from '../utils/math';
import { codeFromKey, InputState } from './InputState';

const keyCode = (e: KeyboardEvent): string => e.code || codeFromKey(e.key);

/**
 * Browser wiring for keyboard + mouse, including pointer lock.
 * All game-facing state lives in `state` (InputState), which knows nothing about the DOM.
 */
export class InputManager {
  readonly state = new InputState(KEY_BINDINGS);

  /**
   * True while the player is actually playing. Bound keys then stop triggering browser defaults
   * (Space scrolling, etc.). Off in menus so buttons stay keyboard-friendly.
   */
  gameplayFocus = false;

  onPointerLockChange: ((locked: boolean) => void) | null = null;
  onPointerLockError: (() => void) | null = null;

  /** Fallback when pointer lock is unavailable: look around by dragging with the left button. */
  private dragLooking = false;
  private readonly listeners = new AbortController();

  constructor(private readonly surface: HTMLElement) {
    const opts = { signal: this.listeners.signal };

    window.addEventListener('keydown', this.handleKeyDown, opts);
    window.addEventListener('keyup', (e) => this.state.keyUp(keyCode(e)), opts);
    window.addEventListener('blur', this.releaseAll, opts);
    document.addEventListener('visibilitychange', () => document.hidden && this.releaseAll(), opts);

    document.addEventListener('mousemove', this.handleMouseMove, opts);
    surface.addEventListener('mousedown', (e) => {
      if (e.button === 0 && this.gameplayFocus && !this.isPointerLocked) this.dragLooking = true;
    }, opts);
    window.addEventListener('mouseup', (e) => e.button === 0 && (this.dragLooking = false), opts);
    surface.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
    surface.addEventListener('wheel', this.handleWheel, { signal: this.listeners.signal, passive: false });

    document.addEventListener('pointerlockchange', this.handlePointerLockChange, opts);
    document.addEventListener('pointerlockerror', () => this.onPointerLockError?.(), opts);
  }

  get isPointerLocked(): boolean {
    return document.pointerLockElement === this.surface;
  }

  get pointerLockSupported(): boolean {
    return typeof this.surface.requestPointerLock === 'function';
  }

  beginFrame(): void {
    this.state.beginFrame();
  }

  /**
   * Must be called from a user gesture (click). Prefers raw, un-accelerated mouse input where
   * the browser supports it. Failures (e.g. Chrome's ~1 s cooldown after Esc) go to onPointerLockError.
   */
  async requestPointerLock(): Promise<void> {
    if (!this.pointerLockSupported || this.isPointerLocked) return;
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

  dispose(): void {
    this.exitPointerLock();
    this.listeners.abort();
  }

  private readonly releaseAll = (): void => {
    this.dragLooking = false;
    this.state.releaseAll();
  };

  private readonly handleKeyDown = (e: KeyboardEvent): void => {
    // Leave browser/OS shortcuts (Ctrl+R, Cmd+W, Alt+Tab...) alone.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const bound = this.state.keyDown(keyCode(e));
    if (bound && this.gameplayFocus) e.preventDefault();
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
    if (!this.gameplayFocus) return;
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
