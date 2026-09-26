import {
  AdditiveBlending,
  DoubleSide,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type MeshStandardMaterialParameters,
  type Texture,
} from 'three';
import {
  arabesqueTileTexture,
  clockFaceTexture,
  doorSignTexture,
  gardenTexture,
  greyPlankTexture,
  latticePillowTexture,
  leafPillowTexture,
  rugTexture,
  subwayTileTexture,
  sunPatchTexture,
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

/** Metres covered by one tile of the tile textures (arabesque, subway). */
export const TILE_REPEAT = 0.3;

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
    wicker: mat('wicker', '#c9a26a', 0.95),
    wickerDark: mat('wickerDark', '#a7824f', 0.95),
    door: mat('door', '#f6f1ea', 0.6),
    garden: (() => {
      const map = gardenTexture();
      return new MeshBasicMaterial({ name: 'garden', color: map ? '#ffffff' : '#cfe3c1', map });
    })(),

    // ---- The great room, dining room and kitchen (Phase 4), from the home photos: grey-oak planks, sage and
    // greige walls, white shaker cabinets and quartz, stainless, a whitewashed table, cream and beige fabrics.
    floorGrey: textured('floorGrey', greyPlankTexture(), '#b4ada4', 0.7),
    wallSage: mat('wallSage', '#b9c3b2', 0.95),
    wallGreige: mat('wallGreige', '#d8cfc1', 0.95),
    cabinet: mat('cabinet', '#f3f1ec', 0.55),
    quartz: mat('quartz', '#f8f7f4', 0.22),
    stainless: mat('stainless', '#c7cacd', 0.32, { metalness: 0.75 }),
    steelDark: mat('steelDark', '#4f5358', 0.45, { metalness: 0.5 }),
    arabesque: textured('arabesque', arabesqueTileTexture(), '#e9ebea', 0.35),
    subway: textured('subway', subwayTileTexture(), '#f3f3f1', 0.3),
    knobRed: mat('knobRed', '#c4352c', 0.4),
    glass: mat('glass', '#cfe1e6', 0.05, { transparent: true, opacity: 0.22, depthWrite: false }),
    mirror: mat('mirror', '#e9eef0', 0.04, { metalness: 1 }),
    crystal: mat('crystal', '#ffffff', 0.08, { emissive: '#fff1d6', emissiveIntensity: 0.55 }),
    darkWood: mat('darkWood', '#4b3a2f', 0.7),
    whitewash: mat('whitewash', '#e2dbcd', 0.8),
    beigeFabric: mat('beigeFabric', '#cdbfa8', 1),
    creamBoucle: mat('creamBoucle', '#f1ebe0', 1),
    upholstery: mat('upholstery', '#dccfbb', 1),
    blanketPink: mat('blanketPink', '#f1b3bf', 1, { side: DoubleSide }),
    bowlBlue: mat('bowlBlue', '#4d86c4', 0.45),
    roseGold: mat('roseGold', '#d9a592', 0.3, { metalness: 0.7 }),
    black: mat('black', '#222226', 0.55),
    firebox: mat('firebox', '#1e1b1a', 0.9),
    flame: new MeshBasicMaterial({ name: 'flame', color: '#ffb55e', transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }),
    backroom: mat('backroom', '#bcc1bb', 1),
    clockFace: textured('clockFace', clockFaceTexture(), '#f3efe6', 0.8),
    doorSign: textured('doorSign', doorSignTexture(), '#efe6d6', 0.9),
    sunPatch: (() => {
      const map = sunPatchTexture();
      return new MeshBasicMaterial({
        name: 'sunPatch',
        color: '#ffe3b0',
        map,
        transparent: true,
        opacity: map ? 0.42 : 0.18,
        blending: AdditiveBlending,
        depthWrite: false,
      });
    })(),
  };
}

export type RoomMaterials = ReturnType<typeof createRoomMaterials>;
