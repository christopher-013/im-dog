import { Box3, Mesh, MeshStandardMaterial } from 'three';
import { describe, expect, it } from 'vitest';
import { NEIGHBOR_PROFILES, type NeighborStyle } from '../config/neighborhood';
import { DEPARTURE_HOME } from '../config/ride';
import { StaticSceneBuilder } from '../world/StaticSceneBuilder';
import { buildNeighbor } from './neighborHouses';

describe('visually varied neighboring homes', () => {
  const make = (style: NeighborStyle, background = false) => {
    const materials = Object.fromEntries(Object.entries(DEPARTURE_HOME.colors).map(([key, color]) => [key,
      new MeshStandardMaterial({ color }),
    ])) as Record<keyof typeof DEPARTURE_HOME.colors, MeshStandardMaterial>;
    const builder = new StaticSceneBuilder();
    buildNeighbor(builder, materials, { style, scale: 1, background }, 8.2);
    const group = builder.build('test house');
    let vertices = 0;
    group.traverse((o) => { if (o instanceof Mesh) vertices += o.geometry.attributes.position!.count; });
    const bounds = new Box3().setFromObject(group);
    group.traverse((o) => { if (o instanceof Mesh) o.geometry.dispose(); });
    for (const material of Object.values(materials)) material.dispose();
    return { vertices, bounds };
  };
  it('builds different geometry and roof silhouettes, not just colour/scale swaps', () => {
    const houses = (Object.keys(NEIGHBOR_PROFILES) as NeighborStyle[]).map((style) => make(style));
    expect(new Set(houses.map((h) => h.vertices)).size).toBe(6);
    expect(new Set(houses.map((h) => h.bounds.max.y.toFixed(2))).size).toBeGreaterThanOrEqual(5);
    expect(make('cottage').bounds.max.y).toBeLessThan(make('craftsman').bounds.max.y - 2);
  });
  it('omits small siding/railing/garage details for distant homes while retaining their silhouette', () => {
    const near = make('craftsman'), far = make('craftsman', true);
    expect(far.vertices).toBeLessThan(near.vertices * 0.8);
    expect(far.bounds.max.y).toBeCloseTo(near.bounds.max.y);
  });
});
