import {
  BufferGeometry,
  CapsuleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  LatheGeometry,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector2,
  type Material,
  type Object3D,
} from 'three';

interface Child {
  readonly root: Group;
  /** The arm holding up the treat pail (raised when the door opens). */
  readonly arm: Group | null;
  readonly phase: number;
}

/**
 * The trick-or-treaters (Halloween, D30): three small children on the doorstep, a sheet ghost, a pumpkin and a witch,
 * each with a pumpkin pail. Presentation only, like the courier: they stand outside the front door, bob about while
 * they wait and hold up their pails when it opens. Built in code; original designs.
 */
export class TrickOrTreaters {
  readonly object = new Group();
  private readonly children: Child[] = [];
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private time = 0;
  private excitement = 0;
  private excited = false;

  constructor() {
    this.object.name = 'Trick-or-treaters';
    this.object.visible = false;
    // Side by side across the doorstep, facing the door (+z in their own space).
    this.children.push(this.ghost(-0.3, 0.0));
    this.children.push(this.pumpkinKid(0.0, 1.7));
    this.children.push(this.witchKid(0.29, 3.1));
  }

  /** On the doorstep or gone. */
  show(on: boolean): void {
    this.object.visible = on;
    if (!on) this.excited = false;
  }

  /** The door's open: pails up. */
  setExcited(on: boolean): void {
    this.excited = on;
  }

  update(dt: number): void {
    if (!this.object.visible) return;
    this.time += dt;
    this.excitement += ((this.excited ? 1 : 0) - this.excitement) * Math.min(1, dt * 6);
    for (const child of this.children) {
      const t = this.time * (2.2 + this.excitement * 3) + child.phase;
      // A little sway while waiting; bouncing on their toes once the door opens.
      child.root.position.y = Math.max(0, Math.sin(t)) * (0.01 + 0.035 * this.excitement);
      child.root.rotation.z = Math.sin(t * 0.5) * 0.04;
      if (child.arm) child.arm.rotation.x = -0.25 - 1.15 * this.excitement;
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.object.removeFromParent();
  }

  // ---- the children (each in its own space: +z toward the door, standing at the origin)

  private ghost(x: number, phase: number): Child {
    const root = this.child(x);
    const sheet = this.material(new MeshStandardMaterial({ color: '#f4f2ee', roughness: 0.9, side: DoubleSide }));
    const dark = this.material(new MeshStandardMaterial({ color: '#1b1b22', roughness: 0.6 }));
    // A bell of sheet, round on top, flaring to a wavy hem just off the ground.
    const profile: Vector2[] = [];
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * (Math.PI / 2);
      profile.push(new Vector2(Math.sin(a) * 0.15, 0.93 + Math.cos(a) * 0.15));
    }
    profile.push(new Vector2(0.17, 0.6), new Vector2(0.22, 0.25), new Vector2(0.26, 0.05));
    const bell = this.geometry(new LatheGeometry(profile.reverse(), 24));
    const position = bell.attributes.position!;
    for (let i = 0; i < position.count; i++) {
      const y = position.getY(i);
      if (y < 0.08) position.setY(i, y + 0.03 * Math.sin(Math.atan2(position.getZ(i), position.getX(i)) * 7));
    }
    bell.computeVertexNormals();
    this.mesh(bell, sheet, root, [0, 0, 0]);
    const eye = this.geometry(new SphereGeometry(1, 12, 8));
    for (const side of [-1, 1]) this.mesh(eye, dark, root, [side * 0.05, 0.95, 0.135], [0.022, 0.032, 0.012]);
    // A pail peeking out from under the sheet.
    const arm = new Group();
    arm.position.set(0.16, 0.55, 0.06);
    root.add(arm);
    this.pail(arm, [0.02, -0.22, 0.06]);
    return { root, arm, phase };
  }

  private pumpkinKid(x: number, phase: number): Child {
    const root = this.child(x);
    const orange = this.material(new MeshStandardMaterial({ color: '#ef7d18', roughness: 0.7 }));
    const green = this.material(new MeshStandardMaterial({ color: '#3f6b2a', roughness: 0.8 }));
    this.legs(root, green);
    const body = this.geometry(new SphereGeometry(1, 28, 18));
    const pos = body.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
      const lobe = 1 + 0.08 * Math.abs(Math.cos(Math.atan2(pz, px) * 4)) * (1 - py * py);
      pos.setXYZ(i, px * lobe, py, pz * lobe);
    }
    body.computeVertexNormals();
    this.mesh(body, orange, root, [0, 0.55, 0], [0.21, 0.2, 0.21]);
    this.head(root, 0.86, '#3a2a22');
    const stem = this.geometry(new CylinderGeometry(0.018, 0.026, 0.07, 8));
    this.mesh(stem, green, root, [0, 1.0, 0], undefined, [0.2, 0, 0.1]);
    const arm = this.arm(root, -0.2, 0.62, orange);
    this.pail(arm, [0, -0.25, 0.04]);
    this.arm(root, 0.2, 0.62, orange);
    return { root, arm, phase };
  }

  private witchKid(x: number, phase: number): Child {
    const root = this.child(x);
    const purple = this.material(new MeshStandardMaterial({ color: '#6a2fa0', roughness: 0.7 }));
    const black = this.material(new MeshStandardMaterial({ color: '#1c1624', roughness: 0.7, side: DoubleSide }));
    const stripes = this.material(new MeshStandardMaterial({ color: '#2b2333', roughness: 0.8 }));
    this.legs(root, stripes);
    const dress = this.geometry(new CylinderGeometry(0.08, 0.2, 0.5, 18));
    this.mesh(dress, purple, root, [0, 0.52, 0]);
    this.head(root, 0.86, '#6b3b1f');
    const brim = this.geometry(new CylinderGeometry(0.17, 0.17, 0.01, 24));
    this.mesh(brim, black, root, [0, 0.95, 0], undefined, [0.05, 0, -0.08]);
    const hat = this.geometry(new ConeGeometry(0.09, 0.24, 18));
    this.mesh(hat, black, root, [-0.01, 1.07, 0], undefined, [0.05, 0, -0.2]);
    const arm = this.arm(root, 0.17, 0.66, purple);
    this.pail(arm, [0, -0.25, 0.04]);
    this.arm(root, -0.17, 0.66, purple);
    return { root, arm, phase };
  }

  // ---- parts

  private child(x: number): Group {
    const root = new Group();
    const holder = new Group();
    holder.position.set(x, 0, 0);
    holder.add(root);
    this.object.add(holder);
    return root;
  }

  private legs(root: Object3D, material: Material): void {
    const leg = this.geometry(new CapsuleGeometry(0.04, 0.24, 4, 8));
    const shoe = this.geometry(new SphereGeometry(1, 10, 8));
    const shoes = this.material(new MeshStandardMaterial({ color: '#2a2a30', roughness: 0.6 }));
    for (const side of [-1, 1]) {
      this.mesh(leg, material, root, [side * 0.06, 0.18, 0]);
      this.mesh(shoe, shoes, root, [side * 0.06, 0.035, 0.025], [0.045, 0.03, 0.065]);
    }
  }

  /** A round, smiling child's face (rosy cheeks), with hair on top. */
  private head(root: Object3D, y: number, hair: string): void {
    const skin = this.material(new MeshStandardMaterial({ color: '#e2a982', roughness: 0.75 }));
    const hairMaterial = this.material(new MeshStandardMaterial({ color: hair, roughness: 0.85 }));
    const dark = this.material(new MeshStandardMaterial({ color: '#241a16', roughness: 0.5 }));
    const cheek = this.material(new MeshStandardMaterial({ color: '#e98a7f', roughness: 0.8 }));
    const ball = this.geometry(new SphereGeometry(0.115, 20, 16));
    this.mesh(ball, skin, root, [0, y, 0]);
    const cap = this.geometry(new SphereGeometry(0.12, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.45));
    this.mesh(cap, hairMaterial, root, [0, y + 0.01, -0.01], undefined, [-0.25, 0, 0]);
    const eye = this.geometry(new SphereGeometry(0.014, 10, 8));
    for (const side of [-1, 1]) this.mesh(eye, dark, root, [side * 0.042, y + 0.015, 0.104]);
    const blush = this.geometry(new SphereGeometry(1, 10, 6));
    for (const side of [-1, 1]) this.mesh(blush, cheek, root, [side * 0.065, y - 0.025, 0.088], [0.022, 0.012, 0.008]);
    const smile = this.geometry(new TorusGeometry(0.03, 0.006, 6, 14, Math.PI));
    this.mesh(smile, dark, root, [0, y - 0.03, 0.105], undefined, [0, 0, Math.PI]);
  }

  /** A short arm hanging from the shoulder (its group pivots there), the hand at the end. */
  private arm(root: Object3D, x: number, y: number, sleeve: Material): Group {
    const pivot = new Group();
    pivot.position.set(x, y, 0);
    root.add(pivot);
    const upper = this.geometry(new CapsuleGeometry(0.032, 0.17, 4, 8));
    this.mesh(upper, sleeve, pivot, [0, -0.11, 0]);
    const hand = this.geometry(new SphereGeometry(0.033, 10, 8));
    const skin = this.material(new MeshStandardMaterial({ color: '#e2a982', roughness: 0.75 }));
    this.mesh(hand, skin, pivot, [0, -0.22, 0]);
    pivot.rotation.x = -0.25;
    return pivot;
  }

  /** An orange jack-o'-lantern treat pail with a black handle. */
  private pail(parent: Object3D, [x, y, z]: [number, number, number]): void {
    const orange = this.material(new MeshStandardMaterial({ color: '#f28a1e', roughness: 0.6 }));
    const black = this.material(new MeshStandardMaterial({ color: '#1a1a1a', roughness: 0.6 }));
    const bucket = this.geometry(new CylinderGeometry(0.075, 0.065, 0.11, 16));
    this.mesh(bucket, orange, parent, [x, y - 0.07, z]);
    const handle = this.geometry(new TorusGeometry(0.07, 0.005, 6, 16, Math.PI));
    this.mesh(handle, black, parent, [x, y - 0.015, z]);
    const face = this.geometry(new SphereGeometry(1, 8, 6));
    for (const side of [-1, 1]) this.mesh(face, black, parent, [x + side * 0.024, y - 0.055, z + 0.071], [0.012, 0.012, 0.004]);
  }

  private mesh(geometry: BufferGeometry, material: Material, parent: Object3D, at: [number, number, number], scale?: [number, number, number], rotation?: [number, number, number]): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...at);
    if (scale) mesh.scale.set(...scale);
    if (rotation) mesh.rotation.set(...rotation);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private material<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }
}
