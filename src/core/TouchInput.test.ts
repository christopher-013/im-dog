import { describe, expect, it } from 'vitest';
import { KEY_BINDINGS, TOUCH } from '../config/input';
import { InputState } from './InputState';
import { TouchInput } from './TouchInput';

type Handler = (e: FakePointer) => void;

interface FakePointer {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
  target: unknown;
  cancelable: boolean;
  preventDefault(): void;
}

/** A class list that really toggles, to check the popped-out state. */
function classes(): Set<string> & { toggle(name: string, force?: boolean): void; remove(name: string): void } {
  const set = new Set<string>();
  return Object.assign(set, {
    toggle: (name: string, force?: boolean) => void ((force ?? !set.has(name)) ? set.add(name) : set.delete(name)),
    remove: (name: string) => void set.delete(name),
  });
}

/** Just enough DOM for TouchInput: a 800×400 surface with named buttons. */
class FakeRoot {
  readonly listeners = new Map<string, Handler[]>();
  /** The paw button's pop-out container. */
  readonly actions = { classList: classes() };
  /** Which button is under the finger when it slides (null: none). */
  under: string | null = null;
  readonly buttons: Record<
    string,
    { dataset: { touch: string }; classList: Set<string> & { toggle(): void }; setAttribute(): void; getBoundingClientRect(): unknown }
  > = {};

  addEventListener(type: string, handler: Handler): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), handler]);
  }
  querySelector(selector: string): unknown {
    if (selector === '.touch-actions') return this.actions;
    const match = /data-touch="(\w+)"/.exec(selector);
    return match ? this.button(match[1]!) : null;
  }
  elementAt(): unknown {
    const under = this.under;
    return under ? { closest: () => this.button(under) } : null;
  }
  querySelectorAll(): unknown[] {
    return [];
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 400 };
  }
  setPointerCapture(): void {}
  button(name: string) {
    const classes = new Set<string>() as Set<string> & { toggle(): void };
    classes.toggle = () => {};
    return (this.buttons[name] ??= {
      dataset: { touch: name },
      classList: Object.assign(classes, { remove: classes.delete.bind(classes) }),
      setAttribute() {},
      // Every button reports the paw's circle (only the paw's is used): 86 px across, centred on (700, 300).
      getBoundingClientRect: () => ({ left: 657, top: 257, width: 86, height: 86 }),
    });
  }
  fire(type: string, id: number, x: number, y: number, target: unknown = null): void {
    const e: FakePointer = { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, target, cancelable: true, preventDefault() {} };
    for (const handler of this.listeners.get(type) ?? []) handler(e);
  }
  press(name: string, id: number): void {
    const button = this.button(name);
    this.fire('pointerdown', id, 700, 300, { closest: () => button });
  }
}

function setup() {
  const root = new FakeRoot();
  const state = new InputState(KEY_BINDINGS);
  const clock = { ms: 0 };
  const touch = new TouchInput(root as unknown as HTMLElement, state, new AbortController().signal, {
    now: () => clock.ms,
    elementAt: () => root.elementAt() as Partial<Element> | null,
  });
  touch.enabled = true;
  const frame = () => {
    touch.update();
    state.beginFrame();
  };
  /** Waits (fake time), a frame at a time. */
  const wait = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) {
      clock.ms += 50;
      frame();
    }
  };
  /** Holds the paw until the other buttons pop out, and lets go on the paw: they stay out to be tapped. */
  const openMenu = (id = 9) => {
    root.press('interact', id);
    wait(TOUCH.menuHoldTime + 0.1);
    root.fire('pointerup', id, 700, 300);
    frame();
  };
  return { root, state, touch, frame, wait, openMenu };
}

const axis = (state: InputState) => state.getMoveAxis({ x: 0, y: 0 });

describe('TouchInput (touch controls feeding the shared input state)', () => {
  it('moves with a thumb on the left and looks with a thumb on the right, at the same time', () => {
    const { root, state, frame } = setup();
    root.fire('pointerdown', 1, 100, 300); // left: joystick
    root.fire('pointermove', 1, 100, 300 - TOUCH.joystickRadius); // straight up = forward
    root.fire('pointerdown', 2, 600, 200); // right: camera
    root.fire('pointermove', 2, 630, 190);
    frame();
    expect(axis(state).y).toBeCloseTo(1);
    expect(axis(state).x).toBeCloseTo(0);
    const look = state.getLookDelta({ x: 0, y: 0 });
    expect(look.x).toBeCloseTo(30 * TOUCH.lookScale);
    expect(look.y).toBeCloseTo(-10 * TOUCH.lookScale);
  });

  it('runs when the stick is pushed past its ring, and with the RUN toggle', () => {
    const { root, state, frame, openMenu } = setup();
    root.fire('pointerdown', 1, 100, 300);
    root.fire('pointermove', 1, 100 + TOUCH.joystickRadius * (TOUCH.sprintBeyond + 0.1), 300);
    frame();
    expect(state.isDown('run')).toBe(true);
    root.fire('pointermove', 1, 100 + TOUCH.joystickRadius * 0.8, 300);
    frame();
    expect(state.isDown('run')).toBe(false);
    openMenu();
    root.press('run', 5);
    root.fire('pointerup', 5, 700, 300);
    frame();
    expect(state.isDown('run')).toBe(true); // toggled on, no finger needed
    root.press('run', 6);
    frame();
    expect(state.isDown('run')).toBe(false);
  });

  it('turns button taps into the same actions as keys: a quick tap on the paw interacts', () => {
    const { root, state, touch, frame, openMenu } = setup();
    root.press('interact', 3);
    frame();
    root.fire('pointerup', 3, 700, 300);
    frame();
    expect(state.wasPressed('interact')).toBe(true);
    expect(state.isDown('interact')).toBe(false);
    expect(touch.menuIsOpen).toBe(false);
    openMenu();
    root.press('jump', 4);
    frame();
    expect(state.wasPressed('jump')).toBe(true);
  });

  it('keeps the other buttons tucked inside the paw: hidden ones do nothing', () => {
    const { root, state, touch, frame } = setup();
    expect(touch.menuIsOpen).toBe(false);
    for (const [i, name] of ['jump', 'bark', 'sniff', 'trick', 'run'].entries()) root.press(name, 10 + i);
    frame();
    for (const action of ['jump', 'bark', 'sniff', 'trick', 'run'] as const) expect(state.isDown(action)).toBe(false);
  });

  it('pops them out when the paw is held (without interacting); slide onto one and let go to use it', () => {
    const { root, state, touch, frame, wait } = setup();
    root.press('interact', 1);
    wait(TOUCH.menuHoldTime * 0.5);
    expect(touch.menuIsOpen).toBe(false);
    wait(TOUCH.menuHoldTime * 0.6);
    expect(touch.menuIsOpen).toBe(true);
    expect(root.actions.classList.has('is-open')).toBe(true);
    root.under = 'jump';
    root.fire('pointermove', 1, 600, 180);
    expect(root.buttons.jump!.classList.has('is-pressed')).toBe(true);
    root.fire('pointerup', 1, 600, 180);
    frame();
    expect(state.wasPressed('jump')).toBe(true);
    expect(state.wasPressed('interact')).toBe(false);
    expect(root.buttons.jump!.classList.has('is-pressed')).toBe(false);
  });

  it("doesn't count a button springing out under a finger that's still on the paw", () => {
    const { root, state, touch, frame, wait } = setup();
    root.press('interact', 1);
    wait(TOUCH.menuHoldTime + 0.05);
    root.under = 'run'; // mid-pop, RUN is still passing over the paw's middle
    root.fire('pointermove', 1, 702, 298);
    root.fire('pointerup', 1, 702, 298);
    frame();
    expect(touch.running).toBe(false);
    expect(state.wasPressed('interact')).toBe(false);
    expect(touch.menuIsOpen).toBe(true);
  });

  it('lets go on the paw: they stay out to be tapped, then tuck themselves away once unused', () => {
    const { root, state, touch, frame, wait, openMenu } = setup();
    openMenu();
    expect(touch.menuIsOpen).toBe(true);
    expect(state.wasPressed('interact')).toBe(false);
    root.press('bark', 2);
    frame();
    expect(state.wasPressed('bark')).toBe(true);
    root.fire('pointerup', 2, 700, 300);
    wait(TOUCH.menuIdleClose * 0.8);
    expect(touch.menuIsOpen).toBe(true); // still in use
    wait(TOUCH.menuIdleClose * 0.3);
    expect(touch.menuIsOpen).toBe(false);
  });

  it('tucks them away at once on a tap of the paw (which interacts) or a camera drag, but not while moving', () => {
    const { root, state, touch, frame, openMenu } = setup();
    openMenu();
    root.fire('pointerdown', 1, 100, 300); // left thumb: the stick
    frame();
    expect(touch.menuIsOpen).toBe(true);
    root.press('interact', 2);
    root.fire('pointerup', 2, 700, 300);
    frame();
    expect(touch.menuIsOpen).toBe(false);
    expect(state.wasPressed('interact')).toBe(true);
    openMenu();
    root.fire('pointerdown', 3, 600, 150); // right thumb: look around
    expect(touch.menuIsOpen).toBe(false);
  });

  it('never leaves anything stuck: lifted, cancelled, reset or disabled', () => {
    const { root, state, touch, frame, openMenu } = setup();
    openMenu();
    root.fire('pointerdown', 1, 100, 300);
    root.fire('pointermove', 1, 160, 300);
    root.press('bark', 2);
    frame();
    expect(axis(state).x).toBeGreaterThan(0.5);
    expect(state.isDown('bark')).toBe(true);
    root.fire('pointercancel', 1, 160, 300); // e.g. the browser took the gesture
    root.fire('lostpointercapture', 2, 700, 300);
    frame();
    expect(axis(state)).toEqual({ x: 0, y: 0 });
    expect(state.isDown('bark')).toBe(false);

    root.fire('pointerdown', 1, 100, 300);
    root.fire('pointermove', 1, 100, 250);
    openMenu();
    root.press('run', 3);
    root.press('interact', 5); // mid long-press
    touch.reset(); // pause, rotation, focus loss
    frame();
    expect(axis(state)).toEqual({ x: 0, y: 0 });
    expect(state.isDown('run')).toBe(false);
    expect(touch.menuIsOpen).toBe(false);
    root.fire('pointerup', 5, 700, 300); // the paw finger lifting after a reset does nothing
    frame();
    expect(state.wasPressed('interact')).toBe(false);

    root.fire('pointerdown', 4, 100, 300);
    root.fire('pointermove', 4, 100, 250);
    touch.enabled = false; // back to a menu
    frame();
    expect(axis(state)).toEqual({ x: 0, y: 0 });
  });

  it('ignores touches while disabled (menus use ordinary taps) and the mouse unless asked', () => {
    const { root, state, touch, frame } = setup();
    touch.enabled = false;
    root.fire('pointerdown', 1, 100, 300);
    root.fire('pointermove', 1, 100, 250);
    frame();
    expect(axis(state)).toEqual({ x: 0, y: 0 });
  });

  it('keeps holding a touch key after the input state was released under it', () => {
    const { root, state, frame, openMenu } = setup();
    openMenu();
    root.press('run', 1);
    state.releaseAll(); // something else let go of everything
    frame();
    expect(state.isDown('run')).toBe(true);
  });
});
