import { MOUSE } from '../config/input';
import { clamp } from '../utils/math';

/** Player-adjustable settings, remembered in this browser only. */
export interface PlayerSettings {
  /** Multiplier on the base mouse sensitivity. */
  mouseSensitivity: number;
  invertY: boolean;
  /** Which background music plays, or none. */
  music: MusicChoice;
  /** Music loudness: 1 is the level it was mixed at. */
  musicVolume: number;
}

/** The pause screen's Music choices (the songs are in audio/music.ts). */
export const MUSIC_CHOICES = ['hawaiian', 'japan', 'off'] as const;
export type MusicChoice = (typeof MUSIC_CHOICES)[number];

export const DEFAULT_SETTINGS: Readonly<PlayerSettings> = { mouseSensitivity: 1, invertY: false, music: 'hawaiian', musicVolume: 1 };
export const SENSITIVITY_RANGE = { min: 0.25, max: 3, step: 0.05 } as const;
export const MUSIC_VOLUME_RANGE = { min: 0, max: 1.5, step: 0.05 } as const;

const STORAGE_KEY = 'imdog.settings.v1';

type KeyValueStore = Pick<Storage, 'getItem' | 'setItem'>;

/** Tolerates missing, corrupt or out-of-range data by falling back to defaults. */
export function parseSettings(raw: string | null): PlayerSettings {
  const settings = { ...DEFAULT_SETTINGS };
  if (!raw) return settings;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof PlayerSettings, unknown>>;
    if (typeof value.mouseSensitivity === 'number' && Number.isFinite(value.mouseSensitivity)) {
      settings.mouseSensitivity = clamp(value.mouseSensitivity, SENSITIVITY_RANGE.min, SENSITIVITY_RANGE.max);
    }
    if (typeof value.invertY === 'boolean') settings.invertY = value.invertY;
    // Before the choice of songs, Music was a plain on/off.
    if (typeof value.music === 'boolean') settings.music = value.music ? 'hawaiian' : 'off';
    else if ((MUSIC_CHOICES as readonly unknown[]).includes(value.music)) settings.music = value.music as MusicChoice;
    if (typeof value.musicVolume === 'number' && Number.isFinite(value.musicVolume)) {
      settings.musicVolume = clamp(value.musicVolume, MUSIC_VOLUME_RANGE.min, MUSIC_VOLUME_RANGE.max);
    }
  } catch {
    // Corrupt JSON: keep defaults.
  }
  return settings;
}

/** localStorage can throw or be absent (private windows, blocked storage, tests). */
function browserStorage(): KeyValueStore | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function loadSettings(storage: KeyValueStore | null = browserStorage()): PlayerSettings {
  try {
    return parseSettings(storage?.getItem(STORAGE_KEY) ?? null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: PlayerSettings, storage: KeyValueStore | null = browserStorage()): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage full or blocked: the setting still applies for this session.
  }
}

export function applySettings(settings: PlayerSettings): void {
  MOUSE.sensitivityScale = settings.mouseSensitivity;
  MOUSE.invertY = settings.invertY;
}
