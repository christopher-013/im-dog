import { Group, Vector3 } from 'three';
import type { StaticBox } from '../physics/PhysicsWorld';
import { HOME_BOUNDS, ROOMS, roomAt, type RoomArea } from './home/layout';
import { FIRE, HOME_PLACES, KITCHEN_TREATS, NAP_SPOTS, TREAT_HIDING_SPOTS, type HomePlace, type NapSpot, type Spot } from './home/places';
import { buildWing } from './home/Wing';
import { LivingRoom } from './LivingRoom';
import { createRoomMaterials } from './materials';
import { StaticSceneBuilder } from './StaticSceneBuilder';

/**
 * Moke's whole home, one connected space with no loading: the living room and its hallway (Phases 1–3), which
 * now opens into the kitchen, the family room and the dining room (Phase 4, drawn from the home photos: see
 * docs/HOME_REFERENCE.md). Two merged scenery groups sharing one set of materials, one list of colliders, and the
 * named places everything else uses: landmarks, the human's interaction points, nap spots and treat hiding spots.
 */
export class Home {
  readonly object = new Group();
  readonly colliders: StaticBox[];
  readonly livingRoom: LivingRoom;
  readonly spawn: { readonly position: Vector3; readonly heading: number };
  /** The living room's landmarks (Sock Heist and the Phase 1 tests use them), plus a few in the new rooms. */
  readonly landmarks: LivingRoom['landmarks'] & {
    readonly kitchen: Vector3;
    readonly diningRoom: Vector3;
    readonly familyRoom: Vector3;
    readonly underDiningTable: Vector3;
  };
  readonly rooms: readonly RoomArea[] = ROOMS;
  readonly places: readonly HomePlace[] = HOME_PLACES;
  readonly napSpots: readonly NapSpot[] = NAP_SPOTS;
  readonly treatHidingSpots: readonly Spot[] = TREAT_HIDING_SPOTS;
  readonly kitchenTreats = KITCHEN_TREATS;
  readonly fire = FIRE;
  /** Outer faces of the house's walls. */
  readonly bounds = HOME_BOUNDS;

  constructor() {
    const materials = createRoomMaterials();
    this.livingRoom = new LivingRoom({ materials, hallwayOpen: true });
    const wing = new StaticSceneBuilder();
    buildWing(wing, materials);
    this.colliders = [...this.livingRoom.colliders, ...wing.colliders];
    this.object.name = 'Home';
    this.object.add(this.livingRoom.object, wing.build('Wing'));
    this.spawn = this.livingRoom.spawn;
    this.landmarks = {
      ...this.livingRoom.landmarks,
      kitchen: new Vector3(8.0, 0, 1.2),
      diningRoom: new Vector3(7.6, 0, -1.2),
      familyRoom: new Vector3(13.0, 0, 3.4),
      underDiningTable: new Vector3(8.85, 0, -1.75),
    };
  }

  /** Which room a floor point is in. */
  roomAt(x: number, z: number): RoomArea {
    return roomAt(x, z);
  }
}
