/**
 * Seasonal content (Phase 6, D30): built in and switched on by the calendar, never fetched. Months are 1–12 and the
 * window includes both ends, in the player's own local time.
 */
export const HALLOWEEN = {
  from: { month: 10, day: 17 },
  to: { month: 11, day: 1 },
} as const;

/** The pause screen's Halloween choices: by the date, always, or never. */
export const HALLOWEEN_CHOICES = ['auto', 'on', 'off'] as const;
export type HalloweenChoice = (typeof HALLOWEEN_CHOICES)[number];

/** Is `date` inside the Halloween window (17 October – 1 November, any year)? */
export function isHalloweenDate(date: Date): boolean {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  return md >= HALLOWEEN.from.month * 100 + HALLOWEEN.from.day && md <= HALLOWEEN.to.month * 100 + HALLOWEEN.to.day;
}

/** Whether Halloween is on: the player's choice, or the calendar for 'auto'. */
export function halloweenOn(choice: HalloweenChoice, now: Date = new Date()): boolean {
  return choice === 'on' || (choice === 'auto' && isHalloweenDate(now));
}
