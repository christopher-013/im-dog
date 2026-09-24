import { DirectionalLight, Group, HemisphereLight } from 'three';
import { RENDER } from '../config/engine';

/**
 * Warm indoor lighting: a soft sky/floor-bounce fill plus late-afternoon sun coming in
 * through the window, which casts a window-shaped pool of light on the floor.
 */
export class RoomLighting {
  readonly object = new Group();
  readonly sun: DirectionalLight;

  constructor() {
    const fill = new HemisphereLight('#fff5e8', '#c4a283', 2.4);

    this.sun = new DirectionalLight('#ffdcae', 4.0);
    this.sun.position.set(-7, 5.5, 1.8);
    this.sun.target.position.set(0, 0, 0);
    this.sun.castShadow = true;

    const shadow = this.sun.shadow;
    shadow.mapSize.set(RENDER.shadowMapSize, RENDER.shadowMapSize);
    shadow.radius = RENDER.shadowSoftness;
    shadow.bias = -0.0004;
    shadow.normalBias = 0.03;
    const cam = shadow.camera;
    cam.left = -5;
    cam.right = 5;
    cam.top = 5;
    cam.bottom = -5;
    cam.near = 1;
    cam.far = 20;
    cam.updateProjectionMatrix();

    this.object.add(fill, this.sun, this.sun.target);
  }
}
