import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSeaRoutes, type SeaPoint } from './world-sea-routes';

const ATTACK_INTERVAL = 30,
  ATTACK_DURATION = 9,
  SPEED = 0.035;
/** Real 3D sailing ships and an articulated kraken, sharing the atlas water plane. */
export function createWorldFleet(sampleHeight: (u: number, v: number) => number) {
  const group = new THREE.Group();
  group.name = 'world-pirate-fleet';
  const materials: THREE.Material[] = [],
    geometries: THREE.BufferGeometry[] = [];
  function material(color: string, extra: THREE.MeshStandardMaterialParameters = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.88, ...extra });
    materials.push(m);
    return m;
  }
  const wood = material('#513421'),
    deck = material('#8e6842'),
    trim = material('#bd9b65'),
    canvas = material('#c9b992', { side: THREE.DoubleSide }),
    dark = material('#252c2c'),
    rope = material('#473c2b'),
    skin = material('#3f6960'),
    suckers = material('#988c70');
  const foam = new THREE.MeshBasicMaterial({
    color: '#8cacaa',
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  materials.push(foam);
  function mesh(
    g: THREE.BufferGeometry,
    m: THREE.Material,
    parent: THREE.Object3D,
    x = 0,
    y = 0,
    z = 0,
  ) {
    geometries.push(g);
    const obj = new THREE.Mesh(g, m);
    obj.position.set(x, y, z);
    parent.add(obj);
    return obj;
  }
  function spar(
    parent: THREE.Object3D,
    a: THREE.Vector3,
    b: THREE.Vector3,
    r = 0.014,
    m: THREE.Material = wood,
  ) {
    const obj = mesh(new THREE.CylinderGeometry(r, r, b.distanceTo(a), 6), m, parent);
    obj.position.copy(a).add(b).multiplyScalar(0.5);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return obj;
  }
  function sail(parent: THREE.Object3D, y: number, z: number, width: number, height: number) {
    const g = new THREE.PlaneGeometry(width, height, 8, 6),
      p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        v = (p.getY(i) + height / 2) / height;
      p.setXYZ(
        i,
        x,
        Math.sin((x / width + 0.5) * Math.PI) * Math.sin(v * Math.PI) * 0.085,
        p.getY(i),
      );
    }
    g.computeVertexNormals();
    mesh(g, canvas, parent, 0, y, z);
    spar(
      parent,
      new THREE.Vector3(-width / 2, y, z + height / 2),
      new THREE.Vector3(width / 2, y, z + height / 2),
      0.012,
    );
  }
  function ship(index: number) {
    const obj = new THREE.Group();
    obj.name = 'pirate-ship-' + index;
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.47);
    shape.bezierCurveTo(0.19, 0.23, 0.17, -0.3, 0.11, -0.4);
    shape.lineTo(-0.11, -0.4);
    shape.bezierCurveTo(-0.17, -0.3, -0.19, 0.23, 0, 0.47);
    const hull = mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.14,
        bevelEnabled: true,
        bevelSize: 0.025,
        bevelThickness: 0.025,
        bevelSegments: 1,
        steps: 1,
      }),
      wood,
      obj,
      0,
      0,
      -0.075,
    );
    hull.name = 'wooden-hull';
    mesh(new THREE.ShapeGeometry(shape), deck, obj, 0, 0, 0.1);
    for (const side of [-1, 1])
      spar(
        obj,
        new THREE.Vector3(side * 0.14, -0.3, 0.12),
        new THREE.Vector3(side * 0.12, 0.28, 0.12),
        0.012,
        trim,
      );
    mesh(new THREE.BoxGeometry(0.2, 0.16, 0.09), wood, obj, 0, -0.3, 0.145);
    for (const [y, h, w] of [
      [-0.12, 0.68, 0.38],
      [0.18, 0.56, 0.31],
    ]) {
      spar(obj, new THREE.Vector3(0, y, 0.1), new THREE.Vector3(0, y, h));
      sail(obj, y, h - 0.14, w, 0.24);
      sail(obj, y, h - 0.37, w * 0.88, 0.18);
      for (const x of [-0.13, 0.13])
        spar(
          obj,
          new THREE.Vector3(x, y - 0.14, 0.12),
          new THREE.Vector3(0, y, h - 0.12),
          0.004,
          rope,
        );
    }
    spar(obj, new THREE.Vector3(0, 0.28, 0.12), new THREE.Vector3(0, 0.62, 0.23), 0.01);
    const flag = mesh(new THREE.PlaneGeometry(0.14, 0.09, 3, 1), dark, obj, 0.06, -0.12, 0.69);
    flag.rotation.x = Math.PI / 2;
    // Small crossed bones and skull, modelled rather than a raster overlay.
    spar(
      obj,
      new THREE.Vector3(0.02, -0.123, 0.67),
      new THREE.Vector3(0.1, -0.123, 0.71),
      0.004,
      trim,
    );
    spar(
      obj,
      new THREE.Vector3(0.02, -0.124, 0.71),
      new THREE.Vector3(0.1, -0.124, 0.67),
      0.004,
      trim,
    );
    mesh(new THREE.SphereGeometry(0.016, 6, 4), trim, obj, 0.06, -0.13, 0.71);
    const trail = new THREE.Shape();
    trail.moveTo(-0.045, -0.37);
    trail.bezierCurveTo(-0.06, -0.5, -0.16, -0.66, -0.22, -0.85);
    trail.lineTo(-0.16, -0.85);
    trail.bezierCurveTo(-0.11, -0.66, -0.025, -0.48, -0.02, -0.37);
    trail.closePath();
    const wake = mesh(new THREE.ShapeGeometry(trail), foam, obj, 0, 0, -0.015);
    const otherWake = mesh(new THREE.ShapeGeometry(trail), foam, obj, 0, 0, -0.014);
    otherWake.scale.x = -1;
    wake.name = 'ship-wake';
    // Batch static ship parts by material; flags and wake remain independent.
    const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
    for (const child of [...obj.children])
      if (child instanceof THREE.Mesh && child !== flag && child !== wake && child !== otherWake) {
        child.updateMatrix();
        const g = (
          child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
        ).applyMatrix4(child.matrix);
        const m = child.material as THREE.Material;
        const list = batches.get(m) || [];
        list.push(g);
        batches.set(m, list);
        obj.remove(child);
      }
    for (const [m, list] of batches) {
      const merged = mergeGeometries(list);
      list.forEach((g) => g.dispose());
      if (merged) {
        geometries.push(merged);
        const batch = new THREE.Mesh(merged, m);
        if (m === wood) batch.name = 'ship-woodwork';
        obj.add(batch);
      }
    }
    obj.scale.setScalar(0.85);
    group.add(obj);
    return { obj, flag, wake };
  }
  const routes = createSeaRoutes(sampleHeight);
  let routeSeed = 1;
  const anchorPoints = [
    { x: 2, y: -5 },
    { x: 6, y: -4 },
    { x: -12, y: 5 },
    { x: 11, y: 4 },
    { x: -8, y: -7 },
    { x: 14, y: -5 },
    { x: -3, y: 3 },
    { x: 3, y: 7 },
  ];
  const ships = Array.from({ length: 8 }, (_, i) => ({
    ...ship(i),
    route: [] as SeaPoint[],
    segment: 0,
    progress: 0,
    heading: 0,
    fade: 1,
  }));
  for (const [i, s] of ships.entries()) {
    s.route = routes.route(
      routeSeed++,
      anchorPoints[i],
      ships.slice(0, i).map((other) => ({ x: other.obj.position.x, y: other.obj.position.y })),
    );
    s.obj.visible = s.route.length > 1;
    if (s.route.length) s.obj.position.set(s.route[0].x, s.route[0].y, 0.04);
    if (s.route.length > 1) {
      s.heading = Math.atan2(-(s.route[1].x - s.route[0].x), s.route[1].y - s.route[0].y);
      s.obj.rotation.z = s.heading;
    }
  }
  const kraken = new THREE.Group();
  kraken.name = 'sea-kraken';
  kraken.visible = false;
  group.add(kraken);
  const head = mesh(new THREE.SphereGeometry(0.19, 12, 8), skin, kraken, 0, 0.14, -0.15);
  head.scale.set(0.85, 1.2, 0.8);
  for (const x of [-0.09, 0.09])
    mesh(new THREE.SphereGeometry(0.022, 6, 4), material('#c8a057'), kraken, x, 0.0, 0.015);
  // Reuse geometry for the joints and cups; update transforms, never rebuild meshes per frame.
  const jointGeo = new THREE.CylinderGeometry(1, 1, 1, 7),
    cupGeo = new THREE.SphereGeometry(1, 6, 4);
  geometries.push(jointGeo, cupGeo);
  const tentacles = Array.from({ length: 6 }, (_, i) => {
    const parts = Array.from({ length: 13 }, () => {
      const m = new THREE.Mesh(jointGeo, skin);
      kraken.add(m);
      return m;
    });
    const cups = Array.from({ length: 6 }, () => {
      const m = new THREE.Mesh(cupGeo, suckers);
      kraken.add(m);
      return m;
    });
    return { angle: (i / 6) * Math.PI * 2, parts, cups };
  });
  const ripple = mesh(new THREE.RingGeometry(0.45, 0.49, 48), foam, kraken, 0, 0, 0.015);
  const up = new THREE.Vector3(0, 1, 0),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    direction = new THREE.Vector3();
  let clock = 0,
    previous: number | undefined,
    nextAttack = ATTACK_INTERVAL,
    attackStart = -1,
    target = -1,
    attacks = 0;
  const smooth = (v: number) => {
    const t = THREE.MathUtils.clamp(v, 0, 1);
    return t * t * (3 - 2 * t);
  };
  function reset(s: (typeof ships)[number]) {
    s.route = routes.route(
      routeSeed++,
      anchorPoints[routeSeed % anchorPoints.length],
      ships
        .filter((other) => other !== s)
        .map((other) => ({ x: other.obj.position.x, y: other.obj.position.y })),
    );
    s.segment = 0;
    s.progress = 0;
    s.fade = 0;
    s.obj.visible = s.route.length > 1;
    if (s.route.length) s.obj.position.set(s.route[0].x, s.route[0].y, 0.04);
  }
  function tentaclePoint(
    angle: number,
    t: number,
    grip: number,
    emerge: number,
    out: THREE.Vector3,
  ) {
    const reach = 0.7 * (1 - t) + (0.12 + 0.12 * Math.sin(t * 8)) * t * grip;
    const curl = angle + Math.sin(t * Math.PI) * grip * 1.25;
    out.set(
      Math.cos(curl) * reach,
      Math.sin(curl) * reach,
      -0.13 + emerge * (Math.sin(t * Math.PI) * (0.35 + grip * 0.27) + t * 0.1),
    );
  }
  return {
    group,
    get state() {
      return {
        ships: ships.length,
        seconds: clock,
        attacks,
        attacking: target >= 0,
        positions: ships.map((s) => ({ x: s.obj.position.x, y: s.obj.position.y })),
      };
    },
    update(seconds: number, reduced = false) {
      if (reduced) {
        previous = seconds;
        return;
      }
      const dt = previous === undefined ? 0 : Math.min(0.15, Math.max(0, seconds - previous));
      previous = seconds;
      clock += dt;
      if (clock >= nextAttack && target < 0) {
        target = attacks % ships.length;
        attackStart = clock;
        nextAttack += ATTACK_INTERVAL;
        attacks++;
        kraken.position.set(ships[target].obj.position.x, ships[target].obj.position.y, 0);
        kraken.visible = true;
      }
      for (const [i, s] of ships.entries()) {
        if (i === target || s.route.length < 2) continue;
        let remaining = dt * SPEED;
        while (remaining > 0) {
          const start = s.route[s.segment],
            end = s.route[s.segment + 1],
            length = Math.hypot(end.x - start.x, end.y - start.y),
            step = Math.min(remaining, length - s.progress);
          s.progress += step;
          remaining -= step;
          if (s.progress >= length - 1e-5) {
            s.segment++;
            s.progress = 0;
            if (s.segment >= s.route.length - 1) {
              reset(s);
              break;
            }
          }
        }
        const start = s.route[s.segment],
          end = s.route[s.segment + 1];
        if (!end) continue;
        const angle = Math.atan2(-(end.x - start.x), end.y - start.y),
          delta = Math.atan2(Math.sin(angle - s.heading), Math.cos(angle - s.heading));
        s.heading += delta * Math.min(1, dt * 0.6);
        const t = s.progress / Math.hypot(end.x - start.x, end.y - start.y);
        s.obj.position.set(
          THREE.MathUtils.lerp(start.x, end.x, t),
          THREE.MathUtils.lerp(start.y, end.y, t),
          0.035 + Math.sin(clock * 0.8 + i) * 0.012,
        );
        s.obj.rotation.set(
          Math.sin(clock * 0.65 + i) * 0.025,
          Math.cos(clock * 0.53 + i) * 0.02,
          s.heading,
        );
        s.fade = Math.min(1, s.fade + dt * 0.4);
        s.obj.scale.setScalar(0.85 * s.fade);
        s.flag.rotation.z = Math.sin(clock * 0.55 + i) * 0.12;
      }
      if (target >= 0) {
        const t = clock - attackStart,
          emerge = smooth(t / 2) * (1 - smooth((t - 7) / 2)),
          grip = smooth((t - 1.8) / 2),
          sink = smooth((t - 3.2) / 3.8),
          s = ships[target];
        s.obj.position.z = 0.035 - sink * 1.05;
        s.obj.rotation.x = sink * 0.9;
        s.obj.rotation.y = Math.sin(t * 2) * 0.05 + sink * 0.25;
        s.obj.scale.setScalar(0.85 * (1 - smooth((t - 5.5) / 1.5)));
        s.obj.visible = t < 7;
        kraken.position.z = -sink * 0.22;
        head.position.z = -0.15 + emerge * 0.17;
        for (const tentacle of tentacles) {
          for (let j = 0; j < tentacle.parts.length; j++) {
            tentaclePoint(tentacle.angle, j / 13, grip, emerge, a);
            tentaclePoint(tentacle.angle, (j + 1) / 13, grip, emerge, b);
            const m = tentacle.parts[j],
              r = 0.05 * (1 - j / 15);
            m.position.copy(a).add(b).multiplyScalar(0.5);
            m.scale.set(r, a.distanceTo(b) + 0.008, r);
            m.quaternion.setFromUnitVectors(up, direction.copy(b).sub(a).normalize());
          }
          for (let j = 0; j < tentacle.cups.length; j++) {
            const m = tentacle.cups[j];
            tentaclePoint(tentacle.angle, (j + 3) / 13, grip, emerge, m.position);
            m.position.z -= 0.018;
            m.scale.setScalar(0.018 * (1 - j / 9));
          }
        }
        ripple.scale.setScalar(1 + t * 0.11);
        ripple.visible = t < 8;
        if (t >= ATTACK_DURATION) {
          kraken.visible = false;
          reset(s);
          target = -1;
        }
      }
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      group.clear();
    },
  };
}
