import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { BOWL_REFILL } from '../config/activities';
import { DOGS } from '../config/dogs';
import { MokeAnimationController, type MokeAnimationState } from './MokeAnimationController';
import { ToonMokeVisual } from './ToonMokeVisual';

/** The bowls' inner radius (m): the steel water bowl and the slow feeder are about this wide inside. */
const BOWL_RADIUS = 0.08;

describe('at his bowls', () => {
  it.each(DOGS.map((dog) => [dog.name, dog] as const))(
    "%s's muzzle ends up in the bowl, eating and drinking, from where he steps in to (BOWL_REFILL.standoff)",
    (_name, dog) => {
      const visual = new ToonMokeVisual(dog.look);
      const base = new MokeAnimationController().state;
      for (const pose of [{ eat: 1 }, { drink: 1 }] as Partial<MokeAnimationState>[]) {
        const state = { ...base, ...pose };
        for (let i = 0; i < 30; i++) visual.update(1 / 60, state);
        visual.object.updateMatrixWorld(true);
        // Facing +z from the origin; the bowl's middle is `standoff` ahead.
        const mouth = visual.attachments.mouth.getWorldPosition(new Vector3());
        expect(Math.abs(mouth.z - BOWL_REFILL.standoff), JSON.stringify(pose)).toBeLessThan(BOWL_RADIUS * 0.6);
        expect(Math.abs(mouth.x)).toBeLessThan(0.02);
        expect(mouth.y, 'head down, at the bowl').toBeLessThan(0.2);
      }
      visual.dispose();
    },
  );
});
