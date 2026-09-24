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
 * Moke's real eyes: round, very dark brown (near-black), with a dark rim, a barely-there pupil, a
 * faint warm glow low in the iris, and a crisp catch-light up and to the left. Drawn to fill a round disc.
 */
export function eyeTexture(): CanvasTexture | null {
  const p = MOKE_LOOK.palette;
  return canvas(256, (ctx, s) => {
    const c = s / 2;
    ctx.fillStyle = p.eyeRim;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.fill();

    const iris = ctx.createRadialGradient(c, c + s * 0.12, s * 0.05, c, c, c * 0.86);
    iris.addColorStop(0, p.iris);
    iris.addColorStop(0.7, p.irisDark);
    iris.addColorStop(1, p.eyeRim);
    ctx.fillStyle = iris;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.86, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = p.pupil;
    ctx.beginPath();
    ctx.arc(c, c - s * 0.02, c * 0.42, 0, Math.PI * 2);
    ctx.fill();

    // Wet shine: a crisp catch-light, a small second one, and a soft sheen along the lower edge.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.ellipse(s * 0.37, s * 0.34, s * 0.11, s * 0.095, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)';
    ctx.beginPath();
    ctx.arc(s * 0.64, s * 0.66, s * 0.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 236, 214, 0.18)';
    ctx.lineWidth = s * 0.05;
    ctx.beginPath();
    ctx.arc(c, c, c * 0.72, Math.PI * 0.25, Math.PI * 0.75);
    ctx.stroke();
  });
}
