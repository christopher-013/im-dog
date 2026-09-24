/**
 * The camera angle that WASD is measured against.
 *
 * Captured from the camera when a movement key goes down, then held while keys stay down. Only the
 * player's own mouse turns move it, so automatic camera motion (swinging behind Moke, sliding
 * away from walls) never bends the path the player is steering. Release the keys and it re-syncs.
 */
export class MoveBasis {
  yaw = 0;
  private held = false;

  update(moving: boolean, cameraYaw: number, manualYawDelta: number): number {
    if (moving && this.held) this.yaw += manualYawDelta;
    else this.yaw = cameraYaw;
    this.held = moving;
    return this.yaw;
  }
}
