import {
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  type Texture,
} from 'three';
import {
  gardenTexture,
  latticePillowTexture,
  leafPillowTexture,
  rugTexture,
  wallArtTexture,
  woodFloorTexture,
} from './textures';

/** Metres covered by one tile of the floorboard texture. */
export const FLOOR_TILE = 1.44;

function mat(name: string, color: string, roughness: number, extra: MeshStandardMaterialParameters = {}) {
  const material = new MeshStandardMaterial({ color, roughness, ...extra });
  material.name = name;
  return material;
}

/** Textured where possible; plain colour where textures aren't available (unit tests). */
function textured(name: string, map: Texture | null, fallback: string, roughness: number) {
  return mat(name, map ? '#ffffff' : fallback, roughness, { map });
}

/**
 * The living room's palette: warm cream walls, a sage accent wall, honey-oak floor, oatmeal linen,
 * walnut, leaf greens and a little coral and mustard. It echoes the UI and Moke's real home.
 */
export function createRoomMaterials() {
  return {
    floor: textured('floor', woodFloorTexture(), '#c49c76', 0.75),
    wall: mat('wall', '#f2e6d4', 0.95),
    accentWall: mat('accentWall', '#d6dec9', 0.95),
    ceiling: mat('ceiling', '#f8f1e7', 1),
    trim: mat('trim', '#fbf6ee', 0.7),
    linen: mat('linen', '#d9ccb6', 1),
    linenLight: mat('linenLight', '#e2d7c4', 1),
    walnut: mat('walnut', '#80522f', 0.55),
    oak: mat('oak', '#c9a27a', 0.6),
    cream: mat('cream', '#efe7da', 0.8),
    brass: mat('brass', '#c29a55', 0.35, { metalness: 0.6 }),
    rug: textured('rug', rugTexture(), '#e3a58b', 1),
    runner: mat('runner', '#c9d3c1', 1),
    pillowLeaf: textured('pillowLeaf', leafPillowTexture(), '#4f9a72', 0.95),
    pillowLattice: textured('pillowLattice', latticePillowTexture(), '#a2a7aa', 0.95),
    pillowMustard: mat('pillowMustard', '#e3b45f', 0.95),
    tvBody: mat('tvBody', '#26262d', 0.5),
    tvScreen: mat('tvScreen', '#0d0e12', 0.12, { metalness: 0.2 }),
    lampShade: mat('lampShade', '#f8e6c8', 0.9, { emissive: '#ffcf8a', emissiveIntensity: 0.85, side: DoubleSide }),
    bulb: new MeshBasicMaterial({ color: '#fff3dc', name: 'bulb' }),
    terracotta: mat('terracotta', '#c96f4a', 0.85),
    ceramic: mat('ceramic', '#efe9e1', 0.5),
    soil: mat('soil', '#4b3526', 1),
    leafDark: mat('leafDark', '#2f7049', 0.7, { side: DoubleSide }),
    leafLight: mat('leafLight', '#4f9a68', 0.7, { side: DoubleSide }),
    stem: mat('stem', '#5f7f45', 0.8),
    bedBolster: mat('bedBolster', '#b7c2ae', 1),
    bedCushion: mat('bedCushion', '#f0e7da', 1),
    curtain: mat('curtain', '#eee2cc', 1, { side: DoubleSide }),
    art: textured('art', wallArtTexture(), '#f4ead9', 0.9),
    coral: mat('coral', '#e07b62', 0.8),
    navy: mat('navy', '#39465c', 0.8),
    leaf: mat('leaf', '#3f8c67', 0.8),
    mustard: mat('mustard', '#e3b45f', 0.8),
    mug: mat('mug', '#f3efe8', 0.4),
    door: mat('door', '#f6f1ea', 0.6),
    garden: (() => {
      const map = gardenTexture();
      return new MeshBasicMaterial({ name: 'garden', color: map ? '#ffffff' : '#cfe3c1', map });
    })(),
  };
}

export type RoomMaterials = ReturnType<typeof createRoomMaterials>;
