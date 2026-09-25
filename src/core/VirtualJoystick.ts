import { TOUCH } from '../config/input';

type JoystickTuning = { readonly [K in 'joystickRadius' | 'deadzone' | 'sprintBeyond']: number };

/**
 * A floating on-screen joystick (DOM-free): it appears where the thumb lands, and its output is the
 * thumb's offset from there, like a controller stick (x = right, y = forward, length 0..1 with a
 * deadzone). Pushing well past the rim also asks for a run. If the thumb wanders further still, the
 * stick's centre follows it, so coming back never needs a long trip.
 */
export class VirtualJoystick {
  /** Which pointer is driving it, or null. */
  pointerId: number | null = null;
  originX = 0;
  originY = 0;
  /** Movement: x = right, y = forward (screen up). Length 0..1. */
  readonly axis = { x: 0, y: 0 };
  sprint = false;
  /** The knob's offset from the origin, clamped to the rim (px), for drawing. */
  readonly knob = { x: 0, y: 0 };

  constructor(private readonly tuning: JoystickTuning = TOUCH) {}

  get active(): boolean {
    return this.pointerId !== null;
  }

  start(pointerId: number, x: number, y: number): void {
    this.pointerId = pointerId;
    this.originX = x;
    this.originY = y;
    this.move(x, y);
  }

  move(x: number, y: number): void {
    const { joystickRadius: radius, deadzone, sprintBeyond } = this.tuning;
    let dx = x - this.originX;
    let dy = y - this.originY;
    let distance = Math.hypot(dx, dy);
    // Far past the sprint ring: drag the centre along behind the thumb.
    const follow = radius * (sprintBeyond + 0.35);
    if (distance > follow) {
      const pull = (distance - follow) / distance;
      this.originX += dx * pull;
      this.originY += dy * pull;
      dx = x - this.originX;
      dy = y - this.originY;
      distance = follow;
    }

    const reach = Math.min(distance / radius, 1);
    const amount = reach <= deadzone ? 0 : (reach - deadzone) / (1 - deadzone);
    const scale = distance > 1e-6 ? amount / distance : 0;
    this.axis.x = dx * scale;
    this.axis.y = 0 - dy * scale; // (not -dy·scale, which gives -0 at rest)
    this.sprint = distance > radius * sprintBeyond;
    const clamp = distance > radius ? radius / distance : 1;
    this.knob.x = dx * clamp;
    this.knob.y = dy * clamp;
  }

  end(): void {
    this.pointerId = null;
    this.axis.x = 0;
    this.axis.y = 0;
    this.sprint = false;
    this.knob.x = 0;
    this.knob.y = 0;
  }
}
