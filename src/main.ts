import '@fontsource-variable/fredoka';
import './styles/main.css';
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

try {
  const viewport = document.getElementById('viewport');
  if (!viewport) throw new Error('#viewport is missing from index.html');
  const game = new Game(viewport, ui);
  if (import.meta.env.DEV) Object.assign(window, { imdog: game });
  game.start().catch(fail);
} catch (err) {
  fail(err);
}
