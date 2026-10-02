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
  const skin = new THREE.MeshStandardMaterial({ color: 0x3a443c, roughness: 0.67, metalness: 0 });
  const belly = new THREE.MeshStandardMaterial({ color: 0xab9270, roughness: 0.9 });
  const horn = new THREE.MeshStandardMaterial({ color: 0xc2af8a, roughness: 0.65 });
  const membrane = new THREE.MeshStandardMaterial({
    color: 0x665348,
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
    const geo = new THREE.SphereGeometry(1, 24, 16);
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
    mat = skin,
    tip = r * 0.72,
  ) {
    const geo = new THREE.CylinderGeometry(tip, r, from.distanceTo(to), 12);
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.clone().sub(from).normalize(),
    );
    parent.add(mesh);
    return mesh;
  }
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  ellipsoid(rigid, skin, 0, 0, 0, 0.19, 0.44, 0.18);
  ellipsoid(rigid, belly, 0, 0.02, -0.08, 0.14, 0.36, 0.1);
  bone(rigid, v(0, 0.25, 0.04), v(0, 0.67, 0.16), 0.115);
  ellipsoid(rigid, skin, 0, 0.7, 0.16, 0.13, 0.2, 0.12);
  ellipsoid(rigid, skin, 0, 0.84, 0.13, 0.1, 0.15, 0.075);
  ellipsoid(rigid, belly, 0, 0.82, 0.08, 0.088, 0.14, 0.025);
  for (const s of [-1, 1]) {
    ellipsoid(rigid, eye, s * 0.105, 0.75, 0.21, 0.025, 0.04, 0.022);
    bone(rigid, v(s * 0.085, 0.62, 0.23), v(s * 0.15, 0.42, 0.36), 0.034, horn, 0.002);
    // Tucked legs and three talons keep the flying silhouette readable.
    for (const y of [-0.25, 0.18]) {
      bone(rigid, v(s * 0.14, y, -0.04), v(s * 0.22, y - 0.15, -0.16), 0.055);
      bone(rigid, v(s * 0.22, y - 0.15, -0.16), v(s * 0.14, y - 0.27, -0.22), 0.032);
      for (let i = 0; i < 3; i++)
        bone(
          rigid,
          v(s * 0.14 + (i - 1) * 0.026, y - 0.26, -0.22),
          v(s * 0.14 + (i - 1) * 0.035, y - 0.32, -0.255),
          0.012,
          horn,
          0.001,
        );
    }
  }
  for (let i = 0; i < 8; i++) {
    const y = 0.54 - i * 0.13;
    bone(rigid, v(0, y, 0.16), v(0, y - 0.05, 0.27 - (i > 4 ? 0.04 : 0)), 0.034, horn, 0.001);
  }
  const wings: THREE.Group[] = [];
  for (const s of [-1, 1]) {
    const wing = new THREE.Group();
    wing.position.set(s * 0.12, 0.18, 0.08);
    dragon.add(wing);
    wings.push(wing);
    const wrist = v(s * 0.46, 0.2, 0.035);
    bone(wing, v(0, 0, 0), wrist, 0.045);
    const tips = [
      v(s * 1.13, 0.45, 0.025),
      v(s * 1.27, 0.04, 0.0),
      v(s * 1.03, -0.35, -0.02),
      v(s * 0.69, -0.6, -0.035),
      v(s * 0.25, -0.53, -0.02),
    ];
    for (const tip of tips) bone(wing, wrist, tip, 0.02, skin, 0.005);
    const positions: number[] = [];
    // Scalloped trailing edges and gently curved membrane panels.
    for (let i = 0; i < tips.length - 1; i++) {
      const a = tips[i],
        b = tips[i + 1];
      const edge = a.clone().add(b).multiplyScalar(0.5).lerp(wrist, 0.15);
      edge.z -= 0.055;
      const center = wrist
        .clone()
        .add(a)
        .add(b)
        .multiplyScalar(1 / 3);
      center.z -= 0.025;
      const ring = [wrist, a, edge, b];
      for (let j = 0; j < ring.length; j++)
        positions.push(
          ...center.toArray(),
          ...ring[j].toArray(),
          ...ring[(j + 1) % ring.length].toArray(),
        );
    }
    positions.push(...v(0, 0, 0).toArray(), ...wrist.toArray(), ...tips[4].toArray());
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
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
    bone(segment, v(0, 0, 0), v(0, -0.18, -0.015), 0.085 * (1 - i / 8), skin, 0.065 * (1 - i / 8));
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
