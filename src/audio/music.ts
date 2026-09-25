// Background music: original tunes written for this game, played by an 8-bit "band" synthesized at play time
// (no audio files).
//
// - "Aloha, Moke" (Hawaiian): elevator music on a Hawaiian beach, played by an old games console. A triangle-wave bass
//   walking between chords, a pulse-wave "ukulele" strumming the island rhythm, a mellow square-wave "steel guitar"
//   lead that slides up into its long notes with a slow vibrato and a soft echo, and a quiet shaker. Gently swung.
// - "Irasshaimase!" (Japan Stores): a Japanese convenience store in 8-bit. Every loop opens with a "ding-dong…
//   welcome!" door chime (original), then a bright tune in the Japanese pop pentatonic over a bouncy shop-radio
//   groove: an octave-jumping bass, off-beat chord stabs, a thin pulse lead and a little drum machine. Midway the
//   bells play the Westminster Quarters, the chime every Japanese school rings (1793, public domain). The real
//   stores' jingles (FamilyMart's, Don Quijote's) are other people's compositions, so they aren't copied here.

import { MUSIC } from '../config/audio';

type ChordName = 'C6' | 'Cmaj7' | 'F' | 'F6' | 'D7' | 'G7' | 'A7' | 'Fmaj7' | 'Dm7' | 'Gm7' | 'C7' | 'Bbmaj7' | 'Am7';

interface Chord {
  /** Bass notes (MIDI): the root, and the note for beat 3 (usually the fifth). */
  bass: readonly [number, number];
  /** Four chord notes for strums and stabs, in the order a downstroke plays them (MIDI). */
  voicing: readonly [number, number, number, number];
  /** Chord tones, as pitch classes (0 = C). The first is the root. */
  tones: readonly number[];
}

export const CHORDS: Readonly<Record<ChordName, Chord>> = {
  // Real ukulele shapes, strings G C E A (re-entrant tuning). The C6 is simply the open strings.
  C6: { bass: [48, 43], voicing: [67, 60, 64, 69], tones: [0, 4, 7, 9] },
  Cmaj7: { bass: [48, 43], voicing: [67, 60, 64, 71], tones: [0, 4, 7, 11] },
  F: { bass: [41, 48], voicing: [69, 60, 65, 69], tones: [5, 9, 0] },
  F6: { bass: [41, 48], voicing: [69, 60, 65, 74], tones: [5, 9, 0, 2] },
  D7: { bass: [50, 45], voicing: [69, 62, 66, 72], tones: [2, 6, 9, 0] },
  G7: { bass: [43, 50], voicing: [67, 62, 65, 71], tones: [7, 11, 2, 5] },
  A7: { bass: [45, 52], voicing: [67, 61, 64, 69], tones: [9, 1, 4, 7] },
  // City-pop voicings, close under the melody.
  Fmaj7: { bass: [41, 48], voicing: [60, 64, 65, 69], tones: [5, 9, 0, 4] },
  Dm7: { bass: [50, 45], voicing: [60, 62, 65, 69], tones: [2, 5, 9, 0] },
  Gm7: { bass: [43, 50], voicing: [62, 65, 67, 70], tones: [7, 10, 2, 5] },
  C7: { bass: [48, 43], voicing: [60, 64, 67, 70], tones: [0, 4, 7, 10] },
  Bbmaj7: { bass: [46, 41], voicing: [62, 65, 69, 70], tones: [10, 2, 5, 9] },
  Am7: { bass: [45, 52], voicing: [60, 64, 67, 69], tones: [9, 0, 4, 7] },
};

/** A note: MIDI (null = rest), length in beats, and optionally a slide up from this many semitones below. */
export type Note = readonly [midi: number | null, beats: number, slide?: number];

export type Drum = 'shaker' | 'kick' | 'snare' | 'hat';

/** How a song is played: the instruments' sounds, and the rhythm section's patterns within a bar. */
export interface Band {
  /** The melody: pulse duty (0.5 = square, 0.125 = thin), low-pass (Hz), vibrato on long notes (cents), level. */
  lead: { duty: number; tone: number; vibrato: number; level: number };
  /** An echo on the melody. */
  echo: { time: number; feedback: number; wet: number };
  /**
   * Chords: when they're struck (beat in the bar, strum direction, velocity), how long they ring at most (s), the
   * gap between strings (s), pulse duty, low-pass (Hz) and level.
   */
  comp: {
    steps: readonly (readonly [beat: number, direction: 'down' | 'up', velocity: number])[];
    ring: number;
    spread: number;
    duty: number;
    tone: number;
    level: number;
  };
  /** 'twoFeel': root and fifth, stepping into chord changes. 'bounce': root, octave, fifth, octave on the beats. */
  bass: { style: 'twoFeel' | 'bounce'; level: number };
  /** One bar of percussion: beat, drum, velocity. */
  drums: readonly (readonly [beat: number, drum: Drum, velocity: number])[];
  /** Chime bells (the `bells` line). */
  bell: { level: number };
  /** A gentle top-end roll-off for the whole band (Hz). */
  mellow: number;
}

export type SongId = 'hawaiian' | 'japan';

export interface Song {
  id: SongId;
  title: string;
  bpm: number;
  /** Where off-beat eighths land within the beat: 0.5 is straight, ~0.6 a lazy lilt. */
  swing: number;
  /** One chord per bar, 4 beats each. */
  bars: readonly ChordName[];
  melody: readonly Note[];
  /** Chime bells, the length of the song (mostly rests). */
  bells?: readonly Note[];
  /** Bars (0-based) with no chords or drums: just bells and a held bass note. */
  sparse?: readonly number[];
  band: Band;
  /** Loudness trim, so every song sits at the same level (measured on an offline render). */
  gain: number;
}

// ---- "Aloha, Moke"

// The A section's tune: sliding steel-guitar phrases over a lazy C6 → F6 → the "Hawaiian vamp" (D7 → G7 → C).
const ALOHA_A: readonly Note[] = [
  [76, 3, 2], [74, 0.5], [72, 0.5],
  [69, 2, 2], [67, 1], [64, 1],
  [65, 1], [69, 1], [72, 1], [74, 1],
  [72, 4, 3],
  [69, 2, 2], [66, 1], [69, 1],
  [67, 2], [71, 1], [74, 1],
  [72, 3, 2], [69, 1],
];
/** The A section ends by resting on G, ready for the bridge... */
const ALOHA_A_TO_B: readonly Note[] = [[67, 3], [null, 1]];
/** ...or climbs back up to the top of the tune. */
const ALOHA_A_TO_TOP: readonly Note[] = [[74, 2], [71, 1], [74, 1]];
// The bridge: up to F, a sweet A7 with a slide into its C#, and back down the vamp.
const ALOHA_B: readonly Note[] = [
  [72, 1], [74, 1], [77, 2, 1],
  [79, 1], [77, 1], [72, 2],
  [76, 2, 2], [79, 1], [76, 1],
  [73, 2, 1], [76, 1], [79, 1],
  [78, 2, 2], [76, 1], [74, 1],
  [74, 1], [71, 1], [67, 2],
  [69, 2, 2], [72, 1], [76, 1],
  [72, 2], [null, 1], [67, 1],
];
const ALOHA_A_BARS: readonly ChordName[] = ['C6', 'Cmaj7', 'F6', 'F6', 'D7', 'G7', 'C6', 'G7'];
const ALOHA_B_BARS: readonly ChordName[] = ['F', 'F', 'C6', 'A7', 'D7', 'G7', 'C6', 'C6'];

/** The island strum: down, down-up, up-down-up. */
const ISLAND_STRUM: Band['comp']['steps'] = [
  [0, 'down', 1],
  [1, 'down', 0.8],
  [1.5, 'up', 0.55],
  [2.5, 'up', 0.6],
  [3, 'down', 0.8],
  [3.5, 'up', 0.55],
];

const ALOHA: Song = {
  id: 'hawaiian',
  title: 'Aloha, Moke',
  bpm: 90,
  swing: 0.6,
  bars: [...ALOHA_A_BARS, ...ALOHA_B_BARS, ...ALOHA_A_BARS],
  melody: [...ALOHA_A, ...ALOHA_A_TO_B, ...ALOHA_B, ...ALOHA_A, ...ALOHA_A_TO_TOP],
  band: {
    lead: { duty: 0.5, tone: 1700, vibrato: 14, level: 0.2 },
    echo: { time: 0.33, feedback: 0.28, wet: 0.22 },
    comp: { steps: ISLAND_STRUM, ring: 0.32, spread: 0.011, duty: 0.25, tone: 3200, level: 0.075 },
    bass: { style: 'twoFeel', level: 0.34 },
    // A shaker in eighths, leaning on the off-beats.
    drums: [0, 1, 2, 3, 4, 5, 6, 7].map((e) => [e / 2, 'shaker', e % 2 ? 1 : 0.55] as const),
    bell: { level: 0 },
    mellow: 5500,
  },
  gain: 1,
};

// ---- "Irasshaimase!"

const REST_BAR: Note = [null, 4];
/** The shop tune, in F with the Japanese pop pentatonic (F G A C D) leading. */
const IRA_A: readonly Note[] = [
  [72, 1], [77, 1], [76, 0.5], [77, 0.5], [81, 1],
  [81, 1.5], [79, 0.5], [77, 1], [74, 1],
  [74, 1], [77, 1], [79, 1], [82, 1],
  [81, 2], [79, 1], [76, 1],
  [76, 1.5], [79, 0.5], [81, 1], [79, 1],
  [77, 2], [74, 1], [72, 1],
  [70, 1], [74, 1], [77, 1], [79, 1],
  [76, 3], [null, 1],
];
const IRA_B: readonly Note[] = [
  [81, 1], [82, 1], [84, 1], [86, 1],
  [84, 2], [82, 1], [79, 1],
  [81, 1.5], [79, 0.5], [76, 1], [72, 1],
  [74, 2], [77, 1], [81, 1],
  [79, 1], [82, 1], [86, 1], [84, 1],
  [82, 1.5], [81, 0.5], [79, 1], [76, 1],
  [77, 3], [null, 1],
  [72, 1], [74, 1], [76, 2],
];
/** The last four bars: the start of the tune again, heading home to the door chime. */
const IRA_A_END: readonly Note[] = [
  [72, 1], [77, 1], [76, 0.5], [77, 0.5], [81, 1],
  [81, 1.5], [79, 0.5], [77, 1], [74, 1],
  [74, 1], [70, 1], [67, 1], [70, 1],
  [72, 2], [null, 2],
];
/** Bells: the door chime (a "ding-dong" and a welcoming rise), and later the school chime. Rests between. */
const IRA_BELLS: readonly Note[] = [
  [81, 2], [77, 2],
  [72, 1], [77, 1], [81, 1], [84, 1],
  ...Array.from({ length: 16 }, () => REST_BAR),
  // The Westminster Quarters (public domain), as Japanese schools ring them: "kin-kon-kan-kon".
  [81, 1], [77, 1], [79, 1], [72, 1],
  [72, 1], [79, 1], [81, 1], [77, 1],
  ...Array.from({ length: 4 }, () => REST_BAR),
];

const IRASSHAIMASE: Song = {
  id: 'japan',
  title: 'Irasshaimase!',
  bpm: 116,
  swing: 0.5,
  bars: [
    'Fmaj7', 'C7',
    'Fmaj7', 'Dm7', 'Gm7', 'C7', 'Am7', 'Dm7', 'Gm7', 'C7',
    'Bbmaj7', 'C7', 'Am7', 'Dm7', 'Gm7', 'C7', 'Fmaj7', 'Fmaj7',
    'Bbmaj7', 'C7',
    'Fmaj7', 'Dm7', 'Gm7', 'C7',
  ],
  melody: [REST_BAR, REST_BAR, ...IRA_A, ...IRA_B, REST_BAR, REST_BAR, ...IRA_A_END],
  bells: IRA_BELLS,
  // The door chime and the school chime ring out over just a held bass note.
  sparse: [0, 1, 18, 19],
  band: {
    lead: { duty: 0.125, tone: 2600, vibrato: 8, level: 0.24 },
    echo: { time: 0.26, feedback: 0.22, wet: 0.16 },
    // Off-beat stabs, the bounce of shop radio.
    comp: {
      steps: [
        [0.5, 'down', 0.7],
        [1.5, 'down', 0.6],
        [2.5, 'down', 0.7],
        [3.5, 'down', 0.6],
      ],
      ring: 0.13,
      spread: 0.004,
      duty: 0.25,
      tone: 2400,
      level: 0.075,
    },
    bass: { style: 'bounce', level: 0.24 },
    drums: [
      [0, 'kick', 1],
      [1, 'snare', 0.75],
      [2, 'kick', 0.85],
      [3, 'snare', 0.8],
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((e) => [e / 2, 'hat', e % 2 ? 0.65 : 0.4] as const),
    ],
    bell: { level: 0.17 },
    mellow: 7500,
  },
  // Offline renders at gain 1: −41.1 dB (−45.3 dB through a phone-speaker filter) against "Aloha, Moke"'s −36.0
  // (−37.1). ×2.15 puts it within ~1.5 dB of it on both.
  gain: 2.15,
};

export const SONGS: Readonly<Record<SongId, Song>> = { hawaiian: ALOHA, japan: IRASSHAIMASE };
/** The first song ("Aloha, Moke"). */
export const SONG = ALOHA;

// ---- From the score to timed events

export type Voice = 'lead' | 'comp' | 'bass' | 'bell' | Drum;

export interface MusicEvent {
  voice: Voice;
  /** Start, in beats from the top of the song (swing applied). */
  beat: number;
  /** Length in beats. */
  beats: number;
  /** MIDI notes: one, or a strum's (in the order they're struck). */
  notes: readonly number[];
  /** 0..1. */
  velocity: number;
  /** Lead only: slide up into the note from this many semitones below. */
  slide: number;
}

/** Every note of one pass through the song, sorted by start. Loops seamlessly: the last bar leads into the first. */
export function songEvents(song: Song = SONG): MusicEvent[] {
  const events: MusicEvent[] = [];
  const { band } = song;
  const swung = (beat: number) => {
    const whole = Math.floor(beat + 1e-9);
    return Math.abs(beat - whole - 0.5) < 1e-6 ? whole + song.swing : beat;
  };
  const add = (voice: Voice, from: number, to: number, notes: readonly number[], velocity: number, slide = 0) => {
    const beat = swung(from);
    events.push({ voice, beat, beats: swung(to) - beat, notes, velocity, slide });
  };
  const line = (voice: Voice, notes: readonly Note[]) => {
    let at = 0;
    for (const [midi, beats, slide] of notes) {
      if (midi !== null) add(voice, at, at + beats, [midi], 1, slide ?? 0);
      at += beats;
    }
  };

  line('lead', song.melody);
  if (song.bells) line('bell', song.bells);

  song.bars.forEach((name, bar) => {
    const chord = CHORDS[name];
    const next = CHORDS[song.bars[(bar + 1) % song.bars.length]!];
    const b = bar * 4;
    if (song.sparse?.includes(bar)) {
      add('bass', b, b + 4, [chord.bass[0]], 0.9);
      return;
    }
    if (band.bass.style === 'twoFeel') {
      // Root and fifth, and a chromatic step up into the next chord when it changes.
      add('bass', b, b + 2, [chord.bass[0]], 1);
      if (next === chord) {
        add('bass', b + 2, b + 4, [chord.bass[1]], 0.9);
      } else {
        add('bass', b + 2, b + 3, [chord.bass[1]], 0.9);
        add('bass', b + 3, b + 4, [next.bass[0] - 1], 0.8);
      }
    } else {
      // Root, octave, fifth, octave: or a step into the next chord on beat 4 when it changes.
      const [root, fifth] = chord.bass;
      add('bass', b, b + 1, [root], 1);
      add('bass', b + 1, b + 2, [root + 12], 0.75);
      add('bass', b + 2, b + 3, [fifth], 0.9);
      add('bass', b + 3, b + 4, [next === chord ? root + 12 : next.bass[0] - 1], 0.75);
    }
    // Chords: down-strums go through the voicing in order; up-strums catch the top three notes, high to low.
    band.comp.steps.forEach(([beat, direction, velocity], i) => {
      const end = band.comp.steps[i + 1]?.[0] ?? 4;
      const notes = direction === 'down' ? chord.voicing : [...chord.voicing].slice(1).reverse();
      add('comp', b + beat, b + end, notes, velocity);
    });
    for (const [beat, drum, velocity] of band.drums) add(drum, b + beat, b + beat + 0.5, [], velocity);
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

/** Percussion levels. */
const DRUM_LEVEL: Readonly<Record<Drum, number>> = { shaker: 0.035, kick: 0.24, snare: 0.1, hat: 0.03 };

/**
 * Plays one song through `out` on an AudioContext, a few notes ahead at a time, fading in and out. Also renders
 * offline: `renderInto(t0)` schedules a whole pass at once on any BaseAudioContext.
 */
export class MusicPlayer {
  private readonly bus: GainNode;
  private readonly leadIn: GainNode;
  /** Where every voice goes (the melody via its echo). */
  private readonly voicesOut: AudioNode;
  private readonly sequencer: MusicSequencer;
  private readonly due: Scheduled[] = [];
  private readonly waves = new Map<number, PeriodicWave>();
  private readonly noise: AudioBuffer;
  private readonly band: Band;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private playing = false;

  constructor(
    private readonly ctx: BaseAudioContext,
    out: AudioNode,
    private readonly song: Song = SONG,
  ) {
    this.band = song.band;
    this.sequencer = new MusicSequencer(songEvents(song), song.bpm, song.bars.length * 4);
    this.noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    // Everything → a gentle top-end roll-off (mellow, like muzak) → the fade → out.
    this.bus = ctx.createGain();
    this.bus.gain.value = 0;
    const mellow = ctx.createBiquadFilter();
    mellow.type = 'lowpass';
    mellow.frequency.value = this.band.mellow;
    mellow.connect(this.bus).connect(out);
    // The melody gets a soft echo.
    this.leadIn = ctx.createGain();
    this.leadIn.connect(mellow);
    const echo = ctx.createDelay(1);
    echo.delayTime.value = this.band.echo.time;
    const feedback = ctx.createGain();
    feedback.gain.value = this.band.echo.feedback;
    const wet = ctx.createGain();
    wet.gain.value = this.band.echo.wet;
    this.leadIn.connect(echo).connect(feedback).connect(echo);
    echo.connect(wet).connect(mellow);
    this.voicesOut = mellow;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Starts playing, fading in to `level` (0..1.5 of MUSIC.level); if it's already playing, just moves to the new
   * level (a volume change, the pause screen) quickly.
   */
  play(level = 1): void {
    const adjusting = this.playing && !this.stopTimer;
    if (this.stopTimer) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.fadeTo(this.target(level), adjusting ? 0.3 : MUSIC.fade);
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

  /** Offline rendering (previews, tests): one whole pass of the song from `t0`, at full level. */
  renderInto(t0: number): number {
    this.bus.gain.value = this.target(1);
    for (const event of songEvents(this.song)) this.playEvent(event, t0 + event.beat * this.sequencer.secondsPerBeat);
    return this.sequencer.loopSeconds;
  }

  private target(level: number): number {
    return level * MUSIC.level * this.song.gain;
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

  private wave(duty: number): PeriodicWave {
    let wave = this.waves.get(duty);
    if (!wave) {
      wave = pulseWave(this.ctx, duty);
      this.waves.set(duty, wave);
    }
    return wave;
  }

  private playEvent(event: MusicEvent, time: number): void {
    const seconds = event.beats * this.sequencer.secondsPerBeat;
    switch (event.voice) {
      case 'lead':
        return this.lead(event, time, seconds);
      case 'comp':
        return this.comp(event, time, seconds);
      case 'bass':
        return this.bass(event, time, seconds);
      case 'bell':
        return this.bell(event, time, seconds);
      case 'shaker':
        return this.noiseHit(time, 'highpass', 6000, DRUM_LEVEL.shaker * event.velocity, 0.045);
      case 'hat':
        return this.noiseHit(time, 'highpass', 7500, DRUM_LEVEL.hat * event.velocity, 0.03);
      case 'snare':
        return this.noiseHit(time, 'bandpass', 1900, DRUM_LEVEL.snare * event.velocity, 0.13);
      case 'kick':
        return this.kick(event, time);
    }
  }

  /** The melody: slides up into slide-marked notes, sings with a slow vibrato on long notes, legato. */
  private lead(event: MusicEvent, t: number, seconds: number): void {
    const ctx = this.ctx;
    const { duty, tone: cutoff, vibrato, level } = this.band.lead;
    const midi = event.notes[0]!;
    const osc = ctx.createOscillator();
    osc.setPeriodicWave(this.wave(duty));
    const target = midiHz(midi);
    if (event.slide > 0) {
      osc.frequency.setValueAtTime(midiHz(midi - event.slide), t);
      osc.frequency.exponentialRampToValueAtTime(target, t + Math.min(0.14, seconds * 0.4));
    } else {
      osc.frequency.setValueAtTime(target, t);
    }
    if (seconds > 0.6 && vibrato > 0) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(vibrato, t + 0.4); // cents: the vibrato blooms as the note holds
      lfo.connect(depth).connect(osc.detune);
      lfo.start(t);
      lfo.stop(t + seconds + 0.2);
    }
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = cutoff;
    const amp = ctx.createGain();
    const peak = level * event.velocity;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(peak * 0.7, t + Math.max(0.03, seconds));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.12);
    osc.connect(tone).connect(amp).connect(this.leadIn);
    osc.start(t);
    osc.stop(t + seconds + 0.15);
    osc.onended = () => amp.disconnect();
  }

  /** A strum or a stab: each note struck a hair after the last. */
  private comp(event: MusicEvent, t: number, seconds: number): void {
    const ctx = this.ctx;
    const { ring: maxRing, spread, duty, tone: cutoff, level } = this.band.comp;
    const ring = Math.min(maxRing, seconds + 0.05);
    event.notes.forEach((midi, i) => {
      const at = t + i * spread;
      const osc = ctx.createOscillator();
      osc.setPeriodicWave(this.wave(duty));
      osc.frequency.value = midiHz(midi);
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = cutoff;
      const amp = ctx.createGain();
      amp.gain.setValueAtTime(0.0001, at);
      amp.gain.exponentialRampToValueAtTime(level * event.velocity, at + 0.004);
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
    const peak = this.band.bass.level * event.velocity;
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

  /** A chiptune bell: a triangle with a quiet square an octave up, struck and left to ring. */
  private bell(event: MusicEvent, t: number, seconds: number): void {
    const ctx = this.ctx;
    const freq = midiHz(event.notes[0]!);
    const ring = seconds + 1.2;
    const amp = ctx.createGain();
    const peak = this.band.bell.level * event.velocity;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.004);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + ring);
    amp.connect(this.voicesOut);
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.value = freq;
    body.connect(amp);
    const shimmer = ctx.createOscillator();
    shimmer.setPeriodicWave(this.wave(0.5));
    shimmer.frequency.value = freq * 2;
    const shimmerLevel = ctx.createGain();
    shimmerLevel.gain.setValueAtTime(0.25, t);
    shimmerLevel.gain.exponentialRampToValueAtTime(0.01, t + 0.35); // the bright strike fades first
    shimmer.connect(shimmerLevel).connect(amp);
    for (const osc of [body, shimmer]) {
      osc.start(t);
      osc.stop(t + ring + 0.02);
    }
    body.onended = () => amp.disconnect();
  }

  /** A burst of filtered noise: the shaker, hi-hat and snare. */
  private noiseHit(t: number, type: BiquadFilterType, freq: number, peak: number, decay: number): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const tone = ctx.createBiquadFilter();
    tone.type = type;
    tone.frequency.value = freq;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    src.connect(tone).connect(amp).connect(this.voicesOut);
    src.start(t, Math.random() * 0.8, decay + 0.015);
    src.onended = () => amp.disconnect();
  }

  /** A console kick: a triangle dropping fast in pitch. */
  private kick(event: MusicEvent, t: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(48, t + 0.09);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(DRUM_LEVEL.kick * event.velocity, t + 0.002);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    osc.connect(amp).connect(this.voicesOut);
    osc.start(t);
    osc.stop(t + 0.18);
    osc.onended = () => amp.disconnect();
  }
}
