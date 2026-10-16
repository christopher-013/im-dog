import {
  CircleGeometry,
  Color,
  DirectionalLight,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  RingGeometry,
  Scene,
  Vector2,
  Vector3,
  type WebGLRenderer,
} from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { DOG_SELECT } from '../config/dogSelect';
import type { DogProfile } from '../config/dogs';
import { damp } from '../utils/math';
import { MokeAnimationController } from './MokeAnimationController';
import { createPreviewVisual, type MokeVisual } from './MokeVisual';

interface PreviewDog {
  readonly profile: DogProfile;
  readonly visual: MokeVisual;
  readonly animation: MokeAnimationController;
  readonly shadow: Mesh;
  x: number;
  z: number;
  scale: number;
  hopIn: number;
  hopT: number;
  barkIn: number;
}

/**
 * The Choose Your Dog stage: every playable dog side by side, facing you, in a warm little spotlight. The highlighted
 * one is bigger and lively (looking at you, head tilts, blinks and tail wags from its own animation state, a playful
 * hop now and then, a silent happy bark); the others wait, and sit down after a moment. Drawn by the game's own
 * renderer while the screen is up (not the house), and disposed when it closes: lightweight, nothing left behind.
 * Its dogs are their own visuals (never the in-game one), so the game's dog is untouched.
 */
export class DogPreview {
  readonly scene = new Scene();
  readonly camera = new PerspectiveCamera(DOG_SELECT.fov, 1, 0.05, 30);
  private readonly dogs: PreviewDog[] = [];
  private readonly spot: Mesh<RingGeometry, MeshBasicMaterial>;
  private readonly floor: Mesh<CircleGeometry, MeshBasicMaterial>;
  private readonly shadowGeometry = new CircleGeometry(0.2, 32);
  private readonly shadowMaterial = new MeshBasicMaterial({ color: '#7a5a3c', transparent: true, opacity: 0.16, depthWrite: false });
  private readonly target = new Vector3();
  private readonly projected = new Vector3();
  private readonly bufferSize = new Vector2();
  /** How many dogs stand on the stage (set before they're placed, so their slots are right from the start). */
  private readonly total: number;
  private highlighted = 0;
  private time = 0;
  private aspect = 0;
  /** How far apart the dogs stand: closer on a narrow screen (see `frame`). */
  private spacing: number = DOG_SELECT.spacing;
  /** Shaders compiled (renderer.compileAsync), so the first frame doesn't hitch. */
  ready = false;

  constructor(
    profiles: readonly DogProfile[],
    gltf: Pick<GLTF, 'scene' | 'animations'> | undefined,
    private readonly random: () => number = Math.random,
  ) {
    this.total = profiles.length;
    this.scene.background = new Color(DOG_SELECT.background);
    this.scene.add(new HemisphereLight('#fff8ee', '#8a7058', 1.35));
    const key = new DirectionalLight('#ffffff', 1.9);
    key.position.set(-1.2, 2.4, 3);
    this.scene.add(key);

    this.floor = new Mesh(new CircleGeometry(3.2, 64), new MeshBasicMaterial({ color: DOG_SELECT.floor }));
    this.floor.rotation.x = -Math.PI / 2;
    this.floor.position.y = -0.002;
    this.scene.add(this.floor);
    this.spot = new Mesh(new RingGeometry(0.0, 0.34, 48), new MeshBasicMaterial({ color: DOG_SELECT.spotlight, transparent: true, opacity: 0.9, depthWrite: false }));
    this.spot.rotation.x = -Math.PI / 2;
    this.spot.position.y = 0.001;
    this.scene.add(this.spot);

    profiles.forEach((profile, i) => {
      const visual = createPreviewVisual(profile, gltf);
      const shadow = new Mesh(this.shadowGeometry, this.shadowMaterial);
      shadow.rotation.x = -Math.PI / 2;
      shadow.position.y = 0.002;
      shadow.scale.set(1, 0.7, 1);
      this.scene.add(visual.object, shadow);
      const dog: PreviewDog = {
        profile,
        visual,
        animation: new MokeAnimationController(undefined, this.random),
        shadow,
        x: this.slotX(i),
        z: DOG_SELECT.restBack,
        scale: DOG_SELECT.restScale,
        hopIn: this.between(DOG_SELECT.hopEvery),
        hopT: -1,
        barkIn: this.between(DOG_SELECT.barkEvery),
      };
      this.dogs.push(dog);
    });
    this.update(0, 0, false);
  }

  get count(): number {
    return this.dogs.length;
  }

  /** Each rendered frame while the screen is up: `highlighted` is the dog in the spotlight. */
  update(dt: number, highlighted: number, reducedMotion: boolean): void {
    this.time += dt;
    if (highlighted !== this.highlighted) {
      this.highlighted = highlighted;
      const dog = this.dogs[highlighted];
      if (dog && !reducedMotion) dog.hopIn = 0.05; // a happy hop to say hello
    }
    const ease = reducedMotion ? 60 : DOG_SELECT.ease;
    for (const [i, dog] of this.dogs.entries()) {
      const lit = i === highlighted;
      dog.x = damp(dog.x, this.slotX(i), ease, dt);
      dog.z = damp(dog.z, lit ? DOG_SELECT.litForward : DOG_SELECT.restBack, ease, dt);
      dog.scale = damp(dog.scale, lit ? DOG_SELECT.highlightScale : DOG_SELECT.restScale, ease, dt);
      // A playful hop now and then, and a silent happy bark (the highlighted dog only; never with reduced motion).
      let lift = 0;
      let airborne = false;
      let rising = 0;
      if (lit && !reducedMotion) {
        dog.hopIn -= dt;
        if (dog.hopIn <= 0 && dog.hopT < 0) {
          dog.hopT = 0;
          dog.hopIn = this.between(DOG_SELECT.hopEvery);
        }
        dog.barkIn -= dt;
        if (dog.barkIn <= 0) {
          dog.animation.bark();
          dog.barkIn = this.between(DOG_SELECT.barkEvery);
        }
      }
      if (dog.hopT >= 0) {
        dog.hopT += dt;
        const u = dog.hopT / DOG_SELECT.hopTime;
        if (u >= 1) dog.hopT = -1;
        else {
          lift = DOG_SELECT.hopHeight * 4 * u * (1 - u);
          airborne = true;
          rising = u < 0.5 ? 1 : -1;
        }
      }
      // Looking at you: the camera is straight ahead, a little above.
      const look = lit ? { yaw: -dog.x * 0.35, pitch: 0.18 } : null;
      const state = dog.animation.update(dt, { speed: 0, turnRate: 0, headroom: Infinity, airborne, verticalSpeed: rising * 1.5, look });
      dog.visual.object.position.set(dog.x, lift, dog.z);
      // Facing you, turned a touch towards the middle.
      dog.visual.object.rotation.y = -dog.x * 0.28;
      dog.visual.object.scale.setScalar(dog.scale);
      dog.visual.update(dt, state);
      dog.shadow.position.x = dog.x;
      dog.shadow.position.z = dog.z;
      dog.shadow.scale.set(dog.scale * (1 - lift * 2), dog.scale * 0.7 * (1 - lift * 2), 1);
    }
    const lit = this.dogs[highlighted];
    if (lit) {
      this.spot.position.x = lit.x;
      this.spot.position.z = lit.z;
      this.spot.scale.setScalar(lit.scale);
    }
  }

  /** Draws the stage into the game's canvas (already sized by GameRenderer). */
  render(renderer: WebGLRenderer): void {
    const size = renderer.getDrawingBufferSize(this.bufferSize);
    this.frame(size.x / Math.max(1, size.y));
    renderer.render(this.scene, this.camera);
  }

  /** Compiles the stage's shaders ahead of the first frame (so the screen doesn't hitch when it appears). */
  async compile(renderer: WebGLRenderer): Promise<void> {
    this.frame(renderer.domElement.width / Math.max(1, renderer.domElement.height));
    try {
      await renderer.compileAsync(this.scene, this.camera);
    } catch {
      // Compiling on the first frame instead is fine.
    }
    this.ready = true;
  }

  /** Which dog is under a screen point (−1..1 across the canvas, as NDC x), or −1 if none is near. */
  dogAt(ndcX: number): number {
    let best = -1;
    let bestDistance = Infinity;
    this.camera.updateMatrixWorld();
    for (const [i, dog] of this.dogs.entries()) {
      this.projected.set(dog.x, DOG_SELECT.lookHeight, dog.z).project(this.camera);
      const d = Math.abs(this.projected.x - ndcX);
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    return bestDistance < DOG_SELECT.tapReach ? best : -1;
  }

  dispose(): void {
    for (const dog of this.dogs) dog.visual.dispose();
    this.dogs.length = 0;
    this.shadowGeometry.dispose();
    this.shadowMaterial.dispose();
    this.spot.geometry.dispose();
    this.spot.material.dispose();
    this.floor.geometry.dispose();
    this.floor.material.dispose();
    this.scene.clear();
  }

  /** The camera backs off until every dog fits, and is shifted so they sit above the name card. */
  private frame(aspect: number): void {
    if (aspect === this.aspect || !Number.isFinite(aspect) || aspect <= 0) return;
    this.aspect = aspect;
    const c = this.camera;
    c.aspect = aspect;
    const narrow = aspect < DOG_SELECT.narrow.below;
    this.spacing = narrow ? DOG_SELECT.narrow.spacing : DOG_SELECT.spacing;
    const halfWidth = ((this.total - 1) * this.spacing) / 2 + (narrow ? DOG_SELECT.narrow.margin : DOG_SELECT.margin);
    const tanV = Math.tan((DOG_SELECT.fov * Math.PI) / 360);
    const usable = 1 - DOG_SELECT.cardShare - DOG_SELECT.titleShare;
    const distance = Math.max(halfWidth / (tanV * aspect), DOG_SELECT.halfHeight / (tanV * usable), 1.2);
    c.position.set(0, DOG_SELECT.lookHeight + distance * 0.12, distance);
    this.target.set(0, DOG_SELECT.lookHeight, 0);
    c.lookAt(this.target);
    // Shift the picture so the dogs stand in the space between the title and the card.
    const w = 1000;
    const h = Math.round(w / aspect);
    c.setViewOffset(w, h, 0, Math.round((h * (DOG_SELECT.cardShare - DOG_SELECT.titleShare)) / 2), w, h);
    c.updateProjectionMatrix();
  }

  private slotX(i: number): number {
    return (i - (this.total - 1) / 2) * this.spacing;
  }

  private between([min, extra]: readonly [number, number]): number {
    return min + this.random() * extra;
  }
}
