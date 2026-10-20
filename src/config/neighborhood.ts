/** Architectural differences, not recoloured copies of the player's house. No private addresses/signage. */
export const NEIGHBOR_PROFILES = {
  craftsman: { name: 'Sage Craftsman', width: 13.2, depth: 8, floors: 2, roof: 'cross', porch: 'railed',
    wall: 'neighborSage', roofPaint: 'roof', garageSide: -1, windowCount: 3, rise: 1.7 },
  villa: { name: 'Terracotta Villa', width: 12.8, depth: 8.5, floors: 2, roof: 'hip', porch: 'arch',
    wall: 'neighborPeach', roofPaint: 'neighborTile', garageSide: 1, windowCount: 4, rise: 1.15 },
  gables: { name: 'Ivory Twin Gables', width: 12.4, depth: 7.5, floors: 2, roof: 'double', porch: 'posts',
    wall: 'neighborCream', roofPaint: 'roof', garageSide: -1, windowCount: 3, rise: 1.9 },
  courtyard: { name: 'Sandstone Courtyard', width: 14, depth: 9, floors: 2, roof: 'hip', porch: 'court',
    wall: 'wall', roofPaint: 'neighborTile', garageSide: 1, windowCount: 5, rise: 0.85 },
  cottage: { name: 'Blue Cottage', width: 11.6, depth: 8, floors: 1, roof: 'gable', porch: 'railed',
    wall: 'neighborBlue', roofPaint: 'roof', garageSide: 1, windowCount: 2, rise: 1.65 },
  tower: { name: 'Cream Entry Tower', width: 12.5, depth: 8.5, floors: 2, roof: 'hip', porch: 'tower',
    wall: 'neighborCream', roofPaint: 'neighborTile', garageSide: -1, windowCount: 3, rise: 1.05 },
} as const;
export type NeighborStyle = keyof typeof NEIGHBOR_PROFILES;

/** Shared by the curb cuts, rendering and clearance tests. Local +z faces the street. */
export function neighborDriveway(style: NeighborStyle, scale: number, mirror = false) {
  const p = NEIGHBOR_PROFILES[style];
  return { x: p.garageSide * (mirror ? -1 : 1) * (p.width / 2 - 2.3) * scale, width: 4.8 * scale };
}
