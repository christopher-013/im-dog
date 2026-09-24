import type { Object3D } from 'three';
import type { MokeAnimationState } from './MokeAnimationController';
import { PlaceholderDogVisual } from './PlaceholderDogVisual';

/**
 * Everything a Moke visual must provide. Only `Moke` drives it; movement, camera, physics and
 * (later) interactions never touch it, so the placeholder can be swapped for moke.glb freely.
 */
export interface MokeVisual {
  /** Root object. `Moke` places it at the feet position and facing; local +z is forward. */
  readonly object: Object3D;
  /** Where carried items attach (Milestone 6). */
  readonly mouthSocket: Object3D;
  update(dt: number, animation: Readonly<MokeAnimationState>): void;
  dispose(): void;
}

/**
 * The single place that decides which visual Moke gets. When moke.glb exists, check the asset
 * manager here and return a glTF-based visual, keeping the placeholder as the fallback.
 */
export function createMokeVisual(): MokeVisual {
  return new PlaceholderDogVisual();
}
