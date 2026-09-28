import { Box3, Object3D, Raycaster, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { MISCHIEF, PILLOW_SOFAS } from '../config/mischief';
import { CouchPillows } from './CouchPillows';
import { sectional } from './home/homeFurniture';
import { FURNITURE } from './home/places';
import { createRoomMaterials } from './materials';
import { StaticSceneBuilder } from './StaticSceneBuilder';

function setup() {
  const b = new StaticSceneBuilder();
  const sofa = PILLOW_SOFAS.find((s) => s.id === 'sectional')!;
  b.at([sofa.x, 0, sofa.z], 0, () => sectional(b, createRoomMaterials(), FURNITURE.sectional.length));
  const root = b.build('Sectional'); root.updateMatrixWorld(true);
  const meshes = root.children.filter((o) => o.userData.loosePillow);
  return { root, sofa, meshes, pillows: new CouchPillows(root) };
}

describe('L-shaped couch throw pillows', () => {
  it('renders all three in front of the back cushions, supported by the seat, including the chaise pillow', () => {
    const { root, sofa, meshes, pillows } = setup();
    expect(meshes).toHaveLength(3); expect(pillows.count(sofa)).toBe(3);
    for (const mesh of meshes) {
      const bounds = new Box3().setFromObject(mesh);
      expect(bounds.min.y).toBeGreaterThan(sofa.height - 0.02);
      expect(bounds.min.y).toBeLessThan(sofa.height + 0.025);
      expect(bounds.max.z).toBeLessThan(sofa.z + sofa.halfZ);
      const center = mesh.getWorldPosition(new Vector3());
      const ray = new Raycaster(new Vector3(center.x, center.y, sofa.z + 2), new Vector3(0, 0, -1));
      expect(ray.intersectObject(root, true)[0]?.object).toBe(mesh);
    }
    const chaise = sofa.extraSeats![0]!;
    expect(Math.abs(meshes[2]!.position.x - chaise.x)).toBeLessThan(chaise.halfX);
  });

  it('tosses, carries and returns the same pillows to their corrected seat positions on repeated plays', () => {
    const { root, sofa, meshes, pillows } = setup();
    const original = meshes.map((mesh) => ({ position: mesh.position.clone(), rotation: mesh.quaternion.clone(), scale: mesh.scale.clone() }));
    const hand = new Object3D(); root.add(hand); hand.position.set(sofa.x, 1, sofa.z + 1);
    for (let play = 0; play < 2; play++) {
      pillows.toss(sofa); pillows.update(MISCHIEF.tossTime);
      meshes.forEach((mesh, i) => {
        expect(mesh.position.distanceTo(original[i]!.position)).toBeGreaterThan(0.5);
        pillows.pickUp(sofa, i, hand); expect(mesh.parent).toBe(hand);
        pillows.putBack(sofa, i); pillows.update(MISCHIEF.returnTime);
        expect(mesh.parent).toBe(root);
        expect(mesh.position.distanceTo(original[i]!.position)).toBeLessThan(1e-6);
        expect(mesh.quaternion.angleTo(original[i]!.rotation)).toBeLessThan(1e-6);
        expect(mesh.scale.distanceTo(original[i]!.scale)).toBeLessThan(1e-6);
      });
    }
  });
});
