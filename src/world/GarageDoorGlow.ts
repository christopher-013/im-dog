import { CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { RIDE } from '../config/ride';
import { GARAGE } from './home/layout';

/** Where the dog is and which way he faces (heading: atan2(dx, dz), his forward is (sin, cos)). */
export interface GlowWatcher {
  readonly x: number;
  readonly z: number;
  readonly heading: number;
}

/** The door's middle on the living room's floor, in front of it. */
const DOOR = { x: GARAGE.houseDoor.x, z: 3 };

/**
 * Should the Garage door glow? Only while a ride can be asked for, and when he's close by or looking at it from across
 * the room (on the living room's side of the door).
 */
export function doorGlowWanted(dog: GlowWatcher, rideAvailable: boolean, tuning = RIDE.doorGlow): boolean {
  if (!rideAvailable) return false;
  const dx = DOOR.x - dog.x;
  const dz = DOOR.z - dog.z;
  const distance = Math.hypot(dx, dz);
  if (dz < -0.2) return false;
  if (distance <= tuning.near) return true;
  if (distance > tuning.lookRange) return false;
  const facing = Math.sin(dog.heading) * (dx / distance) + Math.cos(dog.heading) * (dz / distance);
  return facing >= Math.cos(tuning.lookAngle);
}

/**
 * The Garage door's blue glow (Phase 6): a filled tint over the entire door, a soft halo round its edges, and
 * a little of it pooled on the floor in front, pulsing gently: an adventure close by. Blue planes whose gradients
 * (drawn in code) say how much of it shows: a tint, not added light, so it stays blue on the pale walls (no lights,
 * no files). Hidden (no draw calls) when it's off.
 */
export class GarageDoorGlow {
  readonly object = new Group();
  private readonly materials: MeshBasicMaterial[] = [];
  private amount = 0;
  private time = 0;

  constructor(private readonly tuning = RIDE.doorGlow) {
    this.object.name = 'Garage door glow';
    const d = GARAGE.houseDoor;
    const color = new Color(tuning.color);
    // Full door face plus a soft halo into the wall; the centre must not fade to a dark hole.
    const halo = this.plane(d.width + 0.5, d.height + 0.3, frameGradient(d.width / (d.width + 0.5), d.height / (d.height + 0.3)), color);
    halo.name = 'Garage door face glow';
    halo.position.set(DOOR.x, (d.height + 0.3) / 2 - 0.05, DOOR.z - 0.035);
    halo.rotation.y = Math.PI;
    // On the floor in front of the door.
    const pool = this.plane(d.width + 0.6, 0.9, poolGradient(), color);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(DOOR.x, 0.012, DOOR.z - 0.42);
    this.object.add(halo, pool);
    this.object.visible = false;
  }

  /** Each frame: `wanted` from doorGlowWanted. */
  update(dt: number, wanted: boolean): void {
    this.time += dt;
    const rate = wanted ? 1 / this.tuning.fadeIn : -1 / this.tuning.fadeOut;
    this.amount = Math.min(1, Math.max(0, this.amount + rate * dt));
    this.object.visible = this.amount > 0.001;
    if (!this.object.visible) return;
    const pulse = 0.55 + 0.45 * Math.sin(this.time * Math.PI * 2 * this.tuning.pulse);
    for (const m of this.materials) m.opacity = this.amount * pulse * this.tuning.strength;
  }

  /** How strongly it's glowing (0..1, before the pulse). */
  get strength(): number {
    return this.amount;
  }

  dispose(): void {
    for (const m of this.materials) {
      m.alphaMap?.dispose();
      m.dispose();
    }
    this.object.traverse((o) => {
      if (o instanceof Mesh) o.geometry.dispose();
    });
    this.object.removeFromParent();
  }

  private plane(w: number, h: number, map: CanvasTexture | null, color: Color): Mesh {
    const material = new MeshBasicMaterial({ color, alphaMap: map, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    this.materials.push(material);
    const mesh = new Mesh(new PlaneGeometry(w, h), material);
    mesh.renderOrder = 2;
    return mesh;
  }
}

/** A canvas, or null where there's no DOM (tests): the glow is then a flat tint, which is fine there. */
function canvas(w: number, h: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c.getContext('2d');
}

function texture(ctx: CanvasRenderingContext2D | null): CanvasTexture | null {
  return ctx ? new CanvasTexture(ctx.canvas) : null;
}

/** Filled door with a soft outer halo (`dw`, `dh`: the door's share of the plane). */
function frameGradient(dw: number, dh: number): CanvasTexture | null {
  const W = 128, H = 256;
  const ctx = canvas(W, H);
  if (!ctx) return null;
  const img = ctx.createImageData(W, H);
  // The door's edges (in pixels): its sides and top; its bottom is the floor.
  const left = (W * (1 - dw)) / 2, right = W - left, top = H * (1 - dh);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Keep a visible base across the whole door, slightly brighter at the frame, fading only outside it.
      const outX = x < left ? left - x : x > right ? x - right : 0;
      const outY = y < top ? top - y : 0;
      const inside = outX === 0 && outY === 0;
      const edge = inside ? Math.min(x - left, right - x, y - top) : Math.hypot(outX, outY);
      const fall = inside ? 0.72 + 0.28 * Math.exp(-edge / 6) : Math.exp(-edge / 12);
      // Nothing left by the plane's own edges (sides and top), so no straight line shows where it ends.
      const border = Math.min(1, Math.min(x, W - 1 - x, y) / 10);
      const a = Math.min(1, fall) * border * 255;
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 255;
      img.data[i + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  return asMask(ctx);
}

/** A soft oval of light on the floor, brightest by the door (the top of the texture). */
function poolGradient(): CanvasTexture | null {
  const ctx = canvas(128, 96);
  if (!ctx) return null;
  const g = ctx.createRadialGradient(64, 0, 4, 64, 0, 96);
  g.addColorStop(0, 'rgba(255,255,255,0.75)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.25)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 96);
  return asMask(ctx);
}

/** The gradient as a mask (an alphaMap reads brightness): its alpha turned into grey, opaque. */
function asMask(ctx: CanvasRenderingContext2D): CanvasTexture | null {
  const { width, height } = ctx.canvas;
  const img = ctx.getImageData(0, 0, width, height);
  for (let i = 0; i < img.data.length; i += 4) {
    const a = img.data[i + 3]!;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = a;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return texture(ctx);
}
