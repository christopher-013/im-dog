import { describe, expect, it } from 'vitest';
import { routeCurve } from './coastRoute';
import { Traffic } from './traffic';
import { SPEED } from './CoastDrive';

describe('the traffic on the coast road (Phase 6)', () => {
  it('never jumps while in view: the cars ahead stay ahead all the way, and oncoming cars come round out of sight', () => {
    const cruise = SPEED.cruise;
    const traffic = new Traffic(routeCurve(), cruise);
    const cars = (traffic as unknown as { cars: { s: number; way: 1 | -1; speed: number }[] }).cars;
    const dt = 1 / 30;
    let ours = 0, speed = 0, ahead = 0, steps = 0;
    const length = routeCurve().getLength();
    while (ours < length - 1) {
      // Our car: easing up to speed, as the drive does.
      speed += (cruise - speed) * Math.min(1, dt / 1.2);
      const before = cars.map((c) => c.s);
      ours += speed * dt;
      traffic.update(dt, ours);
      cars.forEach((car, i) => {
        const was = before[i]! - ours, now = car.s - ours;
        const inView = (d: number) => d > -60 && d < 800;
        // Moving smoothly: at its speed (or, ahead of us and still far off, easing back to its gap a little slower).
        const moved = car.s - before[i]!;
        const ok = [car.speed, car.speed - 10].some((v) => Math.abs(moved - car.way * v * dt) < 1e-6);
        if (inView(was) && inView(now)) expect(ok).toBe(true);
        if (car.way === 1 && now > 0 && now < 400) ahead++;
      });
      steps++;
    }
    // Someone ahead of us in our lane nearly all the way down the coast.
    expect(ahead / steps).toBeGreaterThan(1.5);
    traffic.dispose();
  });

  it('keeps the road clear while the drive starts (owner, 2026-10-20), then the cars ahead settle in front of us', () => {
    const traffic = new Traffic(routeCurve(), SPEED.cruise);
    const cars = (traffic as unknown as { cars: { s: number; way: 1 | -1; gap: number }[] }).cars;
    // Fifteen seconds sitting at the start (a cockpit scene and a takeoff), then creeping down the street.
    let ours = 0;
    for (let i = 0; i < 15 * 30; i++) {
      ours += i > 9 * 30 ? 2 / 30 : 0;
      traffic.update(1 / 30, ours, true);
      for (const car of cars) expect(Math.abs(car.s - ours)).toBeGreaterThan(250);
    }
    // Then on the coast at cruising speed: within half a minute the ones ahead are back at their usual gaps.
    for (let i = 0; i < 40 * 30; i++) {
      ours += SPEED.cruise / 30;
      traffic.update(1 / 30, ours, false);
    }
    for (const car of cars.filter((c) => c.way === 1)) expect(car.s - ours).toBeLessThan(car.gap + 40);
    traffic.dispose();
  });
});
