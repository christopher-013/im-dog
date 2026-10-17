import { HUMAN } from '../config/human';
import { HOUSEHOLD_LOOK, HOUSEHOLD_WOMAN_LOOK, type HumanLook } from './StylizedHumanVisual';

/** The two people who can live in the house; one of them is home each visit. */
export type HouseholdId = 'man' | 'woman';
export const HOUSEHOLD: Readonly<Record<HouseholdId, HumanLook>> = { man: HOUSEHOLD_LOOK, woman: HOUSEHOLD_WOMAN_LOOK };
const IDS = Object.keys(HOUSEHOLD) as HouseholdId[];

/** Where the round is kept between visits (localStorage, or nothing in a private window). */
export type HouseholdStorage = Pick<Storage, 'getItem' | 'setItem'> | null;

/**
 * Who's home this visit. Random, but even over time: a round holds each of them `HUMAN.household.perRound` times,
 * shuffled, and each visit takes the next one, so over any full round they're home equally often and neither is ever
 * home more than twice that in a row. Without storage (private browsing) it's a fair coin each visit.
 */
export function pickHousehold(storage: HouseholdStorage, random: () => number = Math.random): HouseholdId {
  const { key, perRound } = HUMAN.household;
  let round: HouseholdId[] = [];
  try {
    const saved: unknown = JSON.parse(storage?.getItem(key) ?? '[]');
    if (Array.isArray(saved)) round = saved.filter((id): id is HouseholdId => IDS.includes(id));
  } catch {
    round = [];
  }
  if (round.length === 0) {
    round = IDS.flatMap((id) => Array<HouseholdId>(perRound).fill(id));
    for (let i = round.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [round[i], round[j]] = [round[j]!, round[i]!];
    }
  }
  const next = round.shift()!;
  try {
    storage?.setItem(key, JSON.stringify(round));
  } catch {
    // Storage is full or blocked: this visit is still somebody's.
  }
  return next;
}
