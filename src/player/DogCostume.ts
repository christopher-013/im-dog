import {
  BackSide,
  BufferAttribute,
  Color,
  BoxGeometry,
  BufferGeometry,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  FrontSide,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  type Material,
  type Object3D,
} from 'three';
import type { MokeVisual } from './MokeVisual';

/** The Halloween costumes (Phase 6, D30): one for each dog, in `config/dogs.ts`. */
export type CostumeKind = 'pumpkin' | 'cape' | 'witchHat';

/**
 * A Halloween costume: presentation only, hung on the dog visual's sockets (`attachments.back` and `.head`), so it
 * moves and turns with him and never touches his size, body or gameplay (D14). A visual without a socket (a
 * `moke.glb` without `socket_head`) simply goes without that part. Built in code; no assets.
 */
export class DogCostume {
  /** Rides on his back socket (a pumpkin suit, a cape). */
  private readonly back = new Group();
  /** Sits on his head socket (the pumpkin's stem, a witch hat). */
  private readonly head = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];

  constructor(readonly kind: CostumeKind) {
    this.back.name = `costume_${kind}_back`;
    this.head.name = `costume_${kind}_head`;
    if (kind === 'pumpkin') this.buildPumpkin();
    else if (kind === 'cape') this.buildCape();
    else this.buildWitchHat();
  }

  /** Puts it on `visual` (taking it off whatever wore it before). */
  wear(visual: MokeVisual): void {
    this.takeOff();
    if (this.back.children.length > 0) visual.attachments.back?.add(this.back);
    if (this.head.children.length > 0) visual.attachments.head?.add(this.head);
  }

  takeOff(): void {
    this.back.removeFromParent();
    this.head.removeFromParent();
  }

  /** Worn parts, for tests and checks. */
  get worn(): Object3D[] {
    return [this.back, this.head].filter((part) => part.parent !== null);
  }

  dispose(): void {
    this.takeOff();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }

  // ---- the costumes. Socket space: +z forward (his nose), +y up. The back socket sits on top of his back,
  // 0.305 m up and 0.02 m behind his middle; the body's fur is about 0.1 m round there.

  /** Moke: a ribbed orange pumpkin suit round his middle, and a little green stem and leaf on his head. */
  private buildPumpkin(): void {
    const orange = this.material(new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
    const green = this.material(new MeshStandardMaterial({ color: '#4f7a2c', roughness: 0.8 }));
    const shell = this.geometry(ribbedShell(0.122, 0.108, 0.16, 8));
    const suit = this.mesh(shell, orange, this.back, [0, -0.088, 0.008]);
    suit.name = 'pumpkin suit';
    // The stem and a curly leaf on his head.
    const stem = this.geometry(new CylinderGeometry(0.008, 0.012, 0.03, 8));
    this.mesh(stem, green, this.head, [0, 0.012, 0], undefined, [0.25, 0, 0.15]);
    const leaf = this.geometry(new SphereGeometry(1, 10, 6));
    this.mesh(leaf, green, this.head, [0.022, 0.006, -0.004], [0.02, 0.004, 0.012], [0, 0.4, -0.3]);
    const curl = this.geometry(new TorusGeometry(0.011, 0.0022, 6, 16, Math.PI * 1.5));
    this.mesh(curl, green, this.head, [-0.016, 0.012, 0.006], undefined, [Math.PI / 2, 0, 0.6]);
  }

  /** Dougie: a black vampire cape with a red lining over his back, with a tall stand-up collar at the neck. */
  private buildCape(): void {
    const black = this.material(new MeshStandardMaterial({ color: '#221c2b', roughness: 0.4, metalness: 0.1, side: FrontSide }));
    const red = this.material(new MeshStandardMaterial({ color: '#b3122a', roughness: 0.45, side: BackSide }));
    const gold = this.material(new MeshStandardMaterial({ color: '#d4a23a', metalness: 0.6, roughness: 0.35 }));
    // Draped over his back from the neck to the rump: narrow at the shoulders, flaring wide behind.
    const drape = this.geometry(capeGeometry());
    for (const material of [black, red]) {
      const cape = this.mesh(drape, material, this.back, [0, -0.07, 0]);
      cape.name = 'cape';
    }
    // The stand-up collar behind his neck: a short open ring, black outside and red inside.
    const collar = this.geometry(new CylinderGeometry(0.075, 0.06, 0.07, 18, 1, true, Math.PI * 0.55, Math.PI * 0.9));
    for (const material of [black, red]) this.mesh(collar, material, this.back, [0, 0.015, 0.1], undefined, [-0.35, 0, 0]);
    // A gold clasp at the front of the collar, where the cape fastens.
    const clasp = this.geometry(new SphereGeometry(0.011, 10, 8));
    this.mesh(clasp, gold, this.back, [0, -0.005, 0.118]);
  }

  /** Nori: a black witch's hat with a purple band, a gold buckle and a bent tip, tipped jauntily to one side. */
  private buildWitchHat(): void {
    const black = this.material(new MeshStandardMaterial({ color: '#1d1626', roughness: 0.7, side: DoubleSide }));
    const purple = this.material(new MeshStandardMaterial({ color: '#7a3db8', roughness: 0.6 }));
    const gold = this.material(new MeshStandardMaterial({ color: '#e0b440', metalness: 0.5, roughness: 0.35 }));
    const hat = new Group();
    hat.name = 'witch hat';
    hat.rotation.set(-0.12, 0, 0.22);
    hat.position.set(0.006, 0.0, -0.006);
    this.head.add(hat);
    const brim = this.geometry(new CylinderGeometry(0.088, 0.088, 0.005, 28));
    this.mesh(brim, black, hat, [0, 0.003, 0]);
    const crown = this.geometry(new CylinderGeometry(0.03, 0.052, 0.075, 20));
    this.mesh(crown, black, hat, [0, 0.04, 0]);
    const tip = this.geometry(new ConeGeometry(0.03, 0.06, 16));
    this.mesh(tip, black, hat, [-0.012, 0.096, -0.004], undefined, [0, 0, 0.55]);
    const band = this.geometry(new CylinderGeometry(0.0505, 0.053, 0.014, 20));
    this.mesh(band, purple, hat, [0, 0.013, 0]);
    const buckle = this.geometry(new BoxGeometry(0.016, 0.012, 0.004));
    this.mesh(buckle, gold, hat, [0, 0.013, 0.053]);
  }

  private mesh(
    geometry: BufferGeometry,
    material: Material,
    parent: Object3D,
    at: [number, number, number],
    scale?: [number, number, number],
    rotation?: [number, number, number],
  ): Mesh {
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

/**
 * A cape (in back-socket space, its middle at the origin): an open sleeve over his back, from the neck (+z) to past
 * his rump (−z), its cross-section widening from his shoulders to a full flare at the back, hanging lower behind,
 * with a softly scalloped hem.
 */
function capeGeometry(): BufferGeometry {
  // Angle π is the top once the tube lies along him (rotated round x): the arc is centred there.
  const geometry = new CylinderGeometry(1, 1, 1, 28, 8, true, Math.PI * 0.42, Math.PI * 1.16);
  const position = geometry.attributes.position!;
  const halfArc = Math.PI * 0.58;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const t = 0.5 - y; // 0 at the neck, 1 at the back
    const r = 0.1 + 0.055 * t;
    // How far round from the top (0) toward either hem (1).
    const side = Math.abs(Math.PI - ((Math.atan2(x, z) + Math.PI * 2) % (Math.PI * 2))) / halfArc;
    const hem = side > 0.95 ? 0.012 * Math.sin(t * Math.PI * 5) : 0;
    // (z here becomes down once the tube is turned: adding to it lowers the back.)
    position.setXYZ(i, x * r, 0.29 * y, z * r + hem + 0.03 * t * t);
  }
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * A pumpkin's shape: an ellipsoid (radii x, y, z along his body) with `ribs` round lobes running along it, parted by
 * narrow, darker grooves (vertex colours), which fade out toward the front and back ends.
 */
function ribbedShell(rx: number, ry: number, rz: number, ribs: number): BufferGeometry {
  // The sphere's poles turned onto the z axis, so its rings run round his body.
  const geometry = new SphereGeometry(1, 64, 28).rotateX(Math.PI / 2);
  const position = geometry.attributes.position!;
  const colors = new Float32Array(position.count * 3);
  const lit = new Color('#f27f1b'), dark = new Color('#b4500a'), c = new Color();
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const ends = 1 - z * z;
    const groove = Math.pow(1 - Math.abs(Math.sin((Math.atan2(y, x) * ribs) / 2)), 4) * ends;
    const r = 1 - 0.12 * groove;
    position.setXYZ(i, x * rx * r, y * ry * r, z * rz);
    c.copy(lit).lerp(dark, Math.min(1, groove * 1.6));
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  return geometry;
}
