// Original placeholder sounds, synthesized with Web Audio at play time. No sample files.

/** Schedules one sound into `out` starting at `t0`. `pitch` is a multiplier around 1. */
export type Synth = (ctx: AudioContext, out: AudioNode, t0: number, pitch: number, noise: AudioBuffer) => void;

function envelope(ctx: AudioContext, t0: number, attack: number, peak: number, decay: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  return g;
}

function noiseSource(ctx: AudioContext, noise: AudioBuffer, t0: number, duration: number): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.start(t0, Math.random() * (noise.duration - duration - 0.01), duration + 0.01);
  return src;
}

/**
 * A small dog's "arf": a buzzy voice whose pitch jumps up and falls, shaped by two mouth
 * formants, with a breathy puff of noise on the attack.
 */
export const bark: Synth = (ctx, out, t0, pitch, noise) => {
  const f0 = 560 * pitch;
  const voice = ctx.createOscillator();
  voice.type = 'sawtooth';
  voice.frequency.setValueAtTime(f0 * 0.8, t0);
  voice.frequency.exponentialRampToValueAtTime(f0 * 1.35, t0 + 0.025);
  voice.frequency.exponentialRampToValueAtTime(f0 * 0.72, t0 + 0.17);

  const amp = envelope(ctx, t0, 0.012, 1, 0.17);
  for (const [freq, q, gain] of [
    [1150 * pitch, 5, 1.1],
    [2500 * pitch, 6, 0.6],
    [700 * pitch, 3, 0.5],
  ] as const) {
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = freq;
    formant.Q.value = q;
    const level = ctx.createGain();
    level.gain.value = gain;
    voice.connect(formant).connect(level).connect(amp);
  }
  amp.connect(out);

  const breath = noiseSource(ctx, noise, t0, 0.07);
  const breathFilter = ctx.createBiquadFilter();
  breathFilter.type = 'bandpass';
  breathFilter.frequency.value = 1800;
  breathFilter.Q.value = 1.2;
  breath.connect(breathFilter).connect(envelope(ctx, t0, 0.005, 0.35, 0.06)).connect(out);

  voice.start(t0);
  voice.stop(t0 + 0.22);
};

/** A small, rumbly "grrr" with a gentle wobble: determined, but more adorable than scary. */
export const growl: Synth = (ctx, out, t0, pitch, noise) => {
  const voice = ctx.createOscillator();
  voice.type = 'sawtooth';
  voice.frequency.setValueAtTime(135 * pitch, t0);
  voice.frequency.linearRampToValueAtTime(118 * pitch, t0 + 0.65);

  const wobble = ctx.createOscillator();
  wobble.type = 'sine';
  wobble.frequency.value = 13;
  const wobbleDepth = ctx.createGain();
  wobbleDepth.gain.value = 9;
  wobble.connect(wobbleDepth).connect(voice.frequency);

  const warm = ctx.createBiquadFilter();
  warm.type = 'lowpass';
  warm.frequency.value = 650;
  warm.Q.value = 1.5;
  voice.connect(warm).connect(envelope(ctx, t0, 0.025, 0.7, 0.68)).connect(out);

  const rasp = noiseSource(ctx, noise, t0, 0.68);
  const raspFilter = ctx.createBiquadFilter();
  raspFilter.type = 'bandpass';
  raspFilter.frequency.value = 430;
  raspFilter.Q.value = 2.2;
  rasp.connect(raspFilter).connect(envelope(ctx, t0, 0.02, 0.16, 0.66)).connect(out);

  voice.start(t0);
  wobble.start(t0);
  voice.stop(t0 + 0.72);
  wobble.stop(t0 + 0.72);
};

/** Three quick, soft nose snuffles. */
export const sniff: Synth = (ctx, out, t0, pitch, noise) => {
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * (0.12 + Math.random() * 0.03);
    const src = noiseSource(ctx, noise, t, 0.08);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3200 * pitch, t);
    filter.frequency.linearRampToValueAtTime(4800 * pitch, t + 0.07);
    filter.Q.value = 1.5;
    src.connect(filter).connect(envelope(ctx, t, 0.02, 0.9 - i * 0.15, 0.06)).connect(out);
  }
};

/** A soft, rising "pop" as something is picked up. */
export const pickup: Synth = (ctx, out, t0, pitch) => {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(360 * pitch, t0);
  osc.frequency.exponentialRampToValueAtTime(700 * pitch, t0 + 0.08);
  osc.connect(envelope(ctx, t0, 0.008, 0.8, 0.1)).connect(out);
  osc.start(t0);
  osc.stop(t0 + 0.13);
};

/** A small, soft floor "thup" as something is dropped. */
export const drop: Synth = (ctx, out, t0, pitch, noise) => {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(190 * pitch, t0);
  osc.frequency.exponentialRampToValueAtTime(80 * pitch, t0 + 0.12);
  osc.connect(envelope(ctx, t0, 0.005, 0.9, 0.13)).connect(out);
  osc.start(t0);
  osc.stop(t0 + 0.16);
  const thud = noiseSource(ctx, noise, t0, 0.05);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 900;
  thud.connect(lp).connect(envelope(ctx, t0, 0.003, 0.4, 0.05)).connect(out);
};
