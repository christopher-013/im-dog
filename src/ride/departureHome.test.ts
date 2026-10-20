import { Box3, Mesh, Raycaster, Vector3, type Material } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { DEPARTURE_HOME } from '../config/ride';
import { GARAGE } from '../world/home/layout';
import { CoastDrive } from './CoastDrive';
import { departureHome } from './departureHome';
import { departureRoute } from './departureRoute';
import { drivePath, routeCurve, samplePath } from './coastRoute';
import { neighborDriveway, NEIGHBOR_PROFILES } from '../config/neighborhood';

describe('home behind the departure shot', () => {
  it('keeps the non-hovering car on the driveway and street surface throughout the turn', () => {
    const drive = new CoastDrive('family'), departure = departureRoute(drivePath(routeCurve()));
    drive.scene.updateMatrixWorld(true);
    const scenery = ['Departure home and garage', 'road', 'land'].map((name) => drive.scene.getObjectByName(name)!);
    const pos = new Vector3(), dir = new Vector3(), down = new Vector3(0, -1, 0);
    let worst = 0;
    for (let s = 0; s < departure.joinDistance; s += 0.5) {
      samplePath(departure.path, s, pos, dir);
      const hit = new Raycaster(pos.clone().addScaledVector(down, -1), down, 0, 3).intersectObjects(scenery, true)[0];
      expect(hit, `no pavement at ${s}m`).toBeDefined();
      worst = Math.max(worst, Math.abs(pos.y + 0.02 - hit!.point.y));
    }
    expect(worst).toBeLessThan(0.12);
    drive.dispose();
  });
  it('paves the driveway to a perpendicular through street and connects the opposite neighbors too', () => {
    const home = departureHome(); home.updateMatrixWorld(true);
    const surface = (x: number, z: number) => new Raycaster(new Vector3(x, 15, z), new Vector3(0, -1, 0)).intersectObject(home, true)[0]!.object as Mesh;
    const materialAt = (x: number, z: number) => (surface(x, z).material as import('three').MeshStandardMaterial).color.getHexString();
    expect(materialAt(0, 0.2)).toBe(DEPARTURE_HOME.colors.concrete.slice(1)); // between expansion joints
    expect(materialAt(0, 8.1)).toBe(DEPARTURE_HOME.colors.concrete.slice(1));
    for (const x of [-10, -40, -70]) expect(materialAt(x, DEPARTURE_HOME.street.center)).toBe(DEPARTURE_HOME.colors.asphalt.slice(1));
    for (const neighbor of DEPARTURE_HOME.neighbors.filter((n) => n.heading !== 0 && !n.background)) {
      expect(materialAt(neighbor.x - neighborDriveway(neighbor.style, neighbor.scale, neighbor.mirror).x, DEPARTURE_HOME.street.center + DEPARTURE_HOME.street.halfWidth + 0.1))
        .toBe(DEPARTURE_HOME.colors.concrete.slice(1));
    }
    const seen = new Set<import('three').Material>();
    home.traverse((o) => { if (o instanceof Mesh) { o.geometry.dispose(); seen.add(o.material as Material); } });
    for (const material of seen) material.dispose();
  });
  it('frames the garage and house during hover deployment in landscape and portrait', () => {
    for (const aspect of [16 / 9, 390 / 844]) {
      const drive = new CoastDrive('delorean');
      const home = drive.scene.getObjectByName('Departure home and garage')!;
      // Out of the driveway (the cockpit scene), then four seconds into the takeoff.
      for (let i = 0; i < 30 * 30 && drive.introPlaying; i++) drive.update(1 / 30, aspect);
      for (let i = 0; i < 4 * 30; i++) drive.update(1 / 30, aspect);
      drive.scene.updateMatrixWorld(true); drive.camera.updateMatrixWorld(true);
      for (const point of [new Vector3(GARAGE.car.x, 1.4, DEPARTURE_HOME.garageFront), new Vector3(-8, 5, DEPARTURE_HOME.houseFront)]) {
        const projected = home.localToWorld(point).project(drive.camera);
        expect(Math.abs(projected.x)).toBeLessThan(1);
        expect(Math.abs(projected.y)).toBeLessThan(1);
        expect(projected.z).toBeGreaterThan(-1);
        expect(projected.z).toBeLessThan(1);
      }
      drive.dispose();
    }
  });
  it('adds twelve neighbors with six architectural profiles and a cheaper background row', () => {
    expect(DEPARTURE_HOME.neighbors).toHaveLength(12);
    expect(new Set(DEPARTURE_HOME.neighbors.map((n) => n.style)).size).toBe(6);
    expect(new Set(DEPARTURE_HOME.neighbors.map((n) => `${n.style}/${n.wall}/${n.mirror}`)).size).toBe(12);
    expect(new Set(DEPARTURE_HOME.neighbors.slice(0, 4).map((n) => n.style)).size).toBe(4);
    expect(DEPARTURE_HOME.neighbors.filter((n) => n.background)).toHaveLength(4);
    const profiles = Object.values(NEIGHBOR_PROFILES);
    expect(new Set(profiles.map((p) => `${p.roof}/${p.porch}/${p.floors}`)).size).toBe(6);
  });
  it('has an open garage connected to the driveway, remains world-fixed and releases each resource once', () => {
    const drive = new CoastDrive('delorean');
    const home = drive.scene.getObjectByName('Departure home and garage')!;
    const position = home.position.clone(), rotation = home.quaternion.clone();
    home.updateMatrixWorld(true);
    // No slab blocking the open bay. The first wall inside it is at the back of the garage.
    const origin = home.localToWorld(new Vector3(GARAGE.car.x, 1.5, DEPARTURE_HOME.garageFront + 1));
    const direction = new Vector3(0, 0, -1).applyQuaternion(home.quaternion);
    const hits = new Raycaster(origin, direction).intersectObject(home, true);
    expect(hits[0]!.distance).toBeGreaterThan(6);
    const geometry = new Set<Mesh['geometry']>(), materials = new Set<Material>();
    let meshes = 0;
    home.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      meshes++; geometry.add(o.geometry); materials.add(o.material as Material);
    });
    expect(meshes).toBeLessThanOrEqual(20);
    const releases = [...geometry, ...materials].map((resource) => vi.spyOn(resource, 'dispose'));
    for (let i = 0; i < 30 * 30; i++) drive.update(1 / 30, 16 / 9);
    expect(drive.progress).toBeGreaterThan(0.1);
    expect(home.parent).toBe(drive.scene);
    expect(home.position.equals(position)).toBe(true);
    expect(home.quaternion.equals(rotation)).toBe(true);
    expect(new Box3().setFromObject(home).intersectsBox(new Box3().setFromObject(drive.car.object))).toBe(false);
    drive.dispose();
    for (const release of releases) expect(release).toHaveBeenCalledTimes(1);
  });
});
