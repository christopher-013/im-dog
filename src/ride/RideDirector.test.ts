import { Quaternion, Scene, SkinnedMesh, Vector3 } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CAR_IDS } from '../config/cars';
import { RIDE } from '../config/ride';
import { StylizedHumanVisual } from '../human/StylizedHumanVisual';
import { ToonMokeVisual } from '../player/ToonMokeVisual';
import { GarageView } from '../world/GarageView';
import { GARAGE } from '../world/home/layout';
import type { CoastDrive } from './CoastDrive';
import { RideDirector } from './RideDirector';

describe('going for a ride: the ride itself (Phase 6)', () => {
  it.each(CAR_IDS)('%s: Head Home during takeoff/start fades promptly, ignores repeats, pauses safely and restores the parked car', async (id) => {
    const scene = new Scene(), garage = new GarageView(id);
    const dog = new ToonMokeVisual(), human = new StylizedHumanVisual();
    scene.add(garage.object, dog.object, human.object);
    const module = await import('./CoastDrive'), done = vi.fn();
    const ride = new RideDirector({ scene, garage, dog, human }, {
      loadDrive: async () => module, done, fade() {}, music() {}, say() {}, leash() {}, harnessOff() {},
    });
    ride.start();
    for (let i = 0; i < 19 * 30; i++) ride.update(1 / 30, 16 / 9, false);
    await Promise.resolve();
    expect(ride.driving).toBe(true);
    ride.update(1, 16 / 9, false);
    ride.headHome(); ride.headHome();
    expect(ride.returning).toBe(true);
    ride.update(0, 16 / 9, false);
    expect(ride.driving).toBe(true);
    for (let i = 0; i < (RIDE.headHomeFade + 0.1) * 30; i++) ride.update(1 / 30, 16 / 9, false);
    expect(ride.driving).toBe(false);
    expect(dog.object.parent).toBe(scene);
    for (let i = 0; i < 20 * 30; i++) ride.update(1 / 30, 16 / 9, false);
    expect(ride.active).toBe(false);
    expect(done).toHaveBeenCalledTimes(1);
    expect(garage.car.object.getObjectByName('Hover aura')?.visible ?? false).toBe(false);
    expect(garage.houseDoorOpenness).toBe(0);
    ride.dispose(); garage.dispose(); dog.dispose(); human.dispose();
  });
  it.each(CAR_IDS)('%s: out to the car, the drive, home again: every step happens, and they end up back in the living room', async (carId) => {
    const scene = new Scene();
    const garage = new GarageView(carId);
    const dog = new ToonMokeVisual();
    const human = new StylizedHumanVisual();
    scene.add(garage.object, dog.object, human.object);
    const log: string[] = [];
    let ended: { dog: readonly number[]; human: readonly number[] } | null = null;
    let loaded: Promise<unknown> | null = null;
    const fades: number[] = [];
    const ride = new RideDirector({ dog, human, scene, garage }, {
      loadDrive: () => (loaded = import('./CoastDrive')) as Promise<typeof import('./CoastDrive')>,
      music: (on) => log.push(`music ${on}`),
      fade: (a) => fades.push(a),
      say: (text) => log.push(text),
      leash: (hand) => log.push(hand ? 'leash on' : 'leash off'),
      harnessOff: () => log.push('harness off'),
      done: (dogAt, _dh, humanAt) => { ended = { dog: dogAt, human: humanAt }; },
    });
    ride.start();
    expect(ride.active).toBe(true);
    const dt = 1 / 30;
    // The game can fade the human (in its way) in the very frame the ride starts: they're solid again at once.
    human.setSeeThrough(true);
    let body: SkinnedMesh | undefined;
    human.object.traverse((o) => { if (!body && o instanceof SkinnedMesh) body = o; });
    const solid = () => (body!.material as { opacity: number }).opacity === 1;
    let alwaysSolid = true, atTheWheel = false, wingsUp = 0, driverDoor = 0;
    // The cinematic out: the door opens, he hops in, the roll-up door goes up, they back out.
    let doorOpened = false, inTheCar = false, rolledUp = false;
    for (let i = 0; i < 20 / dt && !loaded; i++) {
      ride.update(dt, 16 / 9, false);
      doorOpened ||= garage.houseDoorOpenness > 0.95;
      rolledUp ||= garage.rollUpOpenness > 0.95;
      inTheCar ||= dog.object.position.y >= garage.car.seats.passenger.y && dog.object.position.z > 5.5;
      if (i > 30) alwaysSolid &&= solid();
      // Once in, they're at the wheel (seen through the windshield), not gone.
      atTheWheel ||= human.object.parent === garage.car.object && human.object.visible;
      wingsUp = Math.max(wingsUp, garage.car.falconDoorsOpen);
      driverDoor = Math.max(driverDoor, garage.car.driverDoorOpen);
    }
    // They opened the driver's door to get in, and shut it behind them.
    expect(driverDoor).toBeGreaterThan(0.95);
    expect(garage.car.driverDoorOpen).toBe(0);
    // The car raised its falcon doors to greet them, and shut them again before backing out.
    expect(wingsUp).toBeGreaterThan(0.95);
    expect(garage.car.falconDoorsOpen).toBe(0);
    expect(alwaysSolid).toBe(true);
    expect(atTheWheel).toBe(true);
    expect(doorOpened && inTheCar && rolledUp).toBe(true);
    expect(garage.car.object.position.z).toBeGreaterThan(GARAGE.zMax);
    await loaded;
    await new Promise((r) => setTimeout(r, 0));
    ride.update(dt, 16 / 9, false);
    expect(ride.driving).toBe(true);
    const drive = (ride as unknown as { drive: CoastDrive }).drive;
    expect(drive.car.id).toBe(carId);
    expect(drive.dogSeat.position.equals(garage.car.seats.passenger)).toBe(true);
    expect(drive.driverSeat.position.equals(garage.car.seats.driver)).toBe(true);
    // The lower coupe needs its own window-height camera framing; no empty SUV roofline close-up.
    drive.setView('face');
    // Let the optional takeoff reveal finish before checking the actual passenger close-up.
    for (let i = 0; i < 7 * 30; i++) ride.update(dt, 16 / 9, false);
    drive.scene.updateMatrixWorld(true);
    const inShot = dog.attachments.head!.getWorldPosition(new Vector3()).project(drive.camera);
    expect(Math.abs(inShot.x)).toBeLessThan(0.95);
    expect(Math.abs(inShot.y)).toBeLessThan(0.95);
    // In the car: the dog in the passenger seat, the human at the wheel, window down; FSD-style auto views and barks.
    expect(dog.object.parent).not.toBe(scene);
    // Looking around turns his head: toward the front of the car, then back over his shoulder, out of his window.
    const car = (ride as unknown as { drive: CoastDrive }).drive.car.object;
    const gaze = () => {
      const q = dog.attachments.head!.getWorldQuaternion(new Quaternion());
      return new Vector3(0, 0, 1).applyQuaternion(q).applyQuaternion(car.getWorldQuaternion(new Quaternion()).invert());
    };
    for (let i = 0; i < 30; i++) { ride.look(0.1, 0); ride.update(dt, 16 / 9, false); }
    const ahead = gaze();
    for (let i = 0; i < 60; i++) { ride.look(-0.1, 0); ride.update(dt, 16 / 9, false); }
    const behind = gaze();
    expect(ahead.z).toBeGreaterThan(behind.z + 0.8);
    expect(ahead.x).toBeLessThan(0);
    expect(behind.x).toBeLessThan(0);
    for (let i = 0; i < 40 / dt; i++) ride.update(dt, 16 / 9, true);
    // Head home, and the ride runs to its end.
    ride.headHome();
    for (let i = 0; i < 60 / dt && ride.driving; i++) ride.update(dt, 16 / 9, false);
    expect(ride.driving).toBe(false);
    expect(dog.object.parent).toBe(scene);
    // Home: the driver's door opens to let them out, and shuts again.
    let outDoor = 0;
    for (let i = 0; i < 30 / dt && ride.active; i++) {
      ride.update(dt, 16 / 9, false);
      outDoor = Math.max(outDoor, garage.car.driverDoorOpen);
    }
    expect(outDoor).toBeGreaterThan(0.95);
    expect(ride.active).toBe(false);
    expect(ended).not.toBeNull();
    expect(log).toContain('Best ride ever, Moke!');
    expect(log).toContain('harness off');
    expect(log[0]).toBe('music true');
    expect(log[log.length - 1]).toBe('music false');
    expect(fades[fades.length - 1]).toBe(0);
    // Parked again, both doors shut, and the two of them in the living room by the Garage door.
    expect(garage.car.object.position.z).toBeCloseTo(GARAGE.car.z);
    expect(garage.houseDoorOpenness).toBe(0);
    expect(garage.rollUpOpenness).toBe(0);
    expect(ended!.dog[1]).toBeLessThan(3);
    expect(ended!.human[1]).toBeLessThan(3);
    ride.dispose();
    garage.dispose();
    dog.dispose();
    human.dispose();
  }, 60_000);
});
