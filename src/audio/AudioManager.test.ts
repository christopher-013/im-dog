import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AUDIO } from '../config/audio';
import { AudioManager } from './AudioManager';

/** Just enough Web Audio for AudioManager: counts the sounds it starts, and lets a test set the context's state. */
class FakeContext {
  static last: FakeContext | null = null;
  state: string = 'running';
  sampleRate = 48000;
  currentTime = 0;
  destination = {};
  resumes = 0;
  started = 0;
  constructor() {
    FakeContext.last = this;
  }
  /** Like a browser: the state only changes a moment later. */
  resume(): Promise<void> {
    this.resumes++;
    return Promise.resolve().then(() => {
      this.state = 'running';
    });
  }
  suspend(): Promise<void> {
    this.state = 'suspended';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
  createBuffer(_channels: number, length: number) {
    return { duration: length / this.sampleRate, getChannelData: () => new Float32Array(length) };
  }
  private node() {
    const param = () => ({
      value: 0,
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
      cancelScheduledValues() {},
    });
    const node = {
      gain: param(),
      frequency: param(),
      detune: param(),
      delayTime: param(),
      Q: param(),
      type: '',
      curve: null,
      buffer: null,
      onended: null,
      connect: (target: unknown) => target,
      disconnect() {},
      setPeriodicWave() {},
      start: () => this.started++,
      stop() {},
    };
    return node;
  }
  createGain = () => this.node();
  createOscillator = () => this.node();
  createBiquadFilter = () => this.node();
  createWaveShaper = () => this.node();
  createBufferSource = () => this.node();
  createDelay = () => this.node();
  createPeriodicWave = () => ({});
}

const globals = globalThis as unknown as Record<string, unknown>;

describe('AudioManager (phones)', () => {
  let session: { type: string };

  beforeEach(() => {
    session = { type: 'auto' };
    globals.AudioContext = FakeContext;
    globals.window = { setTimeout: () => 0 };
    Object.defineProperty(globalThis, 'navigator', { value: { audioSession: session }, configurable: true });
  });

  afterEach(() => {
    delete globals.AudioContext;
    delete globals.window;
  });

  it('asks iPhones to play through the silent switch, before the audio starts', () => {
    new AudioManager().unlock();
    expect(session.type).toBe(AUDIO.iosSession);
    expect(session.type).toBe('playback');
  });

  it("wakes audio that iOS 'interrupted' (a call, the lock screen), not only 'suspended' audio", async () => {
    const audio = new AudioManager();
    audio.unlock();
    const ctx = FakeContext.last!;
    ctx.state = 'interrupted';
    audio.play('bark');
    expect(ctx.started).toBe(0); // asleep: nothing plays
    audio.wake();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ctx.resumes).toBe(1);
    expect(ctx.state).toBe('running');
  });

  it("plays a sound asked for just after a wake, instead of dropping it", async () => {
    const audio = new AudioManager();
    audio.unlock();
    const ctx = FakeContext.last!;
    ctx.state = 'suspended';
    audio.wake(); // the tap on the bark button...
    audio.play('bark'); // ...and the bark it asked for, while the audio is still waking
    expect(ctx.started).toBe(0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ctx.started).toBeGreaterThan(0);
  });

  it('plays the music only once play has begun, and follows the Music settings: song, off, volume', () => {
    vi.useFakeTimers();
    try {
      const audio = new AudioManager();
      audio.unlock();
      expect(audio.musicPlaying).toBe(null); // the menu: not yet
      audio.startMusic();
      expect(audio.musicPlaying).toBe('hawaiian');
      expect(FakeContext.last!.started).toBeGreaterThan(0); // the first notes are scheduled
      audio.setMusic('japan', 1); // crossfades to the other song
      expect(audio.musicPlaying).toBe('japan');
      audio.setMusic('off', 1);
      vi.advanceTimersByTime(3000); // fades out, then stops
      expect(audio.musicPlaying).toBe(null);
      audio.setMusic('hawaiian', 0); // volume 0 is as good as off
      expect(audio.musicPlaying).toBe(null);
      audio.setMusic('hawaiian', 0.5);
      expect(audio.musicPlaying).toBe('hawaiian');
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the music off from the start when the player turned it off', () => {
    const audio = new AudioManager();
    audio.setMusic('off', 1);
    audio.unlock();
    audio.startMusic();
    expect(audio.musicPlaying).toBe(null);
  });

  it('never throws when a phone has no Web Audio, and leaves a running context alone', () => {
    delete globals.AudioContext;
    const none = new AudioManager();
    expect(() => {
      none.unlock();
      none.wake();
      none.play('growl');
    }).not.toThrow();
    expect(none.status).toBe('unavailable');

    globals.AudioContext = FakeContext;
    const audio = new AudioManager();
    audio.unlock();
    audio.wake();
    expect(FakeContext.last!.resumes).toBe(0);
  });
});
