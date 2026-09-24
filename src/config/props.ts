import type { PropPhysics } from '../physics/PropBody';

export type PropId = 'sock';

export interface PropDefinition {
  id: PropId;
  /** Shown in prompts: "Pick Up Sock". */
  name: string;
  physics: PropPhysics;
  /** Resting height of the body's centre on the floor (m), for spawning. */
  restHeight: number;
  /** How it sits in Moke's mouth: offset from the mouth socket (m) and turn about y (rad). */
  carry: { offset: readonly [number, number, number]; turn: number };
}

/**
 * Loose props Moke can pick up or push. Real-world sizes and weights, lightly damped so they
 * settle quickly and stay cheap. Where they start is `LivingRoom.landmarks`.
 */
export const PROPS: Readonly<Record<PropId, PropDefinition>> = {
  sock: {
    id: 'sock',
    name: 'Sock',
    physics: {
      shape: { kind: 'box', halfExtents: [0.035, 0.012, 0.1] },
      mass: 0.05,
      friction: 0.9,
      restitution: 0.05,
      linearDamping: 1.5,
      angularDamping: 3,
      pushable: false,
      maxSpeed: 4,
    },
    restHeight: 0.012,
    // Held crosswise like a real dog carries a sock, dangling a little.
    carry: { offset: [0, -0.03, 0.01], turn: Math.PI / 2 },
  },
};

/** Carrying and dropping. */
export const PICKUP = {
  /** How close Moke's feet must be to pick something up (m). */
  reach: 0.5,
  /** Dropped items appear this far ahead of his feet (m) at this height (m): about where his mouth is. */
  dropForward: 0.26,
  dropHeight: 0.22,
  /** Keep dropped items at least this far (m) from a wall in front of him. */
  dropWallGap: 0.06,
  /** Fraction of Moke's velocity a dropped item keeps. */
  dropCarryVelocity: 0.5,
} as const;
