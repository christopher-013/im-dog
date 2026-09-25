import { describe, expect, it } from 'vitest';
import { CHORDS, MusicSequencer, SONG, songEvents, type Scheduled } from './music';

const LOOP_BEATS = SONG.bars.length * 4;

describe('"Aloha, Moke" (the background music)', () => {
  it('is a 24-bar tune whose melody fills every bar exactly, with no note tied over a bar line', () => {
    expect(SONG.bars).toHaveLength(24);
    let at = 0;
    for (const [, beats] of SONG.melody) {
      const bar = Math.floor(at / 4 + 1e-9);
      at += beats;
      expect(at, `a note crosses the bar line after bar ${bar + 1}`).toBeLessThanOrEqual((bar + 1) * 4 + 1e-9);
    }
    expect(at).toBe(LOOP_BEATS);
  });

  it('fits its chords: every melody note on beat 1 or 3 is a chord tone, or the sweet 6th or 9th', () => {
    let at = 0;
    for (const [midi, beats] of SONG.melody) {
      const beat = at % 4;
      if (midi !== null && (beat === 0 || beat === 2)) {
        const chord = CHORDS[SONG.bars[Math.floor(at / 4)]!];
        const root = chord.tones[0]!;
        const allowed = new Set([...chord.tones, (root + 2) % 12, (root + 9) % 12]);
        expect(allowed.has(midi % 12), `note ${midi} on beat ${beat + 1} of bar ${Math.floor(at / 4) + 1}`).toBe(true);
      }
      at += beats;
    }
  });

  it('turns the score into a sorted loop: melody, bass, a six-strum island rhythm and shaker in every bar', () => {
    const events = songEvents();
    for (let i = 1; i < events.length; i++) expect(events[i]!.beat).toBeGreaterThanOrEqual(events[i - 1]!.beat);
    for (const e of events) {
      expect(e.beat).toBeGreaterThanOrEqual(0);
      expect(e.beat).toBeLessThan(LOOP_BEATS);
      expect(e.beats).toBeGreaterThan(0);
    }
    const count = (voice: string) => events.filter((e) => e.voice === voice).length;
    expect(count('uke')).toBe(24 * 6);
    expect(count('shaker')).toBe(24 * 8);
    expect(count('bass')).toBeGreaterThanOrEqual(24 * 2);
    // Swing: an off-beat eighth lands late (0.6 of the beat), not halfway.
    expect(events.some((e) => e.voice === 'uke' && Math.abs((e.beat % 1) - SONG.swing) < 1e-9)).toBe(true);
    expect(events.some((e) => Math.abs((e.beat % 1) - 0.5) < 1e-9)).toBe(false);
  });

  it('hands out every note exactly once per loop, a little ahead of time, and loops without a seam', () => {
    const events = songEvents();
    const seq = new MusicSequencer(events, SONG.bpm, LOOP_BEATS);
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
    const seq = new MusicSequencer(songEvents(), SONG.bpm, LOOP_BEATS);
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
