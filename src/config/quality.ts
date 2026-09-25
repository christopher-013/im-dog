/**
 * Graphics quality presets. Desktop keeps HIGH (Phase 1/2 look, unchanged). Phones and tablets start lower,
 * because a phone's GPU and battery pay for every pixel: most of the saving is resolution (pixel ratio), MSAA
 * and shadow-map size, which cost little in looks at phone sizes. Force one with `?quality=low|medium|high`.
 */
export type QualityLevel = 'low' | 'medium' | 'high';

export interface QualitySettings {
  /** Highest device-pixel-ratio the canvas renders at. */
  readonly maxPixelRatio: number;
  /** Lowest ratio dynamic resolution may drop to when frames are slow (only below HIGH). */
  readonly minPixelRatio: number;
  readonly antialias: boolean;
  readonly shadowMapSize: number;
  /** PCF blur radius, in shadow-map texels. */
  readonly shadowSoftness: number;
  /** Lower the resolution a step when frames stay slow, raise it again when there's headroom. */
  readonly adaptive: boolean;
}

export const QUALITY: Readonly<Record<QualityLevel, QualitySettings>> = {
  high: { maxPixelRatio: 2, minPixelRatio: 2, antialias: true, shadowMapSize: 2048, shadowSoftness: 3, adaptive: false },
  medium: { maxPixelRatio: 1.5, minPixelRatio: 1, antialias: true, shadowMapSize: 1024, shadowSoftness: 2, adaptive: true },
  low: { maxPixelRatio: 1, minPixelRatio: 0.75, antialias: false, shadowMapSize: 512, shadowSoftness: 1, adaptive: true },
};

/** Dynamic resolution (MEDIUM/LOW only). */
export const ADAPTIVE_RESOLUTION = {
  /** Frames slower than this (ms) count as struggling: under ~45 fps. */
  slowFrameMs: 22,
  /** Frames faster than this (ms) count as headroom: over ~57 fps. */
  fastFrameMs: 17.5,
  /** How long it must struggle before stepping down, and have headroom before stepping back up (s). */
  stepDownAfter: 3,
  stepUpAfter: 10,
  /** Pixel-ratio change per step. */
  step: 0.25,
} as const;
