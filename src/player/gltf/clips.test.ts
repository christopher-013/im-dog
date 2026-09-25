import { describe, expect, it } from 'vitest';
import { MOVEMENT } from '../../config/movement';
import { MokeAnimationController, type MokeAnimationState } from '../MokeAnimationController';
import { CLIP_NAMES, createClipTargets, selectClips, type ClipContext, type MokeClipName } from './clips';

function state(over: Partial<MokeAnimationState> = {}): MokeAnimationState {
  return { ...new MokeAnimationController().state, ...over };
}

function select(over: Partial<MokeAnimationState>, available: readonly string[] = CLIP_NAMES, ctx: Partial<ClipContext> = {}) {
  const out = createClipTargets();
  selectClips(state(over), { available: new Set(available), restRising: true, pickup: 0, drop: 0, ...ctx }, out);
  const weights = Object.fromEntries([...out].filter(([, t]) => t.weight > 1e-6).map(([name, t]) => [name, t.weight]));
  return { out, weights: weights as Partial<Record<MokeClipName, number>> };
}

const total = (weights: Partial<Record<string, number>>) => Object.values(weights).reduce((a, b) => a! + b!, 0)!;

describe('selecting clips from the animation state', () => {
  it('idles when standing still, and walks, trots and runs at their speeds', () => {
    expect(select({ speed: 0 }).weights).toEqual({ idle: 1 });
    expect(select({ speed: MOVEMENT.walkSpeed }).weights).toEqual({ walk: 1 });
    expect(select({ speed: MOVEMENT.trotSpeed }).weights).toEqual({ trot: 1 });
    expect(select({ speed: MOVEMENT.runSpeed }).weights).toEqual({ run: 1 });
  });

  it('blends smoothly between neighbouring gaits and keeps the feet in step', () => {
    const between = (MOVEMENT.trotSpeed + MOVEMENT.runSpeed) / 2;
    const { weights, out } = select({ speed: between });
    expect(weights.trot).toBeCloseTo(0.5);
    expect(weights.run).toBeCloseTo(0.5);
    expect(out.get('trot')!.timeScale).toBeCloseTo(between / MOVEMENT.trotSpeed);
    expect(out.get('run')!.timeScale).toBeCloseTo(between / MOVEMENT.runSpeed);
    // Faster than the run clip was authored: it plays faster rather than switching.
    expect(select({ speed: MOVEMENT.runSpeed * 1.2 }).out.get('run')!.timeScale).toBeCloseTo(1.2);
  });

  it('falls back to the gaits the model has when one is missing', () => {
    const noTrot = select({ speed: MOVEMENT.trotSpeed }, ['idle', 'walk', 'run']).weights;
    expect(noTrot.trot).toBeUndefined();
    expect(total(noTrot)).toBeCloseTo(1);
    expect(noTrot.walk! + noTrot.run!).toBeCloseTo(1);
    expect(select({ speed: MOVEMENT.runSpeed }, ['idle', 'walk']).weights).toEqual({ walk: 1 });
    expect(select({ speed: 2 }, []).weights).toEqual({}); // no clips at all: nothing to play, nothing breaks
  });

  it('lies down, rests and stands up with the right clips', () => {
    expect(select({ rest: 0.5 }, CLIP_NAMES, { restRising: true }).weights.lie_down).toBeCloseTo(0.5);
    expect(select({ rest: 1 }).weights).toEqual({ rest: 1 });
    expect(select({ rest: 0.5 }, CLIP_NAMES, { restRising: false }).weights.stand_up).toBeCloseTo(0.5);
    // Without transition clips, the resting loop covers both ways.
    expect(select({ rest: 0.5 }, ['idle', 'rest']).weights.rest).toBeCloseTo(0.5);
  });

  it('gives actions their share first and locomotion the rest, always adding up to one', () => {
    for (const over of [{ sit: 0.6 }, { sniff: 1, speed: 1 }, { bark: 0.7, speed: 3 }, { trick: 'paw' as const, trickBlend: 1 }, { sniff: 1, bark: 1, sit: 1 }]) {
      expect(total(select(over).weights)).toBeCloseTo(1);
    }
    expect(select({ sit: 1 }).weights).toEqual({ sit: 1 });
    expect(select({ trick: 'beg', trickBlend: 1 }).weights).toEqual({ trick_beg: 1 });
  });

  it('plays the jump clip while he is in the air', () => {
    expect(select({ air: 1, speed: MOVEMENT.trotSpeed }).weights).toEqual({ jump: 1 });
    expect(select({ air: 0.5, speed: MOVEMENT.trotSpeed }).weights).toEqual({ jump: 0.5, trot: 0.5 });
  });

  it('skips an action the model has no clip for, instead of freezing', () => {
    expect(select({ trick: 'spin', trickBlend: 1, speed: 0 }, ['idle', 'walk', 'trot', 'run']).weights).toEqual({ idle: 1 });
    expect(select({ bark: 1 }, ['idle']).weights).toEqual({ idle: 1 });
  });

  it('layers ducking on top of whatever he is doing, instead of taking a share', () => {
    expect(select({ crouch: 0.8, speed: MOVEMENT.trotSpeed }).weights).toEqual({ trot: 1, duck: 0.8 });
    expect(select({ crouch: 1, sit: 1 }).weights).toEqual({ sit: 1, duck: 1 });
    expect(select({ crouch: 1 }, ['idle']).weights).toEqual({ idle: 1 }); // no duck clip: the visual dips procedurally
  });

  it('plays pickup and drop moments when the model has them', () => {
    expect(select({}, CLIP_NAMES, { pickup: 1 }).weights).toEqual({ pickup: 1 });
    expect(select({}, CLIP_NAMES, { drop: 0.5 }).weights.drop).toBeCloseTo(0.5);
  });
});
