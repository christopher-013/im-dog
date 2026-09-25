import path from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const referenceDir = path.join(projectRoot, 'reference');

/** Ship the notices with the static site, not only inside development dependencies. */
function runtimeLicenses(): Plugin {
  return {
    name: 'im-dog:runtime-licenses',
    generateBundle() {
      const packages = ['three', '@dimforge/rapier3d-compat', '@fontsource-variable/fredoka'];
      const source = packages.map((name) =>
        `${name}\n${'='.repeat(name.length)}\n${readFileSync(path.join(projectRoot, 'node_modules', name, 'LICENSE'), 'utf8')}`,
      ).join('\n\n');
      this.emitFile({ type: 'asset', fileName: 'THIRD_PARTY_NOTICES.txt', source });
    },
  };
}

/** Keep in sync with MOKE_CHARACTER.model.path (relative to public/). */
const MOKE_MODEL_FILE = path.join(projectRoot, 'public', 'assets', 'models', 'moke', 'moke.glb');

function isInside(file: string, dir: string): boolean {
  const rel = path.relative(dir, file);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/**
 * The real Moke photos in reference/ are private development references.
 * Fail loudly if anything ever tries to pull one into the bundle.
 * (scripts/verify-dist.mjs double-checks the finished build.)
 */
function blockPrivateReferencePhotos(): Plugin {
  return {
    name: 'im-dog:block-private-reference',
    enforce: 'pre',
    load(id) {
      const file = path.resolve(id.split('?')[0] ?? id);
      if (isInside(file, referenceDir)) {
        this.error(
          `"${path.relative(projectRoot, file)}" is a private Moke reference photo and must never be bundled.`,
        );
      }
      return null;
    },
  };
}

export default defineConfig({
  // Relative base so the build works from any static host path (GitHub Pages project sites, etc.).
  base: './',
  // Only ask for moke.glb when it's there (restart the dev server after adding it). See docs/MOKE_INTEGRATION.md.
  define: { __MOKE_MODEL_AVAILABLE__: JSON.stringify(existsSync(MOKE_MODEL_FILE)) },
  plugins: [blockPrivateReferencePhotos(), runtimeLicenses()],
  server: {
    fs: {
      // Vite's defaults, plus the private reference photos.
      deny: [
        '.env',
        '.env.*',
        '*.{crt,pem,key,p12,pfx,cer,der}',
        '.npmrc',
        '.yarnrc.yml',
        '**/.git/**',
        '**/reference/**',
      ],
    },
  },
  build: {
    // Hashed JS/CSS/fonts go to dist/app/, leaving dist/assets/ for runtime game assets from public/assets/.
    assetsDir: 'app',
    // Main bundle (mostly three.js) is ~660 kB. The lazy-loaded Rapier chunk is ~2.9 MB raw / ~1.1 MB gzipped
    // because its WASM is embedded; that's inherent, so warn only above it.
    chunkSizeWarningLimit: 3000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
