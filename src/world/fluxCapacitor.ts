import { AdditiveBlending, DoubleSide, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { CARS } from '../config/cars';

/** One small additive draw: moving charge, a breathing halo and local electrical filaments. */
export function fluxCapacitor(): Mesh<PlaneGeometry, ShaderMaterial> {
  const tuning = CARS.delorean.flux;
  const material = new ShaderMaterial({
    uniforms: { time: { value: 0 }, pulseRate: { value: tuning.pulseRate }, chargeRate: { value: tuning.chargeRate },
      brightness: { value: tuning.brightness } },
    transparent: true, depthWrite: false, side: DoubleSide, blending: AdditiveBlending, toneMapped: false,
    vertexShader: `varying vec2 point;
      void main() { point = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float time, pulseRate, chargeRate, brightness;
      varying vec2 point;
      vec2 branch(vec2 p, vec2 end) {
        float along = clamp(dot(p, end) / dot(end, end), 0.0, 1.0);
        return vec2(length(p - end * along), along);
      }
      void main() {
        float breathing = 0.65 + 0.35 * sin(time * pulseRate * 6.2831853);
        float core = 0.0, halo = 0.0, arc = 0.0;
        for (int i = 0; i < 3; i++) {
          vec2 end = i == 0 ? vec2(-0.52, 0.56) : (i == 1 ? vec2(0.52, 0.56) : vec2(0.0, -0.62));
          vec2 b = branch(point, end);
          float charge = pow(max(0.0, cos((b.y + time * chargeRate) * 6.2831853)), 12.0);
          core += exp(-b.x * b.x * 2400.0) * (0.35 + charge * 1.5);
          halo += exp(-b.x * b.x * 95.0) * (0.12 + charge * 0.35) * breathing;
          // Smoothly changing zigzag beside the tube. No per-frame randomness or on/off strobe.
          vec2 normal = normalize(vec2(-end.y, end.x));
          float zig = sin(b.y * 43.0 + time * 7.0 + float(i) * 2.1) *
            sin(b.y * 19.0 - time * 5.0) * 0.065 * sin(b.y * 3.14159);
          vec2 electric = branch(point + normal * zig, end);
          arc += exp(-electric.x * electric.x * 14000.0) * (0.3 + charge * 0.7);
        }
        float junction = exp(-dot(point, point) * 170.0) * (0.4 + breathing);
        vec3 color = vec3(0.22, 0.63, 1.0) * (halo + junction) + vec3(0.70, 0.90, 1.0) * core + vec3(0.5, 0.8, 1.0) * arc;
        gl_FragColor = vec4(color * brightness, 1.0);
      }`,
  });
  const mesh = new Mesh(new PlaneGeometry(...tuning.size), material);
  mesh.name = 'Animated flux capacitor';
  mesh.position.set(...tuning.position);
  mesh.castShadow = mesh.receiveShadow = false;
  return mesh;
}
