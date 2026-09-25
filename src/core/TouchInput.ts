import { TOUCH } from '../config/input';
import { clamp } from '../utils/math';
import type { InputState } from './InputState';
import { VirtualJoystick } from './VirtualJoystick';

/** The on-screen buttons (`data-touch="…"` in index.html). RUN toggles; the rest are held while touched. */
const TOUCH_BUTTONS = ['interact', 'jump', 'bark', 'sniff', 'trick', 'run', 'pause'] as const;
type TouchButton = (typeof TOUCH_BUTTONS)[number];

/** Tucked inside the paw (interact) button until a long press pops them out, to keep the screen clear. */
const MENU_BUTTONS: readonly TouchButton[] = ['jump', 'bark', 'sniff', 'trick', 'run'];

const isTouchButton = (value: string | undefined): value is TouchButton =>
  value !== undefined && (TOUCH_BUTTONS as readonly string[]).includes(value);

const isMenuButton = (button: TouchButton): boolean => MENU_BUTTONS.includes(button);

const key = (button: TouchButton | 'sprint'): string => `Touch:${button}`;

export interface TouchInputOptions {
  /** Accept mouse pointers too (`?input=touch` testing on a desktop). */
  acceptMouse?: boolean;
  /** Milliseconds, for the paw button's long press (tests pass their own clock). */
  now?: () => number;
  /** What's under a screen point, to slide from the paw onto a popped-out button (tests pass their own). */
  elementAt?: (x: number, y: number) => Partial<Element> | null;
}

/**
 * Touch controls for phones and tablets, fed into the same InputState as the keyboard and controller:
 * - a floating joystick: any touch that starts on the left part of the screen (analog movement; pushed past
 *   its ring, Moke runs);
 * - camera drag: any touch that starts elsewhere, not on a button (look delta, like a mouse);
 * - the paw button: a tap interacts; holding it pops out the other buttons (jump, bark, sniff, trick, run).
 *   Slide onto one and let go, or let go and tap one. They tuck themselves away again once unused for a moment,
 *   or at once on a tap of the paw or a camera drag;
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
  /**
   * The finger on the paw button: when it landed (ms), the paw's circle on screen, and the popped-out button it
   * has slid onto.
   */
  private paw: { id: number; since: number; x: number; y: number; radius: number; over: TouchButton | null } | null = null;
  private menuOpen = false;
  /** When the popped-out buttons were last used (ms), to tuck them away once idle. */
  private menuUsedAt = 0;

  private readonly acceptMouse: boolean;
  private readonly now: () => number;
  private readonly elementAt: (x: number, y: number) => Partial<Element> | null;
  private readonly stick: HTMLElement | null;
  private readonly stickRest: HTMLElement | null;
  private readonly knob: HTMLElement | null;
  private readonly runButton: HTMLElement | null;
  private readonly actions: HTMLElement | null;

  constructor(
    private readonly root: HTMLElement,
    private readonly state: InputState,
    signal: AbortSignal,
    options: TouchInputOptions = {},
  ) {
    this.acceptMouse = options.acceptMouse ?? false;
    this.now = options.now ?? (() => performance.now());
    this.elementAt = options.elementAt ?? ((x, y) => (typeof document === 'undefined' ? null : document.elementFromPoint(x, y)));
    this.stick = root.querySelector('[data-touch-stick]');
    this.stickRest = root.querySelector('.touch-stick-rest');
    this.knob = root.querySelector('[data-touch-knob]');
    this.runButton = root.querySelector('[data-touch="run"]');
    this.actions = root.querySelector('.touch-actions');
    const opts = { signal };
    root.addEventListener('pointerdown', this.handleDown, opts);
    root.addEventListener('pointermove', this.handleMove, opts);
    root.addEventListener('pointerup', this.handleUp, opts);
    root.addEventListener('pointercancel', this.handleCancel, opts);
    root.addEventListener('lostpointercapture', this.handleCancel, opts);
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

  /** Are the paw button's other buttons popped out? */
  get menuIsOpen(): boolean {
    return this.menuOpen;
  }

  /** Once per frame, before InputState.beginFrame(): the paw's long press, and keeps held touch keys held after a releaseAll(). */
  update(): void {
    if (!this.enabledNow) return;
    const now = this.now();
    if (this.paw && !this.menuOpen && now - this.paw.since >= TOUCH.menuHoldTime * 1000) this.setMenu(true);
    if (this.menuOpen && !this.paw && !this.menuButtonHeld() && now - this.menuUsedAt >= TOUCH.menuIdleClose * 1000) {
      this.setMenu(false);
    }
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
    this.paw = null;
    this.setMenu(false);
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
    // A tucked-away button can't be pressed (it's hidden; this only guards against stray events).
    if (target && isTouchButton(button) && (this.menuOpen || !isMenuButton(button))) {
      this.capture(e);
      if (button === 'interact') {
        if (this.paw) return;
        const r = target.getBoundingClientRect?.();
        const circle = r ? { x: r.left + r.width / 2, y: r.top + r.height / 2, radius: r.width / 2 } : { x: 0, y: 0, radius: 0 };
        this.paw = { id: e.pointerId, since: this.now(), ...circle, over: null };
        target.classList.add('is-pressed');
        return;
      }
      if (isMenuButton(button)) this.menuUsedAt = this.now();
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
      // Looking around: done with the popped-out buttons.
      if (!this.paw) this.setMenu(false);
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
    } else if (this.paw?.id === e.pointerId && this.menuOpen) {
      this.slideOver(this.menuButtonAt(e.clientX, e.clientY));
    }
  };

  private readonly handleUp = (e: PointerEvent): void => {
    const paw = this.paw;
    if (paw?.id === e.pointerId) {
      const over = this.menuOpen ? this.menuButtonAt(e.clientX, e.clientY) ?? paw.over : null;
      this.letGoOfPaw();
      if (over) {
        // Slid from the paw onto a popped-out button and let go: that's the one.
        this.menuUsedAt = this.now();
        if (over === 'run') this.setRun(!this.runOn);
        else this.tap(over);
      } else if (this.now() - paw.since < TOUCH.menuHoldTime * 1000) {
        // A quick tap: interact, and tuck the other buttons away if they were out.
        this.tap('interact');
        this.setMenu(false);
      } else {
        // A long press let go on the paw: the buttons stay out to be tapped.
        this.menuUsedAt = this.now();
      }
      return;
    }
    this.release(e.pointerId);
  };

  /** The browser took the touch (or capture was lost): let go without doing anything. */
  private readonly handleCancel = (e: PointerEvent): void => {
    if (this.paw?.id === e.pointerId) {
      this.letGoOfPaw();
      this.menuUsedAt = this.now();
      return;
    }
    this.release(e.pointerId);
  };

  private letGoOfPaw(): void {
    this.slideOver(null);
    this.paw = null;
    this.button('interact')?.classList.remove('is-pressed');
  }

  private release(id: number): void {
    if (id === this.joystick.pointerId) {
      this.joystick.end();
      this.state.setAnalogMove(0, 0, 'touch');
      this.setSprint(false);
      this.drawStick();
    }
    if (this.look?.id === id) this.look = null;
    const button = this.held.get(id);
    if (button) {
      this.held.delete(id);
      this.state.keyUp(key(button));
      this.button(button)?.classList.remove('is-pressed');
      if (isMenuButton(button)) this.menuUsedAt = this.now();
    }
  }

  /** A press and release in one go: counts as one press this frame. */
  private tap(button: TouchButton): void {
    this.state.keyDown(key(button));
    this.state.keyUp(key(button));
  }

  /**
   * The popped-out button under the paw finger. Only once it has left the paw: the buttons spring out from the
   * paw's middle, so one can pass under a finger that's still on the paw and would otherwise catch it.
   */
  private menuButtonAt(x: number, y: number): TouchButton | null {
    const paw = this.paw;
    if (paw && Math.hypot(x - paw.x, y - paw.y) < paw.radius) return null;
    const el = this.elementAt(x, y)?.closest?.<HTMLElement>('[data-touch]');
    const button = el?.dataset.touch;
    return isTouchButton(button) && isMenuButton(button) ? button : null;
  }

  /** Highlights the popped-out button the paw finger is on. */
  private slideOver(button: TouchButton | null): void {
    const paw = this.paw;
    const previous = paw?.over ?? null;
    if (previous !== button && previous) this.button(previous)?.classList.remove('is-pressed');
    if (button) this.button(button)?.classList.add('is-pressed');
    if (paw) paw.over = button;
  }

  private menuButtonHeld(): boolean {
    for (const button of this.held.values()) if (isMenuButton(button)) return true;
    return false;
  }

  private setMenu(open: boolean): void {
    if (open) this.menuUsedAt = this.now();
    if (open === this.menuOpen) return;
    this.menuOpen = open;
    this.actions?.classList.toggle('is-open', open);
  }

  private button(name: TouchButton): HTMLElement | null {
    return this.root.querySelector<HTMLElement>(`[data-touch="${name}"]`);
  }

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
    this.drawStick();
  }

  private setSprint(on: boolean): void {
    if (on === this.sprintHeld) return;
    this.sprintHeld = on;
    if (on) this.state.keyDown(key('sprint'));
    else this.state.keyUp(key('sprint'));
  }

  /**
   * The stick rests in its corner until a thumb lands, then sits under the thumb. It turns coral while he runs,
   * so the RUN toggle shows even with the buttons tucked away.
   */
  private drawStick(): void {
    this.stickRest?.classList.toggle('is-running', this.runOn);
    const stick = this.stick;
    if (!stick) return;
    const j = this.joystick;
    stick.classList.toggle('is-active', j.active);
    stick.classList.toggle('is-sprinting', j.sprint || this.runOn);
    stick.style.transform = j.active ? `translate(${j.originX}px, ${j.originY}px)` : '';
    if (this.knob) this.knob.style.transform = `translate(${j.knob.x}px, ${j.knob.y}px)`;
  }
}
