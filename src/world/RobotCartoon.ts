import { CanvasTexture, LinearFilter, SRGBColorSpace, type MeshBasicMaterial } from 'three';
import { TV_SHOW } from '../config/world';
import { clamp, lerp, smoothstep } from '../utils/math';

/**
 * "GEARBOTS", the Saturday-morning cartoon on every TV in the house: an original show in the style of the 1980s
 * transforming-robot cartoons (flat cel colours, thick black outlines, starburst title cards, sunset highways), drawn
 * in code on a small canvas a dozen times a second, like cel animation "on twos". A friendly show, no fighting.
 *
 * One loop (`LOOP` s): the title card; an orange pickup racing down a desert highway; it transforms into a robot;
 * the robot waves as a purple jet streaks over; the jet transforms; the two high-five; "right back after these
 * messages". The robots are sets of parts, each with a box in the vehicle and one in the robot: transforming moves
 * every part from one to the other in its own slice of the time, with a spin and a swing, so it folds out piece by
 * piece.
 */

/** A part's place, in the bot's own space: centre, size and turn (units ≈ pixels at scale 1, y up, ground at 0). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}

export interface Part {
  readonly name: string;
  readonly fill: string;
  readonly shade: string;
  readonly vehicle: Readonly<Box>;
  readonly robot: Readonly<Box>;
  /** When in the transformation (0 vehicle … 1 robot) this part moves. */
  readonly window: readonly [number, number];
  /** Whole turns it spins on the way (ends the right way up), and how far it swings up out of line. */
  readonly spin?: number;
  readonly arc?: number;
  readonly kind?: 'box' | 'wheel' | 'head' | 'nose';
  /** The raised arm (and its fist): turns about the bot's shoulder for a wave or a high five. */
  readonly arm?: boolean;
}

export interface Bot {
  readonly parts: readonly Part[];
  /** The raised arm's shoulder, in the robot. */
  readonly shoulder: { readonly x: number; readonly y: number };
}

export type SceneName = 'title' | 'drive' | 'transform' | 'wave' | 'jet' | 'highFive' | 'bumper';

/** The episode, in order (seconds). */
export const SCENES: readonly { readonly name: SceneName; readonly from: number; readonly to: number }[] = [
  { name: 'title', from: 0, to: 3 },
  { name: 'drive', from: 3, to: 8.5 },
  { name: 'transform', from: 8.5, to: 11.5 },
  { name: 'wave', from: 11.5, to: 15.5 },
  { name: 'jet', from: 15.5, to: 18 },
  { name: 'highFive', from: 18, to: 21.5 },
  { name: 'bumper', from: 21.5, to: 23.5 },
];
export const LOOP = 23.5;

/** Which scene is on at `time` (s into the loop), how far into it (s) and how far through it (0..1). */
export function sceneAt(time: number): { name: SceneName; t: number; k: number } {
  const at = ((time % LOOP) + LOOP) % LOOP;
  const scene = SCENES.find((s) => at < s.to) ?? SCENES[SCENES.length - 1]!;
  return { name: scene.name, t: at - scene.from, k: (at - scene.from) / (scene.to - scene.from) };
}

/** Where `part` is `s` of the way through the transformation (0 the vehicle, 1 the robot). */
export function partAt(part: Part, s: number, out: Box): Box {
  const [a, b] = part.window;
  const k = ease(clamp01((s - a) / (b - a)));
  const v = part.vehicle;
  const r = part.robot;
  out.x = v.x + (r.x - v.x) * k;
  out.y = v.y + (r.y - v.y) * k + Math.sin(k * Math.PI) * (part.arc ?? 0);
  out.w = v.w + (r.w - v.w) * k;
  out.h = v.h + (r.h - v.h) * k;
  out.r = v.r + (r.r - v.r) * k + (part.spin ?? 0) * Math.PI * 2 * k;
  return out;
}

const box = (x: number, y: number, w: number, h: number, r = 0): Box => ({ x, y, w, h, r });
/** Tucked away inside the vehicle (no size), at (x, y). */
const hidden = (x: number, y: number): Box => box(x, y, 0, 0);

const INK = '#17121f';
const ORANGE = { fill: '#f08a24', shade: '#c0601a' };
const CREAM = { fill: '#f3e6c8', shade: '#cdbb95' };
const GLASS = { fill: '#62c6f2', shade: '#3a93c4' };
const SILVER = { fill: '#cfd6df', shade: '#98a2b0' };
const DARK = { fill: '#3a3d4d', shade: '#262834' };
const PURPLE = { fill: '#8a5cdc', shade: '#6239ab' };
const LILAC = { fill: '#b79cf0', shade: '#8f72cf' };
const AMBER = { fill: '#ffd35c', shade: '#e0a92e' };

/** Bolt: an orange-and-cream pickup truck, facing +x. */
export const TRUCK_BOT: Bot = {
  shoulder: { x: 31, y: 93 },
  parts: [
    { name: 'armL', ...CREAM, vehicle: hidden(0, 30), robot: box(-31, 75, 11, 36), window: [0.45, 0.85], spin: 1, arc: 14 },
    { name: 'fistL', ...SILVER, vehicle: hidden(0, 30), robot: box(-31, 53, 13, 11), window: [0.55, 0.9] },
    { name: 'legL', ...ORANGE, vehicle: box(-49, 25, 24, 20), robot: box(-11, 29, 16, 46), window: [0.1, 0.55], spin: -1, arc: 18 },
    { name: 'legR', ...ORANGE, vehicle: box(-26, 25, 22, 20), robot: box(11, 29, 16, 46), window: [0.15, 0.6], spin: 1, arc: 12 },
    { name: 'footL', ...DARK, vehicle: hidden(-44, 10), robot: box(-12, 4, 24, 8), window: [0.4, 0.75] },
    { name: 'footR', ...DARK, vehicle: hidden(-24, 10), robot: box(12, 4, 24, 8), window: [0.45, 0.8] },
    { name: 'wheelB', kind: 'wheel', ...DARK, vehicle: box(-38, 11, 22, 22), robot: box(-21, 22, 14, 14), window: [0, 0.4], spin: 2, arc: 10 },
    { name: 'wheelF', kind: 'wheel', ...DARK, vehicle: box(36, 11, 22, 22), robot: box(21, 22, 14, 14), window: [0.05, 0.45], spin: -2, arc: 16 },
    { name: 'hood', ...ORANGE, vehicle: box(31, 27, 34, 22), robot: box(0, 59, 28, 16), window: [0.2, 0.6], arc: 10 },
    { name: 'grille', ...SILVER, vehicle: box(49, 26, 5, 14), robot: box(0, 59, 12, 7), window: [0.2, 0.6] },
    { name: 'cab', ...ORANGE, vehicle: box(1, 38, 30, 44), robot: box(0, 83, 46, 34), window: [0.25, 0.7] },
    { name: 'window', ...GLASS, vehicle: box(4, 49, 20, 14), robot: box(0, 89, 34, 11), window: [0.3, 0.72] },
    { name: 'stripe', ...CREAM, vehicle: box(-6, 29, 100, 5), robot: box(0, 75, 46, 5), window: [0.3, 0.75] },
    { name: 'shoulderL', ...ORANGE, vehicle: hidden(0, 40), robot: box(-31, 95, 19, 13), window: [0.5, 0.85] },
    { name: 'shoulderR', ...ORANGE, vehicle: hidden(0, 40), robot: box(31, 95, 19, 13), window: [0.5, 0.85] },
    { name: 'armR', ...CREAM, vehicle: hidden(0, 30), robot: box(31, 75, 11, 36), window: [0.45, 0.85], spin: -1, arc: 14, arm: true },
    { name: 'fistR', ...SILVER, vehicle: hidden(0, 30), robot: box(31, 53, 13, 11), window: [0.55, 0.9], arm: true },
    { name: 'head', kind: 'head', ...ORANGE, vehicle: hidden(1, 40), robot: box(0, 111, 20, 20), window: [0.72, 1] },
  ],
};

/** Aria: a purple-and-silver jet, facing +x. */
export const JET_BOT: Bot = {
  shoulder: { x: 27, y: 92 },
  parts: [
    { name: 'wings', ...LILAC, vehicle: box(-40, 52, 12, 22, -0.35), robot: box(0, 98, 64, 7), window: [0.3, 0.75], spin: 1 },
    { name: 'armL', ...LILAC, vehicle: box(-6, 48, 46, 7, 0.22), robot: box(-27, 74, 10, 36), window: [0.35, 0.8], spin: -1, arc: 12 },
    { name: 'fistL', ...SILVER, vehicle: hidden(0, 40), robot: box(-27, 52, 12, 11), window: [0.55, 0.9] },
    { name: 'legL', ...SILVER, vehicle: box(-38, 36, 26, 9), robot: box(-10, 28, 14, 46), window: [0.1, 0.55], spin: 1, arc: 14 },
    { name: 'legR', ...SILVER, vehicle: box(-38, 45, 26, 9), robot: box(10, 28, 14, 46), window: [0.15, 0.6], spin: -1, arc: 10 },
    { name: 'footL', ...PURPLE, vehicle: hidden(-50, 38), robot: box(-11, 4, 22, 8), window: [0.4, 0.75] },
    { name: 'footR', ...PURPLE, vehicle: hidden(-50, 44), robot: box(11, 4, 22, 8), window: [0.45, 0.8] },
    { name: 'body', ...PURPLE, vehicle: box(2, 40, 84, 15), robot: box(0, 81, 38, 30), window: [0.2, 0.65] },
    { name: 'nose', kind: 'nose', ...SILVER, vehicle: box(52, 40, 18, 12), robot: box(0, 58, 14, 24, -Math.PI / 2), window: [0.15, 0.6], arc: -12 },
    { name: 'canopy', ...AMBER, vehicle: box(24, 47, 22, 8), robot: box(0, 87, 26, 9), window: [0.25, 0.7] },
    { name: 'armR', ...LILAC, vehicle: box(-6, 33, 46, 7, -0.22), robot: box(27, 74, 10, 36), window: [0.35, 0.8], spin: 1, arc: 12, arm: true },
    { name: 'fistR', ...SILVER, vehicle: hidden(0, 40), robot: box(27, 52, 12, 11), window: [0.55, 0.9], arm: true },
    { name: 'head', kind: 'head', ...PURPLE, vehicle: hidden(10, 40), robot: box(0, 108, 18, 19), window: [0.7, 1] },
  ],
};

/** How a bot is drawn this frame: the wheels' roll (rad), the raised arm's turn (rad), and a glint in its eyes (0..1). */
interface Pose {
  wheel?: number;
  arm?: number;
  eyes?: number;
}

/** The show: a canvas texture for the TV screens, redrawn at `TV_SHOW.fps` while the game runs. */
export class RobotCartoon {
  readonly texture: CanvasTexture | null = null;
  private readonly ctx: CanvasRenderingContext2D | null = null;
  private readonly box: Box = box(0, 0, 0, 0);
  private time = 0;
  private sinceFrame = 0;

  constructor(private readonly options: { readonly width: number; readonly height: number; readonly fps: number } = TV_SHOW) {
    if (typeof document === 'undefined') return; // unit tests: no canvas, the screens stay dark
    const canvas = document.createElement('canvas');
    canvas.width = options.width;
    canvas.height = options.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    // Redrawn a dozen times a second: no mipmaps to rebuild each time.
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    this.texture = texture;
    this.draw();
  }

  /** Plays the show on `material` (the TV screens'); without a canvas it stays a dark screen. */
  showOn(material: MeshBasicMaterial): void {
    if (!this.texture) return;
    material.map = this.texture;
    material.color.set('#ffffff');
    material.needsUpdate = true;
  }

  /** Each rendered frame (dt 0 while paused: the show pauses with the game). */
  update(dt: number): void {
    if (!this.ctx || dt <= 0) return;
    this.time = (this.time + dt) % LOOP;
    this.sinceFrame += dt;
    if (this.sinceFrame < 1 / this.options.fps) return;
    this.sinceFrame %= 1 / this.options.fps;
    this.draw();
    this.texture!.needsUpdate = true;
  }

  dispose(): void {
    this.texture?.dispose();
  }

  private draw(): void {
    const ctx = this.ctx!;
    const { width: W, height: H } = this.options;
    const { name, t, k } = sceneAt(this.time);
    ctx.save();
    switch (name) {
      case 'title':
        this.title(ctx, W, H, t);
        break;
      case 'drive':
        this.drive(ctx, W, H, t);
        break;
      case 'transform':
        starburst(ctx, W / 2, H * 0.55, W, t * 1.4, '#1f4fd1', '#3a7bff');
        this.transforming(ctx, TRUCK_BOT, W / 2, H * 0.94, 1.25, 1, t);
        break;
      case 'wave':
        this.wave(ctx, W, H, t);
        break;
      case 'jet':
        starburst(ctx, W / 2, H * 0.5, W, -t * 1.4, '#5a2ea6', '#8a5cdc');
        this.transforming(ctx, JET_BOT, W / 2, H * 0.94, 1.25, -1, t);
        break;
      case 'highFive':
        this.highFive(ctx, W, H, t);
        break;
      case 'bumper':
        this.bumper(ctx, W, H, t, k);
        break;
    }
    ctx.restore();
    crt(ctx, W, H);
  }

  // ------------------------------------------------------------------ scenes

  /** The title card: a spinning starburst, the gear emblem, and the name punching in. */
  private title(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    starburst(ctx, W / 2, H * 0.55, W, t * 0.5, '#ff5a36', '#ffb13b');
    const punch = 1 + 0.8 * (1 - ease(clamp01(t / 0.45)));
    gear(ctx, W / 2, H * 0.27, 23 * punch, t * 1.5);
    logo(ctx, 'GEARBOTS', W / 2, H * 0.66, Math.min(W * 0.14, 48) * punch, W * 0.92);
    if (t > 0.8) caption(ctx, '★ SATURDAY MORNING ★', W / 2, H * 0.88, 13, '#ffffff');
  }

  /** Down the highway at sunset: the truck rolls in and the desert streams past. */
  private drive(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const horizon = H * 0.6;
    sunset(ctx, W, H, horizon);
    mesas(ctx, W, horizon, t * 18, '#8a4a86', 0.7);
    mesas(ctx, W, horizon, t * 45, '#5b2a63', 1);
    // The road, its dashes rushing by.
    ctx.fillStyle = '#c98a5a';
    ctx.fillRect(0, horizon, W, H - horizon);
    ctx.fillStyle = '#3b3548';
    ctx.fillRect(0, H * 0.7, W, H * 0.24);
    ctx.fillStyle = '#ffd35c';
    const dash = 46;
    for (let x = -((t * 260) % dash); x < W; x += dash) ctx.fillRect(x, H * 0.815, dash * 0.55, 3);
    const x = lerp(-90, W * 0.52, ease(clamp01(t / 1.6)));
    const bounce = Math.abs(Math.sin(t * 17)) * 1.2;
    speedLines(ctx, W, H, t, x - 40);
    // Dust from the back wheel.
    for (let i = 0; i < 4; i++) {
      const p = (t * 3 + i / 4) % 1;
      ctx.fillStyle = `rgba(240, 200, 160, ${0.55 * (1 - p)})`;
      ctx.beginPath();
      ctx.arc(x - 38 * 1.05 - p * 60, H * 0.9 - 6 - p * 10, 5 + p * 9, 0, Math.PI * 2);
      ctx.fill();
    }
    this.drawBot(ctx, TRUCK_BOT, 0, x, H * 0.9 - bounce, 1.05, 1, { wheel: -t * 22 });
  }

  /** Vehicle to robot (or back the other way round: `dir` -1 faces left), with swooshes and a flash to finish. */
  private transforming(ctx: CanvasRenderingContext2D, bot: Bot, x: number, ground: number, scale: number, dir: 1 | -1, t: number): void {
    const s = ease(clamp01((t - 0.25) / 2.1));
    if (s > 0.03 && s < 0.97) swooshes(ctx, x, ground - 60 * scale, 90 * scale, t, Math.sin(s * Math.PI));
    if (s < 0.2 && bot === JET_BOT) exhaust(ctx, x - dir * 58 * scale, ground - 40 * scale, dir, t);
    this.drawBot(ctx, bot, s, x, ground, scale, dir, { eyes: clamp01((t - 2.35) * 3) });
    flash(ctx, t, 2.55);
  }

  /** At the city at dusk, the new robot's eyes light up, and it waves as a jet streaks overhead. */
  private wave(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const ground = H * 0.97;
    city(ctx, W, H, ground);
    // The jet, left to right across the sky, with its trail.
    const jt = clamp01((t - 1.1) / 2.2);
    if (jt > 0 && jt < 1) {
      const jx = lerp(-70, W + 70, jt);
      const jy = H * 0.22 + Math.sin(jt * Math.PI) * -8;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.max(-10, jx - 180), jy + 4);
      ctx.lineTo(jx - 30, jy - 1);
      ctx.stroke();
      exhaust(ctx, jx - 28, jy - 2, 1, t);
      this.drawBot(ctx, JET_BOT, 0, jx, jy + 20, 0.55, 1, {});
    }
    // Arm up, a few waves, arm down.
    const up = clamp01((t - 0.7) / 0.35) * (1 - clamp01((t - 3.4) / 0.35));
    const arm = up * (2.45 + 0.4 * Math.sin((t - 0.7) * 8));
    const eyes = Math.max(0, 1 - Math.abs(t - 0.35) * 3);
    this.drawBot(ctx, TRUCK_BOT, 1, W * 0.4, ground, 1.42, 1, { arm, eyes });
  }

  /** Both robots, side by side: they step in and high-five. CLANK! */
  private highFive(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const ground = H * 0.97;
    city(ctx, W, H, ground);
    const scale = 1.2;
    const step = ease(clamp01(t / 0.8));
    const hop = Math.abs(Math.sin(step * Math.PI * 2)) * 3;
    // Placed so the raised fists meet in the middle (arm fully up: see TRUCK_BOT and JET_BOT's shoulders).
    const left = W / 2 - 72 - 12 * (1 - step);
    const right = W / 2 + 68 + 12 * (1 - step);
    const arm = 2.3 * ease(clamp01((t - 0.6) / 0.45)) * (1 - clamp01((t - 2.9) / 0.4));
    this.drawBot(ctx, TRUCK_BOT, 1, left, ground - hop, scale, 1, { arm });
    this.drawBot(ctx, JET_BOT, 1, right, ground - hop, scale, -1, { arm, eyes: Math.max(0, 1 - Math.abs(t - 1.5) * 2) });
    const hit = t - 1.05;
    if (hit > 0 && hit < 1.1) {
      const y = ground - 118 * scale;
      star(ctx, W / 2, y, 16 + hit * 26, 10, `rgba(255, 236, 120, ${1 - hit / 1.1})`);
      if (hit < 0.9) caption(ctx, 'CLANK!', W / 2, y - 26 - hit * 8, 20, '#ffe066');
    }
  }

  /** "Right back after these messages". */
  private bumper(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, k: number): void {
    ctx.fillStyle = '#1b2f8f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#2342b8';
    for (let x = -H + ((t * 40) % 40); x < W; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + 20, H);
      ctx.lineTo(x + 20 + H, 0);
      ctx.lineTo(x + H, 0);
      ctx.fill();
    }
    gear(ctx, W / 2, H * 0.3, 20, t * 3);
    logo(ctx, 'GEARBOTS', W / 2, H * 0.6, Math.min(W * 0.1, 34), W * 0.8);
    if (k > 0.15) caption(ctx, 'WILL BE RIGHT BACK!', W / 2, H * 0.8, 14, '#ffffff');
  }

  // ------------------------------------------------------------------ the bots

  private drawBot(ctx: CanvasRenderingContext2D, bot: Bot, s: number, x: number, ground: number, scale: number, dir: 1 | -1, pose: Pose): void {
    ctx.save();
    ctx.translate(x, ground);
    // y up from the ground, and mirrored to face left.
    ctx.scale(scale * dir, -scale);
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2 / scale;
    ctx.strokeStyle = INK;
    const b = this.box;
    for (const part of bot.parts) {
      partAt(part, s, b);
      if (b.w < 0.5 || b.h < 0.5) continue;
      if (part.kind === 'wheel') b.r += pose.wheel ?? 0;
      if (part.arm && pose.arm) {
        // Round the shoulder.
        const { x: px, y: py } = bot.shoulder;
        const c = Math.cos(pose.arm);
        const sn = Math.sin(pose.arm);
        const dx = b.x - px;
        const dy = b.y - py;
        b.x = px + dx * c - dy * sn;
        b.y = py + dx * sn + dy * c;
        b.r += pose.arm;
      }
      drawPart(ctx, part, b, pose.eyes ?? 0);
    }
    ctx.restore();
  }
}

// ------------------------------------------------------------------ drawing

function drawPart(ctx: CanvasRenderingContext2D, part: Part, b: Box, eyes: number): void {
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.rotate(b.r);
  const { w, h } = b;
  if (part.kind === 'wheel') {
    const r = Math.min(w, h) / 2;
    ctx.fillStyle = part.fill;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = SILVER.fill;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
    }
    ctx.stroke();
  } else if (part.kind === 'head') {
    head(ctx, w, h, part, eyes);
  } else {
    if (part.kind === 'nose') {
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w * 0.1, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w * 0.1, h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
    } else {
      roundRect(ctx, -w / 2, -h / 2, w, h, Math.min(w, h) * 0.2);
    }
    celFill(ctx, part, w, h);
    ctx.stroke();
  }
  ctx.restore();
}

/** Flat colour, a hard shadow along the bottom third and a glint on top: cel shading. */
function celFill(ctx: CanvasRenderingContext2D, colors: { fill: string; shade: string }, w: number, h: number): void {
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = colors.shade;
  ctx.fillRect(-w / 2, -h / 2, w, h * 0.34);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillRect(-w / 2 + w * 0.14, h / 2 - h * 0.22, w * 0.34, Math.max(1, h * 0.08));
  ctx.restore();
}

/** A robot's head: a helmet with side fins and a crest, a pale face plate, and a glowing visor. */
function head(ctx: CanvasRenderingContext2D, w: number, h: number, colors: { fill: string; shade: string }, eyes: number): void {
  // Fins either side, and the crest.
  ctx.fillStyle = colors.fill;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(side * w * 0.45, -h * 0.1);
    ctx.lineTo(side * w * 0.72, h * 0.62);
    ctx.lineTo(side * w * 0.42, h * 0.3);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  roundRect(ctx, -w / 2, -h / 2, w, h, w * 0.25);
  celFill(ctx, colors, w, h);
  ctx.stroke();
  roundRect(ctx, -w * 0.08, h * 0.3, w * 0.16, h * 0.32, w * 0.05);
  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.stroke();
  // The face plate and the mouth guard.
  roundRect(ctx, -w * 0.32, -h * 0.4, w * 0.64, h * 0.62, w * 0.12);
  ctx.fillStyle = '#e3e8ee';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  for (const x of [-0.12, 0, 0.12]) {
    ctx.moveTo(x * w, -h * 0.34);
    ctx.lineTo(x * w, -h * 0.16);
  }
  ctx.stroke();
  // The visor: bright, brighter still with a glint.
  roundRect(ctx, -w * 0.3, h * 0.0, w * 0.6, h * 0.16, h * 0.06);
  ctx.fillStyle = eyes > 0 ? '#e8ffff' : '#6ff0ff';
  ctx.fill();
  ctx.stroke();
  if (eyes > 0) star(ctx, w * 0.16, h * 0.08, 4 + eyes * 10, 4, `rgba(255, 255, 255, ${eyes})`);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const q = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + q, y);
  ctx.arcTo(x + w, y, x + w, y + h, q);
  ctx.arcTo(x + w, y + h, x, y + h, q);
  ctx.arcTo(x, y + h, x, y, q);
  ctx.arcTo(x, y, x + w, y, q);
  ctx.closePath();
}

/** Rays of two colours turning round (cx, cy): the classic dramatic backdrop. */
function starburst(ctx: CanvasRenderingContext2D, cx: number, cy: number, reach: number, turn: number, a: string, b: string): void {
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = b;
  const rays = 14;
  for (let i = 0; i < rays; i++) {
    const a0 = turn + (i / rays) * Math.PI * 2;
    const a1 = a0 + Math.PI / rays;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(a0) * reach, cy + Math.sin(a0) * reach);
    ctx.lineTo(cx + Math.cos(a1) * reach, cy + Math.sin(a1) * reach);
    ctx.fill();
  }
}

/** The show's emblem: a chunky gear with a lightning bolt. */
function gear(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, turn: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.beginPath();
  const teeth = 10;
  for (let i = 0; i < teeth * 2; i++) {
    const a0 = turn + (i / (teeth * 2)) * Math.PI * 2;
    const a1 = turn + ((i + 1) / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 ? r * 0.8 : r;
    ctx.lineTo(Math.cos(a0) * rr, Math.sin(a0) * rr);
    ctx.lineTo(Math.cos(a1) * rr, Math.sin(a1) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = SILVER.fill;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.56, 0, Math.PI * 2);
  ctx.fillStyle = '#d8342c';
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  const s = r * 0.42;
  ctx.moveTo(0.15 * s, -1 * s);
  ctx.lineTo(-0.45 * s, 0.1 * s);
  ctx.lineTo(0 * s, 0.1 * s);
  ctx.lineTo(-0.15 * s, 1 * s);
  ctx.lineTo(0.45 * s, -0.15 * s);
  ctx.lineTo(0 * s, -0.15 * s);
  ctx.closePath();
  ctx.fillStyle = '#ffd35c';
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Chrome letters with a thick outline, shrunk to fit `maxWidth`. */
function logo(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxWidth: number): void {
  ctx.save();
  ctx.font = `italic 900 ${Math.round(size)}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
  const fit = Math.min(1, maxWidth / Math.max(1, ctx.measureText(text).width));
  ctx.translate(x, y);
  ctx.scale(fit, fit);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const chrome = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  chrome.addColorStop(0, '#ffffff');
  chrome.addColorStop(0.45, '#bfe6ff');
  chrome.addColorStop(0.5, '#2a6fd6');
  chrome.addColorStop(1, '#a8dcff');
  ctx.lineWidth = Math.max(4, size * 0.16);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = chrome;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

function caption(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string): void {
  ctx.save();
  ctx.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.28);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** A sunset sky with a striped sun sinking behind the horizon. */
function sunset(ctx: CanvasRenderingContext2D, W: number, H: number, horizon: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#2a1b5e');
  sky.addColorStop(0.55, '#d6457e');
  sky.addColorStop(1, '#ffb347');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);
  ctx.fillStyle = '#ffd56b';
  ctx.beginPath();
  ctx.arc(W * 0.72, horizon, H * 0.2, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = '#e8667a';
  for (let i = 0; i < 4; i++) ctx.fillRect(W * 0.72 - H * 0.2, horizon - 5 - i * 7, H * 0.4, 2 + i * 0.4);
}

/** A row of flat-topped mesas, scrolling left by `offset` px. */
function mesas(ctx: CanvasRenderingContext2D, W: number, horizon: number, offset: number, color: string, height: number): void {
  ctx.fillStyle = color;
  const span = 150;
  for (let x = -((offset % span) + span); x < W + span; x += span) {
    const top = horizon - 34 * height;
    ctx.beginPath();
    ctx.moveTo(x, horizon + 1);
    ctx.lineTo(x + 18, top);
    ctx.lineTo(x + 70, top);
    ctx.lineTo(x + 82, top + 10 * height);
    ctx.lineTo(x + 96, horizon + 1);
    ctx.fill();
  }
}

function speedLines(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, behind: number): void {
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < 9; i++) {
    const y = H * (0.66 + ((i * 37) % 23) / 100);
    const x = ((i * 97 - t * 520) % (W + 120) + W + 120) % (W + 120) - 60;
    if (x > behind) continue;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 26 + (i % 3) * 14, y);
  }
  ctx.stroke();
}

/** A city skyline at dusk, lit windows and a few stars, and the street. */
function city(ctx: CanvasRenderingContext2D, W: number, H: number, ground: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, ground);
  sky.addColorStop(0, '#1b1540');
  sky.addColorStop(0.6, '#6b3a8f');
  sky.addColorStop(1, '#f08a5d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 18; i++) ctx.fillRect((i * 83) % W, ((i * 47) % 50) + 6, 1.5, 1.5);
  let x = 0;
  for (let i = 0; x < W; i++) {
    const w = 30 + ((i * 29) % 26);
    const h = 50 + ((i * 53) % 70);
    ctx.fillStyle = i % 2 ? '#2c2358' : '#241d4a';
    ctx.fillRect(x, ground - h, w - 2, h);
    ctx.fillStyle = '#ffd36b';
    for (let wy = ground - h + 8; wy < ground - 14; wy += 11) {
      for (let wx = x + 5; wx < x + w - 8; wx += 8) if (((wx * 7 + wy * 3) | 0) % 5 < 2) ctx.fillRect(wx, wy, 3, 4);
    }
    x += w;
  }
  ctx.fillStyle = '#2d2842';
  ctx.fillRect(0, ground - 2, W, H - ground + 2);
}

/** Curved motion streaks round a transforming bot. */
function swooshes(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number, strength: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.8 * strength})`;
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    const a = t * 7 + (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r * (0.75 + 0.1 * (i % 3)), a, a + 0.7);
    ctx.stroke();
  }
  ctx.restore();
}

/** A jet's flickering exhaust, pointing away from `dir`. */
function exhaust(ctx: CanvasRenderingContext2D, x: number, y: number, dir: 1 | -1, t: number): void {
  const len = 14 + Math.sin(t * 40) * 4;
  ctx.fillStyle = '#ffb13b';
  ctx.beginPath();
  ctx.moveTo(x, y - 5);
  ctx.lineTo(x - dir * len, y);
  ctx.lineTo(x, y + 5);
  ctx.fill();
  ctx.fillStyle = '#fff3c4';
  ctx.beginPath();
  ctx.moveTo(x, y - 2.5);
  ctx.lineTo(x - dir * len * 0.55, y);
  ctx.lineTo(x, y + 2.5);
  ctx.fill();
}

/** A white flash over the whole picture, peaking at `at` seconds. */
function flash(ctx: CanvasRenderingContext2D, t: number, at: number): void {
  const a = Math.max(0, 1 - Math.abs(t - at) / 0.22);
  if (a <= 0) return;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * a})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** A four- (or more-) pointed sparkle. */
function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.28 : r;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
}

/** Faint scanlines and darker corners: an old TV picture. */
function crt(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

/** Smooth in and out. */
function ease(t: number): number {
  return smoothstep(0, 1, t);
}
