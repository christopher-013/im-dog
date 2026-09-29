import { lerp } from '../../utils/math';
import { caption, clamp01, ease, INK, logo, roundRect, sceneAt, star, type GradientStops, type Scenes, type TvShow } from './draw';

/**
 * "CHEF SHOWDOWN", a TV show in the style of the dramatic cooking contests: a spotlit arena, the day's ingredient
 * rising out of the fog, a chef chopping at lightning speed against the clock, sushi rolled and sliced, the judges'
 * scorecards, and the winner in a shower of confetti. Original: no real show's names, hosts or catchphrases.
 */

type SceneName = 'title' | 'reveal' | 'chop' | 'sushi' | 'judges' | 'winner';

export const SCENES: Scenes<SceneName> = [
  { name: 'title', from: 0, to: 3 },
  { name: 'reveal', from: 3, to: 7 },
  { name: 'chop', from: 7, to: 12 },
  { name: 'sushi', from: 12, to: 17 },
  { name: 'judges', from: 17, to: 20.5 },
  { name: 'winner', from: 20.5, to: 24 },
];

const GOLD: GradientStops = [[0, '#fff6c8'], [0.45, '#ffd35c'], [0.5, '#a8641a'], [1, '#ffcf5a']];
const TUNA_RED = '#c8383e';
const SKIN = '#e2b08a';

export class ChefShowdown implements TvShow {
  readonly name = 'CHEF SHOWDOWN';
  readonly channel = 11;
  readonly loop = SCENES[SCENES.length - 1]!.to;

  draw(ctx: CanvasRenderingContext2D, W: number, H: number, time: number): void {
    const { name, t } = sceneAt(SCENES, time);
    ctx.save();
    switch (name) {
      case 'title':
        this.title(ctx, W, H, t);
        break;
      case 'reveal':
        this.reveal(ctx, W, H, t);
        break;
      case 'chop':
        this.chop(ctx, W, H, t);
        break;
      case 'sushi':
        this.sushi(ctx, W, H, t);
        break;
      case 'judges':
        this.judges(ctx, W, H, t);
        break;
      case 'winner':
        this.winner(ctx, W, H, t);
        break;
    }
    ctx.restore();
  }

  /** The arena in the dark, spotlights sweeping, a crossed knife and fork, and the name in gold. */
  private title(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    arena(ctx, W, H, t);
    const punch = 1 + 0.6 * (1 - ease(clamp01(t / 0.4)));
    emblem(ctx, W / 2, H * 0.3, 26 * punch);
    logo(ctx, 'CHEF SHOWDOWN', W / 2, H * 0.64, Math.min(W * 0.11, 38) * punch, W * 0.92, GOLD);
    if (t > 0.8) caption(ctx, '★ TONIGHT: WHO WILL WIN? ★', W / 2, H * 0.85, 11, '#ffffff');
  }

  /** Out of the fog on a rising platform: today's ingredient, a whole tuna, sparkling. */
  private reveal(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    arena(ctx, W, H, t * 0.3);
    const top = lerp(H + 30, H * 0.7, ease(clamp01(t / 1.4)));
    // The platform and its silver tray.
    ctx.fillStyle = '#241a33';
    ctx.fillRect(W / 2 - 70, top, 140, H);
    ctx.fillStyle = '#3a2c52';
    ctx.beginPath();
    ctx.ellipse(W / 2, top, 70, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d7dde6';
    ctx.beginPath();
    ctx.ellipse(W / 2, top - 4, 60, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    tuna(ctx, W / 2, top - 22, 1.15, t);
    // Fog rolling round its foot.
    for (let i = 0; i < 7; i++) {
      const x = ((i * 67 + t * 25) % (W + 80)) - 40;
      ctx.fillStyle = 'rgba(235, 230, 255, 0.18)';
      ctx.beginPath();
      ctx.ellipse(x, H * 0.92 - (i % 3) * 7, 46, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    if (t > 1.4) {
      for (let i = 0; i < 6; i++) {
        const twinkle = Math.max(0, Math.sin(t * 6 + i * 1.9));
        star(ctx, W / 2 + Math.cos(i * 1.7) * 75, top - 30 + Math.sin(i * 2.3) * 22, 3 + twinkle * 6, 4, `rgba(255, 245, 190, ${twinkle})`);
      }
      caption(ctx, "TODAY'S INGREDIENT:", W / 2, H * 0.14, 12, '#ffffff');
      const pop = 1 + 0.35 * Math.sin(clamp01((t - 1.6) / 0.3) * Math.PI);
      if (t > 1.6) logo(ctx, 'TUNA!', W / 2, H * 0.3, 30 * pop, W * 0.6, GOLD);
    }
  }

  /** Close in on the board: the knife a blur, slices fanning out, the clock running down. */
  private chop(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    tiles(ctx, W, H);
    // The board.
    const boardTop = H * 0.5;
    ctx.fillStyle = '#c99a62';
    roundRect(ctx, W * 0.06, boardTop, W * 0.88, H * 0.44, 10);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 80, 40, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 1; i < 6; i++) {
      ctx.moveTo(W * 0.08, boardTop + i * H * 0.07);
      ctx.bezierCurveTo(W * 0.35, boardTop + i * H * 0.07 - 4, W * 0.6, boardTop + i * H * 0.07 + 4, W * 0.92, boardTop + i * H * 0.07);
    }
    ctx.stroke();
    // The block of tuna gets shorter as the slices pile up in a fan.
    const slices = Math.min(12, Math.floor(t * 3));
    const blockLeft = W * 0.52 + slices * 4;
    fish(ctx, blockLeft, boardTop + 22, W * 0.82 - blockLeft, 34);
    for (let i = 0; i < slices; i++) {
      ctx.save();
      ctx.translate(W * 0.47 - i * 13, boardTop + 40 + (i % 2) * 3);
      ctx.rotate(-0.35);
      roundRect(ctx, -6, -16, 11, 32, 4);
      ctx.fillStyle = i % 2 ? '#d9474b' : TUNA_RED;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 220, 220, 0.6)';
      ctx.beginPath();
      ctx.moveTo(-3, -10);
      ctx.lineTo(2, 8);
      ctx.stroke();
      ctx.restore();
    }
    // The knife and the hand, chopping so fast it's a blur.
    const chopY = Math.abs(Math.sin(t * 17)) * 30;
    const kx = blockLeft - 4;
    for (const [ghost, alpha] of [[16, 0.2], [8, 0.4], [0, 1]] as const) knife(ctx, kx, boardTop + 6 - chopY - ghost, alpha);
    const sleeve = boardTop - 40 - chopY;
    ctx.fillStyle = '#f5f2ec';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    roundRect(ctx, kx + 20, sleeve - 60, 30, 64, 8);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = SKIN;
    roundRect(ctx, kx + 14, sleeve, 24, 16, 7);
    ctx.fill();
    ctx.stroke();
    // Motion lines, the clock and the shout.
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const dx of [-24, -30, 44]) {
      ctx.moveTo(kx + dx, boardTop - 34);
      ctx.lineTo(kx + dx, boardTop - 8);
    }
    ctx.stroke();
    clock(ctx, W - 58, 12, 59 * 60 + 59 - Math.floor(t * 14));
    if (t % 1.25 < 0.7) caption(ctx, 'CHOP! CHOP! CHOP!', W * 0.36, H * 0.16, 16 + (t % 1.25) * 4, '#ffe066');
  }

  /** From above: rice on the seaweed, the fillings laid in, rolled in the mat, sliced and plated. */
  private sushi(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    ctx.fillStyle = '#d8b88a';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(150, 110, 60, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 10; y < H; y += 17) {
      ctx.moveTo(0, y);
      ctx.lineTo(W, y + 4);
    }
    ctx.stroke();
    const mat = { x: W * 0.12, y: H * 0.12, w: W * 0.5, h: H * 0.76 };
    const sliced = clamp01((t - 3.4) / 0.4);
    if (sliced < 1) {
      // The bamboo mat.
      ctx.fillStyle = '#c6cc86';
      ctx.fillRect(mat.x, mat.y, mat.w, mat.h);
      ctx.strokeStyle = 'rgba(90, 100, 40, 0.5)';
      ctx.beginPath();
      for (let y = mat.y + 6; y < mat.y + mat.h; y += 7) {
        ctx.moveTo(mat.x, y);
        ctx.lineTo(mat.x + mat.w, y);
      }
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(mat.x, mat.y, mat.w, mat.h);
      // Seaweed and rice, then the fillings, then rolled up from the bottom.
      const roll = clamp01((t - 2.2) / 1.2);
      const inset = 10;
      const sheet = { x: mat.x + inset, w: mat.w - inset * 2, top: mat.y + inset, bottom: mat.y + mat.h - inset };
      const flatBottom = lerp(sheet.bottom, sheet.top + 26, ease(roll));
      if (flatBottom - sheet.top > 26) {
        ctx.fillStyle = '#1f3a26';
        ctx.fillRect(sheet.x, sheet.top, sheet.w, flatBottom - sheet.top);
        const rice = clamp01(t / 1.1);
        ctx.fillStyle = '#fbfaf4';
        ctx.fillRect(sheet.x + 4, sheet.top + 4, (sheet.w - 8) * rice, flatBottom - sheet.top - 8);
        ctx.fillStyle = 'rgba(200, 200, 190, 0.6)';
        for (let i = 0; i < 40 * rice; i++) ctx.fillRect(sheet.x + 6 + ((i * 37) % (sheet.w - 14)), sheet.top + 6 + ((i * 53) % Math.max(1, flatBottom - sheet.top - 14)), 3, 2);
        // Tuna, cucumber, avocado, dropped in one after another.
        const strips: readonly (readonly [string, number])[] = [[TUNA_RED, 1.2], ['#6fae4b', 1.5], ['#b9d77a', 1.8]];
        strips.forEach(([color, at], i) => {
          const drop = clamp01((t - at) / 0.25);
          const y = sheet.bottom - 30 - i * 11;
          if (drop <= 0 || y > flatBottom - 6) return;
          ctx.fillStyle = color;
          ctx.globalAlpha = drop;
          roundRect(ctx, sheet.x + 10, y - (1 - drop) * 20, sheet.w - 20, 8, 3);
          ctx.fill();
          ctx.globalAlpha = 1;
        });
      }
      if (roll > 0) {
        // The roll itself, fattening as it goes up the mat, pushed along by two hands.
        const thick = lerp(10, 26, ease(roll));
        roundRect(ctx, sheet.x - 4, flatBottom - thick / 2, sheet.w + 8, thick, thick / 2);
        ctx.fillStyle = '#16301e';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.beginPath();
        ctx.moveTo(sheet.x + 6, flatBottom - thick * 0.25);
        ctx.lineTo(sheet.x + sheet.w - 6, flatBottom - thick * 0.25);
        ctx.stroke();
        for (const side of [0.25, 0.75]) hand(ctx, sheet.x + sheet.w * side, flatBottom + thick / 2 + 8 + Math.sin(t * 12 + side * 6) * 2);
      }
      if (sliced > 0) {
        // The knife's flash across the roll.
        ctx.fillStyle = `rgba(255, 255, 255, ${sliced})`;
        for (let i = 1; i < 6; i++) ctx.fillRect(sheet.x + (sheet.w / 6) * i - 1, mat.y, 2, mat.h);
      }
    }
    // The plate: six pieces sliding in, and two nigiri.
    const plate = { x: W * 0.8, y: H * 0.5 };
    ctx.fillStyle = '#f7f6f2';
    ctx.beginPath();
    ctx.ellipse(plate.x, plate.y, W * 0.17, H * 0.36, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.stroke();
    const plated = clamp01((t - 3.6) / 0.9);
    for (let i = 0; i < 6; i++) {
      const at = clamp01(plated * 1.6 - i * 0.12);
      if (at <= 0) continue;
      const px = plate.x - 22 + (i % 2) * 44;
      const py = plate.y - 44 + Math.floor(i / 2) * 30;
      piece(ctx, lerp(mat.x + mat.w * (0.1 + i * 0.16), px, ease(at)), lerp(mat.y + mat.h * 0.3, py, ease(at)));
    }
    if (plated >= 1) {
      for (const dy of [50, 72]) nigiri(ctx, plate.x, plate.y + dy - 12);
      caption(ctx, 'BEAUTIFUL!', W * 0.36, H * 0.5, 20, '#ffe066');
    }
  }

  /** The judges' table: three scorecards flip up. */
  private judges(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    arena(ctx, W, H, 0.4);
    const scores = [10, 9, 10];
    for (let i = 0; i < 3; i++) {
      const x = W * (0.22 + i * 0.28);
      judge(ctx, x, H * 0.62, i, t);
      const flip = ease(clamp01((t - 0.5 - i * 0.55) / 0.25));
      if (flip > 0) {
        ctx.save();
        ctx.translate(x, H * 0.3);
        ctx.scale(1, flip);
        roundRect(ctx, -22, -17, 44, 34, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.font = '900 24px "Arial Black", Impact, Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(scores[i]), 0, 1);
        ctx.restore();
      }
    }
    // The table in front of them.
    ctx.fillStyle = '#7a1f2b';
    ctx.fillRect(0, H * 0.72, W, H * 0.28);
    ctx.fillStyle = '#9e2d3a';
    ctx.fillRect(0, H * 0.72, W, 6);
    ctx.fillStyle = '#ffd35c';
    ctx.fillRect(0, H * 0.72 + 6, W, 2);
    if (t > 2.3) caption(ctx, '29 OUT OF 30!', W / 2, H * 0.87, 18, '#ffe066');
  }

  /** The winner holds up the plate, confetti everywhere. */
  private winner(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
    arena(ctx, W, H, t);
    chef(ctx, W / 2, H * 1.02, 1.3, t);
    const colors = ['#ff5a4a', '#ffd35c', '#4fb7ff', '#4ee07a', '#ff8ad0'];
    for (let i = 0; i < 34; i++) {
      const fall = (t * (38 + (i % 5) * 9) + i * 29) % (H + 20);
      const x = (i * 53 + Math.sin(t * 2 + i) * 12) % W;
      ctx.save();
      ctx.translate(x, fall - 10);
      ctx.rotate(t * 4 + i);
      ctx.fillStyle = colors[i % colors.length]!;
      ctx.fillRect(-3, -1.5, 6, 3);
      ctx.restore();
    }
    const pop = 1 + 0.3 * Math.sin(clamp01(t / 0.3) * Math.PI);
    caption(ctx, 'WINNER: THE RED CHEF!', W / 2, H * 0.1, 18 * pop, '#ffe066');
    if (t > 2) caption(ctx, 'SEE YOU AT THE NEXT SHOWDOWN!', W / 2, H * 0.93, 10, '#ffffff');
  }
}

// ------------------------------------------------------------------ sets

/** The dark arena, its floor, and spotlights sweeping from above. */
function arena(ctx: CanvasRenderingContext2D, W: number, H: number, t: number): void {
  const back = ctx.createLinearGradient(0, 0, 0, H);
  back.addColorStop(0, '#07050c');
  back.addColorStop(0.7, '#241536');
  back.addColorStop(1, '#3a2248');
  ctx.fillStyle = back;
  ctx.fillRect(0, 0, W, H);
  // Rows of lights up in the rafters.
  ctx.fillStyle = 'rgba(255, 220, 150, 0.8)';
  for (let i = 0; i < 16; i++) ctx.fillRect(i * (W / 16) + 8, 8 + (i % 2) * 5, 3, 3);
  for (let i = 0; i < 3; i++) {
    const x = W * (0.2 + i * 0.3) + Math.sin(t * 1.3 + i * 2) * W * 0.12;
    const cone = ctx.createLinearGradient(0, 0, 0, H);
    cone.addColorStop(0, 'rgba(255, 244, 210, 0.3)');
    cone.addColorStop(1, 'rgba(255, 244, 210, 0.04)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(W * (0.3 + i * 0.2) - 6, -4);
    ctx.lineTo(W * (0.3 + i * 0.2) + 6, -4);
    ctx.lineTo(x + 46, H);
    ctx.lineTo(x - 46, H);
    ctx.fill();
  }
}

/** White kitchen tiles behind the board. */
function tiles(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.fillStyle = '#e9edf0';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#c3cad1';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x < W; x += 24) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 0; y < H; y += 24) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();
}

/** The show's emblem: a knife and a fork crossed on a gold disc. */
function emblem(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fillStyle = '#ffcf5a';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  for (const turn of [-0.75, 0.75]) {
    ctx.save();
    ctx.rotate(turn);
    ctx.fillStyle = turn < 0 ? '#e9edf2' : '#cfd6df';
    if (turn < 0) {
      // The knife.
      ctx.beginPath();
      ctx.moveTo(-3, -r * 0.95);
      ctx.quadraticCurveTo(5, -r * 0.5, 3, 0);
      ctx.lineTo(-3, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else {
      // The fork.
      ctx.fillRect(-2, -r * 0.2, 4, r * 0.2);
      for (const dx of [-4, 0, 4]) ctx.fillRect(dx - 1, -r * 0.8, 2, r * 0.6);
      ctx.fillRect(-5, -r * 0.3, 10, 3);
    }
    ctx.fillStyle = '#2b2b33';
    ctx.fillRect(-2.5, 0, 5, r * 0.85);
    ctx.restore();
  }
  ctx.restore();
}

// ------------------------------------------------------------------ food

/** A whole tuna, side on, facing right: navy back, silver belly, yellow finlets, forked tail. */
function tuna(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, t: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(Math.sin(t * 2) * 0.02);
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2 / s;
  ctx.strokeStyle = INK;
  // Tail.
  ctx.beginPath();
  ctx.moveTo(-44, 0);
  ctx.lineTo(-62, -16);
  ctx.lineTo(-56, 0);
  ctx.lineTo(-62, 16);
  ctx.closePath();
  ctx.fillStyle = '#2c3e64';
  ctx.fill();
  ctx.stroke();
  // Body: back and belly.
  ctx.beginPath();
  ctx.moveTo(48, 2);
  ctx.bezierCurveTo(30, -20, -20, -20, -46, 0);
  ctx.bezierCurveTo(-20, 18, 30, 18, 48, 2);
  ctx.closePath();
  ctx.fillStyle = '#c9d3e0';
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#2c3e64';
  ctx.fillRect(-50, -24, 100, 22);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.fillRect(-30, 4, 50, 3);
  ctx.restore();
  ctx.stroke();
  // Fins and finlets.
  ctx.fillStyle = '#2c3e64';
  ctx.beginPath();
  ctx.moveTo(-2, -15);
  ctx.lineTo(8, -28);
  ctx.lineTo(14, -14);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd35c';
  for (let i = 0; i < 5; i++) {
    const fx = -14 - i * 6;
    ctx.beginPath();
    ctx.moveTo(fx, -11 + i);
    ctx.lineTo(fx - 3, -15 + i);
    ctx.lineTo(fx - 5, -10 + i);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(fx, 11 - i);
    ctx.lineTo(fx - 3, 15 - i);
    ctx.lineTo(fx - 5, 10 - i);
    ctx.fill();
  }
  // Eye and gill.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(34, -3, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(35, -3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(22, 0, 9, -0.9, 0.9);
  ctx.stroke();
  ctx.restore();
}

/** A block of tuna loin on the board (deep red with pale lines of fat). */
function fish(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  if (w <= 4) return;
  roundRect(ctx, x, y, w, h, 6);
  ctx.fillStyle = TUNA_RED;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = 'rgba(255, 210, 210, 0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.moveTo(x + i * 18 - 10, y);
    ctx.lineTo(x + i * 18 + 10, y + h);
  }
  ctx.stroke();
  ctx.restore();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/** A chef's knife, blade down, its heel at (x, y) (faded by `alpha` for the blur). */
function knife(ctx: CanvasRenderingContext2D, x: number, y: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.fillStyle = '#e4e9ef';
  ctx.beginPath();
  ctx.moveTo(-50, 0);
  ctx.quadraticCurveTo(-26, -4, 2, -16);
  ctx.lineTo(2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#2b2b33';
  roundRect(ctx, 2, -12, 26, 9, 3);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A clock face in red digits (mm:ss). */
function clock(ctx: CanvasRenderingContext2D, x: number, y: number, seconds: number): void {
  const s = Math.max(0, seconds);
  const text = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  ctx.fillStyle = '#0c0a10';
  roundRect(ctx, x, y, 50, 22, 4);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = '#ff3b30';
  ctx.font = 'bold 15px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + 25, y + 12);
}

/** A hand from above, pushing (a mitten with a white cuff). */
function hand(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.fillStyle = '#f5f2ec';
  ctx.fillRect(x - 11, y + 8, 22, 20);
  ctx.strokeRect(x - 11, y + 8, 22, 20);
  roundRect(ctx, x - 12, y - 8, 24, 18, 8);
  ctx.fillStyle = SKIN;
  ctx.fill();
  ctx.stroke();
}

/** One maki piece from above: seaweed ring, rice, and the fillings in the middle. */
function piece(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#16301e';
  ctx.beginPath();
  ctx.arc(x, y, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fbfaf4';
  ctx.beginPath();
  ctx.arc(x, y, 9.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = TUNA_RED;
  ctx.fillRect(x - 4, y - 4, 5, 6);
  ctx.fillStyle = '#6fae4b';
  ctx.fillRect(x + 1, y - 3, 3, 5);
  ctx.fillStyle = '#b9d77a';
  ctx.fillRect(x - 3, y + 2, 5, 2.5);
}

/** A nigiri from above: a slice of tuna over a mound of rice. */
function nigiri(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.fillStyle = '#fbfaf4';
  ctx.beginPath();
  ctx.ellipse(x, y, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = TUNA_RED;
  ctx.beginPath();
  ctx.ellipse(x, y - 1, 22, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255, 210, 210, 0.7)';
  ctx.beginPath();
  ctx.moveTo(x - 12, y - 4);
  ctx.lineTo(x - 6, y + 3);
  ctx.moveTo(x - 2, y - 5);
  ctx.lineTo(x + 4, y + 3);
  ctx.moveTo(x + 8, y - 4);
  ctx.lineTo(x + 13, y + 2);
  ctx.stroke();
}

// ------------------------------------------------------------------ people

/** One of the three judges, behind the table: a grey-haired one in glasses, one with a bun, one with a moustache. */
function judge(ctx: CanvasRenderingContext2D, x: number, y: number, who: number, t: number): void {
  const nod = Math.sin(t * 3 + who) * 1.2;
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  roundRect(ctx, -22, -10, 44, 40, 10);
  ctx.fillStyle = ['#34405e', '#6e3a6e', '#2f4a3a'][who]!;
  ctx.fill();
  ctx.stroke();
  // The card-holding arm, up.
  ctx.strokeStyle = SKIN;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(14, -4);
  ctx.lineTo(10, -46);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(0, -24 + nod, 13, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (who === 0) {
    ctx.fillStyle = '#c9c9d1';
    ctx.beginPath();
    ctx.arc(0, -30 + nod, 13, Math.PI * 1.05, Math.PI * 1.95);
    ctx.fill();
    ctx.strokeRect(-9, -27 + nod, 7, 5);
    ctx.strokeRect(2, -27 + nod, 7, 5);
  } else if (who === 1) {
    ctx.fillStyle = '#3a2418';
    ctx.beginPath();
    ctx.arc(0, -30 + nod, 13.5, Math.PI, 0);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -43 + nod, 6, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = '#4a2c1a';
    ctx.beginPath();
    ctx.ellipse(0, -18 + nod, 7, 2.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8342c';
    ctx.beginPath();
    ctx.moveTo(-6, -7);
    ctx.lineTo(0, -10);
    ctx.lineTo(6, -7);
    ctx.lineTo(6, -13);
    ctx.lineTo(0, -10);
    ctx.lineTo(-6, -13);
    ctx.fill();
  }
  ctx.fillStyle = INK;
  for (const ex of [-5, 5]) ctx.fillRect(ex - 1, -25 + nod, 2, 2.5);
  ctx.beginPath();
  ctx.arc(0, -20 + nod, 4, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.restore();
}

/** The red chef: tall toque, moustache, red jacket, holding the plate of sushi up high. */
function chef(ctx: CanvasRenderingContext2D, x: number, ground: number, s: number, t: number): void {
  const lift = Math.abs(Math.sin(t * 4)) * 4;
  ctx.save();
  ctx.translate(x, ground);
  ctx.scale(s, s);
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  // Arms up (the plate goes on top, after the toque).
  ctx.strokeStyle = '#b3232e';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-14, -52);
  ctx.lineTo(-22, -110 - lift);
  ctx.moveTo(14, -52);
  ctx.lineTo(22, -110 - lift);
  ctx.stroke();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.6;
  // The jacket and its buttons.
  roundRect(ctx, -18, -58, 36, 58, 8);
  ctx.fillStyle = '#c8303b';
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffd35c';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-5, -48 + i * 12, 1.8, 0, Math.PI * 2);
    ctx.arc(5, -48 + i * 12, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // Face, moustache, the toque.
  ctx.fillStyle = SKIN;
  ctx.beginPath();
  ctx.arc(0, -70, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3a2418';
  ctx.beginPath();
  ctx.ellipse(-4, -66, 5, 2.2, 0.3, 0, Math.PI * 2);
  ctx.ellipse(4, -66, 5, 2.2, -0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = INK;
  for (const ex of [-4.5, 4.5]) ctx.fillRect(ex - 1, -73, 2, 2.4);
  ctx.beginPath();
  ctx.arc(0, -63, 3.5, 0.2 * Math.PI, 0.8 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-10, -96, 20, 16);
  ctx.strokeRect(-10, -96, 20, 16);
  for (const [cx, cy] of [[-7, -98], [0, -101], [7, -98]] as const) {
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // The plate of sushi, held up high.
  ctx.fillStyle = '#f7f6f2';
  ctx.beginPath();
  ctx.ellipse(0, -116 - lift, 32, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.fillStyle = '#16301e';
    ctx.beginPath();
    ctx.arc(-15 + i * 10, -121 - lift, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = TUNA_RED;
    ctx.fillRect(-16.5 + i * 10, -122.5 - lift, 3, 3);
  }
  ctx.restore();
}
