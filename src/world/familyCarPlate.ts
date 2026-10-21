import { CanvasTexture, SRGBColorSpace } from 'three';
import { CARS } from '../config/cars';

/**
 * Generated fictional registration only; no photograph or private registration is loaded. `text`: what it says (the
 * family car's OUTXTIME by default; the black car's KITT).
 */
export function familyCarPlate(text: string = CARS.family.plate): CanvasTexture | null {
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
  g.fillText(text, 256, 173, 470);
  g.font = '18px sans-serif'; g.fillText('THE GOLDEN STATE', 256, 225);
  g.fillStyle = '#596169';
  for (const x of [30, 482]) for (const y of [22, 234]) {
    g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill();
  }
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}

/**
 * The SUV's T badge (owner, 2026-10-21: "ensure that the Tesla T symbol badge is visible"; an owner-approved exception
 * to D34, like the DeLorean's DMC badge): a chrome T with a curved top bar and a thin arc over it, drawn in code on a
 * transparent canvas (256 × 256). No downloaded logo artwork. Null where there's no canvas (tests).
 */
export function familyCarBadge(): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const g = canvas.getContext('2d');
  if (!g) return null;
  const chrome = g.createLinearGradient(0, 30, 0, 230);
  chrome.addColorStop(0, '#ffffff'); chrome.addColorStop(0.45, '#b9c0c7'); chrome.addColorStop(0.55, '#8d959d'); chrome.addColorStop(1, '#e6eaee');
  g.fillStyle = chrome;
  // The thin arc over the T.
  g.beginPath();
  g.moveTo(28, 62); g.quadraticCurveTo(128, 18, 228, 62); g.lineTo(222, 74); g.quadraticCurveTo(128, 36, 34, 74);
  g.closePath(); g.fill();
  // The T: a top bar curving down at its ends, and a stem narrowing to a point.
  g.beginPath();
  g.moveTo(30, 88); g.quadraticCurveTo(128, 50, 226, 88);
  g.lineTo(214, 112); g.quadraticCurveTo(170, 96, 146, 98);
  g.lineTo(136, 232); g.lineTo(128, 240); g.lineTo(120, 232);
  g.lineTo(110, 98); g.quadraticCurveTo(86, 96, 42, 112);
  g.closePath(); g.fill();
  const texture = new CanvasTexture(canvas); texture.colorSpace = SRGBColorSpace;
  return texture;
}
