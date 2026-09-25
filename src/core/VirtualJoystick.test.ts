import { describe, expect, it } from 'vitest';
import { VirtualJoystick } from './VirtualJoystick';

const tuning = { joystickRadius: 50, deadzone: 0.1, sprintBeyond: 1.4 };

describe('VirtualJoystick', () => {
  it('reads the thumb offset like a stick: up is forward, with a deadzone', () => {
    const stick = new VirtualJoystick(tuning);
    stick.start(1, 100, 100);
    expect(stick.axis).toEqual({ x: 0, y: 0 });
    stick.move(100, 97); // inside the deadzone
    expect(stick.axis).toEqual({ x: 0, y: 0 });
    stick.move(100, 50); // full up
    expect(stick.axis.y).toBeCloseTo(1);
    stick.move(125, 100); // half right
    expect(stick.axis.x).toBeCloseTo((0.5 - 0.1) / 0.9);
    expect(stick.axis.y).toBeCloseTo(0);
  });

  it('clamps at the rim and asks for a run well past it', () => {
    const stick = new VirtualJoystick(tuning);
    stick.start(1, 0, 0);
    stick.move(60, 0);
    expect(Math.hypot(stick.axis.x, stick.axis.y)).toBeCloseTo(1);
    expect(stick.knob.x).toBeCloseTo(50); // drawn at the rim
    expect(stick.sprint).toBe(false);
    stick.move(75, 0);
    expect(stick.sprint).toBe(true);
  });

  it('drags its centre along when the thumb wanders far, so coming back is short', () => {
    const stick = new VirtualJoystick(tuning);
    stick.start(1, 0, 0);
    stick.move(300, 0);
    expect(stick.originX).toBeGreaterThan(200);
    expect(stick.sprint).toBe(true);
    stick.move(stick.originX, 0);
    expect(stick.axis.x).toBeCloseTo(0);
  });

  it('lets go completely when the thumb lifts', () => {
    const stick = new VirtualJoystick(tuning);
    stick.start(7, 0, 0);
    stick.move(0, -80);
    stick.end();
    expect(stick.active).toBe(false);
    expect(stick.axis).toEqual({ x: 0, y: 0 });
    expect(stick.sprint).toBe(false);
  });
});
