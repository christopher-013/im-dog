import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * The black car's dashboard art (D37), drawn in code once: original instrument panels in the style of the TV car's
 * (bar graphs, lit buttons, little screens), no photograph or copied artwork. Null where there's no canvas (tests).
 */
function canvas(width: number, height: number): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  return c.getContext('2d');
}

function texture(g: CanvasRenderingContext2D): CanvasTexture {
  const t = new CanvasTexture(g.canvas);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** A rounded rectangle path (not `roundRect`, which older Safari lacks). */
function rounded(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

const RED = '#ff3b2a', AMBER = '#ffb52e', YELLOW = '#f4de62', GREEN = '#5cff7a', BLUE = '#8fd8ff';

/** A lit button: a rounded block, its label in dark letters. */
function button(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, label: string, size = 13): void {
  g.fillStyle = color;
  rounded(g, x, y, w, h, 4); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x + 3, y + 2, w - 6, 3);
  if (!label) return;
  g.fillStyle = '#2a1408'; g.font = `bold ${size}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = label.split(' ');
  lines.forEach((line, i) => g.fillText(line, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * (size + 1), w - 4));
}

/** A bar graph: `n` segments, `lit` of them on, coloured green → yellow → red along it. */
function bars(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, n: number, lit: number, vertical = false): void {
  for (let i = 0; i < n; i++) {
    const k = i / n;
    const on = i < lit;
    g.fillStyle = on ? (k < 0.55 ? GREEN : k < 0.8 ? YELLOW : RED) : '#2a1512';
    if (vertical) g.fillRect(x, y + h - (i + 1) * (h / n) + 1, w, h / n - 2);
    else g.fillRect(x + i * (w / n) + 1, y, w / n - 2, h);
  }
}

/** A red seven-segment-style number. */
function readout(g: CanvasRenderingContext2D, x: number, y: number, text: string, size: number, color = RED): void {
  g.fillStyle = '#1b0705'; g.fillRect(x - 4, y - size + 2, text.length * size * 0.62 + 8, size + 4);
  g.fillStyle = color; g.font = `bold ${size}px "Courier New", monospace`; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText(text, x, y);
}

/**
 * The dash face, seen from the seats: the driver's instruments on the left (u 0), the passenger's screens and
 * buttons on the right. 1024 × 192.
 */
export function kittDashTexture(): CanvasTexture | null {
  const g = canvas(1024, 192);
  if (!g) return null;
  g.fillStyle = '#121214'; g.fillRect(0, 0, 1024, 192);
  // A glossy black fascia with soft grey edges round each pod.
  const pod = (x: number, w: number) => {
    g.fillStyle = '#26272b'; rounded(g, x, 10, w, 172, 14); g.fill();
    g.fillStyle = '#060607'; rounded(g, x + 6, 16, w - 12, 160, 10); g.fill();
  };
  // Driver's left pod: speed and revs as long bar graphs, a red speed readout, warning lamps.
  pod(8, 300);
  readout(g, 30, 62, '088', 40);
  g.fillStyle = AMBER; g.font = 'bold 12px Arial, sans-serif'; g.textAlign = 'left'; g.fillText('MPH', 110, 60);
  bars(g, 28, 76, 262, 16, 22, 15);
  bars(g, 28, 100, 262, 16, 22, 9);
  g.fillStyle = AMBER; g.font = 'bold 11px Arial, sans-serif'; g.fillText('RPM × 1000', 30, 132);
  readout(g, 180, 166, 'AUTO', 22, GREEN);
  for (let i = 0; i < 4; i++) button(g, 30 + i * 36, 144, 30, 22, [RED, AMBER, GREEN, RED][i]!, '');
  // Driver's right pod: fuel/oil/temperature columns and a row of lamps.
  pod(316, 200);
  for (let i = 0; i < 6; i++) bars(g, 334 + i * 30, 30, 20, 110, 12, [9, 7, 11, 5, 8, 10][i]!, true);
  g.fillStyle = AMBER; g.font = 'bold 10px Arial, sans-serif'; g.textAlign = 'center';
  ['FUEL', 'OIL', 'TEMP', 'VOLT', 'BOOST', 'TURBO'].forEach((t, i) => g.fillText(t, 344 + i * 30, 156));
  for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? RED : AMBER; g.fillRect(332 + i * 30, 164, 22, 6); }
  // Passenger side: two little screens over rows of lit buttons.
  pod(600, 416);
  for (const x of [624, 820]) {
    g.fillStyle = '#3c4c55'; rounded(g, x, 26, 170, 92, 8); g.fill();
    const glow = g.createRadialGradient(x + 85, 72, 6, x + 85, 72, 90);
    glow.addColorStop(0, '#d8f1ff'); glow.addColorStop(1, '#6f8d9b');
    g.fillStyle = glow; rounded(g, x + 6, 32, 158, 80, 6); g.fill();
    g.strokeStyle = 'rgba(40,60,70,0.35)'; g.lineWidth = 1;
    for (let y = 36; y < 112; y += 4) { g.beginPath(); g.moveTo(x + 8, y); g.lineTo(x + 162, y); g.stroke(); }
  }
  g.fillStyle = '#28414e'; g.font = 'bold 18px "Courier New", monospace'; g.textAlign = 'center';
  g.fillText('SCANNER', 709, 66); g.fillText('ON', 709, 88); g.fillText('ROAD', 905, 66); g.fillText('CLEAR', 905, 88);
  const labels = ['TRAC', 'AIR', 'S1', 'S2', 'P1', 'P2', 'SKI', 'COM', 'EJCT', 'TURB'];
  labels.forEach((t, i) => button(g, 620 + i * 38.5, 132, 33, 36, [RED, AMBER, YELLOW, RED, AMBER, RED, YELLOW, BLUE, RED, AMBER][i]!, t, 10));
  return texture(g);
}

/**
 * The console round the voice box: five lit buttons down each side, the bars' dark window in the middle (the
 * animated bars sit over it), and the three drive modes under it. 256 × 384.
 */
export function kittConsoleTexture(): CanvasTexture | null {
  const g = canvas(256, 384);
  if (!g) return null;
  g.fillStyle = '#0b0b0d'; g.fillRect(0, 0, 256, 384);
  g.fillStyle = '#2b2c30'; rounded(g, 4, 4, 248, 376, 16); g.fill();
  g.fillStyle = '#050506'; rounded(g, 12, 12, 232, 360, 12); g.fill();
  const left = ['ALT', 'OIL PRESS', 'OIL TEMP', 'EGT', 'FUEL'];
  const right = ['AUX', 'SAT COMM', 'ACC', 'RADAR', 'MPI'];
  for (let i = 0; i < 5; i++) {
    const color = i < 2 ? YELLOW : RED;
    button(g, 20, 22 + i * 52, 56, 40, color, left[i]!, 12);
    button(g, 180, 22 + i * 52, 56, 40, color, right[i]!, 12);
  }
  // The bars' window (the voice box draws over this), and a frame round it.
  g.fillStyle = '#1d1e22'; g.fillRect(84, 18, 88, 240);
  g.fillStyle = '#000'; g.fillRect(88, 22, 80, 232);
  // Drive modes: Normal Cruise lit.
  button(g, 88, 270, 80, 30, GREEN, 'NORMAL CRUISE', 11);
  button(g, 88, 304, 80, 30, '#8d9196', 'AUTO CRUISE', 11);
  button(g, 88, 338, 80, 30, '#8d9196', 'PURSUIT', 11);
  g.fillStyle = GREEN; g.fillRect(72, 274, 10, 22);
  g.fillStyle = '#4a4d52'; g.fillRect(72, 308, 10, 22); g.fillRect(72, 342, 10, 22);
  return texture(g);
}

/** Where the voice box's bars go on the console art (fractions of its width and height, from the top left). */
export const CONSOLE_BARS = { x: 88 / 256, y: 22 / 384, w: 80 / 256, h: 232 / 384 } as const;
