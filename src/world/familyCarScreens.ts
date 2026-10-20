import { CanvasTexture, SRGBColorSpace } from 'three';

/**
 * The family car's screens (owner, 2026-10-20: an Inside view like the black car's), drawn in code once: the tall
 * centre display with a map of the coast and the route to Torrey Pines, and the little cluster behind the wheel.
 * Original art, no logos. Null where there's no canvas (tests).
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

/** The centre display, portrait (384 × 512): the map, the route along the coast, a card for where they're going. */
export function familyCenterScreen(): CanvasTexture | null {
  const g = canvas(384, 512);
  if (!g) return null;
  // Land, and the sea to the west (left, north up), with a gently wiggling shore.
  g.fillStyle = '#e9e4da'; g.fillRect(0, 0, 384, 512);
  g.fillStyle = '#9fc8e6';
  g.beginPath(); g.moveTo(0, 0);
  for (let y = 0; y <= 512; y += 16) g.lineTo(96 + 26 * Math.sin(y / 70) + y * 0.06, y);
  g.lineTo(0, 512); g.closePath(); g.fill();
  // Green hills inland, a few streets, the coast road.
  g.fillStyle = '#cfe0bf';
  for (const [x, y, r] of [[300, 120, 70], [250, 330, 90], [330, 450, 60]] as const) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  g.strokeStyle = '#ffffff'; g.lineWidth = 6;
  for (const y of [90, 210, 380]) { g.beginPath(); g.moveTo(140, y); g.lineTo(384, y + 30); g.stroke(); }
  const road = (y: number) => 130 + 26 * Math.sin(y / 70) + y * 0.06;
  g.strokeStyle = '#f6d36b'; g.lineWidth = 9;
  g.beginPath(); for (let y = 0; y <= 512; y += 8) g.lineTo(road(y), y); g.stroke();
  // The route in blue: from home (the car) down the coast to the reserve.
  g.strokeStyle = '#2d7cf6'; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(250, 70); g.lineTo(road(100), 100);
  for (let y = 100; y <= 400; y += 8) g.lineTo(road(y), y);
  g.stroke();
  // The car: a blue arrow, pointing the way.
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(road(150), 150, 15, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2d7cf6';
  g.beginPath(); g.moveTo(road(150), 162); g.lineTo(road(150) - 9, 140); g.lineTo(road(150), 145); g.lineTo(road(150) + 9, 140); g.closePath(); g.fill();
  // Where they're going: a pin, and a card at the bottom.
  g.fillStyle = '#e8473c'; g.beginPath(); g.arc(road(400), 392, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#ffffff'; g.beginPath(); g.arc(road(400), 392, 4, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(20,22,26,0.88)'; g.fillRect(12, 420, 360, 80);
  g.fillStyle = '#ffffff'; g.font = 'bold 24px Arial, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'alphabetic';
  g.fillText('Torrey Pines', 28, 452);
  g.fillStyle = '#9fb3c8'; g.font = '18px Arial, sans-serif';
  g.fillText('Coast road · sunset · 4 min', 28, 482);
  // A status strip along the top.
  g.fillStyle = 'rgba(20,22,26,0.75)'; g.fillRect(0, 0, 384, 30);
  g.fillStyle = '#ffffff'; g.font = 'bold 16px Arial, sans-serif'; g.fillText('72°F', 14, 21);
  g.textAlign = 'right'; g.fillText('Windows down', 370, 21);
  return texture(g);
}

/** The little cluster behind the wheel (512 × 160): the gear, a car from above, the range. */
export function familyClusterScreen(): CanvasTexture | null {
  const g = canvas(512, 160);
  if (!g) return null;
  g.fillStyle = '#0d0f12'; g.fillRect(0, 0, 512, 160);
  g.textBaseline = 'middle'; g.textAlign = 'center';
  ['P', 'R', 'N', 'D'].forEach((gear, i) => {
    g.fillStyle = gear === 'D' ? '#ffffff' : '#4a5058';
    g.font = `bold ${gear === 'D' ? 40 : 28}px Arial, sans-serif`;
    g.fillText(gear, 40 + i * 34, 80);
  });
  // A car seen from above, on the lane.
  g.strokeStyle = '#3a4048'; g.lineWidth = 4;
  for (const x of [220, 300]) { g.beginPath(); g.moveTo(x, 10); g.lineTo(x - 18, 150); g.stroke(); }
  g.fillStyle = '#e8ebef'; g.fillRect(244, 50, 36, 66);
  g.fillStyle = '#2b3138'; g.fillRect(249, 64, 26, 18);
  // The range, and the battery.
  g.fillStyle = '#ffffff'; g.font = 'bold 30px Arial, sans-serif'; g.fillText('312 mi', 420, 66);
  g.fillStyle = '#2b3138'; g.fillRect(360, 96, 120, 14);
  g.fillStyle = '#5bd36d'; g.fillRect(360, 96, 96, 14);
  return texture(g);
}
