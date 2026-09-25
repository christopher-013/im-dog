import { MOVEMENT } from './movement';

/**
 * Moke's character conventions: the one authoritative scale, and how a `moke.glb` must be built to drop in.
 * Every visual (the procedural stand-in today, the final model later) follows these. The full spec is
 * `docs/MOKE_3D_SPEC.md`; integration steps are in `docs/MOKE_INTEGRATION.md`.
 *
 * Units: metres. Sizes are estimates from the reference photos until the owner measures the real Moke.
 */
export const MOKE_CHARACTER = {
  /** Standing, in metres, measured from the floor. The camera and furniture are tuned against these. */
  size: {
    /** Top of the shoulders (withers). */
    shoulderHeight: 0.28,
    /** Eye level. The camera pivots around this height. */
    eyeHeight: 0.33,
    /** Top of the fluffy head. He ducks under anything lower than about this (see MOKE_ANIMATION.duckBelowHeadroom). */
    headTop: 0.43,
  },

  /** The final model file and how it's placed. */
  model: {
    /** Relative to public/ (served from the site root). */
    path: 'assets/models/moke/moke.glb',
    /** glTF is in metres; the model is authored at Moke's real size, so no scaling. */
    scale: 1,
    /** glTF characters face +Z, which is Moke's forward too. Radians to add if a model faces elsewhere. */
    yawOffset: 0,
    /** Warn (in the console) if the loaded model's standing height differs from `size.headTop` by more than this. */
    heightTolerance: 0.2,
  },

  /** Empty nodes in the model where things attach. Only `mouth` is required. */
  sockets: {
    /** Between his front teeth; carried items are centred here (+Z forward, +Y up). */
    mouth: 'socket_mouth',
    /** Front of the collar, where a name tag hangs. */
    collar: 'socket_collar',
    /** Middle of his back, for anything that rides on him later. */
    back: 'socket_back',
  },

  /** Bones the game drives directly, on top of the animation clips. Missing optional bones just skip that layer. */
  bones: {
    root: 'root',
    head: 'head',
    neck: 'neck',
    jaw: 'jaw',
    earLeft: 'ear_L',
    earRight: 'ear_R',
    tail: ['tail_01', 'tail_02', 'tail_03', 'tail_04'],
  },

  /** Optional morph targets (shape keys). */
  morphs: {
    blink: 'blink',
  },

  /**
   * Animation clips, by exact name in the glTF. Locomotion clips loop in place (no root motion), authored at
   * `clipSpeeds`; the game scales their playback so the feet keep up with his real speed.
   */
  clipSpeeds: {
    walk: MOVEMENT.walkSpeed,
    trot: MOVEMENT.trotSpeed,
    run: MOVEMENT.runSpeed,
  },
} as const;
