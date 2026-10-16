import {
  BufferGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  QuadraticBezierCurve3,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  TubeGeometry,
  Vector3,
  type Material,
} from 'three';
import { HALLOWEEN_DECOR } from '../config/halloween';

/**
 * Halloween's decorations (D30): jack-o'-lanterns round the house and on the patio, and paper bats strung across the
 * living-room window. Presentation only: no colliders (they sit on furniture or in corners), no lights (the candle
 * glow is the carved face's own light, flickering), and hidden outside Halloween. Built in code.
 */
export class HalloweenDecor {
  readonly object = new Group();
  private readonly glow: MeshBasicMaterial;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private time = 0;

  constructor() {
    this.object.name = 'Halloween decorations';
    this.object.visible = false;
    const d = HALLOWEEN_DECOR;
    const skin = this.material(new MeshStandardMaterial({ color: '#ec7a17', roughness: 0.65 }));
    const stemMaterial = this.material(new MeshStandardMaterial({ color: '#4c6b2b', roughness: 0.85 }));
    this.glow = this.material(new MeshBasicMaterial({ color: '#ffc04a', toneMapped: false }));
    const body = this.geometry(pumpkinGeometry());
    const stem = this.geometry(new CylinderGeometry(0.012, 0.018, 0.05, 7));
    const face = this.geometry(faceGeometry());
    for (const p of d.pumpkins) {
      const pumpkin = new Group();
      pumpkin.position.set(p.x, p.y, p.z);
      pumpkin.rotation.y = p.yaw;
      pumpkin.scale.setScalar(p.size);
      const shell = new Mesh(body, skin);
      shell.position.y = d.radius * 0.82;
      shell.scale.setScalar(d.radius);
      shell.castShadow = true;
      const top = new Mesh(stem, stemMaterial);
      top.position.y = d.radius * 1.68;
      top.rotation.z = 0.25;
      pumpkin.add(shell, top);
      if (p.lantern) {
        // The carved face, glowing: just proud of the shell on its front (+z).
        const carved = new Mesh(face, this.glow);
        carved.position.set(0, d.radius * 0.86, d.radius * 1.01);
        carved.scale.setScalar(d.radius);
        pumpkin.add(carved);
      }
      this.object.add(pumpkin);
    }
    this.buildGarland();
  }

  set visible(on: boolean) {
    this.object.visible = on;
  }

  get visible(): boolean {
    return this.object.visible;
  }

  /** The candles flicker. */
  update(dt: number): void {
    if (!this.object.visible) return;
    this.time += dt;
    const f = HALLOWEEN_DECOR.flicker;
    const flicker = 1 - f.amount * (0.5 + 0.5 * Math.sin(this.time * f.speed) * Math.sin(this.time * f.speed * 1.7 + 1.3));
    this.glow.color.setRGB(1 * flicker, 0.75 * flicker, 0.29 * flicker);
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.object.removeFromParent();
  }

  /** A string sagging between two hooks with paper bats hanging along it. */
  private buildGarland(): void {
    const g = HALLOWEEN_DECOR.garland;
    const from = new Vector3(g.from.x, g.y, g.from.z);
    const to = new Vector3(g.to.x, g.y, g.to.z);
    const middle = from.clone().lerp(to, 0.5);
    middle.y -= g.sag;
    // Slightly into the room, so the string hangs clear of the wall and curtains.
    from.x += 0.06; to.x += 0.06; middle.x += 0.1;
    const curve = new QuadraticBezierCurve3(from, middle, to);
    const string = this.material(new MeshStandardMaterial({ color: '#2b2230', roughness: 0.9 }));
    this.object.add(new Mesh(this.geometry(new TubeGeometry(curve, 24, 0.003, 4)), string));
    const paper = this.material(new MeshStandardMaterial({ color: '#17141c', roughness: 0.9, side: DoubleSide }));
    const bat = this.geometry(batGeometry());
    for (let i = 0; i < g.bats; i++) {
      const at = curve.getPoint((i + 0.5) / g.bats);
      const mesh = new Mesh(bat, paper);
      mesh.position.set(at.x, at.y - 0.07, at.z);
      // Facing into the room (+x), tipped a little this way and that.
      mesh.rotation.set(0, Math.PI / 2, (i % 2 ? 1 : -1) * 0.18);
      mesh.scale.setScalar(0.11);
      this.object.add(mesh);
    }
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

/** A unit pumpkin: a squat sphere with eight soft ribs. */
function pumpkinGeometry(): BufferGeometry {
  const geometry = new SphereGeometry(1, 32, 18);
  const position = geometry.attributes.position!;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i), y = position.getY(i), z = position.getZ(i);
    const rib = 1 - 0.09 * Math.pow(Math.abs(Math.sin(Math.atan2(z, x) * 4)), 0.6) * (1 - y * y);
    position.setXYZ(i, x * rib * 1.12, y * 0.82, z * rib * 1.12);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** A jack-o'-lantern's face (unit size, facing +z): two triangle eyes, a triangle nose and a toothy grin. */
function faceGeometry(): BufferGeometry {
  const shapes: Shape[] = [];
  const triangle = (cx: number, cy: number, w: number, h: number, up = true) => {
    const s = new Shape();
    s.moveTo(cx - w / 2, up ? cy - h / 2 : cy + h / 2);
    s.lineTo(cx + w / 2, up ? cy - h / 2 : cy + h / 2);
    s.lineTo(cx, up ? cy + h / 2 : cy - h / 2);
    s.closePath();
    shapes.push(s);
  };
  triangle(-0.36, 0.28, 0.3, 0.26);
  triangle(0.36, 0.28, 0.3, 0.26);
  triangle(0, 0.02, 0.16, 0.14);
  // The grin: a wide crescent with two square teeth notched out of its top edge.
  const grin = new Shape();
  grin.moveTo(-0.55, -0.12);
  grin.lineTo(-0.2, -0.16);
  grin.lineTo(-0.2, -0.08);
  grin.lineTo(-0.08, -0.08);
  grin.lineTo(-0.08, -0.17);
  grin.lineTo(0.12, -0.17);
  grin.lineTo(0.12, -0.08);
  grin.lineTo(0.24, -0.08);
  grin.lineTo(0.24, -0.16);
  grin.lineTo(0.55, -0.12);
  grin.quadraticCurveTo(0.3, -0.5, 0, -0.48);
  grin.quadraticCurveTo(-0.3, -0.5, -0.55, -0.12);
  shapes.push(grin);
  return new ShapeGeometry(shapes);
}

/** A paper bat (unit size, in the x–y plane): a round body and two scalloped wings. */
function batGeometry(): BufferGeometry {
  const s = new Shape();
  s.moveTo(0, 0.3);
  s.lineTo(0.12, 0.42);
  s.lineTo(0.16, 0.2);
  s.quadraticCurveTo(0.5, 0.45, 1, 0.3);
  s.quadraticCurveTo(0.85, 0.05, 0.75, -0.1);
  s.quadraticCurveTo(0.62, 0.05, 0.5, -0.05);
  s.quadraticCurveTo(0.38, 0.08, 0.28, -0.08);
  s.quadraticCurveTo(0.2, -0.3, 0, -0.35);
  s.quadraticCurveTo(-0.2, -0.3, -0.28, -0.08);
  s.quadraticCurveTo(-0.38, 0.08, -0.5, -0.05);
  s.quadraticCurveTo(-0.62, 0.05, -0.75, -0.1);
  s.quadraticCurveTo(-0.85, 0.05, -1, 0.3);
  s.quadraticCurveTo(-0.5, 0.45, -0.16, 0.2);
  s.lineTo(-0.12, 0.42);
  s.closePath();
  return new ShapeGeometry(s);
}
