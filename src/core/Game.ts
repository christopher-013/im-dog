import { Color, PerspectiveCamera, Scene, Vector3 } from 'three';
import { MoveBasis } from '../camera/MoveBasis';
import { ThirdPersonCamera, type CameraInput, type CameraTarget } from '../camera/ThirdPersonCamera';
import { ASSET_MANIFEST } from '../config/assets';
import { CAMERA } from '../config/camera';
import { CAMERA_LENS, RENDER } from '../config/engine';
import { MOKE_BODY } from '../config/movement';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { PickupSystem } from '../interactions/PickupSystem';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import type { MoveIntent } from '../player/Locomotion';
import { Moke } from '../player/Moke';
import { MokeController } from '../player/MokeController';
import { createMokeVisual } from '../player/MokeVisual';
import type { Prop } from '../props/Prop';
import { createRoomProps } from '../props/roomProps';
import { DebugPanel, FrameStats, type DebugValues } from '../ui/DebugPanel';
import type { UIManager } from '../ui/UIManager';
import { LivingRoom } from '../world/LivingRoom';
import { applySoftEnvironment, RoomLighting } from '../world/RoomLighting';
import { AssetManager } from './AssetManager';
import { FixedStep, GameLoop } from './GameLoop';
import { GameRenderer } from './GameRenderer';
import { InputManager } from './InputManager';
import type { Vec2Like } from './InputState';
import { applySettings, loadSettings, saveSettings } from './PlayerSettings';

export type GameState = 'loading' | 'menu' | 'playing' | 'paused';

/**
 * Top-level orchestrator: owns the renderer, scene, input, physics, UI and the game state
 * machine (loading → menu → playing ⇄ paused), and runs the frame:
 *
 *   input.beginFrame → global keys → fixed steps (Moke + physics) → Moke visuals → camera → render → debug
 */
export class Game {
  private state: GameState = 'loading';
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA_LENS.near, CAMERA_LENS.far);
  private readonly gfx: GameRenderer;
  private readonly input: InputManager;
  private readonly assets = new AssetManager();
  private readonly debug: DebugPanel;
  private readonly loop: GameLoop;
  private readonly fixedStep = new FixedStep();
  private readonly frameStats = new FrameStats();
  private readonly room = new LivingRoom();
  private readonly followCamera: ThirdPersonCamera;
  private readonly moveBasis = new MoveBasis();
  private readonly interactions = new InteractionSystem();
  private physics: PhysicsWorld | null = null;
  private moke: Moke | null = null;
  private props: Prop[] = [];
  private pickup: PickupSystem<Prop> | null = null;

  private readonly lookDelta: Vec2Like = { x: 0, y: 0 };
  private readonly moveAxis: Vec2Like = { x: 0, y: 0 };
  private readonly moveIntent: MoveIntent = { x: 0, z: 0, walk: false, run: false };
  private readonly cameraInput: CameraInput = { lookX: 0, lookY: 0, zoom: 0 };
  private readonly cameraTarget: CameraTarget = { position: new Vector3(), heading: 0, speed: 0, headroom: Infinity };

  constructor(
    viewport: HTMLElement,
    private readonly ui: UIManager,
  ) {
    this.gfx = new GameRenderer(viewport);
    this.input = new InputManager(this.gfx.canvas);
    this.debug = new DebugPanel(viewport.parentElement ?? document.body);
    this.loop = new GameLoop(this.gfx.renderer, this.frame);

    this.scene.background = new Color(RENDER.background);
    this.scene.add(new RoomLighting().object, this.room.object);
    applySoftEnvironment(this.gfx.renderer, this.scene);
    this.followCamera = new ThirdPersonCamera(this.camera, this.updateCameraTarget());

    ui.bind({ onPlay: () => this.play(), onResume: () => this.resume() });
    const settings = loadSettings();
    applySettings(settings);
    ui.bindSettings(settings, (changed) => {
      applySettings(changed);
      saveSettings(changed);
    });
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
    await this.assets.preload(ASSET_MANIFEST, (fraction) => this.ui.setLoadingProgress(fraction * 0.4));

    this.ui.setLoadingProgress(0.45, 'Waking up the zoomies…');
    const physics = await PhysicsWorld.create();
    physics.addStaticBoxes(this.room.colliders);
    physics.commitStaticGeometry();
    this.physics = physics;
    const moke = (this.moke = this.spawnMoke(physics));
    this.spawnProps(physics, moke);
    this.followCamera.collider = physics;
    this.followCamera.snapBehind(this.updateCameraTarget());

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
    this.moke?.visual.dispose();
    this.gfx.dispose();
  }

  private spawnMoke(physics: PhysicsWorld): Moke {
    const { position, heading } = this.room.spawn;
    const body = new CharacterBody(physics, position, MOKE_BODY);
    const moke = new Moke(new MokeController(body, heading), createMokeVisual());
    this.scene.add(moke.visual.object);
    return moke;
  }

  /** The loose props, and carrying them: the view rides in the mouth socket, physics stays out of it. */
  private spawnProps(physics: PhysicsWorld, moke: Moke): void {
    this.props = createRoomProps(physics, this.room);
    for (const prop of this.props) this.scene.add(prop.view);
    const pickup = new PickupSystem<Prop>(this.interactions, moke.controller, (origin, direction, max) =>
      physics.rayDistance(origin, direction, max),
    );
    for (const prop of this.props) pickup.add(prop);
    pickup.onPickUp = (prop) => {
      prop.holdIn(moke.visual.mouthSocket);
      moke.carrying = true;
    };
    pickup.onDrop = (prop) => {
      prop.release(this.scene);
      moke.carrying = false;
    };
    this.pickup = pickup;
  }

  private setState(next: GameState): void {
    this.state = next;
    this.input.gameplayFocus = next === 'playing';
    this.followCamera.mode = next === 'loading' || next === 'menu' ? 'attract' : 'follow';
    this.ui.showScreen(next === 'playing' ? null : next);
  }

  private play(): void {
    if (this.state !== 'menu') return;
    this.setState('playing');
    this.followCamera.recenterBehind(this.updateCameraTarget());
    void this.input.requestPointerLock();
    this.ui.showToast('WASD to trot · hold Shift to run · hold C to walk · mouse to look', 5000);
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

    const playing = this.state === 'playing';
    // Discrete actions are read once per rendered frame, so a tap is never missed or doubled.
    if (playing && input.wasPressed('interact')) this.interactions.interact();

    // The world only advances while playing; menus and pause freeze it.
    const alpha = this.fixedStep.advance(playing ? dt : 0, this.fixedUpdate);
    this.moke?.update(dt, alpha);
    for (const prop of this.props) prop.render(alpha);
    this.updateInteractionPrompt(playing);

    input.getLookDelta(this.lookDelta);
    this.cameraInput.lookX = playing ? this.lookDelta.x : 0;
    this.cameraInput.lookY = playing ? this.lookDelta.y : 0;
    this.cameraInput.zoom = playing ? input.getZoomDelta() : 0;
    this.followCamera.update(dt, this.cameraInput, this.updateCameraTarget());
    // Walls can force the camera right up against Moke; hide him then rather than render his insides.
    if (this.moke) this.moke.visual.object.visible = !this.followCamera.isInsideTarget;

    this.gfx.render(this.scene, this.camera);
    this.frameStats.record(dt);
    this.debug.update(dt);
  };

  private readonly fixedUpdate = (step: number): void => {
    if (!this.moke || !this.physics) return;
    this.updateMoveIntent();
    this.moke.fixedUpdate(step, this.moveIntent);
    this.physics.step();
    for (const prop of this.props) prop.afterStep();
  };

  /**
   * WASD relative to the camera: W = away from it. While keys stay held, the reference angle only
   * follows the player's own mouse turns (see MoveBasis), so automatic camera motion can't bend his path.
   */
  private updateMoveIntent(): void {
    const input = this.input.state;
    const axis = input.getMoveAxis(this.moveAxis);
    const moving = axis.x !== 0 || axis.y !== 0;
    const yaw = this.moveBasis.update(moving, this.followCamera.yaw, this.followCamera.takeManualYawDelta());
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    // Camera forward is (-sin, -cos); camera right is (cos, -sin).
    this.moveIntent.x = -sin * axis.y + cos * axis.x;
    this.moveIntent.z = -cos * axis.y - sin * axis.x;
    this.moveIntent.walk = input.isDown('walk');
    this.moveIntent.run = input.isDown('run');
  }

  /** Chooses what E would do now and shows it as "E — …" (hidden outside play). */
  private updateInteractionPrompt(playing: boolean): void {
    const current = playing && this.moke ? this.interactions.update(this.moke.controller) : null;
    this.ui.setPrompt(current ? 'interact' : null, current?.label ?? null);
  }

  /** What the camera follows: Moke as rendered this frame (or the spawn point before he exists). */
  private updateCameraTarget(): CameraTarget {
    const target = this.cameraTarget;
    if (this.moke) {
      const c = this.moke.controller;
      target.position.copy(this.moke.renderPosition);
      target.heading = c.heading;
      target.speed = c.actualSpeed;
      target.headroom = c.headroom;
    } else {
      target.position.copy(this.room.spawn.position);
      target.heading = this.room.spawn.heading;
    }
    return target;
  }

  private registerDebugSections(): void {
    const info = this.gfx.renderer.info;
    const deg = (rad: number) => `${((rad * 180) / Math.PI).toFixed(0)}°`;
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
    this.debug.addSection('Moke', (): DebugValues => {
      if (!this.moke) return { status: 'not spawned' };
      const c = this.moke.controller;
      const p = c.position;
      return {
        position: `${p.x.toFixed(2)}, ${p.y.toFixed(2)}, ${p.z.toFixed(2)}`,
        speed: `${c.actualSpeed.toFixed(2)} m/s (aim ${c.locomotion.targetSpeed.toFixed(2)})`,
        gait: c.gait,
        heading: deg(c.heading),
        'turn rate': `${deg(c.locomotion.turnRate)}/s`,
        grounded: c.grounded,
        headroom: `${c.headroom.toFixed(2)} m (duck ${this.moke.animation.state.crouch.toFixed(2)})`,
      };
    });
    this.debug.addSection('Interaction', (): DebugValues => {
      const current = this.interactions.current;
      const values: DebugValues = {
        registered: this.interactions.count,
        current: current ? `${current.type} "${current.label}"` : '—',
        carrying: this.pickup?.carried?.name ?? '—',
      };
      if (current && this.moke) {
        const p = this.moke.controller.position;
        values.distance = `${Math.hypot(current.position.x - p.x, current.position.z - p.z).toFixed(2)} m (id ${current.id})`;
      }
      return values;
    });
    this.debug.addSection('Physics', (): DebugValues => {
      if (!this.physics) return { status: 'loading' };
      return {
        status: `Rapier ${this.physics.version}`,
        colliders: this.physics.colliderCount,
        bodies: this.physics.bodyCount,
      };
    });
    this.debug.addSection('Input', () => {
      const move = this.input.state.getMoveAxis(this.moveAxis);
      return {
        held: this.input.state.heldActions().join(' ') || '—',
        move: `${move.x.toFixed(2)}, ${move.y.toFixed(2)}`,
      };
    });
    this.debug.addSection('Camera', () => this.followCamera.debugInfo());
  }
}
