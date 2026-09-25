import { MOKE_CHARACTER } from '../../config/mokeCharacter';
import type { MokeAnimationState } from '../MokeAnimationController';
import type { Trick } from '../Tricks';

/**
 * Animation clips a `moke.glb` can provide, by exact name. See docs/MOKE_3D_SPEC.md for what each looks like.
 * `loop` clips play continuously; the rest play once and hold their last frame while their weight lasts.
 */
export const MOKE_CLIPS = {
  // Locomotion: loops in place (no root motion), authored at MOKE_CHARACTER.clipSpeeds.
  idle: { loop: true, need: 'required' },
  walk: { loop: true, need: 'required' },
  trot: { loop: true, need: 'required' },
  run: { loop: true, need: 'required' },
  // Actions.
  sit: { loop: true, need: 'required' },
  lie_down: { loop: false, need: 'required' },
  rest: { loop: true, need: 'required' },
  stand_up: { loop: false, need: 'required' },
  sniff: { loop: true, need: 'required' },
  bark: { loop: false, need: 'required' },
  pickup: { loop: false, need: 'recommended' },
  drop: { loop: false, need: 'recommended' },
  growl: { loop: false, need: 'recommended' },
  stretch: { loop: false, need: 'recommended' },
  // Ducking under low furniture (the coffee table): an additive pose layered on whatever else he's doing.
  duck: { loop: false, need: 'recommended' },
  // Tricks (Q / controller X).
  trick_belly_up: { loop: false, need: 'recommended' },
  trick_beg: { loop: false, need: 'recommended' },
  trick_paw: { loop: false, need: 'recommended' },
  trick_spin: { loop: false, need: 'recommended' },
  // Personality extras, not used by the game yet.
  scratch: { loop: false, need: 'optional' },
  look_around: { loop: false, need: 'optional' },
} as const satisfies Record<string, { loop: boolean; need: 'required' | 'recommended' | 'optional' }>;

export type MokeClipName = keyof typeof MOKE_CLIPS;
export const CLIP_NAMES = Object.keys(MOKE_CLIPS) as MokeClipName[];

export function isMokeClip(name: string): name is MokeClipName {
  return Object.hasOwn(MOKE_CLIPS, name);
}

/**
 * Clips played additively, on top of the rest: authored from the neutral standing pose (first frame) to the
 * full pose (last frame), and measured against that first frame.
 */
export const ADDITIVE_CLIPS: ReadonlySet<MokeClipName> = new Set(['duck']);

const TRICK_CLIPS: Readonly<Record<Trick, MokeClipName>> = {
  bellyUp: 'trick_belly_up',
  beg: 'trick_beg',
  paw: 'trick_paw',
  spin: 'trick_spin',
};

/** Target weight and playback speed per clip. Reused every frame (no allocation). */
export type ClipTargets = Map<MokeClipName, { weight: number; timeScale: number }>;

export function createClipTargets(): ClipTargets {
  return new Map(CLIP_NAMES.map((name) => [name, { weight: 0, timeScale: 1 }]));
}

/** What the visual knows beyond the animation state. */
export interface ClipContext {
  /** The clips the model actually has. */
  readonly available: ReadonlySet<string>;
  /** Is he on his way down into his bed (true) or getting up (false)? */
  readonly restRising: boolean;
  /** 0..1 envelopes of a pickup / drop that just happened. */
  readonly pickup: number;
  readonly drop: number;
}

const LOCOMOTION = ['idle', 'walk', 'trot', 'run'] as const;

/** The authored ground speed of each locomotion clip (idle = 0). */
function clipSpeed(clip: (typeof LOCOMOTION)[number]): number {
  return clip === 'idle' ? 0 : MOKE_CHARACTER.clipSpeeds[clip];
}

/**
 * Chooses clip weights for this frame from Moke's body language. Full-body actions (resting, a trick, sitting,
 * sniffing, a bark…) take their share first; locomotion gets the rest, blended by his real speed between the two
 * nearest locomotion clips the model has, with playback scaled so the feet keep up. A missing clip never breaks
 * anything: its action is simply left out, and missing locomotion falls back to the nearest clip it does have.
 */
export function selectClips(s: Readonly<MokeAnimationState>, ctx: ClipContext, out: ClipTargets): void {
  for (const target of out.values()) {
    target.weight = 0;
    target.timeScale = 1;
  }
  const has = (clip: MokeClipName) => ctx.available.has(clip);
  let overlay = 0;
  const add = (clip: MokeClipName, weight: number): void => {
    if (weight <= 0.001 || !has(clip)) return;
    out.get(clip)!.weight += weight;
    overlay += weight;
  };

  if (s.rest > 0.001) {
    const settled = s.rest > 0.97;
    const moving: MokeClipName = ctx.restRising ? 'lie_down' : 'stand_up';
    add(settled || !has(moving) ? (has('rest') ? 'rest' : 'lie_down') : moving, s.rest);
  }
  if (s.trick) add(TRICK_CLIPS[s.trick], s.trickBlend);
  add('sit', s.sit);
  add('stretch', s.stretch);
  add('sniff', s.sniff);
  add('growl', s.growl);
  add('bark', s.bark);
  add('pickup', ctx.pickup);
  add('drop', ctx.drop);

  // Overlapping actions share the body; locomotion gets whatever's left.
  if (overlay > 1) {
    for (const target of out.values()) target.weight /= overlay;
    overlay = 1;
  }
  addLocomotion(s, has, 1 - overlay, out);

  // Ducking is layered on top of everything (walking, sniffing, carrying) rather than sharing the body.
  if (has('duck')) out.get('duck')!.weight = s.crouch;
}

/** Blends the two locomotion clips nearest his real speed, with `base` weight in total. */
function addLocomotion(s: Readonly<MokeAnimationState>, has: (clip: MokeClipName) => boolean, base: number, out: ClipTargets): void {
  if (base <= 0) return;
  const clips = LOCOMOTION.filter(has);
  if (clips.length === 0) return;
  const v = Math.max(0, s.speed);
  let lower: (typeof LOCOMOTION)[number] = clips[0]!;
  let upper = lower;
  for (const clip of clips) {
    if (clipSpeed(clip) <= v) lower = clip;
    if (clipSpeed(clip) >= v) {
      upper = clip;
      break;
    }
    upper = clip; // v is beyond the fastest clip: keep the fastest
  }
  const lo = clipSpeed(lower);
  const hi = clipSpeed(upper);
  const t = hi > lo ? (v - lo) / (hi - lo) : 1;
  const set = (clip: (typeof LOCOMOTION)[number], weight: number): void => {
    const target = out.get(clip)!;
    target.weight += weight * base;
    // Feet keep pace with the ground: faster than authored plays faster, within sensible limits.
    target.timeScale = clip === 'idle' ? 1 : Math.min(2.5, Math.max(0.3, v / clipSpeed(clip)));
  };
  if (lower === upper) set(upper, 1);
  else {
    set(lower, 1 - t);
    set(upper, t);
  }
}
