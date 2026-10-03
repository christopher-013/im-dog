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
  backyardSkyTexture,
  clockFaceTexture,
  doorSignTexture,
  flagstoneTexture,
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

/** A TV's picture: dark until TvChannels puts a show on it. */
function tvScreen(name: string): MeshBasicMaterial {
  return new MeshBasicMaterial({ name, color: '#15171c', toneMapped: false });
}

/** Metres covered by one tile of the backyard's flagstone texture. */
export const PATIO_TILE = 2.4;

/**
 * Outdoors, seen through the gym's glass doors: lit by the room's lights like everything else, plus a little of its
 * own colour as glow, so the yard reads as bright daylight without an extra (costly) light.
 */
function outdoor(name: string, color: string, roughness: number, extra: MeshStandardMaterialParameters = {}) {
  return mat(name, color, roughness, { emissive: color, emissiveIntensity: 0.42, ...extra });
}

/** Metres covered by one tile of the tile textures (arabesque, subway). */
export const TILE_REPEAT = 0.3;

/**
 * The living room's palette: warm cream walls, a sage accent wall, honey-oak floor, oatmeal linen,
 * walnut, leaf greens and a little coral and mustard. It echoes the UI.
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
    /** Each TV's picture (its own show, from TvChannels via Home), lit by itself like a real screen. */
    tvLiving: tvScreen('tvLiving'),
    tvFamily: tvScreen('tvFamily'),
    tvDining: tvScreen('tvDining'),
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
    /** The shadowy inside of the laundry basket's handle slots. */
    wickerShadow: mat('wickerShadow', '#4d3824', 1),
    door: mat('door', '#f6f1ea', 0.6),
    garden: (() => {
      const map = gardenTexture();
      return new MeshBasicMaterial({ name: 'garden', color: map ? '#ffffff' : '#cfe3c1', map });
    })(),

    // ---- The great room, dining room and kitchen (Phase 4): grey-oak planks, sage and
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
    /** His pink fleece bed by the fire (what was his pink blanket). */
    bedPinkBolster: mat('bedPinkBolster', '#eea7b5', 1),
    bedPinkCushion: mat('bedPinkCushion', '#f7d2d9', 1),
    bowlBlue: mat('bowlBlue', '#4d86c4', 0.45),
    roseGold: mat('roseGold', '#d9a592', 0.3, { metalness: 0.7 }),
    black: mat('black', '#222226', 0.55),
    firebox: mat('firebox', '#1e1b1a', 0.9),
    flame: new MeshBasicMaterial({ name: 'flame', color: '#ffb55e', transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }),
    backroom: mat('backroom', '#bcc1bb', 1),
    // The home gym: rubber mats, the bike, the weights, and the conure's cage.
    rubberMat: mat('rubberMat', '#2c2d31', 1),
    gymFrame: mat('gymFrame', '#34363b', 0.45, { metalness: 0.4 }),
    bikeRed: mat('bikeRed', '#b3322e', 0.4),
    dumbbell: mat('dumbbell', '#2a2a2e', 0.6),
    chrome: mat('chrome', '#d7dade', 0.2, { metalness: 0.9 }),
    screen: mat('screen', '#15171c', 0.25),
    cageMetal: mat('cageMetal', '#2f2824', 0.5, { metalness: 0.35 }),
    cagePaper: mat('cagePaper', '#cfe6ee', 1),
    perchWood: mat('perchWood', '#b88b58', 0.9),
    toyRed: mat('toyRed', '#c8323a', 0.6),
    toyYellow: mat('toyYellow', '#f0c93c', 0.6),
    toyTeal: mat('toyTeal', '#3aa6a0', 0.6),
    // The sliding glass doors to the backyard: warm off-white vinyl frames.
    doorFrame: mat('doorFrame', '#e6d2bd', 0.6),
    // The backyard, beyond the glass.
    patio: (() => {
      const map = flagstoneTexture();
      return outdoor('patio', map ? '#ffffff' : '#bfae94', 0.95, { map, emissive: map ? '#6a6258' : '#bfae94', emissiveMap: map });
    })(),
    lawn: outdoor('lawn', '#7aa55c', 1),
    hedge: outdoor('hedge', '#4d7a3e', 1),
    hedgeLight: outdoor('hedgeLight', '#6a9a50', 1),
    bougainvillea: outdoor('bougainvillea', '#e0467d', 0.9),
    trunk: outdoor('trunk', '#7b6a55', 1),
    fence: outdoor('fence', '#a08a70', 1),
    islandStone: outdoor('islandStone', '#c2ad8e', 1),
    travertine: outdoor('travertine', '#dccaa7', 0.8),
    grill: outdoor('grill', '#b9bdc2', 0.3, { metalness: 0.6, emissiveIntensity: 0.25 }),
    grillDark: outdoor('grillDark', '#3a3a3e', 0.6),
    chairCover: outdoor('chairCover', '#ece8df', 1),
    chairCoverHem: outdoor('chairCoverHem', '#9c8c78', 1),
    umbrella: outdoor('umbrella', '#f4f2ec', 0.95, { side: DoubleSide }),
    umbrellaPole: outdoor('umbrellaPole', '#ecebe6', 0.5),
    benchWood: outdoor('benchWood', '#4a3426', 0.9),
    cushionGrey: outdoor('cushionGrey', '#8e949b', 1),
    pillowCream: outdoor('pillowCream', '#e7e0d2', 1),
    loungeWicker: outdoor('loungeWicker', '#9a7a55', 1),
    loungeCushion: outdoor('loungeCushion', '#dcd9d2', 1),
    potWhite: outdoor('potWhite', '#f0efea', 0.6),
    potBlue: outdoor('potBlue', '#2f4f8a', 0.35),
    soilDark: outdoor('soilDark', '#4a3a2c', 1),
    propane: outdoor('propane', '#f2f2ef', 0.5),
    sky: (() => {
      const map = backyardSkyTexture();
      return new MeshBasicMaterial({ name: 'sky', color: map ? '#ffffff' : '#d6e4ea', map });
    })(),
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
