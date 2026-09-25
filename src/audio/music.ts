// Background music: "Aloha, Moke", an original 8-bit island-lounge tune (think elevator music on a Hawaiian beach,
// played by an old games console). Written for this game and synthesized at play time: no audio files.
//
// The band: a triangle-wave bass walking between chords, a pulse-wave "ukulele" strumming the classic island
// rhythm, a mellow square-wave "steel guitar" lead that slides up into its long notes with a slow vibrato and a
// soft echo, and a quiet shaker. Gently swung at an easy-listening tempo.

import { MUSIC } from '../config/audio';

type ChordName = 'C6' | 'Cmaj7' | 'F' | 'F6' | 'D7' | 'G7' | 'A7';

interface Chord {
  /** Bass notes (MIDI): the root on beat 1, the other on beat 3. */
  bass: readonly [number, number];
  /** Ukulele voicing, in string order G C E A (re-entrant tuning), MIDI. */
  uke: readonly [number, number, number, number];
  /** Chord tones, as pitch classes (0 = C). */
  tones: readonly number[];
}

/** Real ukulele chord shapes. The C6 is simply the open strings. */
export const CHORDS: Readonly<Record<ChordName, Chord>> = {
  C6: { bass: [48, 43], uke: [67, 60, 64, 69], tones: [0, 4, 7, 9] },
  Cmaj7: { bass: [48, 43], uke: [67, 60, 64, 71], tones: [0, 4, 7, 11] },
  F: { bass: [41, 48], uke: [69, 60, 65, 69], tones: [5, 9, 0] },
  F6: { bass: [41, 48], uke: [69, 60, 65, 74], tones: [5, 9, 0, 2] },
  D7: { bass: [50, 45], uke: [69, 62, 66, 72], tones: [2, 6, 9, 0] },
  G7: { bass: [43, 50], uke: [67, 62, 65, 71], tones: [7, 11, 2, 5] },
  A7: { bass: [45, 52], uke: [67, 61, 64, 69], tones: [9, 1, 4, 7] },
};

/** A melody note: MIDI (null = rest), length in beats, and optionally a slide up from this many semitones below. */
export type Note = readonly [midi: number | null, beats: number, slide?: number];

export interface Song {
  title: string;
  bpm: number;
  /** Where off-beat eighths land within the beat: 0.5 is straight, ~0.6 a lazy island lilt. */
  swing: number;
  /** One chord per bar, 4 beats each. */
  bars: readonly ChordName[];
  melody: readonly Note[];
}

// The A section's tune: sliding steel-guitar phrases over a lazy C6 → F6 → the "Hawaiian vamp" (D7 → G7 → C).
const A: readonly Note[] = [
  [76, 3, 2], [74, 0.5], [72, 0.5],
  [69, 2, 2], [67, 1], [64, 1],
  [65, 1], [69, 1], [72, 1], [74, 1],
  [72, 4, 3],
  [69, 2, 2], [66, 1], [69, 1],
  [67, 2], [71, 1], [74, 1],
  [72, 3, 2], [69, 1],
];
/** The A section ends by resting on G, ready for the bridge... */
const A_END_TO_B: readonly Note[] = [[67, 3], [null, 1]];
/** ...or climbs back up to the top of the tune. */
const A_END_TO_TOP: readonly Note[] = [[74, 2], [71, 1], [74, 1]];
// The bridge: up to F, a sweet A7 with a slide into its C#, and back down the vamp.
const B: readonly Note[] = [
  [72, 1], [74, 1], [77, 2, 1],
  [79, 1], [77, 1], [72, 2],
  [76, 2, 2], [79, 1], [76, 1],
  [73, 2, 1], [76, 1], [79, 1],
  [78, 2, 2], [76, 1], [74, 1],
  [74, 1], [71, 1], [67, 2],
  [69, 2, 2], [72, 1], [76, 1],
  [72, 2], [null, 1], [67, 1],
];

const A_BARS: readonly ChordName[] = ['C6', 'Cmaj7', 'F6', 'F6', 'D7', 'G7', 'C6', 'G7'];
const B_BARS: readonly ChordName[] = ['F', 'F', 'C6', 'A7', 'D7', 'G7', 'C6', 'C6'];

export const SONG: Song = {
  title: 'Aloha, Moke',
  bpm: 90,
  swing: 0.6,
  bars: [...A_BARS, ...B_BARS, ...A_BARS],
  melody: [...A, ...A_END_TO_B, ...B, ...A, ...A_END_TO_TOP],
};

// ---- From the score to timed events

export type Voice = 'lead' | 'uke' | 'bass' | 'shaker';

export interface MusicEvent {
  voice: Voice;
  /** Start, in beats from the top of the song (swing applied). */
  beat: number;
  /** Length in beats. */
  beats: number;
  /** MIDI notes: one, or a ukulele strum's four (in the order they're struck). */
  notes: readonly number[];
  /** 0..1. */
  velocity: number;
  /** Lead only: slide up into the note from this many semitones below. */
  slide: number;
}

/** The island strum: down, down-up, up-down-up (beat within the bar, direction, velocity). */
const STRUM: readonly (readonly [number, 'down' | 'up', number])[] = [
  [0, 'down', 1],
  [1, 'down', 0.8],
  [1.5, 'up', 0.55],
  [2.5, 'up', 0.6],
  [3, 'down', 0.8],
  [3.5, 'up', 0.55],
];

/** Every note of one pass through the song, sorted by start. Loops seamlessly: the last bar leads into the first. */
export function songEvents(song: Song = SONG): MusicEvent[] {
  const events: MusicEvent[] = [];
  const swung = (beat: number) => {
    const whole = Math.floor(beat + 1e-9);
    return Math.abs(beat - whole - 0.5) < 1e-6 ? whole + song.swing : beat;
  };
  const add = (voice: Voice, from: number, to: number, notes: readonly number[], velocity: number, slide = 0) => {
    const beat = swung(from);
    events.push({ voice, beat, beats: swung(to) - beat, notes, velocity, slide });
  };

  // The steel guitar.
  let at = 0;
  for (const [midi, beats, slide] of song.melody) {
    if (midi !== null) add('lead', at, at + beats, [midi], 1, slide ?? 0);
    at += beats;
  }

  song.bars.forEach((name, bar) => {
    const chord = CHORDS[name];
    const next = CHORDS[song.bars[(bar + 1) % song.bars.length]!];
    const b = bar * 4;
    // Bass: root and fifth, and a chromatic step up into the next chord when it changes.
    add('bass', b, b + 2, [chord.bass[0]], 1);
    if (next === chord) {
      add('bass', b + 2, b + 4, [chord.bass[1]], 0.9);
    } else {
      add('bass', b + 2, b + 3, [chord.bass[1]], 0.9);
      add('bass', b + 3, b + 4, [next.bass[0] - 1], 0.8);
    }
    // Ukulele: down-strums go low to high, up-strums catch the top three strings, high to low.
    STRUM.forEach(([beat, direction, velocity], i) => {
      const end = STRUM[i + 1]?.[0] ?? 4;
      const strings = direction === 'down' ? chord.uke : [...chord.uke].slice(1).reverse();
      add('uke', b + beat, b + end, strings, velocity);
    });
    // Shaker: eighths, leaning on the off-beats.
    for (let e = 0; e < 8; e++) add('shaker', b + e / 2, b + e / 2 + 0.5, [], e % 2 ? 1 : 0.55);
  });

  return events.sort((p, q) => p.beat - q.beat);
}

// ---- When to play what

export interface Scheduled {
  event: MusicEvent;
  /** Audio-clock time (s). */
  time: number;
}

/**
 * Walks the song's events against the audio clock, looping forever. Pure timing (no Web Audio), so it's tested
 * on its own: each note is handed out exactly once, a little ahead of time, and never late in a burst.
 */
export class MusicSequencer {
  readonly secondsPerBeat: number;
  readonly loopSeconds: number;
  private index = 0;
  private loopStart = 0;

  constructor(
    private readonly events: readonly MusicEvent[],
    bpm: number,
    loopBeats: number,
  ) {
    this.secondsPerBeat = 60 / bpm;
    this.loopSeconds = loopBeats * this.secondsPerBeat;
  }

  /** The song's first beat plays at `time`. */
  start(time: number): void {
    this.index = 0;
    this.loopStart = time;
  }

  /**
   * Events due before `until`, in order, into `out`. Anything that should already have started more than `grace`
   * seconds before `now` is skipped (the page was busy or throttled): the song carries on from where it should be.
   */
  take(now: number, until: number, out: Scheduled[], grace = 0.05): void {
    out.length = 0;
    if (this.events.length === 0) return;
    // Far behind (more than a whole loop): jump straight to the current loop.
    if (now - this.loopStart > this.loopSeconds * 2) {
      this.loopStart += Math.floor((now - this.loopStart) / this.loopSeconds - 1) * this.loopSeconds;
      this.index = 0;
    }
    for (let guard = 0; guard < this.events.length * 3; guard++) {
      const event = this.events[this.index]!;
      const time = this.loopStart + event.beat * this.secondsPerBeat;
      if (time >= until) break;
      if (time >= now - grace) out.push({ event, time });
      this.index++;
      if (this.index >= this.events.length) {
        this.index = 0;
        this.loopStart += this.loopSeconds;
      }
    }
  }
}

// ---- The sounds

const midiHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** A band-limited pulse wave (duty 0.5 = square): the classic console voices. */
function pulseWave(ctx: BaseAudioContext, duty: number, harmonics = 24): PeriodicWave {
  const real = new Float32Array(harmonics + 1);
  const imag = new Float32Array(harmonics + 1);
  for (let n = 1; n <= harmonics; n++) {
    real[n] = (2 / (n * Math.PI)) * Math.sin(2 * Math.PI * n * duty);
    imag[n] = (2 / (n * Math.PI)) * (1 - Math.cos(2 * Math.PI * n * duty));
  }
  return ctx.createPeriodicWave(real, imag);
}

/** Mix levels of the band. */
const MIX = { lead: 0.2, uke: 0.075, bass: 0.34, shaker: 0.035, echo: 0.22, echoFeedback: 0.28, echoTime: 0.33 };

/**
 * Plays the song through `out` on an AudioContext, a few notes ahead at a time, fading in and out. Also renders
 * offline: `renderInto(t0)` schedules a whole pass at once on any BaseAudioContext.
 */
export class MusicPlayer {
  private readonly bus: GainNode;
  private readonly leadIn: GainNode;
  /** Where every voice goes (the steel guitar via its echo). */
  private readonly voicesOut: AudioNode;
  private readonly sequencer: MusicSequencer;
  private readonly due: Scheduled[] = [];
  private readonly square: PeriodicWave;
  private readonly pulse: PeriodicWave;
  private readonly noise: AudioBuffer;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;

  constructor(
    private readonly ctx: BaseAudioContext,
    out: AudioNode,
    private readonly song: Song = SONG,
  ) {
    const events = songEvents(song);
    this.sequencer = new MusicSequencer(events, song.bpm, song.bars.length * 4);
    this.square = pulseWave(ctx, 0.5);
    this.pulse = pulseWave(ctx, 0.25);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Everything → a gentle top-end roll-off (mellow, like muzak) → the fade → out.
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    const mellow = ctx.createBiquadFilter();
    mellow.type = 'lowpass';
    mellow.frequency.value = 5500;
    mellow.connect(this.bus).connect(out);
    // The steel guitar gets a soft echo, for that lazy lounge space.
    this.leadIn = ctx.createGain();
    this.leadIn.connect(mellow);
    const echo = ctx.createDelay(1);
    echo.delayTime.value = MIX.echoTime;
    const feedback = ctx.createGain();
    feedback.gain.value = MIX.echoFeedback;
    const wet = ctx.createGain();
    wet.gain.value = MIX.echo;
    this.leadIn.connect(echo).connect(feedback).connect(echo);
    echo.connect(wet).connect(mellow);
    this.voicesOut = mellow;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /** Starts (or carries on) playing, fading in to `level` (0..1 of MUSIC.level). */
  play(level = 1): void {
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.fadeTo(level * MUSIC.level);
    if (this.playing) return;
    this.playing = true;
    this.sequencer.start(this.ctx.currentTime + 0.1);
    this.tick();
  }

  /** Fades out, then stops scheduling. */
  stop(): void {
    if (!this.playing || this.stopTimer) return;
    this.fadeTo(0);
    this.stopTimer = setTimeout(() => {
      this.stopTimer = null;
      this.playing = false;
      if (this.timer) clearTimeout(this.timer);
      this.timer = null;
    }, MUSIC.fade * 1000 + 100);
  }

  /** A quieter or fuller level while it plays (0..1 of MUSIC.level). */
  setLevel(level: number): void {
    if (this.playing && !this.stopTimer) this.fadeTo(level * MUSIC.level, 0.6);
  }

  /** Offline rendering (previews, tests): one whole pass of the song from `t0`, at full level. */
  renderInto(t0: number): number {
    this.bus.gain.value = MUSIC.level;
    for (const event of songEvents(this.song)) this.playEvent(event, t0 + event.beat * this.sequencer.secondsPerBeat);
    return this.sequencer.loopSeconds;
  }

  private readonly tick = (): void => {
    const now = this.ctx.currentTime;
    this.sequencer.take(now, now + MUSIC.lookahead, this.due);
    for (const { event, time } of this.due) this.playEvent(event, time);
    this.timer = setTimeout(this.tick, MUSIC.tick * 1000);
  };

  private fadeTo(target: number, seconds: number = MUSIC.fade): void {
    const g = this.bus.gain;
    const now = this.ctx.currentTime;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(target, now + seconds);
  }

  private playEvent(event: MusicEvent, time: number): void {
    const seconds = event.beats * this.sequencer.secondsPerBeat;
    if (event.voice === 'lead') this.lead(event, time, seconds);
    else if (event.voice === 'uke') this.uke(event, time, seconds);
    else if (event.voice === 'bass') this.bass(event, time, seconds);
    else this.shaker(event, time);
  }

  /** The steel guitar: slides up into the note, sings with a slow vibrato on long notes, legato. */
  private lead(event: MusicEvent, t: number, seconds: number): void {
    const ctx = this.ctx;
    const midi = event.notes[0]!;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.square);
    const target = midiHz(midi);
    if (event.slide > 0) {
      osc.frequency.setValueAtTime(midiHz(midi - event.slide), t);
      osc.frequency.exponentialRampToValueAtTime(target, t + Math.min(0.14, seconds * 0.4));
    } else {
      osc.frequency.setValueAtTime(target, t);
    }
    if (seconds > 0.6) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(14, t + 0.4); // cents: the vibrato blooms as the note holds
      lfo.connect(depth).connect(osc.detune);
      lfo.start(t);
      lfo.stop(t + seconds + 0.2);
    }
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = 1700;
    const amp = ctx.createGain();
    const peak = MIX.lead * event.velocity;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(peak * 0.7, t + Math.max(0.03, seconds));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.12);
    osc.connect(tone).connect(amp).connect(this.leadIn);
    osc.start(t);
    osc.stop(t + seconds + 0.15);
    osc.onended = () => amp.disconnect();
  }

  /** One ukulele strum: each string plucked a hair after the last. */
  private uke(event: MusicEvent, t: number, seconds: number): void {
    const ctx = this.ctx;
    const ring = Math.min(0.32, seconds + 0.05);
    event.notes.forEach((midi, i) => {
      const at = t + i * 0.011;
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(this.pulse);
      osc.frequency.value = midiHz(midi);
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 3200;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, at);
      amp.gain.exponentialRampToValueAtTime(MIX.uke * event.velocity, at + 0.004);
      amp.gain.exponentialRampToValueAtTime(0.0001, at + ring);
      osc.connect(tone).connect(amp).connect(this.voicesOut);
      osc.start(at);
      osc.stop(at + ring + 0.02);
      osc.onended = () => amp.disconnect();
    });
  }

  /** The triangle bass, like a console's: round and steady. */
  private bass(event: MusicEvent, t: number, seconds: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiHz(event.notes[0]!);
    const amp = ctx.createGain();
    const peak = MIX.bass * event.velocity;
    const end = t + seconds * 0.88;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    amp.gain.setValueAtTime(peak, end - 0.05);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(amp).connect(this.voicesOut);
    osc.start(t);
    osc.stop(end + 0.02);
    osc.onended = () => amp.disconnect();
  }

  /** A soft shaker: a tick of high noise. */
  private shaker(event: MusicEvent, t: number): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const tone = ctx.createBiquadFilter();
    tone.type = 'highpass';
    tone.frequency.value = 6000;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(MIX.shaker * event.velocity, t + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
    src.connect(tone).connect(amp).connect(this.voicesOut);
    src.start(t, Math.random() * 0.9, 0.06);
    src.onended = () => amp.disconnect();
  }
}
