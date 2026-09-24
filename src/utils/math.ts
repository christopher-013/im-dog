export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

/**
 * Frame-rate independent exponential smoothing toward `target`.
 * `lambda` is responsiveness per second: ~4 is lazy, ~15 is snappy, 30+ is nearly instant.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
