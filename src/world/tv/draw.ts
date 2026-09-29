import { clamp, smoothstep } from '../../utils/math';

/**
 * What the TVs show (world/tv/): each show is a loop of cartoon scenes drawn in code onto a small canvas (see
 * TvChannels), in flat colours with thick outlines. These are the pieces they share.
 */

/** One show: its name, its channel number (the on-screen display when a TV switches to it), and how to draw it. */
export interface TvShow {
  readonly name: string;
  readonly channel: number;
  /** In the corner when a TV switches to it, instead of "CH 07" (a live special says LIVE). */
  readonly osd?: string;
  /** Seconds before it starts again from the top. */
  readonly loop: number;
  /** Draws the frame `time` seconds into the show onto the whole canvas. */
  draw(ctx: CanvasRenderingContext2D, width: number, height: number, time: number): void;
}

/** A show's scenes, back to back (seconds). */
export type Scenes<N extends string> = readonly { readonly name: N; readonly from: number; readonly to: number }[];

/** Which of `scenes` is on `time` s into the loop, how far into it (s) and how far through it (0..1). */
export function sceneAt<N extends string>(scenes: Scenes<N>, time: number): { name: N; t: number; k: number } {
  const loop = scenes[scenes.length - 1]!.to;
  const at = ((time % loop) + loop) % loop;
  const scene = scenes.find((s) => at < s.to) ?? scenes[scenes.length - 1]!;
  return { name: scene.name, t: at - scene.from, k: (at - scene.from) / (scene.to - scene.from) };
}

/** The ink of every outline. */
export const INK = '#17121f';

export type GradientStops = readonly (readonly [number, string])[];
/** Classic chrome lettering. */
export const CHROME: GradientStops = [[0, '#ffffff'], [0.45, '#bfe6ff'], [0.5, '#2a6fd6'], [1, '#a8dcff']];

/** A rectangle with rounded corners, as the current path. */
export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
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
export function starburst(ctx: CanvasRenderingContext2D, cx: number, cy: number, reach: number, turn: number, a: string, b: string): void {
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

/** Chrome (or `stops`: gold, red…) letters with a thick outline, shrunk to fit `maxWidth`. */
export function logo(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, maxWidth: number, stops: GradientStops = CHROME): void {
  ctx.save();
  ctx.font = `italic 900 ${Math.round(size)}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
  const fit = Math.min(1, maxWidth / Math.max(1, ctx.measureText(text).width));
  ctx.translate(x, y);
  ctx.scale(fit, fit);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const chrome = ctx.createLinearGradient(0, -size / 2, 0, size / 2);
  for (const [at, color] of stops) chrome.addColorStop(at, color);
  ctx.lineWidth = Math.max(4, size * 0.16);
  ctx.strokeStyle = INK;
  ctx.strokeText(text, 0, 0);
  ctx.fillStyle = chrome;
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/** A line of bold outlined lettering, centred on (x, y). */
export function caption(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string): void {
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

/** A row of flat-topped mesas, scrolling left by `offset` px. */
export function mesas(ctx: CanvasRenderingContext2D, W: number, horizon: number, offset: number, color: string, height: number): void {
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

/** White streaks rushing left (motion), only behind `behind` (px). */
export function speedLines(ctx: CanvasRenderingContext2D, W: number, H: number, t: number, behind: number): void {
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

/** A white flash over the whole picture, peaking at `at` seconds. */
export function flash(ctx: CanvasRenderingContext2D, t: number, at: number): void {
  const a = Math.max(0, 1 - Math.abs(t - at) / 0.22);
  if (a <= 0) return;
  ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * a})`;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

/** A four- (or more-) pointed sparkle. */
export function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points: number, color: string): void {
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
export function crt(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  const vignette = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

/** A white speech bubble with a tail pointing down, centred on (x, y). */
export function bubble(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  ctx.save();
  ctx.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", Arial, sans-serif`;
  const w = ctx.measureText(text).width + size * 1.4;
  const h = size * 2;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, h * 0.45);
  ctx.moveTo(x - size * 0.4, y + h / 2 - 1);
  ctx.lineTo(x - size * 0.1, y + h / 2 + size * 0.7);
  ctx.lineTo(x + size * 0.3, y + h / 2 - 1);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}

/** Clamped to 0..1. */
export function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

/** Smooth in and out. */
export function ease(t: number): number {
  return smoothstep(0, 1, t);
}
