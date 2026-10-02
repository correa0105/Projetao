import * as THREE from 'three';
import { detailAtlasMaterial } from './world-model-material';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/** Articulated dragon in the atlas XY plane, with Z as altitude. */
export function createWorldDragon(sampleHeight: (u: number, v: number) => number) {
  const group = new THREE.Group();
  group.name = 'world-flying-dragon';
  const dragon = new THREE.Group();
  group.add(dragon);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const skin = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.8,
  });
  const belly = new THREE.MeshStandardMaterial({ color: 0x93806b, roughness: 0.9 });
  const horn = new THREE.MeshStandardMaterial({ color: 0xada28c, roughness: 0.65 });
  const membrane = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.78,
    side: THREE.DoubleSide,
  });
  const eye = new THREE.MeshStandardMaterial({
    color: 0xf3b340,
    emissive: 0xa05510,
    emissiveIntensity: 0.12,
  });
  materials.push(skin, belly, horn, membrane, eye);
  detailAtlasMaterial(skin, 'scales');
  detailAtlasMaterial(belly, 'scales');
  detailAtlasMaterial(membrane, 'membrane');
  const rigid = new THREE.Group();
  dragon.add(rigid);
  function ellipsoid(
    parent: THREE.Group,
    mat: THREE.Material,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
  ) {
    const geo = new THREE.SphereGeometry(1, 64, 48);
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }
  function bone(
    parent: THREE.Group,
    from: THREE.Vector3,
    to: THREE.Vector3,
    r: number,
    mat: THREE.Material = skin,
    tip = r * 0.72,
  ) {
    const middle = from.clone().lerp(to, 0.52);
    middle.z += Math.min(0.03, from.distanceTo(to) * 0.08);
    return sweep(parent, [from, middle, to], [r, r * 0.86, tip], mat, 36, 20);
  }
  // Anatomical surfaces with smooth longitudinal profiles and stable skin UVs.
  function sweep(
    parent: THREE.Group,
    points: THREE.Vector3[],
    radii: number[],
    mat: THREE.Material = skin,
    rows = 72,
    sides = 40,
    flatten = 1,
  ) {
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
    const frames = curve.computeFrenetFrames(rows, false);
    const positions: number[] = [],
      uv: number[] = [],
      indices: number[] = [];
    for (let row = 0; row <= rows; row++) {
      const t = row / rows,
        center = curve.getPointAt(t),
        f = t * (radii.length - 1);
      const k = Math.min(radii.length - 2, Math.floor(f)),
        blend = f - k;
      const eased = blend * blend * (3 - 2 * blend);
      const r = THREE.MathUtils.lerp(radii[k], radii[k + 1], eased);
      for (let side = 0; side <= sides; side++) {
        const angle = (side / sides) * Math.PI * 2;
        const point = center
          .clone()
          .addScaledVector(frames.normals[row], Math.cos(angle) * r)
          .addScaledVector(frames.binormals[row], Math.sin(angle) * r * flatten);
        positions.push(point.x, point.y, point.z);
        uv.push(side / sides, t);
      }
    }
    for (let row = 0; row < rows; row++)
      for (let side = 0; side < sides; side++) {
        const n = row * (sides + 1) + side;
        indices.push(n, n + 1, n + sides + 1, n + 1, n + sides + 2, n + sides + 1);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    parent.add(mesh);
    return mesh;
  }
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  sweep(
    rigid,
    [
      v(0, -0.5, 0.015),
      v(0, -0.34, 0.02),
      v(0, -0.12, 0.035),
      v(0, 0.13, 0.05),
      v(0, 0.32, 0.1),
      v(0, 0.46, 0.13),
    ],
    [0.005, 0.145, 0.19, 0.225, 0.18, 0.105],
    skin,
    112,
    56,
    0.84,
  );
  ellipsoid(rigid, belly, 0, 0.02, -0.075, 0.135, 0.37, 0.08);
  sweep(
    rigid,
    [v(0, 0.35, 0.14), v(0, 0.52, 0.23), v(0, 0.72, 0.28), v(0, 0.91, 0.19)],
    [0.115, 0.105, 0.075, 0.095],
    skin,
    96,
    48,
  );
  ellipsoid(rigid, skin, 0, 0.91, 0.19, 0.105, 0.145, 0.088);
  sweep(
    rigid,
    [v(0, 0.97, 0.17), v(0, 1.06, 0.16), v(0, 1.17, 0.15), v(0, 1.195, 0.145)],
    [0.085, 0.078, 0.055, 0.012],
    skin,
    72,
    40,
    0.55,
  );
  ellipsoid(rigid, belly, 0, 1.015, 0.111, 0.071, 0.135, 0.023);
  const dark = new THREE.MeshStandardMaterial({ color: 0x100e09, roughness: 0.7 });
  materials.push(dark);
  for (const s of [-1, 1]) {
    ellipsoid(rigid, eye, s * 0.084, 0.948, 0.214, 0.012, 0.025, 0.012);
    ellipsoid(rigid, dark, s * 0.091, 0.951, 0.221, 0.003, 0.014, 0.007);
    ellipsoid(rigid, skin, s * 0.079, 0.926, 0.235, 0.025, 0.055, 0.012);
    ellipsoid(rigid, dark, s * 0.044, 1.125, 0.183, 0.01, 0.015, 0.004);
    sweep(
      rigid,
      [
        v(s * 0.074, 0.87, 0.252),
        v(s * 0.108, 0.76, 0.31),
        v(s * 0.13, 0.67, 0.34),
        v(s * 0.12, 0.62, 0.365),
      ],
      [0.03, 0.025, 0.014, 0.001],
      horn,
      48,
      24,
    );
    for (let tooth = 0; tooth < 5; tooth++)
      bone(
        rigid,
        v(s * 0.072, 1.02 + tooth * 0.023, 0.128),
        v(s * 0.064, 1.023 + tooth * 0.023, 0.109),
        0.004,
        horn,
        0.0005,
      );
    for (const y of [-0.26, 0.2]) {
      const rear = y < 0;
      ellipsoid(rigid, skin, s * 0.15, y, -0.01, rear ? 0.095 : 0.068, 0.13, 0.1);
      sweep(
        rigid,
        [
          v(s * 0.16, y, -0.02),
          v(s * 0.24, y - 0.08, -0.1),
          v(s * 0.23, y - 0.17, -0.17),
          v(s * 0.14, y - 0.28, -0.2),
        ],
        [rear ? 0.085 : 0.06, 0.061, 0.035, 0.02],
        skin,
        64,
        32,
      );
      ellipsoid(rigid, skin, s * 0.14, y - 0.28, -0.2, 0.038, 0.05, 0.025);
      for (let i = 0; i < 3; i++)
        sweep(
          rigid,
          [
            v(s * 0.14 + (i - 1) * 0.025, y - 0.28, -0.2),
            v(s * 0.14 + (i - 1) * 0.03, y - 0.33, -0.22),
            v(s * 0.14 + (i - 1) * 0.028, y - 0.36, -0.25),
          ],
          [0.011, 0.009, 0.0005],
          horn,
          24,
          16,
        );
    }
  }
  for (let i = 0; i < 13; i++) {
    const y = 0.76 - i * 0.095,
      z = y > 0.4 ? 0.25 : 0.205;
    sweep(
      rigid,
      [v(0, y, z), v(0, y - 0.032, z + 0.075), v(0, y - 0.07, z + 0.115)],
      [0.022, 0.014, 0.001],
      horn,
      24,
      16,
    );
  }
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 0.12, 0.18, 0.08);
    dragon.add(wing);
    wings.push(wing);
    const wrist = v(s * 0.46, 0.2, 0.035);
    sweep(wing, [v(0, 0, 0), v(s * 0.22, 0.04, 0.09), wrist], [0.07, 0.048, 0.033], skin, 64, 32);
    const tips = [
      v(s * 1.13, 0.45, 0.025),
      v(s * 1.27, 0.04, 0.0),
      v(s * 1.03, -0.35, -0.02),
      v(s * 0.69, -0.6, -0.035),
      v(s * 0.25, -0.53, -0.02),
      v(0, -0.38, -0.025),
    ];
    for (const tip of tips)
      sweep(
        wing,
        [
          wrist,
          wrist
            .clone()
            .lerp(tip, 0.45)
            .add(v(0, 0.018, 0.045)),
          tip,
        ],
        [0.022, 0.014, 0.0025],
        skin,
        56,
        20,
      );
    const positions: number[] = [],
      indices: number[] = [],
      uvs: number[] = [];
    // Subdivided curved membranes replace the flat triangular facets.
    const steps = 32;
    for (let panel = 0; panel < tips.length - 1; panel++) {
      const start = positions.length / 3;
      for (let row = 0; row <= steps; row++)
        for (let col = 0; col <= steps; col++) {
          const radius = row / steps,
            along = col / steps;
          const edge = tips[panel].clone().lerp(tips[panel + 1], along);
          edge.lerp(wrist, Math.sin(along * Math.PI) * 0.13);
          const point = wrist.clone().lerp(edge, radius);
          point.z -= Math.sin(radius * Math.PI) * Math.sin(along * Math.PI) * 0.09;
          positions.push(...point.toArray());
          uvs.push(Math.abs(point.x) / 1.4, (point.y + 0.65) / 1.2);
        }
      for (let row = 0; row < steps; row++)
        for (let col = 0; col < steps; col++) {
          const n = start + row * (steps + 1) + col;
          if (row > 0) indices.push(n, n + 1, n + steps + 1);
          indices.push(n + 1, n + steps + 2, n + steps + 1);
        }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    geometries.push(geo);
    wing.add(new THREE.Mesh(geo, membrane));
    bone(wing, wrist, wrist.clone().add(v(0, 0.1, 0.1)), 0.027, horn, 0.001);
  }
  const tail: THREE.Group[] = [];
  let parent = dragon;
  for (let i = 0; i < 7; i++) {
    const segment = new THREE.Group();
    segment.position.set(0, i === 0 ? -0.34 : -0.17, 0);
    parent.add(segment);
    tail.push(segment);
    sweep(
      segment,
      [v(0, 0, 0), v(0, -0.09, -0.008), v(0, -0.18, -0.015)],
      [0.085 * (1 - i / 8), 0.074 * (1 - i / 8), i === 6 ? 0.003 : 0.065 * (1 - i / 8)],
      skin,
      40,
      32,
    );
    if (i % 2 === 0) bone(segment, v(0, -0.08, 0.04), v(0, -0.15, 0.11), 0.025, horn, 0.001);
    parent = segment;
  }
  // Merge rigid meshes by material, leaving only the articulated joints separate.
  for (const mat of materials) {
    const parts: THREE.BufferGeometry[] = [];
    for (const child of [...rigid.children])
      if (child instanceof THREE.Mesh && child.material === mat) {
        child.updateMatrix();
        parts.push(child.geometry.clone().applyMatrix4(child.matrix));
        rigid.remove(child);
      }
    if (parts.length) {
      const merged = mergeGeometries(parts, false);
      parts.forEach((g) => g.dispose());
      if (merged) {
        geometries.push(merged);
        rigid.add(new THREE.Mesh(merged, mat));
      }
    }
  }
  dragon.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = false;
      obj.receiveShadow = true;
    }
  });
  dragon.scale.setScalar(0.38);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 64;
  shadowCanvas.height = 64;
  const ctx = shadowCanvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(32, 32, 4, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(20,24,20,.25)');
  gradient.addColorStop(1, 'rgba(20,24,20,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
  const shadowMaterial = new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent: true,
    depthWrite: false,
  });
  materials.push(shadowMaterial);
  const shadowGeometry = new THREE.PlaneGeometry(1.05, 0.61);
  geometries.push(shadowGeometry);
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  group.add(shadow);
  const state = { x: 0, y: 0, altitude: 0, flapping: false };
  return {
    group,
    state,
    update(seconds: number, reduced = false) {
      const t = reduced ? 0 : seconds;
      // A broad, smooth circuit over land and water, no abrupt wraparound.
      const a = t * 0.045;
      const x = 11 * Math.cos(a),
        y = 5.7 * Math.sin(a) + 0.8 * Math.sin(2 * a);
      const dx = -11 * Math.sin(a),
        dy = 5.7 * Math.cos(a) + 1.6 * Math.cos(2 * a);
      const terrain = sampleHeight((x + 18) / 36, (10.125 - y) / 20.25);
      const z = Math.max(2.6, terrain + 1.55) + 0.18 * Math.sin(t * 0.7);
      dragon.position.set(x, y, z);
      shadow.position.set(x + 0.35, y + 0.25, Math.max(0.025, terrain + 0.03));
      shadow.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
      dragon.rotation.z = Math.atan2(dy, dx) - Math.PI / 2;
      dragon.rotation.y = 0.1 * Math.sin(a);
      const phase = t % 9;
      // Three seconds of wingbeats, six of quiet gliding; envelope fades smoothly.
      const envelope = reduced ? 0 : phase < 3 ? Math.sin((Math.PI * phase) / 3) ** 2 : 0;
      const flap = 0.12 + envelope * 0.68 * Math.sin(t * 5.4);
      wings[0].rotation.y = flap;
      wings[1].rotation.y = -flap;
      wings.forEach((w) => {
        w.rotation.x = envelope * 0.06 * Math.cos(t * 5.4);
      });
      tail.forEach((segment, i) => {
        segment.rotation.z = 0.085 * Math.sin(t * 0.8 - i * 0.45);
        segment.rotation.x = 0.04 * Math.sin(t * 0.7 - i * 0.35);
      });
      state.x = x;
      state.y = y;
      state.altitude = z;
      state.flapping = envelope > 0.05;
    },
    dispose() {
      shadowTexture.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      group.clear();
    },
  };
}
