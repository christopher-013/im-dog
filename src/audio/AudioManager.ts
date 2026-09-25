import { AUDIO } from '../config/audio';
import { bark, crunch, discovery, drop, growl, pickup, sniff, surprise, treatBag, whoosh, type Synth } from './synth';

export type SoundName = 'bark' | 'growl' | 'sniff' | 'pickup' | 'drop' | 'surprise' | 'whoosh' | 'treatBag' | 'crunch' | 'discovery';

const SOUNDS: Record<SoundName, Synth> = { bark, growl, sniff, pickup, drop, surprise, whoosh, treatBag, crunch, discovery };

/**
 * Game audio. Browsers only allow sound after a user gesture, so the AudioContext is created (or
 * resumed) by `unlock()` from the PLAY / RESUME clicks. Before that, and where Web Audio is
 * unavailable, `play()` quietly does nothing: audio is never allowed to break the game.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private failed = false;

  get status(): string {
    if (this.failed) return 'unavailable';
    return this.ctx ? this.ctx.state : 'locked (waiting for PLAY)';
  }

  /** Call from a click handler. */
  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.ctx) {
        const ctx = new AudioContext();
        this.master = ctx.createGain();
        this.master.gain.value = AUDIO.master;
        this.master.connect(ctx.destination);
        this.noise = whiteNoise(ctx, 1);
        this.ctx = ctx;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch (err) {
      this.failed = true;
      console.warn('Audio is unavailable:', err);
    }
  }

  /**
   * Silence everything while the page is hidden (phone locked, app switched). The next PLAY/RESUME tap
   * calls unlock(), which resumes it; iOS may also have "interrupted" it, which resume() handles too.
   */
  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  play(name: SoundName): void {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise || ctx.state !== 'running') return;
    const level = ctx.createGain();
    level.gain.value = AUDIO[name];
    level.connect(master);
    const pitch = 1 + (Math.random() * 2 - 1) * AUDIO.pitchVariation;
    SOUNDS[name](ctx, level, ctx.currentTime + 0.005, pitch, noise);
    // Let the graph be collected once the sound is over.
    window.setTimeout(() => level.disconnect(), 1000);
  }

  dispose(): void {
    void this.ctx?.close();
    this.ctx = null;
  }
}

function whiteNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
