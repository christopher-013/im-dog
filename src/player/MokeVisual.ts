import type { Object3D } from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { MOKE_CHARACTER } from '../config/mokeCharacter';
import { GltfMokeVisual } from './gltf/GltfMokeVisual';
import type { MokeAnimationState } from './MokeAnimationController';
import { ToonMokeVisual } from './ToonMokeVisual';

/** Where things attach to Moke. `mouth` always exists; the others are null if a visual has no such spot. */
export interface MokeAttachments {
  /** Between his front teeth: carried items (sock, toys) are centred here, +Z forward, +Y up. */
  readonly mouth: Object3D;
  /** The front of his collar. */
  readonly collar: Object3D | null;
  /** The middle of his back. */
  readonly back: Object3D | null;
}

/**
 * Everything a Moke visual must provide. Only `Moke` drives it; movement, camera, physics, interactions,
 * pickup, scent and rest never touch it, so the procedural stand-in can be swapped for moke.glb freely.
 * Carried items go through `attachments`, never through bones or mesh offsets.
 */
export interface MokeVisual {
  /** Root object. `Moke` places it at the feet position and facing; local +z is forward, 1 unit = 1 m. */
  readonly object: Object3D;
  readonly attachments: MokeAttachments;
  update(dt: number, animation: Readonly<MokeAnimationState>): void;
  dispose(): void;
}

/** Why the final model wasn't used (for the console and the debug panel). */
export interface MokeVisualChoice {
  visual: MokeVisual;
  /** 'model' = moke.glb; 'stand-in' = the procedural ToonMokeVisual. */
  kind: 'model' | 'stand-in';
  /** Problems found with moke.glb (missing clips, bones, sockets, wrong size), or why it wasn't used. */
  notes: string[];
}

/**
 * The single place that decides which visual Moke gets: the final `moke.glb` if it loaded and is usable,
 * otherwise the procedural stand-in, with a clear console warning either way (never a blank dog).
 */
export function createMokeVisual(gltf: Pick<GLTF, 'scene' | 'animations'> | undefined, modelExpected: boolean): MokeVisualChoice {
  const help = 'See docs/MOKE_INTEGRATION.md.';
  if (gltf) {
    try {
      const visual = new GltfMokeVisual(gltf);
      if (visual.issues.length) console.warn(`[moke] ${MOKE_CHARACTER.model.path} loaded with issues:\n- ${visual.issues.join('\n- ')}\n${help}`);
      return { visual, kind: 'model', notes: visual.issues };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[moke] ${MOKE_CHARACTER.model.path} can't be used (${reason}); using the procedural stand-in. ${help}`);
      return { visual: new ToonMokeVisual(), kind: 'stand-in', notes: [reason] };
    }
  }
  const reason = modelExpected
    ? `${MOKE_CHARACTER.model.path} failed to load (see the [assets] warning above)`
    : `no ${MOKE_CHARACTER.model.path} in public/ yet`;
  const log = modelExpected || import.meta.env.DEV ? console.warn : console.info;
  log(`[moke] ${reason}; using the procedural stand-in (ToonMokeVisual). ${help}`);
  return { visual: new ToonMokeVisual(), kind: 'stand-in', notes: [reason] };
}
