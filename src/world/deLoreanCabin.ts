import { CanvasTexture, SRGBColorSpace } from 'three';
import { CARS } from '../config/cars';

/**
 * The DeLorean's cabin art (owner, 2026-10-20; D36): the time circuits (destination, present and last time departed)
 * and the flux capacitor's red tape labels, drawn in code like the film's props. No photo or copied artwork.
 */

/** One row's reading, as the circuits show it. */
export interface CircuitTime { month: string; day: string; year: string; pm: boolean; hour: string; min: string }

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const two = (n: number) => String(n).padStart(2, '0');

/** A date and time as the circuits read it: month, day, year, AM/PM and a 12-hour clock. */
export function circuitTime(date: Date): CircuitTime {
  const h = date.getHours();
  return {
    month: MONTHS[date.getMonth()]!, day: two(date.getDate()), year: String(date.getFullYear()),
    pm: h >= 12, hour: two(h % 12 === 0 ? 12 : h % 12), min: two(date.getMinutes()),
  };
}

/** A configured moment (`CARS.delorean.timeCircuits`) as a local date. */
export function circuitDate(t: { readonly year: number; readonly month: number; readonly day: number; readonly hour: number; readonly min: number }): Date {
  return new Date(t.year, t.month - 1, t.day, t.hour, t.min);
}

/** How many characters a fully keyed-in row has (month, day, year, hour, minute). */
export const CIRCUIT_CHARACTERS = 13;

const ROWS = [
  { caption: 'DESTINATION TIME', color: '#ff3b26' },
  { caption: 'PRESENT TIME', color: '#4dff6c' },
  { caption: 'LAST TIME DEPARTED', color: '#ffb52a' },
] as const;

/** The windows across a row: where each starts and how wide it is (canvas px), and what goes in it. */
const FIELDS = [
  { label: 'MONTH', x: 14, w: 104, chars: 3 },
  { label: 'DAY', x: 126, w: 62, chars: 2 },
  { label: 'YEAR', x: 196, w: 110, chars: 4 },
  { label: 'HOUR', x: 352, w: 62, chars: 2 },
  { label: 'MIN', x: 432, w: 62, chars: 2 },
] as const;

/**
 * The three rows of the time circuits on one canvas (512 × 384). `draw` repaints only when what it shows changes:
 * how much of the destination has been keyed in, or the present minute.
 */
export class TimeCircuits {
  readonly texture: CanvasTexture | null;
  private readonly g: CanvasRenderingContext2D | null;
  private shown = '';

  constructor() {
    const c = typeof document === 'undefined' ? null : document.createElement('canvas');
    if (c) { c.width = 512; c.height = 384; }
    this.g = c?.getContext('2d') ?? null;
    this.texture = this.g ? new CanvasTexture(this.g.canvas) : null;
    if (this.texture) { this.texture.colorSpace = SRGBColorSpace; this.texture.anisotropy = 4; }
  }

  /** The three rows' times: the destination, the present (`now`) and the last time departed. */
  readings(now: Date): [CircuitTime, CircuitTime, CircuitTime] {
    const t = CARS.delorean.timeCircuits;
    return [circuitTime(circuitDate(t.destination)), circuitTime(now), circuitTime(circuitDate(t.lastDeparted))];
  }

  draw(typed: number, now: Date): void {
    const key = `${typed}|${now.getFullYear()}-${now.getMonth()}-${now.getDate()} ${now.getHours()}:${now.getMinutes()}`;
    if (key === this.shown || !this.g) return;
    this.shown = key;
    const g = this.g;
    const rows = this.readings(now);
    g.fillStyle = '#2a2d31'; g.fillRect(0, 0, 512, 384);
    rows.forEach((time, i) => this.row(g, i * 128, ROWS[i]!, time, i === 0 ? typed : CIRCUIT_CHARACTERS));
    this.texture!.needsUpdate = true;
  }

  private row(g: CanvasRenderingContext2D, top: number, row: (typeof ROWS)[number], time: CircuitTime, typed: number): void {
    // A brushed grey plate with a screw at each end.
    const plate = g.createLinearGradient(0, top, 0, top + 124);
    plate.addColorStop(0, '#9aa0a6'); plate.addColorStop(0.5, '#7b8187'); plate.addColorStop(1, '#5d6268');
    g.fillStyle = plate; g.fillRect(2, top + 2, 508, 122);
    g.fillStyle = '#3d4146';
    for (const x of [7, 505]) { g.beginPath(); g.arc(x, top + 63, 3, 0, Math.PI * 2); g.fill(); }
    const text = [time.month, time.day, time.year, time.hour, time.min];
    let left = typed;
    FIELDS.forEach((f, i) => {
      // The red tag over each window.
      g.fillStyle = '#c3262b'; g.fillRect(f.x + f.w / 2 - 26, top + 8, 52, 16);
      g.fillStyle = '#fff'; g.font = 'bold 12px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(f.label, f.x + f.w / 2, top + 16.5);
      // The window: unlit segments faintly, then whatever's keyed in, lit.
      g.fillStyle = '#060506'; g.fillRect(f.x, top + 28, f.w, 56);
      g.font = 'bold 46px "Courier New", monospace'; g.textBaseline = 'alphabetic';
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillText('8'.repeat(f.chars), f.x + f.w / 2, top + 74, f.w - 6);
      const shown = text[i]!.slice(0, Math.max(0, Math.min(f.chars, left)));
      left -= f.chars;
      if (shown) {
        g.shadowColor = row.color; g.shadowBlur = 10; g.fillStyle = row.color;
        g.textAlign = 'left';
        g.fillText(shown, f.x + 5, top + 74, f.w - 6);
        g.shadowBlur = 0; g.textAlign = 'center';
      }
    });
    // AM / PM lamps between the year and the hour, and the colon.
    const lit = typed >= 9;
    for (const [label, on, y] of [['AM', !time.pm, 42], ['PM', time.pm, 68]] as const) {
      g.fillStyle = '#c3262b'; g.font = 'bold 11px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label, 329, top + y - 9);
      g.fillStyle = on && lit ? row.color : '#2a1a14';
      g.beginPath(); g.arc(329, top + y + 3, 5, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = typed >= CIRCUIT_CHARACTERS ? row.color : '#2a1a14';
    for (const y of [48, 64]) { g.beginPath(); g.arc(423, top + y, 3.5, 0, Math.PI * 2); g.fill(); }
    // Its caption on a dark plaque.
    g.fillStyle = '#20252b'; g.fillRect(150, top + 92, 212, 26);
    g.fillStyle = '#e6e9ec'; g.font = 'bold 15px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(row.caption, 256, top + 105.5, 204);
  }

  dispose(): void {
    this.texture?.dispose();
  }
}

/** A strip of red label tape with raised white capitals (the flux capacitor's warnings). Null where there's no canvas. */
export function labelTape(lines: readonly string[], width = 512, height = 64 * lines.length): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const g = c.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#c72a22'; g.fillRect(0, 0, width, height);
  g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, 2, width, 4);
  g.fillStyle = '#fbe9e4'; g.font = `bold ${Math.round((height / lines.length) * 0.56)}px "Courier New", monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((line, i) => g.fillText(line, width / 2, (i + 0.55) * (height / lines.length), width - 16));
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
