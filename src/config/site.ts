/**
 * The game's home at www.im-dog.com (im-dog.com redirects there, D26), served by the site Worker (src/feedback/worker.ts, wrangler.jsonc; see
 * docs/FEEDBACK.md). The Feedback form and the player counter only work there, on the same origin as the Worker.
 * Anywhere else (the GitHub Pages copy, a local dev server) the form stays hidden and nothing is counted, unless
 * VITE_FEEDBACK_ENDPOINT points the form somewhere for a local test.
 */
export const SITE = {
  /** The hosts the site Worker serves. */
  hosts: ['www.im-dog.com'] as readonly string[],
} as const;

/** Where the Feedback form posts. */
export const FEEDBACK = {
  endpoint: '/api/feedback',
  /** Seconds "Moke says Thank you!" shows after feedback is sent, before the window closes by itself. */
  thanksSeconds: 2.5,
} as const;

/** The anonymous player counter (usage.ts in the Worker publishes the figures to the "I'M DOG? usage log" Issue). */
export const USAGE = {
  endpoint: '/api/ping',
  /**
   * Seconds of real play (unpaused, PLAY pressed, with Moke moved at least once) before a page counts as a player.
   * The page loading on its own only counts as a visit: bots and link previews do that.
   */
  realPlayAfter: 30,
} as const;
