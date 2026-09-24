import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const referenceDir = path.join(projectRoot, 'reference');

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
  plugins: [blockPrivateReferencePhotos()],
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
    // three.js core alone is ~600 kB minified; one chunk is fine for a game this size.
    chunkSizeWarningLimit: 1000,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
