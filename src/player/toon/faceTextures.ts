import { CanvasTexture, SRGBColorSpace } from 'three';
import { MOKE_LOOK } from '../../config/mokeLook';

function canvas(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void): CanvasTexture | null {
  if (typeof document === 'undefined') return null; // unit tests: callers fall back to plain colours
  const el = document.createElement('canvas');
  el.width = el.height = size;
  const ctx = el.getContext('2d');
  if (!ctx) return null;
  draw(ctx, size);
  const texture = new CanvasTexture(el);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/**
 * A big glossy anime eye: dark rim, warm brown iris that lightens toward the bottom, a deep pupil,
 * one large catch-light up and to the left and a small one below. Drawn to fill a round disc.
 */
export function eyeTexture(): CanvasTexture | null {
  const p = MOKE_LOOK.palette;
  return canvas(256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = p.eyeRim;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();

    const iris = ctx.createLinearGradient(0, s * 0.12, 0, s * 0.95);
    iris.addColorStop(0, p.irisDark);
    iris.addColorStop(0.55, p.iris);
    iris.addColorStop(1, '#b07a52');
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(c, c + s * 0.02, c * 0.84, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.pupil;
    ctx.beginPath();
    ctx.ellipse(c, c - s * 0.02, c * 0.48, c * 0.52, 0, 0, Math.PI * 2);
    ctx.fill();

    // A soft glint of warm light along the bottom of the iris.
    ctx.strokeStyle = 'rgba(255, 214, 170, 0.55)';
    ctx.lineWidth = s * 0.035;
    ctx.beginPath();
    ctx.arc(c, c + s * 0.02, c * 0.66, Math.PI * 0.2, Math.PI * 0.8);
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(s * 0.36, s * 0.33, s * 0.16, s * 0.14, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(s * 0.66, s * 0.66, s * 0.065, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** A soft pink cheek blush that fades out to nothing at the edge. */
export function blushTexture(): CanvasTexture | null {
  return canvas(128, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, MOKE_LOOK.palette.blush);
    g.addColorStop(0.45, `${MOKE_LOOK.palette.blush}bb`);
    g.addColorStop(1, `${MOKE_LOOK.palette.blush}00`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });
}
