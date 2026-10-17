import { describe, expect, it } from 'vitest';
import { routeCurve } from './coastRoute';
import { Traffic } from './traffic';

describe('the traffic on the coast road (Phase 6)', () => {
  it('never jumps while in view: the cars ahead stay ahead all the way, and oncoming cars come round out of sight', () => {
    const cruise = 18.5;
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
        if (inView(was) && inView(now)) expect(Math.abs(car.s - before[i]! - car.way * car.speed * dt)).toBeLessThan(1e-6);
        if (car.way === 1 && now > 0 && now < 400) ahead++;
      });
      steps++;
    }
    // Someone ahead of us in our lane nearly all the way down the coast.
    expect(ahead / steps).toBeGreaterThan(1.5);
    traffic.dispose();
  });
});
