import { AdditiveBlending, BoxGeometry, CanvasTexture, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, type Object3D } from 'three';
import { HOME_ACTIVITIES } from '../config/homeActivities';
import { createVisualState, HumanAnimationController } from '../human/HumanAnimationController';
import { StylizedHumanVisual } from '../human/StylizedHumanVisual';

/** Presentation only: gameplay owns the bell, acknowledgement and human handoff. */
export class FrontDoor {
  readonly object = new Group();
  private readonly hinge = new Group();
  private readonly visitor = new StylizedHumanVisual(true);
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
  }

  arrive(): void {
    this.ringing = true;
    this.time = 0;
    this.setGlow(0.5);
    this.visitor.object.visible = true;
    this.visitor.hands.right.add(this.package);
    this.package.position.set(0, -0.02, 0.08);
    this.package.rotation.set(0, 0, 0);
    this.package.visible = true;
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
    this.visitor.object.visible = false;
    this.object.add(this.package);
    this.package.position.set(-0.48, 0.12, -0.62);
    this.package.rotation.set(0, Math.PI / 2, 0);
  }

  cancel(): void {
    this.ringing = this.opened = false;
    this.setGlow(0);
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
