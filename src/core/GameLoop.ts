import type { WebGLRenderer } from 'three';
import { TIMING } from '../config/engine';

/**
 * Fixed-timestep accumulator. Gameplay and physics advance in constant steps whatever the
 * display refresh rate (60/120/144 Hz), so movement feels identical on every machine.
 */
export class FixedStep {
  private accumulator = 0;

  constructor(
    readonly step: number = TIMING.fixedStep,
    private readonly maxStepsPerFrame: number = TIMING.maxStepsPerFrame,
  ) {}

  /**
   * Adds `elapsed` seconds and runs `tick(step)` as many whole steps as fit.
   * Returns the leftover fraction of a step (0..1) for interpolating visuals between steps.
   */
  advance(elapsed: number, tick: (step: number) => void): number {
    this.accumulator += Math.max(0, elapsed);
    let steps = 0;
    // Epsilon absorbs float drift so e.g. three 1/60 s frames always yield exactly three steps.
    while (this.accumulator + 1e-9 >= this.step && steps < this.maxStepsPerFrame) {
      tick(this.step);
      this.accumulator -= this.step;
      steps++;
    }
    // Still behind after the cap: drop the backlog rather than spiral into ever-longer frames.
    if (this.accumulator >= this.step) this.accumulator %= this.step;
    return Math.max(0, this.accumulator / this.step);
  }
}

/** Drives `onFrame(dt)` from the browser's animation loop with a clamped delta in seconds. */
export class GameLoop {
  private lastTime = -1;

  constructor(
    private readonly renderer: WebGLRenderer,
    private readonly onFrame: (dt: number, elapsed: number) => void,
    private readonly maxFrameDelta: number = TIMING.maxFrameDelta,
  ) {}

  start(): void {
    this.lastTime = -1;
    this.renderer.setAnimationLoop(this.tick);
  }

  stop(): void {
    this.renderer.setAnimationLoop(null);
  }

  private readonly tick = (time: number): void => {
    const elapsed = this.lastTime < 0 ? 0 : Math.max(0, (time - this.lastTime) / 1000);
    const dt = Math.min(elapsed, this.maxFrameDelta);
    this.lastTime = time;
    this.onFrame(dt, elapsed);
  };
}
