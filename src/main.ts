import '@fontsource-variable/fredoka';
import './styles/main.css';
import { CAMERA } from './config/camera';
import { MOUSE } from './config/input';
import { MOVEMENT } from './config/movement';
import { Game } from './core/Game';
import { WebGLUnavailableError } from './core/GameRenderer';
import { UIManager } from './ui/UIManager';

const ui = new UIManager();

function describe(err: unknown): string {
  if (err instanceof WebGLUnavailableError) {
    return 'Your browser or graphics driver could not start WebGL 2. Try an up-to-date Chrome or Edge, and check that hardware acceleration is turned on.';
  }
  return err instanceof Error ? err.message : String(err);
}

function fail(err: unknown): void {
  console.error(err);
  ui.showFatalError(describe(err));
}

/**
 * Installable web app: a service worker (dist/sw.js, generated at build time) for fast repeat loads and
 * offline play. Production builds only, and not on localhost unless `?sw=on`, so development and
 * `npm run preview` never fight a stale cache. `?sw=off` removes it and its caches (handy on a phone with
 * no DevTools). See docs/MOBILE.md.
 */
function setUpServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  const choice = new URLSearchParams(location.search).get('sw');
  if (choice === 'off') {
    void navigator.serviceWorker.getRegistrations().then((all) => all.forEach((r) => void r.unregister()));
    if ('caches' in window) void caches.keys().then((keys) => keys.filter((k) => k.startsWith('im-dog-')).forEach((k) => void caches.delete(k)));
    return;
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
  if (!import.meta.env.PROD || (local && choice !== 'on')) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('[pwa] Service worker not registered:', err));
  });
}

setUpServiceWorker();

try {
  const viewport = document.getElementById('viewport');
  if (!viewport) throw new Error('#viewport is missing from index.html');
  const game = new Game(viewport, ui);
  // Dev only: inspect the game and tweak feel live from the console, e.g. `tuning.movement.runSpeed = 5`.
  if (import.meta.env.DEV) {
    Object.assign(window, { imdog: game, tuning: { movement: MOVEMENT, camera: CAMERA, mouse: MOUSE } });
  }
  game.start().catch(fail);
} catch (err) {
  fail(err);
}
