import { Box3, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { DOGS } from '../config/dogs';
import { MokeAnimationController } from './MokeAnimationController';
import { DogCostume } from './DogCostume';
import { ToonMokeVisual } from './ToonMokeVisual';

describe('Halloween costumes (D30)', () => {
  it('each dog has their own: Moke a pumpkin, Dougie a cape, Nori a witch hat', () => {
    expect(Object.fromEntries(DOGS.map((d) => [d.id, d.costume]))).toEqual({ moke: 'pumpkin', dougie: 'cape', nori: 'witchHat' });
  });

  it.each(DOGS.map((dog) => [dog.name, dog] as const))("%s's costume rides on the head and back sockets and comes off cleanly", (_name, dog) => {
    const visual = new ToonMokeVisual(dog.look);
    const before = new Box3().setFromObject(visual.object);
    const costume = new DogCostume(dog.costume);
    costume.wear(visual);
    expect(costume.worn.length).toBeGreaterThan(0);
    for (const part of costume.worn) expect([visual.attachments.head, visual.attachments.back]).toContain(part.parent);
    // Animating with it on is fine, and it stays on him (within a dog-and-a-hat's size of him).
    const animation = new MokeAnimationController();
    for (let i = 0; i < 30; i++) visual.update(1 / 60, animation.update(1 / 60, { speed: 1.2, turnRate: 0, headroom: 2 }));
    visual.object.updateMatrixWorld(true);
    const dressed = new Box3().setFromObject(visual.object);
    expect(dressed.max.y).toBeLessThan(before.max.y + 0.2);
    expect(dressed.getSize(new Vector3()).x).toBeLessThan(before.getSize(new Vector3()).x + 0.15);
    costume.takeOff();
    expect(costume.worn).toHaveLength(0);
    costume.dispose();
    visual.dispose();
  });

  it('a visual without a head socket just goes without the hat', () => {
    const visual = new ToonMokeVisual();
    const noHead = { ...visual, attachments: { ...visual.attachments, head: null } };
    const hat = new DogCostume('witchHat');
    hat.wear(noHead as never);
    expect(hat.worn).toHaveLength(0);
    hat.dispose();
    visual.dispose();
  });
});
