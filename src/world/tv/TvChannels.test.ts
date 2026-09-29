import { MeshBasicMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { TV } from '../../config/world';
import { mulberry32 } from '../../utils/random';
import { SCENES as CHEF_SCENES } from './ChefShowdown';
import { sceneAt, type Scenes } from './draw';
import { SCENES as GEARBOTS_SCENES } from './Gearbots';
import { SCENES as HIGHWAY_SCENES } from './HighwayHero';
import { TvChannels, tvShows } from './TvChannels';

/**
 * A stand-in 2D context that accepts every drawing call and remembers anything a real one would choke on: numbers
 * that aren't finite, and negative radii (arcs, ellipses and radial gradients throw on those in browsers).
 */
function fakeContext(width: number, height: number) {
  const problems: string[] = [];
  const check = (name: string, args: unknown[]) => {
    if (args.some((a) => typeof a === 'number' && !Number.isFinite(a))) problems.push(`${name}(${args.join(', ')})`);
    const radii = name === 'arc' ? [args[2]] : name === 'ellipse' ? [args[2], args[3]] : name === 'createRadialGradient' ? [args[2], args[5]] : [];
    if (radii.some((r) => typeof r === 'number' && r < 0)) problems.push(`${name} with a negative radius (${args.join(', ')})`);
  };
  const gradient = { addColorStop: (offset: number) => { if (!(offset >= 0 && offset <= 1)) problems.push(`colour stop ${offset}`); } };
  const state: Record<string, unknown> = { canvas: { width, height } };
  const ctx = new Proxy(state, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === 'measureText') return (text: string) => ({ width: text.length * 9 });
      if (key === 'createLinearGradient' || key === 'createRadialGradient') {
        return (...args: unknown[]) => {
          check(key, args);
          return gradient;
        };
      }
      return (...args: unknown[]) => check(key, args);
    },
    set(target, key: string, value) {
      target[key] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, problems };
}

const screens = () => [new MeshBasicMaterial(), new MeshBasicMaterial(), new MeshBasicMaterial()];

describe('The TVs (three shows, three sets)', () => {
  for (const [name, scenes] of [['GEARBOTS', GEARBOTS_SCENES], ['HIGHWAY HERO', HIGHWAY_SCENES], ['CHEF SHOWDOWN', CHEF_SCENES]] as const) {
    it(`runs ${name}'s scenes back to back, and loops`, () => {
      const s = scenes as Scenes<string>;
      expect(s[0]!.from).toBe(0);
      for (let i = 1; i < s.length; i++) expect(s[i]!.from).toBe(s[i - 1]!.to);
      const loop = s.at(-1)!.to;
      expect(sceneAt(s, loop + 0.25)).toMatchObject({ name: s[0]!.name, t: 0.25 });
    });
  }

  it('draws every show, all the way through, without a single bad number', () => {
    for (const show of tvShows()) {
      const { ctx, problems } = fakeContext(TV.width, TV.height);
      for (let time = 0; time < show.loop; time += 1 / 24) show.draw(ctx, TV.width, TV.height, time);
      expect(problems.slice(0, 5), show.name).toEqual([]);
    }
  });

  it('gives each show its own channel number and a name', () => {
    const shows = tvShows();
    expect(new Set(shows.map((s) => s.channel)).size).toBe(shows.length);
    expect(shows.map((s) => s.name)).toEqual(['GEARBOTS', 'HIGHWAY HERO', 'CHEF SHOWDOWN']);
  });

  it('puts a different show on each TV, and every so often two swap, so they are never on the same one', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      // (The World Series special is left out here: it puts the same broadcast on all three.)
      const tv = new TvChannels(screens(), mulberry32(seed), tvShows(), { ...TV, special: { firstAfter: [1e9, 1e9], every: [1e9, 1e9] } } as unknown as typeof TV);
      const seen = [new Set<string>(), new Set<string>(), new Set<string>()];
      let lineup = tv.onAir.map((s) => s.name).join();
      let swaps = 0;
      for (let t = 0; t < 600; t += 1 / 30) {
        tv.update(1 / 30);
        const names = tv.onAir.map((s) => s.name);
        expect(new Set(names).size, `seed ${seed} at ${t.toFixed(1)}s`).toBe(3);
        names.forEach((n, i) => seen[i]!.add(n));
        if (names.join() !== lineup) swaps++;
        lineup = names.join();
      }
      // Swaps come every 18–40 s: roughly 15–33 in ten minutes.
      expect(swaps).toBeGreaterThanOrEqual(600 / TV.switchEvery[1] - 1);
      expect(swaps).toBeLessThanOrEqual(600 / TV.switchEvery[0] + 1);
      // Over ten minutes, every TV shows every show.
      for (const s of seen) expect(s.size, `seed ${seed}`).toBe(3);
    }
  });

  it('pauses with the game: no channel changes while paused', () => {
    const tv = new TvChannels(screens(), mulberry32(9));
    const lineup = tv.onAir.map((s) => s.name).join();
    for (let i = 0; i < 10_000; i++) tv.update(0);
    expect(tv.onAir.map((s) => s.name).join()).toBe(lineup);
  });

  it('starts differently each time (the lineup is shuffled)', () => {
    const lineups = new Set<string>();
    for (let seed = 1; seed <= 20; seed++) lineups.add(new TvChannels(screens(), mulberry32(seed)).onAir.map((s) => s.name).join());
    expect(lineups.size).toBeGreaterThan(2);
  });
});
