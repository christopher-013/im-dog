/**
 * Dog Logic (Phase 4): the things Moke works out about the world, each backed by something he actually did. Shown
 * as a little equation the first time ("Moke has learned something very important"), and again, checked, later.
 */
export type DogLogicIcon = 'sock' | 'treat' | 'nose' | 'bed' | 'sun' | 'soft' | 'human' | 'ball' | 'toy' | 'kitchen' | 'food' | 'bark' | 'heart' | 'nap' | 'play';

export interface DogLogicTerm {
  readonly word: string;
  readonly icon: DogLogicIcon;
}

export interface DogLogicEntry {
  readonly id: string;
  /** Left of the "=": one or two things. */
  readonly left: readonly DogLogicTerm[];
  readonly right: DogLogicTerm;
  /** How he learns it (docs and the pause screen). */
  readonly how: string;
}

const T = {
  sock: { word: 'SOCK', icon: 'sock' },
  treat: { word: 'TREAT', icon: 'treat' },
  sniff: { word: 'SNIFF', icon: 'nose' },
  bed: { word: 'BED', icon: 'bed' },
  sun: { word: 'SUN', icon: 'sun' },
  soft: { word: 'SOFT', icon: 'soft' },
  nap: { word: 'NAP', icon: 'nap' },
  human: { word: 'HUMAN', icon: 'human' },
  ball: { word: 'BALL', icon: 'ball' },
  toy: { word: 'TOY', icon: 'toy' },
  play: { word: 'PLAY', icon: 'play' },
  bark: { word: 'BARK', icon: 'bark' },
  attention: { word: 'ATTENTION', icon: 'heart' },
  kitchen: { word: 'KITCHEN', icon: 'kitchen' },
  food: { word: 'FOOD?', icon: 'food' },
} as const satisfies Record<string, DogLogicTerm>;

export const DOG_LOGIC: readonly DogLogicEntry[] = [
  { id: 'sock=treat', left: [T.sock], right: T.treat, how: 'Trade the sock for a treat (Sock Heist).' },
  { id: 'sniff=treat', left: [T.sniff], right: T.treat, how: 'Sniff out a hidden treat (Treat Hunt).' },
  { id: 'bed=nap', left: [T.bed], right: T.nap, how: 'Nap in his bed or on his blanket.' },
  { id: 'sun+soft=nap', left: [T.sun, T.soft], right: T.nap, how: 'Nap somewhere sunny and soft.' },
  { id: 'human+ball=play', left: [T.human, T.ball], right: T.play, how: 'Get the human to throw the ball.' },
  { id: 'human+toy=play', left: [T.human, T.toy], right: T.play, how: 'Get the human to throw the rope toy.' },
  { id: 'bark=attention', left: [T.bark], right: T.attention, how: 'Bark at the human until they give in.' },
  { id: 'kitchen=food?', left: [T.kitchen], right: T.food, how: 'Hang about the kitchen while dinner cooks.' },
];

export function dogLogicEntry(id: string): DogLogicEntry | undefined {
  return DOG_LOGIC.find((entry) => entry.id === id);
}
