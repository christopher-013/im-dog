import type { PropPhysics } from '../physics/PropBody';

export type PropId = 'sock' | 'ball' | 'toy';

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
    carry: { offset: [0, -0.012, 0], turn: Math.PI / 2 },
  },
  ball: {
    id: 'ball',
    name: 'Tennis Ball',
    physics: {
      shape: { kind: 'ball', radius: 0.033 },
      mass: 0.057,
      friction: 0.7,
      restitution: 0.55,
      // Rolls a good way on floorboards, but always comes to rest.
      linearDamping: 0.35,
      angularDamping: 0.8,
      pushable: true,
      maxSpeed: 4.5,
    },
    restHeight: 0.033,
    carry: { offset: [0, -0.024, 0.006], turn: 0 },
  },
  toy: {
    id: 'toy',
    name: 'Rope Toy',
    physics: {
      shape: { kind: 'capsule', radius: 0.03, halfLength: 0.09 },
      mass: 0.12,
      friction: 0.9,
      restitution: 0.15,
      linearDamping: 1.2,
      angularDamping: 2,
      pushable: true,
      maxSpeed: 3.5,
    },
    restHeight: 0.03,
    carry: { offset: [0, -0.014, 0.002], turn: Math.PI / 2 },
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
