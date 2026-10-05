import { describe, expect, it } from 'vitest';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import { TV_SCREENS } from '../world/home/places';
import { WatchTv } from './WatchTv';

const living = TV_SCREENS.find((s) => s.id === 'living')!;
/** A spot `d` m straight out in front of a screen. */
const before = (s: typeof living, d: number) => ({ x: s.x + Math.sin(s.facing) * d, y: 0, z: s.z + Math.cos(s.facing) * d });

function setup() {
  let special = false;
  const watched: (string | null)[] = [];
  const tv = new WatchTv({ screens: TV_SCREENS, specialOn: () => special, onWatch: (s) => watched.push(s?.id ?? null) });
  return { tv, watched, setSpecial: (on: boolean) => (special = on) };
}

describe('Watch TV (any show, full screen)', () => {
  it('is offered in front of any TV, not off to the side, too close, carrying something or napping', () => {
    const { tv } = setup();
    for (const screen of TV_SCREENS) {
      tv.update({ position: before(screen, 1.6), carrying: null, napping: false });
      expect(tv.interactable.enabled, screen.id).toBe(true);
      expect(tv.nearby?.id).toBe(screen.id);
    }
    tv.update({ position: before(living, HOME_ACTIVITIES.watchGame.near / 2), carrying: null, napping: false });
    expect(tv.interactable.enabled).toBe(false);
    tv.update({ position: before(living, 1.6), carrying: 'ball', napping: false });
    expect(tv.interactable.enabled).toBe(false);
    tv.update({ position: before(living, 1.6), carrying: null, napping: true });
    expect(tv.interactable.enabled).toBe(false);
    tv.update({ position: { x: living.x + 3, y: 0, z: living.z - 0.2 }, carrying: null, napping: false });
    expect(tv.interactable.enabled).toBe(false);
  });

  it('turns on that TV full screen, and off again when he is done', () => {
    const { tv, watched } = setup();
    tv.update({ position: before(living, 1.6), carrying: null, napping: false });
    tv.interactable.interact();
    expect(tv.watching?.id).toBe('living');
    expect(tv.interactable.enabled).toBe(false);
    tv.stop();
    tv.stop();
    expect(watched).toEqual(['living', null]);
  });

  it('gives way to the World Series special (that is Watch the Game, with its own close-up)', () => {
    const { tv, watched, setSpecial } = setup();
    tv.update({ position: before(living, 1.6), carrying: null, napping: false });
    tv.start();
    setSpecial(true);
    tv.update({ position: before(living, 1.6), carrying: null, napping: false });
    expect(tv.watching).toBeNull();
    expect(tv.interactable.enabled).toBe(false);
    expect(tv.start()).toBe(false);
    expect(watched).toEqual(['living', null]);
  });
});
