import * as THREE from 'three';
import { makeGinnaTentacleCups } from './ginna-tentacle-cups';
import { createGinnaLakeEffects, drawGinnaLakeContact2D } from './ginna-lake-effects';

export const GINNA_TENTACLE_DURATION = 5600;
const TAU = Math.PI * 2;
const TURNS = 3.4;
const SEGMENTS = 224;
const SIDES = 28;
const LAKE = { x: 1008, y: 444 };
const clamp = (n: number) => THREE.MathUtils.clamp(n, 0, 1);
const ease = (n: number) => {
  const t = clamp(n);
  return t * t * (3 - 2 * t);
};

/** A vertical body axis, with the viewer inside it looking forward into the valley.
 * Front half-turns cross the view; the rear halves travel behind the viewer.
 * This is intentionally a cylindrical helix rather than a frontal screen spiral. */
function nearCenter(t: number, constriction: number, age: number, out: THREE.Vector3) {
  const radius = 1.85 - constriction;
  const angle0 = -1.11;
  const startX = Math.cos(angle0) * radius,
    startZ = Math.sin(angle0) * radius;
  if (t < 0.2) {
    const u = t / 0.2,
      v = 1 - u;
    out.set(
      2.55 * v ** 3 + 2.12 * 3 * v * v * u + (startX + 0.53) * 3 * v * u * u + startX * u ** 3,
      4.2 * v ** 3 + 2.84 * 3 * v * v * u + 1.04 * 3 * v * u * u + 0.86 * u ** 3,
      -6.6 * v ** 3 - 5 * 3 * v * v * u + (startZ + 0.26) * 3 * v * u * u + startZ * u ** 3,
    );
  } else {
    const u = (t - 0.2) / 0.8;
    const theta = angle0 - u * TAU * TURNS;
    // A small travelling muscle wave changes the shape, without rotating the coils.
    const flex = Math.sin(u * 13 - age * 2.1) * 0.025 * Math.sin(u * Math.PI);
    out.set(Math.cos(theta) * (radius + flex), 0.86 - u * 2.05, Math.sin(theta) * (radius + flex));
    out.y += Math.sin(u * 17 + age * 1.7) * 0.025 * Math.sin(u * Math.PI);
  }
  return out;
}

function farCenter(t: number, _tight: number, age: number, out: THREE.Vector3) {
  const v = 1 - t;
  out.set(
    v ** 3 * LAKE.x + 3 * v * v * t * 1150 + 3 * v * t * t * 790 + t ** 3 * 1080,
    941 - (v ** 3 * LAKE.y + 3 * v * v * t * 310 + 3 * v * t * t * 100 - t ** 3 * 180),
    -5,
  );
  out.x += Math.sin(t * 7 - age * 1.1) * Math.sin(t * Math.PI) * 6;
  return out;
}

type Centerline = typeof nearCenter;
type Tube = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
  update: (progress: number, tight: number, age: number) => void;
  sample: (
    t: number,
    progress: number,
    tight: number,
    age: number,
  ) => {
    point: THREE.Vector3;
    normal: THREE.Vector3;
    tangent: THREE.Vector3;
    binormal: THREE.Vector3;
    radius: number;
  };
};

function makeTube(
  line: Centerline,
  width: number,
  material: THREE.MeshPhysicalMaterial,
  segments = SEGMENTS,
  sides = SIDES,
): Tube {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((segments + 1) * (sides + 1) * 3);
  const normals = new Float32Array(positions.length);
  const uvs = new Float32Array((segments + 1) * (sides + 1) * 2);
  const indices: number[] = [];
  for (let i = 0; i < segments; i++)
    for (let j = 0; j < sides; j++) {
      const a = i * (sides + 1) + j,
        b = a + sides + 1;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  geometry.setIndex(indices);
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute(
    'normal',
    new THREE.BufferAttribute(normals, 3).setUsage(THREE.DynamicDrawUsage),
  );
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2).setUsage(THREE.DynamicDrawUsage));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const point = new THREE.Vector3(),
    before = new THREE.Vector3(),
    after = new THREE.Vector3();
  const normal = new THREE.Vector3(),
    tangent = new THREE.Vector3(),
    binormal = new THREE.Vector3();
  const sample = (t: number, progress: number, tight: number, age: number) => {
    line(t, tight, age, point);
    line(Math.max(0, t - 0.0005), tight, age, before);
    line(Math.min(1, t + 0.0005), tight, age, after);
    tangent.subVectors(after, before).normalize();
    if (line === nearCenter) normal.set(-point.x, 0, -point.z).normalize();
    else normal.set(0, 0, 1);
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    binormal.crossVectors(tangent, normal).normalize();
    // Most of the arm stays fleshy; only the actively advancing end tapers to a tip.
    const relative = clamp(t / Math.max(progress, 0.0001));
    const taper = 1 - relative ** 5;
    const radius = width * (0.78 + 0.22 * (1 - t)) * taper + width * 0.025;
    return { point, normal, tangent, binormal, radius };
  };
  const update = (progress: number, tight: number, age: number) => {
    mesh.visible = progress > 0.001;
    if (!mesh.visible) return;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * progress;
      const pose = sample(t, progress, tight, age);
      for (let j = 0; j <= sides; j++) {
        const phi = (j / sides) * TAU;
        const c = Math.cos(phi),
          s = Math.sin(phi);
        const k = (i * (sides + 1) + j) * 3;
        const nx = normal.x * c + binormal.x * s;
        const ny = normal.y * c + binormal.y * s;
        const nz = normal.z * c + binormal.z * s;
        // Broad muscle ridges underneath the microscopic photographed skin detail.
        const skin = 1 + Math.sin(phi * 7 + t * 19) * 0.012 + Math.cos(t * 127) * 0.006;
        positions[k] = point.x + nx * pose.radius * skin;
        positions[k + 1] = point.y + ny * pose.radius * skin;
        positions[k + 2] = point.z + nz * pose.radius * skin;
        normals[k] = nx;
        normals[k + 1] = ny;
        normals[k + 2] = nz;
        const uv = (i * (sides + 1) + j) * 2;
        uvs[uv] = t * (line === nearCenter ? 14 : 2.6);
        uvs[uv + 1] = j / sides;
      }
    }
    geometry.attributes.position.needsUpdate = true;
    geometry.attributes.normal.needsUpdate = true;
    geometry.attributes.uv.needsUpdate = true;
  };
  return { mesh, update, sample };
}

/** Flared, recessed cups with a raised lip and dark bowl; depth writes and shadows
 * make them adhere to the underside instead of looking like painted ellipses. */
function makeCups(tube: Tube, texture: THREE.Texture) {
  return makeGinnaTentacleCups(tube, texture);
}

function progression(milliseconds: number) {
  const far = ease(milliseconds / 1600);
  const near =
    milliseconds < 2700
      ? 0.2 * ease((milliseconds - 1500) / 1200)
      : 0.2 + 0.8 * ease((milliseconds - 2700) / 2900);
  const tight = ease((milliseconds - 3700) / 1900);
  return { far, near, tight, age: milliseconds / 1000 };
}

/** Read the existing scene's current transform, including its original animation
 * phase. The painted cover plane extends ten pixels past each viewport edge;
 * using that plane keeps the root planted in exactly the same patch of water. */
function createFarAlignment(host: HTMLElement, reduced: boolean) {
  const nightmare = host.ownerDocument.querySelector<HTMLElement>(
    '.ginna-vision[open] .ginna-nightmare-scene',
  );
  const landscape = nightmare?.querySelector<HTMLElement>('.ginna-vision-landscape');
  return () => {
    const hostRect = host.getBoundingClientRect();
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight);
    let scale = Math.max(width / 1672, height / 941);
    let centerX = width / 2,
      centerY = height / 2;
    let quake = 'none';
    let matrix = new DOMMatrixReadOnly();
    if (nightmare?.isConnected && landscape) {
      scale = parseFloat(getComputedStyle(landscape).width) / 1672;
      if (!reduced) {
        quake = getComputedStyle(nightmare).transform;
        if (quake !== 'none') matrix = new DOMMatrixReadOnly(quake);
        const rect = nightmare.getBoundingClientRect();
        centerX = rect.left + rect.width / 2 - hostRect.left;
        centerY = rect.top + rect.height / 2 - hostRect.top;
      } else {
        const parent = nightmare.parentElement!.getBoundingClientRect();
        centerX = parent.left + nightmare.offsetLeft + nightmare.clientWidth / 2 - hostRect.left;
        centerY = parent.top + nightmare.offsetTop + nightmare.clientHeight / 2 - hostRect.top;
      }
    }
    const a = matrix.a * scale,
      b = matrix.b * scale;
    const c = matrix.c * scale,
      d = matrix.d * scale;
    const x = centerX - a * 836 - c * 470.5;
    const y = centerY - b * 836 - d * 470.5;
    host.dataset.farQuake = quake;
    host.dataset.farQuakeX = matrix.e.toFixed(3);
    host.dataset.farQuakeY = matrix.f.toFixed(3);
    host.dataset.farPlane = [a, b, c, d, x, y].map((value) => value.toFixed(5)).join(',');
    return { a, b, c, d, x, y, scale, width, height };
  };
}

function waterRipples(milliseconds: number) {
  const age = milliseconds / 1000;
  return Array.from({ length: 4 }, (_, index) => {
    const time = (age - index * 0.24) / 1.85;
    const life = clamp(time);
    return {
      radius: 11 + life * 79,
      opacity: time < 0 || time >= 1 ? 0 : ease(age / 0.18) * (1 - ease((life - 0.65) / 0.35)),
      phase: index * 1.4 + age * 0.4,
    };
  });
}

export function createGinnaTentacleRenderer(host: HTMLElement, reduced = false) {
  let canvas = document.createElement('canvas');
  canvas.className = 'ginna-return-canvas';
  Object.assign(canvas.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
  host.append(canvas);
  const pressure = host.querySelector<HTMLElement>('.ginna-return-pressure');
  const alignFar = createFarAlignment(host, reduced);
  let frame = 0,
    released = false,
    disposed = false;
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
  } catch {
    // A photographic perspective fallback still completes the return on machines
    // without WebGL, without forcing motion on the reduced-motion path.
    canvas.remove();
    canvas = document.createElement('canvas');
    canvas.className = 'ginna-return-canvas';
    Object.assign(canvas.style, {
      position: 'absolute',
      inset: '0',
      width: '100%',
      height: '100%',
    });
    host.append(canvas);
    return createFallback(host, canvas, pressure, alignFar);
  }
  host.dataset.renderer = 'webgl';
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
  const nearScene = new THREE.Scene(),
    farScene = new THREE.Scene();
  const farGroup = new THREE.Group();
  farGroup.matrixAutoUpdate = false;
  farScene.add(farGroup);
  nearScene.fog = new THREE.FogExp2('#111519', 0.08);
  const camera = new THREE.PerspectiveCamera(58, 1, 0.04, 18);
  camera.position.set(0, 0, 0);
  camera.lookAt(0, 0, -1);
  const farCamera = new THREE.OrthographicCamera(0, 1, 1, 0, 0.1, 2000);
  farCamera.position.z = 1000;
  const hemisphere = new THREE.HemisphereLight('#9ba5b0', '#25211e', 0.85);
  nearScene.add(hemisphere);
  const key = new THREE.DirectionalLight('#d5d0c5', 3);
  key.position.set(-3, 4.5, 3);
  key.target.position.set(0, 0, -1);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = key.shadow.camera.bottom = -4;
  key.shadow.camera.right = key.shadow.camera.top = 4;
  key.shadow.camera.near = 0.1;
  key.shadow.camera.far = 14;
  key.shadow.normalBias = 0.013;
  key.shadow.bias = -0.0005;
  nearScene.add(key, key.target);
  const fill = new THREE.DirectionalLight('#8c9dab', 0.6);
  fill.position.set(3.5, 0.5, 1.6);
  nearScene.add(fill);
  farGroup.add(new THREE.HemisphereLight('#7e868d', '#13171d', 0.8));
  const farLight = new THREE.DirectionalLight('#bdc2c8', 1.8);
  farLight.position.set(650, 1150, 550);
  farLight.target.position.set(800, 850, -5);
  farGroup.add(farLight, farLight.target);

  const texture = new THREE.TextureLoader().load(
    '/atlas-model-materials/kraken-skin-v1.webp',
    (map) => {
      if (released) map.dispose();
    },
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const skin = new THREE.MeshPhysicalMaterial({
    color: '#b6b9b9',
    map: texture,
    bumpMap: texture,
    bumpScale: 0.026,
    roughness: 0.68,
    metalness: 0,
    clearcoat: 0.16,
    clearcoatRoughness: 0.52,
  });
  // Keep photographed pores while bringing the rust-colored atlas into the
  // charcoal, stone and muted cold light of the painted nightmare landscape.
  skin.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#include <map_fragment>
       float ginnaSkinLuma=pow(dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722)),0.76);
       diffuseColor.rgb=mix(diffuseColor.rgb,vec3(ginnaSkinLuma),0.94)*vec3(0.86,0.92,1.0);`,
    );
  };
  skin.customProgramCacheKey = () => 'ginna-photographic-skin-v1';
  const lakeAge = { value: 0 };
  const distantSkin = skin.clone();
  distantSkin.transparent = true;
  distantSkin.onBeforeCompile = (shader, renderer) => {
    skin.onBeforeCompile(shader, renderer);
    shader.uniforms.ginnaLakeAge = lakeAge;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vGinnaFarPosition; uniform float ginnaLakeAge;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGinnaFarPosition=position.xy;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vGinnaFarPosition; uniform float ginnaLakeAge;',
      )
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float waterline=${941 - LAKE.y}.0+sin((vGinnaFarPosition.x-${LAKE.x}.0)*0.38+ginnaLakeAge*3.0)*0.55;
        if(vGinnaFarPosition.y<waterline-1.2) discard;
        diffuseColor.a*=smoothstep(waterline-1.2,waterline+7.5,vGinnaFarPosition.y);`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float wetRoot=1.0-smoothstep(${941 - LAKE.y}.0,${941 - LAKE.y + 34}.0,vGinnaFarPosition.y);
        diffuseColor.rgb*=1.0-wetRoot*0.19;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,0.24,wetRoot*0.8);`,
      );
  };
  distantSkin.customProgramCacheKey = () => 'ginna-distant-lake-contact-v2';
  distantSkin.color.set('#747c84');
  distantSkin.bumpScale = 0.09;
  const near = makeTube(nearCenter, 0.37, skin);
  const far = makeTube(farCenter, 18, distantSkin, 96, 18);
  const cups = makeCups(near, texture);
  nearScene.add(near.mesh, cups.mesh);
  const lakeEffects = createGinnaLakeEffects(far.mesh.geometry, texture, LAKE);
  farGroup.add(far.mesh, lakeEffects.group);

  const resize = () => {
    if (released) return;
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    farCamera.left = 0;
    farCamera.right = width;
    farCamera.top = height;
    farCamera.bottom = 0;
    farCamera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();
  const draw = (milliseconds: number) => {
    if (released) return;
    const pose = progression(milliseconds);
    near.update(pose.near, pose.tight, pose.age);
    cups.update(pose.near, pose.tight, pose.age);
    host.dataset.cupCount = String(cups.stats.count);
    host.dataset.cupMinGap = cups.stats.minGap.toFixed(5);
    host.dataset.cupRequiredGap = cups.stats.requiredGap.toFixed(5);
    host.dataset.cupCollisionCount = String(cups.stats.collisions);
    host.dataset.cupRows = String(cups.stats.rows);
    host.dataset.cupDetail = 'polar-radial-wrinkles-pores';
    far.update(pose.far, 0, pose.age);
    lakeAge.value = milliseconds / 1000;
    lakeEffects.update(milliseconds);
    const plane = alignFar();
    farGroup.matrix.set(
      plane.a,
      -plane.c,
      0,
      plane.c * 941 + plane.x,
      -plane.b,
      plane.d,
      0,
      plane.height - plane.d * 941 - plane.y,
      0,
      0,
      plane.scale,
      0,
      0,
      0,
      0,
      1,
    );
    farGroup.matrixWorldNeedsUpdate = true;
    renderer.clear();
    renderer.render(farScene, farCamera);
    renderer.clearDepth();
    renderer.render(nearScene, camera);
    updateHooks(host, pressure, milliseconds, pose, ++frame);
  };
  const release = () => {
    if (released) return;
    released = true;
    observer.disconnect();
    near.mesh.geometry.dispose();
    far.mesh.geometry.dispose();
    cups.dispose();
    skin.dispose();
    distantSkin.dispose();
    texture.dispose();
    lakeEffects.dispose();
    key.shadow.map?.dispose();
    renderer.renderLists.dispose();
    renderer.dispose();
  };
  return {
    draw,
    release,
    dispose: () => {
      if (disposed) return;
      disposed = true;
      release();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

function updateHooks(
  host: HTMLElement,
  pressure: HTMLElement | null,
  milliseconds: number,
  pose: ReturnType<typeof progression>,
  frame: number,
) {
  host.dataset.stage =
    milliseconds < 1500 ? 'sky' : milliseconds < 2700 ? 'descending' : 'wrapping';
  host.dataset.progress = pose.near.toFixed(3);
  host.dataset.farProgress = pose.far.toFixed(3);
  host.dataset.frame = String(frame);
  host.dataset.turns = (Math.max(0, (pose.near - 0.2) / 0.8) * TURNS).toFixed(2);
  host.dataset.constriction = pose.tight.toFixed(3);
  host.dataset.origin = 'lake';
  host.dataset.originPoint = `${LAKE.x},${LAKE.y}`;
  const waves = waterRipples(milliseconds);
  host.dataset.waterRipples = String(waves.filter((wave) => wave.opacity > 0.01).length);
  host.dataset.waterDeformation = Math.max(...waves.map((wave) => wave.opacity)).toFixed(3);
  host.dataset.waterContact = 'wet-meniscus';
  host.dataset.waterReflection = 'deformed-tentacle';
  if (pressure) pressure.style.opacity = String(pose.tight * 0.75);
}

/** Same perspective projection and depth ordering when WebGL is unavailable. */
function createFallback(
  host: HTMLElement,
  canvas: HTMLCanvasElement,
  pressure: HTMLElement | null,
  alignFar: ReturnType<typeof createFarAlignment>,
) {
  host.dataset.renderer = 'canvas';
  const context = canvas.getContext('2d');
  const image = new Image();
  image.src = '/atlas-model-materials/kraken-skin-v1.webp';
  let released = false,
    frame = 0;
  const camera = new THREE.PerspectiveCamera(58, 1, 0.04, 18);
  camera.lookAt(0, 0, -1);
  camera.updateMatrixWorld();
  const tube = makeTube(nearCenter, 0.37, new THREE.MeshPhysicalMaterial(), 112, 18);
  const point = new THREE.Vector3();
  const draw = (milliseconds: number) => {
    if (released || !context) return;
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight);
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    const pose = progression(milliseconds);
    context.clearRect(0, 0, width, height);
    const plane = alignFar();
    const far = new THREE.Vector3();
    context.save();
    context.transform(plane.a, plane.b, plane.c, plane.d, plane.x, plane.y);
    context.beginPath();
    context.rect(0, -1000, 1672, LAKE.y + 1000);
    context.clip();
    for (let i = 0; i < 80; i++) {
      const a = (i / 80) * pose.far,
        b = ((i + 1) / 80) * pose.far;
      farCenter(a, 0, pose.age, far);
      context.globalAlpha = ease((far.y - (941 - LAKE.y) + 1.2) / 8.7);
      context.beginPath();
      context.moveTo(far.x, 941 - far.y);
      farCenter(b, 0, pose.age, far);
      context.lineTo(far.x, 941 - far.y);
      context.lineWidth = (1 - i / 80) * 36;
      context.strokeStyle = '#1c2125';
      context.lineCap = 'round';
      context.stroke();
    }
    context.restore();
    context.save();
    context.transform(plane.a, plane.b, plane.c, plane.d, plane.x, plane.y);
    drawGinnaLakeContact2D(
      context,
      LAKE,
      milliseconds,
      (t) => {
        farCenter(t, 0, pose.age, far);
        return { x: far.x, y: 941 - far.y };
      },
      pose.far,
    );
    for (const wave of waterRipples(milliseconds)) {
      if (wave.opacity <= 0) continue;
      context.beginPath();
      for (let i = 0; i <= 90; i++) {
        const angle = (i / 90) * TAU;
        const radius =
          wave.radius +
          Math.sin(angle * 7 + wave.phase) * 1.2 +
          Math.sin(angle * 13 - pose.age * 0.5) * 0.6;
        const x = LAKE.x + Math.cos(angle) * radius,
          y = LAKE.y + Math.sin(angle) * radius * 0.18;
        if (i) context.lineTo(x, y);
        else context.moveTo(x, y);
      }
      context.strokeStyle = `rgba(85,98,106,${wave.opacity * 0.34})`;
      context.lineWidth = 0.85;
      context.stroke();
    }
    context.restore();
    const rings: { z: number; polygon: { x: number; y: number }[] }[] = [];
    for (let i = 0; i < 180; i++) {
      const t = (i / 180) * pose.near,
        next = ((i + 1) / 180) * pose.near;
      const polygon: { x: number; y: number }[] = [];
      let z = 0,
        valid = true;
      for (const [u, side] of [
        [t, -1],
        [next, -1],
        [next, 1],
        [t, 1],
      ]) {
        const sample = tube.sample(u, pose.near, pose.tight, pose.age);
        // Silhouette sides lie perpendicular to the projected centerline.
        point.copy(sample.point).addScaledVector(sample.binormal, side * sample.radius);
        if (point.z >= -0.05) {
          valid = false;
          break;
        }
        z += point.z;
        point.project(camera);
        polygon.push({ x: (point.x * 0.5 + 0.5) * width, y: (-point.y * 0.5 + 0.5) * height });
      }
      if (valid) rings.push({ z, polygon });
    }
    rings.sort((a, b) => a.z - b.z);
    context.save();
    context.shadowColor = '#000';
    context.shadowBlur = 17;
    for (const ring of rings) {
      context.beginPath();
      ring.polygon.forEach((p, i) => (i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y)));
      context.closePath();
      context.fillStyle = '#343b40';
      context.fill();
      if (image.complete && image.naturalWidth) {
        context.save();
        context.clip();
        context.filter = 'grayscale(1) brightness(.52)';
        const pattern = context.createPattern(image, 'repeat');
        if (pattern) {
          pattern.setTransform(new DOMMatrix().scale(0.3));
          context.fillStyle = pattern;
          context.fill();
        }
        context.restore();
      }
    }
    context.restore();
    updateHooks(host, pressure, milliseconds, pose, ++frame);
  };
  const release = () => {
    released = true;
    tube.mesh.geometry.dispose();
    tube.mesh.material.dispose();
  };
  return {
    draw,
    release,
    dispose: () => {
      release();
      image.src = '';
      canvas.remove();
    },
  };
}
