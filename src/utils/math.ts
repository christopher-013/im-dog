export const TAU = Math.PI * 2;

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Hermite ease between two edges: 0 at or below `edge0`, 1 at or above `edge1`. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

/** Moves `current` toward `target` by at most `maxDelta`, never overshooting. */
export function moveToward(current: number, target: number, maxDelta: number): number {
  const delta = target - current;
  if (Math.abs(delta) <= maxDelta) return target;
  return current + Math.sign(delta) * maxDelta;
}

/**
 * Frame-rate independent exponential smoothing toward `target`.
 * `lambda` is responsiveness per second: ~4 is lazy, ~15 is snappy, 30+ is nearly instant.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Wraps an angle (radians) into [-π, π). */
export function wrapAngle(angle: number): number {
  return ((((angle + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

/** Shortest signed rotation (radians) from `from` to `to`, in [-π, π). */
export function angleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}
