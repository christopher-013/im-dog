import {
  AdditiveBlending,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import type { ScentSource } from '../senses/ScentSystem';
import { FURNITURE, type HomePlace } from './home/places';
import { WING } from './home/layout';

/** What the human is doing that shows (or smells): from HumanActivityController.effect and its place. */
export interface HouseholdActivity {
  readonly effect: 'cooking' | 'meal' | 'tv' | null | undefined;
  readonly place: HomePlace | null;
}

/** The two TV screens, as the routine's `look` points name them, and where their glass is. */
const SCREENS = [
  { near: { x: 0.3, z: 2.77 }, center: new Vector3(0.3, 1.06, 2.772), width: 1.2, height: 0.67, facing: Math.PI },
  { near: { x: FURNITURE.fireplace.x, z: WING.south }, center: new Vector3(FURNITURE.fireplace.x, 1.92, WING.south - 0.069), width: 1.39, height: 0.77, facing: Math.PI },
];
const STOVE = new Vector3(7.02, 0.93, FURNITURE.range.z + 0.17);

/**
 * The little signs of someone living here (Phase 4): the TV glows while they watch, a pot steams on the stove
 * while they cook, and a plate of dinner sits on the table while they eat. Cooking and dinner smell of FOOD, for
 * Moke's nose (and his suspicions about the kitchen). Cheap: a few meshes shown and hidden, no lights.
 */
export class HouseholdEffects {
  readonly object = new Group();
  /** Dinner, on the stove or the table. */
  readonly foodScent: ScentSource;
  private readonly screens: Mesh[] = [];
  private readonly screenMaterial = new MeshBasicMaterial({ color: '#8fb7e8', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  private readonly pot = new Group();
  private readonly steam: Mesh[] = [];
  private readonly steamMaterial = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
  private readonly plate = new Group();
  private readonly geometries: BufferGeometry[] = [];
  private readonly materials: (MeshBasicMaterial | MeshStandardMaterial)[] = [];
  private readonly food = new Vector3();
  private foodOn = false;
  private time = 0;
  private screenGlow = 0;

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
    this.materials.push(this.screenMaterial, this.steamMaterial);

    for (const screen of SCREENS) {
      const mesh = new Mesh(g(new PlaneGeometry(screen.width, screen.height)), this.screenMaterial);
      mesh.position.copy(screen.center);
      mesh.rotation.y = screen.facing;
      mesh.visible = false;
      this.screens.push(mesh);
      this.object.add(mesh);
    }

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

    // Dinner: a plate of pasta and greens.
    const plate = new Mesh(g(new CylinderGeometry(0.12, 0.1, 0.015, 24)), m('#f4f0e8', 0.35));
    const pasta = new Mesh(g(new SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2)), m('#e7b458', 0.7));
    pasta.scale.set(1, 0.45, 1);
    pasta.position.y = 0.008;
    const greens = new Mesh(g(new SphereGeometry(0.03, 8, 6)), m('#5e9a4f', 0.8));
    greens.position.set(0.05, 0.02, 0.03);
    this.plate.add(plate, pasta, greens);
    this.plate.visible = false;
    this.object.add(this.plate);

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

    // The TV: the screen nearest what they're watching lights up, shifting colour like a show.
    const watching = effect === 'tv' && place?.look ? place.look : null;
    this.screenGlow = Math.max(0, Math.min(1, this.screenGlow + (watching ? dt : -dt) * 2));
    let nearest = -1;
    if (watching) {
      let best = Infinity;
      SCREENS.forEach((s, i) => {
        const d = Math.hypot(s.near.x - watching.x, s.near.z - watching.z);
        if (d < best) {
          best = d;
          nearest = i;
        }
      });
    }
    this.screens.forEach((screen, i) => (screen.visible = this.screenGlow > 0 && (i === nearest || (nearest < 0 && screen.visible))));
    if (this.screenGlow > 0) {
      const t = this.time;
      this.screenMaterial.color.setHSL((0.55 + 0.1 * Math.sin(t * 0.37) + 0.05 * Math.sin(t * 1.3)) % 1, 0.45, 0.45 + 0.08 * Math.sin(t * 2.1));
      this.screenMaterial.opacity = 0.55 * this.screenGlow;
    }

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

    this.foodOn = cooking || !!eating;
    if (cooking) this.food.copy(STOVE).setY(0);
    else if (eating && place.surface) this.food.set(place.surface.x, 0, place.surface.z);
  }

  dispose(): void {
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
    this.object.removeFromParent();
  }
}
