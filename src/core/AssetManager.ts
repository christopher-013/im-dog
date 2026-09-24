import { SRGBColorSpace, TextureLoader, type Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';

export type AssetKind = 'gltf' | 'texture';

export interface AssetEntry {
  key: string;
  kind: AssetKind;
  /** Relative to the site root, i.e. to public/. Example: 'assets/models/moke/moke.glb'. */
  path: string;
  /** Optional assets may be missing; callers fall back to placeholders. Defaults to false. */
  optional?: boolean;
}

export interface AssetFailure {
  key: string;
  path: string;
  optional: boolean;
  reason: string;
}

export interface AssetLoadReport {
  loaded: string[];
  failed: AssetFailure[];
}

type Loader = (url: string) => Promise<unknown>;

function createDefaultLoaders(): Record<AssetKind, Loader> {
  const gltfLoader = new GLTFLoader();
  const textureLoader = new TextureLoader();
  return {
    gltf: (url) => gltfLoader.loadAsync(url),
    // 'texture' means a colour texture. Data maps (normal, roughness) normally arrive inside glTFs.
    texture: async (url) => {
      const texture = await textureLoader.loadAsync(url);
      texture.colorSpace = SRGBColorSpace;
      return texture;
    },
  };
}

/**
 * Loads runtime assets from public/ and reports progress for the loading screen.
 * A missing or broken file never throws out of preload(): it's logged and reported so the
 * game can fall back (for example: no moke.glb → keep the built-in toon Moke).
 */
export class AssetManager {
  private readonly assets = new Map<string, { kind: AssetKind; value: unknown }>();

  constructor(
    private readonly loaders: Record<AssetKind, Loader> = createDefaultLoaders(),
    private readonly baseUrl: string = import.meta.env.BASE_URL,
  ) {}

  resolveUrl(path: string): string {
    return this.baseUrl + path.replace(/^\/+/, '');
  }

  async preload(
    entries: readonly AssetEntry[],
    onProgress?: (fraction: number) => void,
  ): Promise<AssetLoadReport> {
    const report: AssetLoadReport = { loaded: [], failed: [] };
    if (entries.length === 0) {
      onProgress?.(1);
      return report;
    }

    let settled = 0;
    onProgress?.(0);
    await Promise.all(
      entries.map(async (entry) => {
        try {
          const value = await this.loaders[entry.kind](this.resolveUrl(entry.path));
          this.assets.set(entry.key, { kind: entry.kind, value });
          report.loaded.push(entry.key);
        } catch (err) {
          const failure: AssetFailure = {
            key: entry.key,
            path: entry.path,
            optional: entry.optional ?? false,
            reason: err instanceof Error ? err.message : String(err),
          };
          report.failed.push(failure);
          const log = failure.optional ? console.warn : console.error;
          log(`[assets] Could not load ${failure.optional ? 'optional ' : ''}"${entry.key}" from ${entry.path}: ${failure.reason}`);
        } finally {
          settled++;
          onProgress?.(settled / entries.length);
        }
      }),
    );
    return report;
  }

  getGLTF(key: string): GLTF | undefined {
    const asset = this.assets.get(key);
    return asset?.kind === 'gltf' ? (asset.value as GLTF) : undefined;
  }

  getTexture(key: string): Texture | undefined {
    const asset = this.assets.get(key);
    return asset?.kind === 'texture' ? (asset.value as Texture) : undefined;
  }
}
