import * as THREE from 'three';

/** Windborne cloud banks above the atlas, independent of its terrain and camera. */
export function createWorldClouds() {
  const group = new THREE.Group();
  group.name = 'world-cloud-banks';
  const geometry = new THREE.PlaneGeometry(1, 1);
  const uniforms = { uTime: { value: 0 } };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 vUv;
      varying vec2 vWorld;
      void main() {
        vUv = uv;
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xy;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUv;
      varying vec2 vWorld;
      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x),
                   mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float sum = 0.0, amplitude = 0.55;
        for (int i = 0; i < 5; i++) {
          sum += noise(p) * amplitude;
          p = mat2(1.6, 1.2, -1.2, 1.6) * p + 7.3;
          amplitude *= 0.49;
        }
        return sum;
      }
      void main() {
        vec2 p = vWorld * 0.72 - vec2(uTime * 0.047, uTime * 0.013);
        vec2 distortion = vec2(fbm(p * 0.47 + uTime * 0.017), fbm(p * 0.47 + 9.1 - uTime * 0.012));
        float density = fbm(p + distortion * 2.4);
        vec2 centered = (vUv - 0.5) * 2.0;
        float edge = 1.0 - smoothstep(0.32, 1.0, length(centered));
        float alpha = smoothstep(0.31, 0.77, density) * edge * 0.51;
        // Leave the volcanic crater and the storm's own cloud spiral readable.
        float landmarkDistance = min(distance(vWorld, vec2(19.44, -5.8725)), distance(vWorld, vec2(-12.384, -3.50325)));
        alpha *= 1.0 - 0.65 * exp(-landmarkDistance * landmarkDistance / 5.0);
        float shade = fbm(p + vec2(-0.24, 0.31));
        vec3 color = mix(vec3(0.39, 0.48, 0.53), vec3(0.85, 0.89, 0.89),
                         smoothstep(0.29, 0.7, shade));
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(color, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  // Broad, staggered banks spread over the seas instead of tight rows of small clouds.
  const banks = [
    [-17, 9.5, 13, 7.5],
    [-4, 11.5, 11.5, 7],
    [11, 9, 14, 8],
    [-15, -7, 12.5, 7],
    [0, -9.5, 13, 7.5],
    [16, -6, 13.5, 8],
    [-2, 2.5, 10, 6],
    [14, 1, 10.5, 6.5],
    [-20, 0, 12, 7],
  ];
  const clouds = banks.map(([x, y, width, height], i) => {
    const cloud = new THREE.Mesh(geometry, material);
    cloud.name = `cloud-bank-${i}`;
    cloud.position.set(x, y, 2.35 + (i % 3) * 0.25);
    cloud.scale.set(width, height, 1);
    cloud.rotation.z = (i % 4) * 0.23 - 0.35;
    cloud.renderOrder = 20 + i;
    group.add(cloud);
    return { cloud, x, y, speed: 0.23 + (i % 3) * 0.024 };
  });
  return {
    group,
    update(time: number) {
      uniforms.uTime.value = time;
      for (const { cloud, x, y, speed } of clouds) {
        cloud.position.x = ((x + time * speed + 24) % 48) - 24;
        cloud.position.y = y + Math.sin(time * 0.038) * 0.3;
      }
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      group.clear();
    },
  };
}
