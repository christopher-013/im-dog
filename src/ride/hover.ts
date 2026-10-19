import type { RideCar } from '../world/RideCar';
import { smooth } from './coastRoute';

type Hover = NonNullable<RideCar['hover']>;

/** Pure presentation curves shared by the ride and development preview; driven only by game time. */
export function hoverDeployment(time: number, hover: Hover): number {
  return Math.max(0, Math.min(1, (time - hover.wheelDelay) / hover.wheelSeconds));
}

export function hoverAltitude(time: number, hover: Hover): number {
  const lift = smooth(hover.liftDelay, hover.liftDelay + hover.liftSeconds, time);
  return lift * (hover.height + hover.bob * Math.sin(time * hover.bobRate));
}
