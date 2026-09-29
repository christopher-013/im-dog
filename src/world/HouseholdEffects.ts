import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { ScentSource } from '../senses/ScentSystem';
import { FURNITURE, type HomePlace } from './home/places';

/** What the human is doing that shows (or smells): from HumanActivityController.effect and its place. */
export interface HouseholdActivity {
  readonly effect: 'cooking' | 'meal' | 'tv' | 'prep' | null | undefined;
  readonly place: HomePlace | null;
}

const STOVE = new Vector3(7.02, 0.93, FURNITURE.range.z + 0.17);

/**
 * The little signs of someone living here (Phase 4): a pot steams on the stove while they cook, and a plate of dinner sits on the table while they eat. Cooking and dinner smell of FOOD, for
 * Moke's nose (and his suspicions about the kitchen). Cheap: a few meshes shown and hidden, no lights.
 */
export class HouseholdEffects {
  readonly object = new Group();
  /** Dinner, on the stove or the table. */
  readonly foodScent: ScentSource;
  private readonly pot = new Group();
  private readonly steam: Mesh[] = [];
  private readonly steamMaterial = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
  private readonly plate = new Group();
  private readonly chopping = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: (MeshBasicMaterial | MeshStandardMaterial)[] = [];
  private readonly food = new Vector3();
  private foodOn = false;
  private time = 0;

  constructor() {
    this.object.name = 'HouseholdEffects';
    const g = <T extends BufferGeometry>(geometry: T) => {
      this.geometries.push(geometry);
      return geometry;
    };
    const m = (color: string, roughness = 0.5, metalness = 0) => {
      const material = new MeshStandardMaterial({ color, roughness, metalness });
      this.materials.push(material);
      return material;
    };
    this.materials.push(this.steamMaterial);

    // A pot on the front burner (always there; it steams while they cook).
    const steel = m('#b9bec4', 0.3, 0.8);
    const pot = new Mesh(g(new CylinderGeometry(0.11, 0.1, 0.12, 20)), steel);
    pot.position.y = 0.06;
    const rim = new Mesh(g(new TorusGeometry(0.11, 0.008, 6, 20)), steel);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.12;
    const soup = new Mesh(g(new CylinderGeometry(0.1, 0.1, 0.005, 16)), m('#d98b4a', 0.6));
    soup.position.y = 0.105;
    const handle = new Mesh(g(new CylinderGeometry(0.01, 0.01, 0.16, 6)), m('#2b2b2f', 0.5));
    handle.rotation.z = Math.PI / 2;
    handle.position.set(0.18, 0.1, 0);
    this.pot.add(pot, rim, soup, handle);
    for (const mesh of this.pot.children) (mesh as Mesh).castShadow = true;
    this.pot.position.copy(STOVE);
    this.object.add(this.pot);
    const puff = g(new SphereGeometry(0.035, 8, 6));
    for (let i = 0; i < 5; i++) {
      const s = new Mesh(puff, this.steamMaterial);
      s.visible = false;
      this.steam.push(s);
      this.object.add(s);
    }

    // Dinner: a plate of pasta and meatballs, and greens.
    const plate = new Mesh(g(new CylinderGeometry(0.12, 0.1, 0.015, 24)), m('#f4f0e8', 0.35));
    const pasta = new Mesh(g(new SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), m('#e7b458', 0.7));
    pasta.scale.set(1, 0.45, 1);
    pasta.position.y = 0.008;
    const greens = new Mesh(g(new SphereGeometry(0.03, 8, 6)), m('#5e9a4f', 0.8));
    greens.position.set(0.05, 0.02, 0.03);
    const meatball = g(new SphereGeometry(0.018, 10, 8));
    const meatballMaterial = m('#7a4a32', 0.9);
    for (const [x, z] of [[-0.03, -0.02], [0.01, -0.045], [-0.045, 0.025]] as const) {
      const ball = new Mesh(meatball, meatballMaterial);
      ball.position.set(x, 0.03, z);
      this.plate.add(ball);
    }
    this.plate.add(plate, pasta, greens);
    this.plate.visible = false;
    this.object.add(this.plate);

    const board = new Mesh(g(new BoxGeometry(0.36, 0.022, 0.42)), m('#b58b58', 0.85));
    this.chopping.add(board);
    const carrotMaterial = m('#f39a38', 0.8);
    for (let i = 0; i < 5; i++) {
      const carrot = new Mesh(g(new CylinderGeometry(0.022, 0.022, 0.035, 10)), carrotMaterial);
      carrot.rotation.z = Math.PI / 2;
      carrot.position.set((i % 3 - 1) * 0.065, 0.035, Math.floor(i / 3) * 0.09 - 0.04);
      this.chopping.add(carrot);
    }
    this.chopping.visible = false;
    this.object.add(this.chopping);

    const effects = this;
    this.foodScent = {
      id: 'food:dinner',
      category: 'FOOD',
      label: 'Dinner',
      strength: 0.9,
      radius: 6,
      position: this.food,
      get enabled() {
        return effects.foodOn;
      },
    };
  }

  update(dt: number, activity: HouseholdActivity): void {
    this.time += dt;
    const { effect, place } = activity;

    // Cooking: steam rising from the pot.
    const cooking = effect === 'cooking';
    this.steam.forEach((puff, i) => {
      puff.visible = cooking;
      if (!cooking) return;
      const phase = (this.time * 0.6 + i / this.steam.length) % 1;
      puff.position.set(STOVE.x + Math.sin(this.time * 2 + i) * 0.03, STOVE.y + 0.14 + phase * 0.45, STOVE.z + Math.cos(this.time * 1.7 + i) * 0.03);
      puff.scale.setScalar(0.6 + phase * 1.6);
    });
    this.steamMaterial.opacity = 0.3;

    // Dinner on the table.
    const eating = effect === 'meal' && place?.surface;
    this.plate.visible = !!eating;
    if (eating && place.surface) this.plate.position.set(place.surface.x, place.surface.y + 0.008, place.surface.z);

    const prepping = effect === 'prep' && place?.surface;
    this.chopping.visible = !!prepping;
    if (prepping && place.surface) this.chopping.position.set(place.surface.x, place.surface.y + 0.016, place.surface.z);

    this.foodOn = cooking || !!eating || !!prepping;
    if (cooking) this.food.copy(STOVE).setY(0);
    else if (eating && place.surface) this.food.set(place.surface.x, 0, place.surface.z);
    else if (prepping && place.surface) this.food.set(place.surface.x, 0, place.surface.z);
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.object.removeFromParent();
  }
}
