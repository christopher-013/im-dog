import { DOUGIE_LOOK, MOKE_DOG_LOOK, NORI_LOOK, type DogLook } from './dogLooks';

/**
 * The playable dogs (owner request, 2026-10-16; D29): Moke, Dougie and Nori. Every dog plays exactly the same: one
 * controller, one body size (MOKE_CHARACTER.size), the same activities, FSD and input. What differs is only
 * presentation, here: the name the game and the human use, the look, and where their own Dog Logic progress is saved.
 */
export type DogId = 'moke' | 'dougie' | 'nori';

export interface DogProfile {
  readonly id: DogId;
  /** As the game and the human say it. */
  readonly name: string;
  /** The name called out in two sing-song notes ("Mo-ke~"). */
  readonly called: string;
  /** One line under the name on the Choose Your Dog screen. */
  readonly tagline: string;
  readonly look: DogLook;
  /**
   * Where this dog's Dog Logic discoveries are remembered (localStorage). Moke keeps the key the game has always
   * used, so existing players' progress stays exactly where it is (no migration needed); other dogs get their own.
   */
  readonly logicKey: string;
  /** Uses the optional final model (`moke.glb`) when it's installed; otherwise the procedural toon visual. */
  readonly usesModel: boolean;
}

/** In the order they stand on Choose Your Dog: Moke in the middle (and highlighted first: DEFAULT_DOG). */
export const DOGS: readonly DogProfile[] = [
  {
    id: 'dougie',
    name: 'Dougie',
    called: 'Dou-gie',
    tagline: 'Fluffy, tri-coloured and always cheerful',
    look: DOUGIE_LOOK,
    logicKey: 'imdog.dogLogic.dougie',
    usesModel: false,
  },
  {
    id: 'moke',
    name: 'Moke',
    called: 'Mo-ke',
    tagline: 'Small, white and very curious',
    look: MOKE_DOG_LOOK,
    logicKey: 'imdog.dogLogic',
    usesModel: true,
  },
  {
    id: 'nori',
    name: 'Nori',
    called: 'No-ri',
    tagline: 'Curly, apricot and full of bounce',
    look: NORI_LOOK,
    logicKey: 'imdog.dogLogic.nori',
    usesModel: false,
  },
];

/** Every visit starts as Moke: the title shows him, and Choose Your Dog opens with him highlighted. */
export const DEFAULT_DOG: DogId = 'moke';

export function isDogId(value: unknown): value is DogId {
  return DOGS.some((dog) => dog.id === value);
}

export function dogById(id: DogId): DogProfile {
  return DOGS.find((dog) => dog.id === id) ?? DOGS.find((dog) => dog.id === DEFAULT_DOG)!;
}

/**
 * A player-facing line for the dog being played: the game's lines are written for Moke, so "Moke", "MOKE" and the
 * called-out "Mo-ke" become the chosen dog's name. Lines about the real Moke (the About page, the title) don't go
 * through here. Unchanged when Moke is playing.
 */
export function dogText(text: string, dog: DogProfile): string {
  if (dog.id === 'moke') return text;
  return text
    .replace(/Mo-ke/g, dog.called)
    .replace(/\bMOKE\b/g, dog.name.toUpperCase())
    .replace(/\bMoke\b/g, dog.name);
}
