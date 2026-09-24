import * as THREE from 'three';
import { WORLD_TERRITORIES } from './world-territories';
import { WORLD_ISLETS, FULKUSHIMA_ROCKS } from './world-offshore';

/** Small offshore landforms and the two maritime destinations, all real geometry/shaders. */
export function createWorldSeascape() {
  const group = new THREE.Group();
  group.name = 'world-seascape';
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const time = { value: 0 };
  const hover = { value: 0 };
  const stone = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  let disposed = false;
  const rockPhoto = new THREE.TextureLoader().load('/atlas-materials/rock-color.jpg', (texture) => {
    if (disposed) texture.dispose();
  });
  rockPhoto.wrapS = rockPhoto.wrapT = THREE.RepeatWrapping;
  rockPhoto.colorSpace = THREE.SRGBColorSpace;
  rockPhoto.anisotropy = 4;
  stone.onBeforeCompile = (shader) => {
    shader.uniforms.coastalRock = { value: rockPhoto };
    shader.uniforms.coastalHover = hover;
    shader.vertexShader =
      'attribute float coastalSelectable; varying float coastalSelection; varying vec3 coastalPosition;\n' +
      shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\ncoastalPosition = position; coastalSelection = coastalSelectable;',
    );
    shader.fragmentShader =
      'uniform sampler2D coastalRock; uniform float coastalHover; varying float coastalSelection; varying vec3 coastalPosition;\n' +
      shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `
      #include <color_fragment>
      vec3 rockSample = texture2D(coastalRock, coastalPosition.xy * 0.58).rgb * 0.65
        + texture2D(coastalRock, coastalPosition.xy * 1.7 + coastalPosition.z * 0.3).rgb * 0.35;
      float coastalGrain = dot(rockSample, vec3(0.2126, 0.7152, 0.0722));
      diffuseColor.rgb *= clamp(0.65 + coastalGrain * 1.55, 0.65, 1.3);
      // Match the mainland highlight across the entire island and its offshore rocks.
      diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.5 + vec3(0.13, 0.09, 0.035), coastalSelection * coastalHover * 0.55);
    `,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <normal_fragment_maps>',
      `
      #include <normal_fragment_maps>
      vec3 dx = dFdx(-vViewPosition), dy = dFdy(-vViewPosition);
      vec3 bx = cross(dy, normal), by = cross(normal, dx);
      float det = dot(dx, bx);
      normal = normalize(abs(det) * normal - sign(det) * 0.025 *
        (dFdx(coastalGrain) * bx + dFdy(coastalGrain) * by));
    `,
    );
  };
  materials.push(stone);

  function island(
    cx: number,
    cy: number,
    radius: number,
    peak: number,
    volcanic = false,
    selectable = volcanic,
  ) {
    const steps = volcanic ? 160 : 72,
      rings = volcanic ? 120 : 28,
      positions: number[] = [],
      colors: number[] = [],
      indices: number[] = [];
    const dark = new THREE.Color(volcanic ? '#666b60' : '#697166');
    const rock = new THREE.Color(volcanic ? '#939799' : '#92928a');
    const coast = new THREE.Color(volcanic ? '#7b7b70' : '#778276');
    const moss = new THREE.Color('#576c43');
    const color = new THREE.Color();
    for (let r = 0; r <= rings; r++) {
      const q = r / rings;
      for (let s = 0; s <= steps; s++) {
        const a = (s / steps) * Math.PI * 2;
        const irregular = 1 + 0.13 * Math.sin(a * 3 + cx) + 0.06 * Math.sin(a * 7 + cy);
        const crags = 0.9 + 0.055 * Math.sin(a * 13 + q * 8) + 0.045 * Math.cos(a * 21 - q * 4);
        const profile = volcanic
          ? Math.exp(-(((q - 0.14) / 0.18) ** 2)) * (1 - q) * 1.25
          : Math.pow(1 - q, 1.7);
        // A single continuous mesh joins the crater, eroded slopes, low hills and coast.
        const apron = volcanic
          ? 0.26 * Math.pow(1 - q, 0.65) +
            0.24 * Math.exp(-(((q - 0.6) / 0.23) ** 2)) * (0.5 + 0.5 * Math.sin(a * 3 + 1))
          : 0;
        const channels = volcanic
          ? Math.sin(a * 17 + q * 5) * Math.sin(a * 9 - q * 7) * 0.055 * Math.sin(q * Math.PI)
          : 0;
        let z = -0.06 + peak * profile * crags + apron + channels;
        if (volcanic && q < 0.12) {
          const crater = THREE.MathUtils.smoothstep(q, 0.065, 0.12);
          z = 1.04 + (z - 1.04) * crater;
        }
        positions.push(
          cx + Math.cos(a) * q * radius * irregular,
          cy + Math.sin(a) * q * radius * irregular * 0.8,
          z,
        );
        color
          .copy(dark)
          .lerp(rock, Math.max(0, profile * crags * 0.7))
          .lerp(coast, Math.pow(q, 12) * 0.65);
        if (volcanic)
          color.lerp(moss, Math.max(0, Math.sin(a * 3 + q * 4)) * Math.sin(q * Math.PI) * 0.55);
        const px = Math.cos(a) * q * radius,
          py = Math.sin(a) * q * radius;
        color.multiplyScalar(
          0.92 + 0.08 * Math.sin(px * 7.3 + Math.sin(py * 9)) * Math.cos(py * 6.1),
        );
        color.toArray(colors, colors.length);
        if (r && s) {
          const i = r * (steps + 1) + s;
          indices.push(i, i - steps - 2, i - 1, i, i - steps - 1, i - steps - 2);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute(
      'coastalSelectable',
      new THREE.Float32BufferAttribute(
        new Float32Array(positions.length / 3).fill(selectable ? 1 : 0),
        1,
      ),
    );
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, stone);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.name = volcanic ? 'fulkushima-volcano' : 'offshore-islet';
    group.add(mesh);
  }
  WORLD_ISLETS.forEach(([x, y, r, h]) => island(x, y, r, h));
  const volcano = WORLD_TERRITORIES.find((t) => t.id === 'fulkushima')!;
  const vx = (volcano.x - 0.5) * 36,
    vy = (0.5 - volcano.y) * 20.25;
  island(vx, vy, 2.9, 1.55, true);
  // Broken coastal shelves and sea stacks, without a decorative ring around the island.
  FULKUSHIMA_ROCKS.forEach(([x, y, r, h]) => island(vx + x, vy + y, r, h, false, true));
  const lavaMaterial = new THREE.MeshStandardMaterial({
    color: '#d85914',
    emissive: '#e7470d',
    emissiveIntensity: 0.75,
    roughness: 0.55,
  });
  materials.push(lavaMaterial);
  const lavaGeometry = new THREE.CircleGeometry(0.24, 64);
  geometries.push(lavaGeometry);
  const lava = new THREE.Mesh(lavaGeometry, lavaMaterial);
  lava.position.set(vx, vy, 1.065);
  group.add(lava);

  const storm = WORLD_TERRITORIES.find((t) => t.id === 'olho-da-tormenta')!;
  const stormMaterial = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uTime: time, uHover: { value: 0 } },
    vertexShader:
      'varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform float uHover;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);}
      void main(){
        vec2 p=(vUv-0.5)*2.0; float r=length(p),a=atan(p.y,p.x);
        float turn=uTime*0.085;
        vec2 flowing=mat2(cos(turn),-sin(turn),sin(turn),cos(turn))*p;
        float n=noise(flowing*9.0+uTime*0.055)*0.65+noise(flowing*24.0-uTime*0.035)*0.35;
        float spiral=sin(a*4.0+r*16.0-uTime*0.48+n*2.0)*0.5+0.5;
        float eye=smoothstep(0.12,0.29,r),rim=1.0-smoothstep(0.65,0.98,r);
        float alpha=eye*rim*(0.18+spiral*0.52+n*0.24);
        vec3 color=mix(vec3(0.13,0.23,0.29),vec3(0.63,0.70,0.71),spiral*n);
        gl_FragColor=vec4(color * (1.0 + uHover * 0.3),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  materials.push(stormMaterial);
  const stormGeometry = new THREE.PlaneGeometry(5.1, 5.1);
  geometries.push(stormGeometry);
  const stormMesh = new THREE.Mesh(stormGeometry, stormMaterial);
  stormMesh.position.set((storm.x - 0.5) * 36, (0.5 - storm.y) * 20.25, 0.12);
  stormMesh.name = 'eye-of-the-storm';
  stormMesh.renderOrder = 15;
  group.add(stormMesh);

  return {
    group,
    setHovered(id: string | null) {
      hover.value = id === 'fulkushima' ? 1 : 0;
      stormMaterial.uniforms.uHover.value = id === 'olho-da-tormenta' ? 1 : 0;
    },
    update(seconds: number) {
      time.value = seconds;
      lavaMaterial.emissiveIntensity = 0.72 + Math.sin(seconds * 0.8) * 0.1 + hover.value * 0.5;
    },
    dispose() {
      disposed = true;
      rockPhoto.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      group.clear();
    },
  };
}
