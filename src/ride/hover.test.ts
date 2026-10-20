import { Mesh, NormalBlending, Vector3, type MeshBasicMaterial, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { CARS } from '../config/cars';
import { DeLoreanCar } from '../world/DeLoreanCar';
import { CoastDrive } from './CoastDrive';
import { drivePath, routeCurve, samplePath } from './coastRoute';
import { hoverAltitude } from './hover';
import { departureRoute } from './departureRoute';

describe('DeLorean hover presentation', () => {
  it('puts four stronger blue pools under the wheels and keeps them on the road as the body bobs', () => {
    const car = new DeLoreanCar();
    const pool = car.object.getObjectByName('Hover underglow') as Mesh;
    const positions = pool.geometry.attributes.position!;
    expect(positions.count).toBe(16); // four merged quads, not one chassis-wide glow
    const centres: Vector3[] = [];
    for (let i = 0; i < positions.count; i += 4) {
      const centre = new Vector3();
      for (let j = 0; j < 4; j++) centre.add(new Vector3().fromBufferAttribute(positions, i + j));
      centres.push(centre.multiplyScalar(0.25));
    }
    expect(new Set(centres.map((p) => p.x.toFixed(2))).size).toBe(2);
    expect(new Set(centres.map((p) => p.z.toFixed(2))).size).toBe(2);
    for (const time of [4, 5, 6]) {
      car.object.position.y = hoverAltitude(time, CARS.delorean.hover);
      car.setHover(1, time); car.object.updateMatrixWorld(true);
      for (const centre of centres) {
        expect(pool.localToWorld(centre.clone()).y).toBeCloseTo(0.05);
        expect(Math.abs(centre.x)).toBeCloseTo(0.91 + CARS.delorean.hover.wheelOut);
      }
      const material = pool.material as MeshBasicMaterial;
      expect(material.blending).toBe(NormalBlending); // preserve blue rather than bleaching it on sunlit asphalt
      expect(material.opacity).toBeGreaterThan(0.60);
    }
    car.dispose();
  });
  it('folds all four wheels outward/down, faces their hubs toward the road and resets without drift', () => {
    const car = new DeLoreanCar();
    const pivots: Object3D[] = [];
    car.object.traverse((o) => { if (o.name.startsWith('Hover wheel pivot')) pivots.push(o); });
    expect(pivots).toHaveLength(4);
    const rest = pivots.map((p) => p.position.clone());
    car.roll(2);
    car.setHover(0.5, 2);
    for (const p of pivots) expect(Math.abs(p.rotation.z)).toBeCloseTo(Math.PI / 4);
    car.setHover(1, 5);
    for (const [i, p] of pivots.entries()) {
      const axis = new Vector3(Math.sign(rest[i]!.x), 0, 0).applyQuaternion(p.quaternion);
      expect(axis.y).toBeCloseTo(-1);
      expect(Math.abs(p.position.x)).toBeGreaterThan(Math.abs(rest[i]!.x));
      expect(p.position.y).toBeLessThan(rest[i]!.y);
    }
    const spin = pivots[0]!.children[0]!.rotation.x;
    car.roll(10);
    expect(pivots[0]!.children[0]!.rotation.x).toBe(spin);
    expect(car.object.getObjectByName('Hover aura')!.visible).toBe(true);
    for (let i = 0; i < 10; i++) { car.setHover(1, i); car.setHover(0, i); }
    for (const [i, p] of pivots.entries()) {
      expect(p.position.equals(rest[i]!)).toBe(true);
      expect(p.rotation.z).toBeCloseTo(0);
    }
    expect(car.object.getObjectByName('Hover aura')!.visible).toBe(false);
    expect(car.object.getObjectByName('Hover suspension')!.visible).toBe(false);
    car.dispose();
  });

  it.each(['family', 'delorean'] as const)('%s: takeoff capability controls height, pause and wide reveal framing', (id) => {
    const drive = new CoastDrive(id);
    const path = departureRoute(drivePath(routeCurve())).path, road = new Vector3(), direction = new Vector3();
    const flying = id === 'delorean';
    expect(!!drive.car.hover).toBe(flying);
    for (let i = 0; i < 135; i++) drive.update(1 / 30, 390 / 844);
    samplePath(path, drive.progress * drive.length, road, direction);
    const altitude = drive.car.object.position.y - road.y - 0.02;
    if (flying) {
      expect(drive.progress).toBe(0); // camera can show deployment before accelerating
      expect(altitude).toBeGreaterThan(CARS.delorean.hover.height - 0.06);
      expect(altitude).toBeLessThan(CARS.delorean.hover.height + 0.06);
      const aura = drive.car.object.getObjectByName('Hover aura')!;
      expect(aura.visible).toBe(true);
      const glow = drive.car.object.getObjectByName('Hover underglow') as Mesh;
      expect(glow.castShadow).toBe(false);
      drive.scene.updateMatrixWorld(true); drive.camera.updateMatrixWorld(true);
      const p = new Vector3();
      drive.car.object.traverse((node) => {
        if (!(node instanceof Mesh)) return;
        for (let parent: Object3D | null = node; parent; parent = parent.parent) if (!parent.visible) return;
        const positions = node.geometry.attributes.position!;
        for (let i = 0; i < positions.count; i++) {
          p.fromBufferAttribute(positions, i).applyMatrix4(node.matrixWorld).project(drive.camera);
          expect(Math.abs(p.x)).toBeLessThan(1);
          expect(Math.abs(p.y)).toBeLessThan(1);
        }
      });
    } else expect(altitude).toBeCloseTo(0);
    const at = drive.car.object.position.clone(), rotation = drive.car.object.quaternion.clone();
    drive.update(0, 390 / 844);
    expect(drive.car.object.position.equals(at)).toBe(true);
    expect(drive.car.object.quaternion.equals(rotation)).toBe(true);
    for (let i = 0; i < 20 * 30; i++) drive.update(1 / 30, 16 / 9);
    expect(drive.progress).toBeGreaterThan(0.1);
    samplePath(path, drive.progress * drive.length, road, direction);
    expect(drive.car.object.position.y - road.y - 0.02).toBeCloseTo(flying ? CARS.delorean.hover.height : 0, 0);
    drive.dispose();
  });
});
