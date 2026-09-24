import { DirectionalLight, Group, HemisphereLight, PMREMGenerator, type Scene, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RENDER } from '../config/engine';

/** The sun's shadow map covers this box around the house: the living room plus the hallway. */
const SHADOW = { center: [1.5, 0, 0.3] as const, halfExtent: 6.5 };
/** Direction the sun comes from (late afternoon, through the left-hand window). */
const SUN_OFFSET = [-7, 5.5, 1.8] as const;

/**
 * Warm indoor lighting: a soft sky/floor-bounce fill plus late-afternoon sun that only gets in
 * through the window, casting a window-shaped pool of light onto the floor and Moke's bed.
 * Lamps are part of the room itself.
 */
export class RoomLighting {
  readonly object = new Group();
  readonly sun: DirectionalLight;

  constructor() {
    const fill = new HemisphereLight('#fff5e8', '#c4a283', RENDER.hemisphereIntensity);

    this.sun = new DirectionalLight('#ffdcae', RENDER.sunIntensity);
    const [cx, cy, cz] = SHADOW.center;
    this.sun.target.position.set(cx, cy, cz);
    this.sun.position.set(cx + SUN_OFFSET[0], cy + SUN_OFFSET[1], cz + SUN_OFFSET[2]);
    this.sun.castShadow = true;

    const shadow = this.sun.shadow;
    shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
    shadow.radius = RENDER.shadowSoftness;
    shadow.bias = -0.0004;
    shadow.normalBias = 0.03;
    const cam = shadow.camera;
    cam.left = -SHADOW.halfExtent;
    cam.right = SHADOW.halfExtent;
    cam.top = SHADOW.halfExtent;
    cam.bottom = -SHADOW.halfExtent;
    cam.near = 1;
    cam.far = 25;
    cam.updateProjectionMatrix();

    this.object.add(fill, this.sun, this.sun.target);
  }
}

/**
 * A soft, neutral image-based environment (three's RoomEnvironment, prefiltered once at startup).
 * It gives wood, brass and the TV screen gentle reflections and fills in the flat hemisphere light.
 */
export function applySoftEnvironment(renderer: WebGLRenderer, scene: Scene): void {
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  scene.environment = pmrem.fromScene(room, 0.04).texture;
  scene.environmentIntensity = RENDER.environmentIntensity;
  room.dispose();
  pmrem.dispose();
}
