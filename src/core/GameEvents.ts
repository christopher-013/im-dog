import type { Vec3Like } from '../physics/CharacterBody';

/** Something a human says, for a speech bubble. `mood` picks its look and sound. */
export interface Speech {
  readonly text: string;
  readonly mood: 'surprised' | 'happy' | 'calling' | 'searching' | 'neutral';
}

/**
 * Gameplay events, by name, with their payloads. Systems publish what happened; orchestration (Sock Heist),
 * UI and audio listen. Add a name here when a new system needs one.
 */
export interface GameEventMap {
  SOCK_PICKED_UP: { by: 'moke' | 'human' };
  SOCK_DROPPED: { at: Vec3Like };
  SOCK_RETURNED: Record<string, never>;
  HUMAN_NOTICED: Record<string, never>;
  CHASE_STARTED: Record<string, never>;
  CHASE_LOST: Record<string, never>;
  CHASE_FOUND: Record<string, never>;
  GRAB_MISSED: Record<string, never>;
  CHASE_GAVE_UP: Record<string, never>;
  TREAT_FETCHED: Record<string, never>;
  TREAT_OFFERED: Record<string, never>;
  SOCK_TRADED: Record<string, never>;
  TREAT_PLACED: Record<string, never>;
  TREAT_EATEN: Record<string, never>;
  DOG_LOGIC_DISCOVERED: { id: string; first: boolean };
  HEIST_COMPLETE: { seconds: number };
  HEIST_RESET: Record<string, never>;
  HUMAN_SAID: Speech;
}

export type GameEventName = keyof GameEventMap;
type Listener<K extends GameEventName> = (payload: GameEventMap[K]) => void;

/**
 * A tiny typed publish/subscribe hub: no queues, priorities or wildcards. `emit` calls listeners right away,
 * in the order they subscribed. Keeps systems decoupled without an enterprise event bus.
 */
export class GameEvents {
  private readonly listeners = new Map<GameEventName, Listener<never>[]>();
  /** The last few events, newest last (debug panel). */
  readonly recent: GameEventName[] = [];

  on<K extends GameEventName>(name: K, listener: Listener<K>): () => void {
    const list = (this.listeners.get(name) ?? []) as Listener<K>[];
    list.push(listener);
    this.listeners.set(name, list as Listener<never>[]);
    return () => this.off(name, listener);
  }

  off<K extends GameEventName>(name: K, listener: Listener<K>): void {
    const list = this.listeners.get(name) as Listener<K>[] | undefined;
    const index = list?.indexOf(listener) ?? -1;
    if (list && index >= 0) list.splice(index, 1);
  }

  emit<K extends GameEventName>(name: K, ...payload: GameEventMap[K] extends Record<string, never> ? [] : [GameEventMap[K]]): void {
    if (name !== 'HUMAN_SAID') {
      this.recent.push(name);
      if (this.recent.length > 6) this.recent.shift();
    }
    const value = (payload[0] ?? {}) as GameEventMap[K];
    for (const listener of [...((this.listeners.get(name) ?? []) as Listener<K>[])]) listener(value);
  }
}
