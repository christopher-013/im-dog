import { Mesh, Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CAR_IDS } from '../config/cars';
import { RIDE } from '../config/ride';
import { ToonMokeVisual } from '../player/ToonMokeVisual';
import { StylizedHumanVisual } from '../human/StylizedHumanVisual';
import { GarageView } from '../world/GarageView';
import { RideDirector } from './RideDirector';

describe.each(CAR_IDS)('front garage reveal: %s', (id) => {
  it.each([16 / 9, 390 / 844])('frames the entire car with wings raised at aspect %s, and holds through boarding', (aspect) => {
    const scene = new Scene(), garage = new GarageView(id);
    const dog = new ToonMokeVisual(), human = new StylizedHumanVisual();
    scene.add(garage.object, dog.object, human.object);
    const ride = new RideDirector({ scene, garage, dog, human }, {
      loadDrive: () => import('./CoastDrive'), music: () => {}, fade: () => {}, say: () => {},
      leash: () => {}, harnessOff: () => {}, done: () => {},
    });
    ride.start();
    for (let i = 0; i < 150; i++) ride.update(1 / 30, aspect, false);
    expect(garage.car.falconDoorsOpen).toBe(1);
    expect(ride.camera.position.toArray()).toEqual([...RIDE.garageReveal.cam]);
    scene.updateMatrixWorld(true); ride.camera.updateMatrixWorld(true);
    const point = new Vector3(); let maxX = 0, maxY = 0;
    garage.car.object.traverse((node) => {
      if (!(node instanceof Mesh)) return;
      const positions = node.geometry.attributes.position!;
      for (let i = 0; i < positions.count; i++) {
        point.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld).project(ride.camera);
        maxX = Math.max(maxX, Math.abs(point.x)); maxY = Math.max(maxY, Math.abs(point.y));
      }
    });
    expect(maxX, 'raised wings and nose stay inside the horizontal frame').toBeLessThan(1);
    expect(maxY, 'raised wings stay inside the vertical frame').toBeLessThan(1);
    for (let i = 0; i < 8 * 30; i++) ride.update(1 / 30, aspect, false);
    expect(ride.camera.position.toArray()).toEqual([...RIDE.garageReveal.cam]);
    ride.dispose(); garage.dispose(); dog.dispose(); human.dispose();
  });
});
