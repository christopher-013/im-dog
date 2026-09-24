import type { Vec3Like } from '../physics/CharacterBody';

/** Every kind of interaction the game knows about. Phase 1 uses PICKUP, DROP and REST. */
export const INTERACTION_TYPES = ['PICKUP', 'DROP', 'REST', 'SNIFF', 'PLAY', 'EAT', 'DRINK', 'INVESTIGATE'] as const;

export type InteractionType = (typeof INTERACTION_TYPES)[number];

/**
 * Something Moke can do something with. Plain data plus a callback: it knows nothing about
 * meshes, input keys or the UI. Fields are read every frame, so implementations can use getters
 * (e.g. `enabled` turns false while the item is being carried).
 */
export interface Interactable {
  /** Unique within the InteractionSystem. */
  readonly id: string;
  readonly type: InteractionType;
  /** Prompt text after the key, e.g. "Pick Up Sock". */
  readonly label: string;
  /** Moke's feet must be within this horizontal distance (m) of `position`. */
  readonly interactionDistance: number;
  readonly enabled: boolean;
  /** World position now. It may move (toys roll). */
  readonly position: Vec3Like;
  /** Must Moke be facing it? Default true. False for things he's holding or standing in. */
  readonly requiresFacing?: boolean;
  /** False for actions on oneself (drop/get up); world targets must have an unobstructed path. */
  readonly requiresClearPath?: boolean;
  /** Higher priority wins over nearer. Default 0. */
  readonly priority?: number;
  /** Do it. Called by InteractionSystem.interact() when this is the current target. */
  interact(): void;
}
