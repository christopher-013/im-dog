// Background music: original tunes written for this game, played by an 8-bit "band" synthesized at play time
// (no audio files). The ride's song swaps the console for an 80s polysynth and drum machine, synthesized the same way.
//
// - "Aloha, Moke" (Hawaiian): elevator music on a Hawaiian beach, played by an old games console. A triangle-wave bass
//   walking between chords, a pulse-wave "ukulele" strumming the island rhythm, a mellow square-wave "steel guitar"
//   lead that slides up into its long notes with a slow vibrato and a soft echo, and a quiet shaker. Gently swung.
// - "Irasshaimase!" (Japan Stores): a Japanese convenience store in 8-bit. Every loop opens with a "ding-dong…
//   welcome!" door chime (original), then a bright tune in the Japanese pop pentatonic over a bouncy shop-radio
//   groove: an octave-jumping bass, off-beat chord stabs, a thin pulse lead and a little drum machine. Midway the
//   bells play the Westminster Quarters, the chime every Japanese school rings (1793, public domain). The real
//   stores' jingles (FamilyMart's, Don Quijote's) are other people's compositions, so they aren't copied here.
// - "Paws Up!" (Choose Your Dog only, not a Music setting): an arcade fighting game's character-select theme, in
//   8-bit. Fast and in a minor key: a pumping octave bass, power-chord stabs on a 3-3-2 rhythm, four-on-the-floor
//   kicks and a heroic pulse lead. Written for this game in that genre's style; no real game's music is copied.
// - "Last Light" (going for a ride only, Phase 6): a dark, brooding 80s synth-pop drive into the sunset (owner,
//   2026-10-17: "more edgy and dark for a brooding drive with purpose... lower deep baselines but 80s synth sounds";
//   then "too Japanese inspired versus 80s synth pop"). Not the console band: an 80s polysynth and drum machine. D
//   minor at 100 BPM on the VI–VII–i climb (B♭, C, Dm): a deep sawtooth bass pulsing in eighths, swelling sawtooth
//   string pads, a sixteenth-note arpeggio, a big gated snare over a deep kick, and a plain detuned-sawtooth lead
//   (no slides, barely any vibrato). It replaced "Neon Coastline" and, before it, "Coastline Cruise" (both original
//   too). Written for this game in that style; no real song is copied. Now the backup (`MUSIC.rideSong`).
// - "Sundown Run" (the ride's song, Phase 6): synthwave (owner, 2026-10-17: an original "in that style, faster
//   pumping beat and rolling sixteenth note", after naming a commercial synthwave track the game can't use; then a
//   screen recording of it, "try for something like this tempo and beat tones"). A minor at 80 BPM: a deep kick on
//   every beat, a plucked sawtooth bass rolling in sixteenths (root, octave on the "and") over a sustained sub, both
//   the sub and the dark sawtooth pads ducking with every kick, a big snare ringing out on 2 and 4, open hats, and a
//   soaring detuned-sawtooth lead. The recording was measured for tempo, beat and tone only; its melody and chords
//   weren't transcribed, and no real song is copied.

import { MUSIC } from '../config/audio';

type ChordName =
  | 'C6' | 'Cmaj7' | 'F' | 'F6' | 'D7' | 'G7' | 'A7' | 'Fmaj7' | 'Dm7' | 'Gm7' | 'C7' | 'Bbmaj7' | 'Am7'
  | 'Em' | 'C' | 'D' | 'B7' | 'Am' | 'A' | 'Bm' | 'G' | 'E' | 'Dm' | 'Bb' | 'Gm' | 'Fadd9';

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
  // Plain triads for the fight theme, stacked low and tight so the stabs punch.
  Em: { bass: [40, 47], voicing: [59, 64, 67, 71], tones: [4, 7, 11] },
  C: { bass: [48, 43], voicing: [60, 64, 67, 72], tones: [0, 4, 7] },
  D: { bass: [50, 45], voicing: [62, 66, 69, 74], tones: [2, 6, 9] },
  B7: { bass: [47, 42], voicing: [59, 63, 66, 69], tones: [11, 3, 6, 9] },
  Am: { bass: [45, 52], voicing: [57, 60, 64, 69], tones: [9, 0, 4] },
  // The ride's 80s pop triads, bright and open.
  A: { bass: [45, 52], voicing: [61, 64, 69, 73], tones: [9, 1, 4] },
  Bm: { bass: [47, 42], voicing: [62, 66, 71, 74], tones: [11, 2, 6] },
  G: { bass: [43, 50], voicing: [62, 67, 71, 74], tones: [7, 11, 2] },
  // The ride's minor-key drama: a dark E major (the harmonic minor's V) and D minor.
  E: { bass: [40, 47], voicing: [59, 64, 68, 71], tones: [4, 8, 11] },
  Dm: { bass: [50, 45], voicing: [62, 65, 69, 74], tones: [2, 5, 9] },
  // "Last Light": dark pads, voiced low.
  Bb: { bass: [46, 41], voicing: [58, 62, 65, 70], tones: [10, 2, 5] },
  Gm: { bass: [43, 50], voicing: [55, 58, 62, 67], tones: [7, 10, 2] },
  // "Sundown Run": a wide synthwave F, the G on top.
  Fadd9: { bass: [41, 48], voicing: [60, 65, 67, 69], tones: [5, 9, 0] },
};

/** A note: MIDI (null = rest), length in beats, and optionally a slide up from this many semitones below. */
export type Note = readonly [midi: number | null, beats: number, slide?: number];

export type Drum = 'shaker' | 'kick' | 'snare' | 'hat' | 'open';

/** How a song is played: the instruments' sounds, and the rhythm section's patterns within a bar. */
export interface Band {
  /**
   * The melody: pulse duty (0.5 = square, 0.125 = thin), low-pass (Hz), vibrato on long notes (cents), level.
   * `synth`: instead of the console's pulse, two sawtooths `detune` cents apart through a resonant low-pass that opens
   * on each note (an 80s polysynth).
   */
  lead: { duty: number; tone: number; vibrato: number; level: number; synth?: { detune: number; resonance: number } };
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
    /** Sawtooth string pads instead of plucked pulses: two detuned saws a note, swelling in and held to the next. */
    pad?: { attack: number; release: number; detune: number };
  };
  /** A sequencer arpeggio: the chord's notes in sixteenths (`pattern` indexes the voicing), short filtered plucks. */
  arp?: { pattern: readonly number[]; octave: number; tone: number; decay: number; level: number };
  /**
   * 'twoFeel': root and fifth, stepping into chord changes. 'bounce': root, octave, fifth, octave on the beats.
   * 'drive': pumping eighths, root and octave, with the fifth near the end of the bar.
   * 'sequence': a sequencer's sixteenths, the root with the octave on every fourth, the fifth leading into the next bar.
   * 'pulse': a relentless eighth-note root, the octave on the last eighth.
   * 'roll': rolling sixteenths, the root with the octave on each "and".
   * `wave`: the console's round triangle (the default) or a gritty sawtooth through a low-pass at `tone` (Hz), which
   * opens a little at the start of each note.
   * `octave`: semitones to shift the line by (−12: an octave down, deep).
   */
  bass: { style: 'twoFeel' | 'bounce' | 'drive' | 'sequence' | 'pulse' | 'roll'; level: number; wave?: 'triangle' | 'saw'; tone?: number; octave?: number };
  /** One bar of percussion: beat, drum, velocity. */
  drums: readonly (readonly [beat: number, drum: Drum, velocity: number])[];
  /** The big 80s snare: a drum's body under a burst of room noise, held, then cut dead by a gate. */
  gatedSnare?: boolean;
  /** A drum machine's deep, booming kick instead of the console's short thump. */
  deepKick?: boolean;
  /** Sidechain pumping: the chords, the bass and the sub duck by this much (0..1) on every kick, swelling back before the next. */
  pump?: number;
  /** A sub bass under everything: the chord's root an octave below its written bass note, held for the bar (low-pass, Hz). */
  sub?: { level: number; tone: number };
  /** How loud the hi-hats (closed and open) are, × their usual level. */
  hats?: number;
  /** With `gatedSnare`: let the snare's room ring out for this long (s) before the gate shuts it. */
  snareTail?: number;
  /** Chime bells (the `bells` line). */
  bell: { level: number };
  /** A gentle top-end roll-off for the whole band (Hz). */
  mellow: number;
}

/** The background songs (the pause screen's Music setting). */
export type SongId = 'hawaiian' | 'japan';
/** Every tune: the background songs, Choose Your Dog's theme and the ride's. */
export type TuneId = SongId | 'fight' | 'cruise';

export interface Song {
  id: TuneId;
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

// ---- "Paws Up!"

/** The fight theme's tune, in E minor: a dotted call ("dum — da-dum dum"), answered higher, then the B7 cliffhanger. */
const PAWS_A: readonly Note[] = [
  [76, 1.5], [71, 0.5], [76, 1], [79, 1],
  [78, 0.5], [79, 0.5], [78, 1], [76, 1], [71, 1],
  [72, 1.5], [76, 0.5], [79, 1], [76, 1],
  [74, 1.5], [78, 0.5], [81, 1], [78, 1],
  [76, 1.5], [71, 0.5], [76, 1], [79, 1],
  [83, 1], [81, 0.5], [79, 0.5], [78, 1], [79, 1],
  [76, 1], [79, 1], [84, 1], [83, 1],
  [83, 2], [75, 1], [78, 1],
];
/** The second half climbs to the top and runs back down into the B7, ready for the next round. */
const PAWS_B: readonly Note[] = [
  [81, 1.5], [76, 0.5], [81, 1], [84, 1],
  [83, 0.5], [84, 0.5], [83, 1], [81, 1], [76, 1],
  [79, 1.5], [76, 0.5], [79, 1], [83, 1],
  [83, 0.5], [81, 0.5], [79, 1], [78, 1], [76, 1],
  [84, 1], [83, 1], [81, 1], [79, 1],
  [81, 1], [79, 1], [78, 1], [74, 1],
  [75, 1], [78, 1], [81, 1], [83, 1],
  [83, 2], [null, 1], [71, 1],
];

const PAWS_UP: Song = {
  id: 'fight',
  title: 'Paws Up!',
  bpm: 148,
  swing: 0.5,
  bars: ['Em', 'Em', 'C', 'D', 'Em', 'Em', 'C', 'B7', 'Am', 'Am', 'Em', 'Em', 'C', 'D', 'B7', 'B7'],
  melody: [...PAWS_A, ...PAWS_B],
  band: {
    lead: { duty: 0.25, tone: 3600, vibrato: 12, level: 0.19 },
    echo: { time: 0.3, feedback: 0.2, wet: 0.14 },
    // Power stabs on the 3-3-2 rhythm (beats 1, the "and" of 2, and 4): the push of a fight theme.
    comp: {
      steps: [
        [0, 'down', 1],
        [1.5, 'down', 0.85],
        [3, 'down', 0.9],
      ],
      ring: 0.16,
      spread: 0.003,
      duty: 0.5,
      tone: 2200,
      level: 0.06,
    },
    bass: { style: 'drive', level: 0.22 },
    // Four on the floor, a snare on 2 and 4, hats on every eighth.
    drums: [
      [0, 'kick', 1],
      [1, 'kick', 0.8],
      [2, 'kick', 0.95],
      [3, 'kick', 0.8],
      [1, 'snare', 0.8],
      [3, 'snare', 0.85],
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((e) => [e / 2, 'hat', e % 2 ? 0.7 : 0.35] as const),
    ],
    bell: { level: 0 },
    mellow: 9000,
  },
  // Offline renders at gain 1: −39.3 dB (−40.6 dB through a phone-speaker filter) against "Aloha, Moke"'s −34.1
  // (−34.7), measured the same way on the same day. ×1.9 puts it within ~0.5 dB of it on both.
  gain: 1.9,
};

// ---- "Last Light"

/** The hook, twice: up through D minor to the D, down over B♭ and C, the second time reaching the F. */
const LAST_A: readonly Note[] = [
  [69, 1.5], [65, 0.5], [69, 1], [72, 1],
  [74, 3], [72, 0.5], [69, 0.5],
  [74, 1.5], [72, 0.5], [70, 2],
  [72, 2], [67, 1], [64, 1],
  [69, 1.5], [65, 0.5], [69, 1], [72, 1],
  [77, 3], [76, 0.5], [74, 0.5],
  [74, 1.5], [72, 0.5], [70, 1], [65, 1],
  [64, 2], [67, 2],
];
/** The lift: over G minor, B♭ and C, climbing to the high F, then the dark A major turning back into the hook. */
const LAST_B: readonly Note[] = [
  [74, 2], [70, 1], [67, 1],
  [67, 1.5], [70, 0.5], [74, 2],
  [77, 2], [74, 1], [72, 1],
  [76, 3], [72, 1],
  [74, 2], [70, 1], [74, 1],
  [77, 2], [74, 1], [77, 1],
  [76, 3], [73, 1],
  [69, 2], [null, 2],
];

const LAST_LIGHT: Song = {
  id: 'cruise',
  title: 'Last Light',
  bpm: 100,
  swing: 0.5,
  bars: ['Dm', 'Dm', 'Bb', 'C', 'Dm', 'Dm', 'Bb', 'C', 'Gm', 'Gm', 'Bb', 'C', 'Gm', 'Bb', 'A', 'A'],
  melody: [...LAST_A, ...LAST_B],
  band: {
    // A plain polysynth lead: two detuned sawtooths, a touch of resonance, almost no vibrato.
    lead: { duty: 0.5, tone: 1700, vibrato: 5, level: 0.09, synth: { detune: 8, resonance: 3 } },
    // A dotted-eighth echo, kept short.
    echo: { time: 0.45, feedback: 0.3, wet: 0.22 },
    // Sawtooth strings: one chord a bar, swelling in and held into the next.
    comp: {
      steps: [[0, 'down', 1]],
      ring: 3,
      spread: 0,
      duty: 0.5,
      tone: 1300,
      level: 0.03,
      pad: { attack: 0.35, release: 0.5, detune: 10 },
    },
    // The sequencer under it all: the chord in sixteenths, up and back.
    arp: { pattern: [0, 1, 2, 3, 2, 1, 2, 3], octave: 0, tone: 1900, decay: 0.12, level: 0.18 },
    // The engine of it: a deep sawtooth pulsing in eighths, an octave down.
    bass: { style: 'pulse', level: 0.22, wave: 'saw', tone: 380, octave: -12 },
    // A deep kick on 1 and 3 (and pushing into 3), the big gated snare on 2 and 4, eighth hats.
    drums: [
      [0, 'kick', 1],
      [2, 'kick', 1],
      [1.5, 'kick', 0.55],
      [1, 'snare', 1],
      [3, 'snare', 1],
      ...[0, 1, 2, 3, 4, 5, 6, 7].map((e) => [e / 2, 'hat', e % 2 ? 0.4 : 0.2] as const),
    ],
    gatedSnare: true,
    deepKick: true,
    bell: { level: 0 },
    mellow: 8000,
  },
  // Offline render at gain 1: −39.9 dB against "Aloha, Moke"'s −34.1 (measured the same way, 2026-10-17). ×1.95 puts
  // it within ~0.1 dB of it. Alone, each part: bass −42.9, lead −45.9, drums −48.8, pads −49.4, arpeggio −56.4.
  gain: 1.95,
};

// ---- "Sundown Run"

/** The climb: up through A minor, F and C to a long G, the hook ringing out over the first chords. */
const SUNDOWN_A: readonly Note[] = [
  [76, 2], [72, 1], [74, 1],
  [76, 1.5], [79, 0.5], [76, 1], [72, 1],
  [77, 1.5], [76, 0.5], [72, 2],
  [69, 2], [72, 1], [74, 1],
  [76, 2], [79, 1], [76, 1],
  [72, 2], [67, 1], [72, 1],
  [74, 1.5], [71, 0.5], [74, 2],
  [79, 3], [null, 1],
];
/** The lift: soaring to the high A over F and G, then the E major pulling back round to the top. */
const SUNDOWN_B: readonly Note[] = [
  [81, 2], [79, 1], [77, 1],
  [79, 2], [74, 1], [71, 1],
  [76, 1.5], [72, 0.5], [76, 1], [81, 1],
  [81, 3], [79, 0.5], [77, 0.5],
  [77, 2], [72, 1], [77, 1],
  [79, 2], [74, 1], [79, 1],
  [80, 3], [76, 1],
  [71, 2], [null, 2],
];

const SUNDOWN_RUN: Song = {
  id: 'cruise',
  title: 'Sundown Run',
  // The owner's reference (a screen recording, kept private): about 80 BPM, a kick on every beat, the snare on 2 and 4
  // with a long room tail, open hats on the "and", sixteenths rolling in the middle, a sustained sub pumping on every
  // kick, the low end loudest and the top end dark. Measured for tempo, beat and tone only: no melody or chords.
  bpm: 80,
  swing: 0.5,
  bars: ['Am', 'Am', 'Fadd9', 'Fadd9', 'C', 'C', 'G', 'G', 'Fadd9', 'G', 'Am', 'Am', 'Fadd9', 'G', 'E', 'E'],
  melody: [...SUNDOWN_A, ...SUNDOWN_B],
  band: {
    // A big detuned-sawtooth lead, no slides, a little darker than bright.
    lead: { duty: 0.5, tone: 1900, vibrato: 6, level: 0.065, synth: { detune: 10, resonance: 2 } },
    // A dotted-eighth echo: the lead hanging in the air.
    echo: { time: 0.5625, feedback: 0.35, wet: 0.24 },
    // Dark, wide sawtooth pads, a chord a bar, pumping with the kick.
    comp: {
      steps: [[0, 'down', 1]],
      ring: 3,
      spread: 0,
      duty: 0.5,
      tone: 1100,
      level: 0.036,
      pad: { attack: 0.08, release: 0.4, detune: 14 },
    },
    // The rolling sixteenths: a plucked sawtooth line in the middle, the root with the octave on each "and".
    bass: { style: 'roll', level: 0.34, wave: 'saw', tone: 900, octave: 12 },
    // Under it, the sub, the loudest thing in the song: the root two octaves below the line, held for the bar.
    sub: { level: 0.27, tone: 90 },
    // A deep kick on every beat, the big snare on 2 and 4 ringing out, open hats on the "and"s, quiet sixteenth hats.
    drums: [
      [0, 'kick', 1],
      [1, 'kick', 1],
      [2, 'kick', 1],
      [3, 'kick', 1],
      [1, 'snare', 1],
      [3, 'snare', 1],
      ...[0.5, 1.5, 2.5, 3.5].map((b) => [b, 'open', 1] as const),
      ...[0.25, 0.75, 1.25, 1.75, 2.25, 2.75, 3.25, 3.75].map((b) => [b, 'hat', 0.5] as const),
    ],
    gatedSnare: true,
    snareTail: 0.6,
    deepKick: true,
    pump: 0.6,
    hats: 8,
    bell: { level: 0 },
    mellow: 14000,
  },
  // Offline renders at gain 2: −30.1 dB, and −35.2 dB through a phone-speaker filter, against "Aloha, Moke"'s −34.1
  // (−34.7) (measured the same way, 2026-10-17): the sub is most of it, and a phone can't play it. ×1.8 splits it: the
  // bass hits harder than the other songs on headphones or in a car, and it's barely quieter on a phone. Alone at
  // gain 1, each part: sub −35.9, bass line −40.8, pads −47.5, drums −47.5, lead −49.0. Against the reference, every
  // band from 20 Hz to 11 kHz is within ~2 dB.
  gain: 1.8,
};

export const SONGS: Readonly<Record<SongId, Song>> = { hawaiian: ALOHA, japan: IRASSHAIMASE };
/** Choose Your Dog's theme. */
export const FIGHT_THEME = PAWS_UP;
/** The ride's song (Phase 6). */
export const CRUISE_THEME = { sundownRun: SUNDOWN_RUN, lastLight: LAST_LIGHT }[MUSIC.rideSong];
/** Both ride songs: the one playing and the backup (`MUSIC.rideSong` picks). */
export const RIDE_SONGS: readonly Song[] = [SUNDOWN_RUN, LAST_LIGHT];
export const TUNES: Readonly<Record<TuneId, Song>> = { ...SONGS, fight: FIGHT_THEME, cruise: CRUISE_THEME };
/** The first song ("Aloha, Moke"). */
export const SONG = ALOHA;

// ---- From the score to timed events

export type Voice = 'lead' | 'comp' | 'arp' | 'bass' | 'sub' | 'bell' | Drum;

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
    } else if (band.bass.style === 'pulse') {
      // A relentless eighth-note root, the octave on the last eighth.
      const root = chord.bass[0] + (band.bass.octave ?? 0);
      for (let e = 0; e < 8; e++) add('bass', b + e / 2, b + (e + 1) / 2, [e === 7 ? root + 12 : root], e % 2 ? 0.75 : 1);
    } else if (band.bass.style === 'roll') {
      // Rolling sixteenths: the root, with the octave on each "and".
      const root = chord.bass[0] + (band.bass.octave ?? 0);
      for (let e = 0; e < 16; e++) add('bass', b + e / 4, b + (e + 1) / 4, [e % 4 === 2 ? root + 12 : root], e % 4 === 0 ? 1 : 0.7);
    } else if (band.bass.style === 'sequence') {
      // A sequencer's sixteenths: the root, the octave on every fourth, the fifth on the last two into the next bar.
      const [root, fifth] = chord.bass;
      for (let e = 0; e < 16; e++) {
        const midi = e >= 14 ? fifth : e % 4 === 3 ? root + 12 : root;
        add('bass', b + e / 4, b + (e + 1) / 4, [midi], e % 4 === 0 ? 1 : 0.7);
      }
    } else if (band.bass.style === 'drive') {
      // Pumping eighths: root and octave, with the fifth on beat 4 (then the octave).
      const [root, fifth] = chord.bass;
      for (let e = 0; e < 8; e++) {
        const midi = e === 6 ? fifth : e % 2 ? root + 12 : root;
        add('bass', b + e / 2, b + (e + 1) / 2, [midi], e % 2 ? 0.75 : 1);
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
    if (band.sub) add('sub', b, b + 4, [chord.bass[0] - 12], 1);
    if (band.arp) {
      const { pattern, octave } = band.arp;
      for (let e = 0; e < 16; e++) {
        add('arp', b + e / 4, b + (e + 1) / 4, [chord.voicing[pattern[e % pattern.length]!]! + octave], e % 4 === 0 ? 1 : 0.7);
      }
    }
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
const DRUM_LEVEL: Readonly<Record<Drum, number>> = { shaker: 0.035, kick: 0.24, snare: 0.1, hat: 0.03, open: 0.03 };

/**
 * Plays one song through `out` on an AudioContext, a few notes ahead at a time, fading in and out. Also renders
 * offline: `renderInto(t0)` schedules a whole pass at once on any BaseAudioContext.
 */
export class MusicPlayer {
  private readonly bus: GainNode;
  private readonly leadIn: GainNode;
  /** Where every voice goes (the melody via its echo). */
  private readonly voicesOut: AudioNode;
  /** Where the chords, the sub and (when the band pumps) the bass go: ducked on every kick when the band pumps. */
  private readonly pumpedOut: GainNode;
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
    this.pumpedOut = ctx.createGain();
    this.pumpedOut.connect(mellow);
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
        return this.band.comp.pad ? this.pad(event, time, seconds) : this.comp(event, time, seconds);
      case 'sub':
        return this.sub(event, time, seconds);
      case 'arp':
        return this.arp(event, time);
      case 'bass':
        return this.bass(event, time, seconds);
      case 'bell':
        return this.bell(event, time, seconds);
      case 'shaker':
        return this.noiseHit(time, 'highpass', 6000, DRUM_LEVEL.shaker * event.velocity, 0.045);
      case 'hat':
        return this.noiseHit(time, 'highpass', 7500, DRUM_LEVEL.hat * (this.band.hats ?? 1) * event.velocity, 0.03);
      case 'open':
        return this.noiseHit(time, 'highpass', 7000, DRUM_LEVEL.open * (this.band.hats ?? 1) * event.velocity, 0.2);
      case 'snare':
        return this.band.gatedSnare
          ? this.gatedSnare(time, event.velocity)
          : this.noiseHit(time, 'bandpass', 1900, DRUM_LEVEL.snare * event.velocity, 0.13);
      case 'kick':
        this.duck(time);
        return this.band.deepKick ? this.deepKick(event, time) : this.kick(event, time);
    }
  }

  /** The melody: slides up into slide-marked notes, sings with a slow vibrato on long notes, legato. */
  private lead(event: MusicEvent, t: number, seconds: number): void {
    const ctx = this.ctx;
    const { duty, tone: cutoff, vibrato, level, synth } = this.band.lead;
    const midi = event.notes[0]!;
    // The console's one pulse, or the polysynth's two sawtooths a few cents apart.
    const oscs = synth
      ? [-synth.detune, synth.detune].map((cents) => {
          const osc = ctx.createOscillator();
          osc.type = 'sawtooth';
          osc.detune.value = cents;
          return osc;
        })
      : [ctx.createOscillator()];
    if (!synth) oscs[0]!.setPeriodicWave(this.wave(duty));
    const target = midiHz(midi);
    for (const osc of oscs) {
      if (event.slide > 0) {
        osc.frequency.setValueAtTime(midiHz(midi - event.slide), t);
        osc.frequency.exponentialRampToValueAtTime(target, t + Math.min(0.14, seconds * 0.4));
      } else {
        osc.frequency.setValueAtTime(target, t);
      }
    }
    if (seconds > 0.6 && vibrato > 0) {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 5.2;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, t);
      depth.gain.linearRampToValueAtTime(vibrato, t + 0.4); // cents: the vibrato blooms as the note holds
      lfo.connect(depth);
      for (const osc of oscs) depth.connect(osc.detune);
      lfo.start(t);
      lfo.stop(t + seconds + 0.2);
    }
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    if (synth) {
      // The filter opens on the note and settles: the 80s lead's bite.
      tone.Q.value = synth.resonance;
      tone.frequency.setValueAtTime(cutoff * 2.2, t);
      tone.frequency.exponentialRampToValueAtTime(cutoff, t + 0.25);
    } else {
      tone.frequency.value = cutoff;
    }
    const amp = ctx.createGain();
    const peak = level * event.velocity;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    amp.gain.exponentialRampToValueAtTime(peak * 0.7, t + Math.max(0.03, seconds));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + seconds + 0.12);
    tone.connect(amp).connect(this.leadIn);
    for (const osc of oscs) {
      osc.connect(tone);
      osc.start(t);
      osc.stop(t + seconds + 0.15);
    }
    oscs[0]!.onended = () => amp.disconnect();
  }

  /** Sawtooth strings: each note two detuned saws, swelling in, held for the chord, then let go. */
  private pad(event: MusicEvent, t: number, seconds: number): void {
    const ctx = this.ctx;
    const { tone: cutoff, level, pad } = this.band.comp;
    const { attack, release, detune } = pad!;
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = cutoff;
    const amp = ctx.createGain();
    const peak = level * event.velocity;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(peak, t + attack);
    amp.gain.setValueAtTime(peak, t + Math.max(attack, seconds));
    amp.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(attack, seconds) + release);
    tone.connect(amp).connect(this.pumpedOut);
    const oscs = event.notes.flatMap((midi) =>
      [-detune, detune].map((cents) => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = midiHz(midi);
        osc.detune.value = cents;
        return osc;
      }),
    );
    for (const osc of oscs) {
      osc.connect(tone);
      osc.start(t);
      osc.stop(t + Math.max(attack, seconds) + release + 0.02);
    }
    oscs[0]!.onended = () => amp.disconnect();
  }

  /** One step of the arpeggio: a short sawtooth pluck through a low-pass that snaps shut. */
  private arp(event: MusicEvent, t: number): void {
    const ctx = this.ctx;
    const { tone: cutoff, decay, level } = this.band.arp!;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = midiHz(event.notes[0]!);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.Q.value = 4;
    tone.frequency.setValueAtTime(cutoff * 2, t);
    tone.frequency.exponentialRampToValueAtTime(cutoff * 0.5, t + decay);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(level * event.velocity, t + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    osc.connect(tone).connect(amp).connect(this.voicesOut);
    osc.start(t);
    osc.stop(t + decay + 0.02);
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
      osc.connect(tone).connect(amp).connect(this.pumpedOut);
      osc.start(at);
      osc.stop(at + ring + 0.02);
      osc.onended = () => amp.disconnect();
    });
  }

  /** The bass: a console's round triangle, or a gritty sawtooth through a low-pass (`band.bass.wave`). */
  private bass(event: MusicEvent, t: number, seconds: number): void {
    const ctx = this.ctx;
    const { wave, tone: cutoff } = this.band.bass;
    const osc = ctx.createOscillator();
    osc.type = wave === 'saw' ? 'sawtooth' : 'triangle';
    osc.frequency.value = midiHz(event.notes[0]!);
    let source: AudioNode = osc;
    if (wave === 'saw') {
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      // Opens a little at the start of each note, then settles: the growl of an analogue bass.
      tone.frequency.setValueAtTime((cutoff ?? 500) * 2.2, t);
      tone.frequency.exponentialRampToValueAtTime(cutoff ?? 500, t + 0.1);
      tone.Q.value = 2;
      source = osc.connect(tone);
    }
    const amp = ctx.createGain();
    const peak = this.band.bass.level * event.velocity;
    const end = t + seconds * 0.88;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.012);
    amp.gain.setValueAtTime(peak, end - 0.05);
    amp.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(amp).connect(this.band.pump ? this.pumpedOut : this.voicesOut);
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

  /** The sub: a low-passed triangle (all fundamental, no octave above), held for the bar, ducking with the kick. */
  private sub(event: MusicEvent, t: number, seconds: number): void {
    const ctx = this.ctx;
    const { level, tone: cutoff } = this.band.sub!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = midiHz(event.notes[0]!);
    const tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = cutoff;
    const amp = ctx.createGain();
    const peak = level * event.velocity;
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    amp.gain.setValueAtTime(peak, t + seconds - 0.04);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(tone).connect(amp).connect(this.pumpedOut);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
    osc.onended = () => amp.disconnect();
  }

  /** Sidechain pumping: on a kick, the chords, the bass and the sub drop away and swell back before the next beat. */
  private duck(t: number): void {
    const depth = this.band.pump;
    if (!depth) return;
    const beat = this.sequencer.secondsPerBeat;
    const g = this.pumpedOut.gain;
    g.setValueAtTime(1, t);
    g.linearRampToValueAtTime(1 - depth, t + 0.01);
    g.linearRampToValueAtTime(1, t + beat * 0.8);
  }

  /** The big 80s snare: a drum's body under a burst of room noise, held, then cut dead by the gate. */
  private gatedSnare(t: number, velocity: number): void {
    const ctx = this.ctx;
    const peak = DRUM_LEVEL.snare * 1.6 * velocity;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const room = ctx.createBiquadFilter();
    room.type = 'bandpass';
    room.frequency.value = 1700;
    room.Q.value = 0.6;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(peak, t + 0.003);
    const tail = this.band.snareTail;
    if (tail) {
      // A room ringing out: about 10 dB down a third of the way through, cut off at the end.
      amp.gain.setTargetAtTime(0.0001, t + 0.003, tail / 3);
    } else {
      amp.gain.linearRampToValueAtTime(peak * 0.45, t + 0.2);
      amp.gain.linearRampToValueAtTime(0.0001, t + 0.23);
    }
    src.connect(room).connect(amp).connect(this.voicesOut);
    src.start(t, Math.random() * 0.2, (tail ?? 0.23) + 0.02);
    src.onended = () => amp.disconnect();
    const body = ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(210, t);
    body.frequency.exponentialRampToValueAtTime(165, t + 0.06);
    const bodyAmp = ctx.createGain();
    bodyAmp.gain.setValueAtTime(0.0001, t);
    bodyAmp.gain.exponentialRampToValueAtTime(peak * 1.3, t + 0.002);
    bodyAmp.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    body.connect(bodyAmp).connect(this.voicesOut);
    body.start(t);
    body.stop(t + 0.15);
    body.onended = () => bodyAmp.disconnect();
  }

  /** A drum machine's kick: a sine falling from a click to a deep, long boom. */
  private deepKick(event: MusicEvent, t: number): void {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, t);
    osc.frequency.exponentialRampToValueAtTime(46, t + 0.07);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.exponentialRampToValueAtTime(DRUM_LEVEL.kick * 1.4 * event.velocity, t + 0.002);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    osc.connect(amp).connect(this.voicesOut);
    osc.start(t);
    osc.stop(t + 0.44);
    osc.onended = () => amp.disconnect();
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
