import { Object3D, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import { FrontDoor } from './FrontDoor';

describe('Exterior delivery door presentation', () => {
  it('puts the visitor outside the west wall, opens outward, and leaves the parcel inside after handoff', () => {
    const front = new FrontDoor();
    const { door } = HOME_ACTIVITIES.delivery;
    const visitor = front.object.getObjectByName('Amazon delivery person')!;
    const hinge = front.object.getObjectByName('Exterior door hinge')!;
    const parcel = front.object.getObjectByName('Amazon parcel'); // stored, not parented yet
    expect(parcel).toBeUndefined();
    front.arrive();
    const box = front.object.getObjectByName('Amazon parcel')!;
    front.object.updateMatrixWorld(true);
    expect(visitor.getWorldPosition(new Vector3()).x).toBeLessThan(door.x);
    expect(visitor.getWorldPosition(new Vector3()).z).toBeCloseTo(door.z);
    front.open(true);
    for (let i = 0; i < 90; i++) front.update(1 / 60);
    front.object.updateMatrixWorld(true);
    expect(hinge.children[0]!.getWorldPosition(new Vector3()).x).toBeLessThan(door.x - 0.4);
    const hand = new Object3D();
    front.takePackage(hand);
    expect(box.parent).toBe(hand);
    front.finish();
    front.object.updateMatrixWorld(true);
    expect(box.getWorldPosition(new Vector3()).x).toBeGreaterThan(door.x);
    expect(visitor.visible).toBe(false);
    front.arrive(); front.cancel();
    expect(box.visible).toBe(false);
    expect(hinge.rotation.y).toBe(0);
    front.dispose();
  });
});
