import type { HumanPose, HumanProp } from '../human/HumanRig';
import type { PlaceKind } from '../world/home/places';

/** The human's daily-life activities (Phase 4). Add one here and the routine picks it up: no code needed. */
export type HumanActivityId =
  | 'watchTV'
  | 'readBook'
  | 'usePhone'
  | 'sitAtDiningTable'
  | 'prepareDinner'
  | 'mealPrep'
  | 'eatMeal'
  | 'relaxOnCouch'
  | 'standAtKitchenCounter'
  | 'foldLaundry';

/** One part of an activity: where (a kind of place), doing what, for how long. */
export interface ActivityStep {
  /** The kinds of place this can happen at; the nearest free one is used. */
  readonly places: readonly PlaceKind[];
  readonly pose: HumanPose;
  readonly prop?: HumanProp;
  /** How long (s): a random time in [min, max]. */
  readonly seconds: readonly [number, number];
  /** Look at the place's focus (the TV) rather than about the room. */
  readonly lookAtFocus?: boolean;
  /** Something the game shows or smells while this step runs. */
  readonly effect?: 'cooking' | 'meal' | 'tv' | 'prep';
}

/** How they respond when Moke wants attention. */
export type Interruptible = 'always' | 'sometimes' | 'rarely';

export interface HumanActivityDef {
  readonly id: HumanActivityId;
  /** For debugging and docs: "watching TV". */
  readonly name: string;
  readonly steps: readonly ActivityStep[];
  /** Base chance of being picked, relative to the others. */
  readonly weight: number;
  /** Seconds before it can be picked again. */
  readonly cooldown: number;
  readonly interruptible: Interruptible;
  /** 0..1: how often they look up and round the room (and notice Moke) while doing it. */
  readonly attention: number;
  /** Much more likely straight after this one (dinner after cooking). */
  readonly follows?: { readonly after: HumanActivityId; readonly bonus: number };
  /** Only possible within this many seconds after that activity was done (no dinner without cooking it). */
  readonly requires?: { readonly after: HumanActivityId; readonly within: number };
  /** A line now and then as it starts (not every time). */
  readonly lines?: readonly string[];
}

const SEATS: readonly PlaceKind[] = ['couchSeat', 'readingSeat'];

/** The routine's activities. Durations are "believable, not simulated": a few minutes of TV, not an hour. */
export const HUMAN_ACTIVITIES: readonly HumanActivityDef[] = [
  {
    id: 'watchTV',
    name: 'watching TV',
    steps: [{ places: ['couchSeat'], pose: 'watch', prop: 'remote', seconds: [45, 90], lookAtFocus: true, effect: 'tv' }],
    weight: 3,
    cooldown: 150,
    interruptible: 'always',
    attention: 0.3,
    lines: ['Ooh, this one again.', 'Just one episode…'],
  },
  {
    id: 'readBook',
    name: 'reading',
    steps: [{ places: ['readingSeat', 'couchSeat'], pose: 'read', prop: 'book', seconds: [40, 80] }],
    weight: 2.5,
    cooldown: 150,
    interruptible: 'sometimes',
    attention: 0.2,
  },
  {
    id: 'usePhone',
    name: 'on the phone',
    steps: [{ places: ['stool', 'couchSeat', 'readingSeat', 'diningChair'], pose: 'phone', prop: 'phone', seconds: [20, 40] }],
    weight: 2,
    cooldown: 90,
    interruptible: 'always',
    attention: 0.35,
  },
  {
    id: 'sitAtDiningTable',
    name: 'coffee at the table',
    steps: [{ places: ['diningChair'], pose: 'sip', prop: 'mug', seconds: [30, 55] }],
    weight: 1.6,
    cooldown: 150,
    interruptible: 'always',
    attention: 0.5,
  },
  {
    id: 'prepareDinner',
    name: 'making dinner',
    steps: [
      { places: ['fridge'], pose: 'fridge', seconds: [3, 5] },
      { places: ['islandPrep'], pose: 'prep', prop: 'knife', seconds: [30, 45], effect: 'prep' },
      { places: ['stove'], pose: 'cook', prop: 'spoon', seconds: [18, 28], effect: 'cooking' },
    ],
    weight: 1.8,
    cooldown: 300,
    interruptible: 'sometimes',
    attention: 0.4,
    lines: ['Dinner time…', 'What should I make?'],
  },
  {
    id: 'mealPrep',
    name: 'chopping vegetables at the island',
    steps: [{ places: ['islandPrep'], pose: 'prep', prop: 'knife', seconds: [35, 55], effect: 'prep' }],
    weight: 2.2,
    cooldown: 120,
    interruptible: 'sometimes',
    attention: 0.4,
    lines: ['Chopping some carrots for dinner…'],
  },
  {
    id: 'eatMeal',
    name: 'eating dinner',
    steps: [{ places: ['diningChair'], pose: 'eat', prop: 'fork', seconds: [25, 45], effect: 'meal' }],
    weight: 1,
    cooldown: 300,
    interruptible: 'sometimes',
    attention: 0.45,
    follows: { after: 'prepareDinner', bonus: 60 },
    requires: { after: 'prepareDinner', within: 420 },
  },
  {
    id: 'relaxOnCouch',
    name: 'relaxing',
    steps: [{ places: SEATS, pose: 'relax', seconds: [20, 40] }],
    weight: 1.4,
    cooldown: 100,
    interruptible: 'always',
    attention: 0.5,
  },
  {
    id: 'standAtKitchenCounter',
    name: 'a coffee at the counter',
    steps: [{ places: ['kitchenCounter', 'sink'], pose: 'sip', prop: 'mug', seconds: [12, 25] }],
    weight: 1.3,
    cooldown: 90,
    interruptible: 'always',
    attention: 0.6,
  },
  {
    id: 'foldLaundry',
    name: 'folding laundry',
    steps: [{ places: ['laundry'], pose: 'fold', prop: 'laundry', seconds: [30, 60] }],
    weight: 2.2,
    cooldown: 150,
    interruptible: 'always',
    // As in the Sock Heist: folding, with a look round the room every few seconds.
    attention: 0.75,
  },
];

/** How the human responds to Moke (M4.5). Distances in metres, times in seconds. */
export const MOKE_REACTIONS = {
  /** Glance at him when he's this close and in view. */
  lookRange: 2.6,
  /** "Hi, buddy." when he comes this close after being away (further than awayRange) this long. */
  greetRange: 1.8,
  awayRange: 5,
  greetAfterAway: 40,
  /** Barks carry this far; this many within barkWindow, this close, and they give him their attention. */
  hearing: 7,
  barkWindow: 8,
  barksToAttend: 3,
  attendRange: 4.5,
  /** Praise a trick done this close. */
  praiseRange: 3.2,
  /** Pats: he's within reach; sitting by them this long and they reach down on their own. */
  petReach: 1.0,
  nearRange: 1.1,
  spontaneousPetAfter: 4,
  durations: { look: 1.8, greet: 2.2, answerBark: 1.8, attend: 5, praise: 2.2, pet: 3.8, gesture: 1.6 },
  /** Petting, standing: step over to him at this pace, and kneel once within this distance (m). */
  petApproachSpeed: 0.7,
  petKneelWithin: 0.5,
  cooldowns: { look: 12, greet: 60, answerBark: 6, attend: 25, praise: 10, pet: 10, gesture: 0 },
  /**
   * How much of them turns to Moke (0.3: eyes and a little head … 1: head and upper body; standing, they turn round
   * to face him if he's behind them for anything more than a glance).
   */
  weights: { look: 0.3, greet: 0.65, answerBark: 0.5, attend: 1, praise: 0.85, pet: 1, gesture: 0.8 },
  /**
   * Not a security camera: a glance when he turns up (after this long out of range), otherwise only now and then
   * (this chance per second, times how much the activity leaves them free to look about).
   */
  noticeAfterAway: 4,
  glanceChance: 0.1,
  /** Moke this far behind them (rad off their facing) and they turn round to him, if standing and he's calling. */
  turnToBeyond: 1.3,
  /** Lines are rare: at most one every this many seconds, and only sometimes. */
  lineGap: 7,
  lineChance: 0.5,
} as const;

/**
 * Moke's bowls: how close he must be to eat or drink, and the human's refill errand (after he empties one, they come
 * and fill it: fetch from the kitchen, carry it over, kneel and pour). Seconds and metres.
 */
export const BOWL_REFILL = {
  /** Moke's feet within this of a bowl to eat or drink from it. */
  reach: 0.5,
  /** After a bowl's emptied, they come this long after (as soon as they're free); busy, they try again this often. */
  delay: 3,
  retry: 4,
  walkTimeout: 40,
  /** Getting the kibble or the water at the kitchen. */
  fetchTime: 1.6,
  /** Kneeling at the bowl: poured this far in, done at pourTime; the hand this high over the bowl. */
  pourAt: 0.9,
  pourTime: 2.2,
  pourHeight: 0.17,
} as const;

/** The routine's timing. */
export const ROUTINE = {
  /** A breather between activities, standing (s). Keeps them from flitting about. */
  pause: [1.5, 4] as const,
  /** Places in the room they're in are this much more likely; far ones fade (weight × 1 / (1 + distance / falloff)). */
  sameRoomBonus: 1.5,
  distanceFalloff: 9,
  /** Walking somewhere for longer than this, or stuck this long, and they give up on it (and try something else). */
  walkTimeout: 45,
  stuckTimeout: 4,
  /** A place counts as taken if Moke is this close to where they'd sit or stand (m). */
  occupiedRadius: 0.45,
  /** Glancing round the room while busy: every so often (s, scaled down by an activity's attention), for this long. */
  glanceEvery: [5, 8] as const,
  glanceTime: 2.2,
  /** How far a look round the room turns (rad, at attention 0 … 1), and how much of them it moves (see HumanIntent). */
  glanceAngle: [0.55, 1.3] as const,
  glanceWeight: 0.45,
  /** Looking at what they're doing (the TV): head and eyes on it, the body already faces it. */
  focusWeight: 0.55,
  /** Sitting, the next activity often happens in the same seat (a book after the TV): this often, this many times running. */
  carryOnChance: 0.5,
  carryOnMax: 2,
  /** How often a start line is said (0..1). */
  lineChance: 0.35,
} as const;
