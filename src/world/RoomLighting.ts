import { DirectionalLight, Group, HemisphereLight, Matrix4, PMREMGenerator, Vector3, type Scene, type WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RENDER } from '../config/engine';

/** The floor area (and height) the sun's shadow map must cover: the whole house. */
export interface ShadowArea {
  readonly minX: number;
  readonly maxX: number;
  readonly minZ: number;
  readonly maxZ: number;
  readonly height: number;
}

/** Phase 1–3's area: the living room plus the hallway. */
const LIVING_ROOM_AREA: ShadowArea = { minX: -3.7, maxX: 6.8, minZ: -3.2, maxZ: 3.2, height: 2.7 };
/** Direction the sun comes from (late afternoon, through the living room's window). */
const SUN_OFFSET = [-7, 5.5, 1.8] as const;

/**
 * Warm indoor lighting: a soft sky/floor-bounce fill plus late-afternoon sun that only gets in
 * through the window, casting a window-shaped pool of light onto the floor and Moke's bed.
 * Lamps are part of the room itself.
 */
export class RoomLighting {
  readonly object = new Group();
  readonly sun: DirectionalLight;

  /** `shadowMapSize` and `shadowSoftness` come from the quality preset (desktop: RENDER's). */
  constructor(shadowQuality: { shadowMapSize: number; shadowSoftness: number } = RENDER, area: ShadowArea = LIVING_ROOM_AREA) {
    const fill = new HemisphereLight('#fff5e8', '#c4a283', RENDER.hemisphereIntensity);

    this.sun = new DirectionalLight('#ffdcae', RENDER.sunIntensity);
    const center = new Vector3((area.minX + area.maxX) / 2, 0, (area.minZ + area.maxZ) / 2);
    this.sun.target.position.copy(center);
    const offset = new Vector3(...SUN_OFFSET).normalize().multiplyScalar(20);
    this.sun.position.copy(center).add(offset);
    this.sun.castShadow = true;

    const shadow = this.sun.shadow;
    shadow.mapSize.set(shadowQuality.shadowMapSize, shadowQuality.shadowMapSize);
    shadow.radius = shadowQuality.shadowSoftness;
    shadow.bias = -0.0004;
    shadow.normalBias = 0.03;
    fitShadowCamera(this.sun, area);

    this.object.add(fill, this.sun, this.sun.target);
  }
}

/**
 * Fits the sun's orthographic shadow camera snugly round the house (every corner of its box, seen from the sun),
 * so a bigger house doesn't mean blurrier shadows than it needs to. The house is long east-west and the sun comes
 * from the west, low: seen from the sun, that length is foreshortened.
 */
export function fitShadowCamera(sun: DirectionalLight, area: ShadowArea, margin = 0.4): void {
  const eye = sun.position;
  const view = new Matrix4().lookAt(eye, sun.target.position, new Vector3(0, 1, 0));
  const x = new Vector3().setFromMatrixColumn(view, 0);
  const y = new Vector3().setFromMatrixColumn(view, 1);
  const z = new Vector3().setFromMatrixColumn(view, 2);
  let left = Infinity;
  let right = -Infinity;
  let bottom = Infinity;
  let top = -Infinity;
  let near = Infinity;
  let far = -Infinity;
  const v = new Vector3();
  for (const px of [area.minX, area.maxX]) {
    for (const py of [0, area.height]) {
      for (const pz of [area.minZ, area.maxZ]) {
        v.set(px, py, pz).sub(eye);
        const cx = v.dot(x);
        const cy = v.dot(y);
        const depth = -v.dot(z);
        left = Math.min(left, cx);
        right = Math.max(right, cx);
        bottom = Math.min(bottom, cy);
        top = Math.max(top, cy);
        near = Math.min(near, depth);
        far = Math.max(far, depth);
      }
    }
  }
  const cam = sun.shadow.camera;
  cam.left = left - margin;
  cam.right = right + margin;
  cam.bottom = bottom - margin;
  cam.top = top + margin;
  cam.near = Math.max(0.1, near - margin);
  cam.far = far + margin;
  cam.updateProjectionMatrix();
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
