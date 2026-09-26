import { BoxGeometry, PlaneGeometry, PointLight, type Material } from 'three';
import { pottedPlant, treatJar } from '../furniture';
import type { RoomMaterials } from '../materials';
import { FLOOR_TILE } from '../materials';
import type { StaticSceneBuilder } from '../StaticSceneBuilder';
import {
  backroomDressing,
  backsplash,
  baseCabinets,
  builtIns,
  counterStool,
  diningChair,
  diningTable,
  dogBowls,
  fireplace,
  fridge,
  gardenWindow,
  island,
  monstera,
  pinkBlanket,
  range,
  rangeHood,
  rectChandelier,
  roundChandelier,
  rusticCoffeeTable,
  sectional,
  sideboard,
  signedDoor,
  slidingDoors,
  smallAppliances,
  stepStool,
  tallColumn,
  towerFan,
  toyBasket,
  tvOnStand,
  ukulele,
  upperCabinets,
  wainscoting,
  wallClock,
  windowCouch,
  wineFridge,
} from './homeFurniture';
import { CEILING, HALL, OPENINGS, WALL, WING } from './layout';
import { FURNITURE } from './places';

/** Interior light strengths (candela), like the living room's lamps. */
export const WING_LIGHTS = { kitchen: 5, dining: 4.5, fire: 2.2 } as const;

const H = CEILING;
const T = WALL;
const solid = { solid: true };
const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;

/** A wall along z (constant x = its centre line), from z0 to z1 and y0 to y1. */
function wallAlongZ(b: StaticSceneBuilder, material: Material, x: number, z0: number, z1: number, y0 = 0, y1: number = H, thickness: number = T): void {
  if (z1 - z0 < 1e-3 || y1 - y0 < 1e-3) return;
  b.add(new BoxGeometry(thickness, y1 - y0, z1 - z0), material, [x, (y0 + y1) / 2, (z0 + z1) / 2], solid);
}

/** A wall along x (constant z = its centre line). */
function wallAlongX(b: StaticSceneBuilder, material: Material, z: number, x0: number, x1: number, y0 = 0, y1: number = H, thickness: number = T): void {
  if (x1 - x0 < 1e-3 || y1 - y0 < 1e-3) return;
  b.add(new BoxGeometry(x1 - x0, y1 - y0, thickness), material, [(x0 + x1) / 2, (y0 + y1) / 2, z], solid);
}

/** A wall along x with a rectangular hole (a window or an opening from `holeY0`). */
function wallAlongXWithHole(
  b: StaticSceneBuilder,
  material: Material,
  z: number,
  x0: number,
  x1: number,
  hole: { x0: number; x1: number; y0: number; y1: number },
  thickness: number = T,
): void {
  wallAlongX(b, material, z, x0, hole.x0, 0, H, thickness);
  wallAlongX(b, material, z, hole.x1, x1, 0, H, thickness);
  wallAlongX(b, material, z, hole.x0, hole.x1, 0, hole.y0, thickness);
  wallAlongX(b, material, z, hole.x0, hole.x1, hole.y1, H, thickness);
}

function wallAlongZWithHoles(
  b: StaticSceneBuilder,
  material: Material,
  x: number,
  z0: number,
  z1: number,
  holes: readonly { z0: number; z1: number; y0: number; y1: number }[],
  thickness: number = T,
): void {
  let from = z0;
  for (const hole of holes) {
    wallAlongZ(b, material, x, from, hole.z0, 0, H, thickness);
    wallAlongZ(b, material, x, hole.z0, hole.z1, 0, hole.y0, thickness);
    wallAlongZ(b, material, x, hole.z0, hole.z1, hole.y1, H, thickness);
    from = hole.z1;
  }
  wallAlongZ(b, material, x, from, z1, 0, H, thickness);
}

/** Baseboard along x on the face of a wall (z = the face; `inward` = +1 if the room is at larger z). */
function baseboardX(b: StaticSceneBuilder, m: RoomMaterials, z: number, x0: number, x1: number, inward: 1 | -1): void {
  b.add(new BoxGeometry(x1 - x0, 0.09, 0.02), m.trim, [(x0 + x1) / 2, 0.045, z + inward * 0.01], { cast: false });
}

function baseboardZ(b: StaticSceneBuilder, m: RoomMaterials, x: number, z0: number, z1: number, inward: 1 | -1): void {
  b.add(new BoxGeometry(0.02, 0.09, z1 - z0), m.trim, [x + inward * 0.01, 0.045, (z0 + z1) / 2], { cast: false });
}

/**
 * The new wing (Phase 4): the kitchen, the family room (one open great room with it) and the dining room, joined to
 * the living room's hallway, plus the sunroom glimpsed through glass. Built into `b` with the shared materials.
 */
export function buildWing(b: StaticSceneBuilder, m: RoomMaterials): void {
  shell(b, m);
  // No sun gets into the wing (its windows face away from the late-afternoon sun, and its walls and ceiling block
  // the rest), so its furniture needn't cast sun shadows: the shadow pass skips it. The shell still casts.
  b.castByDefault = false;
  kitchen(b, m);
  diningRoom(b, m);
  familyRoom(b, m);
  sunroom(b, m);
  b.castByDefault = true;
}

function shell(b: StaticSceneBuilder, m: RoomMaterials): void {
  const x0 = WING.west - T;
  const x1 = WING.east + T;
  const z0 = WING.north - T;
  const z1 = WING.south + T;
  b.add(new BoxGeometry(x1 - x0, 0.1, z1 - z0), m.floorGrey, [(x0 + x1) / 2, -0.05, (z0 + z1) / 2], { cast: false, solid: true, worldUV: FLOOR_TILE });
  b.add(new BoxGeometry(x1 - x0, 0.1, z1 - z0), m.ceiling, [(x0 + x1) / 2, H + 0.05, (z0 + z1) / 2], { receive: false });

  const d = WING.divider;
  const half = T / 2;
  // West wall: sage in the dining room, greige in the kitchen, with the hallway's opening.
  const wx = WING.west - T / 2;
  wallAlongZ(b, m.wallSage, wx, z0, d);
  wallAlongZWithHoles(b, m.wallGreige, wx, d, z1, [{ z0: HALL.zMin, z1: HALL.zMax, y0: 0, y1: HALL.height }]);
  // Casing round the hallway opening, kitchen side.
  const c = 0.07;
  for (const z of [HALL.zMin - c / 2, HALL.zMax + c / 2]) b.add(new BoxGeometry(0.03, HALL.height + c, c), m.trim, [WING.west + 0.015, (HALL.height + c) / 2, z]);
  b.add(new BoxGeometry(0.03, c, HALL.zMax - HALL.zMin + 2 * c), m.trim, [WING.west + 0.015, HALL.height + c / 2, (HALL.zMin + HALL.zMax) / 2]);

  // North wall: the dining room's window, then the sunroom's.
  const nz = WING.north - T / 2;
  const dw = OPENINGS.diningWindow;
  wallAlongXWithHole(b, m.wallSage, nz, x0, WING.diningEast + T, { x0: dw.center - dw.width / 2, x1: dw.center + dw.width / 2, y0: dw.sill, y1: dw.sill + dw.height });
  wallAlongXWithHole(b, m.backroom, nz, WING.diningEast + T, x1, { x0: 13.4, x1: 14.8, y0: 0.9, y1: 2.1 });

  // The dining room's east wall, with the sliding doors.
  const s = OPENINGS.sliders;
  wallAlongZWithHoles(b, m.wallSage, WING.diningEast + T / 2, z0, d - half, [{ z0: s.zMin, z1: s.zMax, y0: 0, y1: s.height }]);

  // The divider: dining/kitchen (with the wide opening), then the sunroom/family room (with interior windows).
  // Two layers where the rooms either side are different colours.
  const o = OPENINGS.dining;
  const iw = OPENINGS.interiorWindows;
  for (const [z, material] of [
    [d - half / 2, m.wallSage],
    [d + half / 2, m.wallGreige],
  ] as const) {
    wallAlongXWithHole(b, material, z, x0 + T, WING.diningEast, { x0: o.xMin, x1: o.xMax, y0: 0, y1: o.height }, half);
  }
  wallAlongX(b, m.backroom, d - half / 2, WING.diningEast, WING.kitchenFamily, 0, H, half);
  wallAlongX(b, m.wallGreige, d + half / 2, WING.diningEast, WING.kitchenFamily, 0, H, half);
  wallAlongXWithHole(b, m.backroom, d - half / 2, WING.kitchenFamily, x1, { x0: iw.xMin, x1: iw.xMax, y0: iw.sill, y1: iw.top }, half);
  wallAlongXWithHole(b, m.wallSage, d + half / 2, WING.kitchenFamily, x1, { x0: iw.xMin, x1: iw.xMax, y0: iw.sill, y1: iw.top }, half);
  // Casing round the dining opening, both sides.
  for (const side of [-1, 1]) {
    const z = d + side * (half + 0.015);
    for (const x of [o.xMin - c / 2, o.xMax + c / 2]) b.add(new BoxGeometry(c, o.height + c, 0.03), m.trim, [x, (o.height + c) / 2, z]);
    b.add(new BoxGeometry(o.xMax - o.xMin + 2 * c, c, 0.03), m.trim, [(o.xMin + o.xMax) / 2, o.height + c / 2, z]);
  }
  interiorWindows(b, m);

  // South wall: greige in the kitchen, sage in the family room, with the bedroom hall's recess.
  const sz = WING.south + T / 2;
  const bh = OPENINGS.bedroomHall;
  wallAlongX(b, m.wallGreige, sz, x0, WING.kitchenFamily);
  wallAlongXWithHole(b, m.wallSage, sz, WING.kitchenFamily, x1, { x0: bh.xMin, x1: bh.xMax, y0: 0, y1: bh.height });
  const back = WING.south + T + bh.depth;
  wallAlongZ(b, m.wallSage, bh.xMin - T / 2, WING.south + T, back + T);
  wallAlongZ(b, m.wallSage, bh.xMax + T / 2, WING.south + T, back + T);
  wallAlongX(b, m.wallSage, back + T / 2, bh.xMin - T, bh.xMax + T);
  b.add(new BoxGeometry(bh.xMax - bh.xMin, 0.1, bh.depth + T), m.floorGrey, [(bh.xMin + bh.xMax) / 2, -0.05, WING.south + (bh.depth + T) / 2 + T / 2], { cast: false, solid: true, worldUV: FLOOR_TILE });
  b.add(new BoxGeometry(bh.xMax - bh.xMin + 2 * T, 0.1, bh.depth + 2 * T), m.ceiling, [(bh.xMin + bh.xMax) / 2, H + 0.05, back - bh.depth / 2], { receive: false });
  b.at([(bh.xMin + bh.xMax) / 2, 0, back - 0.03], Math.PI, () => signedDoor(b, m, 0.82, 2.02));
  for (const x of [bh.xMin - c / 2, bh.xMax + c / 2]) b.add(new BoxGeometry(c, bh.height + c, 0.03), m.trim, [x, (bh.height + c) / 2, WING.south - 0.015]);
  b.add(new BoxGeometry(bh.xMax - bh.xMin + 2 * c, c, 0.03), m.trim, [(bh.xMin + bh.xMax) / 2, bh.height + c / 2, WING.south - 0.015]);

  // East wall: the sunroom's, then the family room's with its two windows.
  const ex = WING.east + T / 2;
  wallAlongZ(b, m.backroom, ex, z0, d);
  const fw = OPENINGS.familyWindows;
  wallAlongZWithHoles(
    b,
    m.wallSage,
    ex,
    d,
    z1,
    fw.centers.map((zc) => ({ z0: zc - fw.width / 2, z1: zc + fw.width / 2, y0: fw.sill, y1: fw.sill + fw.height })),
  );

  // The soffit marking where the kitchen ends and the family room begins.
  b.add(new BoxGeometry(0.34, 0.22, WING.south - d - half), m.ceiling, [WING.kitchenFamily, H - 0.11, (d + half + WING.south) / 2], { cast: false });

  // Baseboards where they show.
  baseboardX(b, m, WING.south, 12.75, 13.55, -1);
  baseboardX(b, m, WING.south, 16.35, WING.east, -1);
  baseboardZ(b, m, WING.east, d + half, 1.75, -1);
  baseboardZ(b, m, WING.east, 4.05, WING.south, -1);
  baseboardX(b, m, d + half, WING.kitchenFamily, 12.3, 1);
  baseboardX(b, m, d + half, 10.25, WING.kitchenFamily, 1);
  baseboardX(b, m, d + half, WING.west, o.xMin, 1);
}

/** Three interior windows over the sectional (glass into the sunroom). */
function interiorWindows(b: StaticSceneBuilder, m: RoomMaterials): void {
  const iw = OPENINGS.interiorWindows;
  const z = WING.divider;
  const depth = T + 0.04;
  const f = 0.06;
  const width = iw.xMax - iw.xMin;
  const midY = (iw.sill + iw.top) / 2;
  b.add(new BoxGeometry(width, f, depth), m.trim, [(iw.xMin + iw.xMax) / 2, iw.top - f / 2, z]);
  b.add(new BoxGeometry(width, f, depth), m.trim, [(iw.xMin + iw.xMax) / 2, iw.sill + f / 2, z]);
  for (let i = 0; i <= 3; i++) {
    const x = iw.xMin + (i / 3) * width;
    b.add(new BoxGeometry(i === 0 || i === 3 ? f : 0.08, iw.top - iw.sill, depth), m.trim, [x + (i === 0 ? f / 2 : i === 3 ? -f / 2 : 0), midY, z]);
  }
  b.add(new PlaneGeometry(width - 2 * f, iw.top - iw.sill - 2 * f), m.glass, [(iw.xMin + iw.xMax) / 2, midY, z], { cast: false, receive: false });
  b.addCollider([(iw.xMin + iw.xMax) / 2, midY, z], [width, iw.top - iw.sill, T]);
}

function kitchen(b: StaticSceneBuilder, m: RoomMaterials): void {
  const x = WING.west;
  const rz = FURNITURE.range.z;
  const rangeHalf = 0.38;
  const runStart = HALL.zMax + 0.25;
  // The range wall (west): counters either side of the range, the hood, subway tile and the arabesque panel.
  const northRun = { z0: runStart, z1: rz - rangeHalf };
  const southRun = { z0: rz + rangeHalf, z1: WING.south };
  for (const run of [northRun, southRun]) {
    b.at([x, 0, (run.z0 + run.z1) / 2], EAST, () => baseCabinets(b, m, run.z1 - run.z0));
  }
  b.at([x, 0, rz], EAST, () => {
    range(b, m);
    rangeHood(b, m, 1.72, H);
    b.at([0, 0.92, 0], 0, () => backsplash(b, m.arabesque, 0.9, 0.8));
  });
  const tileN = { z0: runStart, z1: rz - 0.45 };
  const tileS = { z0: rz + 0.45, z1: WING.south };
  for (const run of [tileN, tileS]) {
    b.at([x, 0.92, (run.z0 + run.z1) / 2], EAST, () => backsplash(b, m.subway, run.z1 - run.z0, 0.53));
    b.at([x, 0, (run.z0 + run.z1 + (run === tileN ? -0.05 : 0.05)) / 2], EAST, () => upperCabinets(b, m, run.z1 - run.z0 - 0.1));
  }
  b.at([x, 0.92, 2.25], EAST, () => smallAppliances(b, m));
  b.at([FURNITURE.kitchenTreatJar.x, 0.92, FURNITURE.kitchenTreatJar.z], EAST, () => treatJar(b, m));

  // The tall wall (south): a short counter run in the corner, the double ovens, the fridge, the microwave.
  const sz = WING.south;
  const cornerX = x + 0.62;
  const ovensX = 9.1;
  b.at([(cornerX + ovensX) / 2, 0, sz], Math.PI, () => {
    baseCabinets(b, m, ovensX - cornerX);
    b.at([0, 0.92, 0], 0, () => backsplash(b, m.subway, ovensX - cornerX, 0.53));
  });
  b.at([(x + 0.34 + ovensX) / 2, 0, sz], Math.PI, () => upperCabinets(b, m, ovensX - x - 0.34));
  b.at([ovensX + 0.38, 0, sz], Math.PI, () => tallColumn(b, m, 'ovens', H));
  b.at([ovensX + 0.76 + 0.46, 0, sz], Math.PI, () => fridge(b, m, H));
  b.at([ovensX + 0.76 + 0.92 + 0.38, 0, sz], Math.PI, () => tallColumn(b, m, 'microwave', H));
  const endX = ovensX + 0.76 + 0.92 + 0.76;
  b.add(new BoxGeometry(WING.kitchenFamily - endX, H, 0.68), m.cabinet, [(endX + WING.kitchenFamily) / 2, H / 2, sz - 0.34], solid);

  // The island and its five stools, and the crystal chandelier.
  const is = FURNITURE.island;
  b.at([is.x, 0, is.z], is.rotation, () => island(b, m));
  for (const stool of FURNITURE.islandStools) b.at([stool.x, 0, stool.z], stool.rotation, () => counterStool(b, m));
  b.at([is.x, 0, is.z], is.rotation, () => rectChandelier(b, m, H));
  b.addObject(new PointLight('#ffe2b8', WING_LIGHTS.kitchen, 6.5, 2), [is.x, 1.95, is.z]);
}

function diningRoom(b: StaticSceneBuilder, m: RoomMaterials): void {
  const x = WING.west;
  const d = WING.divider - T / 2;
  // Wainscoting all round.
  b.at([x, 0, (WING.north + d) / 2], EAST, () => wainscoting(b, m, d - WING.north));
  b.at([(x + WING.diningEast) / 2, 0, WING.north], 0, () => wainscoting(b, m, WING.diningEast - x));
  const s = OPENINGS.sliders;
  b.at([WING.diningEast, 0, (WING.north + s.zMin) / 2], WEST, () => wainscoting(b, m, s.zMin - WING.north));
  b.at([WING.diningEast, 0, (s.zMax + d) / 2], WEST, () => wainscoting(b, m, d - s.zMax));
  const o = OPENINGS.dining;
  b.at([(x + o.xMin - 0.07) / 2, 0, d], Math.PI, () => wainscoting(b, m, o.xMin - 0.07 - x));
  b.at([(o.xMax + 0.07 + WING.diningEast) / 2, 0, d], Math.PI, () => wainscoting(b, m, WING.diningEast - o.xMax - 0.07));

  // The sideboard between two wine fridges, and the mirror.
  const sb = FURNITURE.sideboard.z;
  b.at([x, 0, sb], EAST, () => sideboard(b, m, 1.6));
  for (const z of [sb - 1.13, sb + 1.13]) b.at([x, 0, z], EAST, () => wineFridge(b, m));

  // The window, the big clock, the TV on its stand, plants.
  const dw = OPENINGS.diningWindow;
  b.at([dw.center, 0, WING.north - T / 2], 0, () => gardenWindow(b, m, dw.width, dw.height, dw.sill, T));
  b.at([7.55, 1.72, WING.north], 0, () => wallClock(b, m));
  b.at([10.35, 0, WING.north + 0.55], -0.6, () => tvOnStand(b, m));
  b.at([7.3, 0, WING.north + 0.4], 0, () => pottedPlant(b, m));
  b.at([10.45, 0, 0.08], 0.8, () => pottedPlant(b, m));

  // The sliding doors to the sunroom.
  b.at([WING.diningEast + T / 2, 0, (s.zMin + s.zMax) / 2], WEST, () => slidingDoors(b, m, s.zMax - s.zMin, T));

  // The table, eight chairs and the round chandelier.
  const t = FURNITURE.diningTable;
  b.at([t.x, 0, t.z], EAST, () => diningTable(b, m));
  for (const chair of FURNITURE.diningChairs) b.at([chair.x, 0, chair.z], chair.rotation, () => diningChair(b, m, chair.arms));
  b.at([t.x, 0, t.z], 0, () => roundChandelier(b, m, H));
  b.addObject(new PointLight('#ffe0b0', WING_LIGHTS.dining, 6, 2), [t.x, 1.85, t.z]);
}

function familyRoom(b: StaticSceneBuilder, m: RoomMaterials): void {
  const f = FURNITURE;
  b.at([f.sectional.x, 0, f.sectional.z], 0, () => sectional(b, m, f.sectional.length));
  b.at([f.windowCouch.x, 0, f.windowCouch.z], WEST, () => windowCouch(b, m));
  const fw = OPENINGS.familyWindows;
  for (const zc of fw.centers) b.at([WING.east + T / 2, 0, zc], WEST, () => gardenWindow(b, m, fw.width, fw.height, fw.sill, T));
  // The sun through the windows onto the couch and the floor in front of it: a soft glow (the room's real sun
  // comes in the living room's window; this side of the house gets it drawn in). The nap spot is "sunny" here.
  b.add(new PlaneGeometry(2.2, 1.1), m.sunPatch, [15.42, 0.006, 2.9], { rotation: [-Math.PI / 2, 0, Math.PI / 2], cast: false, receive: false });
  b.add(new PlaneGeometry(2.0, 0.62), m.sunPatch, [16.29, 0.466, 2.9], { rotation: [-Math.PI / 2, 0, Math.PI / 2], cast: false, receive: false });

  b.at([f.fireplace.x, 0, WING.south], Math.PI, () => fireplace(b, m));
  b.addObject(new PointLight('#ff9d4d', WING_LIGHTS.fire, 4.5, 2), [f.fireplace.x, 0.62, WING.south - 0.45]);
  b.at([f.builtIns.x, 0, WING.south], Math.PI, () => builtIns(b, m, f.builtIns.width));
  b.at([15.25, 0.3, 4.9], 0.3, () => toyBasket(b, m));
  b.at([15.7, 0, 4.86], Math.PI, () => ukulele(b, m));
  b.at([f.bowls.x, 0, f.bowls.z], 0, () => dogBowls(b, m));

  b.at([f.coffeeTable.x, 0, f.coffeeTable.z], 0, () => rusticCoffeeTable(b, m));
  b.at([f.pinkBlanket.x, 0, f.pinkBlanket.z], f.pinkBlanket.rotation, () => pinkBlanket(b, m));
  b.at([16.6, 0, 5.05], 0.4, () => monstera(b, m, 1.1));
  b.at([16.55, 0, 0.9], 1.3, () => monstera(b, m, 1));
  b.at([15.98, 0, 0.78], 0, () => towerFan(b, m));
  b.at([15.93, 0, 1.32], WEST, () => stepStool(b, m));
}

/** The gym/sunroom through the glass: never entered, just there. */
function sunroom(b: StaticSceneBuilder, m: RoomMaterials): void {
  b.at([13.6, 0, -1.9], 0.2, () => backroomDressing(b, m));
  b.at([14.1, 0, WING.north - T / 2], 0, () => gardenWindow(b, m, 1.4, 1.2, 0.9, T));
}
