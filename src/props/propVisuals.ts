import {
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  Curve,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Shape,
  SphereGeometry,
  TorusGeometry,
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
  fish: '#c9833f',
  fishDetail: '#a9652b',
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

/**
 * A soft rubber squeaky toy shaped like a taiyaki (the Japanese fish-shaped cake): a flat, golden-brown fish lying on
 * its side, head toward -z, with a rounded rim, a forked tail, raised scales, an eye, a gill line and fin ridges.
 * Original, built in code (no brand marks).
 */
function squeakyFish(): Group {
  const root = new Group();
  // The squash on each bite scales this, around the toy's middle (see Game: chewing).
  const body = new Group();
  body.name = 'squish';
  root.add(body);
  const rubber = new MeshStandardMaterial({ color: PALETTE.fish, roughness: 0.55 });
  const detail = new MeshStandardMaterial({ color: PALETTE.fishDetail, roughness: 0.6 });

  // The outline in the plane (x across, y along, head at +y), then extruded into a thick slab with rounded edges.
  const s = new Shape();
  s.moveTo(0, 0.068);
  s.bezierCurveTo(0.03, 0.068, 0.047, 0.042, 0.047, 0.012);
  s.bezierCurveTo(0.047, -0.018, 0.032, -0.038, 0.016, -0.046);
  s.lineTo(0.04, -0.074);
  s.quadraticCurveTo(0.03, -0.082, 0.018, -0.076);
  s.lineTo(0, -0.064);
  s.lineTo(-0.018, -0.076);
  s.quadraticCurveTo(-0.03, -0.082, -0.04, -0.074);
  s.lineTo(-0.016, -0.046);
  s.bezierCurveTo(-0.032, -0.038, -0.047, -0.018, -0.047, 0.012);
  s.bezierCurveTo(-0.047, 0.042, -0.03, 0.068, 0, 0.068);
  const slab = new ExtrudeGeometry(s, { depth: 0.017, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 18 });
  slab.center();
  slab.rotateX(-Math.PI / 2);
  mesh(body, slab, rubber, [0, 0, 0]);

  // Raised details on the top face (it's 12.5 mm up from the middle).
  const top = 0.0125;
  const flat: [number, number, number] = [-Math.PI / 2, 0, 0];
  const scale = new TorusGeometry(0.011, 0.0013, 4, 14, Math.PI);
  for (const [x, z] of [
    [-0.02, 0.0], [0.0, 0.0], [0.02, 0.0],
    [-0.01, 0.017], [0.01, 0.017],
    [-0.02, -0.017], [0.0, -0.017], [0.02, -0.017],
  ] as const) mesh(body, scale, detail, [x, top, z], flat).castShadow = false;
  // The gill line behind the head, and the eye.
  mesh(body, new TorusGeometry(0.036, 0.0014, 4, 24, 1.5), detail, [0, top, 0.0], [-Math.PI / 2, 0, Math.PI / 2 - 0.75]).castShadow = false;
  mesh(body, new TorusGeometry(0.0075, 0.0015, 6, 16), detail, [0.016, top, -0.046], flat).castShadow = false;
  mesh(body, new SphereGeometry(0.0038, 10, 6), detail, [0.016, top, -0.046]).scale.set(1, 0.5, 1);
  // Ridges along the tail and the fins at the edge.
  const ridge = new CylinderGeometry(0.0012, 0.0012, 0.022, 4);
  for (const side of [1, -1]) {
    for (const k of [0, 1]) mesh(body, ridge, detail, [side * (0.012 + k * 0.009), top, 0.064 + k * 0.002], [Math.PI / 2, 0, -side * (0.5 + k * 0.2)]).castShadow = false;
    mesh(body, ridge, detail, [side * 0.036, top, 0.016], [Math.PI / 2, 0, side * 0.3]).castShadow = false;
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
    case 'fish':
      return squeakyFish();
  }
}
