import { Box3, Mesh, Texture } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { CARS } from '../config/cars';
import { GARAGE } from './home/layout';
import { createCar, pickCar } from './cars';
import { GarageView } from './GarageView';

describe('ride car selection', () => {
  it('persists balanced random pairs across rides, without depending on the human or dog', () => {
    let saved: string | null = null;
    const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value; } };
    const random = vi.fn().mockReturnValueOnce(0.9).mockReturnValueOnce(0.1).mockReturnValue(0.7);
    const picks = Array.from({ length: 100 }, () => pickCar(storage, random));
    expect(picks.slice(0, 4)).toEqual(['delorean', 'family', 'family', 'delorean']);
    expect(picks.filter((id) => id === 'family')).toHaveLength(50);
    expect(picks.filter((id) => id === 'delorean')).toHaveLength(50);
    expect(random).toHaveBeenCalledTimes(50);
    for (let i = 0; i < picks.length; i += 2) expect(new Set(picks.slice(i, i + 2)).size).toBe(2);
  });
  it('handles unavailable, denied and corrupt storage without preventing play', () => {
    expect(pickCar(null, () => 0)).toBe('family');
    expect(pickCar(null, () => 1)).toBe('delorean');
    const denied = { getItem: () => { throw new Error('Denied'); }, setItem: () => { throw new Error('Denied'); } };
    expect(pickCar(denied, () => 0.8)).toBe('delorean');
    for (const saved of ['{', '["unknown"]', '["family","family"]', '{}']) {
      expect(pickCar({ getItem: () => saved, setItem: () => {} }, () => 0.8)).toBe('delorean');
    }
  });
});

describe('preparing another ride', () => {
  it('chooses only at boarding, swaps the parked model and disposes the previous car', () => {
    const next = vi.fn().mockReturnValueOnce('delorean').mockReturnValueOnce('family');
    const garage = new GarageView(next);
    const dispose = vi.spyOn(garage.car, 'dispose');
    expect(next).not.toHaveBeenCalled();
    garage.prepareRide();
    expect(next).toHaveBeenCalledTimes(1);
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(garage.car.id).toBe('delorean');
    expect(garage.car.object.parent).toBe(garage.object);
    garage.prepareRide();
    expect(garage.car.id).toBe('family');
    expect(garage.car.object.position.z).toBe(GARAGE.car.z);
    garage.dispose();
  });
});

describe('DeLorean ride presentation', () => {
  it('has the owner-requested badges and movie registration, never a real private plate', () => {
    const car = createCar('delorean');
    expect(car.object.getObjectByName('DMC grille badge')!.userData.marking).toBe('DMC');
    expect(car.object.getObjectByName('DeLorean rear badge')!.userData.marking).toBe('DeLorean');
    expect(car.object.getObjectByName('OUTATIME license plate')!.userData.marking).toBe('OUTATIME');
    car.dispose();
  });
  it('fits the garage, opens both gull wings upward, independently boards each side and closes without drift', () => {
    const garage = new GarageView('delorean');
    const car = garage.car;
    const bounds = () => { garage.object.updateMatrixWorld(true); return new Box3().setFromObject(car.object); };
    const shut = bounds();
    expect(shut.max.y).toBeLessThan(1.6);
    car.setFalconDoors(1);
    const open = bounds();
    expect(open.max.y).toBeGreaterThan(shut.max.y + 0.4);
    expect(open.max.y).toBeLessThan(GARAGE.ceiling - 0.1);
    expect(open.max.x).toBeLessThan(GARAGE.xMax - 0.1);
    // Closing the passenger boarding command cannot cancel the open-wing greeting.
    car.setPassengerDoor(1); car.setPassengerDoor(0);
    expect(bounds().max.y).toBeCloseTo(open.max.y);
    car.setFalconDoors(0);
    expect(bounds().max.y).toBeCloseTo(shut.max.y);
    car.setDriverDoor(1);
    expect(bounds().max.y).toBeGreaterThan(shut.max.y + 0.4);
    car.setDriverDoor(0);
    expect(bounds().max.y).toBeCloseTo(shut.max.y);
    car.setPassengerWindow(1);
    expect(car.object.getObjectByName('passenger window')!.visible).toBe(false);
    car.setPassengerWindow(0);
    expect(car.object.getObjectByName('passenger window')!.visible).toBe(true);
    expect(car.seats.passenger.y).toBe(CARS.delorean.passenger[1]);
    garage.dispose();
  });
  it('batches detailed static geometry and releases every owned resource exactly once', () => {
    const car = createCar('delorean');
    const geometry = new Set<Mesh['geometry']>();
    const materials = new Set<import('three').Material>();
    let meshes = 0, triangles = 0;
    car.object.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      meshes++; geometry.add(o.geometry);
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position!.count) / 3;
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    });
    expect(meshes).toBeLessThan(55);
    expect(triangles).toBeLessThan(25_000);
    const disposals = [...geometry, ...materials].map((resource) => vi.spyOn(resource, 'dispose'));
    const textures = new Set<Texture>();
    for (const material of materials) for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
    const disposeTextures = [...textures].map((texture) => vi.spyOn(texture, 'dispose'));
    car.dispose();
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
    for (const dispose of disposeTextures) expect(dispose).toHaveBeenCalledTimes(1);
  });
});
