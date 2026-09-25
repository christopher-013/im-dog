/** Bark tuning. Seconds. */
export const BARK = {
  /** Minimum time between barks, so mashing F gives a lively "arf-arf" and not a buzz. */
  cooldown: 0.32,
  /** The bark button (F / controller Y / touch) growls instead this often, at random (0..1). */
  growlChance: 0.5,
} as const;

/** What the bark button does this time: a bark or, now and then, his cute growl. */
export function barkOrGrowl(random: () => number = Math.random, growlChance: number = BARK.growlChance): 'bark' | 'growl' {
  return random() < growlChance ? 'growl' : 'bark';
}

/** F: when Moke may bark. Gameplay-level (NPCs could listen for barks later); no audio or visuals here. */
export class BarkTimer {
  /** Barks so far. */
  count = 0;
  private cooldownLeft = 0;

  constructor(private readonly cooldown: number = BARK.cooldown) {}

  update(dt: number): void {
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
  }

  /** True if he barks now. */
  tryBark(): boolean {
    if (this.cooldownLeft > 0) return false;
    this.cooldownLeft = this.cooldown;
    this.count++;
    return true;
  }
}
