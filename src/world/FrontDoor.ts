import { AdditiveBlending, BoxGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SphereGeometry, type Object3D } from 'three';
import type { Visit } from '../activities/DoorDelivery';
import { HALLOWEEN_VISIT } from '../config/halloween';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import { TrickOrTreaters } from './TrickOrTreaters';
import { createVisualState, HumanAnimationController } from '../human/HumanAnimationController';
import { COURIER_LOOK, StylizedHumanVisual } from '../human/StylizedHumanVisual';

/** Presentation only: gameplay owns the bell, acknowledgement and human handoff. */
export class FrontDoor {
  readonly object = new Group();
  private readonly hinge = new Group();
  private readonly visitor = new StylizedHumanVisual(COURIER_LOOK);
  private readonly animation = new HumanAnimationController();
  private readonly pose = createVisualState();
  private readonly package = new Group();
  private readonly bellLight = new MeshStandardMaterial({ color: '#ffe3a0', emissive: '#e5aa35' });
  private readonly doorSurface = new MeshStandardMaterial({ color: '#70939b', roughness: 0.8, emissive: '#ffd071', emissiveIntensity: 0 });
  private readonly doorInset = new MeshStandardMaterial({ color: '#eef0e4', roughness: 0.8, emissive: '#ffd071', emissiveIntensity: 0 });
  private readonly glowMaterial = new MeshBasicMaterial({ color: '#ffcf70', transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending });
  private readonly glow = new Group();
  private opened = false;
  private ringing = false;
  private time = 0;
  private label: CanvasTexture | null = null;
  /** Halloween (D30): the children on the doorstep, and the shelf by the door with the candy bowl and biscuit jar. */
  private readonly trickOrTreaters = new TrickOrTreaters();
  private readonly shelf = new Group();
  private readonly candyBowl = new Group();
  private readonly bowlOnShelf = { x: 0, y: 0, z: 0 };

  constructor() {
    const d = HOME_ACTIVITIES.delivery.door;
    this.object.name = 'Delivery door';
    this.hinge.name = 'Exterior door hinge';
    this.package.name = 'Amazon parcel';
    this.object.position.set(d.x, 0, d.z);
    this.object.rotation.y = Math.PI;
    const add = (parent: Object3D, size: [number, number, number], at: [number, number, number], material: MeshStandardMaterial) => {
      const mesh = new Mesh(new BoxGeometry(...size), material);
      mesh.position.set(...at);
      mesh.castShadow = true;
      parent.add(mesh);
    };
    this.hinge.position.set(0, 0, -d.width / 2);
    this.object.add(this.hinge);
    add(this.hinge, [0.065, d.height, d.width], [0, d.height / 2, d.width / 2], this.doorSurface);
    for (const y of [0.48, 1.38]) add(this.hinge, [0.075, 0.65, 0.81], [-0.012, y, d.width / 2], this.doorInset);
    // Four inexpensive additive strips make the whole doorway readable without a post-processing bloom pass.
    // They follow the hinged door, sit just inside the room, and never affect collisions or gameplay.
    this.glow.name = 'Doorbell glow';
    const edge = (size: [number, number, number], at: [number, number, number]) => {
      const mesh = new Mesh(new BoxGeometry(...size), this.glowMaterial);
      mesh.position.set(...at);
      mesh.castShadow = false;
      this.glow.add(mesh);
    };
    const front = -0.058;
    edge([0.012, d.height, 0.07], [front, d.height / 2, -0.005]);
    edge([0.012, d.height, 0.07], [front, d.height / 2, d.width + 0.005]);
    edge([0.012, 0.065, d.width + 0.08], [front, d.height - 0.015, d.width / 2]);
    edge([0.012, 0.065, d.width + 0.08], [front, 0.035, d.width / 2]);
    this.glow.visible = false;
    this.hinge.add(this.glow);
    add(this.hinge, [0.11, 0.04, 0.16], [-0.08, 1, d.width - 0.12], new MeshStandardMaterial({ color: '#b8975a', metalness: 0.6, roughness: 0.35 }));
    add(this.object, [0.025, 0.13, 0.07], [-0.085, 1.1, d.width / 2 + 0.13], this.bellLight);
    // A modest doorstep/view through the opened door, without adding an explorable outdoor room.
    add(this.object, [1.5, 0.08, 1.8], [0.75, -0.04, 0], new MeshStandardMaterial({ color: '#b5b2a4', roughness: 1 }));
    add(this.object, [0.05, 2.5, 1.8], [1.45, 1.25, 0], new MeshStandardMaterial({ color: '#97b6a0', roughness: 1 }));
    this.visitor.object.position.set(0.68, 0, 0);
    this.visitor.object.rotation.y = -Math.PI / 2;
    this.visitor.object.name = 'Amazon delivery person';
    this.visitor.object.visible = false;
    this.object.add(this.visitor.object);
    // Original parcel and plain word label; no downloaded branding or reference photos.
    add(this.package, [0.3, 0.23, 0.25], [0, 0, 0], new MeshStandardMaterial({ color: '#b58b59', roughness: 0.95 }));
    add(this.package, [0.055, 0.004, 0.255], [0, 0.118, 0], new MeshStandardMaterial({ color: '#dcc5a0', roughness: 1 }));
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 256; canvas.height = 96;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = '#b58b59'; context.fillRect(0, 0, 256, 96);
        context.fillStyle = '#243448'; context.font = 'bold 42px sans-serif'; context.textAlign = 'center';
        context.fillText('amazon', 128, 59);
        this.label = new CanvasTexture(canvas);
        const label = new Mesh(new PlaneGeometry(0.25, 0.09), new MeshBasicMaterial({ map: this.label }));
        label.position.set(0, 0, 0.126);
        this.package.add(label);
      }
    }
    this.package.visible = false;
    this.pose.pose = 'take';

    // Halloween: the children stand where the courier would, facing the door.
    this.trickOrTreaters.object.position.set(0.78, 0, 0);
    this.trickOrTreaters.object.rotation.y = -Math.PI / 2;
    this.object.add(this.trickOrTreaters.object);
    this.buildShelf(add);
  }

  arrive(visit: Visit = 'courier'): void {
    this.ringing = true;
    this.time = 0;
    this.setGlow(0.5);
    if (visit === 'trickOrTreat') {
      this.trickOrTreaters.show(true);
      return;
    }
    this.visitor.object.visible = true;
    this.visitor.hands.right.add(this.package);
    this.package.position.set(0, -0.02, 0.08);
    this.package.rotation.set(0, 0, 0);
    this.package.visible = true;
  }

  /** Halloween on or off: the shelf by the door (its candy bowl and biscuit jar) is only up for it. */
  setHalloween(on: boolean): void {
    this.shelf.visible = on;
  }

  /** The candy bowl into the human's hand, held out to the children, or back on its shelf (null). */
  holdCandy(hand: Object3D | null): void {
    if (hand) {
      hand.add(this.candyBowl);
      this.candyBowl.position.set(0, -0.03, 0.12);
    } else {
      this.shelf.add(this.candyBowl);
      this.candyBowl.position.set(this.bowlOnShelf.x, this.bowlOnShelf.y, this.bowlOnShelf.z);
    }
    this.candyBowl.rotation.set(0, 0, 0);
  }

  acknowledge(): void { this.ringing = false; this.setGlow(0); }
  open(on: boolean): void { this.opened = on; }

  takePackage(hand: Object3D): void {
    hand.add(this.package);
    this.package.position.set(0, -0.04, 0.1);
    this.package.rotation.set(0, 0, 0);
  }

  finish(): void {
    this.ringing = this.opened = false;
    this.setGlow(0);
    this.trickOrTreaters.show(false);
    if (!this.visitor.object.visible) return; // the trick-or-treaters left no parcel
    this.visitor.object.visible = false;
    this.object.add(this.package);
    this.package.position.set(-0.48, 0.12, -0.62);
    this.package.rotation.set(0, Math.PI / 2, 0);
  }

  cancel(): void {
    this.ringing = this.opened = false;
    this.setGlow(0);
    this.trickOrTreaters.show(false);
    this.visitor.object.visible = false;
    this.package.visible = false;
    this.hinge.rotation.y = 0;
  }

  update(dt: number): void {
    if (this.ringing) this.time += dt;
    const target = this.opened ? Math.PI / 2 : 0;
    this.hinge.rotation.y += (target - this.hinge.rotation.y) * Math.min(1, dt * 5);
    if (this.ringing) this.setGlow(0.5 + 0.5 * Math.sin(this.time * HOME_ACTIVITIES.delivery.glowCyclesPerSecond * 2 * Math.PI));
    if (this.visitor.object.visible) this.visitor.apply(dt, this.animation.update(dt, this.pose));
    this.trickOrTreaters.setExcited(this.opened);
    this.trickOrTreaters.update(dt);
  }

  /**
   * A little wall shelf between the window and the door (above the dog), with the candy bowl and a pumpkin-shaped
   * biscuit jar. In the door's own space: the door is turned round, so the room is toward -x.
   */
  private buildShelf(add: (parent: Object3D, size: [number, number, number], at: [number, number, number], material: MeshStandardMaterial) => void): void {
    const d = HOME_ACTIVITIES.delivery.door;
    const at = HALLOWEEN_VISIT.shelf;
    this.shelf.name = 'Halloween shelf';
    this.shelf.position.set(d.x - at.x, at.y, d.z - at.z);
    this.shelf.visible = false;
    this.object.add(this.shelf);
    add(this.shelf, [0.15, 0.025, 0.28], [0, 0, 0], new MeshStandardMaterial({ color: '#f2efe8', roughness: 0.7 }));
    // The candy bowl: a wide orange bowl heaped with wrapped sweets.
    const bowl = new Mesh(new CylinderGeometry(0.1, 0.06, 0.06, 20, 1, true), new MeshStandardMaterial({ color: '#ef7d18', roughness: 0.5, side: DoubleSide }));
    bowl.position.y = 0.03;
    this.candyBowl.add(bowl);
    const colours = ['#e8423f', '#f5c518', '#4aa0e6', '#8f4ad6', '#4fbf63', '#f2f2f2'];
    for (let i = 0; i < 12; i++) {
      const sweet = new Mesh(new SphereGeometry(0.018, 8, 6), new MeshStandardMaterial({ color: colours[i % colours.length], roughness: 0.4 }));
      const a = i * 2.4, r = 0.025 + (i % 3) * 0.022;
      sweet.position.set(Math.cos(a) * r, 0.055 + (i % 2) * 0.012, Math.sin(a) * r);
      sweet.scale.set(1.4, 0.8, 0.9);
      this.candyBowl.add(sweet);
    }
    // In the door's space +z points away from the door (toward the corner): the bowl nearest the door.
    this.bowlOnShelf.x = -0.005; this.bowlOnShelf.y = 0.012; this.bowlOnShelf.z = -0.05;
    this.holdCandy(null);
    // The biscuit jar: a small glass-lidded pumpkin.
    const jar = new Mesh(new SphereGeometry(0.055, 16, 12), new MeshStandardMaterial({ color: '#f08a24', roughness: 0.55 }));
    jar.scale.set(1, 0.8, 1);
    jar.position.set(0, 0.055, 0.085);
    const lid = new Mesh(new CylinderGeometry(0.012, 0.016, 0.03, 8), new MeshStandardMaterial({ color: '#3f6b2a', roughness: 0.8 }));
    lid.position.set(0, 0.11, 0.085);
    this.shelf.add(jar, lid);
  }

  private setGlow(pulse: number): void {
    this.glow.visible = this.ringing;
    this.glowMaterial.opacity = this.ringing ? 0.18 + 0.52 * pulse : 0;
    this.doorSurface.emissiveIntensity = this.ringing ? 0.25 + 0.9 * pulse : 0;
    this.doorInset.emissiveIntensity = this.ringing ? 0.18 + 0.65 * pulse : 0;
    this.bellLight.emissiveIntensity = this.ringing ? 0.5 + 1.3 * pulse : 0;
  }

  dispose(): void {
    this.visitor.object.removeFromParent();
    this.visitor.dispose();
    this.trickOrTreaters.dispose();
    this.holdCandy(null);
    this.object.add(this.package);
    this.object.traverse((node) => {
      if (node instanceof Mesh) {
        node.geometry.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((m) => m.dispose());
      }
    });
    this.label?.dispose();
    this.object.removeFromParent();
  }
}
