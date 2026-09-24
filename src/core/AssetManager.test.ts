import { afterEach, describe, expect, it, vi } from 'vitest';
import { AssetManager, type AssetEntry } from './AssetManager';

const fakeGLTF = { scene: 'moke' };

function manager(failing: string[] = []) {
  const loader = vi.fn(async (url: string) => {
    if (failing.some((f) => url.endsWith(f))) throw new Error('404 Not Found');
    return fakeGLTF;
  });
  return { assets: new AssetManager({ gltf: loader, texture: loader }, '/game/'), loader };
}

afterEach(() => vi.restoreAllMocks());

describe('AssetManager', () => {
  it('resolves paths against the base URL', () => {
    const { assets } = manager();
    expect(assets.resolveUrl('assets/models/moke/moke.glb')).toBe('/game/assets/models/moke/moke.glb');
    expect(assets.resolveUrl('/assets/x.glb')).toBe('/game/assets/x.glb');
  });

  it('loads entries and reports progress up to 1', async () => {
    const { assets, loader } = manager();
    const progress: number[] = [];
    const entries: AssetEntry[] = [
      { key: 'a', kind: 'gltf', path: 'a.glb' },
      { key: 'b', kind: 'gltf', path: 'b.glb' },
    ];
    const report = await assets.preload(entries, (p) => progress.push(p));
    expect(loader).toHaveBeenCalledTimes(2);
    expect(report.failed).toEqual([]);
    expect(report.loaded.sort()).toEqual(['a', 'b']);
    expect(progress.at(-1)).toBe(1);
    expect(assets.getGLTF('a')).toBe(fakeGLTF);
  });

  it('survives a missing optional asset so the game can fall back', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { assets } = manager(['moke.glb']);
    const report = await assets.preload([
      { key: 'moke', kind: 'gltf', path: 'assets/models/moke/moke.glb', optional: true },
      { key: 'couch', kind: 'gltf', path: 'couch.glb' },
    ]);
    expect(report.loaded).toEqual(['couch']);
    expect(report.failed).toEqual([
      { key: 'moke', path: 'assets/models/moke/moke.glb', optional: true, reason: '404 Not Found' },
    ]);
    expect(assets.getGLTF('moke')).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('reports a missing required asset without throwing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { assets } = manager(['couch.glb']);
    const report = await assets.preload([{ key: 'couch', kind: 'gltf', path: 'couch.glb' }]);
    expect(report.failed[0]?.optional).toBe(false);
  });

  it('only returns an asset from the getter matching its kind', async () => {
    const { assets } = manager();
    await assets.preload([{ key: 'rug', kind: 'texture', path: 'rug.png' }]);
    expect(assets.getGLTF('rug')).toBeUndefined();
    expect(assets.getTexture('rug')).toBe(fakeGLTF);
  });

  it('reports full progress immediately for an empty manifest', async () => {
    const { assets } = manager();
    const progress: number[] = [];
    await assets.preload([], (p) => progress.push(p));
    expect(progress).toEqual([1]);
  });
});
