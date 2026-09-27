import { describe, expect, it } from 'vitest';
import { AUDIO } from '../config/audio';
import { doorbell } from './synth';

describe('Doorbell chime', () => {
  it('schedules a louder descending DING-DONG with harmonics, ending before audio cleanup and the next ring', () => {
    const voices: { frequency: { value: number }; startAt: number; stopAt: number }[] = [];
    const ctx = {
      createOscillator: () => {
        const voice = { frequency: { value: 0 }, startAt: 0, stopAt: 0,
          start(at: number) { this.startAt = at; }, stop(at: number) { this.stopAt = at; },
          connect(destination: unknown) { return destination; } };
        voices.push(voice);
        return voice;
      },
      createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(destination: unknown) { return destination; } }),
    } as unknown as AudioContext;
    doorbell(ctx, {} as AudioNode, 5, 1, {} as AudioBuffer);
    expect(voices).toHaveLength(4);
    expect(voices.filter((_, i) => i % 2 === 0).map((v) => v.frequency.value)).toEqual([659.25, 523.25]);
    expect(voices.map((v) => v.startAt)).toEqual([5, 5, 5.38, 5.38]);
    expect(AUDIO.doorbell * AUDIO.doorbellChime.layers[0][1]).toBeGreaterThan(0.4 * 0.4);
    for (const voice of voices) {
      expect(voice.stopAt).toBeGreaterThan(voice.startAt);
      expect(voice.stopAt).toBeLessThan(6);
    }
  });
});
