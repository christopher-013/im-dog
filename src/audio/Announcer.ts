import { ANNOUNCER } from '../config/dogSelect';

/** The bits of the Web Speech API the announcer uses (so tests can stand in for it). */
export interface SpeechLike {
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  getVoices(): SpeechSynthesisVoice[];
}

type UtteranceFactory = (text: string) => SpeechSynthesisUtterance;

/**
 * The Choose Your Dog announcer (2026-10-16): "Choose your dog!", each dog's name as it's picked ("Moke!",
 * "Dougie!") and "Begin!", in a deep, slow, theatrical delivery. It's the browser's own text-to-speech voice (Web
 * Speech API), pitched down and slowed: an original presentation, not anyone's recorded or imitated voice. How it
 * sounds depends on the device's voices; some browsers have none, or block speech, in which case it simply says
 * nothing (the words are always on screen too). It only ever speaks after the PLAY press (a user gesture).
 */
export class Announcer {
  /** Told when it starts and stops talking, so the music can dip under the voice. */
  onSpeaking: ((speaking: boolean) => void) | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  /** The line being said (events from lines it cut off are ignored). */
  private current: SpeechSynthesisUtterance | null = null;
  private speakingNow = false;
  private quietTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly speech: SpeechLike | null = browserSpeech(),
    private readonly utterance: UtteranceFactory | null = browserUtterance(),
  ) {}

  /** Can it speak at all here? */
  get available(): boolean {
    return this.speech !== null && this.utterance !== null;
  }

  /** Says `text` (cutting off anything it was still saying). Returns false when it can't speak. */
  say(text: string): boolean {
    const speech = this.speech;
    if (!speech || !this.utterance) return false;
    try {
      speech.cancel();
      const line = this.utterance(text);
      line.pitch = ANNOUNCER.pitch;
      line.rate = ANNOUNCER.rate;
      line.volume = ANNOUNCER.volume;
      const voice = this.pickVoice();
      if (voice) {
        line.voice = voice;
        line.lang = voice.lang;
      } else {
        line.lang = ANNOUNCER.lang;
      }
      this.current = line;
      line.onstart = () => {
        if (this.current === line) this.setSpeaking(true);
      };
      line.onend = () => {
        if (this.current === line) this.setSpeaking(false);
      };
      line.onerror = () => {
        if (this.current === line) this.setSpeaking(false);
      };
      speech.speak(line);
      return true;
    } catch {
      return false;
    }
  }

  stop(): void {
    this.current = null;
    this.setSpeaking(false);
    try {
      this.speech?.cancel();
    } catch {
      // Nothing to stop.
    }
  }

  /** Some browsers never say a line has ended: after ANNOUNCER.longestLine it counts as over anyway. */
  private setSpeaking(speaking: boolean): void {
    if (this.quietTimer) clearTimeout(this.quietTimer);
    this.quietTimer = speaking ? setTimeout(() => this.setSpeaking(false), ANNOUNCER.longestLine * 1000) : null;
    if (speaking === this.speakingNow) return;
    this.speakingNow = speaking;
    this.onSpeaking?.(speaking);
  }

  /** An English voice, preferring ones known to be low (see ANNOUNCER.preferredVoices); null for the default. */
  private pickVoice(): SpeechSynthesisVoice | null {
    if (this.voice) return this.voice;
    const voices = this.speech?.getVoices() ?? [];
    this.voice = pickAnnouncerVoice(voices);
    return this.voice;
  }
}

export function pickAnnouncerVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  for (const hint of ANNOUNCER.preferredVoices) {
    const found = english.find((v) => v.name.toLowerCase().includes(hint));
    if (found) return found;
  }
  return english.find((v) => v.default) ?? english[0] ?? null;
}

function browserSpeech(): SpeechLike | null {
  try {
    return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  } catch {
    return null;
  }
}

function browserUtterance(): UtteranceFactory | null {
  return typeof SpeechSynthesisUtterance === 'function' ? (text) => new SpeechSynthesisUtterance(text) : null;
}
