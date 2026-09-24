import { GAMEPAD } from '../config/input';
import type { InputState, Vec2Like } from './InputState';

type GamepadButtonLike = Pick<GamepadButton, 'pressed' | 'value'>;
export type GamepadLike = Pick<Gamepad, 'connected' | 'id' | 'index' | 'mapping'> & {
  axes: readonly number[];
  buttons: readonly GamepadButtonLike[];
};

const buttonId = (index: number): string => `Gamepad:Button${index}`;

/** Applies a radial deadzone while preserving stick direction and the full outer range. */
export function applyStickDeadzone(x: number, y: number, deadzone = GAMEPAD.deadzone): Vec2Like {
  const magnitude = Math.hypot(x, y);
  if (magnitude <= deadzone) return { x: 0, y: 0 };
  const limited = Math.min(magnitude, 1);
  const scaled = (limited - deadzone) / (1 - deadzone) / magnitude;
  return { x: x * scaled, y: y * scaled };
}

/** Polls the browser Gamepad API and translates a standard controller into InputState. */
export class GamepadInput {
  private activeIndex: number | null = null;
  private readonly buttonsDown = new Set<number>();

  connected = false;
  name = '';
  mapping = '';

  update(gamepads: readonly (GamepadLike | null)[], input: InputState, dt: number): void {
    const pad = this.findPad(gamepads);
    if (!pad) {
      this.disconnect(input);
      return;
    }

    this.connected = true;
    this.activeIndex = pad.index;
    this.name = pad.id;
    this.mapping = pad.mapping;

    for (let i = 0; i < pad.buttons.length; i++) {
      const down = this.isDown(pad, i);
      if (down && !this.buttonsDown.has(i)) {
        this.buttonsDown.add(i);
        input.keyDown(buttonId(i));
      } else if (down && !input.isKeyDown(buttonId(i))) {
        // Still held, but the input state was reset (pause, focus loss): hold it again, without a new press.
        input.keyHeld(buttonId(i));
      } else if (!down && this.buttonsDown.delete(i)) {
        input.keyUp(buttonId(i));
      }
    }

    // Standard layout: axes 0/1 = left stick, 2/3 = right stick; buttons 12..15 = D-pad.
    const stick = applyStickDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
    const dpadX = Number(this.isDown(pad, 15)) - Number(this.isDown(pad, 14));
    const dpadY = Number(this.isDown(pad, 12)) - Number(this.isDown(pad, 13));
    const moveLength = Math.hypot(stick.x + dpadX, -stick.y + dpadY);
    const moveScale = moveLength > 1 ? 1 / moveLength : 1;
    input.setAnalogMove((stick.x + dpadX) * moveScale, (-stick.y + dpadY) * moveScale);

    const look = applyStickDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
    input.addLook(
      look.x * GAMEPAD.lookPixelsPerSecond * dt,
      look.y * GAMEPAD.lookPixelsPerSecond * dt,
    );
  }

  reset(input: InputState): void {
    this.disconnect(input);
  }

  private findPad(gamepads: readonly (GamepadLike | null)[]): GamepadLike | null {
    if (this.activeIndex !== null) {
      const current = gamepads[this.activeIndex];
      if (current?.connected) return current;
    }
    return gamepads.find((pad): pad is GamepadLike => Boolean(pad?.connected)) ?? null;
  }

  private isDown(pad: GamepadLike, index: number): boolean {
    const button = pad.buttons[index];
    return Boolean(button && (button.pressed || button.value >= GAMEPAD.buttonThreshold));
  }

  private disconnect(input: InputState): void {
    for (const index of this.buttonsDown) input.keyUp(buttonId(index));
    this.buttonsDown.clear();
    input.setAnalogMove(0, 0);
    this.activeIndex = null;
    this.connected = false;
    this.name = '';
    this.mapping = '';
  }
}
