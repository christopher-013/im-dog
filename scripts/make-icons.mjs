// Generates the PWA / home-screen icons in public/icons/ from the same simple circles as public/favicon.svg
// (Moke's fluffy face, original art). No dependencies: shapes are rasterized here with 4×4 supersampling and
// written as PNG with Node's zlib. Run: node scripts/make-icons.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'public', 'icons');

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const CREAM = hex('#fbf1e4');
const INK = hex('#2b2530');
const WHITE = hex('#ffffff');
const EAR = hex('#f4e6d3');
const EYE = hex('#2a1b17');
const NOSE = hex('#1d1614');

// favicon.svg, in its own units: the fluff outline (stroke 7 → +3.5 radius), the fluff, cream ears, face, eyes, nose.
const FLUFF = [
  [50, 52, 33], [50, 18, 14], [32, 23, 13], [68, 23, 13], [21, 36, 12], [79, 36, 12], [16, 56, 15], [84, 56, 15],
  [20, 73, 13], [80, 73, 13], [34, 82, 12], [50, 86, 12], [66, 82, 12],
];
const EARS = [[16, 56, 15], [84, 56, 15], [20, 73, 13], [80, 73, 13]];
const SHAPES = [
  ...FLUFF.map(([x, y, r]) => ({ x, y, rx: r + 3.5, ry: r + 3.5, color: INK })),
  ...FLUFF.map(([x, y, r]) => ({ x, y, rx: r, ry: r, color: WHITE })),
  ...EARS.map(([x, y, r]) => ({ x, y, rx: r, ry: r, color: EAR })),
  { x: 50, y: 52, rx: 31, ry: 31, color: WHITE },
  { x: 37, y: 53, rx: 7, ry: 7, color: EYE },
  { x: 63, y: 53, rx: 7, ry: 7, color: EYE },
  { x: 50, y: 66, rx: 8, ry: 6, color: NOSE },
];
const FACE = { cx: 50, cy: 51, size: 105 };

function colorAt(x, y) {
  let c = CREAM;
  for (const s of SHAPES) {
    const dx = (x - s.x) / s.rx;
    const dy = (y - s.y) / s.ry;
    if (dx * dx + dy * dy <= 1) c = s.color;
  }
  return c;
}

/** An N×N RGBA image: cream background, the face filling `fraction` of it. */
function render(n, fraction) {
  const px = Buffer.alloc(n * n * 4);
  const ss = 4;
  const scale = FACE.size / (n * fraction);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      let r = 0, g = 0, b = 0;
      for (let sj = 0; sj < ss; sj++) {
        for (let si = 0; si < ss; si++) {
          const x = FACE.cx + (i + (si + 0.5) / ss - n / 2) * scale;
          const y = FACE.cy + (j + (sj + 0.5) / ss - n / 2) * scale;
          const c = colorAt(x, y);
          r += c[0]; g += c[1]; b += c[2];
        }
      }
      const o = (j * n + i) * 4;
      px[o] = Math.round(r / (ss * ss));
      px[o + 1] = Math.round(g / (ss * ss));
      px[o + 2] = Math.round(b / (ss * ss));
      px[o + 3] = 255;
    }
  }
  return px;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function png(n, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(n, 0);
  header.writeUInt32BE(n, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  const raw = Buffer.alloc((n * 4 + 1) * n);
  for (let y = 0; y < n; y++) {
    raw[y * (n * 4 + 1)] = 0; // no filter
    rgba.copy(raw, y * (n * 4 + 1) + 1, y * n * 4, (y + 1) * n * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync(outDir, { recursive: true });
const ICONS = [
  ['icon-192.png', 192, 0.8],
  ['icon-512.png', 512, 0.8],
  // Maskable: platforms crop to a circle or squircle, so keep the face inside the central safe zone.
  ['icon-maskable-512.png', 512, 0.6],
  ['apple-touch-icon.png', 180, 0.78],
];
for (const [name, n, fraction] of ICONS) {
  const file = path.join(outDir, name);
  writeFileSync(file, png(n, render(n, fraction)));
  console.log(`wrote ${path.relative(root, file)}`);
}
