import { USAGE } from '../config/site';

export type UsagePing = 'open' | 'play';

/**
 * Tells the site Worker (src/feedback/usage.ts) how the game is being used, anonymously: `open` once when the game
 * has loaded, and `play` once, when someone has really played (PLAY pressed, Moke moved, `USAGE.realPlayAfter`
 * seconds of unpaused play). Each ping is only the event's name: nothing about the player is sent or kept. Only on
 * im-dog.com (Game decides).
 */
export class UsageCounter {
  private opened = false;
  private played = false;
  private playTime = 0;
  private moved = false;

  constructor(
    private readonly send: (event: UsagePing) => void,
    private readonly realPlayAfter: number = USAGE.realPlayAfter,
  ) {}

  /** The game has loaded (once per page). */
  open(): void {
    if (this.opened) return;
    this.opened = true;
    this.send('open');
  }

  /** Each rendered frame: `playing` is unpaused play, `moving` whether the player is moving Moke right now. */
  update(dt: number, playing: boolean, moving: boolean): void {
    if (this.played || !playing || dt <= 0) return;
    this.playTime += dt;
    if (moving) this.moved = true;
    if (this.moved && this.playTime >= this.realPlayAfter) {
      this.played = true;
      this.send('play');
    }
  }
}

/** Sends a ping to `endpoint`, never waiting on it and never throwing: counting must not get in the way of play. */
export function pinger(endpoint: string): (event: UsagePing) => void {
  return (event) => {
    try {
      void fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event }),
        keepalive: true,
        credentials: 'omit',
        cache: 'no-store',
      }).catch(() => undefined);
    } catch {
      /* no network, no counting */
    }
  };
}
