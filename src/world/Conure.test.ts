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
    const head = () => bird.object.getObjectByName('Malibu')!.children[0]!.children.find((c) => c.position.y > 0.09)!;
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

  it('plays with Moke: down to the low perch near him, bouncing and chirping, then back to normal', () => {
    const bird = new ConureView(GYM.cage, -Math.PI / 2, 11);
    let chirps = 0;
    bird.onChirp = () => chirps++;
    run(bird, 2);
    const low = Math.min(...CAGE.perches.map((p) => p.y));
    // Moke in front of the cage (its front faces -x), a little to one side.
    const moke = { x: GYM.cage.x - 0.55, y: 0, z: GYM.cage.z + 0.15 };
    expect(bird.canPlay(moke)).toBe(true);
    expect(bird.canPlay({ x: GYM.cage.x - 4, y: 0, z: GYM.cage.z })).toBe(false);
    bird.play(moke);
    expect(bird.playing).toBe(true);
    expect(bird.canPlay(moke)).toBe(false);
    run(bird, CONURE.hopTime + 0.05, moke);
    let lowest = Infinity;
    let highest = -Infinity;
    run(bird, CONURE.playTime - CONURE.hopTime - 0.2, moke, () => {
      const p = bird.cagePosition;
      lowest = Math.min(lowest, p.y);
      highest = Math.max(highest, p.y);
      expect(Math.abs(p.x)).toBeLessThan(CAGE.width / 2 - 0.03);
      expect(p.y).toBeLessThan(CAGE.topY - 0.2);
    });
    expect(lowest).toBeCloseTo(low, 2); // lands back on the perch between bounces
    expect(highest - lowest).toBeGreaterThan(CONURE.bounceHeight * 0.8); // really jumps
    // Right in front of Moke: turned -90°, the cage's local +x is world +z.
    expect(bird.cagePosition.x).toBeCloseTo(0.15, 2);
    expect(chirps).toBeGreaterThanOrEqual(4);
    run(bird, 0.5, moke);
    expect(bird.playing).toBe(false);
    expect(bird.state).toBe('sit');
    expect(bird.cagePosition.y).toBeCloseTo(low, 3);
    const after = chirps;
    run(bird, 3, moke);
    expect(chirps).toBe(after); // quiet again
  });

  it('a bark ends the game: up to the top perch', () => {
    const bird = new ConureView(GYM.cage, -Math.PI / 2, 2);
    const moke = { x: GYM.cage.x - 0.55, y: 0, z: GYM.cage.z };
    bird.play(moke);
    run(bird, 1, moke);
    bird.startle(moke);
    expect(bird.playing).toBe(false);
    run(bird, CONURE.hopTime);
    expect(bird.cagePosition.y).toBeCloseTo(Math.max(...CAGE.perches.map((p) => p.y)), 3);
  });

  it('sits inside the real cage in the gym, in world space', () => {
    const bird = new ConureView(GYM.cage, -Math.PI / 2, 1);
    const p = bird.worldPosition(new Vector3());
    expect(Math.abs(p.x - GYM.cage.x)).toBeLessThan(CAGE.depth / 2);
    expect(Math.abs(p.z - GYM.cage.z)).toBeLessThan(CAGE.width / 2);
  });
});
