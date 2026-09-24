import {
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Curve,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import type { PropId } from '../config/props';

// Original, code-built prop models. Each is centred on its physics body, lying the way it rests.

const PALETTE = {
  sockBody: '#34373d',
  sockStripe: '#9ca3ad',
  sockHeel: '#59606a',
  ball: '#d8ec4a',
  ballSeam: '#fbfbf2',
  ropeA: '#3f8fa8',
  ropeB: '#f3ede0',
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

/** A charcoal sock with a light-grey cuff pattern, lying flat: the cuff toward +z, the foot bending off to the side. */
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

/** The curved seam of a tennis ball, on a sphere of radius `r`. */
class SeamCurve extends Curve<Vector3> {
  constructor(private readonly r: number) {
    super();
  }
  override getPoint(t: number, target = new Vector3()): Vector3 {
    const a = t * Math.PI * 2;
    target.set(Math.cos(a) + 0.35 * Math.cos(3 * a), Math.sin(a) - 0.35 * Math.sin(3 * a), 1.1 * Math.sin(2 * a));
    return target.setLength(this.r);
  }
}

/** A fuzzy yellow-green tennis ball with its white seam. */
function ball(): Group {
  const root = new Group();
  const r = 0.033;
  mesh(root, new SphereGeometry(r, 24, 16), new MeshStandardMaterial({ color: PALETTE.ball, roughness: 1 }), [0, 0, 0]);
  mesh(root, new TubeGeometry(new SeamCurve(r * 1.004), 80, 0.0022, 5, true), new MeshStandardMaterial({ color: PALETTE.ballSeam, roughness: 0.9 }), [0, 0, 0]).castShadow = false;
  return root;
}

/** A two-tone knotted rope toy lying along z, with tassels. */
function ropeToy(): Group {
  const root = new Group();
  const a = new MeshStandardMaterial({ color: PALETTE.ropeA, roughness: 1 });
  const b = new MeshStandardMaterial({ color: PALETTE.ropeB, roughness: 1 });
  // Two twisted strands: slightly offset, tilted cylinders read as a rope at this size.
  mesh(root, new CylinderGeometry(0.013, 0.013, 0.16, 8), a, [0.006, 0, 0], [Math.PI / 2, 0, 0.06]);
  mesh(root, new CylinderGeometry(0.013, 0.013, 0.16, 8), b, [-0.006, 0, 0], [Math.PI / 2, 0, -0.06]);
  const knot = new SphereGeometry(0.03, 14, 10);
  const tassel = new ConeGeometry(0.024, 0.05, 10);
  for (const side of [1, -1]) {
    mesh(root, knot, side > 0 ? a : b, [0, 0, side * 0.085]).scale.set(1, 1, 0.8);
    mesh(root, tassel, side > 0 ? b : a, [0, 0, side * 0.125], [-side * (Math.PI / 2), 0, 0]);
  }
  return root;
}

export function createPropView(id: PropId): Group {
  switch (id) {
    case 'sock':
      return sock();
    case 'ball':
      return ball();
    case 'toy':
      return ropeToy();
  }
}
