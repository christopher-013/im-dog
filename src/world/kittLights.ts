import { AdditiveBlending, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { CARS } from '../config/cars';

/**
 * The scanner in the black car's nose (D37): a row of red lamps with one bright light sweeping across and back,
 * a fading trail behind it, and a soft glow round the slot. One small additive draw, driven only by `time`.
 */
export function kittScanner(): Mesh<PlaneGeometry, ShaderMaterial> {
  const s = CARS.kitt.scanner;
  const material = new ShaderMaterial({
    uniforms: { time: { value: 0 } },
    defines: { SEGMENTS: s.segments.toFixed(1), TRAIL: String(s.trail) },
    transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending, toneMapped: false,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float time;
      varying vec2 vUv;
      const float PERIOD = ${s.period.toFixed(3)};
      const float STEP = ${s.trailStep.toFixed(3)};
      // Where the light is (0..1 across), bouncing from end to end.
      float head(float t) { return 1.0 - abs(fract(t / PERIOD) * 2.0 - 1.0); }
      void main() {
        // The slot is the middle third of the plane's height; above and below it is only glow.
        float y = (vUv.y - 0.5) * 3.0;
        float seg = floor(vUv.x * SEGMENTS);
        float centre = (seg + 0.5) / SEGMENTS;
        float lit = 0.0;
        for (int i = 0; i < TRAIL; i++) {
          float h = head(time - float(i) * STEP);
          float near = 1.0 - smoothstep(0.35, 0.75, abs(h - centre) * SEGMENTS);
          lit = max(lit, near * exp(-float(i) * 0.55));
        }
        // Each lamp a rounded cell with a little gap between them; dim red when off.
        float cell = abs(fract(vUv.x * SEGMENTS) - 0.5);
        float inside = (1.0 - smoothstep(0.38, 0.47, cell)) * (1.0 - smoothstep(0.75, 1.0, abs(y)));
        float glow = exp(-y * y * 1.6) * lit * 0.55 * (1.0 - smoothstep(0.2, 0.5, abs(vUv.x - centre)));
        float core = inside * (0.06 + lit);
        vec3 color = vec3(1.0, 0.07, 0.03) * core * 1.6 + vec3(1.0, 0.45, 0.35) * pow(lit, 3.0) * inside * 0.6
          + vec3(1.0, 0.08, 0.02) * glow;
        gl_FragColor = vec4(color, 1.0);
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(s.width, s.height * 3), material);
  mesh.name = 'Scanner';
  mesh.castShadow = mesh.receiveShadow = false;
  return mesh;
}

/**
 * The voice box (D37): three columns of red bars that grow up and down from the middle as the car talks, the middle
 * one tallest. Talking for a few seconds every so often; dim when quiet. One small opaque draw, driven only by `time`.
 */
export function kittVoice(): Mesh<PlaneGeometry, ShaderMaterial> {
  const v = CARS.kitt.voice;
  const material = new ShaderMaterial({
    // `talk`: talking now regardless of the schedule (the cockpit scene), 0..1.
    uniforms: { time: { value: 0 }, talk: { value: 0 } },
    side: DoubleSide, toneMapped: false,
    vertexShader: `varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float time, talk;
      varying vec2 vUv;
      void main() {
        float cycle = mod(time, ${v.talkEvery.toFixed(2)});
        float talking = max(talk, smoothstep(0.0, 0.15, cycle) * (1.0 - smoothstep(${(v.talkFor - 0.2).toFixed(2)}, ${v.talkFor.toFixed(2)}, cycle)));
        // Syllables: a lively, uneven level while talking.
        // Syllables, and little pauses between words.
        float words = smoothstep(0.15, 0.35, abs(sin(time * 1.9)));
        float level = talking * words * (0.3 + 0.7 * abs(sin(time * 11.0) * sin(time * 6.7 + 1.3)));
        float column = floor(vUv.x * 3.0);
        float inColumn = abs(fract(vUv.x * 3.0) - 0.5);
        float reach = level * (column == 1.0 ? 1.0 : 0.62);
        float rows = 18.0;
        float row = abs(floor(vUv.y * rows) + 0.5 - rows * 0.5) / (rows * 0.5);
        float inRow = abs(fract(vUv.y * rows) - 0.5);
        float shape = (1.0 - step(0.3, inColumn)) * (1.0 - step(0.32, inRow));
        float on = step(row, reach + 0.04);
        vec3 color = vec3(1.0, 0.06, 0.03) * shape * (0.13 + on * 1.25);
        gl_FragColor = vec4(color, 1.0);
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(1, 1), material);
  mesh.name = 'Voice box';
  mesh.castShadow = mesh.receiveShadow = false;
  return mesh;
}
