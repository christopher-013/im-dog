import { Color, PerspectiveCamera, Scene } from 'three';
import { PreviewOrbitCamera } from '../camera/PreviewOrbitCamera';
import { ASSET_MANIFEST } from '../config/assets';
import { CAMERA_LENS, RENDER } from '../config/engine';
import { DebugPanel, FrameStats } from '../ui/DebugPanel';
import type { UIManager } from '../ui/UIManager';
import { FoundationStage } from '../world/FoundationStage';
import { RoomLighting } from '../world/RoomLighting';
import { AssetManager } from './AssetManager';
import { FixedStep, GameLoop } from './GameLoop';
import { GameRenderer } from './GameRenderer';
import { InputManager } from './InputManager';
import type { Vec2Like } from './InputState';

export type GameState = 'loading' | 'menu' | 'playing' | 'paused';

/**
 * Top-level orchestrator: owns the renderer, scene, input, UI and the game state machine
 * (loading → menu → playing ⇄ paused), and runs the frame:
 *
 *   input.beginFrame → global keys → fixed-step simulation → camera → render → debug
 */
export class Game {
  private state: GameState = 'loading';
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(CAMERA_LENS.fov, 1, CAMERA_LENS.near, CAMERA_LENS.far);
  private readonly gfx: GameRenderer;
  private readonly input: InputManager;
  private readonly assets = new AssetManager();
  private readonly debug: DebugPanel;
  private readonly loop: GameLoop;
  private readonly fixedStep = new FixedStep();
  private readonly frameStats = new FrameStats();
  private readonly stage = new FoundationStage();
  private readonly previewCamera: PreviewOrbitCamera;
  private readonly lookDelta: Vec2Like = { x: 0, y: 0 };
  private readonly moveAxis: Vec2Like = { x: 0, y: 0 };

  constructor(
    viewport: HTMLElement,
    private readonly ui: UIManager,
  ) {
    this.gfx = new GameRenderer(viewport);
    this.input = new InputManager(this.gfx.canvas);
    this.debug = new DebugPanel(viewport.parentElement ?? document.body);
    this.loop = new GameLoop(this.gfx.renderer, this.frame);

    this.scene.background = new Color(RENDER.background);
    this.scene.add(new RoomLighting().object, this.stage.object);
    this.previewCamera = new PreviewOrbitCamera(this.camera, this.stage.spawnPoint);

    ui.bind({ onPlay: () => this.play(), onResume: () => this.resume() });
    this.input.onPointerLockChange = (locked) => {
      if (!locked && this.state === 'playing') this.pause();
      this.ui.setPointerHint(this.state === 'playing' && !locked);
    };
    this.input.onPointerLockError = () => {
      if (this.state === 'playing') this.ui.setPointerHint(true);
    };
    this.gfx.canvas.addEventListener('click', () => {
      if (this.state === 'playing' && !this.input.isPointerLocked) void this.input.requestPointerLock();
    });
    this.gfx.onContextLost = () => this.ui.showToast('Graphics hiccup. Trying to recover…', 6000);
    this.gfx.onContextRestored = () => this.ui.showToast('Back!', 2000);

    this.registerDebugSections();
    if (new URLSearchParams(location.search).has('debug')) this.debug.setVisible(true);
  }

  async start(): Promise<void> {
    this.setState('loading');
    this.ui.setLoadingProgress(0, 'Sniffing around for assets…');
    await this.assets.preload(ASSET_MANIFEST, (fraction) => this.ui.setLoadingProgress(fraction * 0.7));

    // Compile shaders up front so the first frames don't hitch.
    this.ui.setLoadingProgress(0.75, 'Fluffing the cushions…');
    this.gfx.syncSize(this.camera);
    await this.gfx.renderer.compileAsync(this.scene, this.camera);
    this.ui.setLoadingProgress(1, 'Ready!');

    this.loop.start();
    this.setState('menu');
  }

  dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.gfx.dispose();
  }

  private setState(next: GameState): void {
    this.state = next;
    this.input.gameplayFocus = next === 'playing';
    this.previewCamera.mode = next === 'loading' || next === 'menu' ? 'attract' : 'look';
    this.ui.showScreen(next === 'playing' ? null : next);
  }

  private play(): void {
    if (this.state !== 'menu') return;
    this.setState('playing');
    void this.input.requestPointerLock();
    this.ui.showToast('Move the mouse to look around. Walking arrives in Milestone 2.');
  }

  private resume(): void {
    if (this.state !== 'paused') return;
    this.setState('playing');
    void this.input.requestPointerLock();
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.setState('paused');
    this.input.exitPointerLock();
    this.input.state.releaseAll();
  }

  private readonly frame = (dt: number): void => {
    this.input.beginFrame();
    const input = this.input.state;
    if (input.wasPressed('toggleDebug')) this.debug.toggle();
    // With pointer lock, the browser eats Esc and we pause via onPointerLockChange instead.
    if (input.wasPressed('pause') && this.state === 'playing') this.pause();

    // The world only advances while playing; menus and pause freeze it.
    this.fixedStep.advance(this.state === 'playing' ? dt : 0, this.fixedUpdate);

    input.getLookDelta(this.lookDelta);
    if (this.state !== 'playing') {
      this.lookDelta.x = 0;
      this.lookDelta.y = 0;
    }
    this.previewCamera.update(dt, this.lookDelta);

    this.gfx.render(this.scene, this.camera);
    this.frameStats.record(dt);
    this.debug.update(dt);
  };

  private readonly fixedUpdate = (_step: number): void => {
    // Milestone 2+: Moke's controller, physics, interactions and scent tick here.
  };

  private registerDebugSections(): void {
    const info = this.gfx.renderer.info;
    this.debug.addSection('Frame', () => {
      const { width, height } = this.gfx.drawingBufferSize;
      return {
        fps: this.frameStats.fps.toFixed(0),
        'avg / worst': `${this.frameStats.averageMs.toFixed(1)} / ${this.frameStats.worstMs.toFixed(1)} ms`,
        'draw calls': info.render.calls,
        triangles: info.render.triangles.toLocaleString(),
        'pixel ratio': this.gfx.pixelRatio.toFixed(2),
        buffer: `${width}×${height}`,
      };
    });
    this.debug.addSection('Game', () => ({
      state: this.state,
      'pointer lock': this.input.pointerLockSupported ? (this.input.isPointerLocked ? 'locked' : 'free') : 'unsupported',
      'fixed step': `${(this.fixedStep.step * 1000).toFixed(2)} ms`,
    }));
    this.debug.addSection('Input', () => {
      const move = this.input.state.getMoveAxis(this.moveAxis);
      return {
        held: this.input.state.heldActions().join(' ') || '—',
        move: `${move.x.toFixed(2)}, ${move.y.toFixed(2)}`,
      };
    });
    this.debug.addSection('Camera', () => this.previewCamera.debugInfo());
  }
}
