import { lerp } from '../../utils/math';
import { caption, clamp01, ease, INK, logo, roundRect, sceneAt, star, starburst, type GradientStops, type Scenes, type TvShow } from './draw';

/**
 * The easter egg (owner request): a special broadcast that takes over every TV in the house at once. The World
 * Series: the San Diego Padres (brown and gold) trail the Los Angeles Dodgers 5–4 in the bottom of the ninth, two out,
 * a runner on first, and the batter hits a walk-off home run to win it. The team names and colours are the owner's
 * choice; nothing else of theirs is drawn (no logos or marks, no real players, no real ballpark): see docs/ASSETS.md.
 *
 * One broadcast: the bulletin; the ballpark; the pitch, the swing, CRACK; the ball's flight over the wall (HOME RUN,
 * at `HOME_RUN_AT`, when Moke celebrates if he's watching); both runners home and the score flips; the celebration;
 * the champions' trophy; back to the regular shows.
 */

type SceneName = 'bulletin' | 'wide' | 'pitch' | 'flight' | 'bases' | 'celebrate' | 'trophy';

export const SCENES: Scenes<SceneName> = [
  { name: 'bulletin', from: 0, to: 2.5 },
  { name: 'wide', from: 2.5, to: 6.5 },
  { name: 'pitch', from: 6.5, to: 10.5 },
  { name: 'flight', from: 10.5, to: 14.5 },
  { name: 'bases', from: 14.5, to: 18.5 },
  { name: 'celebrate', from: 18.5, to: 24 },
  { name: 'trophy', from: 24, to: 27 },
];

/** Into the flight: when the ball clears the wall. */
const CLEARS_WALL = 2.3;
/** The moment of the home run (s into the broadcast): the ball clears the wall. */
export const HOME_RUN_AT = SCENES[3]!.from + CLEARS_WALL;

const GOLD: GradientStops = [[0, '#fff3c4'], [0.45, '#ffc425'], [0.5, '#7a4a18'], [1, '#ffd35c']];

interface Kit {
  readonly jersey: string;
  readonly trim: string;
  readonly pants: string;
  readonly cap: string;
  readonly brim: string;
}
const PADRES: Kit = { jersey: '#3b2a20', trim: '#ffc425', pants: '#f2ead8', cap: '#3b2a20', brim: '#ffc425' };
const DODGERS: Kit = { jersey: '#b9bec6', trim: '#005a9c', pants: '#aeb3bb', cap: '#005a9c', brim: '#005a9c' };
const UMPIRE: Kit = { jersey: '#1f2230', trim: '#1f2230', pants: '#6b6f7a', cap: '#1f2230', brim: '#1f2230' };
const SKINS = ['#e2b08a', '#b27a52', '#7a4a32', '#f0c8a0'];

export class WorldSeries implements TvShow {
  readonly name = 'WORLD SERIES';
  readonly channel = 0;
  readonly osd = 'LIVE';
  readonly loop = SCENES[SCENES.length - 1]!.to;

  draw(ctx: CanvasRenderingContext2D, W: number, H: number, time: number): void {
    const { name, t } = sceneAt(SCENES, time);
    ctx.save();
    switch (name) {
      case 'bulletin':
        this.bulletin(ctx, W, H, t);
        break;
      case 'wide':
        this.wide(ctx, W, H, t);
        break;
      case 'pitch':
        this.pitch(ctx, W, H, t);
        break;
      case 'flight':
        this.flight(ctx, W, H, t);
        break;
      case 'bases':
        this.bases(ctx, W, H, t);
        break;
      case 'celebrate':
        this.celebrate(ctx, W, H, t);
        break;
      case 'trophy':
        this.trophy(ctx, W, H, t);
        break;
    }
    ctx.restore();
  }

  /** "We interrupt this program…": the World Series, live. */
  private bulletin(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    starburst(ctx, W / 2, H * 0.45, W, t * 0.4, '#2a1d17', '#3b2a20');
    ctx.fillStyle = '#c8102e';
    ctx.fillRect(0, H * 0.06, W, 26);
    caption(ctx, 'SPECIAL BROADCAST', W / 2, H * 0.06 + 13, 15, '#ffffff');
    baseball(ctx, W / 2, H * 0.42, 24, t * 4);
    const punch = 1 + 0.5 * (1 - ease(clamp01(t / 0.4)));
    logo(ctx, 'WORLD SERIES', W / 2, H * 0.7, 32 * punch, W * 0.9, GOLD);
    if (t > 0.9) caption(ctx, 'LIVE · DODGERS AT PADRES', W / 2, H * 0.88, 12, '#ffffff');
  }

  /** The whole ballpark from up behind home plate: bottom of the ninth, two out, a runner leading off first. */
  private wide(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    stands(ctx, W, H * 0.46, t);
    field(ctx, W, H, H * 0.46);
    const home = { x: W / 2, y: H * 0.93 };
    const first = { x: W * 0.73, y: H * 0.71 };
    const second = { x: W / 2, y: H * 0.58 };
    const third = { x: W * 0.27, y: H * 0.71 };
    // The infield dirt, the grass inside it, the bases.
    ctx.fillStyle = '#c98b52';
    ctx.beginPath();
    ctx.moveTo(home.x, home.y + 10);
    ctx.lineTo(first.x + 26, first.y);
    ctx.lineTo(second.x, second.y - 16);
    ctx.lineTo(third.x - 26, third.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#3f8f3f';
    ctx.beginPath();
    ctx.moveTo(home.x, home.y - 12);
    ctx.lineTo(first.x - 20, first.y);
    ctx.lineTo(second.x, second.y + 10);
    ctx.lineTo(third.x + 20, third.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c98b52';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.74, 11, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    for (const b of [first, second, third]) base(ctx, b.x, b.y);
    base(ctx, home.x, home.y);
    // Fielders (Dodgers), the runner, the batter, catcher and umpire: small at this distance.
    for (const [x, y] of [[0.62, 0.64], [0.38, 0.64], [0.3, 0.68], [0.7, 0.68], [0.2, 0.52], [0.5, 0.49], [0.8, 0.52]] as const) {
      player(ctx, W * x, H * y, 0.32, DODGERS, { facing: 1 });
    }
    player(ctx, W / 2, H * 0.74, 0.36, DODGERS, { facing: -1, armR: Math.sin(t * 2) * 0.3 });
    const lead = Math.sin(t * 1.6) * 5;
    player(ctx, first.x - 12 - lead, first.y - 1, 0.34, PADRES, { facing: -1, stride: t * 3 });
    player(ctx, home.x - 9, home.y - 2, 0.38, PADRES, { facing: 1, bat: -0.9 });
    player(ctx, home.x + 1, home.y + 6, 0.3, DODGERS, { crouch: true, facing: -1 });
    player(ctx, home.x + 3, home.y + 12, 0.34, UMPIRE, { facing: -1 });
    scoreBug(ctx, H, false);
    caption(ctx, t < 2 ? 'BOTTOM OF THE NINTH. TWO OUTS.' : 'PADRES DOWN BY ONE…', W / 2, H * 0.1, 12, '#ffffff');
  }

  /** From the centre-field camera: the windup, the pitch, the swing… CRACK. */
  private pitch(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    // The stands behind home plate and the dirt round it.
    stands(ctx, W, H * 0.5, t);
    ctx.fillStyle = '#3f8f3f';
    ctx.fillRect(0, H * 0.5, W, H * 0.5);
    ctx.fillStyle = '#c98b52';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.62, W * 0.24, H * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b87c46';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 1.02, W * 0.3, H * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
    const plate = { x: W / 2, y: H * 0.64 };
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(plate.x - 26, plate.y - 12, 16, 20);
    ctx.strokeRect(plate.x + 10, plate.y - 12, 16, 20);
    base(ctx, plate.x, plate.y);
    // The umpire and the catcher, the batter in the box.
    player(ctx, plate.x + 2, plate.y - 4, 0.95, UMPIRE, { crouch: true, facing: 1 });
    player(ctx, plate.x, plate.y + 2, 0.95, DODGERS, { crouch: true, facing: 1, mitt: true });
    const contact = 2.15;
    const swing = clamp01((t - 2.02) / 0.3);
    const running = clamp01((t - 2.7) / 1.2);
    const batAngle = running > 0 ? 0 : lerp(-2.3, 1.2, ease(swing));
    player(ctx, plate.x - 20 + running * 70, plate.y + 6, 1.1, PADRES, { facing: 1, bat: running > 0 ? undefined : batAngle, stride: running > 0 ? t * 8 : 0, skin: 1 });
    // The pitch: in from the mound to the plate, getting smaller; then off the bat, out and up.
    const release = 1.8;
    if (t >= release && t < contact) {
      const k = (t - release) / (contact - release);
      ball(ctx, lerp(W * 0.46, plate.x - 12, k), lerp(H * 0.8, plate.y - 14, k), lerp(4, 2.2, k));
    } else if (t >= contact && t < contact + 0.5) {
      const k = (t - contact) / 0.5;
      ball(ctx, lerp(plate.x - 12, W * 0.18, k), lerp(plate.y - 14, -20, k), lerp(2.2, 7, k));
    }
    // The pitcher, from behind: set, kick, throw.
    const windup = clamp01((t - 1.0) / 0.8);
    const throwing = clamp01((t - release) / 0.25);
    player(ctx, W * 0.46, H * 1.02, 2.2, DODGERS, {
      facing: -1, back: true,
      armR: throwing > 0 ? lerp(2.6, -0.4, throwing) : lerp(0.2, 2.6, ease(windup)),
      kick: Math.sin(windup * Math.PI) * (1 - throwing),
    });
    if (t >= contact && t < contact + 0.12) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fillRect(0, 0, W, H);
    }
    if (t >= contact && t < contact + 1.2) {
      star(ctx, plate.x - 12, plate.y - 14, 18 + (t - contact) * 20, 8, `rgba(255, 240, 150, ${1 - (t - contact) / 1.2})`);
      caption(ctx, 'CRACK!', W * 0.3, H * 0.28, 24, '#ffe066');
    }
    scoreBug(ctx, H, false);
    caption(ctx, t < contact ? (t < 1.6 ? 'HERE’S THE PITCH…' : '…') : 'SWUNG ON, AND HIT HIGH!', W / 2, H * 0.1, 12, '#ffffff');
  }

  /** The ball, high and far, over the leaping outfielder and the wall. HOME RUN. */
  private flight(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#060b1f');
    sky.addColorStop(1, '#1d3566');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 18; i++) ctx.fillRect((i * 67) % W, (i * 29) % (H * 0.45), 1.3, 1.3);
    // The stands beyond the wall, the wall, the warning track, the grass.
    const wallTop = H * 0.62;
    crowd(ctx, W * 0.45, W, H * 0.3, wallTop, t, t > CLEARS_WALL);
    ctx.fillStyle = '#23422f';
    ctx.fillRect(W * 0.45, wallTop, W * 0.55, H * 0.16);
    ctx.fillStyle = '#ffc425';
    ctx.fillRect(W * 0.45, wallTop, W * 0.55, 3);
    caption(ctx, '401', W * 0.78, wallTop + 14, 11, '#ffffff');
    ctx.fillStyle = '#b87c46';
    ctx.fillRect(0, H * 0.78, W, H * 0.06);
    ctx.fillStyle = '#3f8f3f';
    ctx.fillRect(0, H * 0.84, W, H * 0.16);
    // The outfielder: back to the wall, and a leap.
    const run = clamp01(t / 1.8);
    const leap = Math.sin(clamp01((t - 1.7) / 0.7) * Math.PI) * 30;
    player(ctx, lerp(W * 0.2, W * 0.5, ease(run)), H * 0.8 - leap, 1.25, DODGERS, { facing: 1, stride: run < 1 ? t * 9 : 0, armL: leap > 2 ? 2.9 : 0.4, mitt: true });
    // The ball: from low left, up into the night, over the glove and the wall, into the seats.
    const u = t / CLEARS_WALL;
    const bx = lerp(-10, W * 0.62, Math.min(u, 1.25));
    const by = lerp(H * 0.7, wallTop - 14, Math.min(u, 1)) - Math.sin(Math.min(u, 1) * Math.PI) * H * 0.55 + Math.max(0, u - 1) * 40;
    if (u < 1.2) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 12; i++) {
        const v = Math.max(0, Math.min(u, 1) - i * 0.03);
        const x = lerp(-10, W * 0.62, v);
        const y = lerp(H * 0.7, wallTop - 14, v) - Math.sin(v * Math.PI) * H * 0.55;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ball(ctx, bx, by, 4);
    }
    if (t >= CLEARS_WALL) {
      const k = t - CLEARS_WALL;
      for (const [x, y, c] of [[0.2, 0.25, '#ffc425'], [0.8, 0.2, '#ffffff'], [0.5, 0.12, '#ff6b4a']] as const) firework(ctx, W * x, H * y, k, c);
      const pop = 1 + 0.35 * Math.sin(clamp01(k / 0.3) * Math.PI);
      logo(ctx, 'HOME RUN!', W / 2, H * 0.42, 40 * pop, W * 0.92, GOLD);
    } else {
      caption(ctx, t < 1.2 ? 'IT’S HIGH…' : 'IT’S FAR…', W / 2, H * 0.1, 14, '#ffffff');
    }
    scoreBug(ctx, H, false);
  }

  /** From above: both runners round the bases, and the score flips. */
  private bases(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    ctx.fillStyle = '#3f8f3f';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    for (let i = 0; i < 8; i++) ctx.fillRect(0, i * 30, W, 15);
    const c = { x: W / 2, y: H * 0.5 };
    const r = H * 0.36;
    const corners = [{ x: c.x, y: c.y + r }, { x: c.x + r, y: c.y }, { x: c.x, y: c.y - r }, { x: c.x - r, y: c.y }];
    ctx.fillStyle = '#c98b52';
    ctx.beginPath();
    corners.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath();
    ctx.lineWidth = 16;
    ctx.strokeStyle = '#c98b52';
    ctx.stroke();
    ctx.fillStyle = '#3f8f3f';
    ctx.fill();
    for (const p of corners) base(ctx, p.x, p.y);
    // Round the bases: home → first → second → third → home. The runner starts at first.
    const along = (d: number) => {
      const leg = Math.min(3.999, Math.max(0, d));
      const i = Math.floor(leg);
      const k = leg - i;
      const a = corners[i]!;
      const b = corners[(i + 1) % 4]!;
      return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k) };
    };
    const runner = along(1 + clamp01(t / 2.6) * 3);
    const batter = along(clamp01((t - 0.2) / 3.3) * 4);
    for (const [p, phase] of [[runner, 0], [batter, 1]] as const) topDown(ctx, p.x, p.y, PADRES, t * 12 + phase);
    // The team pouring out to meet them at home.
    const pour = clamp01((t - 1.5) / 1.8);
    for (let i = 0; i < 7; i++) {
      const fromX = c.x - r * 1.3 + i * 5;
      topDown(ctx, lerp(fromX, c.x - 20 + i * 7, pour), lerp(c.y + r * 0.9, c.y + r + 12 - (i % 3) * 6, pour), PADRES, t * 10 + i);
    }
    const final = t > 3.5;
    for (const [x, y, col] of [[0.1, 0.15, '#ffc425'], [0.9, 0.18, '#ffffff']] as const) firework(ctx, W * x, H * y, (t % 1.6) + 0.1, col);
    scoreBug(ctx, H, final);
    if (final) caption(ctx, 'PADRES WIN IT!', W / 2, H * 0.1, 18, '#ffe066');
  }

  /** Jumping for joy at home plate in the fireworks and confetti. */
  private celebrate(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    stands(ctx, W, H * 0.55, t);
    ctx.fillStyle = '#3f8f3f';
    ctx.fillRect(0, H * 0.55, W, H * 0.45);
    ctx.fillStyle = '#c98b52';
    ctx.beginPath();
    ctx.ellipse(W / 2, H * 0.96, W * 0.4, H * 0.14, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) firework(ctx, W * (0.15 + i * 0.23), H * (0.12 + (i % 2) * 0.1), ((t + i * 0.55) % 2) + 0.05, ['#ffc425', '#ffffff', '#ff6b4a', '#ffc425'][i]!);
    for (let i = 0; i < 7; i++) {
      const jump = Math.abs(Math.sin(t * 5 + i * 1.3)) * 14;
      const x = W * (0.2 + i * 0.1);
      player(ctx, x, H * 0.97 - jump - (i % 2) * 6, 1.1 + (i % 3) * 0.08, PADRES, { facing: i % 2 ? 1 : -1, armL: 2.8, armR: 2.6 + Math.sin(t * 7 + i) * 0.3, skin: i });
    }
    confetti(ctx, W, H, t);
    const pop = 1 + 0.25 * Math.sin(clamp01(t / 0.3) * Math.PI);
    logo(ctx, 'PADRES WIN!', W / 2, H * 0.33, 36 * pop, W * 0.9, GOLD);
    caption(ctx, 'WORLD SERIES CHAMPIONS!', W / 2, H * 0.5, 14, '#ffffff');
  }

  /** The champions' trophy, then back to the regular shows. */
  private trophy(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    starburst(ctx, W / 2, H * 0.45, W, t * 0.5, '#3b2a20', '#5a4130');
    trophyCup(ctx, W / 2, H * 0.62, 1 + 0.05 * Math.sin(t * 3));
    for (let i = 0; i < 5; i++) {
      const twinkle = Math.max(0, Math.sin(t * 5 + i * 1.7));
      star(ctx, W / 2 + Math.cos(i * 1.3) * 50, H * 0.42 + Math.sin(i * 2.1) * 30, 3 + twinkle * 6, 4, `rgba(255, 245, 190, ${twinkle})`);
    }
    caption(ctx, 'SAN DIEGO PADRES', W / 2, H * 0.1, 16, '#ffc425');
    caption(ctx, 'WORLD CHAMPIONS', W / 2, H * 0.21, 13, '#ffffff');
    if (t > 1.4) caption(ctx, 'NOW BACK TO YOUR REGULAR PROGRAMMING', W / 2, H * 0.92, 10, '#ffffff');
  }
}

// ------------------------------------------------------------------ the ballpark

/** The stands down to `bottom`: night sky, light towers, and the crowd (flash bulbs popping). */
function stands(ctx: CanvasRenderingContext2D, W: number, bottom: number, t: number): void {
  const sky = ctx.createLinearGradient(0, 0, 0, bottom);
  sky.addColorStop(0, '#060b1f');
  sky.addColorStop(1, '#13264d');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, bottom);
  for (const x of [0.12, 0.88]) {
    ctx.fillStyle = '#2a2f3d';
    ctx.fillRect(W * x - 2, bottom * 0.1, 4, bottom * 0.4);
    ctx.fillStyle = '#fffbe6';
    ctx.fillRect(W * x - 14, bottom * 0.06, 28, 10);
    const glow = ctx.createRadialGradient(W * x, bottom * 0.1, 2, W * x, bottom * 0.1, 50);
    glow.addColorStop(0, 'rgba(255, 250, 220, 0.35)');
    glow.addColorStop(1, 'rgba(255, 250, 220, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(W * x - 50, bottom * 0.1 - 50, 100, 100);
  }
  crowd(ctx, 0, W, bottom * 0.45, bottom, t, false);
}

/** Rows of fans (mostly in brown and gold), a few camera flashes; `cheering` makes them jump. */
function crowd(ctx: CanvasRenderingContext2D, x0: number, x1: number, top: number, bottom: number, t: number, cheering: boolean): void {
  ctx.fillStyle = '#1c1830';
  ctx.fillRect(x0, top, x1 - x0, bottom - top);
  const colors = ['#3b2a20', '#ffc425', '#f2ead8', '#3b2a20', '#8a6a4a', '#005a9c'];
  let i = 0;
  for (let y = top + 4; y < bottom - 2; y += 6) {
    for (let x = x0 + ((y / 6) % 2) * 3 + 2; x < x1; x += 6) {
      const hop = cheering ? Math.abs(Math.sin(t * 9 + i)) * 2 : 0;
      ctx.fillStyle = colors[(i * 7 + Math.floor(y)) % colors.length]!;
      ctx.fillRect(x, y - hop, 3, 4);
      i++;
    }
  }
  ctx.fillStyle = '#ffffff';
  for (let k = 0; k < 6; k++) {
    if (Math.sin(t * 13 + k * 5.1) > 0.85) ctx.fillRect(x0 + ((k * 97) % (x1 - x0)), top + ((k * 31) % Math.max(1, bottom - top)), 2, 2);
  }
}

/** The outfield grass with mowing stripes, from `top` down. */
function field(ctx: CanvasRenderingContext2D, W: number, H: number, top: number): void {
  ctx.fillStyle = '#23422f';
  ctx.fillRect(0, top - 4, W, 5);
  ctx.fillStyle = '#3f8f3f';
  ctx.fillRect(0, top, W, H - top);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.07)';
  for (let i = -6; i < 12; i += 2) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 40, top);
    ctx.lineTo(W / 2 + (i + 1) * 40, top);
    ctx.lineTo(W / 2 + (i + 1) * 110, H);
    ctx.lineTo(W / 2 + i * 110, H);
    ctx.fill();
  }
}

function base(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x + 4, y);
  ctx.lineTo(x, y + 3);
  ctx.lineTo(x - 4, y);
  ctx.closePath();
  ctx.fill();
}

/** A baseball: white, with red stitches, turning `turn` rad. */
function baseball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, turn: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(turn);
  ctx.fillStyle = '#fbfaf4';
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#d0262f';
  ctx.lineWidth = 1.6;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * r * 1.35, 0, r * 0.95, Math.PI - 0.75, Math.PI + 0.75);
    ctx.stroke();
  }
  ctx.restore();
}

function ball(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.fillStyle = '#fbfaf4';
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, Math.PI * 2);
  ctx.fill();
}

/** A burst of sparks, `k` s after it went off. */
function firework(ctx: CanvasRenderingContext2D, x: number, y: number, k: number, color: string): void {
  if (k <= 0 || k > 1.6) return;
  const r = 8 + k * 30;
  ctx.globalAlpha = Math.max(0, 1 - k / 1.6);
  ctx.fillStyle = color;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.fillRect(x + Math.cos(a) * r - 1.5, y + Math.sin(a) * r + k * k * 6 - 1.5, 3, 3);
  }
  ctx.globalAlpha = 1;
}

function confetti(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  const colors = ['#ffc425', '#ffffff', '#3b2a20', '#ff6b4a'];
  for (let i = 0; i < 30; i++) {
    const y = (t * (40 + (i % 4) * 10) + i * 23) % (H + 10);
    const x = (i * 61 + Math.sin(t * 2 + i) * 10) % W;
    ctx.save();
    ctx.translate(x, y - 5);
    ctx.rotate(t * 4 + i);
    ctx.fillStyle = colors[i % colors.length]!;
    ctx.fillRect(-3, -1.5, 6, 3);
    ctx.restore();
  }
}

/** The score, bottom left: DODGERS 5, PADRES 4, bottom of the 9th, two out, a runner on first; or the final. */
function scoreBug(ctx: CanvasRenderingContext2D, H: number, final: boolean): void {
  const x = 8;
  const y = H - 38;
  ctx.fillStyle = 'rgba(12, 12, 20, 0.85)';
  roundRect(ctx, x, y, 132, 30, 4);
  ctx.fill();
  ctx.font = 'bold 11px Arial, sans-serif';
  ctx.textBaseline = 'middle';
  const rows: readonly (readonly [string, string, string])[] = [['LAD', '5', '#005a9c'], ['SD', final ? '6' : '4', '#3b2a20']];
  rows.forEach(([team, runs, color], i) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + 3, y + 3 + i * 13, 34, 11);
    ctx.fillStyle = i === 1 ? '#ffc425' : '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(team, x + 6, y + 9 + i * 13);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'right';
    ctx.fillText(runs, x + 50, y + 9 + i * 13);
  });
  ctx.textAlign = 'left';
  if (final) {
    ctx.fillStyle = '#ffc425';
    ctx.fillText('FINAL', x + 62, y + 15);
    return;
  }
  ctx.fillStyle = '#ffffff';
  ctx.fillText('▼9', x + 58, y + 9);
  ctx.fillText('2 OUT', x + 58, y + 22);
  // The bases: a runner on first.
  for (const [dx, dy, on] of [[113, 16, true], [105, 9, false], [97, 16, false]] as const) {
    ctx.fillStyle = on ? '#ffc425' : 'rgba(255, 255, 255, 0.3)';
    ctx.beginPath();
    ctx.moveTo(x + dx, y + dy - 4);
    ctx.lineTo(x + dx + 4, y + dy);
    ctx.lineTo(x + dx, y + dy + 4);
    ctx.lineTo(x + dx - 4, y + dy);
    ctx.fill();
  }
}

/** The champions' trophy: a gold cup on a dark base. */
function trophyCup(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  const gold = ctx.createLinearGradient(-30, 0, 30, 0);
  gold.addColorStop(0, '#a8741a');
  gold.addColorStop(0.45, '#ffe28a');
  gold.addColorStop(1, '#b8801e');
  ctx.fillStyle = '#2b2118';
  roundRect(ctx, -30, 38, 60, 16, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = gold;
  ctx.fillRect(-6, 18, 12, 20);
  ctx.strokeRect(-6, 18, 12, 20);
  ctx.beginPath();
  ctx.moveTo(-28, -34);
  ctx.lineTo(28, -34);
  ctx.quadraticCurveTo(26, 14, 0, 20);
  ctx.quadraticCurveTo(-26, 14, -28, -34);
  ctx.fill();
  ctx.stroke();
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * 30, -16, 10, side > 0 ? -Math.PI / 2 : Math.PI / 2, side > 0 ? Math.PI / 2 : Math.PI * 1.5);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#d9a33a';
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(-18, -28, 5, 30);
  ctx.restore();
}

// ------------------------------------------------------------------ players

interface Pose {
  /** Which way they face (1 right, -1 left); `back`: seen from behind. */
  readonly facing?: 1 | -1;
  readonly back?: boolean;
  /** Arms from hanging down (0) round to straight up (π), rad. */
  readonly armL?: number;
  readonly armR?: number;
  /** A bat in the hands, at this angle (0 pointing up… rad), or a catcher's mitt. */
  readonly bat?: number;
  readonly mitt?: boolean;
  /** Running (a stride phase), crouching (catcher, umpire), a pitcher's leg kick (0..1). */
  readonly stride?: number;
  readonly crouch?: boolean;
  readonly kick?: number;
  /** Which skin tone. */
  readonly skin?: number;
}

/** A ballplayer (feet at (x, y), about 46 px tall at scale 1) in `kit`. */
function player(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, kit: Kit, pose: Pose): void {
  const f = pose.facing ?? 1;
  const skin = SKINS[(pose.skin ?? 0) % SKINS.length]!;
  const crouch = pose.crouch ? 10 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * f, s);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Legs (running, kicking or crouched).
  const stride = pose.stride ? Math.sin(pose.stride) * 5 : 0;
  const kick = (pose.kick ?? 0) * 12;
  ctx.strokeStyle = kit.pants;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(-3, -18 + crouch);
  ctx.lineTo(-4 - stride - (pose.crouch ? 6 : 0), 0);
  ctx.moveTo(3, -18 + crouch);
  ctx.lineTo(4 + stride + (pose.crouch ? 6 : 0) + kick * 0.3, -kick);
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.fillRect(-7 - stride - (pose.crouch ? 6 : 0), -2, 6, 3);
  ctx.fillRect(1 + stride + (pose.crouch ? 6 : 0) + kick * 0.3, -2 - kick, 6, 3);
  // The body and its trim.
  const top = -35 + crouch;
  roundRect(ctx, -7, top, 14, 18, 4);
  ctx.fillStyle = kit.jersey;
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = kit.trim;
  ctx.fillRect(-7, top + 13, 14, 1.8);
  if (!pose.back) ctx.fillRect(-0.8, top + 2, 1.6, 11);
  // Arms: left behind, right in front.
  const arm = (side: -1 | 1, angle: number) => {
    const sx = side * 6;
    const sy = top + 4;
    const hx = sx + Math.sin(angle) * 12 * side;
    const hy = sy + Math.cos(angle) * 12;
    ctx.strokeStyle = kit.jersey;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    ctx.fillStyle = skin;
    ctx.beginPath();
    ctx.arc(hx, hy, 2, 0, Math.PI * 2);
    ctx.fill();
    return { x: hx, y: hy };
  };
  const left = arm(-1, pose.armL ?? 0.25);
  if (pose.bat !== undefined) {
    // Both hands together on the bat.
    const hx = 3;
    const hy = top + 7;
    ctx.strokeStyle = '#c9a36b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(hx, hy);
    ctx.lineTo(hx + Math.sin(pose.bat) * 22, hy - Math.cos(pose.bat) * 22);
    ctx.stroke();
    ctx.strokeStyle = kit.jersey;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-5, top + 4);
    ctx.lineTo(hx, hy);
    ctx.moveTo(5, top + 4);
    ctx.lineTo(hx, hy);
    ctx.stroke();
  } else {
    arm(1, pose.armR ?? 0.25);
  }
  if (pose.mitt) {
    ctx.fillStyle = '#5a3a1e';
    ctx.beginPath();
    ctx.arc(left.x, left.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Head and cap.
  const hy = top - 6;
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(0, hy, 5.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = kit.cap;
  ctx.beginPath();
  ctx.arc(0, hy - 1, 5.8, Math.PI, 0);
  ctx.fill();
  ctx.fillStyle = kit.brim;
  ctx.fillRect(pose.back ? -6 : 1, hy - 1.5, pose.back ? 12 : 7, 1.8);
  if (!pose.back) {
    ctx.fillStyle = INK;
    ctx.fillRect(2, hy + 0.5, 1.4, 1.4);
  }
  ctx.restore();
}

/** A player seen from above (the bases view): cap and shoulders, bobbing as they run. */
function topDown(ctx: CanvasRenderingContext2D, x: number, y: number, kit: Kit, phase: number): void {
  const bob = Math.sin(phase) * 1.2;
  ctx.fillStyle = kit.jersey;
  roundRect(ctx, x - 6, y - 3 + bob, 12, 7, 3);
  ctx.fill();
  ctx.fillStyle = kit.cap;
  ctx.beginPath();
  ctx.arc(x, y + bob, 3.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = kit.brim;
  ctx.fillRect(x - 1.5, y - 5 + bob, 3, 2);
}
