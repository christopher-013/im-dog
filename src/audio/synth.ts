// Original placeholder sounds, synthesized with Web Audio at play time. No sample files.

import { AUDIO } from '../config/audio';

const SPEAKER_PRESENCE = AUDIO.speakerPresence;

/** Schedules one sound into `out` starting at `t0`. `pitch` is a multiplier around 1. */
export type Synth = (ctx: AudioContext, out: AudioNode, t0: number, pitch: number, noise: AudioBuffer) => void;

/** A clear high DING followed by a lower DONG, with soft bell harmonics (under one second). */
export const doorbell: Synth = (ctx, out, t0) => {
  const chime = AUDIO.doorbellChime;
  for (const [index, frequency] of chime.notes.entries()) {
    for (const [multiple, gain] of chime.layers) {
      const voice = ctx.createOscillator();
      voice.frequency.value = frequency * multiple;
      const start = t0 + index * chime.gap;
      voice.connect(envelope(ctx, start, chime.attack, gain, chime.decay)).connect(out);
      voice.start(start); voice.stop(start + chime.duration);
    }
  }
};

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
  // Dark resonances: the chest and two low mouth formants, plus a throaty rasp higher up. A phone's little speaker
  // plays almost nothing below ~400 Hz, so without the rasp the growl all but vanished on phones.
  for (const [type, freq, q, gain] of [
    ['lowpass', 190, 0.7, 0.9],
    ['bandpass', 320 * pitch, 1.3, 1.0],
    ['bandpass', 720 * pitch, 2.2, 0.4],
    ['bandpass', 1150 * pitch, 1.4, SPEAKER_PRESENCE.growlRasp],
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
  // A soft "tock" on top of the thump, so a phone speaker (nothing much below ~400 Hz) still has something to play.
  if (SPEAKER_PRESENCE.dropTap <= 0) return;
  const knock = ctx.createOscillator();
  knock.type = 'sine';
  knock.frequency.setValueAtTime(560 * pitch, t0);
  knock.frequency.exponentialRampToValueAtTime(420 * pitch, t0 + 0.06);
  knock.connect(envelope(ctx, t0, 0.003, SPEAKER_PRESENCE.dropTap, 0.06)).connect(out);
  knock.start(t0);
  knock.stop(t0 + 0.08);
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

/**
 * A rubber squeaky toy being chomped: air forced through the squeaker, a reedy, nasal "eeek" that rises as the jaws
 * close and sags as they let go. A buzzy voice (sawtooth with a fast wobble) through a narrow resonance, and a
 * breath of noise.
 */
export const squeak: Synth = (ctx, out, t0, pitch, noise) => {
  const f = (980 + Math.random() * 160) * pitch;
  const length = 0.17 + Math.random() * 0.08;
  const voice = ctx.createOscillator();
  voice.type = 'sawtooth';
  voice.frequency.setValueAtTime(f * 0.8, t0);
  voice.frequency.exponentialRampToValueAtTime(f * 1.25, t0 + length * 0.35);
  voice.frequency.exponentialRampToValueAtTime(f * 0.9, t0 + length);
  const wobble = ctx.createOscillator();
  wobble.frequency.value = 38;
  const depth = ctx.createGain();
  depth.gain.value = f * 0.05;
  wobble.connect(depth).connect(voice.frequency);
  const reed = ctx.createBiquadFilter();
  reed.type = 'bandpass';
  reed.frequency.value = f * 2.1;
  reed.Q.value = 3.5;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(1, t0 + 0.02);
  amp.gain.setValueAtTime(0.85, t0 + length * 0.7);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + length);
  voice.connect(reed).connect(amp).connect(out);
  const air = noiseSource(ctx, noise, t0, length);
  const hiss = ctx.createBiquadFilter();
  hiss.type = 'bandpass';
  hiss.frequency.value = f * 3;
  hiss.Q.value = 1.2;
  air.connect(hiss).connect(envelope(ctx, t0, 0.01, 0.12, length)).connect(out);
  for (const o of [voice, wobble]) { o.start(t0); o.stop(t0 + length + 0.02); }
};

/** Malibu's chirp: two or three quick, bright whistles, each flicking up and back down. */
export const chirp: Synth = (ctx, out, t0, pitch) => {
  const notes = Math.random() < 0.5 ? 2 : 3;
  for (let i = 0; i < notes; i++) {
    const t = t0 + i * 0.085;
    const f = (2600 + Math.random() * 500) * pitch;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 0.8, t);
    osc.frequency.exponentialRampToValueAtTime(f * 1.35, t + 0.025);
    osc.frequency.exponentialRampToValueAtTime(f * 0.95, t + 0.06);
    osc.connect(envelope(ctx, t, 0.006, 0.8, 0.055)).connect(out);
    osc.start(t);
    osc.stop(t + 0.07);
  }
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

/** Lap, lap, lap: a small dog drinking (little wet clicks with a watery ring, about six a second). */
export const lap: Synth = (ctx, out, t0, pitch, noise) => {
  for (let i = 0; i < 14; i++) {
    const t = t0 + i * (0.16 + Math.random() * 0.03);
    const src = noiseSource(ctx, noise, t, 0.04);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = (700 + Math.random() * 250) * pitch;
    filter.Q.value = 4;
    src.connect(filter).connect(envelope(ctx, t, 0.003, 0.55, 0.05)).connect(out);
  }
};

/** Pouring: kibble rattling into a bowl, or water running into one (a soft rushing swell). */
export const pour: Synth = (ctx, out, t0, pitch, noise) => {
  const src = noiseSource(ctx, noise, t0, 0.9);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(900 * pitch, t0);
  filter.frequency.linearRampToValueAtTime(1400 * pitch, t0 + 0.8);
  filter.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.12);
  g.gain.setValueAtTime(0.35, t0 + 0.65);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.9);
  src.connect(filter).connect(g).connect(out);
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
