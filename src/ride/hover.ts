import type { RideCar } from '../world/RideCar';

type Hover = NonNullable<RideCar['hover']>;

/** Pure presentation curves shared by the ride and development preview; driven only by game time. */
export function hoverDeployment(time: number, hover: Hover): number {
  return Math.max(0, Math.min(1, (time - hover.wheelDelay) / hover.wheelSeconds));
}

export function hoverAltitude(time: number, hover: Hover): number {
  const k = Math.max(0, Math.min(1, (time - hover.liftDelay) / hover.liftSeconds));
  const lift = k * k * (3 - 2 * k);
  return lift * (hover.height + hover.bob * Math.sin(time * hover.bobRate));
}
