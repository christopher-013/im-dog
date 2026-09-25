import { AUDIO, MUSIC } from '../config/audio';
import { MusicPlayer, SONGS, type SongId } from './music';
import { bark, crunch, discovery, drop, growl, pickup, sniff, surprise, treatBag, whoosh, type Synth } from './synth';

export type SoundName = 'bark' | 'growl' | 'sniff' | 'pickup' | 'drop' | 'surprise' | 'whoosh' | 'treatBag' | 'crunch' | 'discovery';

const SOUNDS: Record<SoundName, Synth> = { bark, growl, sniff, pickup, drop, surprise, whoosh, treatBag, crunch, discovery };

/** Safari's Audio Session API (feature-detected; not in the TypeScript DOM types yet). */
type AudioSessionNavigator = Navigator & { audioSession?: { type: string } };

/**
 * Game audio. Browsers only allow sound after a user gesture, so the AudioContext is created (or
 * resumed) by `unlock()` from the PLAY / RESUME clicks, and woken again by `wake()` on any later tap or key
 * (phones put it to sleep: a call, the lock screen, switching apps). Before that, and where Web Audio is
 * unavailable, `play()` quietly does nothing: audio is never allowed to break the game.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private failed = false;
  /** A resume() in flight, so sounds asked for meanwhile can wait for it instead of being lost. */
  private waking: Promise<void> | null = null;
  /** One player per song, made the first time it's chosen (null: this browser can't make it). */
  private readonly players = new Map<SongId, MusicPlayer | null>();
  /** The player's Music settings (pause screen). */
  private musicChoice: SongId | 'off' = 'hawaiian';
  private musicVolume = 1;
  /** Play has begun (PLAY was pressed), so the music may run. */
  private musicStarted = false;
  private musicDucked = false;

  get status(): string {
    if (this.failed) return 'unavailable';
    return this.ctx ? this.ctx.state : 'locked (waiting for PLAY)';
  }

  /** Call from a click handler (PLAY, RESUME): creates the audio if needed and wakes it. */
  unlock(): void {
    if (this.failed) return;
    try {
      if (!this.ctx) {
        preferAudibleSession();
        const ctx = new AudioContext();
        this.master = ctx.createGain();
        this.master.gain.value = AUDIO.master;
        this.master.connect(ctx.destination);
        this.noise = whiteNoise(ctx, 1);
        this.ctx = ctx;
        this.updateMusic();
      }
      this.wake();
    } catch (err) {
      this.failed = true;
      console.warn('Audio is unavailable:', err);
    }
  }

  /**
   * Call from any user gesture (tap, click, key). Resumes audio the browser has stopped: "suspended" (hidden page,
   * autoplay rules) or iOS Safari's "interrupted" (a call, Siri, the lock screen). Only a gesture may do that.
   */
  wake(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed' || this.waking) return;
    this.waking = ctx
      .resume()
      .catch(() => {})
      .finally(() => {
        this.waking = null;
      });
  }

  /**
   * Silence everything while the page is hidden (phone locked, app switched). The next tap or key wakes it again
   * (see wake()).
   */
  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  play(name: SoundName): void {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise) return;
    if (ctx.state !== 'running') {
      // Just woken by this very tap (the bark button, say): play it as soon as the audio is back.
      if (this.waking) void this.waking.then(() => ctx.state === 'running' && this.play(name));
      return;
    }
    const level = ctx.createGain();
    level.gain.value = AUDIO[name];
    level.connect(master);
    const pitch = 1 + (Math.random() * 2 - 1) * AUDIO.pitchVariation;
    SOUNDS[name](ctx, level, ctx.currentTime + 0.005, pitch, noise);
    // Let the graph be collected once the sound is over.
    window.setTimeout(() => level.disconnect(), 1000);
  }

  /**
   * The Music settings: which song (or none) and how loud (1 = as mixed). Changing song crossfades; turning it off
   * or the volume to 0 fades it out. Nothing plays until play has begun (startMusic()).
   */
  setMusic(choice: SongId | 'off', volume: number): void {
    this.musicChoice = choice;
    this.musicVolume = volume;
    this.updateMusic();
  }

  /** The song playing now, if any. */
  get musicPlaying(): SongId | null {
    for (const [id, player] of this.players) if (player?.isPlaying && id === this.wantedSong()) return id;
    return null;
  }

  /** Background music from now on (call when play begins, after unlock()). */
  startMusic(): void {
    this.musicStarted = true;
    this.updateMusic();
  }

  /** Quieter on the pause screen, full during play. */
  duckMusic(ducked: boolean): void {
    this.musicDucked = ducked;
    this.updateMusic();
  }

  private wantedSong(): SongId | null {
    return this.musicStarted && this.musicChoice !== 'off' && this.musicVolume > 0.001 ? this.musicChoice : null;
  }

  private updateMusic(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const wanted = this.wantedSong();
    for (const [id, player] of this.players) if (id !== wanted) player?.stop();
    if (!wanted) return;
    if (!this.players.has(wanted)) this.players.set(wanted, createMusic(ctx, master, wanted));
    this.players.get(wanted)?.play(this.musicVolume * (this.musicDucked ? MUSIC.pausedLevel : 1));
  }

  dispose(): void {
    for (const player of this.players.values()) player?.stop();
    void this.ctx?.close();
    this.ctx = null;
  }
}

/**
 * iPhones mute web audio with the ringer (silent) switch unless the page asks for "playback", as video does.
 * Set before the audio starts; ignored where the browser has no Audio Session API. See AUDIO.iosSession.
 */
function preferAudibleSession(): void {
  const session = (navigator as AudioSessionNavigator).audioSession;
  if (!session) return;
  try {
    session.type = AUDIO.iosSession;
  } catch {
    // An unknown type: leave the browser's default.
  }
}

/** The background music, if this browser can make it: a problem there must never cost the sound effects. */
function createMusic(ctx: AudioContext, out: AudioNode, song: SongId): MusicPlayer | null {
  try {
    return new MusicPlayer(ctx, out, SONGS[song]);
  } catch (err) {
    console.warn('Music is unavailable:', err);
    return null;
  }
}

function whiteNoise(ctx: AudioContext, seconds: number): AudioBuffer {
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}
