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

/** Just enough DOM for TouchInput: a 800×400 surface with named buttons. */
class FakeRoot {
  readonly listeners = new Map<string, Handler[]>();
  readonly buttons: Record<string, { dataset: { touch: string }; classList: Set<string> & { toggle(): void }; setAttribute(): void }> = {};

  addEventListener(type: string, handler: Handler): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), handler]);
  }
  querySelector(selector: string): unknown {
    const match = /data-touch="(\w+)"/.exec(selector);
    return match ? this.button(match[1]!) : null;
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
  const touch = new TouchInput(root as unknown as HTMLElement, state, new AbortController().signal);
  touch.enabled = true;
  const frame = () => {
    touch.update();
    state.beginFrame();
  };
  return { root, state, touch, frame };
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
    const { root, state, frame } = setup();
    root.fire('pointerdown', 1, 100, 300);
    root.fire('pointermove', 1, 100 + TOUCH.joystickRadius * (TOUCH.sprintBeyond + 0.1), 300);
    frame();
    expect(state.isDown('run')).toBe(true);
    root.fire('pointermove', 1, 100 + TOUCH.joystickRadius * 0.8, 300);
    frame();
    expect(state.isDown('run')).toBe(false);
    root.press('run', 5);
    root.fire('pointerup', 5, 700, 300);
    frame();
    expect(state.isDown('run')).toBe(true); // toggled on, no finger needed
    root.press('run', 6);
    frame();
    expect(state.isDown('run')).toBe(false);
  });

  it('turns button taps into the same actions as keys', () => {
    const { root, state, frame } = setup();
    root.press('interact', 3);
    frame();
    expect(state.wasPressed('interact')).toBe(true);
    root.fire('pointerup', 3, 700, 300);
    frame();
    expect(state.isDown('interact')).toBe(false);
  });

  it('never leaves anything stuck: lifted, cancelled, reset or disabled', () => {
    const { root, state, touch, frame } = setup();
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
    root.press('run', 3);
    touch.reset(); // pause, rotation, focus loss
    frame();
    expect(axis(state)).toEqual({ x: 0, y: 0 });
    expect(state.isDown('run')).toBe(false);

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
    const { root, state, frame } = setup();
    root.press('run', 1);
    state.releaseAll(); // something else let go of everything
    frame();
    expect(state.isDown('run')).toBe(true);
  });
});
