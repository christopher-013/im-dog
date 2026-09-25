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

/** Gain that swells in, holds, then fades out (exponential ramps, so it never clicks). */
function swell(ctx: AudioContext, t0: number, attack: number, hold: number, release: number, peak: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
  return g;
}

let gritCurve: Float32Array<ArrayBuffer> | null = null;
/** A soft-clipping curve: rounds off the loudest part of the wave, adding throaty harmonics. */
function grit(): Float32Array<ArrayBuffer> {
  if (!gritCurve) {
    gritCurve = new Float32Array(1024);
    for (let i = 0; i < gritCurve.length; i++) {
      const x = (i / (gritCurve.length - 1)) * 2 - 1;
      gritCurve[i] = Math.tanh(3 * x) / Math.tanh(3);
    }
  }
  return gritCurve;
}

/**
 * A deep, throaty "grrrr": a low buzzing voice (about 80 Hz) with a fast rattle (about 25 pulses a second, the
 * "rrr"), a little grit, dark chest and mouth resonances and rough breath underneath. Low and rumbly, but still
 * a small dog's growl rather than a scary one.
 */
export const growl: Synth = (ctx, out, t0, pitch, noise) => {
  const duration = 0.9;
  const f0 = 82 * pitch;
  const voice = ctx.createOscillator();
  voice.type = 'sawtooth';
  voice.frequency.setValueAtTime(f0 * 1.08, t0);
  voice.frequency.linearRampToValueAtTime(f0, t0 + 0.2);
  voice.frequency.linearRampToValueAtTime(f0 * 0.9, t0 + duration);

  // An uneven throat: the pitch wanders a little.
  const wander = ctx.createOscillator();
  wander.frequency.value = 5.5;
  const wanderDepth = ctx.createGain();
  wanderDepth.gain.value = 4;
  wander.connect(wanderDepth).connect(voice.frequency);

  // The "rrr": the voice pulses on and off quickly, speeding up slightly.
  const rattle = ctx.createOscillator();
  rattle.type = 'triangle';
  rattle.frequency.setValueAtTime(24, t0);
  rattle.frequency.linearRampToValueAtTime(28, t0 + duration);
  const rattleDepth = ctx.createGain();
  rattleDepth.gain.value = 0.45;
  rattle.connect(rattleDepth);
  const pulsing = (): GainNode => {
    const g = ctx.createGain();
    g.gain.value = 0.55;
    rattleDepth.connect(g.gain);
    return g;
  };

  const shaper = ctx.createWaveShaper();
  shaper.curve = grit();
  const throat = pulsing();
  const amp = swell(ctx, t0, 0.07, duration - 0.27, 0.2, 0.55);
  voice.connect(shaper).connect(throat);
  // Dark resonances: the chest, and two low mouth formants.
  for (const [type, freq, q, gain] of [
    ['lowpass', 190, 0.7, 0.9],
    ['bandpass', 320 * pitch, 1.3, 1.0],
    ['bandpass', 720 * pitch, 2.2, 0.4],
  ] as const) {
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    const level = ctx.createGain();
    level.gain.value = gain;
    throat.connect(filter).connect(level).connect(amp);
  }
  amp.connect(out);

  // Rough breath, pulsing with the voice.
  const breath = noiseSource(ctx, noise, t0, duration);
  const breathFilter = ctx.createBiquadFilter();
  breathFilter.type = 'lowpass';
  breathFilter.frequency.value = 650;
  breath.connect(breathFilter).connect(pulsing()).connect(swell(ctx, t0, 0.06, duration - 0.26, 0.2, 0.14)).connect(out);

  for (const osc of [voice, wander, rattle]) {
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }
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

// ---- Sock Heist (Phase 3)

/** The human's "!" moment: a quick comic slide-whistle up. */
export const surprise: Synth = (ctx, out, t0, pitch) => {
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(520 * pitch, t0);
  osc.frequency.exponentialRampToValueAtTime(1350 * pitch, t0 + 0.16);
  osc.connect(envelope(ctx, t0, 0.01, 0.7, 0.2)).connect(out);
  osc.start(t0);
  osc.stop(t0 + 0.24);
};

/** A grab that misses: a soft airy whoosh. */
export const whoosh: Synth = (ctx, out, t0, pitch, noise) => {
  const src = noiseSource(ctx, noise, t0, 0.3);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(500 * pitch, t0);
  filter.frequency.exponentialRampToValueAtTime(2400 * pitch, t0 + 0.22);
  src.connect(filter).connect(envelope(ctx, t0, 0.06, 0.8, 0.22)).connect(out);
};

/** A treat bag being shaken: three crinkly rustles. Every dog knows this sound. */
export const treatBag: Synth = (ctx, out, t0, pitch, noise) => {
  for (let i = 0; i < 3; i++) {
    const t = t0 + i * 0.13;
    const src = noiseSource(ctx, noise, t, 0.09);
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 3800 * pitch;
    src.connect(filter).connect(envelope(ctx, t, 0.004, 0.9, 0.08)).connect(out);
  }
};

/** Crunch, crunch, crunch: a small biscuit being enjoyed. */
export const crunch: Synth = (ctx, out, t0, pitch, noise) => {
  for (let i = 0; i < 4; i++) {
    const t = t0 + i * (0.22 + Math.random() * 0.05);
    const src = noiseSource(ctx, noise, t, 0.05);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (1500 + Math.random() * 600) * pitch;
    filter.Q.value = 1.2;
    src.connect(filter).connect(envelope(ctx, t, 0.002, 1, 0.045)).connect(out);
  }
};

/** Dog Logic discovered: a bright little four-note chime. */
export const discovery: Synth = (ctx, out, t0, pitch) => {
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    const t = t0 + i * 0.09;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f * pitch;
    osc.connect(envelope(ctx, t, 0.01, 0.55, i === notes.length - 1 ? 0.7 : 0.25)).connect(out);
    osc.start(t);
    osc.stop(t + 0.8);
  });
};
