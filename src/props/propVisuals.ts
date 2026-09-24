import { CapsuleGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, type BufferGeometry, type Material } from 'three';
import type { PropId } from '../config/props';

// Original, code-built prop models. Each is centred on its physics body, lying the way it rests.

const PALETTE = {
  sockBody: '#ef7f63',
  sockStripe: '#f6c453',
  sockHeel: '#fbe7c6',
};

function mesh(parent: Group, geometry: BufferGeometry, material: Material, position: [number, number, number], rotation: [number, number, number] = [0, 0, 0]): Mesh {
  const m = new Mesh(geometry, material);
  m.position.set(...position);
  m.rotation.set(...rotation);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** A coral sock with mustard cuff stripes, lying flat: the cuff toward +z, the foot bending off to the side. */
function sock(): Group {
  const root = new Group();
  // Flattened: a sock on the floor is a floppy, flat thing.
  const flat = new Group();
  flat.scale.set(1, 0.38, 1);
  root.add(flat);
  const body = new MeshStandardMaterial({ color: PALETTE.sockBody, roughness: 0.95 });
  const stripe = new MeshStandardMaterial({ color: PALETTE.sockStripe, roughness: 0.95 });
  const heel = new MeshStandardMaterial({ color: PALETTE.sockHeel, roughness: 0.95 });
  const alongZ: [number, number, number] = [Math.PI / 2, 0, 0];

  mesh(flat, new CapsuleGeometry(0.033, 0.1, 4, 12), body, [0, 0, 0.035], alongZ);
  for (const z of [0.085, 0.108]) mesh(flat, new CylinderGeometry(0.0345, 0.0345, 0.01, 16), stripe, [0, 0, z], alongZ);
  mesh(flat, new SphereGeometry(0.031, 12, 8), heel, [0, 0, -0.03]);
  const foot = new Group();
  foot.position.set(0, 0, -0.03);
  foot.rotation.y = 0.55;
  flat.add(foot);
  mesh(foot, new CapsuleGeometry(0.031, 0.06, 4, 12), body, [0, 0, -0.045], alongZ);
  mesh(foot, new SphereGeometry(0.029, 12, 8), heel, [0, 0, -0.085]);
  return root;
}

export function createPropView(id: PropId): Group {
  switch (id) {
    case 'sock':
      return sock();
  }
}
