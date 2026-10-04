import * as THREE from 'three';

type CupTube = {
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
const PAIRS = 80;
const ARC_STEPS = 256;
// A visible strip of skin must remain between the complete raised cup meshes.
const MIN_GAP = 0.022;
const TAU = Math.PI * 2;
const profile = [
  [0, 0.018],
  [0.34, 0.018],
  [0.55, 0.03],
  [0.67, 0.09],
  [0.705, 0.16],
  [0.72, 0.24],
  [0.715, 0.28],
  [0.69, 0.32],
  [0.66, 0.344],
  [0.625, 0.356],
  [0.588, 0.348],
  [0.552, 0.318],
  [0.52, 0.274],
  [0.48, 0.205],
  [0.43, 0.154],
  [0.36, 0.11],
  [0.28, 0.08],
  [0.15, 0.068],
  [0, 0.063],
];
const smooth = (a: number, b: number, x: number) => {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function makeCupGeometry() {
  const geometry = new THREE.LatheGeometry(
    profile.map(([x, y]) => new THREE.Vector2(x, y)),
    40,
  );
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
  const colors = new Float32Array(positions.count * 3);
  const color = new THREE.Color();
  for (let i = 0; i < positions.count; i++) {
    const u = uv.getX(i),
      v = uv.getY(i),
      angle = u * TAU;
    const p = Math.round(v * (profile.length - 1));
    const interior = smooth(0.57, 0.72, v);
    const lip = Math.exp(-(((v - 0.49) / 0.1) ** 2));
    const wrinkle = Math.sin(angle * 23 + v * 2.7) + Math.sin(angle * 37 - v * 4) * 0.35;
    const radius = Math.hypot(positions.getX(i), positions.getZ(i));
    const irregularity = 1 + wrinkle * 0.009 * interior + Math.sin(angle * 11) * 0.006 * lip;
    positions.setX(i, positions.getX(i) * irregularity);
    positions.setZ(i, positions.getZ(i) * irregularity);
    positions.setY(
      i,
      positions.getY(i) +
        wrinkle * 0.012 * interior * radius +
        Math.sin(angle * 13 + 0.7) * 0.003 * lip,
    );
    color.set(
      p >= 14
        ? '#343b40'
        : p >= 11
          ? '#4e575c'
          : p >= 6
            ? '#798184'
            : p >= 3
              ? '#51595e'
              : '#363e41',
    );
    color.multiplyScalar(0.965 + Math.sin(angle * 7 + v * 13) * 0.035);
    colors.set([color.r, color.g, color.b], i * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  // The distance from the actual attachment origin encloses every displaced
  // vertex. Normal/bump maps do not change this conservative collision bound.
  let originRadius = 0;
  for (let i = 0; i < positions.count; i++) {
    originRadius = Math.max(
      originRadius,
      Math.hypot(positions.getX(i), positions.getY(i), positions.getZ(i)),
    );
  }
  return { geometry, originRadius };
}

/** Periodic polar UVs: u follows the lip, v travels down the recessed bowl. */
function makeCupDetails() {
  const side = 512;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = side;
  const context = canvas.getContext('2d')!;
  const pixels = context.createImageData(side, side);
  const hash = (x: number, y: number) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };
  for (let y = 0; y < side; y++) {
    const v = 1 - (y + 0.5) / side;
    const index = v * (profile.length - 1),
      lower = Math.floor(index);
    const radius = THREE.MathUtils.lerp(
      profile[lower][0],
      profile[Math.min(lower + 1, profile.length - 1)][0],
      index - lower,
    );
    const inner = smooth(0.57, 0.72, v);
    const lip = Math.exp(-(((v - 0.49) / 0.095) ** 2));
    for (let x = 0; x < side; x++) {
      const u = (x + 0.5) / side,
        angle = u * TAU;
      const folds = Math.sin(angle * 23 + Math.sin(angle * 5) * 0.85 + radius * 7);
      const fineFolds = Math.sin(angle * 61 + Math.sin(angle * 17) * 0.32 - radius * 13);
      const grain = hash(x, y) - 0.5;
      const pore = Math.max(0, hash(Math.floor(u * 128), Math.floor(radius * 130)) - 0.9) * 8;
      const growthRings = Math.sin(radius * 89 + Math.sin(angle * 9) * 0.75);
      const detail = THREE.MathUtils.clamp(
        0.5 +
          folds * inner * 0.115 +
          fineFolds * inner * 0.052 +
          growthRings * (0.025 + lip * 0.028) +
          grain * 0.055 -
          pore * 0.055,
        0.12,
        0.88,
      );
      const offset = (y * side + x) * 4;
      pixels.data[offset] =
        pixels.data[offset + 1] =
        pixels.data[offset + 2] =
          Math.round(detail * 255);
      pixels.data[offset + 3] = 255;
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

/** Suckers retain the photographed outer skin, while the lip and bowl gain
 * organic radial folds, porous detail and a restrained damp surface. */
export function makeGinnaTentacleCups(tube: CupTube, skinTexture: THREE.Texture) {
  const { geometry, originRadius } = makeCupGeometry();
  const details = makeCupDetails();
  const material = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    map: skinTexture,
    bumpMap: details,
    bumpScale: 0.018,
    roughness: 0.86,
    metalness: 0,
    clearcoat: 0.06,
    clearcoatRoughness: 0.74,
  });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.ginnaCupDetails = { value: details };
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D ginnaCupDetails;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        float cupLuma=pow(dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722)),0.72);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(cupLuma),0.95)*vec3(0.88,0.94,1.0);
        float cupDetail=texture2D(ginnaCupDetails,vMapUv).r;
        float cupDetailZone=smoothstep(0.18,0.32,vMapUv.y);
        diffuseColor.rgb*=mix(1.0,0.60+cupDetail*0.84,cupDetailZone);
        float cupBowl=smoothstep(0.58,0.76,vMapUv.y);
        vec3 bowlAlbedo=vec3(0.052,0.059,0.064)*(0.75+cupDetail*0.65);
        diffuseColor.rgb=mix(diffuseColor.rgb,bowlAlbedo,cupBowl*0.82);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        float cupWetDetail=texture2D(ginnaCupDetails,vMapUv).r;
        roughnessFactor=clamp(roughnessFactor+(cupWetDetail-0.5)*0.22,0.70,0.94);`,
      );
  };
  material.customProgramCacheKey = () => 'ginna-cup-polar-wrinkles-v2';
  const mesh = new THREE.InstancedMesh(geometry, material, PAIRS * 2);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  const lengths = new Float64Array(ARC_STEPS + 1);
  const params = new Float64Array(ARC_STEPS + 1);
  const previous = new THREE.Vector3();
  const normal = new THREE.Vector3(),
    side = new THREE.Vector3();
  const basis = new THREE.Matrix4(),
    matrix = new THREE.Matrix4();
  const candidates = Array.from({ length: PAIRS * 2 }, () => ({
    origin: new THREE.Vector3(),
    rotation: new THREE.Quaternion(),
    axes: new THREE.Vector3(),
    radius: 0,
    factor: 1,
    active: false,
  }));
  const stats = { count: 0, minGap: MIN_GAP, requiredGap: MIN_GAP, collisions: 0, rows: 2 };

  const parameterAt = (distance: number, total: number) => {
    const target = THREE.MathUtils.clamp(distance, 0, total);
    let low = 0,
      high = ARC_STEPS;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (lengths[mid] < target) low = mid;
      else high = mid;
    }
    const fraction = (target - lengths[low]) / Math.max(0.000001, lengths[high] - lengths[low]);
    return THREE.MathUtils.lerp(params[low], params[high], fraction);
  };

  const update = (progress: number, tight: number, age: number) => {
    const start = 0.065,
      end = Math.min(0.985, progress - 0.012);
    mesh.count = 0;
    mesh.visible = end > start;
    stats.count = stats.collisions = 0;
    stats.minGap = MIN_GAP;
    if (!mesh.visible) return;
    let averageRadius = 0;
    for (let i = 0; i <= ARC_STEPS; i++) {
      params[i] = THREE.MathUtils.lerp(start, end, i / ARC_STEPS);
      const pose = tube.sample(params[i], progress, tight, age);
      lengths[i] = i ? lengths[i - 1] + previous.distanceTo(pose.point) : 0;
      previous.copy(pose.point);
      averageRadius += pose.radius;
    }
    averageRadius /= ARC_STEPS + 1;
    const total = lengths[ARC_STEPS];
    const pairs = Math.min(
      PAIRS,
      Math.max(2, Math.floor(total / (averageRadius * 0.91 + MIN_GAP)) + 1),
    );
    const pitch = total / (pairs - 1);
    let count = 0;
    for (let i = 0; i < pairs; i++) {
      for (const row of [-1, 1]) {
        const distance = i * pitch + pitch * (row * 0.105 + Math.sin(i * 1.81) * 0.026);
        const t = parameterAt(distance, total);
        const pose = tube.sample(t, progress, tight, age);
        if (pose.radius < 0.035) continue;
        const candidate = candidates[count++];
        const angle = row * (0.59 + Math.sin(i * 0.69) * 0.025);
        normal
          .copy(pose.normal)
          .multiplyScalar(Math.cos(angle))
          .addScaledVector(pose.binormal, Math.sin(angle));
        side.crossVectors(pose.tangent, normal).normalize();
        basis.makeBasis(side, pose.tangent, normal);
        candidate.rotation.setFromRotationMatrix(basis);
        candidate.origin.copy(pose.point).addScaledVector(normal, pose.radius * 0.975);
        const size = pose.radius * (0.415 + Math.sin(i * 1.71 + row * 0.37) * 0.019);
        candidate.axes.set(size * (0.96 + Math.sin(i * 0.91) * 0.025), size * 1.055, size * 0.96);
        candidate.radius =
          originRadius * Math.max(candidate.axes.x, candidate.axes.y, candidate.axes.z);
        candidate.factor = 1;
        candidate.active = true;
      }
    }

    // Enclosing spheres constrain ALL neighbors, including different rows and
    // distinct coils. For each pair both radii shrink by at most (d-gap)/(ri+rj),
    // so their resulting sum is always <= d-gap, regardless of other constraints.
    for (let i = 0; i < count; i++) {
      if (!candidates[i].active) continue;
      for (let j = i + 1; j < count; j++) {
        if (!candidates[j].active) continue;
        const a = candidates[i],
          b = candidates[j],
          distance = a.origin.distanceTo(b.origin);
        if (distance <= MIN_GAP) {
          b.active = false;
          continue;
        }
        const factor = Math.min(1, (distance - MIN_GAP) / (a.radius + b.radius));
        a.factor = Math.min(a.factor, factor);
        b.factor = Math.min(b.factor, factor);
      }
    }
    let visible = 0,
      minGap = Infinity;
    for (let i = 0; i < count; i++) {
      const a = candidates[i];
      if (!a.active) continue;
      for (let j = i + 1; j < count; j++) {
        const b = candidates[j];
        if (!b.active) continue;
        const gap = a.origin.distanceTo(b.origin) - a.radius * a.factor - b.radius * b.factor;
        minGap = Math.min(minGap, gap);
        if (gap < MIN_GAP - 0.000001) stats.collisions++;
      }
      matrix.compose(a.origin, a.rotation, side.copy(a.axes).multiplyScalar(a.factor));
      mesh.setMatrixAt(visible++, matrix);
    }
    mesh.count = stats.count = visible;
    stats.minGap = Number.isFinite(minGap) ? minGap : MIN_GAP;
    mesh.visible = visible > 0;
    mesh.instanceMatrix.needsUpdate = true;
  };
  return {
    mesh,
    update,
    stats,
    dispose: () => {
      mesh.dispose();
      geometry.dispose();
      material.dispose();
      details.dispose();
    },
  };
}
