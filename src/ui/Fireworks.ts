/**
 * Fireworks on a canvas over the game (Liam's Obstacle Course done, Phase 5): rockets go up, burst into rings of
 * sparks that fall and fade. Plain 2D canvas, no assets. With reduced motion asked for, a few gentle bursts and no
 * rockets. Stops by itself; `stop()` clears it at once.
 */
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  rocket: boolean;
}

const COLORS = ['#ff5a36', '#ffc81f', '#17b8a6', '#ff5fa8', '#3fa9ff', '#fff4c2', '#9b5cff'];

export class Fireworks {
  private sparks: Spark[] = [];
  private frame = 0;
  private last = 0;
  private left = 0;
  private nextLaunch = 0;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly random: () => number = Math.random,
  ) {}

  get running(): boolean {
    return this.frame !== 0;
  }

  /** Launches for `seconds`, then lets the last sparks fall. */
  start(seconds: number): void {
    this.stop();
    this.left = seconds;
    this.nextLaunch = 0;
    this.last = performance.now();
    this.resize();
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  stop(): void {
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.sparks = [];
    this.canvas.getContext('2d')?.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private resize(): void {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const w = this.canvas.clientWidth || window.innerWidth;
    const h = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(w * ratio);
    this.canvas.height = Math.round(h * ratio);
  }

  private tick(now: number): void {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.left -= dt;
    const { width: w, height: h } = this.canvas;
    const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.nextLaunch -= dt;
    if (this.left > 0 && this.nextLaunch <= 0) {
      this.nextLaunch = calm ? 0.9 : 0.22 + this.random() * 0.3;
      const x = w * (0.15 + this.random() * 0.7);
      if (calm) this.burst(x, h * (0.2 + this.random() * 0.25), 30);
      else this.sparks.push({ x, y: h, vx: (this.random() - 0.5) * w * 0.08, vy: -h * (0.95 + this.random() * 0.35), life: 0, max: 0.75 + this.random() * 0.25, color: '#fff3d6', size: 4, rocket: true });
    }
    const g = h * 0.55;
    const next: Spark[] = [];
    // New bursts go into a fresh list (they start moving next frame).
    const current = this.sparks;
    this.sparks = [];
    for (const s of current) {
      s.life += dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vy += (s.rocket ? g * 0.6 : g * 0.35) * dt;
      if (!s.rocket) {
        s.vx *= 1 - 1.4 * dt;
        s.vy *= 1 - 1.4 * dt;
      }
      if (s.life < s.max) next.push(s);
      else if (s.rocket) this.burst(s.x, s.y, 60 + Math.floor(this.random() * 30));
    }
    this.sparks = next.concat(this.sparks);
    const ctx = this.canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, w, h);
      const ratio = w / Math.max(1, this.canvas.clientWidth || w);
      ctx.lineCap = 'round';
      for (const s of this.sparks) {
        const fade = 1 - s.life / s.max;
        ctx.globalAlpha = s.rocket ? 1 : Math.min(1, Math.max(0, fade * 1.4));
        ctx.strokeStyle = s.color;
        // A short streak behind each spark (longer while it's fast), thinning as it fades.
        ctx.lineWidth = s.size * ratio * (s.rocket ? 1 : 0.6 + fade * 0.8);
        ctx.beginPath();
        ctx.moveTo(s.x - s.vx * 0.045, s.y - s.vy * 0.045);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (this.left > 0 || this.sparks.length > 0) this.frame = requestAnimationFrame((t) => this.tick(t));
    else this.stop();
  }

  private burst(x: number, y: number, count: number): void {
    const color = COLORS[Math.floor(this.random() * COLORS.length)]!;
    const second = COLORS[Math.floor(this.random() * COLORS.length)]!;
    const speed = this.canvas.height * (0.28 + this.random() * 0.12);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + this.random() * 0.1;
      const v = speed * (0.75 + this.random() * 0.3);
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 1.1 + this.random() * 0.6, color: i % 3 ? color : second, size: 4.2, rocket: false });
    }
  }
}
