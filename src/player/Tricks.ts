import { MOKE_ANIMATION } from '../config/animation';

/**
 * Moke's tricks (Q / controller X), all things a small dog really does:
 * - `bellyUp`: lies down and rolls onto his back, paws curled up, wiggling for a belly rub;
 * - `beg`: stands up on his hind legs with his front paws paddling;
 * - `paw`: sits and offers a paw to shake, with a head tilt;
 * - `spin`: chases his tail round in one quick circle.
 */
export const TRICKS = ['bellyUp', 'beg', 'paw', 'spin'] as const;
export type Trick = (typeof TRICKS)[number];

/** What decides which tricks make sense right now. */
export interface TrickContext {
  /** Something in his mouth: no rolling over on it. */
  carrying: boolean;
  /** Free space above his feet (m): no standing up under the furniture. */
  headroom: number;
}

/** The tricks he can do right now. */
export function availableTricks({ carrying, headroom }: TrickContext): Trick[] {
  return TRICKS.filter(
    (trick) => !(trick === 'bellyUp' && carrying) && !(trick === 'beg' && headroom < MOKE_ANIMATION.tricks.begHeadroom),
  );
}

/** A random trick he can do right now, not the same as the last one when there's a choice. */
export function pickTrick(random: () => number, last: Trick | null, context: TrickContext): Trick | null {
  const options = availableTricks(context);
  const fresh = options.length > 1 ? options.filter((trick) => trick !== last) : options;
  if (fresh.length === 0) return null;
  return fresh[Math.min(fresh.length - 1, Math.floor(random() * fresh.length))]!;
}
