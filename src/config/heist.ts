/**
 * Sock Heist: what the human says, and the heist's own timing. Lines are short on purpose: the joke is the
 * situation, not the dialogue. Several per moment, picked at random, so replays don't repeat word for word.
 */
export const HEIST_LINES = {
  noticed: ['Moke! Is that my sock?!', 'Hey! That\'s my sock!', 'Moke… drop it.'],
  noticedAgain: ['Again?!', 'Not again, Moke!', 'MOKE.'],
  chase: ['Come here, you!', 'Moke, give it!', 'Get back here!'],
  lunge: ['Gotcha—', 'Got y—'],
  missed: ['…nope.', 'Whoa!', 'So close!', 'How is he so fast?'],
  cantReach: ['Come out of there!', 'Oh, come ON.'],
  lost: ['Where did he go…?', 'Moke…?', 'Hmm…'],
  found: ['There you are!', 'Aha!'],
  giveUp: ['Okay. New plan.', 'Fine. You win… for now.'],
  treatReady: ['Treat time!', 'Who wants a treat?'],
  offer: ['Moke! Trade you: sock for a treat?', 'Treat? Just give me the sock…'],
  call: ['Mo-ke~', 'Moke! Treeeat!', 'Come on, buddy!'],
  sockFirst: ['Sock first, buddy.', 'Nope. Sock first.'],
  thanks: ['Thank you!', 'Good boy!'],
  sockBack: ['Got it!', 'Mine. Thank you.'],
  closeEnough: ['…close enough. Good boy!', 'A deal\'s a deal!'],
} as const;

export type HeistLine = keyof typeof HEIST_LINES;

export const HEIST = {
  /** Seconds the SOCK = TREAT card shows before "Sock Heist Complete". */
  discoveryTime: 3.4,
  /** The Dog Logic entry this heist teaches (Phase 4 builds on it). */
  dogLogicId: 'sock=treat',
  /** Eating the treat. */
  eatTime: 1.4,
  /** Moke can eat a placed treat from this far (m). */
  eatReach: 0.6,
  /**
   * Putting the treat down toward Moke: a small ball (radius, height above the floor) swept from the human's feet;
   * the treat stops this far short of any furniture it meets (m).
   */
  treatSweep: { radius: 0.06, height: 0.05, margin: 0.03 },
} as const;
