import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';
import { mulberry32 } from '../utils/random';

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number, rand: () => number) => void;

/**
 * Draws an original texture into a canvas. Returns null where there's no DOM (unit tests),
 * and callers fall back to plain colours.
 */
function canvasTexture(width: number, height: number, seed: number, draw: Draw, repeat = false): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  draw(ctx, width, height, mulberry32(seed));
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = RepeatWrapping;
  return texture;
}

/** Honey-oak floorboards: 8 rows of 18 cm boards per 1.44 m tile, staggered ends, soft grain. */
export function woodFloorTexture(): CanvasTexture | null {
  return canvasTexture(
    1024,
    1024,
    7,
    (ctx, w, h, rand) => {
      const rows = 8;
      const rowH = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -rand() * w * 0.6;
        while (x < w) {
          const length = w * (0.4 + rand() * 0.5);
          const hue = 31 + (rand() - 0.5) * 5;
          const light = 60 + (rand() - 0.5) * 8;
          ctx.fillStyle = `hsl(${hue} 40% ${light}%)`;
          ctx.fillRect(x, r * rowH, length, rowH);
          for (let g = 0; g < 12; g++) {
            ctx.strokeStyle = `hsla(${hue - 4} 45% ${light - 14}% / ${0.05 + rand() * 0.08})`;
            ctx.lineWidth = 1 + rand() * 1.5;
            const y0 = r * rowH + 4 + rand() * (rowH - 8);
            const wave = rand() * 6;
            ctx.beginPath();
            ctx.moveTo(x, y0);
            for (let px = x; px <= x + length; px += 32) ctx.lineTo(px, y0 + Math.sin(px * 0.012 + wave) * 2.5);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(80, 50, 28, 0.35)';
          ctx.fillRect(x + length - 2, r * rowH, 2, rowH);
          x += length;
        }
        ctx.fillStyle = 'rgba(80, 50, 28, 0.45)';
        ctx.fillRect(0, r * rowH, w, 2);
      }
    },
    true,
  );
}

/** Round woven rug: terracotta borders, a ring of mustard diamonds and a petal medallion. */
export function rugTexture(): CanvasTexture | null {
  return canvasTexture(1024, 1024, 11, (ctx, w, _h, rand) => {
    const c = w / 2;
    const ring = (radius: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(c, c, radius * c, 0, Math.PI * 2);
      ctx.fill();
    };
    ctx.fillStyle = '#f1e3cf';
    ctx.fillRect(0, 0, w, w);
    ring(1.0, '#cf7c62');
    ring(0.93, '#f1e3cf');
    ring(0.89, '#cf7c62');
    ring(0.86, '#f1e3cf');
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      ctx.save();
      ctx.translate(c + Math.cos(a) * 0.76 * c, c + Math.sin(a) * 0.76 * c);
      ctx.rotate(a);
      ctx.fillStyle = '#e3b45f';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.restore();
    }
    ring(0.5, '#9fb592');
    ring(0.46, '#f1e3cf');
    for (let i = 0; i < 8; i++) {
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate((i / 8) * Math.PI * 2);
      ctx.fillStyle = i % 2 ? '#cf7c62' : '#e39a7f';
      ctx.beginPath();
      ctx.ellipse(0, -0.2 * c, 0.07 * c, 0.19 * c, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ring(0.07, '#e3b45f');
    // Woven speckle.
    for (let i = 0; i < 9000; i++) {
      ctx.fillStyle = `rgba(90, 60, 40, ${rand() * 0.06})`;
      ctx.fillRect(rand() * w, rand() * w, 2, 2);
    }
  });
}

function monsteraLeaf(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
  color: string,
  vein: string,
  background: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.55);
  ctx.bezierCurveTo(-size, size * 0.4, -size * 0.85, -size * 0.75, 0, -size * 0.6);
  ctx.bezierCurveTo(size * 0.85, -size * 0.75, size, size * 0.4, 0, size * 0.55);
  ctx.fill();
  ctx.strokeStyle = background;
  ctx.lineCap = 'round';
  ctx.lineWidth = size * 0.06;
  for (const side of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      const y0 = -size * 0.3 + k * size * 0.28;
      ctx.beginPath();
      ctx.moveTo(side * size * 0.35, y0);
      ctx.lineTo(side * size * 1.0, y0 - size * 0.1);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = vein;
  ctx.lineWidth = size * 0.035;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.55);
  ctx.lineTo(0, -size * 0.5);
  ctx.stroke();
  ctx.restore();
}

/** Cream pillow with big monstera leaves, a nod to the leaf pillows in Moke's home. */
export function leafPillowTexture(): CanvasTexture | null {
  return canvasTexture(512, 512, 3, (ctx, w, h) => {
    const bg = '#f3ebde';
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    monsteraLeaf(ctx, 150, 170, 150, -0.5, '#3f8c5c', '#7fbf93', bg);
    monsteraLeaf(ctx, 370, 330, 170, 0.6, '#2f7049', '#6aa97f', bg);
    monsteraLeaf(ctx, 380, 90, 90, 2.4, '#4f9a68', '#8cc9a0', bg);
    monsteraLeaf(ctx, 120, 420, 100, -2.6, '#4f9a68', '#8cc9a0', bg);
  });
}

/** Grey pillow with a white rounded lattice, like the geometric pillow in Moke's photos. */
export function latticePillowTexture(): CanvasTexture | null {
  return canvasTexture(512, 512, 5, (ctx, w, h) => {
    ctx.fillStyle = '#a2a7aa';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#f4f2ee';
    ctx.lineWidth = 13;
    const step = 128;
    for (let x = 0; x <= w; x += step) {
      for (let y = 0; y <= h; y += step) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.beginPath();
        ctx.roundRect(-44, -44, 88, 88, 26);
        ctx.stroke();
        ctx.restore();
      }
    }
  });
}

/** Warm abstract print for the wall above the couch: a coral sun over sage hills and leaves. */
export function wallArtTexture(): CanvasTexture | null {
  return canvasTexture(1024, 720, 13, (ctx, w, h, rand) => {
    ctx.fillStyle = '#f4ead9';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ef8a6d';
    ctx.beginPath();
    ctx.arc(w * 0.62, h * 0.42, h * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e3b45f';
    ctx.beginPath();
    ctx.arc(w * 0.3, h * 0.28, h * 0.07, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8c9a9';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.bezierCurveTo(w * 0.25, h * 0.55, w * 0.55, h * 0.85, w, h * 0.62);
    ctx.lineTo(w, h);
    ctx.fill();
    ctx.fillStyle = '#8fae86';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.bezierCurveTo(w * 0.35, h * 0.72, w * 0.7, h * 0.95, w, h * 0.8);
    ctx.lineTo(w, h);
    ctx.fill();
    monsteraLeaf(ctx, w * 0.14, h * 0.62, h * 0.3, -0.35, '#3f7f58', '#6fa684', '#f4ead9');
    for (let i = 0; i < 4000; i++) {
      ctx.fillStyle = `rgba(120, 90, 60, ${rand() * 0.05})`;
      ctx.fillRect(rand() * w, rand() * h, 2, 2);
    }
  });
}

/** What Moke sees through the window: soft sky, a garden and a few round trees. */
export function gardenTexture(): CanvasTexture | null {
  return canvasTexture(1024, 640, 17, (ctx, w, h, rand) => {
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#e7f3f4');
    sky.addColorStop(0.6, '#f2f4e6');
    sky.addColorStop(1, '#dfeccd');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    const blob = (x: number, y: number, r: number, color: string) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    };
    for (let i = 0; i < 7; i++) {
      const x = (i / 6) * w + (rand() - 0.5) * 80;
      ctx.fillStyle = '#9c8466';
      ctx.fillRect(x - 6, h * 0.45, 12, h * 0.3);
      blob(x, h * 0.42, 70 + rand() * 50, i % 2 ? '#a9cf94' : '#98c286');
      blob(x + 40, h * 0.38, 50 + rand() * 30, '#b6d7a2');
    }
    for (let i = 0; i < 22; i++) blob(rand() * w, h * 0.78 + rand() * 40, 40 + rand() * 40, i % 3 ? '#8fbf7c' : '#7fb06d');
    ctx.fillStyle = '#9dca87';
    ctx.fillRect(0, h * 0.86, w, h * 0.14);
  });
}

/** The great room's floor: long grey-oak planks, 6 rows of 24 cm boards per 1.44 m tile, soft grain. */
export function greyPlankTexture(): CanvasTexture | null {
  return canvasTexture(
    1024,
    1024,
    23,
    (ctx, w, h, rand) => {
      const rows = 6;
      const rowH = h / rows;
      for (let r = 0; r < rows; r++) {
        let x = -rand() * w * 0.7;
        while (x < w) {
          const length = w * (0.55 + rand() * 0.6);
          const light = 70 + (rand() - 0.5) * 7;
          const hue = 34 + (rand() - 0.5) * 8;
          ctx.fillStyle = `hsl(${hue} 9% ${light}%)`;
          ctx.fillRect(x, r * rowH, length, rowH);
          for (let g = 0; g < 14; g++) {
            ctx.strokeStyle = `hsla(${hue} 10% ${light - 16}% / ${0.04 + rand() * 0.07})`;
            ctx.lineWidth = 1 + rand() * 1.6;
            const y0 = r * rowH + 4 + rand() * (rowH - 8);
            const wave = rand() * 6;
            ctx.beginPath();
            ctx.moveTo(x, y0);
            for (let px = x; px <= x + length; px += 32) ctx.lineTo(px, y0 + Math.sin(px * 0.01 + wave) * 3);
            ctx.stroke();
          }
          ctx.fillStyle = 'rgba(70, 64, 58, 0.28)';
          ctx.fillRect(x + length - 2, r * rowH, 2, rowH);
          x += length;
        }
        ctx.fillStyle = 'rgba(70, 64, 58, 0.35)';
        ctx.fillRect(0, r * rowH, w, 2);
      }
    },
    true,
  );
}

/** Grey-and-white arabesque (lantern) tiles, the feature panel behind the range. One tile per 64 px. */
export function arabesqueTileTexture(): CanvasTexture | null {
  return canvasTexture(
    256,
    256,
    29,
    (ctx, w, h) => {
      ctx.fillStyle = '#d9dcdd';
      ctx.fillRect(0, 0, w, h);
      const s = 64;
      for (let row = -1; row <= h / s + 1; row++) {
        for (let col = -1; col <= w / s + 1; col++) {
          const cx = col * s + (row % 2 ? s / 2 : 0);
          const cy = row * s * 0.75;
          ctx.fillStyle = (row + col) % 3 === 0 ? '#f7f7f5' : '#eef0ef';
          ctx.beginPath();
          ctx.moveTo(cx, cy - s * 0.5);
          ctx.bezierCurveTo(cx + s * 0.2, cy - s * 0.35, cx + s * 0.46, cy - s * 0.3, cx + s * 0.46, cy);
          ctx.bezierCurveTo(cx + s * 0.46, cy + s * 0.3, cx + s * 0.2, cy + s * 0.35, cx, cy + s * 0.5);
          ctx.bezierCurveTo(cx - s * 0.2, cy + s * 0.35, cx - s * 0.46, cy + s * 0.3, cx - s * 0.46, cy);
          ctx.bezierCurveTo(cx - s * 0.46, cy - s * 0.3, cx - s * 0.2, cy - s * 0.35, cx, cy - s * 0.5);
          ctx.fill();
        }
      }
    },
    true,
  );
}

/** White subway tile: 4 rows of staggered bricks per tile. */
export function subwayTileTexture(): CanvasTexture | null {
  return canvasTexture(
    256,
    256,
    31,
    (ctx, w, h) => {
      ctx.fillStyle = '#d7d8d6';
      ctx.fillRect(0, 0, w, h);
      const rows = 4;
      const rowH = h / rows;
      for (let r = 0; r < rows; r++) {
        const offset = r % 2 ? w / 4 : 0;
        for (let x = -w / 2 + offset; x < w; x += w / 2) {
          ctx.fillStyle = '#fbfbf9';
          ctx.beginPath();
          ctx.roundRect(x + 2, r * rowH + 2, w / 2 - 4, rowH - 4, 4);
          ctx.fill();
        }
      }
    },
    true,
  );
}

/** The big black Roman-numeral wall clock's face (the dining room). */
export function clockFaceTexture(): CanvasTexture | null {
  return canvasTexture(512, 512, 37, (ctx, w) => {
    const c = w / 2;
    ctx.fillStyle = '#f3efe6';
    ctx.fillRect(0, 0, w, w);
    ctx.fillStyle = '#1f1f22';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 44px Georgia, serif';
    const numerals = ['XII', 'I', 'II', 'III', 'IIII', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
    numerals.forEach((numeral, i) => {
      const a = (i / 12) * Math.PI * 2;
      ctx.save();
      ctx.translate(c + Math.sin(a) * c * 0.74, c - Math.cos(a) * c * 0.74);
      ctx.rotate(a);
      ctx.fillText(numeral, 0, 0);
      ctx.restore();
    });
    ctx.strokeStyle = '#1f1f22';
    ctx.lineCap = 'round';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c + c * 0.32, c - c * 0.18);
    ctx.stroke();
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.lineTo(c - c * 0.08, c - c * 0.55);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, 14, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** The hand-painted sign on the bedroom-hall door. */
export function doorSignTexture(): CanvasTexture | null {
  return canvasTexture(512, 256, 41, (ctx, w, h) => {
    ctx.fillStyle = '#efe6d6';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#8a6a4d';
    ctx.lineWidth = 10;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#4b3a30';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'italic 64px Georgia, serif';
    ctx.fillText('I love you all', w / 2, h / 2 + 4);
  });
}

/** A soft, warm pool of sunlight (additive): brightest in the middle, fading to nothing at the edges. */
export function sunPatchTexture(): CanvasTexture | null {
  return canvasTexture(128, 128, 43, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255, 236, 196, 1)');
    g.addColorStop(0.55, 'rgba(255, 228, 180, 0.65)');
    g.addColorStop(1, 'rgba(255, 220, 170, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}
