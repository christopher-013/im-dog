import { afterEach, describe, expect, it } from 'vitest';
import { MOUSE } from '../config/input';
import { applySettings, DEFAULT_SETTINGS, loadSettings, parseSettings, saveSettings, SENSITIVITY_RANGE } from './PlayerSettings';

function memoryStore() {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

afterEach(() => applySettings(DEFAULT_SETTINGS));

describe('PlayerSettings', () => {
  it('round-trips through storage', () => {
    const store = memoryStore();
    saveSettings({ mouseSensitivity: 1.5, invertY: true }, store);
    expect(loadSettings(store)).toEqual({ mouseSensitivity: 1.5, invertY: true });
  });

  it('falls back to defaults for missing or corrupt data', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{not json')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('{"mouseSensitivity":"fast","invertY":"yes"}')).toEqual(DEFAULT_SETTINGS);
  });

  it('clamps out-of-range sensitivity', () => {
    expect(parseSettings('{"mouseSensitivity":99}').mouseSensitivity).toBe(SENSITIVITY_RANGE.max);
    expect(parseSettings('{"mouseSensitivity":0}').mouseSensitivity).toBe(SENSITIVITY_RANGE.min);
  });

  it('survives storage that throws or is unavailable', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, broken)).not.toThrow();
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('applies to the live mouse config', () => {
    applySettings({ mouseSensitivity: 2, invertY: true });
    expect(MOUSE.sensitivityScale).toBe(2);
    expect(MOUSE.invertY).toBe(true);
  });
});
