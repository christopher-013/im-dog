import { Box3 } from 'three';
import { describe, expect, it } from 'vitest';
import { HUMAN } from '../config/human';
import { MOKE_BODY, MOVEMENT } from '../config/movement';
import { NavGrid } from '../human/NavGrid';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { MokeController } from '../player/MokeController';
import { FamilyCar } from './FamilyCar';
import { GarageView } from './GarageView';
import { Home } from './Home';
import { GARAGE } from './home/layout';

const home = new Home();
const door = GARAGE.houseDoor;

describe('the Garage (Phase 6, D32)', () => {
  it('has its door in the living room, left of the TV, and is locked in play: no way in for the dog or the human', () => {
    // Left of the TV (on the console at x 0.3) as you face it from the couch, i.e. further east.
    expect(door.x).toBeGreaterThan(1.2);
    expect(door.x + door.width / 2).toBeLessThan(3.5);
    const inside = { x: door.x, z: 4.2 };
    const livingRoom = { x: door.x, z: 2.5 };
    for (const nav of [
      new NavGrid(home.colliders, { bounds: { ...home.bounds, maxZ: GARAGE.zMax }, cell: 0.05, agentRadius: MOKE_BODY.radius + 0.01, minY: 0.03, maxY: 0.38 }),
      new NavGrid(home.colliders, { bounds: { ...home.bounds, maxZ: GARAGE.zMax }, cell: 0.1, agentRadius: HUMAN.body.radius, minY: 0.08, maxY: 1.7 }),
    ]) {
      expect(nav.isWalkable(livingRoom.x, livingRoom.z)).toBe(true);
      expect(nav.isWalkable(inside.x + 0.6, inside.z)).toBe(true);
      expect(nav.region(inside.x + 0.6, inside.z)).not.toBe(nav.region(livingRoom.x, livingRoom.z));
    }
  });

  it('stops the dog at the door, however hard he pushes', async () => {
    const physics = await PhysicsWorld.create();
    physics.addStaticBoxes(home.colliders);
    physics.commitStaticGeometry();
    const moke = new MokeController(new CharacterBody(physics, { x: door.x, y: 0, z: 2.4 }, MOKE_BODY), 0, { ...MOVEMENT });
    for (let i = 0; i < 4 * 60; i++) {
      moke.fixedUpdate(1 / 60, { x: 0, z: 1, walk: false, run: true });
      physics.step();
    }
    expect(moke.position.z).toBeLessThan(3);
    physics.world.free();
  });

  it('the car: black, unbadged, the passenger door opens and its window rolls down', () => {
    const garage = new GarageView('family');
    const car = garage.car;
    const names: string[] = [];
    car.object.traverse((o) => names.push(o.name.toLowerCase()));
    expect(names.some((n) => /tesla|model x/.test(n))).toBe(false);
    expect(car.object.position.x).toBeCloseTo(GARAGE.car.x);
    car.setPassengerDoor(1);
    car.setPassengerWindow(1);
    expect(car.passengerDoorOpen).toBe(1);
    expect(car.passengerWindowDown).toBe(1);
    // Its passenger side faces the east wall once parked nose-in: car −x is world +x.
    car.object.updateMatrixWorld(true);
    const seat = car.object.localToWorld(FamilyCar.SEATS.passenger.clone());
    expect(seat.x).toBeGreaterThan(GARAGE.car.x);
    garage.setHouseDoor(1);
    garage.setRollUp(1);
    expect(garage.houseDoorOpenness).toBe(1);
    garage.dispose();
  });

  it('the falcon-wing doors: shut, flush with the roof; up, they stand above it and reach out over the sides, clear of the Garage ceiling', () => {
    const car = new FamilyCar();
    const size = () => {
      car.object.updateMatrixWorld(true);
      return new Box3().setFromObject(car.object);
    };
    const shut = size();
    expect(shut.max.y).toBeLessThan(FamilyCar.SIZE.height + 0.05);
    car.setFalconDoors(1);
    expect(car.falconDoorsOpen).toBe(1);
    const up = size();
    expect(up.max.y).toBeGreaterThan(2.1);
    expect(up.max.y).toBeLessThan(GARAGE.ceiling - 0.1);
    // Out over both sides (mirrors aside, the shut car's widest point).
    expect(up.max.x).toBeGreaterThan(shut.max.x + 0.2);
    expect(up.min.x).toBeLessThan(shut.min.x - 0.2);
    car.setFalconDoors(0);
    expect(size().max.y).toBeCloseTo(shut.max.y, 5);
    // The driver's door swings out on its own side (+x).
    car.setDriverDoor(1);
    expect(car.driverDoorOpen).toBe(1);
    expect(size().max.x).toBeGreaterThan(shut.max.x + 0.5);
    car.dispose();
  });
});
