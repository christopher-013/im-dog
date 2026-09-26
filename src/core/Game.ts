import { Color, PerspectiveCamera, Scene, Vector3 } from 'three';
import { MoveBasis } from '../camera/MoveBasis';
import { ThirdPersonCamera, type CameraInput, type CameraTarget } from '../camera/ThirdPersonCamera';
import { AudioManager } from '../audio/AudioManager';
import { ASSET_MANIFEST, MOKE_MODEL_AVAILABLE } from '../config/assets';
import { MOKE_ATTENTION } from '../config/attention';
import { CAMERA } from '../config/camera';
import { CAMERA_LENS, RENDER } from '../config/engine';
import { MOKE_BODY } from '../config/movement';
import { QUALITY, type QualityLevel } from '../config/quality';
import { HUMAN } from '../config/human';
import { SNIFF } from '../config/senses';
import { SockHeistRuntime } from '../heist/SockHeistRuntime';
import { DogActivityDirector, DogLogicBook } from '../activities/DogActivityDirector';
import type { DogActivityContext } from '../activities/DogActivity';
import { MakeHumanPlay } from '../activities/MakeHumanPlay';
import { NAP_QUALITIES, PerfectNap, type NapReport } from '../activities/PerfectNap';
import { TreatHunt } from '../activities/TreatHunt';
import { MOKE_REACTIONS } from '../config/activities';
import { DOG_ACTIVITIES } from '../config/dogActivities';
import { dogLogicEntry } from '../config/dogLogic';
import { HEIST } from '../config/heist';
import { DogLogicMemory } from '../heist/DogLogic';
import { Treat } from '../heist/Treat';
import { HumanActivityController } from '../human/activities/HumanActivityController';
import { HumanReactions } from '../human/activities/HumanReactions';
import { NavGrid } from '../human/NavGrid';
import { HouseholdEffects } from '../world/HouseholdEffects';
import { InteractionSystem } from '../interactions/InteractionSystem';
import { PickupSystem } from '../interactions/PickupSystem';
import { RestSystem } from '../interactions/RestSystem';
import { REST } from '../config/interaction';
import { CharacterBody } from '../physics/CharacterBody';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { BarkTimer, barkOrGrowl } from '../player/Bark';
import type { MoveIntent } from '../player/Locomotion';
import { Moke } from '../player/Moke';
import { pickTrick, type Trick } from '../player/Tricks';
import { MokeController } from '../player/MokeController';
import { AttentionSystem, type AttentionKind, type AttentionObserver } from '../player/AttentionSystem';
import { createMokeVisual, type MokeVisualChoice } from '../player/MokeVisual';
import type { Prop } from '../props/Prop';
import { createRoomProps } from '../props/roomProps';
import { createRoomScents } from '../senses/roomScents';
import { ScentSystem } from '../senses/ScentSystem';
import { ScentWisps } from '../senses/ScentWisps';
import { DebugPanel, FrameStats, type DebugValues } from '../ui/DebugPanel';
import { controlsSummary } from '../ui/ControlGlyphs';
import type { UIManager } from '../ui/UIManager';
import { Home } from '../world/Home';
import { applySoftEnvironment, RoomLighting } from '../world/RoomLighting';
import { AssetManager } from './AssetManager';
import { GameEvents } from './GameEvents';
import { FixedStep, GameLoop } from './GameLoop';
import { GameRenderer } from './GameRenderer';
import { InputManager } from './InputManager';
import { menuCommand } from './MenuInput';
import { AdaptiveResolution, pickQuality } from './Quality';
import type { Vec2Like } from './InputState';
import { applySettings, loadSettings, saveSettings } from './PlayerSettings';

export type GameState = 'loading' | 'menu' | 'playing' | 'paused' | 'complete';

/**
 * Top-level orchestrator: owns the renderer, scene, input, physics, UI and the game state
 * machine (loading → menu → playing ⇄ paused, and playing → complete after a Sock Heist), and runs the frame:
 *
 *   input.beginFrame → global keys → fixed steps (Moke + physics) → Moke visuals → camera → render → debug
 */
export class Game {
  private state: GameState = 'loading';
  private readonly scene = new Scene();
  private readonly camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA_LENS.near, CAMERA_LENS.far);
  private readonly gfx: GameRenderer;
  /** Graphics preset: HIGH on desktop, lower on phones and tablets (see config/quality.ts). */
  private readonly quality: QualityLevel;
  private readonly resolution: AdaptiveResolution;
  private readonly input: InputManager;
  private readonly assets = new AssetManager();
  private readonly debug: DebugPanel;
  private readonly loop: GameLoop;
  private readonly fixedStep = new FixedStep();
  private readonly frameStats = new FrameStats();
  /** The whole house: the living room and hallway, the kitchen, the family room and the dining room. */
  private readonly room = new Home();
  private readonly followCamera: ThirdPersonCamera;
  private readonly moveBasis = new MoveBasis();
  private readonly interactions = new InteractionSystem(undefined, (o, d, max) =>
    this.physics?.rayDistance(o, d, max) ?? max,
  );
  private readonly scent = new ScentSystem();
  private readonly attention = new AttentionSystem();
  /** Where Moke is and how he's moving, for the attention system. Reused every frame (no allocation). */
  private readonly observer: { -readonly [K in keyof AttentionObserver]: AttentionObserver[K] } = {
    position: { x: 0, y: 0, z: 0 },
    heading: 0,
    speed: 0,
  };
  private visualChoice: MokeVisualChoice | null = null;
  private readonly wisps = new ScentWisps();
  private readonly barkTimer = new BarkTimer();
  private readonly audio = new AudioManager();
  private readonly nose = new Vector3();
  private readonly screenPoint = new Vector3();
  private barkedThisFrame = false;
  private growledThisFrame = false;
  private lastTrick: Trick | null = null;
  private physics: PhysicsWorld | null = null;
  private moke: Moke | null = null;
  private props: Prop[] = [];
  private pickup: PickupSystem<Prop> | null = null;
  private readonly rest: RestSystem;
  /** Gameplay events (Sock Heist publishes; UI, audio and the heist listen). */
  private readonly events = new GameEvents();
  private heist: SockHeistRuntime | null = null;
  /** The human's daily life around the house (Phase 4), and how they respond to Moke. */
  private readonly routine: HumanActivityController;
  private readonly reactions = new HumanReactions();
  /** The TV glow, the cooking pot, dinner on the table. */
  private readonly household = new HouseholdEffects();
  /** Dog Logic: what Moke has learned (remembered in this browser), and the moments he learns it. */
  private readonly dogLogic: DogLogicBook;
  private readonly logicMemory = new DogLogicMemory();
  /** Treat Hunt, Perfect Nap, Make Human Play. */
  private director: DogActivityDirector | null = null;
  private hunt: TreatHunt | null = null;
  private readonly huntTreat = new Treat('hunt', DOG_ACTIVITIES.treatHunt.scentRadius);
  /** The human's walkable grid over the whole house. */
  private nav: NavGrid | null = null;
  /** Set by a bark or growl, read once by the dog activities in the next fixed step. */
  private barkForActivities = false;
  private nearStoveFor = 0;
  private wasAttending = false;
  private zzzIn = 0;

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
    const params = new URLSearchParams(location.search);
    this.quality = pickQuality({
      forced: params.get('quality'),
      touchPrimary: matchMedia('(pointer: coarse)').matches && (navigator.maxTouchPoints ?? 0) > 0,
      memoryGB: (navigator as Navigator & { deviceMemory?: number }).deviceMemory,
      cores: navigator.hardwareConcurrency,
    });
    const quality = QUALITY[this.quality];
    this.resolution = new AdaptiveResolution(quality);
    this.gfx = new GameRenderer(viewport, quality);
    this.input = new InputManager(this.gfx.canvas, ui.touchRoot);
    this.debug = new DebugPanel(viewport.parentElement ?? document.body);
    this.loop = new GameLoop(this.gfx.renderer, this.frame);

    this.routine = new HumanActivityController(this.room.places, this.events);
    this.routine.reactions = this.reactions;
    this.reactions.say = (text, mood) => this.routine.say(text, mood);
    this.reactions.onPet = () => this.petted();
    this.dogLogic = new DogLogicBook(this.logicMemory, this.events);
    // Somewhere to lie down all over the house: his bed, his blanket, the sofas, the hearth (Perfect Nap).
    const { dogBed, dogBedFront } = this.room.landmarks;
    this.rest = new RestSystem(
      this.interactions,
      this.room.napSpots.map((spot) => ({
        id: spot.id,
        position: spot.position,
        facing: spot.id === 'dogBed' ? Math.atan2(dogBedFront.x - dogBed.x, dogBedFront.z - dogBed.z) : spot.facing,
        label: spot.id === 'dogBed' ? 'Lie Down' : 'Nap Here',
      })),
    );

    this.scene.background = new Color(RENDER.background);
    this.scene.add(new RoomLighting(quality, { ...this.room.bounds, height: 2.7 }).object, this.room.object, this.wisps.object, this.household.object);
    this.events.on('DOG_LOGIC_DISCOVERED', ({ id, first }) => {
      this.ui.showDiscovery(first, HEIST.discoveryTime * 1000 - 250, dogLogicEntry(id));
      this.audio.play('discovery');
    });
    applySoftEnvironment(this.gfx.renderer, this.scene);
    this.followCamera = new ThirdPersonCamera(this.camera, this.updateCameraTarget());

    ui.bind({
      onPlay: () => this.play(),
      onResume: () => this.resume(),
      onPlayAgain: () => this.playAgain(),
      onKeepExploring: () => this.keepExploring(),
    });
    const settings = loadSettings();
    applySettings(settings);
    this.audio.setMusic(settings.music, settings.musicVolume);
    ui.bindSettings(settings, (changed) => {
      applySettings(changed);
      this.audio.setMusic(changed.music, changed.musicVolume);
      saveSettings(changed);
    });
    ui.setInputMode(this.input.mode);
    this.input.onModeChange = (mode) => {
      ui.setInputMode(mode);
      if (mode !== 'keyboard') ui.setPointerHint(false);
    };
    this.input.onPointerLockChange = (locked) => {
      if (!locked && this.state === 'playing') this.pause();
      this.ui.setPointerHint(this.state === 'playing' && !locked && this.input.mode === 'keyboard');
    };
    this.input.onPointerLockError = () => {
      if (this.state === 'playing' && this.input.mode === 'keyboard') this.ui.setPointerHint(true);
    };
    this.gfx.canvas.addEventListener('click', () => {
      if (this.state === 'playing' && !this.input.isPointerLocked) void this.input.requestPointerLock();
    });
    this.gfx.onContextLost = () => this.ui.showToast('Graphics hiccup. Trying to recover…', 6000);
    this.gfx.onContextRestored = () => this.ui.showToast('Back!', 2000);

    // Phones stop web audio by themselves (a call, the lock screen, switching apps), and only a user gesture may
    // start it again: every tap, click or key wakes it. (Pointer-down counts for a mouse, pointer-up for a finger.)
    for (const type of ['pointerdown', 'pointerup', 'touchend', 'keydown'] as const) {
      window.addEventListener(type, () => this.audio.wake(), { capture: true, passive: true });
    }

    // Phone locked, app switched, tab hidden: pause (never keep running unseen) and silence the audio.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
        this.audio.suspend();
      } else {
        this.loop.resetClock();
      }
    });

    this.registerDebugSections();
    if (params.has('debug')) this.debug.setVisible(true);
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
    this.spawnHeist(physics, moke);
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

  /** Development: put Moke somewhere (`imdog.teleport(13, 3)` in the console) with the camera behind him. */
  teleport(x: number, z: number, heading = 0, y = 0): void {
    if (!this.moke) return;
    this.moke.controller.teleport({ x, y, z }, heading);
    this.moke.update(0, 1);
    this.followCamera.snapBehind(this.updateCameraTarget());
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
    this.visualChoice = createMokeVisual(this.assets.getGLTF('moke'), MOKE_MODEL_AVAILABLE);
    const moke = new Moke(new MokeController(body, heading), this.visualChoice.visual);
    this.scene.add(moke.visual.object);
    return moke;
  }

  /** The loose props, and carrying them: the view rides in the mouth socket, physics stays out of it. */
  private spawnProps(physics: PhysicsWorld, moke: Moke): void {
    this.props = createRoomProps(physics, this.room, this.room.bounds);
    for (const prop of this.props) this.scene.add(prop.view);
    const pickup = new PickupSystem<Prop>(this.interactions, moke.controller, (origin, direction, max, radius) =>
      physics.sweepWorldSphere(origin, direction, radius, max),
    );
    for (const prop of this.props) pickup.add(prop);
    pickup.onPickUp = (prop) => {
      prop.holdIn(moke.visual.attachments.mouth);
      moke.carrying = true;
      this.audio.play('pickup');
      if (prop.id === 'sock') this.events.emit('SOCK_PICKED_UP', { by: 'moke' });
    };
    pickup.onDrop = (prop) => {
      prop.release(this.scene);
      moke.carrying = false;
      this.audio.play('drop');
      if (prop.id === 'sock') this.events.emit('SOCK_DROPPED', { at: prop.position });
    };
    // A trade: the sock goes into the human's hand, not back into the world.
    pickup.onHandOver = () => {
      moke.carrying = false;
      this.audio.play('drop');
    };
    this.pickup = pickup;
    for (const source of createRoomScents(this.room, this.props)) this.scent.register(source);
    this.registerAttention();
  }

  /** Sock Heist: the human, the treat and the trade (see heist/SockHeistRuntime.ts and docs/SOCK_HEIST.md). */
  private spawnHeist(physics: PhysicsWorld, moke: Moke): void {
    const sock = this.props.find((p) => p.id === 'sock');
    if (!sock || !this.pickup) return;
    this.nav = new NavGrid(this.room.colliders, { bounds: this.room.bounds, cell: 0.1, agentRadius: HUMAN.body.radius, minY: 0.08, maxY: 1.7 });
    this.heist = new SockHeistRuntime({
      scene: this.scene,
      physics,
      room: this.room,
      events: this.events,
      interactions: this.interactions,
      pickup: this.pickup,
      sock,
      moke,
      scent: this.scent,
      attention: this.attention,
      ui: this.ui,
      audio: this.audio,
      mokeSays: (text) => this.showVoiceBubble(text),
      routine: this.routine,
      nav: this.nav,
      memory: this.logicMemory,
    });
    this.events.on('HEIST_COMPLETE', ({ seconds }) => this.completeHeist(seconds));
    this.spawnDogActivities(physics, moke);
  }

  /**
   * The Phase 4 dog activities, and asking the human for pets. They start themselves: a trick near the human (Treat
   * Hunt), lying down somewhere (Perfect Nap), bringing them a toy (Make Human Play).
   */
  private spawnDogActivities(physics: PhysicsWorld, moke: Moke): void {
    const heist = this.heist;
    const nav = this.nav;
    if (!heist || !nav) return;
    const human = heist.human;
    const treat = this.huntTreat;
    this.scent.register(treat.scent);
    this.attention.register(treat.attention);
    this.interactions.register(treat.interactable);
    this.scent.register(this.household.foodScent);

    const hunt = new TreatHunt({
      routine: this.routine,
      hand: human.visual.hands.right,
      treat,
      scene: this.scene,
      jar: this.room.kitchenTreats,
      spots: this.room.treatHidingSpots,
      nav,
      mokeCanSee: (spot) => physics.lineOfSight({ x: moke.controller.position.x, y: moke.controller.position.y + 0.33, z: moke.controller.position.z }, { x: spot.x, y: 0.08, z: spot.z }),
      roomName: (at) => this.room.roomAt(at.x, at.z).name,
      onFound: (seconds) => {
        moke.animation.eat();
        this.audio.play('crunch');
        this.showVoiceBubble('Nom nom!');
        this.dogLogic.discover('sniff=treat');
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        window.setTimeout(() => this.ui.showToast(`Treat Hunt: found it in ${m}:${String(s).padStart(2, '0')}!`, 3500), HEIST.discoveryTime * 1000);
      },
    });
    this.hunt = hunt;
    const nap = new PerfectNap({
      spots: this.room.napSpots,
      fire: this.room.fire,
      noise: () => this.noiseAt(),
      humanPosition: () => human.controller.position,
      onNapped: (report) => this.napped(report),
    });
    const toys = this.props.filter((p) => p.id === 'ball' || p.id === 'toy');
    const play = new MakeHumanPlay({
      routine: this.routine,
      reactions: this.reactions,
      toys,
      hand: human.visual.hands.right,
      scene: this.scene,
      clearDistance: (from, direction, max) => physics.sweepWorldSphere(from, direction, 0.08, max),
      openFloor: (x, z) => nav.isWalkable(x, z),
      onThrow: (toy, first) => {
        this.audio.play('whoosh');
        this.dogLogic.discover(toy.id === 'ball' ? 'human+ball=play' : 'human+toy=play', !first);
      },
    });
    this.director = new DogActivityDirector([hunt, nap, play]);

    // "Get Pets": close to the human while they're free.
    const game = this;
    this.interactions.register({
      id: 'human:pet',
      type: 'PET',
      label: 'Get Pets',
      interactionDistance: MOKE_REACTIONS.petReach,
      get enabled() {
        return !moke.carrying && !heist.heist.running && game.reactions.canPet(game.routine);
      },
      get position() {
        return human.controller.position;
      },
      requiresClearPath: false,
      priority: 5,
      interact: () => this.reactions.requestPet(),
    });
  }

  /** The human reached down to pet him: he sits, leans in and wags; a little heart. */
  private petted(): void {
    const moke = this.moke;
    if (!moke || moke.carrying) return;
    moke.animation.cancelTrick();
    moke.animation.pet();
    this.showVoiceBubble('♥');
  }

  /** Something noisy right now (the TV on, dinner cooking), for how quiet a nap spot is. */
  private noiseAt(): { x: number; y: number; z: number } | null {
    const effect = this.routine.effect;
    const place = this.routine.place;
    if (effect === 'tv' && place?.look) return place.look;
    if (effect === 'cooking') return this.household.foodScent.position;
    return null;
  }

  /** A nap judged: the card (five little signs), and what it taught him. */
  private napped(report: NapReport): void {
    const icons: Record<(typeof NAP_QUALITIES)[number], [string, string]> = {
      sunny: ['sun', 'Sunny'],
      soft: ['soft', 'Soft'],
      warm: ['warm', 'Warm'],
      quiet: ['quiet', 'Quiet'],
      nearHuman: ['human', 'Human nearby'],
    };
    const signs = NAP_QUALITIES.map((q) => ({ icon: icons[q][0], label: icons[q][1], lit: report.qualities[q] }));
    this.ui.showNap(report.perfect ? 'Perfect nap!' : 'Nap', signs, report.caption);
    for (const id of report.learned) this.dogLogic.discover(id, true);
  }

  /** "Sock Heist Complete": the card with PLAY AGAIN / KEEP EXPLORING (the world waits behind it). */
  private completeHeist(seconds: number): void {
    if (this.state !== 'playing') return;
    this.setState('complete');
    this.ui.showComplete(seconds);
    this.input.exitPointerLock();
    this.input.releaseAll();
  }

  private playAgain(): void {
    if (this.state !== 'complete') return;
    this.director?.cancelAll();
    this.hunt?.resetAll();
    this.heist?.heist.reset();
    this.ui.clearHeist();
    this.audio.unlock();
    this.setState('playing');
    void this.input.requestPointerLock();
  }

  private keepExploring(): void {
    if (this.state !== 'complete') return;
    this.heist?.heist.keepExploring();
    this.ui.clearHeist();
    this.audio.unlock();
    this.setState('playing');
    void this.input.requestPointerLock();
  }

  /** What catches Moke's eye: the loose props (not while in his mouth) and his bed. */
  private registerAttention(): void {
    const kinds: Record<string, AttentionKind> = { sock: 'sock', ball: 'ball', toy: 'toy' };
    for (const prop of this.props) {
      const kind = kinds[prop.id] ?? 'toy';
      this.attention.register({
        id: prop.id,
        kind,
        interest: MOKE_ATTENTION.interest[kind],
        get position() {
          return prop.position;
        },
        get enabled() {
          return !prop.carried;
        },
      });
    }
    const bed = this.room.landmarks.dogBed;
    this.attention.register({ id: 'dogBed', kind: 'bed', interest: MOKE_ATTENTION.interest.bed, position: { x: bed.x, y: 0.12, z: bed.z } });
  }

  /** Visual only: something for Moke to glance at, or the strongest scent while he sniffs. */
  private updateAttention(dt: number): void {
    const moke = this.moke;
    if (!moke) return;
    this.attention.focus = this.scent.active && this.scent.hitsLength > 0 ? this.scent.hitAt(0).source.position : null;
    const busy = this.rest.holdsMoke || moke.animation.performingTrick;
    const c = moke.controller;
    const observer = this.observer;
    observer.position = moke.renderPosition;
    observer.heading = c.heading;
    observer.speed = c.actualSpeed;
    moke.lookAt = this.attention.update(dt, observer, busy);
  }

  private setState(next: GameState): void {
    this.state = next;
    this.input.gameplayFocus = next === 'playing';
    this.followCamera.mode = next === 'loading' || next === 'menu' ? 'attract' : 'follow';
    this.ui.showScreen(next === 'playing' ? null : next);
    this.ui.setPlaying(next === 'playing');
    this.audio.duckMusic(next === 'paused');
  }

  private play(captureMouse = true): void {
    if (this.state !== 'menu') return;
    this.audio.unlock(); // inside the PLAY click: browsers only allow sound after a gesture
    this.audio.startMusic();
    this.setState('playing');
    this.followCamera.recenterBehind(this.updateCameraTarget());
    if (captureMouse) void this.input.requestPointerLock();
    this.showControlsIntro();
  }

  /** The first time on each kind of controls, a few seconds of how-to; after that, a one-line reminder. */
  private showControlsIntro(): void {
    const mode = this.input.mode;
    const seenKey = `imdog.onboarded.${mode}`;
    let seen = false;
    try {
      seen = localStorage.getItem(seenKey) === '1';
      localStorage.setItem(seenKey, '1');
    } catch {
      // Private mode or blocked storage: just show it.
    }
    if (seen) this.ui.showToast(controlsSummary(mode), 5000);
    else this.ui.showOnboarding(mode);
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
    this.input.releaseAll();
  }

  private readonly frame = (dt: number, elapsed: number): void => {
    this.input.beginFrame(dt);
    const input = this.input.state;
    if (input.wasPressed('toggleDebug')) this.debug.toggle();
    // With pointer lock, the browser eats Esc and we pause via onPointerLockChange instead.
    const command = menuCommand(this.state, (action) => input.wasPressed(action), this.ui.controlsOpen);
    if (command === 'pause') this.pause();
    else if (command === 'resume') this.resume(false);
    else if (command === 'play') this.play(false);
    else if (command === 'closeControls') this.ui.closeControls();
    else if (command === 'playAgain') this.playAgain();
    // The press that started or resumed play mustn't also count as an in-game action (A is also "interact").
    const enteredPlay = command === 'resume' || command === 'play' || command === 'playAgain';

    const playing = this.state === 'playing';
    // Discrete actions are read once per rendered frame, so a tap is never missed or doubled.
    if (playing && !enteredPlay) this.handleActions();
    this.barkTimer.update(playing ? dt : 0);

    // The world only advances while playing; menus and pause freeze it.
    const alpha = this.fixedStep.advance(playing ? dt : 0, this.fixedUpdate);
    this.updateAttention(dt);
    this.moke?.update(dt, alpha);
    this.heist?.update(dt, alpha, this.camera, this.gfx.canvas, playing, this.director?.objective ?? null);
    this.huntTreat.update();
    this.household.update(dt, { effect: this.routine.effect, place: this.routine.place });
    this.updateNapping(playing ? dt : 0, playing);
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

    // Dynamic resolution on phones: a slightly softer picture beats a stuttering one.
    if (playing && this.resolution.update(dt, elapsed * 1000)) this.gfx.pixelRatioCap = this.resolution.pixelRatio;
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
      // A trick holds him in place; heading off somewhere cuts it short.
      const tricking = this.moke.animation.holdsStillForTrick;
      if (tricking && (this.moveIntent.x !== 0 || this.moveIntent.z !== 0)) this.moke.animation.cancelTrick();
      const stayPut = this.rest.holdsMoke || this.moke.animation.holdsStillForTrick || this.moke.animation.eating || this.moke.animation.petting;
      this.moke.fixedUpdate(step, stayPut ? this.stillIntent : this.moveIntent);
    }
    this.rest.update(step, c);
    this.moke.resting = this.rest.lying;
    this.heist?.fixedUpdate(step);
    this.updateDogActivities(step);
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

  /** The discrete action keys, once per rendered frame while playing: E interact, Space jump, F bark or growl, Q trick, R sniff. */
  private handleActions(): void {
    const input = this.input.state;
    if (input.wasPressed('interact')) {
      this.moke?.animation.cancelTrick();
      // Nothing to use here: the paw (or E) sniffs instead, so a phone can hunt for treats without a sniff button.
      if (!this.interactions.interact() && !this.rest.holdsMoke && !this.moke?.animation.performingTrick && this.scent.start()) this.audio.play('sniff');
    }
    // Any fresh movement key (or a jump) gets him up out of his bed.
    const moved = ['moveForward', 'moveBackward', 'moveLeft', 'moveRight', 'jump'] as const;
    const wasResting = this.rest.holdsMoke;
    if (wasResting && (input.wasMoveStarted() || moved.some((a) => input.wasPressed(a)))) this.rest.standUp();
    if (input.wasPressed('jump') && !wasResting) this.jump();
    if (input.wasPressed('bark') && this.moke) {
      if (barkOrGrowl() === 'growl') this.growl();
      else this.bark();
    }
    if (input.wasPressed('trick')) this.startTrick();
    if (input.wasPressed('sniff') && !this.moke?.animation.performingTrick && this.scent.start()) this.audio.play('sniff');
  }

  /** Up he goes (MokeController decides whether he can: on his feet, nothing low overhead, under the height cap). */
  private jump(): void {
    const moke = this.moke;
    if (!moke || moke.animation.eating) return;
    moke.animation.cancelTrick();
    moke.controller.requestJump();
  }

  private bark(): void {
    if (!this.moke || !this.barkTimer.tryBark()) return;
    this.moke.animation.bark();
    this.audio.play('bark');
    this.barkedThisFrame = true;
    this.heist?.noteBark();
    this.barkForActivities = true;
  }

  private growl(): void {
    if (!this.moke) return;
    this.barkForActivities = true;
    this.moke.animation.growl();
    this.audio.play('growl');
    this.growledThisFrame = true;
  }

  /** A random trick (see Tricks.ts): not while in his bed, sniffing, or already doing one. */
  private startTrick(): void {
    const moke = this.moke;
    if (!moke || this.rest.holdsMoke || this.scent.active || moke.animation.performingTrick) return;
    const trick = pickTrick(Math.random, this.lastTrick, { carrying: moke.carrying, headroom: moke.controller.headroom });
    if (trick && moke.animation.trick(trick)) this.lastTrick = trick;
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

  /** Each fixed step: the dog activities see what Moke and the human are up to, and a couple of Dog Logic moments. */
  private updateDogActivities(step: number): void {
    const moke = this.moke;
    const heist = this.heist;
    if (!moke || !heist || !this.director) return;
    const human = heist.human;
    const c = moke.controller;
    const ctx: DogActivityContext = {
      moke: {
        position: c.position,
        speed: c.actualSpeed,
        carrying: this.pickup?.carried?.id ?? null,
        barked: this.barkForActivities,
        trick: moke.animation.performingTrick,
        sniffing: this.scent.active,
        napSpot: this.rest.lying ? this.rest.spot.id : null,
      },
      human: {
        position: human.controller.position,
        available: this.routine.available && !heist.heist.running,
        seesMoke: human.brain.seesMoke,
        engaged: this.reactions.engaged,
      },
      heistRunning: heist.heist.running,
    };
    this.barkForActivities = false;
    this.director.update(step, ctx);

    // KITCHEN = FOOD?: hanging about the stove while dinner cooks.
    const food = this.household.foodScent;
    const byStove = this.routine.effect === 'cooking' && Math.hypot(c.position.x - food.position.x, c.position.z - food.position.z) < 2.2;
    this.nearStoveFor = byStove ? this.nearStoveFor + step : 0;
    if (this.nearStoveFor > 3) {
      this.nearStoveFor = -Infinity;
      this.dogLogic.discover('kitchen=food?', true);
    }
    // BARK = ATTENTION: barking until the human gives in.
    const attending = this.reactions.kind === 'attend';
    if (attending && !this.wasAttending) this.dogLogic.discover('bark=attention', true);
    this.wasAttending = attending;
  }

  /** Napping: little z's over him and the edges of the screen dim softly. */
  private updateNapping(dt: number, playing: boolean): void {
    const napping = playing && this.rest.lying;
    this.ui.setNapping(napping);
    if (!napping) {
      this.zzzIn = 1.2;
      return;
    }
    this.zzzIn -= dt;
    if (this.zzzIn <= 0) {
      this.zzzIn = DOG_ACTIVITIES.perfectNap.zzzEvery;
      const words = ['z…', 'Zz…', 'zzz…'];
      this.showVoiceBubble(words[Math.floor(Math.random() * words.length)]!);
    }
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
        quality: `${this.quality}${QUALITY[this.quality].adaptive ? ` (cap ${this.gfx.pixelRatioCap.toFixed(2)})` : ''}`,
        'pixel ratio': this.gfx.pixelRatio.toFixed(2),
        buffer: `${width}×${height}`,
      };
    });
    this.debug.addSection('Game', () => ({
      state: this.state,
      'pointer lock': this.input.pointerLockSupported ? (this.input.isPointerLocked ? 'locked' : 'free') : 'unsupported',
      'fixed step': `${(this.fixedStep.step * 1000).toFixed(2)} ms`,
      audio: `${this.audio.status}${this.audio.musicPlaying ? ` · music: ${this.audio.musicPlaying}` : ''}`,
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
        trick: this.moke.animation.state.trick ?? '—',
        visual: this.visualChoice ? `${this.visualChoice.kind}${this.visualChoice.notes.length ? ` (${this.visualChoice.notes.length} note${this.visualChoice.notes.length > 1 ? 's' : ''}, see console)` : ''}` : '—',
        'looking at': this.attention.focus ? 'scent' : (this.attention.target?.id ?? '—'),
        'sit / stretch': `${this.moke.animation.state.sit.toFixed(2)} / ${this.moke.animation.state.stretch.toFixed(2)}`,
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
        mode: this.input.mode,
        viewport: `${window.innerWidth}×${window.innerHeight} ${matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape'} · DPR ${window.devicePixelRatio}`,
        held: this.input.state.heldActions().join(' ') || '—',
        move: `${move.x.toFixed(2)}, ${move.y.toFixed(2)}`,
        gamepad: this.input.gamepad.connected ? this.input.gamepad.name : '—',
        mapping: this.input.gamepad.mapping || '—',
      };
    });
    this.debug.addSection('Sock Heist', (): DebugValues => {
      const runtime = this.heist;
      if (!runtime) return { status: 'not set up' };
      const { heist, human } = runtime;
      const b = human.brain;
      const p = human.controller.position;
      return {
        phase: `${heist.phase} (${heist.elapsed.toFixed(0)} s)`,
        human: `${b.state} ${b.timeInState.toFixed(1)} s`,
        'sees Moke': b.seesMoke,
        frustration: `${b.frustration.toFixed(1)} / ${HUMAN.chase.giveUpAt}`,
        holding: [b.hasSock ? 'sock' : '', b.hasTreat ? 'treat' : ''].filter(Boolean).join(' + ') || '—',
        'human at': `${p.x.toFixed(2)}, ${p.z.toFixed(2)} · ${human.controller.speed.toFixed(2)} m/s`,
        treat: heist.treat.state,
        events: this.events.recent.join(' › ') || '—',
      };
    });
    this.debug.addSection('Dog activities', (): DebugValues => {
      const values: DebugValues = {};
      for (const a of this.director?.activities ?? []) values[a.name] = `${a.state} ${a.stateTime.toFixed(0)} s · ✓${a.successes}`;
      values.reaction = this.reactions.kind ?? '—';
      return values;
    });
    this.debug.addSection('Human routine', (): DebugValues => {
      const r = this.routine;
      const c = this.heist?.human.controller;
      return {
        doing: r.role ? `role: ${r.role.id}` : r.activity ? `${r.activity.name} (${r.phase})` : r.phase,
        place: r.place?.id ?? '—',
        'time left': r.phase === 'doing' ? `${r.stepLeft.toFixed(0)} s` : '—',
        room: c ? this.room.roomAt(c.position.x, c.position.z).name : '—',
        seat: c ? `${c.seat ? 'on seat' : 'standing'} (${c.seatBlend.toFixed(2)})${c.stuckFor > 0 ? ` · stuck ${c.stuckFor.toFixed(1)} s` : ''}` : '—',
        last: r.last ?? '—',
      };
    });
    this.debug.addSection('Camera', () => this.followCamera.debugInfo());
  }
}
