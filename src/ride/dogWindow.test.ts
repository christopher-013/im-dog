import { Box3, Group, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { DOGS } from '../config/dogs';
import { CAR_IDS } from '../config/cars';
import { RIDE } from '../config/ride';
import { CoastDrive } from './CoastDrive';
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

describe.each(CAR_IDS)('%s: the face shot', (carId) => {
  it.each(DOGS)('$name: visible window face in portrait/landscape, and no drone-transition jump', (profile) => {
    const drive = new CoastDrive(carId), dog = new ToonMokeVisual(profile.look);
    drive.dogSeat.add(dog.object);
    const p = drive.car.headOut, animation = new MokeAnimationController();
    dog.object.position.set(p.x, p.y, p.z);
    dog.object.rotation.order = 'YXZ'; dog.object.rotation.set(p.pitch, p.heading, 0);
    // Finish the takeoff before selecting the passenger shot.
    for (let i = 0; i < 7 * 30; i++) drive.update(1 / 30, 16 / 9);
    drive.setView('face', RIDE.cameraTour.blend);
    for (let i = 0; i < 3 * 30; i++) drive.update(1 / 30, 16 / 9);
    for (const aspect of [16 / 9, 390 / 844]) {
      drive.update(0, aspect);
      for (const yaw of [RIDE.look.wander.yaw[0], 0, RIDE.look.wander.yaw[1]]) {
        const state = animation.update(0, { speed: 0, turnRate: 0, headroom: 2 });
        state.headPitch = p.headPitch; state.headYaw = yaw; state.wind = 1;
        dog.update(0, state);
        drive.scene.updateMatrixWorld(true);
        for (const point of [dog.attachments.head!, dog.attachments.mouth]) {
          const screen = point.getWorldPosition(new Vector3()).project(drive.camera);
          expect(Math.abs(screen.x)).toBeLessThan(0.9);
          expect(Math.abs(screen.y)).toBeLessThan(0.9);
          expect(screen.z).toBeGreaterThan(-1);
          expect(screen.z).toBeLessThan(1);
        }
      }
    }
    const before = drive.camera.position.clone();
    drive.setView('drone', RIDE.cameraTour.blend);
    drive.update(0, 390 / 844);
    expect(drive.camera.position.distanceTo(before)).toBeLessThan(0.001);
    for (let i = 0; i < 30; i++) drive.update(1 / 30, 390 / 844);
    const interrupted = drive.camera.position.clone();
    drive.setView('face');
    drive.update(0, 390 / 844);
    expect(drive.camera.position.distanceTo(interrupted)).toBeLessThan(0.001);
    drive.dispose(); dog.dispose();
  });
});

describe.each(CAR_IDS)('%s: the alongside shot', (carId) => {
  it.each(DOGS)('$name: in the picture on a portrait phone as well as on a wide screen', (profile) => {
    const drive = new CoastDrive(carId), dog = new ToonMokeVisual(profile.look);
    drive.dogSeat.add(dog.object);
    const p = drive.car.headOut, animation = new MokeAnimationController();
    dog.object.position.set(p.x, p.y, p.z);
    dog.object.rotation.order = 'YXZ'; dog.object.rotation.set(p.pitch, p.heading, 0);
    for (let i = 0; i < 7 * 30; i++) drive.update(1 / 30, 16 / 9);
    expect(drive.view).toBe('alongside');
    for (const aspect of [16 / 9, 4 / 3, 1, 390 / 844, 360 / 800]) {
      drive.update(0, aspect);
      for (const yaw of [RIDE.look.wander.yaw[0], 0, RIDE.look.wander.yaw[1]]) {
        const state = animation.update(0, { speed: 0, turnRate: 0, headroom: 2 });
        state.headPitch = p.headPitch; state.headYaw = yaw; state.wind = 1;
        dog.update(0, state);
        drive.scene.updateMatrixWorld(true);
        for (const point of [dog.attachments.head!, dog.attachments.mouth]) {
          const screen = point.getWorldPosition(new Vector3()).project(drive.camera);
          expect(Math.abs(screen.x)).toBeLessThan(0.9);
          expect(Math.abs(screen.y)).toBeLessThan(0.9);
        }
      }
    }
    drive.dispose(); dog.dispose();
  });
});
