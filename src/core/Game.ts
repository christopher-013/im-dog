import { Color, PerspectiveCamera, Scene, Vector3 } from 'three';
import { MoveBasis } from '../camera/MoveBasis';
import { ThirdPersonCamera, type CameraInput, type CameraTarget } from '../camera/ThirdPersonCamera';
import { AudioManager } from '../audio/AudioManager';
import { ASSET_MANIFEST } from '../config/assets';
import { CAMERA } from '../config/camera';
import { CAMERA_LENS, RENDER } from '../config/engine';
import { MOKE_BODY } from '../config/movement';
import { SNIFF } from '../config/senses';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { PickupSystem } from '../interactions/PickupSystem';
import { RestSystem } from '../interactions/RestSystem';
import { REST } from '../config/interaction';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { BarkTimer } from '../player/Bark';
import type { MoveIntent } from '../player/Locomotion';
import { Moke } from '../player/Moke';
import { MokeController } from '../player/MokeController';
import { createMokeVisual } from '../player/MokeVisual';
import type { Prop } from '../props/Prop';
import { createRoomProps } from '../props/roomProps';
import { createRoomScents } from '../senses/roomScents';
import { ScentSystem } from '../senses/ScentSystem';
import { ScentWisps } from '../senses/ScentWisps';
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
  private readonly interactions = new InteractionSystem(undefined, (o, d, max) =>
    this.physics?.rayDistance(o, d, max) ?? max,
  );
  private readonly scent = new ScentSystem();
  private readonly wisps = new ScentWisps();
  private readonly barkTimer = new BarkTimer();
  private readonly audio = new AudioManager();
  private readonly nose = new Vector3();
  private readonly screenPoint = new Vector3();
  private barkedThisFrame = false;
  private growledThisFrame = false;
  private physics: PhysicsWorld | null = null;
  private moke: Moke | null = null;
  private props: Prop[] = [];
  private pickup: PickupSystem<Prop> | null = null;
  private readonly rest: RestSystem;

  private readonly lookDelta: Vec2Like = { x: 0, y: 0 };
  private readonly moveAxis: Vec2Like = { x: 0, y: 0 };
  private readonly moveIntent: MoveIntent = { x: 0, z: 0, walk: false, run: false };
  private readonly stillIntent: MoveIntent = { x: 0, z: 0, walk: false, run: false };
  private readonly cameraInput: CameraInput = { lookX: 0, lookY: 0, zoom: 0 };
  private readonly cameraTarget: CameraTarget = { position: new Vector3(), heading: 0, speed: 0, headroom: Infinity, rest: 0 };

  constructor(
    viewport: HTMLElement,
    private readonly ui: UIManager,
  ) {
    this.gfx = new GameRenderer(viewport);
    this.input = new InputManager(this.gfx.canvas);
    this.debug = new DebugPanel(viewport.parentElement ?? document.body);
    this.loop = new GameLoop(this.gfx.renderer, this.frame);

    const { dogBed, dogBedFront } = this.room.landmarks;
    this.rest = new RestSystem(this.interactions, {
      id: 'dogBed',
      position: dogBed,
      facing: Math.atan2(dogBedFront.x - dogBed.x, dogBedFront.z - dogBed.z),
    });

    this.scene.background = new Color(RENDER.background);
    this.scene.add(new RoomLighting().object, this.room.object, this.wisps.object);
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
    this.audio.dispose();
    this.wisps.dispose();
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
    const pickup = new PickupSystem<Prop>(this.interactions, moke.controller, (origin, direction, max, radius) =>
      physics.sweepWorldSphere(origin, direction, radius, max),
    );
    for (const prop of this.props) pickup.add(prop);
    pickup.onPickUp = (prop) => {
      prop.holdIn(moke.visual.mouthSocket);
      moke.carrying = true;
      this.audio.play('pickup');
    };
    pickup.onDrop = (prop) => {
      prop.release(this.scene);
      moke.carrying = false;
      this.audio.play('drop');
    };
    this.pickup = pickup;
    for (const source of createRoomScents(this.room, this.props)) this.scent.register(source);
  }

  private setState(next: GameState): void {
    this.state = next;
    this.input.gameplayFocus = next === 'playing';
    this.followCamera.mode = next === 'loading' || next === 'menu' ? 'attract' : 'follow';
    this.ui.showScreen(next === 'playing' ? null : next);
  }

  private play(captureMouse = true): void {
    if (this.state !== 'menu') return;
    this.audio.unlock(); // inside the PLAY click: browsers only allow sound after a gesture
    this.setState('playing');
    this.followCamera.recenterBehind(this.updateCameraTarget());
    if (captureMouse) void this.input.requestPointerLock();
    const controls = this.input.gamepad.connected
      ? 'Left stick move · Right stick look · A interact · B bark · X sniff · Y growl'
      : 'WASD to trot · Shift to run · C to walk · F bark · G growl · Q sniff';
    this.ui.showToast(controls, 5000);
  }

  private resume(captureMouse = true): void {
    if (this.state !== 'paused') return;
    this.audio.unlock();
    this.setState('playing');
    if (captureMouse) void this.input.requestPointerLock();
  }

  private pause(): void {
    if (this.state !== 'playing') return;
    this.setState('paused');
    this.input.exitPointerLock();
    this.input.state.releaseAll();
  }

  private readonly frame = (dt: number, elapsed: number): void => {
    this.input.beginFrame(dt);
    const input = this.input.state;
    if (input.wasPressed('toggleDebug')) this.debug.toggle();
    // With pointer lock, the browser eats Esc and we pause via onPointerLockChange instead.
    if (input.wasPressed('pause')) {
      if (this.state === 'playing') this.pause();
      else if (this.state === 'paused') this.resume(false);
    }
    let enteredPlay = false;
    if (input.wasPressed('menuConfirm')) {
      if (this.state === 'menu') {
        this.play(false);
        enteredPlay = true;
      } else if (this.state === 'paused') {
        this.resume(false);
        enteredPlay = true;
      }
    }

    const playing = this.state === 'playing';
    // Discrete actions are read once per rendered frame, so a tap is never missed or doubled.
    if (playing && !enteredPlay) this.handleActions();
    this.barkTimer.update(playing ? dt : 0);

    // The world only advances while playing; menus and pause freeze it.
    const alpha = this.fixedStep.advance(playing ? dt : 0, this.fixedUpdate);
    this.moke?.update(dt, alpha);
    for (const prop of this.props) prop.render(alpha);
    this.updateInteractionPrompt(playing);
    this.updateSniff(playing ? dt : 0, playing);
    this.ui.setResting(playing && this.rest.lying);

    input.getLookDelta(this.lookDelta);
    this.cameraInput.lookX = playing ? this.lookDelta.x : 0;
    this.cameraInput.lookY = playing ? this.lookDelta.y : 0;
    this.cameraInput.zoom = playing ? input.getZoomDelta() : 0;
    this.followCamera.update(dt, this.cameraInput, this.updateCameraTarget());
    // Walls can force the camera right up against Moke; hide him then rather than render his insides.
    if (this.moke) this.moke.visual.object.visible = !this.followCamera.isInsideTarget;
    if (this.barkedThisFrame) this.showBarkBubble();
    if (this.growledThisFrame) this.showGrowlBubble();

    this.gfx.render(this.scene, this.camera);
    this.frameStats.record(elapsed);
    this.debug.update(dt);
  };

  private readonly fixedUpdate = (step: number): void => {
    if (!this.moke || !this.physics) return;
    const c = this.moke.controller;
    this.updateMoveIntent();
    const glideTarget = this.rest.glideTarget;
    if (glideTarget) {
      c.glideTo(step, glideTarget, this.rest.glideHeading(c), REST.settleSpeed, REST.settleTurnRate);
    } else {
      this.moke.fixedUpdate(step, this.rest.holdsMoke ? this.stillIntent : this.moveIntent);
    }
    this.rest.update(step, c);
    this.moke.resting = this.rest.lying;
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

  /** The discrete action keys, once per rendered frame while playing: E interact, F bark, Q sniff. */
  private handleActions(): void {
    const input = this.input.state;
    if (input.wasPressed('interact')) this.interactions.interact();
    // Any fresh movement key gets him up out of his bed.
    const moved = ['moveForward', 'moveBackward', 'moveLeft', 'moveRight'] as const;
    if (this.rest.holdsMoke && (input.wasMoveStarted() || moved.some((a) => input.wasPressed(a)))) this.rest.standUp();
    if (input.wasPressed('bark') && this.moke && this.barkTimer.tryBark()) {
      this.moke.animation.bark();
      this.audio.play('bark');
      this.barkedThisFrame = true;
    }
    if (input.wasPressed('growl') && this.moke) {
      this.moke.animation.growl();
      this.audio.play('growl');
      this.growledThisFrame = true;
    }
    if (input.wasPressed('sniff') && this.scent.start()) this.audio.play('sniff');
  }

  /** Sniff mode: which scents are noticeable from his nose, the wisps, his nose-down pose and the haze. */
  private updateSniff(dt: number, playing: boolean): void {
    if (!this.moke) return;
    const c = this.moke.controller;
    const p = this.moke.renderPosition;
    this.nose.set(p.x + Math.sin(c.heading) * SNIFF.noseForward, p.y + SNIFF.noseHeight, p.z + Math.cos(c.heading) * SNIFF.noseForward);
    this.scent.update(dt, this.nose);
    this.moke.sniffing = this.scent.active;
    this.wisps.update(dt, this.scent, this.nose, this.camera, this.gfx.drawingBufferSize.height);
    this.ui.setSniffing(playing && this.scent.active);
  }

  private showBarkBubble(): void {
    this.barkedThisFrame = false;
    const words = ['Arf!', 'Woof!', 'Arf!', 'Yip!'];
    this.showVoiceBubble(words[Math.floor(Math.random() * words.length)]!);
  }

  private showGrowlBubble(): void {
    this.growledThisFrame = false;
    const words = ['grrr…', 'grr!', 'tiny grrr…'];
    this.showVoiceBubble(words[Math.floor(Math.random() * words.length)]!);
  }

  private showVoiceBubble(text: string): void {
    if (!this.moke) return;
    const v = this.screenPoint.copy(this.moke.renderPosition);
    v.y += 0.5;
    v.project(this.camera);
    if (v.z > 1) return; // behind the camera
    const canvas = this.gfx.canvas;
    this.ui.showBark(((v.x + 1) / 2) * canvas.clientWidth, ((1 - v.y) / 2) * canvas.clientHeight, text);
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
      target.rest = this.moke.animation.state.rest;
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
      audio: this.audio.status,
      barks: this.barkTimer.count,
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
        rest: `${this.rest.phase} (pose ${this.moke.animation.state.rest.toFixed(2)})`,
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
    this.debug.addSection('Scent', (): DebugValues => {
      const values: DebugValues = {
        sniff: this.scent.active ? `on (${this.scent.intensity.toFixed(2)})` : 'off',
        sources: this.scent.sourceCount,
      };
      this.scent.hits.forEach((hit, i) => {
        values[i === 0 ? 'nearby' : ' '.repeat(i)] = `${hit.source.label} (${hit.source.category}) ${hit.distance.toFixed(1)} m · ${hit.intensity.toFixed(2)}`;
      });
      return values;
    });
    this.debug.addSection('Physics', (): DebugValues => {
      if (!this.physics) return { status: 'loading' };
      return {
        status: `Rapier ${this.physics.version}`,
        colliders: this.physics.colliderCount,
        bodies: this.physics.bodyCount,
        props: this.props
          .map((p) => `${p.id} ${p.carried ? 'carried' : p.body.sleeping ? 'asleep' : `${p.body.speed.toFixed(1)} m/s`}`)
          .join(' · '),
      };
    });
    this.debug.addSection('Input', () => {
      const move = this.input.state.getMoveAxis(this.moveAxis);
      return {
        held: this.input.state.heldActions().join(' ') || '—',
        move: `${move.x.toFixed(2)}, ${move.y.toFixed(2)}`,
        gamepad: this.input.gamepad.connected ? this.input.gamepad.name : '—',
        mapping: this.input.gamepad.mapping || '—',
      };
    });
    this.debug.addSection('Camera', () => this.followCamera.debugInfo());
  }
}
