import { describe, expect, it } from 'vitest';
import { CHORDS, FIGHT_THEME, MusicSequencer, SONG, SONGS, TUNES, songEvents, type Note, type Scheduled, type Song } from './music';

/** Checks a line of notes fills the song exactly, with no note tied over a bar line. */
function fillsBars(song: Song, notes: readonly Note[]): void {
  let at = 0;
  for (const [, beats] of notes) {
    const bar = Math.floor(at / 4 + 1e-9);
    at += beats;
    expect(at, `${song.title}: a note crosses the bar line after bar ${bar + 1}`).toBeLessThanOrEqual((bar + 1) * 4 + 1e-9);
  }
  expect(at).toBe(song.bars.length * 4);
}

/** The background songs are 24 bars; Choose Your Dog's short fight theme, 16. */
const BARS: Readonly<Record<keyof typeof TUNES, number>> = { hawaiian: 24, japan: 24, fight: 16 };

describe('the background music', () => {
  it('the Music setting offers the background songs only (the fight theme belongs to Choose Your Dog)', () => {
    expect(Object.keys(SONGS)).toEqual(['hawaiian', 'japan']);
    expect(Object.keys(TUNES)).toEqual(['hawaiian', 'japan', 'fight']);
  });

  for (const [id, song] of Object.entries(TUNES) as [keyof typeof TUNES, Song][]) {
    describe(`"${song.title}"`, () => {
      it(`is ${BARS[id]} bars, and every line fills every bar exactly, with no note tied over a bar line`, () => {
        expect(song.id).toBe(id);
        expect(song.bars).toHaveLength(BARS[id]);
        fillsBars(song, song.melody);
        if (song.bells) fillsBars(song, song.bells);
      });

      it('fits its chords: every melody note on beat 1 or 3 is a chord tone, or the sweet 6th or 9th', () => {
        let at = 0;
        for (const [midi, beats] of song.melody) {
          const beat = at % 4;
          if (midi !== null && (beat === 0 || beat === 2)) {
            const chord = CHORDS[song.bars[Math.floor(at / 4)]!];
            const root = chord.tones[0]!;
            const allowed = new Set([...chord.tones, (root + 2) % 12, (root + 9) % 12]);
            expect(allowed.has(midi % 12), `note ${midi} on beat ${beat + 1} of bar ${Math.floor(at / 4) + 1}`).toBe(true);
          }
          at += beats;
        }
      });

      it('turns the score into a sorted loop of notes, all inside the song', () => {
        const events = songEvents(song);
        for (let i = 1; i < events.length; i++) expect(events[i]!.beat).toBeGreaterThanOrEqual(events[i - 1]!.beat);
        for (const e of events) {
          expect(e.beat).toBeGreaterThanOrEqual(0);
          expect(e.beat).toBeLessThan(song.bars.length * 4);
          expect(e.beats).toBeGreaterThan(0);
        }
      });
    });
  }

  it('"Aloha, Moke": the six-strum island rhythm and a shaker in every bar, gently swung', () => {
    const events = songEvents(SONGS.hawaiian);
    const count = (voice: string) => events.filter((e) => e.voice === voice).length;
    expect(count('comp')).toBe(24 * 6);
    expect(count('shaker')).toBe(24 * 8);
    expect(count('bass')).toBeGreaterThanOrEqual(24 * 2);
    // Swing: an off-beat eighth lands late (0.6 of the beat), not halfway.
    expect(events.some((e) => e.voice === 'comp' && Math.abs((e.beat % 1) - SONGS.hawaiian.swing) < 1e-9)).toBe(true);
    expect(events.some((e) => Math.abs((e.beat % 1) - 0.5) < 1e-9)).toBe(false);
  });

  it('"Irasshaimase!": opens every loop with the door chime, and rings the school chime midway, over a quiet band', () => {
    const song = SONGS.japan;
    const events = songEvents(song);
    const bells = events.filter((e) => e.voice === 'bell');
    // The door chime: "ding-dong", then a welcoming rise, on the first two bars.
    expect(bells.slice(0, 6).map((e) => e.notes[0])).toEqual([81, 77, 72, 77, 81, 84]);
    expect(bells[0]!.beat).toBe(0);
    // The Westminster Quarters (public domain), as Japanese schools ring them.
    expect(bells.slice(6).map((e) => e.notes[0])).toEqual([81, 77, 79, 72, 72, 79, 81, 77]);
    // The chime bars have only the bells, a held bass note, and no melody, chords or drums.
    for (const bar of song.sparse!) {
      const inBar = events.filter((e) => e.beat >= bar * 4 && e.beat < bar * 4 + 4);
      expect(new Set(inBar.map((e) => e.voice))).toEqual(new Set(['bell', 'bass']));
    }
    // Everywhere else: a drum machine (kick, snare, hats) and off-beat chord stabs.
    const bar = 4 * 4;
    const inBar = events.filter((e) => e.beat >= bar && e.beat < bar + 4);
    for (const voice of ['kick', 'snare', 'hat', 'comp', 'bass', 'lead']) expect(inBar.some((e) => e.voice === voice)).toBe(true);
  });

  it('"Paws Up!" (Choose Your Dog): a fast minor-key fight theme, pumping bass, power stabs on 3-3-2, four on the floor', () => {
    const song = FIGHT_THEME;
    expect(song.bpm).toBeGreaterThanOrEqual(140);
    expect(song.bars[0]).toBe('Em');
    expect(song.swing).toBe(0.5); // straight, driving eighths
    const events = songEvents(song);
    for (let bar = 0; bar < song.bars.length; bar++) {
      const inBar = (voice: string) =>
        events.filter((e) => e.voice === voice && e.beat >= bar * 4 && e.beat < bar * 4 + 4).map((e) => e.beat - bar * 4);
      // Eighth notes in the bass, root and octave.
      const bass = events.filter((e) => e.voice === 'bass' && e.beat >= bar * 4 && e.beat < bar * 4 + 4);
      expect(bass.map((e) => e.beat - bar * 4)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
      const root = CHORDS[song.bars[bar]!].bass[0];
      expect(bass[0]!.notes[0]).toBe(root);
      expect(bass[1]!.notes[0]).toBe(root + 12);
      expect(inBar('comp')).toEqual([0, 1.5, 3]);
      expect(inBar('kick')).toEqual([0, 1, 2, 3]);
      expect(inBar('snare')).toEqual([1, 3]);
      expect(inBar('hat')).toHaveLength(8);
    }
    // Trimmed up to sit level with the other tunes (see its gain note).
    expect(song.gain).toBeGreaterThan(1);
  });

  it('hands out every note exactly once per loop, a little ahead of time, and loops without a seam', () => {
    const events = songEvents();
    const seq = new MusicSequencer(events, SONG.bpm, SONG.bars.length * 4);
    seq.start(1);
    const got: Scheduled[] = [];
    const due: Scheduled[] = [];
    for (let now = 0; now < 1 + seq.loopSeconds * 2 + 5; now += 0.1) {
      seq.take(now, now + 0.35, due);
      for (const d of due) {
        expect(d.time).toBeGreaterThanOrEqual(now - 0.05);
        expect(d.time).toBeLessThan(now + 0.35);
      }
      got.push(...due);
    }
    const firstLoop = got.filter((d) => d.time < 1 + seq.loopSeconds);
    expect(firstLoop).toHaveLength(events.length);
    const secondLoop = got.slice(events.length, events.length * 2);
    secondLoop.forEach((d, i) => expect(d.time).toBeCloseTo(firstLoop[i]!.time + seq.loopSeconds, 6));
  });

  it("doesn't blurt out a pile of late notes after a stall: it picks up where the song should be", () => {
    const seq = new MusicSequencer(songEvents(), SONG.bpm, SONG.bars.length * 4);
    seq.start(0);
    const due: Scheduled[] = [];
    seq.take(0, 0.35, due);
    seq.take(20, 20.35, due); // the page froze for 20 s while the audio kept going
    expect(due.length).toBeLessThan(15);
    for (const d of due) expect(d.time).toBeGreaterThanOrEqual(20 - 0.05);
    seq.take(500, 500.35, due); // or for several whole loops
    expect(due.length).toBeLessThan(15);
    for (const d of due) expect(d.time).toBeGreaterThanOrEqual(500 - 0.05);
  });
});
