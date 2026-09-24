import { NeutralToneMapping, type ToneMapping } from 'three';

/** Renderer and overall look. */
export const RENDER = {
  /** Caps devicePixelRatio. A soft stylized look doesn't need 3x buffers, and the GPU thanks us. */
  maxPixelRatio: 2,
  antialias: true,
  /** Neutral keeps the colours we pick close to what ends up on screen (ACES shifts warm hues). */
  toneMapping: NeutralToneMapping as ToneMapping,
  exposure: 1.0,
  shadowMapSize: 2048,
  /** PCF blur radius, in shadow-map texels. */
  shadowSoftness: 3,
  /** Room lighting balance: sky/floor fill, window sun, and soft image-based reflections. */
  hemisphereIntensity: 1.9,
  sunIntensity: 4.0,
  environmentIntensity: 0.35,
  background: '#f3e3cf',
} as const;

/** Clipping planes. Field of view and everything else about the camera lives in config/camera.ts. */
export const CAMERA_LENS = {
  /** Small near plane: the camera lives at dog height and gets close to furniture. */
  near: 0.03,
  far: 60,
} as const;

/** Simulation clock. Gameplay and physics tick at a fixed rate; rendering runs at display rate. */
export const TIMING = {
  fixedStep: 1 / 60,
  /** Longest frame we'll simulate (seconds). Tab switches and breakpoints are clamped to this. */
  maxFrameDelta: 0.1,
  maxStepsPerFrame: 6,
} as const;
