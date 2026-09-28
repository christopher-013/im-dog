import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CAGE } from './home/gymAndYard';
import { GYM } from './home/layout';
import { CONURE, ConureView } from './Conure';

const DT = 1 / 60;

function run(bird: ConureView, seconds: number, moke: { x: number; y: number; z: number } | null = null, each?: () => void) {
  for (let t = 0; t < seconds; t += DT) {
    bird.update(DT, moke);
    each?.();
  }
}

describe('ConureView (the gym bird)', () => {
  it('lives a little: hops and side-steps between perches, and never leaves its cage', () => {
    const bird = new ConureView(GYM.cage, -Math.PI / 2, 3);
    const heights = new Set<string>();
    const modes = new Set<string>();
    let minX = Infinity;
    let maxX = -Infinity;
    run(bird, 120, null, () => {
      const p = bird.cagePosition;
      modes.add(bird.state);
      if (bird.state === 'sit') heights.add(p.y.toFixed(2));
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x);
      expect(Math.abs(p.x)).toBeLessThan(CAGE.width / 2 - 0.03);
      expect(Math.abs(p.z)).toBeLessThan(CAGE.depth / 2 - 0.03);
      expect(p.y).toBeGreaterThanOrEqual(CAGE.floorY);
      expect(p.y).toBeLessThan(CAGE.topY - 0.2);
    });
    expect(modes).toEqual(new Set(['sit', 'hop', 'step']));
    expect(heights.size).toBeGreaterThanOrEqual(3); // several perches, not one
    expect(maxX - minX).toBeGreaterThan(0.3); // gets about
  });

  it('turns its head to watch Moke when he comes close', () => {
    const bird = new ConureView(GYM.cage, -Math.PI / 2, 5);
    const head = () => bird.object.getObjectByName('Green-cheeked conure')!.children[0]!.children.find((c) => c.position.y > 0.09)!;
    run(bird, 1);
    const alone = Math.abs(head().rotation.y);
    // Moke off to the side, in front of the cage.
    run(bird, 1.5, { x: GYM.cage.x - 0.8, y: 0, z: GYM.cage.z + 1.2 });
    expect(Math.abs(head().rotation.y)).toBeGreaterThan(alone + 0.2);
  });

  it('flutters up to the top perch when Moke barks nearby, and ignores barks from far away', () => {
    const bird = new ConureView(GYM.cage, -Math.PI / 2, 9);
    const top = Math.max(...CAGE.perches.map((p) => p.y));
    bird.startle({ x: GYM.cage.x - 20, y: 0, z: GYM.cage.z });
    expect(bird.state).toBe('sit');
    bird.startle({ x: GYM.cage.x - 1.5, y: 0, z: GYM.cage.z });
    expect(bird.state).toBe('hop');
    run(bird, CONURE.hopTime + 0.05);
    expect(bird.cagePosition.y).toBeCloseTo(top, 3);
  });

  it('sits inside the real cage in the gym, in world space', () => {
    const bird = new ConureView(GYM.cage, -Math.PI / 2, 1);
    const p = bird.worldPosition(new Vector3());
    expect(Math.abs(p.x - GYM.cage.x)).toBeLessThan(CAGE.depth / 2);
    expect(Math.abs(p.z - GYM.cage.z)).toBeLessThan(CAGE.width / 2);
  });
});
