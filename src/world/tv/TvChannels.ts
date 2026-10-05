import { CanvasTexture, LinearFilter, SRGBColorSpace, type MeshBasicMaterial } from 'three';
import { TV } from '../../config/world';
import { ChefShowdown } from './ChefShowdown';
import { crt, type TvShow } from './draw';
import { Gearbots } from './Gearbots';
import { HighwayHero } from './HighwayHero';
import { StarVoyagers } from './StarVoyagers';
import { HOME_RUN_AT, WorldSeries } from './WorldSeries';

/** Every show on the air. */
export function tvShows(): TvShow[] {
  return [new Gearbots(), new HighwayHero(), new ChefShowdown(), new StarVoyagers()];
}

interface Screen {
  readonly material: MeshBasicMaterial;
  readonly ctx: CanvasRenderingContext2D | null;
  readonly texture: CanvasTexture | null;
  /** Which show it's on (an index into `shows`). */
  show: number;
  /** Seconds left of static (changing channel), and of the channel number in the corner. */
  static: number;
  osd: number;
  sinceFrame: number;
  /** The sharper picture for a close-up (made the first time it's needed), and whether it's showing. */
  detail: { readonly ctx: CanvasRenderingContext2D; readonly texture: CanvasTexture } | null;
  detailed: boolean;
}

/**
 * The house's TVs, each on a different show: every so often two of them swap channels (a burst of static, then the
 * channel number in the corner, like an old set). The shows are broadcasts: each runs on its own clock whether or
 * not a TV is showing it, so flicking over lands in the middle of it. Each TV draws onto its own small canvas, a
 * dozen times a second (`TV`), on its own material. Without a DOM (unit tests) the channels still change; the
 * screens just stay dark.
 *
 * Now and then a special broadcast (the World Series) cuts in on every TV at once, all showing the same moment; when
 * it's over, each goes back to the show it was on. `onHomeRun` fires at its big moment.
 */
export class TvChannels {
  private readonly screens: Screen[];
  private readonly clocks: number[];
  private switchIn: number;
  /** The special broadcast: on (how far into it, and whether the home run's been hit), or not. */
  private special: { time: number; homeRun: boolean } | null = null;
  private specialIn: number;
  /** Called once per special broadcast, the moment the home run's hit. */
  onHomeRun: (() => void) | null = null;
  /** The TV being shown close up (drawn sharper), or null. */
  private detailIndex: number | null = null;

  constructor(
    materials: readonly MeshBasicMaterial[],
    private readonly random: () => number = Math.random,
    readonly shows: readonly TvShow[] = tvShows(),
    private readonly options = TV,
    readonly specialShow: TvShow = new WorldSeries(),
    private readonly homeRunAt = HOME_RUN_AT,
  ) {
    // Each show starts somewhere different; each TV on a different show.
    this.clocks = shows.map((show) => random() * show.loop);
    const order = shows.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [order[i], order[j]] = [order[j]!, order[i]!];
    }
    this.screens = materials.map((material, i) => this.createScreen(material, order[i % order.length]!, i / (materials.length * options.fps)));
    this.switchIn = this.nextSwitch();
    this.specialIn = this.between(options.special.firstAfter);
    for (const screen of this.screens) this.draw(screen);
  }

  /** The special broadcast is on every TV right now. */
  get specialOn(): boolean {
    return this.special !== null;
  }

  /** It's on, and the home run hasn't happened yet. */
  get homeRunToCome(): boolean {
    return this.special !== null && !this.special.homeRun;
  }

  /** Cuts in with the special broadcast on every TV, from the top (the timer, or `imdog.room.tv.startSpecial()`). */
  startSpecial(): void {
    this.special = { time: 0, homeRun: false };
    for (const screen of this.screens) this.flick(screen);
  }

  /**
   * Draws TV `index` (in the order of the materials) `TV.detailScale` times sharper while the camera's close up on it
   * (Moke watching the game); null puts every TV back to its usual picture. Only one at a time.
   */
  setDetail(index: number | null): void {
    if (index === this.detailIndex) return;
    this.detailIndex = index;
    this.screens.forEach((screen, i) => {
      const want = i === index;
      if (want && !screen.detail) screen.detail = this.createDetail();
      screen.detailed = want && screen.detail !== null;
      const map = screen.detailed ? screen.detail!.texture : screen.texture;
      if (map && screen.material.map !== map) screen.material.map = map;
      screen.sinceFrame = 1; // redraw now
    });
  }

  /** The TV drawn sharper right now (tests, debug). */
  get detail(): number | null {
    return this.detailIndex;
  }

  /** Which show each TV is on, in the order of the materials. */
  get onAir(): readonly TvShow[] {
    return this.screens.map((s) => (this.special ? this.specialShow : this.shows[s.show]!));
  }

  /** Each rendered frame (dt 0 while paused: the shows, and the channel-hopping, pause with the game). */
  update(dt: number): void {
    if (dt <= 0) return;
    for (let i = 0; i < this.clocks.length; i++) this.clocks[i] = (this.clocks[i]! + dt) % this.shows[i]!.loop;
    const special = this.special;
    if (special) {
      special.time += dt;
      if (!special.homeRun && special.time >= this.homeRunAt) {
        special.homeRun = true;
        this.onHomeRun?.();
      }
      if (special.time >= this.specialShow.loop) this.endSpecial();
    } else {
      this.switchIn -= dt;
      if (this.switchIn <= 0) {
        this.switchChannels();
        this.switchIn = this.nextSwitch();
      }
      this.specialIn -= dt;
      if (this.specialIn <= 0) this.startSpecial();
    }
    const frame = 1 / this.options.fps;
    for (const screen of this.screens) {
      screen.static = Math.max(0, screen.static - dt);
      screen.osd = Math.max(0, screen.osd - dt);
      screen.sinceFrame += dt;
      if (screen.sinceFrame < frame) continue;
      screen.sinceFrame %= frame;
      this.draw(screen);
    }
  }

  /**
   * Draws what TV `index` is showing right now (the same show at the same moment, snow and all) full screen: inside a
   * TV set (a dark bezel and its power light, on a wooden stand against the wall), with Moke's head and ears from
   * behind at the bottom, watching. Shapes, so it stays sharp at any size.
   */
  drawFull(index: number, ctx: CanvasRenderingContext2D): void {
    const screen = this.screens[index];
    if (!screen) return;
    const { width: cw, height: ch } = ctx.canvas;
    const { width: W, height: H } = this.options;
    // The picture as big as leaves room for the set round it, a little above the middle.
    const k = Math.min((cw * 0.8) / W, (ch * 0.66) / H);
    const pw = W * k;
    const ph = H * k;
    const px = (cw - pw) / 2;
    const py = Math.max(ch * 0.06, (ch - ph) * 0.38);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    tvRoom(ctx, cw, ch, py + ph);
    tvSet(ctx, px, py, pw, ph);
    ctx.save();
    ctx.setTransform(k, 0, 0, k, px, py);
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    const show = this.special ? this.specialShow : this.shows[screen.show]!;
    if (screen.static > 0) snow(ctx, W, H);
    else show.draw(ctx, W, H, this.special ? this.special.time : this.clocks[screen.show]!);
    if (screen.osd > 0) channelNumber(ctx, W, show.osd ?? `CH ${String(show.channel).padStart(2, '0')}`);
    // The glass: a soft sheen across the top corner.
    const glare = ctx.createLinearGradient(0, 0, W * 0.6, H);
    glare.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
    glare.addColorStop(0.35, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glare;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    mokeFromBehind(ctx, cw, ch, Math.min(cw, ch * 1.6));
  }

  /** Which show TV `index` is on right now. */
  showOn(index: number): TvShow | null {
    const screen = this.screens[index];
    return screen ? (this.special ? this.specialShow : this.shows[screen.show]!) : null;
  }

  dispose(): void {
    for (const screen of this.screens) {
      screen.texture?.dispose();
      screen.detail?.texture.dispose();
    }
  }

  /**
   * A channel change: with a show that's on no TV (four shows, three sets), half the time one TV changes over to it;
   * otherwise two TVs swap. Either way they're all still on different shows.
   */
  private switchChannels(): void {
    const offAir = this.shows.map((_, i) => i).filter((i) => !this.screens.some((s) => s.show === i));
    if (offAir.length > 0 && (this.screens.length < 2 || this.random() < 0.5)) {
      const screen = this.screens[Math.floor(this.random() * this.screens.length)]!;
      screen.show = offAir[Math.floor(this.random() * offAir.length)]!;
      this.flick(screen);
      return;
    }
    if (this.screens.length < 2) return;
    const a = Math.floor(this.random() * this.screens.length);
    const b = (a + 1 + Math.floor(this.random() * (this.screens.length - 1))) % this.screens.length;
    const first = this.screens[a]!;
    const second = this.screens[b]!;
    [first.show, second.show] = [second.show, first.show];
    this.flick(first);
    this.flick(second);
  }

  /** Back to the regular shows, each TV to the one it was on. */
  private endSpecial(): void {
    this.special = null;
    this.specialIn = this.between(this.options.special.every);
    this.switchIn = this.nextSwitch();
    for (const screen of this.screens) this.flick(screen);
  }

  /** A channel change on `screen`: snow, then the channel in the corner. */
  private flick(screen: Screen): void {
    screen.static = this.options.staticTime;
    screen.osd = this.options.staticTime + this.options.osdTime;
    screen.sinceFrame = 1;
  }

  private nextSwitch(): number {
    return this.between(this.options.switchEvery);
  }

  private between([min, max]: readonly [number, number]): number {
    return min + this.random() * (max - min);
  }

  private createScreen(material: MeshBasicMaterial, show: number, stagger: number): Screen {
    const screen: Screen = { material, ctx: null, texture: null, show, static: 0, osd: this.options.osdTime, sinceFrame: stagger, detail: null, detailed: false };
    if (typeof document === 'undefined') return screen;
    const canvas = document.createElement('canvas');
    canvas.width = this.options.width;
    canvas.height = this.options.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return screen;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    // Redrawn a dozen times a second: no mipmaps to rebuild each time.
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    material.map = texture;
    material.color.set('#ffffff');
    material.needsUpdate = true;
    return { ...screen, ctx, texture };
  }

  /** A canvas `detailScale` times the usual size, for a close-up. Null without a DOM. */
  private createDetail(): Screen['detail'] {
    if (typeof document === 'undefined') return null;
    const k = this.options.detailScale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(this.options.width * k);
    canvas.height = Math.round(this.options.height * k);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = LinearFilter;
    return { ctx, texture };
  }

  private draw(screen: Screen): void {
    // Close up, the sharp canvas: the same drawing, scaled up (the shows are drawn as shapes, so they stay crisp).
    const sharp = screen.detailed ? screen.detail : null;
    const ctx = sharp?.ctx ?? screen.ctx;
    const texture = sharp?.texture ?? screen.texture;
    if (!ctx || !texture) return;
    if (sharp) ctx.setTransform(this.options.detailScale, 0, 0, this.options.detailScale, 0, 0);
    const { width: W, height: H } = this.options;
    const show = this.special ? this.specialShow : this.shows[screen.show]!;
    if (screen.static > 0) snow(ctx, W, H);
    else show.draw(ctx, W, H, this.special ? this.special.time : this.clocks[screen.show]!);
    crt(ctx, W, H);
    if (screen.osd > 0) channelNumber(ctx, W, show.osd ?? `CH ${String(show.channel).padStart(2, '0')}`);
    texture.needsUpdate = true;
  }
}

/** Between channels: snow, and a band rolling up the picture. */
function snow(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  ctx.fillStyle = '#16161a';
  ctx.fillRect(0, 0, W, H);
  for (let i = 0; i < 420; i++) {
    const v = 90 + Math.floor(Math.random() * 165);
    ctx.fillStyle = `rgb(${v}, ${v}, ${v})`;
    ctx.fillRect(Math.random() * W, Math.random() * H, 2 + Math.random() * 3, 2);
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(0, Math.random() * H, W, 18);
}

/** The channel ("CH 07", or LIVE), green, top right, like an old set's on-screen display. */
function channelNumber(ctx: CanvasRenderingContext2D, W: number, text: string): void {
  ctx.save();
  ctx.font = 'bold 26px "Courier New", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillText(text, W - 14, 14);
  ctx.fillStyle = '#46ff6a';
  ctx.fillText(text, W - 16, 12);
  ctx.restore();
}

/** The living-room wall behind the set and the floor in front, warm and soft (the full-screen view). */
function tvRoom(ctx: CanvasRenderingContext2D, cw: number, ch: number, screenBottom: number): void {
  const floorY = Math.min(ch, screenBottom + ch * 0.14);
  const wall = ctx.createLinearGradient(0, 0, 0, floorY);
  wall.addColorStop(0, '#d9c7a8');
  wall.addColorStop(1, '#c4ad87');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, cw, floorY);
  ctx.fillStyle = '#8f6a48';
  ctx.fillRect(0, floorY, cw, ch - floorY);
  // The dim room round the glow of the screen.
  const dim = ctx.createRadialGradient(cw / 2, ch * 0.42, Math.min(cw, ch) * 0.3, cw / 2, ch * 0.42, Math.max(cw, ch) * 0.75);
  dim.addColorStop(0, 'rgba(20, 14, 10, 0)');
  dim.addColorStop(1, 'rgba(20, 14, 10, 0.45)');
  ctx.fillStyle = dim;
  ctx.fillRect(0, 0, cw, ch);
}

/** The TV round the picture at (x, y, w, h): a dark rounded bezel, its power light, and the stand under it. */
function tvSet(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const b = Math.max(6, w * 0.028);
  const r = b * 1.4;
  // The stand: a low wooden console under it, and the set's own little foot.
  const standY = y + h + b;
  ctx.fillStyle = '#2a2a30';
  ctx.fillRect(x + w * 0.44, standY, w * 0.12, b * 1.6);
  const consoleY = standY + b * 1.6;
  ctx.fillStyle = '#7a5434';
  ctx.fillRect(x - w * 0.08, consoleY, w * 1.16, b * 3.2);
  ctx.fillStyle = '#5e3f26';
  ctx.fillRect(x - w * 0.08, consoleY + b * 3.2, w * 1.16, b * 0.7);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
  ctx.fillRect(x - w * 0.08, consoleY, w * 1.16, b * 0.35);
  // The bezel.
  ctx.beginPath();
  ctx.roundRect?.(x - b, y - b, w + 2 * b, h + 2 * b, r);
  if (!ctx.roundRect) ctx.rect(x - b, y - b, w + 2 * b, h + 2 * b);
  const bezel = ctx.createLinearGradient(0, y - b, 0, y + h + b);
  bezel.addColorStop(0, '#3a3a42');
  bezel.addColorStop(1, '#17171c');
  ctx.fillStyle = bezel;
  ctx.fill();
  ctx.lineWidth = Math.max(1, b * 0.18);
  ctx.strokeStyle = '#0c0c10';
  ctx.stroke();
  // The power light, bottom right.
  ctx.fillStyle = '#46ff6a';
  ctx.beginPath();
  ctx.arc(x + w - b * 0.2, y + h + b * 0.5, Math.max(1.5, b * 0.18), 0, Math.PI * 2);
  ctx.fill();
}

/** Moke from behind, bottom middle, watching: his fluffy white head and two floppy ears (`size` scales him). */
function mokeFromBehind(ctx: CanvasRenderingContext2D, cw: number, ch: number, size: number): void {
  const r = size * 0.1;
  const x = cw / 2;
  const y = ch + r * 0.25;
  ctx.save();
  ctx.fillStyle = '#f6f2ea';
  ctx.strokeStyle = 'rgba(120, 105, 90, 0.55)';
  ctx.lineWidth = Math.max(1, r * 0.05);
  // Ears: soft drops hanging either side.
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(x + side * r * 0.95, y - r * 0.55, r * 0.42, r * 0.75, side * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = '#ece4d6';
    ctx.fill();
    ctx.stroke();
  }
  // The head: a cluster of curly puffs.
  ctx.fillStyle = '#f6f2ea';
  const puffs: readonly (readonly [number, number, number])[] = [[0, -0.9, 0.5], [-0.45, -0.75, 0.45], [0.45, -0.75, 0.45], [-0.6, -0.25, 0.5], [0.6, -0.25, 0.5], [0, -0.3, 0.75]];
  for (const [dx, dy, pr] of puffs) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, pr * r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Fill over the inner outlines so it reads as one fluffy head.
  for (const [dx, dy, pr] of puffs) {
    ctx.beginPath();
    ctx.arc(x + dx * r, y + dy * r, pr * r * 0.86, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

