import { lerp } from '../../utils/math';
import { bubble, caption, clamp01, ease, flash, INK, logo, roundRect, sceneAt, star, type GradientStops, type Scenes, type TvShow } from './draw';

/**
 * "STAR VOYAGERS", a TV show in the style of the late-1980s starship series (owner request, 2026-10-05): a calm bald
 * captain, a bearded first officer, a pale golden android at the helm and a tall security chief with a ridged
 * forehead, on the bridge of the starship Wanderer. Original: none of any real show's names, ship, insignia, logos
 * or catchphrases beyond the everyday word "Engage".
 *
 * One loop: the title among the stars; the bridge, the crew at their posts ("Course laid in, Captain."); the captain
 * stands, points at the viewscreen: "ENGAGE!"; the stars stretch into warp on the viewscreen; outside, the ship
 * stretches and flashes away; "next time: a new world!".
 */

type SceneName = 'title' | 'bridge' | 'engage' | 'warp' | 'ship' | 'outro';

export const SCENES: Scenes<SceneName> = [
  { name: 'title', from: 0, to: 3.5 },
  { name: 'bridge', from: 3.5, to: 10 },
  { name: 'engage', from: 10, to: 13.5 },
  { name: 'warp', from: 13.5, to: 16.5 },
  { name: 'ship', from: 16.5, to: 20.5 },
  { name: 'outro', from: 20.5, to: 23 },
];

const GOLD_CHROME: GradientStops = [[0, '#fff6d6'], [0.45, '#ffd56b'], [0.5, '#a8721b'], [1, '#ffe7a3']];
const SPACE = '#070a1c';

/** The four of them: skin, hair, uniform, and what makes each one. */
type Crew = 'captain' | 'first' | 'android' | 'chief';
const LOOK: Record<Crew, { skin: string; hair: string; uniform: string; tall: number }> = {
  captain: { skin: '#e9b993', hair: '#9a948c', uniform: '#b8262c', tall: 1 },
  first: { skin: '#e2ae88', hair: '#3b2a20', uniform: '#b8262c', tall: 1.06 },
  android: { skin: '#e8e0bf', hair: '#2a2420', uniform: '#d8a42a', tall: 1 },
  chief: { skin: '#8a5a3a', hair: '#1c1512', uniform: '#d8a42a', tall: 1.16 },
};

/** A fixed field of stars (x, y in 0..1, size). */
const STARS: readonly (readonly [number, number, number])[] = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => {
    const v = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  return [r(1), r(2), 0.5 + r(3) * 1.4] as const;
});

export class StarVoyagers implements TvShow {
  readonly name = 'STAR VOYAGERS';
  readonly channel = 9;
  readonly loop = SCENES[SCENES.length - 1]!.to;

  draw(ctx: CanvasRenderingContext2D, W: number, H: number, time: number): void {
    const { name, t, k } = sceneAt(SCENES, time);
    ctx.save();
    switch (name) {
      case 'title':
        this.title(ctx, W, H, t);
        break;
      case 'bridge':
        this.bridge(ctx, W, H, t);
        break;
      case 'engage':
        this.engage(ctx, W, H, t);
        break;
      case 'warp':
        warpField(ctx, 0, 0, W, H, 0.15 + k * 0.85, time);
        caption(ctx, 'WARP SPEED!', W / 2, H * 0.84, 18, '#bfe6ff');
        flash(ctx, t, 2.6);
        break;
      case 'ship':
        this.ship(ctx, W, H, t);
        break;
      case 'outro':
        stars(ctx, 0, 0, W, H, time * 6);
        logo(ctx, 'STAR VOYAGERS', W / 2, H * 0.38, Math.min(W * 0.1, 34), W * 0.9, GOLD_CHROME);
        if (t > 0.5) caption(ctx, 'NEXT TIME: A NEW WORLD!', W / 2, H * 0.66, 13, '#ffffff');
        break;
    }
    ctx.restore();
  }

  /** Stars drifting past, a ringed planet, the name in gold. */
  private title(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    stars(ctx, 0, 0, W, H, t * 14);
    planet(ctx, W * 0.82, H * 0.78, H * 0.22);
    const punch = 1 + 0.5 * (1 - ease(clamp01(t / 0.5)));
    logo(ctx, 'STAR VOYAGERS', W / 2, H * 0.32, Math.min(W * 0.11, 38) * punch, W * 0.9, GOLD_CHROME);
    if (t > 0.9) caption(ctx, '★ ONWARD TO THE STARS ★', W / 2, H * 0.52, 11, '#ffffff');
  }

  /** The bridge: the big viewscreen, the crew at their posts. */
  private bridge(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    bridgeRoom(ctx, W, H, t);
    // The security chief at the rail at the back, the android at the helm in front, the two chairs in the middle.
    person(ctx, 'chief', W * 0.13, H * 0.7, 1.35, 0, t);
    chair(ctx, W * 0.52, H * 0.94, 1.45);
    chair(ctx, W * 0.76, H * 0.95, 1.35);
    person(ctx, 'captain', W * 0.52, H * 0.94, 1.45, 0, t, true);
    person(ctx, 'first', W * 0.76, H * 0.95, 1.35, 0, t + 1.3, true);
    helmConsole(ctx, W * 0.27, H * 1.04, 1.4, t);
    person(ctx, 'android', W * 0.27, H * 1.04, 1.4, 0, t + 0.6, true);
    // Each line in a bubble over whoever says it.
    if (t > 0.6 && t < 2.6) bubble(ctx, 'Course laid in, Captain.', W * 0.3, H * 0.5, 9);
    else if (t > 2.9 && t < 4.6) bubble(ctx, 'Shields up, sir.', W * 0.18, H * 0.16, 9);
    else if (t > 4.8) bubble(ctx, 'All decks ready!', W * 0.74, H * 0.5, 9);
  }

  /** The captain stands, tugs his tunic straight, and points at the viewscreen: ENGAGE! */
  private engage(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    // Close up, the viewscreen behind him.
    ctx.fillStyle = '#c9b48f';
    ctx.fillRect(0, 0, W, H);
    screenFrame(ctx, W * 0.08, H * 0.06, W * 0.84, H * 0.62, t * 6, 0);
    const point = ease(clamp01((t - 0.7) / 0.35));
    person(ctx, 'captain', W * 0.5, H * 1.25, 2.6, point, t);
    if (t > 1.05) {
      const pop = 1 + 0.4 * (1 - ease(clamp01((t - 1.05) / 0.3)));
      logo(ctx, 'ENGAGE!', W / 2, H * 0.2, 34 * pop, W * 0.8, GOLD_CHROME);
    }
  }

  /** Outside: the ship gliding, then stretching out and flashing away to warp. */
  private ship(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    stars(ctx, 0, 0, W, H, t * (t > 2 ? 60 : 8));
    const go = clamp01((t - 2) / 0.6);
    const stretch = 1 + go * 5;
    const x = lerp(W * 0.42, W * 1.4, ease(go));
    starship(ctx, x, H * 0.52, 1.3, stretch);
    if (t > 2) {
      ctx.strokeStyle = `rgba(190, 230, 255, ${0.8 * (1 - clamp01((t - 2.6) / 1))})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, H * 0.52);
      ctx.lineTo(x, H * 0.52);
      ctx.stroke();
    }
    flash(ctx, t, 2.6);
  }
}

/** Stars drifting left, `offset` px along, inside (x, y, w, h). */
function stars(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, offset: number): void {
  ctx.fillStyle = SPACE;
  ctx.fillRect(x, y, w, h);
  for (const [sx, sy, size] of STARS) {
    const px = x + ((((sx * w - offset * size * 0.6) % w) + w) % w);
    ctx.fillStyle = size > 1.4 ? '#ffffff' : '#9fb4e6';
    ctx.fillRect(px, y + sy * h, size, size);
  }
}

/** Warp: stars streaking out from the middle of (x, y, w, h); `speed` 0..1 how stretched. */
function warpField(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, speed: number, time: number): void {
  ctx.fillStyle = SPACE;
  ctx.fillRect(x, y, w, h);
  const cx = x + w / 2;
  const cy = y + h / 2;
  ctx.lineCap = 'round';
  for (const [sx, sy, size] of STARS) {
    const angle = sx * Math.PI * 2;
    // Each star rushes outward on its own ray, round and round.
    const r0 = ((sy + time * (0.4 + speed * 1.6)) % 1) * Math.hypot(w, h) * 0.55;
    const len = 2 + speed * r0 * 0.9;
    ctx.strokeStyle = size > 1.4 ? '#ffffff' : '#a9d8ff';
    ctx.lineWidth = Math.max(1, size * (0.6 + speed));
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * r0, cy + Math.sin(angle) * r0);
    ctx.lineTo(cx + Math.cos(angle) * (r0 + len), cy + Math.sin(angle) * (r0 + len));
    ctx.stroke();
  }
}

function planet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = '#c96b4a';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 220, 180, 0.35)';
  ctx.fillRect(x - r, y - r * 0.25, r * 2, r * 0.18);
  ctx.strokeStyle = '#f0d9a0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.6, r * 0.32, -0.25, 0, Math.PI * 2);
  ctx.stroke();
}

/** The bridge's back wall, its curved rail and carpet, and the big viewscreen at the front. */
function bridgeRoom(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  ctx.fillStyle = '#d2bf98';
  ctx.fillRect(0, 0, W, H);
  // Wood-panel stripes along the walls, and the carpet.
  ctx.fillStyle = '#a77f55';
  ctx.fillRect(0, H * 0.5, W, H * 0.06);
  ctx.fillStyle = '#8d6a52';
  ctx.fillRect(0, H * 0.7, W, H * 0.3);
  screenFrame(ctx, W * 0.32, H * 0.08, W * 0.5, H * 0.38, t * 6, 0);
  // The curved rail at the back, and little panels of lights.
  ctx.strokeStyle = '#6d4f34';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(W * 0.5, H * 0.66, W * 0.46, H * 0.1, 0, Math.PI, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const x = W * 0.03 + (i % 2) * W * 0.85 + Math.floor(i / 2) * 4;
    roundRect(ctx, x, H * (0.14 + Math.floor(i / 2) * 0.1), W * 0.1, H * 0.07, 2);
    ctx.fillStyle = '#1b1f2e';
    ctx.fill();
    for (let j = 0; j < 4; j++) {
      ctx.fillStyle = (Math.floor(t * 3) + i + j) % 3 ? '#f2a13a' : '#7fd3ff';
      ctx.fillRect(x + 4 + j * (W * 0.022), H * (0.16 + Math.floor(i / 2) * 0.1), W * 0.014, H * 0.025);
    }
  }
}

/** The viewscreen: a dark frame with stars drifting (or warping, `warp` 0..1). */
function screenFrame(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, offset: number, warp: number): void {
  roundRect(ctx, x - 4, y - 4, w + 8, h + 8, 8);
  ctx.fillStyle = '#3a3a46';
  ctx.fill();
  ctx.save();
  roundRect(ctx, x, y, w, h, 6);
  ctx.clip();
  if (warp > 0) warpField(ctx, x, y, w, h, warp, offset / 6);
  else stars(ctx, x, y, w, h, offset);
  ctx.restore();
}

/** A command chair (seen from behind), its middle at (x, y) on the floor. */
function chair(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.fillStyle = '#5b3d2a';
  roundRect(ctx, x - 20 * s, y - 34 * s, 40 * s, 30 * s, 6 * s);
  ctx.fill();
  ctx.fillStyle = '#4a3122';
  ctx.fillRect(x - 24 * s, y - 16 * s, 48 * s, 8 * s);
}

/** The helm console in front of the android: a low desk of lights. */
function helmConsole(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  roundRect(ctx, x - 34 * s, y - 30 * s, 68 * s, 16 * s, 4 * s);
  ctx.fillStyle = '#2b2f40';
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = (Math.floor(t * 4) + i) % 3 ? '#f2a13a' : '#5fe0c0';
    ctx.fillRect(x - 28 * s + i * 10 * s, y - 26 * s, 6 * s, 4 * s);
  }
}

/**
 * One of the crew, seen from behind-ish as cartoons: feet at (x, y), `s` their scale. `point` (0..1) raises the
 * right arm toward the viewscreen. `seated` hides the legs (they're in a chair or at the console).
 */
function person(ctx: CanvasRenderingContext2D, who: Crew, x: number, y: number, s: number, point: number, t: number, seated = false): void {
  const look = LOOK[who];
  const k = s * look.tall;
  const top = y - (seated ? 52 : 74) * k;
  const breathe = Math.sin(t * 2.2) * 0.6 * k;
  ctx.lineWidth = Math.max(1.5, 1.6 * s);
  ctx.strokeStyle = INK;
  ctx.lineJoin = 'round';
  // Legs (standing): dark trousers.
  if (!seated) {
    ctx.fillStyle = '#1c1c24';
    ctx.fillRect(x - 9 * k, y - 30 * k, 8 * k, 30 * k);
    ctx.fillRect(x + 1 * k, y - 30 * k, 8 * k, 30 * k);
  }
  // The tunic: coloured, with the black shoulders of the era.
  const bodyTop = top + 18 * k + breathe;
  const bodyBottom = seated ? y - 8 * k : y - 28 * k;
  ctx.beginPath();
  ctx.moveTo(x - 15 * k, bodyTop);
  ctx.lineTo(x + 15 * k, bodyTop);
  ctx.lineTo(x + 12 * k, bodyBottom);
  ctx.lineTo(x - 12 * k, bodyBottom);
  ctx.closePath();
  ctx.fillStyle = look.uniform;
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#16161d';
  ctx.fillRect(x - 15 * k, bodyTop, 30 * k, 8 * k);
  // A little badge on the chest: a gold star.
  star(ctx, x - 7 * k, bodyTop + 12 * k, 2.6 * k, 4, '#f4d061');
  // The security chief's silver sash.
  if (who === 'chief') {
    ctx.strokeStyle = '#c9ccd6';
    ctx.lineWidth = 4 * k;
    ctx.beginPath();
    ctx.moveTo(x - 13 * k, bodyTop + 2 * k);
    ctx.lineTo(x + 11 * k, bodyBottom - 2 * k);
    ctx.stroke();
    ctx.strokeStyle = INK;
    ctx.lineWidth = Math.max(1.5, 1.6 * s);
  }
  // Arms: the right one swings up to point.
  ctx.fillStyle = look.uniform;
  ctx.fillRect(x - 19 * k, bodyTop + 2 * k, 5 * k, 22 * k);
  ctx.save();
  ctx.translate(x + 16 * k, bodyTop + 4 * k);
  ctx.rotate(-point * 2.1);
  ctx.fillRect(-2.5 * k, 0, 5 * k, 22 * k);
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(0, 24 * k, 3.4 * k, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Head.
  const hx = x;
  const hy = top + 9 * k + breathe;
  const r = 9 * k;
  // Long hair behind (the chief).
  if (who === 'chief') {
    ctx.fillStyle = look.hair;
    ctx.fillRect(hx - r * 1.05, hy - r * 0.3, r * 2.1, r * 1.9);
  }
  ctx.fillStyle = look.skin;
  ctx.beginPath();
  ctx.arc(hx, hy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = look.hair;
  switch (who) {
    case 'captain':
      // Bald on top: a short grey fringe round the sides.
      ctx.beginPath();
      ctx.arc(hx, hy + r * 0.15, r * 1.02, Math.PI * 0.05, Math.PI * 0.32);
      ctx.arc(hx, hy + r * 0.15, r * 0.8, Math.PI * 0.32, Math.PI * 0.05, true);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx, hy + r * 0.15, r * 1.02, Math.PI * 0.68, Math.PI * 0.95);
      ctx.arc(hx, hy + r * 0.15, r * 0.8, Math.PI * 0.95, Math.PI * 0.68, true);
      ctx.fill();
      break;
    case 'first':
      // Short dark hair and a full beard.
      ctx.beginPath();
      ctx.arc(hx, hy - r * 0.2, r * 0.98, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(hx, hy + r * 0.25, r * 0.85, 0.15, Math.PI - 0.15);
      ctx.fill();
      break;
    case 'android':
      // Slicked-back dark hair; pale golden skin, golden eyes.
      ctx.beginPath();
      ctx.arc(hx, hy - r * 0.15, r * 1.0, Math.PI * 1.02, Math.PI * 1.98);
      ctx.fill();
      ctx.fillStyle = '#e8b830';
      ctx.fillRect(hx - r * 0.45, hy, r * 0.22, r * 0.18);
      ctx.fillRect(hx + r * 0.23, hy, r * 0.22, r * 0.18);
      break;
    case 'chief':
      // Ridges across the forehead.
      ctx.strokeStyle = '#5c3a24';
      ctx.lineWidth = 1.4 * k;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(hx, hy - r * 0.2 + i * r * 0.18, r * 0.7, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
      ctx.strokeStyle = INK;
      break;
  }
  // Eyes (all but the android, drawn above), and a little smile.
  if (who !== 'android') {
    ctx.fillStyle = INK;
    ctx.fillRect(hx - r * 0.42, hy, r * 0.16, r * 0.2);
    ctx.fillRect(hx + r * 0.26, hy, r * 0.16, r * 0.2);
  }
}

/** The starship from the side: a round saucer up front, a slim hull, two long engines glowing blue. */
function starship(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, stretch: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * stretch, s);
  ctx.lineWidth = 1.6 / s;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#c9ced8';
  // Engines on their pylons.
  for (const dy of [-16, -10]) {
    roundRect(ctx, -52, dy - 4, 44, 6, 3);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#5fd2ff';
    ctx.fillRect(-52, dy - 3, 30, 2);
    ctx.fillStyle = '#c9ced8';
  }
  ctx.beginPath();
  ctx.moveTo(-30, -8);
  ctx.lineTo(-22, 4);
  ctx.stroke();
  // The hull.
  roundRect(ctx, -34, 0, 36, 9, 4);
  ctx.fill();
  ctx.stroke();
  // The saucer, in front and a little up.
  ctx.beginPath();
  ctx.ellipse(18, -4, 24, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffe9a8';
  for (let i = -3; i <= 3; i++) ctx.fillRect(18 + i * 5, -5, 2, 1.5);
  ctx.beginPath();
  ctx.moveTo(4, 0);
  ctx.lineTo(10, 2);
  ctx.stroke();
  ctx.restore();
}
