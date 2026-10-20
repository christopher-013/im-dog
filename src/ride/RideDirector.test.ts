import { Quaternion, Scene, SkinnedMesh, Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CAR_IDS } from '../config/cars';
import { RIDE } from '../config/ride';
import { MOKE_DOG_LOOK } from '../config/dogLooks';
import { Harness } from '../player/Harness';
import { StylizedHumanVisual } from '../human/StylizedHumanVisual';
import { ToonMokeVisual } from '../player/ToonMokeVisual';
import { GarageView } from '../world/GarageView';
import { GARAGE } from '../world/home/layout';
import type { CoastDrive, DriveView } from './CoastDrive';
import { RideDirector } from './RideDirector';
import { tourViews } from './RideCameraTour';

describe('going for a ride: the ride itself (Phase 6)', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(CAR_IDS)('%s: a full ride shows every view once for at least 12 seconds, even with FSD off', async (id) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5); // deterministic gaze/pant timing in the face-shot assertion
    const scene = new Scene(), garage = new GarageView(id);
    const dog = new ToonMokeVisual(), human = new StylizedHumanVisual();
    scene.add(garage.object, dog.object, human.object);
    const module = await import('./CoastDrive');
    const ride = new RideDirector({ scene, garage, dog, human }, {
      loadDrive: async () => module, done() {}, fade() {}, music() {}, say() {}, leash() {}, harnessOff() {},
    });
    ride.start();
    for (let i = 0; i < 19 * 30; i++) ride.update(1 / 30, 16 / 9, false);
    await Promise.resolve();
    const drive = (ride as unknown as { drive: CoastDrive }).drive;
    const setView = vi.spyOn(drive, 'setView');
    let happyFace = false;
    const updateDog = dog.update.bind(dog);
    vi.spyOn(dog, 'update').mockImplementation((dt, state) => {
      // VisualState is reused each frame: inspect at the call, don't retain its mutable reference.
      happyFace ||= drive.view === 'face' && state.wind === 1 && state.tailWag >= 0.9 && state.tongue > 0.8;
      updateDog(dt, state);
    });
    const dt = 1 / 30;
    // Takeoff and the slow neighborhood start stay with the opening shot, not a seven-second cycle.
    for (let i = 0; i < 10 * 30; i++) ride.update(dt, 16 / 9, false);
    expect(setView).not.toHaveBeenCalled();
    const pausedCamera = drive.camera.position.clone();
    for (let i = 0; i < 100; i++) ride.update(0, 16 / 9, false);
    expect(drive.camera.position.equals(pausedCamera)).toBe(true);
    const tour = tourViews(drive.views);
    const durations: Partial<Record<DriveView, number>> = Object.fromEntries(tour.map((v) => [v, v === 'alongside' ? 10 : 0]));
    let sinceChange = 0;
    // Run through actual arrival (not an estimated ride time) to prove all four shots fit in BOTH cars' trips.
    for (let i = 0; i < 180 * 30 && ride.driving; i++) {
      const previous = drive.view;
      ride.update(dt, 16 / 9, false);
      durations[previous] = (durations[previous] ?? 0) + dt;
      sinceChange = previous === drive.view ? sinceChange + dt : 0;
      if (ride.driving && drive.view === 'face' && sinceChange > RIDE.cameraTour.blend + 1) {
        drive.scene.updateMatrixWorld(true);
        const head = dog.attachments.head!.getWorldPosition(new Vector3()).project(drive.camera);
        expect(Math.abs(head.x)).toBeLessThan(0.95);
        expect(Math.abs(head.y)).toBeLessThan(0.95);
      }
    }
    expect(ride.driving).toBe(false);
    // Four shots, once each: the black car tours Inside in Behind's place.
    expect(setView.mock.calls.map(([view]) => view)).toEqual(tour.slice(1));
    expect(tour.includes('cabin')).toBe(id === 'kitt');
    for (const seconds of Object.values(durations)) expect(seconds).toBeGreaterThanOrEqual(12);
    expect(setView.mock.calls.every(([, blend]) => blend === RIDE.cameraTour.blend)).toBe(true);
    expect(happyFace).toBe(true);
    // A fresh trip resets the schedule; manual changes still receive their full hold.
    for (let i = 0; i < 20 * 30; i++) ride.update(dt, 16 / 9, false);
    ride.start();
    for (let i = 0; i < 19 * 30; i++) ride.update(dt, 16 / 9, false);
    await Promise.resolve();
    const secondDrive = (ride as unknown as { drive: CoastDrive }).drive;
    expect(secondDrive.view).toBe('alongside');
    ride.nextView();
    const manual = secondDrive.view;
    for (let i = 0; i < (RIDE.cameraTour.manualHold - 0.5) * 30; i++) ride.update(dt, 16 / 9, false);
    expect(secondDrive.view).toBe(manual);
    ride.headHome();
    ride.dispose(); garage.dispose(); dog.dispose(); human.dispose();
  }, 60_000);

  it.each(CAR_IDS)('%s: Head Home during takeoff/start fades promptly, ignores repeats, pauses safely and restores the parked car', async (id) => {
    const scene = new Scene(), garage = new GarageView(id);
    const dog = new ToonMokeVisual(), human = new StylizedHumanVisual();
    scene.add(garage.object, dog.object, human.object);
    const module = await import('./CoastDrive'), done = vi.fn();
    const ride = new RideDirector({ scene, garage, dog, human }, {
      loadDrive: async () => module, done, fade() {}, music() {}, say() {}, leash() {}, harnessOff() {},
    });
    ride.start();
    expect(ride.departing).toBe(true);
    for (let i = 0; i < 19 * 30; i++) ride.update(1 / 30, 16 / 9, false);
    await Promise.resolve();
    expect(ride.driving).toBe(true);
    expect(ride.departing).toBe(false);
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
    const harness = new Harness(MOKE_DOG_LOOK.harness);
    harness.wear(dog, human.hands.left);
    scene.add(harness.leash);
    const log: string[] = [];
    let ended: { dog: readonly number[]; human: readonly number[] } | null = null;
    let loaded: Promise<unknown> | null = null;
    const fades: number[] = [];
    const ride = new RideDirector({ dog, human, scene, garage }, {
      loadDrive: () => (loaded = import('./CoastDrive')) as Promise<typeof import('./CoastDrive')>,
      music: (on) => log.push(`music ${on}`),
      fade: (a) => fades.push(a),
      say: (text) => log.push(text),
      leash: (hand) => { log.push(hand ? 'leash on' : 'leash off'); harness.wear(dog, hand); },
      harnessOff: () => { log.push('harness off'); harness.takeOff(); },
      done: (dogAt, _dh, humanAt) => { ended = { dog: dogAt, human: humanAt }; },
    });
    // Reproduce a wall-close follow camera hiding the dog immediately before the ride takes ownership.
    dog.object.visible = false;
    ride.start();
    expect(ride.active).toBe(true);
    expect(dog.object.visible).toBe(true);
    const dt = 1 / 30;
    // The game can fade the human (in its way) in the very frame the ride starts: they're solid again at once.
    human.setSeeThrough(true);
    // The previous house frame can still hide him after start; the cinematic must restore him on its update.
    dog.object.visible = false;
    let body: SkinnedMesh | undefined;
    human.object.traverse((o) => { if (!body && o instanceof SkinnedMesh) body = o; });
    const solid = () => (body!.material as { opacity: number }).opacity === 1;
    let alwaysSolid = true, atTheWheel = false, wingsUp = 0, driverDoor = 0;
    // The cinematic out: the door opens, he hops in, the roll-up door goes up, they back out.
    let doorOpened = false, inTheCar = false, rolledUp = false;
    for (let i = 0; i < 20 / dt && !loaded; i++) {
      ride.update(dt, 16 / 9, false);
      harness.update();
      expect(dog.object.visible).toBe(true);
      if (harness.leash.visible) expect(dog.object.getObjectByName('harness')).toBeDefined();
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
    expect(dog.object.visible).toBe(true);
    expect(dog.object.parent).toBe(drive.dogSeat);
    harness.update();
    expect(harness.worn).toBe(true);
    expect(harness.leash.visible).toBe(false);
    expect(drive.dogSeat.position.equals(garage.car.seats.passenger)).toBe(true);
    expect(drive.driverSeat.position.equals(garage.car.seats.driver)).toBe(true);
    // The lower coupe needs its own window-height camera framing; no empty SUV roofline close-up.
    drive.setView('face');
    // Let the cockpit scene and the optional takeoff reveal finish before checking the actual passenger close-up.
    for (let i = 0; i < 7 * 30 || ((drive.introPlaying || drive.revealingHover) && i < 40 * 30); i++) ride.update(dt, 16 / 9, false);
    for (let i = 0; i < 2 * 30; i++) ride.update(dt, 16 / 9, false);
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
    expect(harness.worn).toBe(false);
    expect(harness.leash.visible).toBe(false);
    expect(ended!.dog[1]).toBeLessThan(3);
    expect(ended!.human[1]).toBeLessThan(3);
    ride.dispose();
    garage.dispose();
    dog.dispose();
    human.dispose();
    harness.dispose();
  }, 60_000);
});
