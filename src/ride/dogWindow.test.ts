import { Box3, Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { DOGS } from '../config/dogs';
import { DeLoreanCar } from '../world/DeLoreanCar';
import { MokeAnimationController } from '../player/MokeAnimationController';
import { ToonMokeVisual } from '../player/ToonMokeVisual';

describe('DeLorean passenger window', () => {
  it.each(DOGS)('$name: head out above the sill, paws inside the door', (profile) => {
    const car = new DeLoreanCar();
    const dog = new ToonMokeVisual(profile.look);
    const seat = new Group(); seat.position.copy(car.seats.passenger);
    car.object.add(seat); seat.add(dog.object);
    const p = car.headOut;
    dog.object.position.set(p.x, p.y, p.z);
    dog.object.rotation.order = 'YXZ'; dog.object.rotation.set(p.pitch, p.heading, 0);
    const animation = new MokeAnimationController();
    for (let i = 0; i < 120; i++) {
      const state = animation.update(1 / 60, { speed: 0, turnRate: 0, headroom: 2 });
      state.sit = state.rest = 0; state.headPitch = p.headPitch; state.wind = 1;
      dog.update(1 / 60, state);
    }
    car.object.updateMatrixWorld(true);
    const mouth = dog.attachments.mouth.getWorldPosition(new Vector3());
    expect(mouth.y).toBeGreaterThan(0.91);
    expect(mouth.x).toBeLessThan(-0.94);
    for (const end of ['front_L', 'front_R', 'hind_L', 'hind_R']) {
      const leg = dog.object.getObjectByName(`hip_${end}`)!;
      expect(new Box3().setFromObject(leg).min.x).toBeGreaterThan(-0.93);
    }
    car.dispose(); dog.dispose();
  });
});
