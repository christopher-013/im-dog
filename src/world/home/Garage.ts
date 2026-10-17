import { BoxGeometry, CylinderGeometry, PointLight, TorusGeometry } from 'three';
import { FLOOR_TILE, type RoomMaterials } from '../materials';
import type { StaticSceneBuilder } from '../StaticSceneBuilder';
import { GARAGE, WALL } from './layout';

/**
 * The Garage's fixed shell and things (Phase 6, D32): a standard two-car garage behind the living room. Concrete
 * floor, white walls, a ceiling light, steel shelving with storage bins, two bikes on the west wall, a wall charger
 * by the car, and the opening for the roll-up door (the door itself, the house door and the car move: GarageView).
 * It's never somewhere to play (its door is locked except for a ride), so nothing here needs to be dog-friendly.
 */
export function buildGarage(b: StaticSceneBuilder, m: RoomMaterials): void {
  const g = GARAGE;
  const T = WALL;
  const H = g.ceiling;
  const width = g.xMax - g.xMin;
  const depth = g.zMax - g.zMin;
  const midX = (g.xMin + g.xMax) / 2;
  const midZ = (g.zMin + g.zMax) / 2;
  const solid = { solid: true };

  // Floor (level with the house's) and ceiling.
  b.add(new BoxGeometry(width, 0.1, depth), m.concrete, [midX, -0.05, midZ], { cast: false, solid: true, worldUV: FLOOR_TILE * 2 });
  b.add(new BoxGeometry(width + 2 * T, 0.1, depth + T), m.ceiling, [midX, H + 0.05, midZ + T / 2], { receive: false });
  // Side walls (the north wall is the living room's south wall).
  for (const x of [g.xMin - T / 2, g.xMax + T / 2]) b.add(new BoxGeometry(T, H, depth), m.garageWall, [x, H / 2, midZ], solid);
  // The south wall round the roll-up door's opening.
  const r = g.rollUp;
  const zS = g.zMax + T / 2;
  b.add(new BoxGeometry(r.xMin - g.xMin + T, H, T), m.garageWall, [(g.xMin - T + r.xMin) / 2, H / 2, zS], solid);
  b.add(new BoxGeometry(g.xMax + T - r.xMax, H, T), m.garageWall, [(r.xMax + g.xMax + T) / 2, H / 2, zS], solid);
  b.add(new BoxGeometry(r.xMax - r.xMin, H - r.height, T), m.garageWall, [(r.xMin + r.xMax) / 2, (H + r.height) / 2, zS], solid);
  // The roll-up door's tracks up each side of the opening and along the ceiling.
  for (const x of [r.xMin - 0.04, r.xMax + 0.04]) {
    b.add(new BoxGeometry(0.05, r.height, 0.08), m.steelGrey, [x, r.height / 2, g.zMax - 0.06]);
    b.add(new BoxGeometry(0.05, 0.08, 2.6), m.steelGrey, [x, r.height + 0.06, g.zMax - 1.3]);
  }
  // A light in the middle of each bay.
  for (const x of [midX - width / 4, midX + width / 4]) {
    b.add(new BoxGeometry(1.1, 0.04, 0.3), m.lampShade, [x, H - 0.02, midZ], { cast: false });
  }
  b.addObject(new PointLight('#fff6ea', 9, 9, 2), [midX, H - 0.3, midZ]);

  // Steel shelving along the north wall's west half, with storage bins and a few boxes.
  const shelfX = -1.9;
  const shelfZ = g.zMin + 0.32;
  for (const dx of [-0.9, 0.9]) for (const dz of [-0.25, 0.25]) b.add(new BoxGeometry(0.04, 1.9, 0.04), m.steelGrey, [shelfX + dx, 0.95, shelfZ + dz], solid);
  for (const y of [0.35, 0.95, 1.55]) b.add(new BoxGeometry(1.85, 0.03, 0.55), m.steelGrey, [shelfX, y, shelfZ]);
  for (const [x, y] of [[-2.5, 0.36], [-1.9, 0.36], [-1.3, 0.36], [-2.3, 0.96], [-1.6, 0.96]] as const) {
    b.add(new BoxGeometry(0.5, 0.32, 0.42), m.storageBin, [x, y + 0.17, shelfZ]);
    b.add(new BoxGeometry(0.52, 0.03, 0.44), m.storageLid, [x, y + 0.345, shelfZ]);
  }
  for (const [x, w] of [[-2.4, 0.5], [-1.65, 0.6]] as const) b.add(new BoxGeometry(w, 0.3, 0.4), m.wicker, [x, 1.72, shelfZ]);

  // Two bikes hanging on the west wall (wheels, a frame, handlebars), side on.
  for (const [z, frame] of [[5.6, m.bikeRed], [7.3, m.navy]] as const) {
    const x = g.xMin + 0.18;
    for (const dz of [-0.52, 0.52]) {
      b.add(new TorusGeometry(0.33, 0.025, 8, 28), m.black, [x, 1.35, z + dz], { rotation: [0, Math.PI / 2, 0] });
      b.add(new CylinderGeometry(0.03, 0.03, 0.06, 10), m.chrome, [x, 1.35, z + dz], { rotation: [0, 0, Math.PI / 2] });
    }
    b.add(new BoxGeometry(0.04, 0.04, 1.0), frame, [x, 1.5, z], { rotation: [0.35, 0, 0] });
    b.add(new BoxGeometry(0.04, 0.04, 0.7), frame, [x, 1.62, z + 0.05]);
    b.add(new BoxGeometry(0.04, 0.4, 0.04), frame, [x, 1.75, z - 0.42]);
    b.add(new BoxGeometry(0.45, 0.03, 0.03), m.black, [x + 0.05, 1.95, z - 0.45]);
    b.add(new BoxGeometry(0.06, 0.2, 0.04), m.steelGrey, [g.xMin + 0.04, 1.95, z]);
  }

  // The car's wall charger on the east wall, by the car's front, with its coiled cable.
  const charger = { x: g.xMax - 0.04, z: 4.6 };
  b.add(new BoxGeometry(0.06, 0.38, 0.22), m.cream, [charger.x - 0.03, 1.15, charger.z]);
  b.add(new BoxGeometry(0.01, 0.05, 0.08), m.screen, [charger.x - 0.065, 1.24, charger.z]);
  b.add(new TorusGeometry(0.14, 0.018, 8, 24), m.black, [charger.x - 0.06, 0.75, charger.z], { rotation: [0, Math.PI / 2, 0] });

  // A recycling bin and a trash can by the roll-up door, west side.
  b.add(new CylinderGeometry(0.28, 0.25, 0.95, 18), m.navy, [-3.05, 0.475, 9.35], solid);
  b.add(new CylinderGeometry(0.28, 0.25, 0.95, 18), m.steelDark, [-2.4, 0.475, 9.4], solid);
  // A floor mat where the car parks.
  b.add(new BoxGeometry(1.6, 0.01, 3.6), m.rubberMat, [GARAGE.car.x, -0.015, GARAGE.car.z], { cast: false });
}
