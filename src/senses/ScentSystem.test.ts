import { describe, expect, it } from 'vitest';
import { ScentSystem, type ScentSource } from './ScentSystem';

const TUNING = { duration: 4, fadeIn: 0.5, fadeOut: 1, cooldown: 0.5, maxSources: 2, noseForward: 0, noseHeight: 0 };
const NOSE = { x: 0, y: 0, z: 0 };

function source(id: string, x: number, extra: Partial<ScentSource> = {}): ScentSource {
  return { id, category: 'TOY', label: id, position: { x, y: 0, z: 0 }, strength: 1, radius: 3, enabled: true, ...extra };
}

function run(system: ScentSystem, seconds: number, dt = 1 / 60) {
  for (let t = 0; t < seconds - 1e-9; t += dt) system.update(dt, NOSE);
}

describe('ScentSystem', () => {
  it('notices nothing until Q is pressed', () => {
    const system = new ScentSystem(TUNING);
    system.register(source('toy', 1));
    run(system, 1);
    expect(system.active).toBe(false);
    expect(system.hitsLength).toBe(0);
  });

  it('fades in, lasts a few seconds, fades out, then cools down', () => {
    const system = new ScentSystem(TUNING);
    system.register(source('toy', 1));
    expect(system.start()).toBe(true);
    run(system, 0.25);
    expect(system.intensity).toBeGreaterThan(0.4);
    expect(system.intensity).toBeLessThan(0.6);
    run(system, 1);
    expect(system.intensity).toBe(1);
    expect(system.start()).toBe(false); // already sniffing
    run(system, 2.25); // t = 3.5: halfway through the fade-out
    expect(system.intensity).toBeCloseTo(0.5, 1);
    run(system, 0.6);
    expect(system.active).toBe(false);
    expect(system.hitsLength).toBe(0);
    expect(system.start()).toBe(false); // cooling down
    run(system, 0.5);
    expect(system.start()).toBe(true);
  });

  it('ranks sources by how noticeable they are and keeps only the strongest few', () => {
    const system = new ScentSystem(TUNING);
    system.register(source('far', 2.5));
    system.register(source('near', 0.5));
    system.register(source('faint', 0.4, { strength: 0.2 }));
    system.register(source('outOfRange', 3.5));
    system.register(source('carried', 0.1, { enabled: false }));
    system.start();
    run(system, 1);
    expect(system.hits.map((h) => h.source.id)).toEqual(['near', 'far']);
    expect(system.hitAt(0).distance).toBeCloseTo(0.5);
    expect(system.hitAt(0).intensity).toBeGreaterThan(system.hitAt(1).intensity);
  });

  it('follows moving sources', () => {
    const system = new ScentSystem(TUNING);
    const ball = source('ball', 5);
    system.register(ball);
    system.start();
    run(system, 1);
    expect(system.hitsLength).toBe(0);
    (ball.position as { x: number }).x = 1;
    run(system, 0.1);
    expect(system.hitsLength).toBe(1);
  });
});
