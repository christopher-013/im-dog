import { BoxGeometry, CylinderGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, PlaneGeometry, Quaternion, TorusGeometry, Vector3, type Object3D } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { HumanProp } from './HumanRig';

/** The little things the human holds for their activities, riding in their hands (hidden unless in use). */
export interface HumanPropViews {
  readonly right: Object3D;
  readonly left: Object3D;
  show(prop: HumanProp | null): void;
  /**
   * Holds the open book between both hands, pages toward the eyes (world positions of the two hands and the head),
   * whatever the pose: it rides in the right hand but is placed each frame.
   */
  holdBook(left: Vector3, right: Vector3, eyes: Vector3): void;
  dispose(): void;
}

/**
 * Builds the held props (original, code-built): a paperback, a phone, a coffee mug, a fork, a wooden spoon, a knife
 * and the TV remote. Each is positioned for the hand holding it (the palm faces the body at rest, fingers down).
 */
export function createHumanPropViews(): HumanPropViews {
  const right = new Group();
  const left = new Group();
  right.name = 'props:right';
  left.name = 'props:left';
  const materials: MeshStandardMaterial[] = [];
  const mat = (color: string, roughness = 0.6, metalness = 0) => {
    const m = new MeshStandardMaterial({ color, roughness, metalness });
    materials.push(m);
    return m;
  };
  const views = new Map<HumanProp, Group>();
  const add = (prop: HumanProp, parent: Object3D, build: (g: Group) => void) => {
    const g = new Group();
    g.name = `prop:${prop}`;
    g.visible = false;
    build(g);
    parent.add(g);
    views.set(prop, g);
  };
  const mesh = (g: Group, geometry: ConstructorParameters<typeof Mesh>[0], material: MeshStandardMaterial, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const m = new Mesh(geometry, material);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = false;
    g.add(m);
    return m;
  };

  // A paperback held open, pages toward the reader (placed between the hands each frame: holdBook).
  add('book', right, (g) => {
    const cover = mat('#3f7f9c', 0.8);
    const pages = mat('#f6efe1', 0.9);
    for (const side of [-1, 1]) {
      mesh(g, new BoxGeometry(0.11, 0.17, 0.006), cover, side * 0.056, 0, -0.004, 0, side * 0.2, 0);
      mesh(g, new BoxGeometry(0.1, 0.16, 0.012), pages, side * 0.052, 0, 0.004, 0, side * 0.2, 0);
    }
    mesh(g, new PlaneGeometry(0.08, 0.12), mat('#e8dfcf', 0.9), 0.052, 0, 0.0105, 0, 0.2, 0);
  });
  // A phone, screen toward them.
  add('phone', right, (g) => {
    g.position.set(0.02, -0.03, 0.03);
    g.rotation.set(0, Math.PI / 2, 0);
    mesh(g, new RoundedBoxGeometry(0.072, 0.145, 0.009, 2, 0.006), mat('#2b2d33', 0.4), 0, 0, 0);
    const screen = new MeshStandardMaterial({ color: '#9fc4e6', emissive: '#6a9ccc', emissiveIntensity: 0.6, roughness: 0.2 });
    materials.push(screen);
    mesh(g, new PlaneGeometry(0.064, 0.132), screen, 0, 0, 0.0048);
  });
  // A coffee mug, handle out.
  add('mug', right, (g) => {
    const ceramic = mat('#f1ece4', 0.45);
    g.position.set(0.03, -0.045, 0.035);
    mesh(g, new CylinderGeometry(0.038, 0.034, 0.09, 16), ceramic, 0, 0, 0);
    mesh(g, new TorusGeometry(0.022, 0.007, 6, 12), ceramic, 0, 0, -0.04, 0, Math.PI / 2, 0);
    mesh(g, new CylinderGeometry(0.033, 0.033, 0.004, 14), mat('#6b4428', 0.3), 0, 0.04, 0);
  });
  // Cutlery and the remote: long, held along the fingers.
  const handheld = (prop: HumanProp, length: number, width: number, color: string, head?: string) =>
    add(prop, right, (g) => {
      g.position.set(0.018, -0.05, 0.03);
      g.rotation.set(-1.25, 0, 0);
      mesh(g, new BoxGeometry(width, length, width * 0.5), mat(color, 0.35, color === '#c9cdd2' ? 0.7 : 0), 0, length / 2 - 0.04, 0);
      if (head) mesh(g, new BoxGeometry(width * 2.2, 0.05, width * 0.4), mat(head, 0.35, 0.6), 0, length - 0.03, 0);
    });
  handheld('fork', 0.17, 0.012, '#c9cdd2', '#c9cdd2');
  handheld('spoon', 0.26, 0.016, '#b98a5a', '#b98a5a');
  handheld('knife', 0.2, 0.014, '#2b2b2f', '#d7dade');
  handheld('remote', 0.15, 0.04, '#2b2d33');

  let current: HumanProp | null = null;
  const at = new Vector3();
  const look = new Matrix4();
  const up = new Vector3(0, 1, 0);
  const world = new Quaternion();
  const parent = new Quaternion();
  return {
    right,
    left,
    holdBook(l, r, eyes) {
      const book = views.get('book');
      if (!book?.visible || !book.parent) return;
      at.addVectors(l, r).multiplyScalar(0.5);
      at.y += 0.05;
      // Face the pages (+z) at the eyes: lookAt aims -z, so look from the eyes toward the book.
      look.lookAt(eyes, at, up);
      world.setFromRotationMatrix(look);
      book.parent.updateWorldMatrix(true, false);
      book.parent.getWorldQuaternion(parent);
      book.quaternion.copy(parent.invert().multiply(world));
      book.position.copy(book.parent.worldToLocal(at));
    },
    show(prop) {
      if (prop === current) return;
      if (current) views.get(current)!.visible = false;
      current = prop;
      if (prop) views.get(prop)!.visible = true;
    },
    dispose() {
      for (const g of views.values()) g.traverse((o) => (o as Mesh).geometry?.dispose());
      for (const m of materials) m.dispose();
    },
  };
}
