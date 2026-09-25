import { ADAPTIVE_RESOLUTION, type QualityLevel, type QualitySettings } from '../config/quality';

export interface DeviceHints {
  /** `?quality=…`, if any. */
  readonly forced: string | null;
  /** A finger is the primary pointer (a phone or tablet). */
  readonly touchPrimary: boolean;
  /** `navigator.deviceMemory` (GB, Chromium only), if known. */
  readonly memoryGB?: number;
  /** `navigator.hardwareConcurrency`, if known. */
  readonly cores?: number;
}

const LEVELS: readonly QualityLevel[] = ['low', 'medium', 'high'];

/** Desktop: HIGH. Phones and tablets: MEDIUM, or LOW on clearly modest hardware. `?quality=` wins. */
export function pickQuality(hints: DeviceHints): QualityLevel {
  if (hints.forced && (LEVELS as readonly string[]).includes(hints.forced)) return hints.forced as QualityLevel;
  if (!hints.touchPrimary) return 'high';
  const modest = (hints.memoryGB !== undefined && hints.memoryGB <= 3) || (hints.cores !== undefined && hints.cores <= 4);
  return modest ? 'low' : 'medium';
}

type AdaptiveTuning = { readonly [K in keyof typeof ADAPTIVE_RESOLUTION]: number };

/**
 * Dynamic resolution: when frames stay slow for a few seconds, render at a slightly lower pixel ratio; when
 * there's headroom for a while, go back up. Never outside the preset's range, and never on HIGH (desktop).
 * Plain logic: feed it frame times, read `pixelRatio`.
 */
export class AdaptiveResolution {
  pixelRatio: number;
  private slowFor = 0;
  private fastFor = 0;

  constructor(
    private readonly settings: QualitySettings,
    private readonly tuning: AdaptiveTuning = ADAPTIVE_RESOLUTION,
  ) {
    this.pixelRatio = settings.maxPixelRatio;
  }

  /** `dt`: seconds since the last frame; `frameMs`: how long it took. Returns true if the ratio changed. */
  update(dt: number, frameMs: number): boolean {
    if (!this.settings.adaptive || dt <= 0) return false;
    const t = this.tuning;
    this.slowFor = frameMs > t.slowFrameMs ? this.slowFor + dt : 0;
    this.fastFor = frameMs < t.fastFrameMs ? this.fastFor + dt : 0;
    if (this.slowFor >= t.stepDownAfter && this.pixelRatio > this.settings.minPixelRatio) {
      this.pixelRatio = Math.max(this.settings.minPixelRatio, this.pixelRatio - t.step);
      this.slowFor = 0;
      return true;
    }
    if (this.fastFor >= t.stepUpAfter && this.pixelRatio < this.settings.maxPixelRatio) {
      this.pixelRatio = Math.min(this.settings.maxPixelRatio, this.pixelRatio + t.step);
      this.fastFor = 0;
      return true;
    }
    return false;
  }
}
