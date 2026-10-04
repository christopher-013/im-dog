/**
 * World scale: 1 unit = 1 metre. Moke's own size lives in `config/mokeCharacter.ts` (`MOKE_CHARACTER.size`),
 * the one authoritative character scale.
 */

/** Real-world human furniture sizes, so the room towers over Moke the way it should. */
export const HOUSE_SCALE = {
  ceilingHeight: 2.6,
  couchSeatHeight: 0.45,
  couchBackHeight: 0.88,
  coffeeTableHeight: 0.45,
} as const;

/** The TVs (world/tv/TvChannels.ts): three shows on three sets, swapping channels now and then. */
export const TV = {
  /** Each set's picture (px, 16:9 like the screens), and how often a new frame is drawn (fps: a dozen, "on twos" like old cel animation, and cheap to upload). */
  width: 384,
  height: 216,
  fps: 12,
  /** Seconds (min, max) between two sets swapping channels. */
  switchEvery: [18, 40] as const,
  /** Snow between channels (s), then how long the channel number shows in the corner (s). */
  staticTime: 0.45,
  osdTime: 2,
  /**
   * The easter egg: a special broadcast (the World Series, world/tv/WorldSeries.ts) takes over every TV at once, the
   * first time this long into the game (s, min…max), then again every so often.
   */
  special: { firstAfter: [90, 240] as const, every: [360, 720] as const },
  /** Close up (Moke watching the game, the camera on the screen): that TV draws this many times sharper. */
  detailScale: 2.5,
} as const;
