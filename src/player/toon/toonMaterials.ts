import {
  BackSide,
  Color,
  MeshToonMaterial,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  type ColorRepresentation,
  type Mesh,
  type WebGLRenderer,
} from 'three';
import { MOKE_LOOK } from '../../config/mokeLook';

const OUTGOING_LIGHT = 'vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;';

const TOON_PARS = /* glsl */ `
uniform vec3 uLitColor;
uniform vec3 uShadeColor;
uniform vec3 uKeyDir;
uniform vec2 uKeyEdge;
uniform vec4 uRoomLight;
uniform vec3 uRimColor;
uniform vec2 uRim;

// Plain Lambert here: the room's lights only decide *how bright* Moke is; the cel look comes from the key light.
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
  return vec3( saturate( dot( normal, lightDirection ) ) );
}
`;

const SMOOTH_VERTEX_PARS = /* glsl */ `
#include <common>
#ifdef TOON_SMOOTH_NORMALS
  attribute vec3 smoothNormal;
  varying vec3 vSmoothNormal;
#endif
`;

const SMOOTH_VERTEX = /* glsl */ `
#include <defaultnormal_vertex>
#ifdef TOON_SMOOTH_NORMALS
  vSmoothNormal = normalMatrix * smoothNormal;
#endif
`;

const SMOOTH_FRAGMENT_PARS = /* glsl */ `
#include <common>
#ifdef TOON_SMOOTH_NORMALS
  varying vec3 vSmoothNormal;
  uniform float uTuftDetail;
#endif
`;

// Fur is lit mostly as its smooth underlying form, keeping a hint of each tuft.
const SMOOTH_FRAGMENT = /* glsl */ `
#include <normal_fragment_maps>
#ifdef TOON_SMOOTH_NORMALS
  normal = normalize( mix( normalize( vSmoothNormal ), normal, uTuftDetail ) );
#endif
`;

const TOON_SHADE = /* glsl */ `
  vec3 lumaW = vec3( 0.2126, 0.7152, 0.0722 );
  float albedoL = max( dot( diffuseColor.rgb, lumaW ), 1e-3 );
  float roomL = dot( reflectedLight.directDiffuse + reflectedLight.indirectDiffuse, lumaW ) / albedoL;
  float brightness = clamp( mix( 1.0, roomL / uRoomLight.x, uRoomLight.y ), uRoomLight.z, uRoomLight.w );
  float key = smoothstep( uKeyEdge.x - uKeyEdge.y, uKeyEdge.x + uKeyEdge.y, dot( normal, uKeyDir ) );
  float rim = pow( 1.0 - saturate( dot( normal, normalize( vViewPosition ) ) ), uRim.x ) * uRim.y;
  vec3 toon = diffuseColor.rgb * mix( uShadeColor, uLitColor, key ) + uRimColor * rim * ( 1.0 - 0.5 * key );
  vec3 outgoingLight = toon * brightness + totalEmissiveRadiance;
`;

/**
 * Anime cel shading: a two-tone lit/shade palette split by a soft character key light, plus a warm rim,
 * scaled by how much of the room's light reaches the surface (so the hallway and shadows still read).
 * Built on MeshToonMaterial so shadow maps and all room lights keep working.
 * With `smoothNormals`, geometry must carry the `smoothNormal` attribute (see `furClump`).
 */
export function createToonMaterial(
  lit: ColorRepresentation,
  shade: ColorRepresentation,
  { smoothNormals = false } = {},
): MeshToonMaterial {
  const { keyLight, roomLight, rim } = MOKE_LOOK;
  const material = new MeshToonMaterial({ color: '#ffffff' });
  // Display colours: skip tone mapping so white fur lands on screen as white.
  material.toneMapped = false;
  if (smoothNormals) material.defines = { TOON_SMOOTH_NORMALS: '' };
  const uniforms = {
    uTuftDetail: { value: MOKE_LOOK.tuftDetail },
    uLitColor: { value: new Color(lit) },
    uShadeColor: { value: new Color(shade) },
    uKeyDir: { value: new Vector3(...keyLight.direction).normalize() },
    uKeyEdge: { value: new Vector2(keyLight.center, keyLight.softness) },
    uRoomLight: { value: new Vector4(roomLight.reference, roomLight.influence, roomLight.min, roomLight.max) },
    uRimColor: { value: new Color(rim.color) },
    uRim: { value: new Vector2(rim.power, rim.strength) },
  };
  material.userData.toon = uniforms;
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    if (!shader.fragmentShader.includes(OUTGOING_LIGHT)) {
      throw new Error('Toon material: three.js toon shader changed; update toonMaterials.ts');
    }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', SMOOTH_VERTEX_PARS)
      .replace('#include <defaultnormal_vertex>', SMOOTH_VERTEX);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', SMOOTH_FRAGMENT_PARS)
      .replace('#include <normal_fragment_maps>', SMOOTH_FRAGMENT)
      .replace('#include <gradientmap_pars_fragment>', TOON_PARS)
      .replace(OUTGOING_LIGHT, TOON_SHADE);
  };
  material.customProgramCacheKey = () => 'moke-toon';
  return material;
}

/**
 * Ink outlines by the inverted-hull trick: the back faces of each fur mesh, pushed out along their
 * normals in screen space, so the line keeps an even width in pixels (thinning a little with distance).
 */
export function createOutlineMaterial(color: ColorRepresentation = MOKE_LOOK.palette.line): ShaderMaterial {
  const { outline } = MOKE_LOOK;
  return new ShaderMaterial({
    side: BackSide,
    uniforms: {
      uColor: { value: new Color(color) },
      uWidth: { value: outline.width },
      uScale: { value: new Vector2(outline.referenceDistance, outline.minScale) },
      uResolution: { value: new Vector2(1920, 1080) },
    },
    vertexShader: /* glsl */ `
      uniform float uWidth;
      uniform vec2 uScale;
      uniform vec2 uResolution;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
        vec2 dir = ( projectionMatrix * vec4( normalize( normalMatrix * normal ), 0.0 ) ).xy;
        dir *= uResolution;
        float len = length( dir );
        dir = len > 1e-6 ? dir / len : vec2( 0.0 );
        float px = uWidth * uResolution.y * clamp( uScale.x / max( clip.w, 1e-3 ), uScale.y, 1.0 );
        clip.xy += dir * px * 2.0 / uResolution * clip.w;
        gl_Position = clip;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4( uColor, 1.0 );
        #include <colorspace_fragment>
      }
    `,
  });
}

const drawingBuffer = new Vector2();

/** Keeps an outline mesh's width in step with the canvas size. */
export function trackOutlineResolution(mesh: Mesh, material: ShaderMaterial): void {
  mesh.onBeforeRender = (renderer: WebGLRenderer) => {
    (material.uniforms.uResolution!.value as Vector2).copy(renderer.getDrawingBufferSize(drawingBuffer));
  };
}
