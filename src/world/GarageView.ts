import { BoxGeometry, BufferGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, type Material } from 'three';
import { GARAGE, WALL } from './home/layout';
import type { CarId } from '../config/cars';
import { createCar, nextRideCar } from './cars';
import type { RideCar } from './RideCar';

/**
 * The Garage's moving parts (Phase 6, D32): the door from the living room (locked in play: it only opens for a ride),
 * the roll-up door, the family car parked in the east bay, and a glimpse of the sunny driveway behind the roll-up door.
 * Presentation only: gameplay's doorway is a solid collider whatever this door shows (see LivingRoom).
 */
export class GarageView {
  readonly object = new Group();
  private currentCar: RideCar;
  get car(): RideCar { return this.currentCar; }
  private readonly houseDoor = new Group();
  private readonly rollUp = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: Material[] = [];
  private houseDoorOpen = 0;
  private rollUpOpen = 0;

  constructor(private readonly nextCar: CarId | (() => CarId) = nextRideCar) {
    // The garage is locked/hidden until the first ride. Don't spend a saved turn just by opening the start menu.
    this.currentCar = createCar(typeof nextCar === 'string' ? nextCar : 'family');
    this.object.name = 'Garage';
    const g = GARAGE;
    // The house door: white, panelled, hung on the east jamb, swinging into the garage.
    const d = g.houseDoor;
    const white = this.material(new MeshStandardMaterial({ color: '#f6f1ea', roughness: 0.6 }));
    const panel = this.material(new MeshStandardMaterial({ color: '#ebe4d9', roughness: 0.6 }));
    const brass = this.material(new MeshStandardMaterial({ color: '#b8975a', metalness: 0.6, roughness: 0.35 }));
    this.houseDoor.name = 'Garage door (house)';
    this.houseDoor.position.set(d.x + d.width / 2 - 0.01, 0, 3 + WALL / 2);
    this.object.add(this.houseDoor);
    const leaf = d.width - 0.02;
    this.box([leaf, d.height - 0.01, 0.045], [-leaf / 2, (d.height - 0.01) / 2, 0], white, this.houseDoor);
    for (const z of [0.026, -0.026]) {
      for (const y of [d.height * 0.28, d.height * 0.7]) this.box([leaf - 0.2, d.height * 0.34, 0.012], [-leaf / 2, y, z], panel, this.houseDoor);
      const knob = new Mesh(this.geometry(new SphereGeometry(0.03, 12, 8)), brass);
      knob.position.set(-leaf + 0.09, d.height * 0.48, z * 2);
      this.houseDoor.add(knob);
    }

    // The roll-up door: white sectional panels in the south wall's opening, rolling up out of sight.
    const r = g.rollUp;
    const door = this.material(new MeshStandardMaterial({ color: '#f3f2ee', roughness: 0.5 }));
    const groove = this.material(new MeshStandardMaterial({ color: '#d9d8d2', roughness: 0.6 }));
    this.rollUp.name = 'Roll-up door';
    this.rollUp.position.set((r.xMin + r.xMax) / 2, 0, g.zMax + 0.02);
    this.object.add(this.rollUp);
    const w = r.xMax - r.xMin;
    this.box([w, r.height, 0.05], [0, r.height / 2, 0], door, this.rollUp);
    for (let i = 1; i < 4; i++) this.box([w, 0.03, 0.06], [0, (r.height * i) / 4, 0], groove, this.rollUp);
    this.box([0.3, 0.035, 0.03], [0, 0.95, -0.04], groove, this.rollUp);

    // Outside: the driveway sloping down to the street, a lawn either side, a hedge and the bright sky.
    const concrete = this.material(new MeshStandardMaterial({ color: '#cfcac0', roughness: 0.95 }));
    const lawn = this.material(new MeshStandardMaterial({ color: '#7fae5a', roughness: 1 }));
    const hedge = this.material(new MeshStandardMaterial({ color: '#4f8a3e', roughness: 1 }));
    const sky = this.material(new MeshBasicMaterial({ color: '#cfe6f7' }));
    this.box([6.2, 0.1, 7], [0, -0.05, g.zMax + WALL + 3.5], concrete, this.object);
    for (const x of [-6.5, 6.5]) this.box([7, 0.1, 7], [x, -0.06, g.zMax + WALL + 3.5], lawn, this.object);
    this.box([20, 1.1, 0.8], [0, 0.55, g.zMax + 7.6], hedge, this.object);
    const backdrop = new Mesh(this.geometry(new PlaneGeometry(40, 14)), sky);
    backdrop.position.set(0, 6, g.zMax + 9);
    backdrop.rotation.y = Math.PI;
    this.object.add(backdrop);

    // The car, nose in toward the house, passenger side to the east wall.
    this.car.object.position.set(g.car.x, 0, g.car.z);
    this.car.object.rotation.y = g.car.heading;
    this.object.add(this.car.object);
  }

  /** Choose once at the start of boarding, behind the closed house door. Keep that car through the return. */
  prepareRide(): void {
    const id = typeof this.nextCar === 'string' ? this.nextCar : this.nextCar();
    if (id === this.car.id) return;
    this.car.dispose();
    this.currentCar = createCar(id);
    this.car.object.position.set(GARAGE.car.x, 0, GARAGE.car.z);
    this.car.object.rotation.y = GARAGE.car.heading;
    this.object.add(this.car.object);
  }

  /** The door from the living room: 0 shut, 1 open (swung into the garage). */
  setHouseDoor(open: number): void {
    this.houseDoorOpen = Math.min(1, Math.max(0, open));
    this.houseDoor.rotation.y = this.houseDoorOpen * 1.55;
  }

  /** The roll-up door: 0 down, 1 all the way up. */
  setRollUp(open: number): void {
    this.rollUpOpen = Math.min(1, Math.max(0, open));
    this.rollUp.position.y = this.rollUpOpen * (GARAGE.rollUp.height + 0.1);
    this.rollUp.visible = this.rollUpOpen < 0.999;
  }

  get houseDoorOpenness(): number {
    return this.houseDoorOpen;
  }

  get rollUpOpenness(): number {
    return this.rollUpOpen;
  }

  dispose(): void {
    this.car.dispose();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
    this.object.removeFromParent();
  }

  private box(size: [number, number, number], at: [number, number, number], material: Material, parent: Group): Mesh {
    const mesh = new Mesh(this.geometry(new BoxGeometry(...size)), material);
    mesh.position.set(...at);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  private geometry<T extends BufferGeometry>(geometry: T): T {
    this.geometries.push(geometry);
    return geometry;
  }

  private material<T extends Material>(material: T): T {
    this.materials.push(material);
    return material;
  }
}
