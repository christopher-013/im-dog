import { BoxGeometry, CylinderGeometry, PlaneGeometry, PointLight, Vector3, type Group } from 'three';
import { HOUSE_SCALE } from '../config/world';
import type { StaticBox } from '../physics/PhysicsWorld';
import {
  coffeeTable,
  couch,
  curtain,
  dogBed,
  door,
  floorLamp,
  framedArt,
  pottedPlant,
  rug,
  sideTable,
  smallFrame,
  tvConsole,
} from './furniture';
import { createRoomMaterials, FLOOR_TILE, type RoomMaterials } from './materials';
import { StaticSceneBuilder } from './StaticSceneBuilder';

/** Room interior spans x -3.5..3.5 and z -3..3. */
const ROOM = { width: 7, depth: 6, wall: 0.12 };
/** Window in the left wall (x = -3.5). */
const WINDOW = { zMin: -0.7, zMax: 0.9, yMin: 0.7, yMax: 2.1 };
/** Doorway in the right wall (x = +3.5), leading to a short hallway. */
const DOORWAY = { zMin: 0.6, zMax: 1.6, height: 2.05 };
const HALLWAY_LENGTH = 3;
/** Interior light strengths (candela). */
const LIGHTS = { lamp: 7, hallway: 4 };

/**
 * Phase 1's living room, at true human scale seen from a small dog, echoing Moke's real home:
 * an oatmeal linen couch with leaf-print pillows, warm wood floor, sunlight through the window
 * onto his bed. Plus a short hallway for tight-space movement and camera testing.
 * Static scenery is merged by material; colliders come from the parts or simple boxes.
 */
export class LivingRoom {
  readonly object: Group;
  readonly colliders: StaticBox[];
  /** Where Moke starts: on the rug edge, facing the couch. */
  readonly spawn = { position: new Vector3(0.3, 0, 0.55), heading: Math.PI };
  /** Named places for tests and later milestones. */
  readonly landmarks = {
    dogBed: new Vector3(-2.25, 0, 0.05),
    /** In front of the bed's open side. */
    dogBedFront: new Vector3(-1.4, 0, 0.05),
    underTable: new Vector3(0.3, 0, -1.15),
    hallwayEntrance: new Vector3(3.0, 0, 1.1),
    hallwayEnd: new Vector3(6.2, 0, 1.1),
  };

  constructor() {
    const m = createRoomMaterials();
    const b = new StaticSceneBuilder();
    this.shell(b, m);
    this.windowAndView(b, m);
    this.hallway(b, m);
    this.furnish(b, m);
    this.colliders = b.colliders;
    this.object = b.build('LivingRoom');
  }

  private shell(b: StaticSceneBuilder, m: RoomMaterials): void {
    const { width: W, depth: D, wall: T } = ROOM;
    const H = HOUSE_SCALE.ceilingHeight;
    const hw = W / 2;
    const hd = D / 2;
    const solid = { solid: true };

    b.add(new BoxGeometry(W, 0.1, D), m.floor, [0, -0.05, 0], { cast: false, solid: true, worldUV: FLOOR_TILE });
    b.add(new BoxGeometry(W + 2 * T, 0.1, D + 2 * T), m.ceiling, [0, H + 0.05, 0], { receive: false });
    b.add(new BoxGeometry(W + 2 * T, H, T), m.accentWall, [0, H / 2, -hd - T / 2], solid);
    b.add(new BoxGeometry(W + 2 * T, H, T), m.wall, [0, H / 2, hd + T / 2], solid);

    // Left wall, built around the window so the sun only gets in through the glass.
    const xl = -hw - T / 2;
    const w = WINDOW;
    const midY = (w.yMin + w.yMax) / 2;
    b.add(new BoxGeometry(T, w.yMin, D), m.wall, [xl, w.yMin / 2, 0], solid);
    b.add(new BoxGeometry(T, H - w.yMax, D), m.wall, [xl, (H + w.yMax) / 2, 0], solid);
    b.add(new BoxGeometry(T, w.yMax - w.yMin, w.zMin + hd), m.wall, [xl, midY, (w.zMin - hd) / 2], solid);
    b.add(new BoxGeometry(T, w.yMax - w.yMin, hd - w.zMax), m.wall, [xl, midY, (w.zMax + hd) / 2], solid);

    // Right wall, built around the doorway.
    const xr = hw + T / 2;
    const d = DOORWAY;
    b.add(new BoxGeometry(T, H, d.zMin + hd), m.wall, [xr, H / 2, (d.zMin - hd) / 2], solid);
    b.add(new BoxGeometry(T, H, hd - d.zMax), m.wall, [xr, H / 2, (d.zMax + hd) / 2], solid);
    b.add(new BoxGeometry(T, H - d.height, d.zMax - d.zMin), m.wall, [xr, (H + d.height) / 2, (d.zMin + d.zMax) / 2], solid);

    // Door casing on the room side.
    const c = 0.07;
    b.add(new BoxGeometry(0.03, d.height + c, c), m.trim, [hw - 0.015, (d.height + c) / 2, d.zMin - c / 2]);
    b.add(new BoxGeometry(0.03, d.height + c, c), m.trim, [hw - 0.015, (d.height + c) / 2, d.zMax + c / 2]);
    b.add(new BoxGeometry(0.03, c, d.zMax - d.zMin + 2 * c), m.trim, [hw - 0.015, d.height + c / 2, (d.zMin + d.zMax) / 2]);

    // Baseboards (the right one splits at the doorway).
    const bh = 0.09;
    const bt = 0.02;
    b.add(new BoxGeometry(W, bh, bt), m.trim, [0, bh / 2, -hd + bt / 2]);
    b.add(new BoxGeometry(W, bh, bt), m.trim, [0, bh / 2, hd - bt / 2]);
    b.add(new BoxGeometry(bt, bh, D), m.trim, [-hw + bt / 2, bh / 2, 0]);
    b.add(new BoxGeometry(bt, bh, d.zMin + hd), m.trim, [hw - bt / 2, bh / 2, (d.zMin - hd) / 2]);
    b.add(new BoxGeometry(bt, bh, hd - d.zMax), m.trim, [hw - bt / 2, bh / 2, (d.zMax + hd) / 2]);
  }

  private windowAndView(b: StaticSceneBuilder, m: RoomMaterials): void {
    const hw = ROOM.width / 2;
    const x = -hw - ROOM.wall / 2;
    const { zMin, zMax, yMin, yMax } = WINDOW;
    const depth = ROOM.wall + 0.04;
    const openW = zMax - zMin;
    const openH = yMax - yMin;
    const midY = (yMin + yMax) / 2;
    const midZ = (zMin + zMax) / 2;
    const f = 0.06;
    const mullion = 0.035;

    b.add(new BoxGeometry(depth, f, openW), m.trim, [x, yMax - f / 2, midZ]);
    b.add(new BoxGeometry(depth, f, openW), m.trim, [x, yMin + f / 2, midZ]);
    b.add(new BoxGeometry(depth, openH, f), m.trim, [x, midY, zMin + f / 2]);
    b.add(new BoxGeometry(depth, openH, f), m.trim, [x, midY, zMax - f / 2]);
    b.add(new BoxGeometry(depth * 0.6, openH, mullion), m.trim, [x, midY, midZ]);
    b.add(new BoxGeometry(depth * 0.6, mullion, openW), m.trim, [x, midY, midZ]);
    b.add(new BoxGeometry(0.16, 0.035, openW + 0.2), m.trim, [-hw + 0.05, yMin - 0.0175, midZ]);

    // Curtains on a brass rod, framing the window.
    const cx = -hw + 0.07;
    b.add(new CylinderGeometry(0.015, 0.015, openW + 1.3, 10), m.brass, [cx, yMax + 0.18, midZ], {
      rotation: [Math.PI / 2, 0, 0],
    });
    for (const z of [zMin - 0.3, zMax + 0.3]) b.at([cx, 0, z], Math.PI / 2, () => curtain(b, m, 0.55, yMax + 0.15));

    // The garden outside. Unlit, and it must not block the sun.
    b.add(new PlaneGeometry(8, 5), m.garden, [-hw - 1.6, 1.4, midZ], {
      rotation: [0, Math.PI / 2, 0],
      cast: false,
      receive: false,
    });
  }

  private hallway(b: StaticSceneBuilder, m: RoomMaterials): void {
    const T = ROOM.wall;
    const H = HOUSE_SCALE.ceilingHeight;
    const x0 = ROOM.width / 2;
    const x1 = x0 + T + HALLWAY_LENGTH;
    const { zMin, zMax } = DOORWAY;
    const length = x1 - x0;
    const midX = (x0 + x1) / 2;
    const midZ = (zMin + zMax) / 2;
    const width = zMax - zMin;
    const solid = { solid: true };

    b.add(new BoxGeometry(length, 0.1, width), m.floor, [midX, -0.05, midZ], { cast: false, solid: true, worldUV: FLOOR_TILE });
    b.add(new BoxGeometry(length + T, 0.1, width + 2 * T), m.ceiling, [midX + T / 2, H + 0.05, midZ], { receive: false });
    b.add(new BoxGeometry(length + T, H, T), m.wall, [midX + T / 2, H / 2, zMin - T / 2], solid);
    b.add(new BoxGeometry(length + T, H, T), m.wall, [midX + T / 2, H / 2, zMax + T / 2], solid);
    b.add(new BoxGeometry(T, H, width + 2 * T), m.wall, [x1 + T / 2, H / 2, midZ], solid);
    b.add(new BoxGeometry(length - 0.6, 0.008, 0.55), m.runner, [midX + 0.15, 0.004, midZ], { cast: false });

    b.at([x1 - 0.03, 0, midZ], -Math.PI / 2, () => door(b, m, 0.85, 2.02));
    b.add(new CylinderGeometry(0.14, 0.14, 0.03, 24), m.lampShade, [midX, H - 0.015, midZ], { cast: false });
    b.addObject(new PointLight('#ffd9a8', LIGHTS.hallway, 4, 2), [midX, H - 0.2, midZ]);
  }

  private furnish(b: StaticSceneBuilder, m: RoomMaterials): void {
    const hd = ROOM.depth / 2;
    b.at([0.3, 0, -hd + 0.06 + 0.475], 0, () => couch(b, m));
    b.at([1.78, 0, -2.6], 0, () => sideTable(b, m));
    b.at([-1.28, 0, -2.62], 0, () => floorLamp(b, m, LIGHTS.lamp));
    b.at([0.3, 0, -0.95], 0, () => rug(b, m, 1.45));
    b.at([0.3, 0, -1.15], 0, () => coffeeTable(b, m));
    b.at([0.3, 0, hd - 0.23], Math.PI, () => tvConsole(b, m));
    b.at([3.05, 0, -2.6], 0, () => pottedPlant(b, m));
    // Moke's bed sits in the window's pool of afternoon sun, open side facing the room (+x).
    b.at([-2.25, 0, 0.05], Math.PI / 2, () => dogBed(b, m));

    b.at([0.3, 1.55, -hd + 0.02], 0, () => framedArt(b, m, 1.0, 0.7));
    const prints = ['coral', 'leaf', 'mustard'] as const;
    prints.forEach((print, i) => b.at([-0.1 + i * 0.4, 1.8, hd - 0.015], Math.PI, () => smallFrame(b, m, print)));
  }
}
