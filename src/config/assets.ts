import type { AssetEntry } from '../core/AssetManager';
import { MOKE_CHARACTER } from './mokeCharacter';

/**
 * True when the final Moke model (`public/${MOKE_CHARACTER.model.path}`) was there at build time, or when the dev
 * server started. Without it the game uses the procedural stand-in and says so in the console.
 */
export const MOKE_MODEL_AVAILABLE: boolean = __MOKE_MODEL_AVAILABLE__;

/**
 * Assets preloaded behind the loading screen. Paths are relative to public/.
 * Optional entries may be missing or broken; the game falls back (e.g. to the procedural Moke) instead of failing.
 */
export const ASSET_MANIFEST: readonly AssetEntry[] = [
  ...(MOKE_MODEL_AVAILABLE ? [{ key: 'moke', kind: 'gltf', path: MOKE_CHARACTER.model.path, optional: true } as const] : []),
];
