import { afterEach, describe, expect, it, vi } from 'vitest';
import { GltfMokeVisual } from './gltf/GltfMokeVisual';
import { syntheticMoke } from './gltf/testing/syntheticMoke';
import { createMokeVisual, createPreviewVisual } from './MokeVisual';
import { DOGS } from '../config/dogs';
import { Mesh } from 'three';
import { ToonMokeVisual } from './ToonMokeVisual';

describe('choosing Moke\'s visual', () => {
  afterEach(() => vi.restoreAllMocks());

  it('uses moke.glb when it loaded and is usable', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const choice = createMokeVisual(syntheticMoke(), true);
    expect(choice.kind).toBe('model');
    expect(choice.visual).toBeInstanceOf(GltfMokeVisual);
    expect(choice.notes).toEqual([]);
    choice.visual.dispose();
  });

  it('closing the selection preview does not dispose the cached model used by gameplay', () => {
    const gltf = syntheticMoke();
    const mesh = gltf.scene.children.find((child): child is Mesh => child instanceof Mesh)!;
    let geometryDisposals = 0;
    let materialDisposals = 0;
    mesh.geometry.addEventListener('dispose', () => geometryDisposals++);
    (mesh.material as import('three').Material).addEventListener('dispose', () => materialDisposals++);
    const preview = createPreviewVisual(DOGS.find((dog) => dog.id === 'moke')!, gltf);
    preview.dispose();
    const game = createMokeVisual(gltf, true);
    game.visual.dispose();
    expect(geometryDisposals).toBe(0);
    expect(materialDisposals).toBe(0);
  });

  it('falls back to the procedural stand-in, with a clear warning, when there is no model', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const choice = createMokeVisual(undefined, false);
    expect(choice.kind).toBe('stand-in');
    expect(choice.visual).toBeInstanceOf(ToonMokeVisual);
    expect(choice.notes[0]).toMatch(/no assets\/models\/moke\/moke\.glb/);
    expect(warn).toHaveBeenCalled(); // tests run as a dev build
    choice.visual.dispose();
  });

  it('falls back, and says why, when the model was expected but failed to load or is unusable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(createMokeVisual(undefined, true).notes[0]).toMatch(/failed to load/);
    const broken = createMokeVisual(syntheticMoke({ noMesh: true }), true);
    expect(broken.kind).toBe('stand-in');
    expect(broken.notes[0]).toMatch(/no meshes/);
    expect(warn.mock.calls.flat().join(' ')).toMatch(/MOKE_INTEGRATION\.md/);
  });

  it('warns about a usable model that has problems, and still uses it', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const choice = createMokeVisual(syntheticMoke({ clips: ['idle'] }), true);
    expect(choice.kind).toBe('model');
    expect(choice.notes.join()).toMatch(/missing required clips/);
    expect(warn).toHaveBeenCalled();
    choice.visual.dispose();
  });
});
