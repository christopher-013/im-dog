import { TOUCH } from '../config/input';
import { clamp } from '../utils/math';
import type { InputState } from './InputState';
import { VirtualJoystick } from './VirtualJoystick';

/** The on-screen buttons (`data-touch="…"` in index.html). RUN toggles; the rest are held while touched. */
const TOUCH_BUTTONS = ['interact', 'bark', 'sniff', 'trick', 'growl', 'run', 'pause'] as const;
type TouchButton = (typeof TOUCH_BUTTONS)[number];

const isTouchButton = (value: string | undefined): value is TouchButton =>
  value !== undefined && (TOUCH_BUTTONS as readonly string[]).includes(value);

const key = (button: TouchButton | 'sprint'): string => `Touch:${button}`;

/**
 * Touch controls for phones and tablets, fed into the same InputState as the keyboard and controller:
 * - a floating joystick: any touch that starts on the left part of the screen (analog movement; pushed past
 *   its ring, Moke runs);
 * - camera drag: any touch that starts elsewhere, not on a button (look delta, like a mouse);
 * - buttons: virtual `Touch:…` keys (see KEY_BINDINGS), so gameplay never knows it was a touch.
 * Every pointer is tracked by id, so a thumb on each side (plus button taps) work together, and everything is
 * released when a finger lifts, the browser cancels the touch, the window loses focus or play pauses.
 */
export class TouchInput {
  /** Touch controls only run during play; menus use ordinary taps. */
  private enabledNow = false;
  /** Called on every touch, so the input mode can switch to touch. */
  onTouch: (() => void) | null = null;

  private readonly joystick = new VirtualJoystick();
  private look: { id: number; x: number; y: number } | null = null;
  /** Buttons held down, by pointer id. */
  private readonly held = new Map<number, TouchButton>();
  private runOn = false;
  private sprintHeld = false;

  private readonly stick: HTMLElement | null;
  private readonly knob: HTMLElement | null;
  private readonly runButton: HTMLElement | null;

  constructor(
    private readonly root: HTMLElement,
    private readonly state: InputState,
    signal: AbortSignal,
    /** Accept mouse pointers too (`?input=touch` testing on a desktop). */
    private readonly acceptMouse = false,
  ) {
    this.stick = root.querySelector('[data-touch-stick]');
    this.knob = root.querySelector('[data-touch-knob]');
    this.runButton = root.querySelector('[data-touch="run"]');
    const opts = { signal };
    root.addEventListener('pointerdown', this.handleDown, opts);
    root.addEventListener('pointermove', this.handleMove, opts);
    root.addEventListener('pointerup', this.handleUp, opts);
    root.addEventListener('pointercancel', this.handleUp, opts);
    root.addEventListener('lostpointercapture', this.handleUp, opts);
    root.addEventListener('contextmenu', (e) => e.preventDefault(), opts);
    // Belt and braces for browsers that ignore `touch-action: none`: no scrolling, zooming or rubber-banding.
    const block = (e: Event) => e.cancelable && e.preventDefault();
    root.addEventListener('touchstart', block, { signal, passive: false });
    root.addEventListener('touchmove', block, { signal, passive: false });
    // iOS Safari pinch-zooms the page through its own gesture events, whatever touch-action says. Only in play:
    // menus and dialogs keep normal zoom for accessibility.
    if (typeof document !== 'undefined') {
      document.addEventListener('gesturestart', (e) => this.enabledNow && e.preventDefault(), { signal, passive: false });
    }
  }

  get enabled(): boolean {
    return this.enabledNow;
  }

  set enabled(on: boolean) {
    if (on === this.enabledNow) return;
    this.enabledNow = on;
    if (!on) this.reset();
  }

  /** Is the RUN toggle on? (For the button's look.) */
  get running(): boolean {
    return this.runOn;
  }

  /** Once per frame, before InputState.beginFrame(): keeps held touch keys held after a releaseAll(). */
  update(): void {
    if (!this.enabledNow) return;
    this.state.setAnalogMove(this.joystick.axis.x, this.joystick.axis.y, 'touch');
    if (this.runOn && !this.state.isKeyDown(key('run'))) this.state.keyHeld(key('run'));
    if (this.sprintHeld && !this.state.isKeyDown(key('sprint'))) this.state.keyHeld(key('sprint'));
    for (const button of this.held.values()) {
      if (!this.state.isKeyDown(key(button))) this.state.keyHeld(key(button));
    }
  }

  /** Lets go of everything: fingers lifted off-screen, rotation, pause, focus loss. The RUN toggle turns off too. */
  reset(): void {
    if (this.joystick.active) this.joystick.end();
    this.state.setAnalogMove(0, 0, 'touch');
    this.setSprint(false);
    for (const button of this.held.values()) this.state.keyUp(key(button));
    this.held.clear();
    this.look = null;
    this.setRun(false);
    for (const el of this.root.querySelectorAll('.is-pressed')) el.classList.remove('is-pressed');
    this.drawStick();
  }

  private readonly handleDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse' && !this.acceptMouse) return;
    this.onTouch?.();
    if (!this.enabledNow) return;
    e.preventDefault();
    const target = (e.target as Partial<Element> | null)?.closest?.<HTMLElement>('[data-touch]') ?? null;
    const button = target?.dataset.touch;
    if (target && isTouchButton(button)) {
      this.capture(e);
      if (button === 'run') {
        this.setRun(!this.runOn);
        return;
      }
      this.held.set(e.pointerId, button);
      this.state.keyDown(key(button));
      target.classList.add('is-pressed');
      return;
    }

    const { x, y, width } = this.local(e);
    if (x < width * TOUCH.joystickZone) {
      if (this.joystick.active) return;
      this.capture(e);
      this.joystick.start(e.pointerId, x, y);
      this.state.setAnalogMove(this.joystick.axis.x, this.joystick.axis.y, 'touch');
      this.drawStick();
    } else if (!this.look) {
      this.capture(e);
      this.look = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
  };

  private readonly handleMove = (e: PointerEvent): void => {
    if (!this.enabledNow) return;
    if (e.pointerId === this.joystick.pointerId) {
      const { x, y } = this.local(e);
      this.joystick.move(x, y);
      this.state.setAnalogMove(this.joystick.axis.x, this.joystick.axis.y, 'touch');
      this.setSprint(this.joystick.sprint);
      this.drawStick();
    } else if (this.look?.id === e.pointerId) {
      const max = TOUCH.maxLookPerEvent;
      const dx = clamp(e.clientX - this.look.x, -max, max);
      const dy = clamp(e.clientY - this.look.y, -max, max);
      this.look.x = e.clientX;
      this.look.y = e.clientY;
      this.state.addLook(dx * TOUCH.lookScale, dy * TOUCH.lookScale);
    }
  };

  private readonly handleUp = (e: PointerEvent): void => {
    if (e.pointerId === this.joystick.pointerId) {
      this.joystick.end();
      this.state.setAnalogMove(0, 0, 'touch');
      this.setSprint(false);
      this.drawStick();
    }
    if (this.look?.id === e.pointerId) this.look = null;
    const button = this.held.get(e.pointerId);
    if (button) {
      this.held.delete(e.pointerId);
      this.state.keyUp(key(button));
      this.root.querySelector(`[data-touch="${button}"]`)?.classList.remove('is-pressed');
    }
  };

  private capture(e: PointerEvent): void {
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic or already-ended pointers can't be captured; the up/cancel handlers still clean up.
    }
  }

  private local(e: PointerEvent): { x: number; y: number; width: number } {
    const rect = this.root.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top, width: rect.width };
  }

  private setRun(on: boolean): void {
    if (on === this.runOn) return;
    this.runOn = on;
    if (on) this.state.keyDown(key('run'));
    else this.state.keyUp(key('run'));
    this.runButton?.classList.toggle('is-on', on);
    this.runButton?.setAttribute('aria-pressed', String(on));
  }

  private setSprint(on: boolean): void {
    if (on === this.sprintHeld) return;
    this.sprintHeld = on;
    if (on) this.state.keyDown(key('sprint'));
    else this.state.keyUp(key('sprint'));
  }

  /** The stick rests in its corner until a thumb lands, then sits under the thumb. */
  private drawStick(): void {
    const stick = this.stick;
    if (!stick) return;
    const j = this.joystick;
    stick.classList.toggle('is-active', j.active);
    stick.classList.toggle('is-sprinting', j.sprint);
    stick.style.transform = j.active ? `translate(${j.originX}px, ${j.originY}px)` : '';
    if (this.knob) this.knob.style.transform = `translate(${j.knob.x}px, ${j.knob.y}px)`;
  }
}
