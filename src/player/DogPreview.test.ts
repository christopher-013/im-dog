import { Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { DOG_SELECT } from '../config/dogSelect';
import { DOGS } from '../config/dogs';
import { DogPreview } from './DogPreview';

const DT = 1 / 30;

/** A seeded random, so the hop timing is the same every run. */
function seeded(seed = 7) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function run(preview: DogPreview, seconds: number, highlighted: number, reduced: boolean, each?: () => void) {
  for (let i = 0; i < seconds / DT; i++) {
    preview.update(DT, highlighted, reduced);
    each?.();
  }
}

describe('Choose Your Dog: the 3D stage', () => {
  it('stands every dog side by side facing you; the highlighted one steps forward and grows', () => {
    const preview = new DogPreview(DOGS, undefined, seeded());
    expect(preview.count).toBe(DOGS.length);
    run(preview, 1.5, 1, true);
    const dogs = (preview as unknown as { dogs: { visual: { object: import('three').Object3D }; scale: number; z: number; x: number }[] }).dogs;
    expect(dogs[1]!.scale).toBeCloseTo(DOG_SELECT.highlightScale, 2);
    expect(dogs[0]!.scale).toBeCloseTo(DOG_SELECT.restScale, 2);
    expect(dogs[1]!.z).toBeGreaterThan(dogs[0]!.z);
    expect(dogs[0]!.x).toBeLessThan(dogs[1]!.x);
    // Facing the camera (+z), turned only a little towards the middle.
    for (const dog of dogs) expect(Math.abs(dog.visual.object.rotation.y)).toBeLessThan(0.3);
    preview.dispose();
  });

  it('the highlighted dog hops now and then; with reduced motion nobody hops', () => {
    const lively = new DogPreview(DOGS, undefined, seeded());
    let highest = 0;
    const dogs = (p: DogPreview) => (p as unknown as { dogs: { visual: { object: import('three').Object3D } }[] }).dogs;
    run(lively, 8, 0, false, () => (highest = Math.max(highest, dogs(lively)[0]!.visual.object.position.y)));
    expect(highest).toBeGreaterThan(DOG_SELECT.hopHeight * 0.8);
    lively.dispose();

    const calm = new DogPreview(DOGS, undefined, seeded());
    highest = 0;
    run(calm, 8, 0, true, () => {
      for (const dog of dogs(calm)) highest = Math.max(highest, dog.visual.object.position.y);
    });
    expect(highest).toBe(0);
    calm.dispose();
  });

  it('finds the dog under a tap or click (by where it is on screen)', async () => {
    const preview = new DogPreview(DOGS, undefined, seeded());
    // Frame it as a desktop window would (the camera needs an aspect).
    (preview as unknown as { frame(aspect: number): void }).frame(16 / 9);
    run(preview, 1, 0, true);
    expect(preview.dogAt(-0.3)).toBe(0);
    expect(preview.dogAt(0.3)).toBe(1);
    // Far out to the side, past every dog: nobody (the arrows are there for that).
    expect(preview.dogAt(-0.99)).toBe(-1);
    preview.dispose();
  });

  it('leaves nothing behind when the screen closes', () => {
    const preview = new DogPreview(DOGS, undefined, seeded());
    let disposed = 0;
    preview.scene.traverse((o) => {
      if (o instanceof Mesh) o.geometry.addEventListener('dispose', () => disposed++);
    });
    preview.dispose();
    expect(disposed).toBeGreaterThan(20);
    expect(preview.scene.children).toHaveLength(0);
  });
});
