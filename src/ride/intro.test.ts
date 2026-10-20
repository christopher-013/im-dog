import { Box3, Scene, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { CARS } from '../config/cars';
import { StylizedHumanVisual } from '../human/StylizedHumanVisual';
import { ToonMokeVisual } from '../player/ToonMokeVisual';
import { circuitDate, circuitTime } from '../world/deLoreanCabin';
import { GarageView } from '../world/GarageView';
import { CoastDrive } from './CoastDrive';
import { RideDirector } from './RideDirector';

const uniform = (drive: CoastDrive, name: string, key: string) =>
  (drive.car.object.getObjectByName(name) as unknown as { material: { uniforms: Record<string, { value: number }> } }).material.uniforms[key]!.value;

describe('the cockpit scene as the drive begins (owner, 2026-10-20)', () => {
  it.each(['kitt', 'delorean'] as const)('%s: the camera stays inside while the car rolls slowly out of the driveway', (id) => {
    const drive = new CoastDrive(id);
    const intro = drive.car.intro!;
    expect(intro).toBeDefined();
    expect(drive.introPlaying).toBe(true);
    const cabin = new Box3().setFromObject(drive.car.object);
    let fastest = 0;
    for (let t = 0; t < intro.seconds - 0.1; t += 1 / 30) {
      const before = drive.progress * drive.length;
      drive.update(1 / 30, 16 / 9);
      fastest = Math.max(fastest, (drive.progress * drive.length - before) * 30);
      drive.car.object.updateMatrixWorld(true);
      cabin.setFromObject(drive.car.object);
      expect(cabin.containsPoint(drive.camera.position), `camera inside at ${t.toFixed(1)} s`).toBe(true);
    }
    expect(fastest).toBeLessThanOrEqual(intro.creep + 0.01);
    expect(drive.progress).toBeGreaterThan(0);
    for (let i = 0; i < 10; i++) drive.update(1 / 30, 16 / 9);
    expect(drive.introPlaying).toBe(false);
    drive.dispose();
  });

  it('Change View cuts it short (and only while it plays); the takeoff then comes straight on', () => {
    const drive = new CoastDrive('delorean');
    for (let i = 0; i < 30; i++) drive.update(1 / 30, 16 / 9);
    expect(drive.skipIntro()).toBe(true);
    expect(drive.introPlaying).toBe(false);
    expect(drive.skipIntro()).toBe(false);
    expect(drive.revealingHover).toBe(true);
    drive.dispose();
    const plain = new CoastDrive('family');
    expect(plain.introPlaying).toBe(false);
    expect(plain.skipIntro()).toBe(false);
    plain.dispose();
  });

  it('the black car talks all through it, and goes back to its own schedule after', () => {
    const drive = new CoastDrive('kitt');
    for (let i = 0; i < 30; i++) drive.update(1 / 30, 16 / 9);
    expect(uniform(drive, 'Voice box', 'talk')).toBe(1);
    for (let i = 0; i < 9 * 30; i++) drive.update(1 / 30, 16 / 9);
    expect(uniform(drive, 'Voice box', 'talk')).toBe(0);
    drive.dispose();
  });

  it('the DeLorean: the flux capacitor surges as the camera reaches it, then rests', () => {
    const drive = new CoastDrive('delorean');
    for (let i = 0; i < 2 * 30; i++) drive.update(1 / 30, 16 / 9);
    expect(uniform(drive, 'Animated flux capacitor', 'surge')).toBe(0);
    for (let i = 0; i < 6 * 30; i++) drive.update(1 / 30, 16 / 9);
    expect(uniform(drive, 'Animated flux capacitor', 'surge')).toBe(1);
    for (let i = 0; i < 4 * 30; i++) drive.update(1 / 30, 16 / 9);
    expect(uniform(drive, 'Animated flux capacitor', 'surge')).toBe(0);
    expect(drive.car.object.getObjectByName('Time circuit display')).toBeDefined();
    expect(drive.car.object.getObjectByName('Flux warning label')).toBeDefined();
    drive.dispose();
  });

  it('names it on the Change View button, and his head comes out once it is over', async () => {
    const scene = new Scene(), garage = new GarageView('kitt');
    const dog = new ToonMokeVisual(), human = new StylizedHumanVisual();
    scene.add(garage.object, dog.object, human.object);
    const module = await import('./CoastDrive');
    const ride = new RideDirector({ scene, garage, dog, human }, {
      loadDrive: async () => module, done() {}, fade() {}, music() {}, say() {}, leash() {}, harnessOff() {},
    });
    ride.start();
    for (let i = 0; i < 19 * 30; i++) ride.update(1 / 30, 16 / 9, false);
    await Promise.resolve();
    ride.update(1 / 30, 16 / 9, false);
    expect(ride.viewName).toBe('Cockpit');
    const inside = dog.object.position.clone();
    ride.nextView();
    expect(ride.viewName).toBe('Alongside');
    ride.update(1 / 30, 16 / 9, false);
    expect(dog.object.position.distanceTo(inside)).toBeGreaterThan(0.1); // out of the window now
    ride.dispose(); garage.dispose(); dog.dispose(); human.dispose();
  });
});

describe('the time circuits', () => {
  it('read the film\'s times the owner asked for, on a 12-hour clock with AM/PM', () => {
    const tc = CARS.delorean.timeCircuits;
    expect(circuitTime(circuitDate(tc.destination))).toEqual({ month: 'NOV', day: '05', year: '1955', pm: false, hour: '06', min: '00' });
    expect(circuitTime(circuitDate(tc.lastDeparted))).toEqual({ month: 'OCT', day: '26', year: '1985', pm: false, hour: '01', min: '21' });
    expect(circuitTime(new Date(2026, 9, 20, 13, 5))).toEqual({ month: 'OCT', day: '20', year: '2026', pm: true, hour: '01', min: '05' });
    expect(circuitTime(new Date(2026, 0, 1, 0, 0))).toMatchObject({ month: 'JAN', pm: false, hour: '12' });
    expect(circuitTime(new Date(2026, 0, 1, 12, 0))).toMatchObject({ pm: true, hour: '12' });
  });
});

describe("the black car's Inside view", () => {
  it('KITT: the Inside camera sits between the seats, under the roof', () => {
    const v = CARS.kitt.cabinView;
    const p = new Vector3(...v.pos);
    expect(Math.abs(p.x)).toBeLessThan(0.1);
    expect(p.y).toBeLessThan(1.26);
  });
});
