import { lerp } from '../../utils/math';
import { bubble, caption, clamp01, ease, INK, logo, mesas, roundRect, sceneAt, speedLines, type GradientStops, type Scenes, type TvShow } from './draw';

/**
 * "HIGHWAY HERO", a TV show in the style of the 1980s talking-car adventure series: a sleek black sports car with a
 * mind of its own (a red scanner light sweeping across its nose, a voice that lights up its dashboard) and its human
 * partner, cruising night highways and catching crooks. Original: none of any real show's names, cars or logos.
 * Family friendly: the crooks are caught without a fight (the car jumps clean over their van and blocks the road).
 *
 * One loop: the title; the car racing through the desert night; inside, the dashboard talking ("Suspects ahead,
 * partner"); the chase, a turbo jump over the getaway van, which skids to a stop; the crooks give up as the police
 * lights flash; "next week: another case!" into the sunrise.
 */

type SceneName = 'title' | 'drive' | 'dash' | 'chase' | 'caught' | 'outro';

export const SCENES: Scenes<SceneName> = [
  { name: 'title', from: 0, to: 3 },
  { name: 'drive', from: 3, to: 8 },
  { name: 'dash', from: 8, to: 11.5 },
  { name: 'chase', from: 11.5, to: 16.5 },
  { name: 'caught', from: 16.5, to: 20.5 },
  { name: 'outro', from: 20.5, to: 23 },
];

const RED_CHROME: GradientStops = [[0, '#ffe3d6'], [0.45, '#ff8a6b'], [0.5, '#b3121b'], [1, '#ff5a4a']];
const CAR = '#15161c';
const CAR_SHINE = '#4a4f63';
const GLASS = '#1d2b44';

/** The car in profile, facing +x (y up, ground 0): long, low and wedge-nosed. */
const SIDE: readonly (readonly [number, number])[] = [[-60, 8], [-63, 18], [-58, 25], [-28, 28], [-14, 38], [10, 38], [30, 28], [60, 19], [64, 13], [60, 7]];
const SIDE_GLASS: readonly (readonly [number, number])[] = [[-24, 29], [-12, 36], [9, 36], [26, 28]];

export class HighwayHero implements TvShow {
  readonly name = 'HIGHWAY HERO';
  readonly channel = 7;
  readonly loop = SCENES[SCENES.length - 1]!.to;

  draw(ctx: CanvasRenderingContext2D, W: number, H: number, time: number): void {
    const { name, t } = sceneAt(SCENES, time);
    ctx.save();
    switch (name) {
      case 'title':
        this.title(ctx, W, H, t);
        break;
      case 'drive':
        this.drive(ctx, W, H, t);
        break;
      case 'dash':
        this.dash(ctx, W, H, t);
        break;
      case 'chase':
        this.chase(ctx, W, H, t);
        break;
      case 'caught':
        this.caught(ctx, W, H, t);
        break;
      case 'outro':
        this.outro(ctx, W, H, t);
        break;
    }
    ctx.restore();
  }

  /** A glowing grid under a night sky, the car head-on with its scanner sweeping, and the name. */
  private title(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const horizon = H * 0.6;
    night(ctx, W, horizon, '#2d1747');
    grid(ctx, W, H, horizon, t);
    frontCar(ctx, W / 2, H * 0.93, 1.25, t);
    const punch = 1 + 0.6 * (1 - ease(clamp01(t / 0.4)));
    logo(ctx, 'HIGHWAY HERO', W / 2, H * 0.24, Math.min(W * 0.12, 40) * punch, W * 0.92, RED_CHROME);
    if (t > 0.8) caption(ctx, '★ A CAR WITH A MIND OF ITS OWN ★', W / 2, H * 0.43, 10, '#ffffff');
  }

  /** Through the desert at night: the moon, the mesas, the road rushing by. */
  private drive(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const horizon = H * 0.62;
    desertNight(ctx, W, H, horizon, t, 300);
    const x = lerp(-90, W * 0.46, ease(clamp01(t / 1.5)));
    speedLines(ctx, W, H, t, x - 50);
    sideCar(ctx, x, H * 0.9 - Math.abs(Math.sin(t * 15)) * 1.1, 1.05, t, -t * 24);
  }

  /** Inside: the night road through the windscreen, the glowing dashboard, and the car talking. */
  private dash(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const dashTop = H * 0.56;
    const sky = ctx.createLinearGradient(0, 0, 0, dashTop);
    sky.addColorStop(0, '#070913');
    sky.addColorStop(1, '#2a1d4a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, dashTop);
    // The road ahead, its centre line rushing at us, and the getaway van's tail lights far off.
    const vx = W / 2;
    const vy = H * 0.3;
    ctx.fillStyle = '#1b1726';
    ctx.fillRect(0, vy, W, dashTop - vy);
    ctx.fillStyle = '#2c2a3a';
    ctx.beginPath();
    ctx.moveTo(vx - 6, vy);
    ctx.lineTo(vx + 6, vy);
    ctx.lineTo(W * 0.95, dashTop);
    ctx.lineTo(W * 0.05, dashTop);
    ctx.fill();
    ctx.fillStyle = '#ffd35c';
    for (let i = 0; i < 5; i++) {
      const p = (i / 5 + t * 1.3) % 1;
      const y = lerp(vy, dashTop, p * p);
      const w = 1 + p * 7;
      ctx.fillRect(vx - w / 2, y, w, 2 + p * 10);
    }
    const near = 1.5 + clamp01(t / 3.5) * 2.5;
    for (const side of [-1, 1]) {
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(vx + side * near * 2.2 - near / 2, vy + 4, near, near * 0.7);
    }
    // The windscreen's pillars.
    ctx.fillStyle = '#07080c';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(W * 0.12, 0);
    ctx.lineTo(W * 0.03, dashTop);
    ctx.lineTo(0, dashTop);
    ctx.moveTo(W, 0);
    ctx.lineTo(W * 0.88, 0);
    ctx.lineTo(W * 0.97, dashTop);
    ctx.lineTo(W, dashTop);
    ctx.fill();
    // The dashboard: rows of lit buttons and two readouts either side of the voice.
    ctx.fillStyle = '#101218';
    roundRect(ctx, -10, dashTop - 6, W + 20, H - dashTop + 20, 18);
    ctx.fill();
    ctx.strokeStyle = '#2b2f3c';
    ctx.lineWidth = 2;
    ctx.stroke();
    const colors = ['#ff3b30', '#ffb13b', '#4ee07a', '#4fb7ff'];
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 7; i++) {
        const on = ((i * 7 + row * 3 + Math.floor(t * 4)) % 5) > 1;
        ctx.fillStyle = on ? colors[(i + row) % colors.length]! : '#2a2d38';
        for (const side of [-1, 1]) ctx.fillRect(W / 2 + side * (W * 0.16 + i * 11) - 4, dashTop + 14 + row * 11, 8, 6);
      }
    }
    for (const [side, text] of [[-1, `${142 + Math.round(Math.sin(t * 3) * 3)} MPH`], [1, 'PURSUIT']] as const) {
      const x = W / 2 + side * W * 0.3;
      ctx.fillStyle = '#1c0e05';
      roundRect(ctx, x - 34, dashTop + 38, 68, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#ffb13b';
      ctx.font = 'bold 12px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, dashTop + 48);
    }
    // Its voice: while it talks, the red bars jump.
    const line = t < 1.75 ? 'SUSPECTS AHEAD, PARTNER.' : 'HOLD ON. TURBO JUMP READY.';
    const lineTime = t < 1.75 ? t : t - 1.75;
    voice(ctx, W / 2, dashTop + 44, lineTime < 1.3 ? 1 : 0, t);
    // The partner's gloved hands on the wheel.
    const turn = Math.sin(t * 1.7) * 0.08;
    ctx.save();
    ctx.translate(W * 0.2, H + 12);
    ctx.rotate(turn);
    ctx.strokeStyle = '#2d2f38';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.arc(0, 0, 52, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
    ctx.fillStyle = '#5a3620';
    for (const a of [Math.PI * 1.22, Math.PI * 1.78]) {
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * 52, Math.sin(a) * 52, 10, 7, a, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.restore();
    caption(ctx, line, W / 2, H * 0.12, 13, '#ffffff');
  }

  /** The chase: closing on the getaway van, a turbo jump clean over it, and the van skidding to a stop. */
  private chase(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const horizon = H * 0.58;
    const ground = H * 0.9;
    // Both screech to a halt after the landing: the road slows with them.
    const moving = 1 - clamp01((t - 3.1) / 1.2);
    desertNight(ctx, W, H, horizon, t, 320 * moving);
    const brake = clamp01((t - 3.0) / 1.0);
    const vanX = W * 0.66 - 24 * ease(brake);
    if (brake > 0) {
      // Skid marks and smoke behind its wheels.
      ctx.fillStyle = '#0c0b10';
      for (const wx of [-30, 30]) ctx.fillRect(vanX + wx * 0.8 - 40 * brake, ground - 2, 40 * brake, 3);
      for (let i = 0; i < 4; i++) {
        const p = (t * 2.5 + i / 4) % 1;
        ctx.fillStyle = `rgba(210, 205, 220, ${0.5 * (1 - p) * moving})`;
        ctx.beginPath();
        ctx.arc(vanX - 30 - p * 30, ground - 8 - p * 14, 5 + p * 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    van(ctx, vanX, ground - (moving > 0.2 ? Math.abs(Math.sin(t * 13)) : 0), 0.8, -t * 20 * moving);
    if (t > 3.1 && t < 4.6) caption(ctx, '?!', vanX, ground - 58, 18, '#ffe066');
    // Closing in, then the jump.
    const jump = clamp01((t - 1.8) / 1.2);
    let x = lerp(W * 0.02, W * 0.3, ease(clamp01(t / 1.8)));
    let lift = 0;
    let tilt = 0;
    if (jump > 0) {
      x = lerp(W * 0.3, W * 0.85, ease(jump));
      lift = Math.sin(jump * Math.PI) * 72;
      tilt = lerp(-0.18, 0.14, jump) * (jump < 1 ? 1 : 0);
    }
    if (jump < 1) speedLines(ctx, W, H, t, x - 50);
    sideCar(ctx, x, ground, 0.8, t, -t * 26 * (jump >= 1 ? moving : 1), lift, tilt);
    if (t > 1.45 && t < 2.6) {
      const pop = 1 + 0.3 * Math.sin(clamp01((t - 1.45) / 0.3) * Math.PI);
      caption(ctx, 'TURBO JUMP!', W / 2, H * 0.18, 22 * pop, '#ff5a4a');
    }
  }

  /** Caught: hands up by the van, the police lights flashing, the partner's thumbs up. */
  private caught(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const ground = H * 0.9;
    night(ctx, W, ground, '#241a3d');
    skyline(ctx, W, ground);
    ctx.fillStyle = '#231d30';
    ctx.fillRect(0, ground, W, H - ground);
    van(ctx, W * 0.17, ground, 0.72, 0);
    crook(ctx, W * 0.38, ground, 1.05, t, 0);
    crook(ctx, W * 0.48, ground, 0.95, t, 1.3);
    partner(ctx, W * 0.6, ground, 1.05, clamp01((t - 1.4) / 0.3));
    frontCar(ctx, W * 0.81, ground, 0.72, t);
    // Red and blue, washing in from the police car just off the left.
    const red = Math.floor(t * 5) % 2 === 0;
    const wash = ctx.createRadialGradient(-10, H * 0.55, 10, -10, H * 0.55, W * 0.75);
    wash.addColorStop(0, red ? 'rgba(255, 40, 40, 0.45)' : 'rgba(40, 90, 255, 0.45)');
    wash.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
    if (t > 0.3 && t < 2.3) bubble(ctx, 'WE GIVE UP!', W * 0.43, H * 0.2, 13);
    if (t > 2.3) caption(ctx, 'CASE CLOSED.', W / 2, H * 0.14, 20, '#ffffff');
  }

  /** Off into the sunrise. */
  private outro(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    const horizon = H * 0.66;
    const sky = ctx.createLinearGradient(0, 0, 0, horizon);
    sky.addColorStop(0, '#3a2a6e');
    sky.addColorStop(0.6, '#e8738a');
    sky.addColorStop(1, '#ffc46b');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, horizon);
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.arc(W * 0.5, horizon, H * 0.18 + t * 3, Math.PI, 0);
    ctx.fill();
    mesas(ctx, W, horizon, t * 10, '#5e3a5c', 0.8);
    ctx.fillStyle = '#3d2a3a';
    ctx.fillRect(0, horizon, W, H - horizon);
    ctx.fillStyle = '#2c2a3a';
    ctx.fillRect(0, H * 0.8, W, H * 0.12);
    const x = lerp(W * 0.3, W + 80, ease(clamp01(t / 2.3)));
    sideCar(ctx, x, H * 0.9, 0.7, t, -t * 24);
    logo(ctx, 'HIGHWAY HERO', W / 2, H * 0.2, Math.min(W * 0.09, 30), W * 0.8, RED_CHROME);
    if (t > 0.5) caption(ctx, 'NEXT WEEK: ANOTHER CASE!', W / 2, H * 0.38, 12, '#ffffff');
  }
}

// ------------------------------------------------------------------ the car

/** The car head-on (y up from the ground at `ground`): wide and low, the scanner across its nose. */
function frontCar(ctx: CanvasRenderingContext2D, x: number, ground: number, scale: number, t: number): void {
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(scale, -scale);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2 / scale;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#0b0b0e';
  for (const side of [-1, 1]) {
    roundRect(ctx, side * 44 - 9, 0, 18, 12, 3);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(-56, 6);
  ctx.lineTo(56, 6);
  ctx.lineTo(58, 18);
  ctx.lineTo(50, 26);
  ctx.lineTo(-50, 26);
  ctx.lineTo(-58, 18);
  ctx.closePath();
  ctx.fillStyle = CAR;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-40, 26);
  ctx.lineTo(40, 26);
  ctx.lineTo(28, 42);
  ctx.lineTo(-28, 42);
  ctx.closePath();
  ctx.fillStyle = GLASS;
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(170, 195, 255, 0.55)';
  ctx.lineWidth = 2.5 / scale;
  ctx.beginPath();
  ctx.moveTo(-22, 29);
  ctx.lineTo(-12, 40);
  ctx.moveTo(-15, 29);
  ctx.lineTo(-7, 38);
  ctx.stroke();
  ctx.fillStyle = CAR_SHINE;
  ctx.fillRect(-46, 22, 92, 1.6);
  scanner(ctx, 0, 14, 34, 3.5, t);
  ctx.restore();
}

/** The car's voice on the dashboard: three columns of red bars, jumping while it talks (`talking` 0..1). */
function voice(ctx: CanvasRenderingContext2D, cx: number, cy: number, talking: number, t: number): void {
  ctx.fillStyle = '#0a0506';
  roundRect(ctx, cx - 30, cy - 21, 60, 42, 5);
  ctx.fill();
  ctx.strokeStyle = '#3a1a1a';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  const rows = 7;
  for (const [col, weight] of [[-1, 0.7], [0, 1], [1, 0.7]] as const) {
    const level = talking > 0 ? weight * (0.35 + 0.65 * Math.abs(Math.sin(t * 13 + col * 1.7) * Math.sin(t * 5.3 + col))) : 0.08;
    const lit = Math.round(level * rows);
    for (let r = 0; r < rows; r++) {
      const on = Math.abs(r - (rows - 1) / 2) <= lit / 2;
      ctx.fillStyle = on ? '#ff2a1a' : '#3a0a0a';
      ctx.fillRect(cx + col * 17 - 6, cy - 18 + r * 5.3, 12, 3.6);
    }
  }
}

/** A dark slot with a red light sweeping side to side along it, a fading trail behind and a glow round it. */
function scanner(ctx: CanvasRenderingContext2D, cx: number, cy: number, halfWidth: number, halfHeight: number, t: number): void {
  ctx.fillStyle = '#050507';
  ctx.fillRect(cx - halfWidth, cy - halfHeight, halfWidth * 2, halfHeight * 2);
  const phase = t * Math.PI * 1.25;
  const x = cx + Math.sin(phase) * (halfWidth - 5);
  const back = Math.cos(phase) >= 0 ? -1 : 1;
  for (let i = 4; i >= 0; i--) {
    ctx.fillStyle = i === 0 ? '#ff3a24' : `rgba(255, 40, 30, ${0.55 / i})`;
    ctx.fillRect(x + back * i * 5 - 4, cy - halfHeight + 0.6, 8, halfHeight * 2 - 1.2);
  }
  const glow = ctx.createRadialGradient(x, cy, 0, x, cy, 15);
  glow.addColorStop(0, 'rgba(255, 60, 40, 0.6)');
  glow.addColorStop(1, 'rgba(255, 60, 40, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 15, cy - 15, 30, 30);
}

/** The car in profile, facing right, its wheels rolled `wheel` rad, lifted and tilted for a jump. */
function sideCar(ctx: CanvasRenderingContext2D, x: number, ground: number, scale: number, t: number, wheel: number, lift = 0, tilt = 0): void {
  ctx.save();
  ctx.translate(x, ground - lift);
  ctx.rotate(tilt);
  ctx.scale(scale, -scale);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2 / scale;
  ctx.strokeStyle = INK;
  polygon(ctx, SIDE);
  ctx.fillStyle = CAR;
  ctx.fill();
  ctx.stroke();
  polygon(ctx, SIDE_GLASS);
  ctx.fillStyle = GLASS;
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = CAR_SHINE;
  ctx.lineWidth = 1.5 / scale;
  ctx.beginPath();
  ctx.moveTo(-55, 21);
  ctx.lineTo(56, 17);
  ctx.moveTo(-6, 34);
  ctx.lineTo(4, 34);
  ctx.stroke();
  for (const wx of [-38, 38]) {
    ctx.fillStyle = '#050507';
    ctx.beginPath();
    ctx.arc(wx, 9.5, 12, 0, Math.PI);
    ctx.fill();
    wheelAt(ctx, wx, 9.5, 9.5, wheel, scale);
  }
  // The scanner, seen side-on: a red light pulsing at the tip of the nose.
  const pulse = 0.5 + 0.5 * Math.sin(t * Math.PI * 2.5);
  const glow = ctx.createRadialGradient(62, 14, 0, 62, 14, 7 + pulse * 5);
  glow.addColorStop(0, 'rgba(255, 60, 40, 0.95)');
  glow.addColorStop(1, 'rgba(255, 60, 40, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(50, 2, 24, 24);
  ctx.restore();
}

function wheelAt(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, turn: number, scale: number): void {
  ctx.fillStyle = '#0b0b0e';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2 / scale;
  ctx.stroke();
  ctx.fillStyle = '#9aa3b2';
  ctx.beginPath();
  ctx.arc(x, y, r * 0.52, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#4a4f5c';
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = turn + (i / 5) * Math.PI * 2;
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5);
  }
  ctx.stroke();
}

/** The crooks' getaway van, facing right (y up, ground at `ground`). */
function van(ctx: CanvasRenderingContext2D, x: number, ground: number, scale: number, wheel: number): void {
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(scale, -scale);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2 / scale;
  ctx.strokeStyle = INK;
  polygon(ctx, [[-48, 7], [-48, 50], [24, 50], [42, 30], [46, 10], [44, 7]]);
  ctx.fillStyle = '#c7b299';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#8e7a60';
  ctx.fillRect(-47, 24, 90, 5);
  polygon(ctx, [[26, 47], [39, 31], [26, 31]]);
  ctx.fillStyle = '#26324a';
  ctx.fill();
  ctx.stroke();
  // A masked face at the wheel.
  ctx.fillStyle = '#e0b48c';
  ctx.beginPath();
  ctx.arc(31, 37, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(27, 37, 9, 2.2);
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.moveTo(-10, 48);
  ctx.lineTo(-10, 9);
  ctx.stroke();
  for (const wx of [-30, 30]) wheelAt(ctx, wx, 9, 9, wheel, scale);
  ctx.restore();
}

// ------------------------------------------------------------------ people

/** A cartoon crook: beanie, black eye mask, striped jumper, hands up (bobbing a little with the nerves). */
function crook(ctx: CanvasRenderingContext2D, x: number, ground: number, s: number, t: number, phase: number): void {
  const bob = Math.sin(t * 7 + phase) * 1.5;
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#2c2c3a';
  ctx.fillRect(-7, -22, 6, 22);
  ctx.fillRect(1, -22, 6, 22);
  // Arms up.
  ctx.strokeStyle = '#e8e4dc';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-8, -40);
  ctx.lineTo(-13, -57 + bob);
  ctx.moveTo(8, -40);
  ctx.lineTo(13, -57 - bob);
  ctx.stroke();
  ctx.fillStyle = '#e0b48c';
  for (const [hx, hy] of [[-13, -59 + bob], [13, -59 - bob]] as const) {
    ctx.beginPath();
    ctx.arc(hx, hy, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // The striped jumper.
  roundRect(ctx, -10, -44, 20, 24, 4);
  ctx.fillStyle = '#f2efe8';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#1b1b24';
  for (let y = -42; y < -20; y += 6) ctx.fillRect(-10, y, 20, 3);
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  // Head, mask, beanie.
  ctx.fillStyle = '#e0b48c';
  ctx.beginPath();
  ctx.arc(0, -51, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#111';
  roundRect(ctx, -8, -54, 16, 5, 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  for (const ex of [-3.5, 3.5]) ctx.fillRect(ex - 1, -52.8, 2, 2);
  ctx.fillStyle = '#1b1b24';
  ctx.beginPath();
  ctx.arc(0, -55, 7.8, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(-8.4, -56, 16.8, 2.5);
  // A worried little mouth.
  ctx.strokeStyle = INK;
  ctx.beginPath();
  ctx.arc(0, -45.5, 2, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  ctx.restore();
}

/** The car's human partner: curly hair, leather jacket, jeans, and (`thumb` 0..1) a thumbs up. */
function partner(ctx: CanvasRenderingContext2D, x: number, ground: number, s: number, thumb: number): void {
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.fillStyle = '#3f5f96';
  ctx.fillRect(-8, -28, 7, 28);
  ctx.fillRect(1, -28, 7, 28);
  // The thumbs-up arm, and the other hand in a pocket.
  ctx.strokeStyle = '#4a2c1a';
  ctx.lineWidth = 5;
  const a = -0.2 - thumb * 1.9;
  ctx.beginPath();
  ctx.moveTo(10, -50);
  ctx.lineTo(10 + Math.sin(-a) * 13, -50 + Math.cos(-a) * 13);
  ctx.stroke();
  roundRect(ctx, -12, -54, 24, 28, 5);
  ctx.fillStyle = '#5a3620';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.fillStyle = '#f2efe8';
  ctx.beginPath();
  ctx.moveTo(-4, -54);
  ctx.lineTo(4, -54);
  ctx.lineTo(0, -44);
  ctx.fill();
  const hx = 10 + Math.sin(-a) * 15;
  const hy = -50 + Math.cos(-a) * 15;
  ctx.fillStyle = '#d9a27c';
  ctx.beginPath();
  ctx.arc(hx, hy, 3.4, 0, Math.PI * 2);
  ctx.fill();
  if (thumb > 0.5) ctx.fillRect(hx - 1, hy - 7, 2.4, 5);
  // Head and curls.
  ctx.fillStyle = '#d9a27c';
  ctx.beginPath();
  ctx.arc(0, -62, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#2a1a12';
  for (const [cx, cy] of [[-6, -67], [-2, -70], [3, -70], [7, -67], [-8, -63]] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, 3.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = INK;
  for (const ex of [-2.8, 2.8]) ctx.fillRect(ex - 0.8, -62, 1.6, 2);
  ctx.beginPath();
  ctx.arc(0, -58.5, 2.6, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ backgrounds

function polygon(ctx: CanvasRenderingContext2D, points: readonly (readonly [number, number])[]): void {
  ctx.beginPath();
  points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
}

/** A night sky down to `horizon`, with stars. */
function night(ctx: CanvasRenderingContext2D, W: number, horizon: number, low: string): void {
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, '#05060f');
  sky.addColorStop(1, low);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, horizon);
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 22; i++) ctx.fillRect((i * 71) % W, ((i * 37) % Math.max(1, horizon * 0.8)) + 3, 1.4, 1.4);
}

/** A glowing grid floor running at us from the horizon. */
function grid(ctx: CanvasRenderingContext2D, W: number, H: number, horizon: number, t: number): void {
  ctx.fillStyle = '#120a26';
  ctx.fillRect(0, horizon, W, H - horizon);
  ctx.strokeStyle = 'rgba(255, 63, 164, 0.75)';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const p = ((i + t * 1.6) % 8) / 8;
    const y = horizon + (H - horizon) * p * p;
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  for (let j = -7; j <= 7; j++) {
    ctx.moveTo(W / 2 + j * 6, horizon);
    ctx.lineTo(W / 2 + j * 70, H);
  }
  ctx.stroke();
}

/** The desert at night: moon, stars, mesas scrolling by and the road's dashes rushing past at `speed` px/s. */
function desertNight(ctx: CanvasRenderingContext2D, W: number, H: number, horizon: number, t: number, speed: number): void {
  night(ctx, W, horizon, '#3a2150');
  ctx.fillStyle = '#f3f0d8';
  ctx.beginPath();
  ctx.arc(W * 0.78, H * 0.2, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(160, 150, 120, 0.35)';
  for (const [dx, dy, r] of [[-5, -4, 4], [6, 3, 3], [-2, 7, 2]] as const) {
    ctx.beginPath();
    ctx.arc(W * 0.78 + dx, H * 0.2 + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  mesas(ctx, W, horizon, t * speed * 0.06, '#2a1838', 0.8);
  mesas(ctx, W, horizon, t * speed * 0.15, '#1d1128', 1.05);
  ctx.fillStyle = '#231a33';
  ctx.fillRect(0, horizon, W, H - horizon);
  ctx.fillStyle = '#2c2a3a';
  ctx.fillRect(0, H * 0.74, W, H * 0.2);
  ctx.fillStyle = '#ffd35c';
  const dash = 46;
  const offset = (t * speed) % dash;
  for (let x = -offset; x < W; x += dash) ctx.fillRect(x, H * 0.84, dash * 0.55, 3);
}

/** Office blocks against the night, a few windows lit. */
function skyline(ctx: CanvasRenderingContext2D, W: number, ground: number): void {
  let x = 0;
  for (let i = 0; x < W; i++) {
    const w = 34 + ((i * 23) % 30);
    const h = 40 + ((i * 41) % 60);
    ctx.fillStyle = i % 2 ? '#1c1730' : '#171328';
    ctx.fillRect(x, ground - h, w - 3, h);
    ctx.fillStyle = '#f5d37a';
    for (let wy = ground - h + 7; wy < ground - 10; wy += 10) {
      for (let wx = x + 5; wx < x + w - 8; wx += 9) if (((wx * 5 + wy * 7) | 0) % 7 < 2) ctx.fillRect(wx, wy, 3, 4);
    }
    x += w;
  }
}
