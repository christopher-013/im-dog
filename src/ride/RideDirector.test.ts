import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import { StylizedHumanVisual } from '../human/StylizedHumanVisual';
import { ToonMokeVisual } from '../player/ToonMokeVisual';
import { GarageView } from '../world/GarageView';
import { GARAGE } from '../world/home/layout';
import { RideDirector } from './RideDirector';

describe('going for a ride: the ride itself (Phase 6)', () => {
  it('out to the car, the drive, home again: every step happens, and they end up back in the living room', async () => {
    const scene = new Scene();
    const garage = new GarageView();
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
    // The cinematic out: the door opens, he hops in, the roll-up door goes up, they back out.
    let doorOpened = false, inTheCar = false, rolledUp = false;
    for (let i = 0; i < 20 / dt && !loaded; i++) {
      ride.update(dt, 16 / 9, false);
      doorOpened ||= garage.houseDoorOpenness > 0.95;
      rolledUp ||= garage.rollUpOpenness > 0.95;
      inTheCar ||= dog.object.position.y > 0.5 && dog.object.position.z > 5.5;
    }
    expect(doorOpened && inTheCar && rolledUp).toBe(true);
    expect(garage.car.object.position.z).toBeGreaterThan(GARAGE.zMax);
    await loaded;
    await new Promise((r) => setTimeout(r, 0));
    ride.update(dt, 16 / 9, false);
    expect(ride.driving).toBe(true);
    // In the car: the dog in the passenger seat, the human at the wheel, window down; FSD-style auto views and barks.
    expect(dog.object.parent).not.toBe(scene);
    for (let i = 0; i < 40 / dt; i++) ride.update(dt, 16 / 9, true);
    // Head home, and the ride runs to its end.
    ride.headHome();
    for (let i = 0; i < 60 / dt && ride.driving; i++) ride.update(dt, 16 / 9, false);
    expect(ride.driving).toBe(false);
    expect(dog.object.parent).toBe(scene);
    for (let i = 0; i < 30 / dt && ride.active; i++) ride.update(dt, 16 / 9, false);
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
