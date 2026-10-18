import { CanvasTexture, SRGBColorSpace } from 'three';

/** Owner-requested movie-car markings, drawn locally. No downloaded image/font or personal registration. */
export function deLoreanMarking(kind: 'dmc' | 'rear' | 'plate'): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = kind === 'plate' ? 256 : 128;
  const g = canvas.getContext('2d');
  if (!g) return null;
  if (kind === 'plate') {
    g.fillStyle = '#eee9d6'; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#29364f'; g.lineWidth = 8; g.strokeRect(8, 8, 496, 240);
    const sunset = g.createLinearGradient(0, 24, 0, 97);
    sunset.addColorStop(0, '#ee6c37'); sunset.addColorStop(1, '#f6c35b');
    g.fillStyle = sunset; g.fillRect(45, 24, 422, 73);
    g.fillStyle = '#9d242a'; g.font = 'italic bold 51px Georgia, serif'; g.textAlign = 'center';
    g.fillText('California', 256, 78);
    g.fillStyle = '#142e55'; g.font = 'bold 83px monospace';
    g.fillText('OUTATIME', 256, 190, 460);
    g.font = 'bold 19px sans-serif'; g.fillText('AUG', 48, 230); g.fillText('86', 466, 230);
    g.fillStyle = '#60656a';
    for (const x of [30, 482]) for (const y of [20, 236]) { g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }
  } else if (kind === 'dmc') {
    // Squared, wide monogram: each letter is drawn as a path, not a downloaded logo texture.
    g.fillStyle = '#d6dadd';
    g.beginPath(); g.moveTo(14, 22); g.lineTo(115, 22); g.quadraticCurveTo(161, 22, 161, 64);
    g.quadraticCurveTo(161, 106, 115, 106); g.lineTo(14, 106); g.closePath();
    g.moveTo(38, 42); g.lineTo(38, 86); g.lineTo(112, 86); g.quadraticCurveTo(136, 86, 136, 64);
    g.quadraticCurveTo(136, 42, 112, 42); g.closePath(); g.fill('evenodd');
    g.beginPath(); g.moveTo(182, 106); g.lineTo(182, 22); g.lineTo(210, 22); g.lineTo(250, 64);
    g.lineTo(290, 22); g.lineTo(318, 22); g.lineTo(318, 106); g.lineTo(295, 106); g.lineTo(295, 51);
    g.lineTo(250, 94); g.lineTo(205, 51); g.lineTo(205, 106); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(493, 22); g.lineTo(387, 22); g.quadraticCurveTo(342, 22, 342, 64);
    g.quadraticCurveTo(342, 106, 387, 106); g.lineTo(493, 106); g.lineTo(493, 85);
    g.lineTo(390, 85); g.quadraticCurveTo(367, 85, 367, 64); g.quadraticCurveTo(367, 43, 390, 43);
    g.lineTo(493, 43); g.closePath(); g.fill();
  } else {
    g.fillStyle = '#cbd0d2'; g.font = '48px sans-serif'; g.textAlign = 'center';
    g.fillText('DeLorean', 256, 85, 490);
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}
