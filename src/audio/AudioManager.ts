import { AUDIO, MUSIC } from '../config/audio';
import { MusicPlayer, TUNES, type SongId, type TuneId } from './music';
import { announce, bark, begin, chirp, crunch, dogSwitch, squeak, discovery, doorbell, drop, fireworks, growl, lap, pickup, pour, sniff, surprise, treatBag, whoosh, type Synth } from './synth';

export type SoundName = 'bark' | 'growl' | 'sniff' | 'pickup' | 'drop' | 'surprise' | 'whoosh' | 'treatBag' | 'crunch' | 'lap' | 'pour' | 'discovery' | 'doorbell' | 'chirp' | 'squeak' | 'fireworks' | 'announce' | 'dogSwitch' | 'begin';

/** Sounds longer than a second, and how long to keep them connected (ms). */
const LASTS: Partial<Record<SoundName, number>> = { fireworks: 3600, announce: 1800 };

const SOUNDS: Record<SoundName, Synth> = { bark, growl, sniff, pickup, drop, surprise, whoosh, treatBag, crunch, lap, pour, discovery, doorbell, chirp, squeak, fireworks, announce, dogSwitch, begin };

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
  /** One player per tune, made the first time it's wanted (null: this browser can't make it). */
  private readonly players = new Map<TuneId, MusicPlayer | null>();
  /** The player's Music settings (pause screen). */
  private musicChoice: SongId | 'off' = 'hawaiian';
  private musicVolume = 1;
  /** Play has begun (PLAY was pressed), so the music may run. */
  private musicStarted = false;
  private musicDucked = false;
  /** Choose Your Dog is up: its own theme plays instead of the background song. */
  private selectTheme = false;
  private rideTheme = false;
  /** The announcer is talking: the music dips under the voice. */
  private voiceDucked = false;

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
    // Let the graph be collected once the sound is over (most are under a second).
    window.setTimeout(() => level.disconnect(), LASTS[name] ?? 1000);
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

  /** The tune playing now, if any. */
  get musicPlaying(): TuneId | null {
    for (const [id, player] of this.players) if (player?.isPlaying && id === this.wantedTune()) return id;
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

  /**
   * Choose Your Dog's fight theme ("Paws Up!") while the screen is up (call after unlock(), from PLAY), off again at
   * BEGIN or BACK. It follows the Music settings: with the music off, the screen is quiet too.
   */
  selectMusic(on: boolean): void {
    this.selectTheme = on;
    this.updateMusic();
  }

  /** The ride's song ("Neon Coastline", Phase 6) while out in the car; like the others it follows the Music settings. */
  rideMusic(on: boolean): void {
    this.rideTheme = on;
    this.updateMusic();
  }

  /** The music dips while the announcer speaks (see MUSIC.voiceDuck). */
  duckForVoice(speaking: boolean): void {
    if (speaking === this.voiceDucked) return;
    this.voiceDucked = speaking;
    this.updateMusic();
  }

  private wantedTune(): TuneId | null {
    if (this.musicChoice === 'off' || this.musicVolume <= 0.001) return null;
    if (this.selectTheme) return 'fight';
    if (this.rideTheme) return 'cruise';
    return this.musicStarted ? this.musicChoice : null;
  }

  private updateMusic(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const wanted = this.wantedTune();
    for (const [id, player] of this.players) if (id !== wanted) player?.stop();
    if (!wanted) return;
    if (!this.players.has(wanted)) this.players.set(wanted, createMusic(ctx, master, wanted));
    const level = this.musicVolume * (this.musicDucked ? MUSIC.pausedLevel : 1) * (this.voiceDucked ? MUSIC.voiceDuck : 1);
    this.players.get(wanted)?.play(level);
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
function createMusic(ctx: AudioContext, out: AudioNode, tune: TuneId): MusicPlayer | null {
  try {
    return new MusicPlayer(ctx, out, TUNES[tune]);
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
