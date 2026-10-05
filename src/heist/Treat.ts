import { CapsuleGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3, type Object3D } from 'three';
import { HEIST } from '../config/heist';
import type { Interactable } from '../interactions/Interactable';
import type { AttentionTarget } from '../player/AttentionSystem';
import type { ScentSource } from '../senses/ScentSystem';

/** What each kind of treat is called (its smell, and "Eat …"). */
const TREAT_NAMES = { biscuit: 'Treat', carrot: 'Carrot', meatball: 'Meatball', patty: 'Hamburger Patty' } as const;

/** Where a treat is: still in the jar, in someone's hand, down on the floor for Moke, or eaten. */
export type TreatState = 'stored' | 'held' | 'placed' | 'eaten';

/**
 * A dog treat: a small bone-shaped biscuit. Reusable beyond Sock Heist (treat hunts, rewards): it has a type,
 * a reward value, a smell (sniff mode finds it), draws Moke's eye, and offers "Eat Treat" when it's on the
 * floor. The game decides what eating it means (`onEat`). No treat economy: one treat, one moment.
 */
export class Treat {
  readonly rewardValue = 1;
  state: TreatState = 'stored';
  readonly view: Group;
  /** World position (followed from the hand while held). */
  readonly position = new Vector3();
  readonly scent: ScentSource;
  readonly attention: AttentionTarget;
  readonly interactable: Interactable;
  /** Called when Moke eats it (Sock Heist listens). */
  onEat: (() => void) | null = null;

  constructor(
    readonly id = 'treat',
    /** How far its smell carries (m): further for a hidden one (Treat Hunt). */
    scentRadius = 6,
    readonly type: keyof typeof TREAT_NAMES = 'biscuit',
  ) {
    this.view = type === 'carrot' ? createCarrotView() : type === 'meatball' ? createMeatballView() : type === 'patty' ? createPattyView() : createTreatView();
    const name = TREAT_NAMES[type];
    this.view.visible = false;
    const treat = this;
    const smelly = () => treat.state === 'held' || treat.state === 'placed';
    this.scent = {
      id: `treat:${id}`,
      category: 'TREAT',
      label: name,
      strength: 1,
      radius: scentRadius,
      get position() {
        return treat.position;
      },
      get enabled() {
        return smelly();
      },
    };
    this.attention = {
      id: `treat:${id}`,
      kind: 'food',
      interest: 1.6,
      get position() {
        return treat.position;
      },
      get enabled() {
        return smelly();
      },
    };
    this.interactable = {
      id: `eat:${id}`,
      type: 'EAT',
      label: `Eat ${name}`,
      interactionDistance: HEIST.eatReach,
      get enabled() {
        return treat.state === 'placed';
      },
      get position() {
        return treat.position;
      },
      priority: 25,
      interact: () => this.eat(),
    };
  }

  /** Out of the jar and into a hand. */
  holdIn(hand: Object3D): void {
    this.state = 'held';
    hand.add(this.view);
    this.view.position.set(0, -0.02, 0.03);
    this.view.rotation.set(0, 0, Math.PI / 2);
    this.view.visible = true;
  }

  /** Back in the jar (an activity that handed it out ended or was called off). */
  reset(): void {
    this.state = 'stored';
    this.view.visible = false;
    this.view.removeFromParent();
  }

  /** Put down on the floor at `at`, under `parent` (the scene). */
  place(at: { x: number; z: number }, parent: Object3D): void {
    this.state = 'placed';
    parent.add(this.view);
    this.view.position.set(at.x, 0.012, at.z);
    this.view.rotation.set(0, Math.random() * Math.PI, 0);
    this.view.visible = true;
    this.position.set(at.x, 0, at.z);
  }

  eat(): void {
    if (this.state !== 'placed') return;
    this.state = 'eaten';
    this.view.visible = false;
    this.onEat?.();
  }

  /** A reward passed directly from the human's hand to Moke. No double consumption. */
  feed(): void {
    if (this.state !== 'held') return;
    this.state = 'eaten';
    this.view.visible = false;
    this.onEat?.();
  }

  /** Each frame: while in a hand, its smell and eye-catchingness follow the hand. */
  update(): void {
    if (this.state === 'held') this.view.getWorldPosition(this.position);
  }

  dispose(): void {
    this.view.traverse((node) => {
      if (node instanceof Mesh) {
        node.geometry.dispose();
        (node.material as MeshStandardMaterial).dispose();
      }
    });
    this.view.removeFromParent();
  }
}

/** A little bone biscuit, about 7 cm long (original, built in code). */
function createTreatView(): Group {
  const root = new Group();
  root.name = 'Treat';
  const material = new MeshStandardMaterial({ color: '#d49a55', roughness: 0.85 });
  const shaft = new Mesh(new CapsuleGeometry(0.011, 0.045, 4, 10), material);
  shaft.rotation.z = Math.PI / 2;
  shaft.castShadow = true;
  root.add(shaft);
  for (const x of [-0.03, 0.03]) {
    for (const z of [-0.011, 0.011]) {
      const knob = new Mesh(new SphereGeometry(0.013, 12, 8), material);
      knob.position.set(x, 0, z);
      knob.castShadow = true;
      root.add(knob);
    }
  }
  return root;
}

/** A meatball off the human's dinner plate, in tomato sauce. */
function createMeatballView(): Group {
  const root = new Group();
  root.name = 'Meatball';
  const ball = new Mesh(new SphereGeometry(0.017, 12, 9), new MeshStandardMaterial({ color: '#7a4a32', roughness: 0.9 }));
  ball.scale.set(1, 0.9, 1);
  const sauce = new Mesh(new SphereGeometry(0.0175, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), new MeshStandardMaterial({ color: '#b8372a', roughness: 0.5 }));
  root.add(ball, sauce);
  return root;
}

/** A small plain hamburger patty, the obstacle-course reward (Phase 5): browned, with grill lines across the top. */
function createPattyView(): Group {
  const root = new Group();
  root.name = 'Hamburger patty';
  const patty = new Mesh(new CylinderGeometry(0.04, 0.042, 0.016, 18), new MeshStandardMaterial({ color: '#6b3f26', roughness: 0.85 }));
  patty.position.y = 0.008;
  root.add(patty);
  const char = new MeshStandardMaterial({ color: '#3a2116', roughness: 0.9 });
  for (const x of [-0.02, 0, 0.02]) {
    const line = new Mesh(new CylinderGeometry(0.003, 0.003, 0.064 - Math.abs(x) * 1.2, 6), char);
    line.rotation.x = Math.PI / 2;
    line.position.set(x, 0.0165, 0);
    root.add(line);
  }
  return root;
}

function createCarrotView(): Group {
  const root = new Group();
  root.name = 'Carrot bite';
  const bite = new Mesh(new CylinderGeometry(0.018, 0.018, 0.028, 10), new MeshStandardMaterial({ color: '#f39a38', roughness: 0.8 }));
  bite.rotation.z = Math.PI / 2;
  root.add(bite);
  return root;
}
