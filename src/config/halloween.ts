/**
 * Halloween (Phase 6, D30): the trick-or-treaters at the front door, the pumpkin biscuit, the decorations. When it's
 * on is `config/seasons.ts`. Metres and seconds; game coordinates (x east, z south).
 */
export const HALLOWEEN_VISIT = {
  /** Holding the candy bowl out at the open door while they pick (longer than the courier's handover). */
  exchangeTime: 3.4,
  lines: {
    coming: 'Trick-or-treaters! Coming, Moke!',
    atDoor: '“Trick or treat!” Happy Halloween, kids! Love the costumes!',
    biscuit: 'And a pumpkin biscuit for you, Moke. Happy Halloween!',
    fed: 'A pumpkin biscuit! Best Halloween ever!',
  },
  /** Bringing him his biscuit: they walk to him, and hand it over once he's this close for `offerTime`. */
  biscuit: {
    reach: 0.75,
    offerTime: 0.7,
    /** If he won't come (or keeps running off), it goes down on the floor by them after this long (s). */
    giveUpAfter: 25,
  },
  /**
   * The little shelf on the wall beside the front door (the short stretch between the door and the corner, above
   * Moke's head and a jack-o'-lantern): the candy bowl and the biscuit jar live there.
   */
  shelf: { x: -3.43, y: 1.02, z: 2.84 },
} as const;

/**
 * The decorations, on top of furniture or tucked into corners (they have no colliders, so nothing stands in anyone's
 * way). Each jack-o'-lantern's `yaw` turns its face toward the room.
 */
export const HALLOWEEN_DECOR = {
  pumpkins: [
    // By the front door, in the corner beyond it.
    { x: -3.24, y: 0, z: 2.82, size: 1.0, yaw: Math.PI * 0.6, lantern: true },
    // On the living-room TV console, at the end away from the treat jar.
    { x: -0.32, y: 0.56, z: 2.78, size: 0.7, yaw: Math.PI, lantern: true },
    // The family-room mantel, either end.
    { x: 13.78, y: 1.38, z: 5.22, size: 1.0, yaw: Math.PI, lantern: true },
    { x: 15.32, y: 1.38, z: 5.22, size: 0.8, yaw: Math.PI, lantern: false },
    // Outside on the patio, against the house: beyond the potted plants, and the far side of the glass doors.
    { x: 17.32, y: 0, z: 1.78, size: 1.2, yaw: Math.PI / 2, lantern: true },
    { x: 17.32, y: 0, z: -4.35, size: 1.2, yaw: Math.PI / 2, lantern: true },
    { x: 17.42, y: 0, z: -4.78, size: 0.8, yaw: Math.PI / 2, lantern: false },
  ],
  /** A pumpkin's radius at size 1 (m). */
  radius: 0.12,
  /** Paper bats on a string, across the living room's window wall (x, z of each end; y of the string). */
  garland: { from: { x: -3.42, z: -0.85 }, to: { x: -3.42, z: 1.05 }, y: 2.28, sag: 0.18, bats: 6 },
  /** How the candle inside each lantern flickers (how fast, how much). */
  flicker: { speed: 9, amount: 0.25 },
} as const;
