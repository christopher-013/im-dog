import type { AssetEntry } from '../core/AssetManager';

/**
 * Assets preloaded behind the loading screen. Paths are relative to public/.
 * Optional entries may be missing; the game falls back (e.g. the built-in toon Moke) instead of failing.
 */
export const ASSET_MANIFEST: readonly AssetEntry[] = [
  // Milestone 2+: { key: 'moke', kind: 'gltf', path: 'assets/models/moke/moke.glb', optional: true },
];
