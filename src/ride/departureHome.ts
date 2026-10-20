import { BoxGeometry, ExtrudeGeometry, Group, MeshStandardMaterial, Shape, type BufferGeometry } from 'three';
import { StaticSceneBuilder, type Vec3Tuple } from '../world/StaticSceneBuilder';
import { GARAGE } from '../world/home/layout';
import { DEPARTURE_HOME as HOME } from '../config/ride';
import { buildNeighbor } from './neighborHouses';
import { neighborDriveway, NEIGHBOR_PROFILES } from '../config/neighborhood';

/** Original code-built façade from owner photos; no photograph, address or texture is distributed. */
export function departureHome(heightAt: (x: number) => number = () => 0): Group {
  const b = new StaticSceneBuilder();
  const materials = Object.fromEntries(Object.entries(HOME.colors).map(([key, color]) => [key,
    new MeshStandardMaterial({ color, roughness: key === 'glass' ? 0.25 : 0.85, metalness: key === 'glass' ? 0.2 : 0 }),
  ])) as Record<keyof typeof HOME.colors, MeshStandardMaterial>;
  type Paint = keyof typeof HOME.colors;
  let scale = 1;
  const add = (g: BufferGeometry, at: Vec3Tuple, paint: Paint, rotation?: Vec3Tuple) => {
    g.scale(scale, scale, scale);
    b.add(g, materials[paint], at.map((n) => n * scale) as Vec3Tuple, { rotation }); g.dispose();
  };
  const box = (size: Vec3Tuple, at: Vec3Tuple, paint: Paint, angle = 0) => add(new BoxGeometry(...size), at, paint, [0, 0, angle]);
  const window = (x: number, y: number, z: number, width: number, height: number, shutters = true) => {
    box([width + 0.18, height + 0.18, 0.12], [x, y, z], 'trim');
    box([width, height, 0.10], [x, y, z + 0.08], 'glass');
    box([width, 0.06, 0.035], [x, y, z + 0.15], 'trim');
    box([width + 0.32, 0.10, 0.22], [x, y - height / 2 - 0.06, z + 0.06], 'trim');
    box([width + 0.26, 0.09, 0.15], [x, y + height / 2 + 0.08, z], 'trim');
    if (!shutters) return;
    for (const side of [-1, 1]) {
      const sx = x + side * (width / 2 + 0.33);
      box([0.5, height + 0.22, 0.12], [sx, y, z + 0.09], 'shutters');
      for (const dy of [-height * 0.35, height * 0.35]) box([0.55, 0.13, 0.05], [sx, y + dy, z + 0.18], 'shutters');
      box([0.018, height, 0.025], [sx, y, z + 0.16], 'dark');
    }
  };
  const facade = (open: boolean, apronEnd = HOME.street.center - HOME.street.halfWidth) => {
    const front = HOME.garageFront, hf = HOME.houseFront;
    const width = GARAGE.xMax - GARAGE.xMin, depth = GARAGE.zMax - GARAGE.zMin;
    const gx = GARAGE.car.x, back = front - depth, mid = (front + back) / 2;
    const h = GARAGE.ceiling, dh = GARAGE.rollUp.height, opening = GARAGE.rollUp.xMax - GARAGE.rollUp.xMin;
    for (const x of [gx - width / 2, gx + width / 2]) box([0.22, h, depth], [x, h / 2, mid], 'wall');
    box([width, h, 0.2], [gx, h / 2, back], 'wall');
    box([width, 3.35, depth], [gx, h + 1.675, mid], 'wall');
    box([opening, h - dh, 0.25], [gx, (h + dh) / 2, front], 'wall');
    for (const side of [-1, 1]) {
      box([(width - opening) / 2, h, 0.25], [gx + side * (width + opening) / 4, h / 2, front], 'wall');
      box([0.12, dh + 0.15, 0.12], [gx + side * (opening / 2 + 0.05), dh / 2, front + 0.16], 'trim');
    }
    if (open) {
      box([opening, 0.12, 2.5], [gx, dh + 0.06, front - 1.2], 'trim');
      box([width - 0.6, 0.12, 0.6], [gx, 0.8, back + 0.5], 'dark');
      for (const dx of [-2, -1.1, -0.2]) box([0.65, 0.45, 0.5], [gx + dx, 1.085, back + 0.5], 'bins');
    } else {
      box([opening, dh, 0.12], [gx, dh / 2, front], 'trim');
      for (const y of [0.35, 0.9, 1.45, 2]) for (const dx of [-2.2, -0.73, 0.73, 2.2]) {
        box([1.25, 0.40, 0.035], [gx + dx, y, front + 0.08], 'concrete');
        box([1.15, 0.31, 0.025], [gx + dx, y, front + 0.11], 'trim');
      }
    }
    box([width, 0.16, depth], [gx, -0.06, mid], 'concrete');
    // Brick-toned lintel and the upstairs window/corbels over the garage, like the reference.
    box([width + 0.15, 0.23, 0.24], [gx, dh + 0.23, front + 0.13], 'entry');
    for (let x = gx - width / 2; x <= gx + width / 2; x += 0.18) box([0.016, 0.23, 0.025], [x, dh + 0.23, front + 0.27], 'wall');
    window(gx - 0.65, 4.8, front + 0.15, 1.35, 1.8);
    for (const dx of [-0.7, 0.7]) box([0.15, 0.35, 0.28], [gx - 0.65 + dx, 3.61, front + 0.19], 'trim');
    box([width + 0.5, 0.18, depth + 0.5], [gx, 6.27, mid], 'trim', -0.08);
    box([width + 0.55, 0.16, depth + 0.55], [gx, 6.40, mid], 'roof', -0.08);
    const hw = HOME.houseWidth, hx = gx - width / 2 - hw / 2, hd = HOME.houseDepth;
    box([hw, 3.05, hd - 1.35], [hx, 1.525, hf - (hd + 1.35) / 2], 'wall');
    box([hw, 3.2, hd], [hx, 4.6, hf - hd / 2], 'wall');
    const rise = 1.25, eave = 6.2;
    const triangle = new Shape().moveTo(-hw / 2, 0).lineTo(hw / 2, 0).lineTo(0, rise).closePath();
    add(new ExtrudeGeometry(triangle, { depth: hd, bevelEnabled: false }), [hx, eave, hf - hd], 'wall');
    const angle = Math.atan2(rise, hw / 2), slope = Math.hypot(hw / 2, rise);
    for (const side of [-1, 1]) {
      box([slope + 0.4, 0.13, hd + 0.55], [hx + side * hw / 4, eave + rise / 2 + 0.05, hf - hd / 2], 'roof', -side * angle);
      box([slope + 0.4, 0.13, 0.16], [hx + side * hw / 4, eave + rise / 2 - 0.06, hf + 0.30], 'trim', -side * angle);
      for (let z = hf - hd; z < hf + 0.25; z += 0.33) box([slope + 0.4, 0.035, 0.045], [hx + side * hw / 4, eave + rise / 2 + 0.13, z], 'dark', -side * angle);
    }
    for (const [dx, w, shutters] of [[-2.8, 0.68, false], [-0.5, 1.25, true], [2.4, 0.68, false]] as const) window(hx + dx, 4.8, hf + 0.12, w, 1.85, shutters);
    for (const [dx, y] of [[-0.18, 6.75], [0.18, 6.75], [0, 7.05]] as const) box([0.17, 0.15, 0.09], [hx + dx, y, hf + 0.12], 'entry');
    const porchZ = hf + 0.48, porchX = hx + 2.35;
    window(hx - 2.65, 1.65, hf - 1.18, 1.3, 1.8);
    box([3.3, 0.16, 2.2], [porchX, 0.05, porchZ - 0.8], 'concrete');
    box([3.4, 0.12, 2.5], [porchX, 2.95, porchZ - 0.6], 'trim');
    for (const dx of [-1.45, 1.45]) {
      box([0.18, 2.9, 0.18], [porchX + dx, 1.5, porchZ + 0.45], 'trim');
      box([0.34, 0.35, 0.34], [porchX + dx, 0.25, porchZ + 0.45], 'trim');
    }
    box([hw + 0.2, 0.13, 1.7], [hx, 3.05, hf - 0.1], 'roof');
    box([hw + 0.35, 0.14, 0.15], [hx, 2.98, hf + 0.8], 'trim');
    box([1.1, 2.2, 0.12], [porchX, 1.1, hf - 1.3], 'entry');
    box([1.7, 0.12, 1.0], [porchX, -0.02, porchZ + 0.8], 'concrete');
    const drivewayEnd = apronEnd / scale;
    box([width + 0.4, 0.12, drivewayEnd - front], [gx, -0.03, (front + drivewayEnd) / 2], 'concrete');
    for (let z = front + 2; z < drivewayEnd; z += 2) box([width + 0.4, 0.006, 0.025], [gx, 0.034, z], 'roof');
    box([hw, 0.12, 7], [hx, -0.04, hf + 4.2], 'lawn');
    box([hw - 0.2, 0.08, 1.4], [hx, 0.02, hf + 1.8], 'mulch');
    for (let dx = -hw / 2 + 0.7; dx < 0.5; dx += 1.1) box([0.75, 0.5, 0.7], [hx + dx, 0.3, hf + 1.8], 'hedge');
  };
  facade(true);
  for (const neighbor of HOME.neighbors) b.at([neighbor.x, heightAt(neighbor.x), neighbor.z], neighbor.heading, () => {
    buildNeighbor(b, materials, neighbor, neighbor.heading === 0 ? HOME.street.center - HOME.street.halfWidth
      : neighbor.z - (HOME.street.center + HOME.street.halfWidth));
  });
  const street = HOME.street;
  box([street.extent, 0.08, street.halfWidth * 2], [-street.extent / 2, -0.02, street.center], 'asphalt');
  for (const dz of [-0.12, 0.12]) box([street.extent, 0.008, 0.07], [-street.extent / 2, 0.025, street.center + dz], 'stripe');
  for (const side of [-1, 1]) {
    const gaps: [number, number][] = side === -1 ? [[GARAGE.car.x - 3.9, GARAGE.car.x + 3.9]] : [];
    for (const neighbor of HOME.neighbors) {
      if (neighbor.background || (neighbor.heading === 0 ? -1 : 1) !== side) continue;
      const driveway = neighborDriveway(neighbor.style, neighbor.scale, neighbor.mirror);
      const x = neighbor.x + (neighbor.heading === 0 ? driveway.x : -driveway.x);
      gaps.push([x - driveway.width / 2 - 0.1, x + driveway.width / 2 + 0.1]);
    }
    gaps.sort((a, c) => a[0] - c[0]);
    let from = -street.extent;
    const pave = (end: number) => {
      if (end <= from) return;
      const mid = (from + end) / 2, y = heightAt(mid);
      box([end - from, 0.12, 1.5], [mid, y + 0.02, street.center + side * (street.halfWidth + 0.75)], 'concrete');
      box([end - from, 0.18, 0.20], [mid, y - 0.02, street.center + side * (street.halfWidth - 0.08)], 'trim');
    };
    for (const [start, end] of gaps) { pave(start); from = Math.max(from, end); }
    pave(40);
  }
  const group = b.build('Departure home and garage');
  group.userData.neighbors = HOME.neighbors.map((n) => ({ ...n, y: heightAt(n.x), name: NEIGHBOR_PROFILES[n.style].name }));
  return group;
}
