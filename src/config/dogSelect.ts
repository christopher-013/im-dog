/**
 * Choose Your Dog (owner request, 2026-10-16): the screen between PLAY and the game. Tunable numbers only.
 */
export const DOG_SELECT = {
  /** The words on screen (always shown, spoken or not). */
  title: 'CHOOSE YOUR DOG',
  begin: 'BEGIN!',
  /** How long "BEGIN!" stays over the game once play starts (s). */
  beginCaption: 1.4,
  /** A swipe on the dogs: at least this far sideways (CSS px), and more sideways than up or down. */
  swipeMin: 40,
  /** The 3D preview: the dogs this far apart (m), the highlighted one this much bigger, the others this much smaller. */
  spacing: 0.62,
  highlightScale: 1.18,
  restScale: 0.9,
  /** The highlighted dog steps forward, the others stand back (m), for a little depth. */
  litForward: 0.1,
  restBack: -0.22,
  /** A narrow screen (a phone upright: width/height below `below`): the dogs closer together, so they're bigger. */
  narrow: { below: 0.8, spacing: 0.48, margin: 0.3 },
  /** How quickly they slide and grow into place (1/s). */
  ease: 9,
  /** The highlighted dog's playful hop: every this many seconds (min, random extra), this high (m), this long (s). */
  hopEvery: [2.6, 2.2] as const,
  hopHeight: 0.07,
  hopTime: 0.42,
  /** A happy little bark now and then (s, min + random extra). */
  barkEvery: [5, 4] as const,
  /** Camera: field of view (deg), looking at this height (m); it backs off until every dog fits with this margin. */
  fov: 28,
  lookHeight: 0.24,
  margin: 0.34,
  /**
   * Shares of the screen height kept clear for the name card below and the title above (0..1); the dogs need this
   * much height (m, half of it) in the space between.
   */
  cardShare: 0.34,
  titleShare: 0.2,
  halfHeight: 0.33,
  background: '#f6e7d2',
  floor: '#ead3b4',
  spotlight: '#fff2d6',
} as const;

/**
 * The announcer's delivery: the browser's own speech voice, pitched down and slowed for a deep, theatrical,
 * friendly arcade feel. Voices whose names contain these (lower case) are preferred, in order; otherwise the
 * default English voice. Original lines; no recordings, no imitation of anyone's voice.
 */
export const ANNOUNCER = {
  choose: 'Choose your dog!',
  begin: 'Begin!',
  /** Called out as a dog is picked (an arrow, a swipe, a click or tap on them): "Moke!", "Dougie!". */
  dogName: (name: string) => `${name}!`,
  /** No line runs longer than this (s): if the browser never says one ended, the music comes back up anyway. */
  longestLine: 3,
  pitch: 0.3,
  rate: 0.78,
  volume: 1,
  lang: 'en-US',
  preferredVoices: ['english male', 'daniel', 'david', 'guy', 'arthur', 'george', 'fred', 'alex'] as readonly string[],
} as const;
