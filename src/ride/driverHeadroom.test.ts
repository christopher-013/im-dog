import { Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { createVisualState, HumanAnimationController } from '../human/HumanAnimationController';
import { HOUSEHOLD } from '../human/household';
import { StylizedHumanVisual } from '../human/StylizedHumanVisual';
import { CAR_IDS } from '../config/cars';
import { createCar } from '../world/cars';

/** From the head joint to the top of the hair, standing straight (the rig's units). */
const HEAD_TO_TOP = 0.233;

describe.each(CAR_IDS)('the driver at the wheel: %s (Phase 6)', (carId) => {
  for (const [who, look] of Object.entries(HOUSEHOLD)) {
    it(`${carId}: the ${who}'s head stays under the glass, with room to spare`, () => {
      const car = createCar(carId);
      const visual = new StylizedHumanVisual(look);
      const animation = new HumanAnimationController();
      animation.scale = visual.scale ?? 1;
      // Sat back in the driver's seat exactly as the ride puts them there (RideDirector.sitAtWheel).
      const seat = car.seats.driver;
      car.object.add(visual.object);
      visual.object.position.set(seat.x, seat.y - 0.17, seat.z - 0.08);
      const pose = { ...createVisualState(), sit: 1, sitStyle: 'lounge' as const, seatHeight: 0.17 };
      for (let i = 0; i < 120; i++) visual.apply(1 / 60, animation.update(1 / 60, pose));
      car.object.updateMatrixWorld(true);
      const head = visual.object.getObjectByName('head')!.getWorldPosition(new Vector3());
      car.object.remove(visual.object);
      const top = head.y + HEAD_TO_TOP * (visual.scale ?? 1);
      const glass = new Raycaster(new Vector3(head.x, 4, head.z), new Vector3(0, -1, 0)).intersectObject(car.object, true).find((hit) => hit.point.y > 1);
      expect(glass).toBeDefined();
      expect(top).toBeLessThan(glass!.point.y - 0.05);
      visual.dispose();
      car.dispose();
    });
  }
});
