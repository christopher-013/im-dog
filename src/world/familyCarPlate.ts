import { CanvasTexture, SRGBColorSpace } from 'three';
import { CARS } from '../config/cars';

/** Generated fictional registration only; no photograph or private registration is loaded. */
export function familyCarPlate(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 256;
  const g = canvas.getContext('2d');
  if (!g) return null;
  g.fillStyle = '#f4f3ec'; g.fillRect(0, 0, 512, 256);
  g.strokeStyle = '#969b9f'; g.lineWidth = 5; g.strokeRect(7, 7, 498, 242);
  g.textAlign = 'center'; g.fillStyle = '#bd2536';
  g.font = 'italic bold 53px Georgia, serif'; g.fillText('California', 256, 68, 390);
  g.fillStyle = '#15366b'; g.font = 'bold 77px monospace';
  g.fillText(CARS.family.plate, 256, 173, 470);
  g.font = '18px sans-serif'; g.fillText('THE GOLDEN STATE', 256, 225);
  g.fillStyle = '#596169';
  for (const x of [30, 482]) for (const y of [22, 234]) {
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}
