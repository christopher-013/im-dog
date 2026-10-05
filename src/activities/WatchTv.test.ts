import { describe, expect, it } from 'vitest';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import { TV_SCREENS } from '../world/home/places';
import { WatchTv } from './WatchTv';

type Screen = (typeof TV_SCREENS)[number];
const living = TV_SCREENS.find((s) => s.id === 'living')!;

/** Moke `d` m straight out in front of a screen, stopped and facing it (unless told otherwise). */
function moke(s: Screen, d: number, extra: { turn?: number; speed?: number; carrying?: string | null; napping?: boolean; side?: number } = {}) {
  const side = extra.side ?? 0;
  const position = { x: s.x + Math.sin(s.facing + side) * d, y: 0, z: s.z + Math.cos(s.facing + side) * d };
  const heading = Math.atan2(s.x - position.x, s.z - position.z) + (extra.turn ?? 0);
  return { position, heading, speed: extra.speed ?? 0, carrying: extra.carrying ?? null, napping: extra.napping ?? false };
}

function setup() {
  let special = false;
  const watched: (string | null)[] = [];
  const tv = new WatchTv({ screens: TV_SCREENS, specialOn: () => special, onWatch: (s) => watched.push(s?.id ?? null) });
  return { tv, watched, setSpecial: (on: boolean) => (special = on) };
}

describe('Watch TV (any show, full screen)', () => {
  it('is offered when he is stopped, close in front of a TV and facing it', () => {
    const { tv } = setup();
    for (const screen of TV_SCREENS) {
      tv.update(moke(screen, 1.5));
      expect(tv.interactable.enabled, screen.id).toBe(true);
      expect(tv.nearby?.id).toBe(screen.id);
    }
  });

  it('not while he is moving, facing away, too far off, too close, off to the side, carrying something or napping', () => {
    const { tv } = setup();
    const t = HOME_ACTIVITIES.watchTv;
    const cases = {
      moving: moke(living, 1.5, { speed: 1.2 }),
      'facing away': moke(living, 1.5, { turn: Math.PI / 2 }),
      'too far': moke(living, t.reach + 0.5),
      'too close': moke(living, t.near / 2),
      'off to the side': moke(living, 1.5, { side: 1.2 }),
      carrying: moke(living, 1.5, { carrying: 'ball' }),
      napping: moke(living, 1.5, { napping: true }),
    };
    for (const [name, m] of Object.entries(cases)) {
      tv.update(m);
      expect(tv.interactable.enabled, name).toBe(false);
    }
    // A little off straight, and a little turned: still fine.
    tv.update(moke(living, 1.5, { side: 0.4, turn: 0.3 }));
    expect(tv.interactable.enabled).toBe(true);
  });

  it('turns on that TV full screen, and off again when he is done', () => {
    const { tv, watched } = setup();
    tv.update(moke(living, 1.5));
    tv.interactable.interact();
    expect(tv.watching?.id).toBe('living');
    expect(tv.interactable.enabled).toBe(false);
    tv.stop();
    tv.stop();
    expect(watched).toEqual(['living', null]);
  });

  it('gives way to the World Series special (that is Watch the Game, with its own close-up)', () => {
    const { tv, watched, setSpecial } = setup();
    tv.update(moke(living, 1.5));
    tv.start();
    setSpecial(true);
    tv.update(moke(living, 1.5));
    expect(tv.watching).toBeNull();
    expect(tv.interactable.enabled).toBe(false);
    expect(tv.start()).toBe(false);
    expect(watched).toEqual(['living', null]);
  });
});
