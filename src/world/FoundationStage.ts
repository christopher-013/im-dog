import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
  type BufferGeometry,
  type Material,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { HOUSE_SCALE } from '../config/world';
import type { StaticBox } from '../physics/PhysicsWorld';

/** Room interior spans x -3.5..3.5 and z -3..3. */
const ROOM = { width: 7, depth: 6, wallThickness: 0.12 };
/** Opening in the left (x = -3.5) wall. */
const WINDOW = { zMin: -0.7, zMax: 0.9, yMin: 0.7, yMax: 2.1 };

const PALETTE = {
  floor: '#c49c76',
  wall: '#f2e4d0',
  accentWall: '#d6dec9',
  ceiling: '#f8f1e7',
  trim: '#fbf6ee',
  rug: '#e3a58b',
  couch: '#d8cab3',
  pillowLeaf: '#4f9a72',
  pillowMustard: '#e9bf6c',
  walnut: '#8b5a3c',
  outsideSky: '#eef6f4',
  outsideGarden: '#b3d29a',
};

type Vec3Tuple = [number, number, number];

interface MeshOptions {
  rotation?: Vec3Tuple;
  cast?: boolean;
  receive?: boolean;
  /** Also register a static box collider matching this mesh's bounds. */
  solid?: boolean;
}

const tmpSize = new Vector3();
const tmpCenter = new Vector3();

/**
 * TEMPORARY greybox (Milestone 1): a small room at true scale for checking the renderer,
 * lighting, shadows and how big human furniture feels from Moke's eye level.
 * Replaced by world/LivingRoom.ts in Milestone 4.
 */
export class FoundationStage {
  readonly object = new Group();
  /** Collision boxes for everything Moke can bump into, derived from the meshes themselves. */
  readonly colliders: StaticBox[] = [];
  /** Where Moke starts: on the rug, facing the couch. */
  readonly spawn = { position: new Vector3(0.3, 0, 0.55), heading: Math.PI };

  constructor() {
    this.object.name = 'FoundationStage';
    const std = (color: string, roughness: number) => new MeshStandardMaterial({ color, roughness });
    const m = {
      floor: std(PALETTE.floor, 0.8),
      wall: std(PALETTE.wall, 0.95),
      accentWall: std(PALETTE.accentWall, 0.95),
      ceiling: std(PALETTE.ceiling, 1),
      trim: std(PALETTE.trim, 0.7),
      rug: std(PALETTE.rug, 1),
      couch: std(PALETTE.couch, 0.95),
      pillowLeaf: std(PALETTE.pillowLeaf, 0.9),
      pillowMustard: std(PALETTE.pillowMustard, 0.9),
      walnut: std(PALETTE.walnut, 0.6),
    };
    this.buildShell(m);
    this.buildWindow(m.trim);
    this.buildFurniture(m);
  }

  private buildShell(m: Record<'floor' | 'wall' | 'accentWall' | 'ceiling' | 'trim', Material>): void {
    const W = ROOM.width;
    const D = ROOM.depth;
    const T = ROOM.wallThickness;
    const H = HOUSE_SCALE.ceilingHeight;
    const halfW = W / 2;
    const halfD = D / 2;

    this.add(new BoxGeometry(W, 0.1, D), m.floor, [0, -0.05, 0], { cast: false, solid: true });
    this.add(new BoxGeometry(W + 2 * T, 0.1, D + 2 * T), m.ceiling, [0, H + 0.05, 0], { receive: false });

    const solid = { solid: true };
    this.add(new BoxGeometry(W + 2 * T, H, T), m.accentWall, [0, H / 2, -halfD - T / 2], solid);
    this.add(new BoxGeometry(W + 2 * T, H, T), m.wall, [0, H / 2, halfD + T / 2], solid);
    this.add(new BoxGeometry(T, H, D), m.wall, [halfW + T / 2, H / 2, 0], solid);

    // Left wall, built around the window opening so the sun only gets in through the glass.
    const x = -halfW - T / 2;
    const { zMin, zMax, yMin, yMax } = WINDOW;
    const midY = (yMin + yMax) / 2;
    this.add(new BoxGeometry(T, yMin, D), m.wall, [x, yMin / 2, 0], solid);
    this.add(new BoxGeometry(T, H - yMax, D), m.wall, [x, (H + yMax) / 2, 0], solid);
    this.add(new BoxGeometry(T, yMax - yMin, zMin + halfD), m.wall, [x, midY, (zMin - halfD) / 2], solid);
    this.add(new BoxGeometry(T, yMax - yMin, halfD - zMax), m.wall, [x, midY, (zMax + halfD) / 2], solid);

    const bh = 0.09;
    const bt = 0.02;
    this.add(new BoxGeometry(W, bh, bt), m.trim, [0, bh / 2, -halfD + bt / 2]);
    this.add(new BoxGeometry(W, bh, bt), m.trim, [0, bh / 2, halfD - bt / 2]);
    this.add(new BoxGeometry(bt, bh, D), m.trim, [halfW - bt / 2, bh / 2, 0]);
    this.add(new BoxGeometry(bt, bh, D), m.trim, [-halfW + bt / 2, bh / 2, 0]);
  }

  private buildWindow(trim: Material): void {
    const { zMin, zMax, yMin, yMax } = WINDOW;
    const halfW = ROOM.width / 2;
    const x = -halfW - ROOM.wallThickness / 2;
    const depth = ROOM.wallThickness + 0.04;
    const openW = zMax - zMin;
    const openH = yMax - yMin;
    const midY = (yMin + yMax) / 2;
    const midZ = (zMin + zMax) / 2;
    const f = 0.06;
    const mullion = 0.035;

    this.add(new BoxGeometry(depth, f, openW), trim, [x, yMax - f / 2, midZ]);
    this.add(new BoxGeometry(depth, f, openW), trim, [x, yMin + f / 2, midZ]);
    this.add(new BoxGeometry(depth, openH, f), trim, [x, midY, zMin + f / 2]);
    this.add(new BoxGeometry(depth, openH, f), trim, [x, midY, zMax - f / 2]);
    this.add(new BoxGeometry(depth * 0.6, openH, mullion), trim, [x, midY, midZ]);
    this.add(new BoxGeometry(depth * 0.6, mullion, openW), trim, [x, midY, midZ]);
    this.add(new BoxGeometry(0.16, 0.035, openW + 0.2), trim, [-halfW + 0.05, yMin - 0.0175, midZ]);

    // A soft garden-and-sky backdrop outside. Unlit, and it must not block the sun.
    const outside = new PlaneGeometry(8, 5);
    const sky = new Color(PALETTE.outsideSky);
    const garden = new Color(PALETTE.outsideGarden);
    const tmp = new Color();
    const positions = outside.getAttribute('position');
    const colors: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      tmp.lerpColors(garden, sky, (positions.getY(i) + 2.5) / 5);
      colors.push(tmp.r, tmp.g, tmp.b);
    }
    outside.setAttribute('color', new Float32BufferAttribute(colors, 3));
    this.add(outside, new MeshBasicMaterial({ vertexColors: true }), [-halfW - 1.6, 1.4, midZ], {
      rotation: [0, Math.PI / 2, 0],
      cast: false,
      receive: false,
    });
  }

  private buildFurniture(m: Record<'rug' | 'couch' | 'pillowLeaf' | 'pillowMustard' | 'walnut', Material>): void {
    const halfD = ROOM.depth / 2;
    this.add(new CylinderGeometry(1.35, 1.35, 0.016, 64), m.rug, [0.3, 0.008, 0.2], { cast: false });

    // Couch against the back wall. Arms are a touch deeper than the seat to avoid coplanar faces.
    const seatH = HOUSE_SCALE.couchSeatHeight;
    const backH = HOUSE_SCALE.couchBackHeight;
    const couchW = 2.3;
    const couchD = 0.95;
    const cx = 0.3;
    const cz = -halfD + couchD / 2 + 0.06;
    const backZ = cz - couchD / 2;
    const solid = { solid: true };
    this.add(new RoundedBoxGeometry(couchW - 0.1, seatH, couchD, 3, 0.07), m.couch, [cx, seatH / 2, cz], solid);
    this.add(
      new RoundedBoxGeometry(couchW - 0.1, backH - seatH + 0.05, 0.28, 3, 0.09),
      m.couch,
      [cx, (seatH - 0.05 + backH) / 2, backZ + 0.13],
      solid,
    );
    const armGeometry = new RoundedBoxGeometry(0.24, 0.64, couchD + 0.02, 3, 0.09);
    this.add(armGeometry, m.couch, [cx - couchW / 2 + 0.12, 0.32, cz], solid);
    this.add(armGeometry, m.couch, [cx + couchW / 2 - 0.12, 0.32, cz], solid);

    const pillowGeometry = new RoundedBoxGeometry(0.46, 0.42, 0.14, 3, 0.06);
    this.add(pillowGeometry, m.pillowLeaf, [cx - 0.62, seatH + 0.22, backZ + 0.36], { rotation: [-0.28, 0.12, 0.06] });
    this.add(pillowGeometry, m.pillowMustard, [cx + 0.62, seatH + 0.22, backZ + 0.36], {
      rotation: [-0.28, -0.1, -0.05],
    });

    // Coffee table: 0.40 m of clearance underneath, tall enough for Moke to duck under.
    const tableH = HOUSE_SCALE.coffeeTableHeight;
    const top = 0.05;
    const tx = 0.3;
    const tz = -1.15;
    this.add(new RoundedBoxGeometry(1.15, top, 0.62, 2, 0.02), m.walnut, [tx, tableH - top / 2, tz], solid);
    const legGeometry = new CylinderGeometry(0.028, 0.02, tableH - top, 12);
    for (const [dx, dz] of [
      [-0.5, -0.24],
      [0.5, -0.24],
      [-0.5, 0.24],
      [0.5, 0.24],
    ] as const) {
      this.add(legGeometry, m.walnut, [tx + dx, (tableH - top) / 2, tz + dz], solid);
    }
  }

  private add(geometry: BufferGeometry, material: Material, position: Vec3Tuple, options: MeshOptions = {}): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.position.set(...position);
    if (options.rotation) mesh.rotation.set(...options.rotation);
    mesh.castShadow = options.cast ?? true;
    mesh.receiveShadow = options.receive ?? true;
    // Static scenery: compute the matrix once instead of every frame.
    mesh.updateMatrix();
    mesh.matrixAutoUpdate = false;
    this.object.add(mesh);
    if (options.solid) this.addColliderFor(mesh);
    return mesh;
  }

  /** A box matching the mesh's bounds (stage-local = world space, since the stage sits at the origin). */
  private addColliderFor(mesh: Mesh): void {
    mesh.geometry.computeBoundingBox();
    const bounds = mesh.geometry.boundingBox!;
    const half = bounds.getSize(tmpSize).multiply(mesh.scale).multiplyScalar(0.5);
    const center = bounds.getCenter(tmpCenter).applyMatrix4(mesh.matrix);
    const q = mesh.quaternion;
    this.colliders.push({
      center: [center.x, center.y, center.z],
      halfExtents: [half.x, half.y, half.z],
      rotation: [q.x, q.y, q.z, q.w],
    });
  }
}
