import { MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import { TV } from '../config/world';
import type { Vec3Like } from '../physics/CharacterBody';
import { mulberry32 } from '../utils/random';
import { TV_SCREENS, type TvScreenSpot } from '../world/home/places';
import { TvChannels, tvShows } from '../world/tv/TvChannels';
import { HOME_RUN_AT } from '../world/tv/WorldSeries';
import type { DogActivityContext } from './DogActivity';
import { DogActivityDirector } from './DogActivityDirector';
import { WatchTheGame } from './WatchTheGame';

const DT = 1 / 30;
const living = TV_SCREENS.find((s) => s.id === 'living')!;
/** A point `distance` m in front of `screen`, `angle` rad off straight on. */
const inFront = (screen: TvScreenSpot, distance: number, angle = 0): Vec3Like => ({
  x: screen.x + Math.sin(screen.facing + angle) * distance,
  y: 0,
  z: screen.z + Math.cos(screen.facing + angle) * distance,
});

function world(specialOn = true) {
  const tv = { specialOn };
  const watched: (string | null)[] = [];
  let cheers = 0;
  const activity = new WatchTheGame({
    tv,
    screens: TV_SCREENS,
    onWatch: (screen) => watched.push(screen?.id ?? null),
    onCelebrate: () => cheers++,
  });
  const director = new DogActivityDirector([activity]);
  const moke = { position: inFront(living, 1.6), speed: 0, carrying: null as string | null, barked: false, trick: false, sniffing: false, napSpot: null as string | null };
  const ctx: DogActivityContext = {
    moke,
    human: { position: { x: 20, y: 0, z: 20 }, available: false, seesMoke: false, engaged: false },
    heistRunning: false,
  };
  const tick = (seconds = DT) => {
    for (let i = 0; i < Math.max(1, Math.round(seconds / DT)); i++) director.update(DT, ctx);
  };
  return { tv, activity, director, moke, ctx, tick, watched, cheers: () => cheers };
}

describe('Watch the Game (the World Series easter egg)', () => {
  it('is only offered while the special is on, in front of a TV: not too close, not off to the side, not with a toy or napping', () => {
    const w = world(false);
    w.tick();
    expect(w.activity.interactable.enabled).toBe(false); // regular shows: nothing to watch
    w.tv.specialOn = true;
    w.tick();
    expect(w.activity.interactable.enabled).toBe(true);
    expect(w.activity.interactable.label).toBe('Watch the Game');
    const t = HOME_ACTIVITIES.watchGame;
    for (const [where, ok] of [
      [inFront(living, t.near - 0.1), false], // right underneath it
      [inFront(living, t.reach + 0.3), false], // too far to see
      [inFront(living, 1.6, t.halfAngle + 0.2), false], // off to the side
      [inFront(living, 1.6, t.halfAngle - 0.2), true],
      [inFront(living, t.near + 0.1), true],
    ] as const) {
      w.moke.position = where;
      w.tick();
      expect(w.activity.interactable.enabled, JSON.stringify(where)).toBe(ok);
    }
    w.moke.position = inFront(living, 1.6);
    w.moke.carrying = 'ball';
    w.tick();
    expect(w.activity.interactable.enabled).toBe(false);
    w.moke.carrying = null;
    w.moke.napSpot = 'bed';
    w.tick();
    expect(w.activity.interactable.enabled).toBe(false);
  });

  it('works in front of every TV in the house, picking the one he is in front of', () => {
    for (const screen of TV_SCREENS) {
      const w = world();
      w.moke.position = inFront(screen, 1.5);
      w.tick();
      w.activity.interactable.interact();
      w.tick();
      expect(w.activity.running, screen.id).toBe(true);
      expect(w.activity.watchingScreen?.id).toBe(screen.id);
      expect(w.watched).toEqual([screen.id]);
    }
  });

  it('sits him down to watch, and at the home run he celebrates once, then it is done', () => {
    const w = world();
    w.tick();
    w.activity.interactable.interact();
    w.tick();
    expect(w.activity.running).toBe(true);
    expect(w.activity.objective).toMatch(/World Series/);
    expect(w.activity.interactable.enabled).toBe(false); // no second "Watch the Game" while watching
    w.tick(2);
    expect(w.cheers()).toBe(0);
    w.activity.homeRun();
    expect(w.cheers()).toBe(1);
    expect(w.watched).toEqual(['living', null]);
    expect(w.activity.watchingScreen).toBeNull();
    expect(w.activity.state).toBe('SUCCESS');
    w.activity.homeRun(); // only while watching
    expect(w.cheers()).toBe(1);
  });

  it('a home run while he is not watching does nothing', () => {
    const w = world();
    w.tick();
    w.activity.homeRun();
    expect(w.cheers()).toBe(0);
    expect(w.watched).toEqual([]);
  });

  it('stops, without a cheer, when he moves off or the broadcast ends first', () => {
    const moved = world();
    moved.tick();
    moved.activity.interactable.interact();
    moved.tick();
    moved.activity.stop();
    expect(moved.activity.running).toBe(false);
    expect(moved.watched).toEqual(['living', null]);
    expect(moved.cheers()).toBe(0);

    const ended = world();
    ended.tick();
    ended.activity.interactable.interact();
    ended.tick();
    ended.tv.specialOn = false; // he tuned in after the home run, and it's over
    ended.tick();
    expect(ended.activity.running).toBe(false);
    expect(ended.watched).toEqual(['living', null]);
    expect(ended.cheers()).toBe(0);
  });

  it('can watch again at the next broadcast', () => {
    const w = world();
    w.tick();
    w.activity.interactable.interact();
    w.tick();
    w.activity.homeRun();
    w.tick(3); // the success moment, then the cooldown
    expect(w.activity.state).toBe('AVAILABLE');
    w.activity.interactable.interact();
    w.tick();
    expect(w.activity.running).toBe(true);
  });

  it('with the real TVs: watching through the broadcast, he celebrates exactly once, at the home run', () => {
    const tv = new TvChannels([new MeshBasicMaterial(), new MeshBasicMaterial(), new MeshBasicMaterial()], mulberry32(3), tvShows(), {
      ...TV, special: { firstAfter: [1e9, 1e9], every: [1e9, 1e9] },
    } as unknown as typeof TV);
    let cheers = 0;
    let cheeredAt = -1;
    let t = 0;
    const activity = new WatchTheGame({ tv, screens: TV_SCREENS, onWatch: () => {}, onCelebrate: () => { cheers++; cheeredAt = t; } });
    tv.onHomeRun = () => activity.homeRun();
    const director = new DogActivityDirector([activity]);
    const ctx: DogActivityContext = {
      moke: { position: inFront(living, 1.6), speed: 0, carrying: null, barked: false, trick: false, sniffing: false, napSpot: null },
      human: { position: { x: 20, y: 0, z: 20 }, available: false, seesMoke: false, engaged: false },
      heistRunning: false,
    };
    tv.startSpecial();
    director.update(DT, ctx);
    activity.interactable.interact();
    for (; t < tv.specialShow.loop + 3; t += DT) {
      tv.update(DT);
      director.update(DT, ctx);
    }
    expect(cheers).toBe(1);
    expect(cheeredAt).toBeGreaterThanOrEqual(HOME_RUN_AT - DT);
    expect(cheeredAt).toBeLessThan(HOME_RUN_AT + 2 * DT);
    expect(tv.specialOn).toBe(false);
    expect(activity.running).toBe(false);
  });
});
