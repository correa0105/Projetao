import * as THREE from 'three';
import { detailAtlasMaterial } from './world-model-material';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSeaRoutes, type SeaPoint } from './world-sea-routes';

const ATTACK_INTERVAL = 30,
  SHIP_DESTROYED_AT = 7,
  AFTERMATH_DURATION = 3,
  ATTACK_DURATION = SHIP_DESTROYED_AT + AFTERMATH_DURATION,
  SPEED = 0.035,
  SHIP_SCALE = 0.75;
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
  const wood = material('#473629'),
    deck = material('#82705a'),
    trim = material('#777061', { metalness: 0.45, roughness: 0.62 }),
    canvas = material('#b9b5a5', { side: THREE.DoubleSide }),
    dark = material('#252c2c'),
    rope = material('#473c2b'),
    skin = material('#6b5148', { roughness: 0.48, metalness: 0 }),
    suckers = material('#ad9884', { roughness: 0.58 });
  // Surface detail follows the model, with no image pasted over the scene.
  for (const [m, kind] of [
    [wood, 'wood'],
    [deck, 'deck'],
    [canvas, 'cloth'],
    [skin, 'skin'],
  ] as const) {
    detailAtlasMaterial(m, kind);
  }
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
    const obj = mesh(new THREE.CylinderGeometry(r, r, b.distanceTo(a), 10), m, parent);
    obj.position.copy(a).add(b).multiplyScalar(0.5);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return obj;
  }
  function sail(parent: THREE.Object3D, y: number, z: number, width: number, height: number) {
    const g = new THREE.PlaneGeometry(width, height, 12, 10),
      p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i),
        v = (p.getY(i) + height / 2) / height;
      p.setXYZ(
        i,
        x * (0.86 + v * 0.14),
        Math.sin((x / width + 0.5) * Math.PI) * Math.sin(v * Math.PI) * 0.085,
        p.getY(i) + (1 - v) * Math.cos((x / width) * Math.PI) * 0.025,
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
        bevelSegments: 3,
        steps: 1,
      }),
      wood,
      obj,
      0,
      0,
      -0.075,
    );
    hull.name = 'wooden-hull';
    mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.024, bevelEnabled: false }),
      dark,
      obj,
      0,
      0,
      0.008,
    ).scale.set(1.025, 1.025, 1);
    mesh(new THREE.ShapeGeometry(shape), deck, obj, 0, 0, 0.1);
    for (const side of [-1, 1])
      spar(
        obj,
        new THREE.Vector3(side * 0.14, -0.3, 0.12),
        new THREE.Vector3(side * 0.12, 0.28, 0.12),
        0.012,
        trim,
      );
    for (const side of [-1, 1])
      for (const y of [-0.28, -0.16, -0.04, 0.08, 0.2]) {
        spar(
          obj,
          new THREE.Vector3(side * 0.14, y, 0.1),
          new THREE.Vector3(side * 0.14, y, 0.16),
          0.004,
          wood,
        );
      }
    mesh(new THREE.BoxGeometry(0.2, 0.16, 0.09), wood, obj, 0, -0.3, 0.145);
    for (const x of [-0.065, 0, 0.065]) {
      mesh(new THREE.BoxGeometry(0.035, 0.007, 0.035), dark, obj, x, -0.215, 0.158);
      mesh(new THREE.BoxGeometry(0.038, 0.009, 0.005), trim, obj, x, -0.213, 0.178);
    }
    mesh(new THREE.BoxGeometry(0.23, 0.17, 0.012), trim, obj, 0, -0.3, 0.197);
    for (const side of [-1, 1]) {
      for (const y of [-0.2, -0.055, 0.09]) {
        mesh(new THREE.BoxGeometry(0.009, 0.045, 0.027), dark, obj, side * 0.157, y, 0.073);
        spar(
          obj,
          new THREE.Vector3(side * 0.14, y, 0.071),
          new THREE.Vector3(side * 0.205, y, 0.071),
          0.008,
          dark,
        );
      }
    }
    const masts: THREE.Group[] = [];
    for (const [y, h, w] of [
      [-0.12, 0.68, 0.38],
      [0.18, 0.56, 0.31],
    ]) {
      const mast = new THREE.Group();
      mast.name = 'breakable-mast';
      mast.position.set(0, y, 0.1);
      obj.add(mast);
      masts.push(mast);
      spar(mast, new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, h - 0.1));
      sail(mast, 0, h - 0.24, w, 0.24);
      sail(mast, 0, h - 0.47, w * 0.88, 0.18);
      for (const x of [-0.13, 0.13])
        spar(
          mast,
          new THREE.Vector3(x, -0.14, 0.02),
          new THREE.Vector3(0, 0, h - 0.22),
          0.004,
          rope,
        );
    }
    for (const side of [-1, 1]) {
      spar(
        obj,
        new THREE.Vector3(side * 0.13, -0.3, 0.14),
        new THREE.Vector3(0, -0.12, 0.68),
        0.0025,
        rope,
      );
      spar(
        obj,
        new THREE.Vector3(side * 0.11, 0.25, 0.14),
        new THREE.Vector3(0, 0.18, 0.56),
        0.0025,
        rope,
      );
    }
    spar(obj, new THREE.Vector3(0, 0.28, 0.12), new THREE.Vector3(0, 0.62, 0.23), 0.01);
    const flag = mesh(new THREE.PlaneGeometry(0.14, 0.09, 3, 1), dark, masts[0], 0.06, 0, 0.59);
    flag.rotation.x = Math.PI / 2;
    // Small crossed bones and skull, modelled rather than a raster overlay.
    spar(
      masts[0],
      new THREE.Vector3(0.02, -0.003, 0.57),
      new THREE.Vector3(0.1, -0.003, 0.61),
      0.004,
      trim,
    );
    spar(
      masts[0],
      new THREE.Vector3(0.02, -0.004, 0.61),
      new THREE.Vector3(0.1, -0.004, 0.57),
      0.004,
      trim,
    );
    mesh(new THREE.SphereGeometry(0.016, 6, 4), trim, masts[0], 0.06, -0.01, 0.61);
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
    for (const parent of [obj, ...masts]) {
      const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
      for (const child of [...parent.children])
        if (
          child instanceof THREE.Mesh &&
          child !== flag &&
          child !== wake &&
          child !== otherWake
        ) {
          child.updateMatrix();
          const g = (
            child.geometry.index ? child.geometry.toNonIndexed() : child.geometry.clone()
          ).applyMatrix4(child.matrix);
          const m = child.material as THREE.Material;
          const list = batches.get(m) || [];
          list.push(g);
          batches.set(m, list);
          parent.remove(child);
        }
      for (const [m, list] of batches) {
        const merged = mergeGeometries(list);
        list.forEach((g) => g.dispose());
        if (merged) {
          geometries.push(merged);
          const batch = new THREE.Mesh(merged, m);
          if (m === wood) batch.name = 'ship-woodwork';
          parent.add(batch);
        }
      }
    }
    obj.scale.setScalar(SHIP_SCALE);
    group.add(obj);
    return { obj, flag, wake, otherWake, masts };
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
  const mantle = mesh(new THREE.SphereGeometry(1, 28, 20), skin, kraken, 0, 0, -0.16);
  mantle.scale.set(0.2, 0.25, 0.17);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(1, 16, 12), dark, kraken, side * 0.15, 0.12, -0.045);
    eye.scale.set(0.025, 0.038, 0.018);
  }
  // Continuous tapered tubes replace visible cylinder joints; geometry is reused.
  const cupGeo = new THREE.TorusGeometry(1, 0.28, 6, 10),
    dropletGeo = new THREE.SphereGeometry(1, 6, 4);
  geometries.push(cupGeo, dropletGeo);
  const tubeSegments = 40,
    tubeSides = 16;
  const tentacles = Array.from({ length: 6 }, (_, i) => {
    const parts = Array.from({ length: 13 }, (_, j) => {
      const m = new THREE.Object3D();
      m.name = `kraken-arm-${i}-joint-${j}`;
      kraken.add(m);
      return m;
    });
    const tubeGeometry = new THREE.BufferGeometry();
    tubeGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(
        new Float32Array((tubeSegments + 1) * (tubeSides + 1) * 3),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    );
    tubeGeometry.setAttribute(
      'normal',
      new THREE.BufferAttribute(
        new Float32Array((tubeSegments + 1) * (tubeSides + 1) * 3),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    );
    const uv = [];
    for (let row = 0; row <= tubeSegments; row++)
      for (let side = 0; side <= tubeSides; side++) uv.push(side / tubeSides, row / tubeSegments);
    tubeGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const indices: number[] = [];
    for (let row = 0; row < tubeSegments; row++)
      for (let side = 0; side < tubeSides; side++) {
        const n = row * (tubeSides + 1) + side;
        indices.push(n, n + 1, n + tubeSides + 1, n + 1, n + tubeSides + 2, n + tubeSides + 1);
      }
    tubeGeometry.setIndex(indices);
    geometries.push(tubeGeometry);
    const tube = new THREE.Mesh(tubeGeometry, skin);
    tube.name = `kraken-tentacle-${i}`;
    tube.frustumCulled = false;
    kraken.add(tube);
    const cups = Array.from({ length: 16 }, () => {
      const m = new THREE.Mesh(cupGeo, suckers);
      kraken.add(m);
      return m;
    });
    return {
      angle: [0.12, 1.3, 2.04, 3.32, 4.13, 5.44][i],
      parts,
      tube,
      cups,
      tip: new THREE.Vector3(),
      splashAge: -1,
    };
  });
  const wreckage = new THREE.Group();
  wreckage.name = 'ship-wreckage';
  kraken.add(wreckage);
  const debris = Array.from({ length: 12 }, (_, i) => {
    const plank = mesh(
      new THREE.BoxGeometry(0.035, 0.14 + (i % 3) * 0.035, 0.018),
      i % 3 ? wood : deck,
      wreckage,
    );
    plank.visible = false;
    return plank;
  });
  const splash = new THREE.InstancedMesh(dropletGeo, foam, 18);
  splash.name = 'kraken-impact-splash';
  splash.frustumCulled = false;
  splash.visible = false;
  kraken.add(splash);
  const rippleGeometry = new THREE.RingGeometry(0.82, 1, 40);
  geometries.push(rippleGeometry);
  const ripples = tentacles.map(() => {
    const mat = foam.clone();
    mat.opacity = 0;
    materials.push(mat);
    const ring = new THREE.Mesh(rippleGeometry, mat);
    kraken.add(ring);
    return ring;
  });
  const washGeometry = new THREE.RingGeometry(0.82, 1, 64);
  const washPositions = washGeometry.getAttribute('position');
  for (let i = 0; i < washPositions.count; i++) {
    const x = washPositions.getX(i),
      y = washPositions.getY(i),
      angle = Math.atan2(y, x);
    const irregular = 1 + 0.055 * Math.sin(angle * 5) + 0.035 * Math.sin(angle * 9 + 0.8);
    washPositions.setXY(i, x * irregular, y * irregular);
  }
  geometries.push(washGeometry);
  const washMaterial = foam.clone();
  materials.push(washMaterial);
  washMaterial.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWash;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWash=position.xy;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWash;')
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      float angle=atan(vWash.y,vWash.x),radius=length(vWash);
      float gaps=smoothstep(-.3,.5,sin(angle*7.0)+.45*sin(angle*13.0));
      float edge=smoothstep(.80,.88,radius)*(1.0-smoothstep(.94,1.06,radius));
      diffuseColor.a*=gaps*edge;`,
      );
  };
  washMaterial.customProgramCacheKey = () => 'kraken-retreat-wash';
  const wash = new THREE.Mesh(washGeometry, washMaterial);
  wash.name = 'kraken-retreat-wash';
  wash.visible = false;
  group.add(wash);
  const droplet = new THREE.Object3D();
  const strikeTimes = [2.25, 3.55, 4.7];
  const armStrikeTimes = [2.25, 3.88, 2.83, 4.7, 3.55, 4.16];
  const closingStrikeTimes = [0.38, 0.72, 0.5, 1.12, 0.93, 1.3];
  const armRetreatTimes = [1.25, 1.55, 1.35, 1.75, 1.65, 1.85];
  const up = new THREE.Vector3(0, 1, 0),
    a = new THREE.Vector3(),
    b = new THREE.Vector3(),
    normal = new THREE.Vector3(),
    binormal = new THREE.Vector3(),
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
    s.obj.scale.setScalar(0);
    s.obj.rotation.set(0, 0, s.heading);
    s.masts.forEach((mast) => mast.rotation.set(0, 0, 0));
    s.wake.visible = s.otherWake.visible = true;
    s.obj.visible = s.route.length > 1;
    if (s.route.length) s.obj.position.set(s.route[0].x, s.route[0].y, 0.04);
  }
  function tentaclePoint(
    angle: number,
    t: number,
    grip: number,
    emerge: number,
    out: THREE.Vector3,
    strike = 0,
    thrash = 0,
    phase = 0,
    retreat = 0,
  ) {
    const reach = 0.7 * (1 - t) + (0.12 + 0.12 * Math.sin(t * 8)) * t * grip;
    const side = Math.sin(t * Math.PI) * Math.sin(angle * 3 + 1) * grip * 0.075;
    const attackZ =
      -0.13 +
      emerge * (Math.sin(t * Math.PI) * (0.35 + grip * 0.27) + t * 0.1) +
      strike * Math.pow(t, 1.5);
    // A flexible arch unfolds from the outer root toward the wreck's center.
    // Each stroke bends the entire arm in its radial plane, without axial twisting.
    // One last stroke per arm, then a staggered dive; never return to the attack pose.
    const cycle = phase;
    const lift =
      cycle < 0 || cycle > 1
        ? 0
        : cycle < 0.57
          ? smooth(cycle / 0.57)
          : 1 - smooth((cycle - 0.57) / 0.15);
    const arch = Math.sin(t * Math.PI);
    const centerReach =
      0.7 * (1 - t) * (1 - retreat * 0.25) +
      (0.065 + 0.025 * Math.sin(angle * 3)) * t +
      arch * 0.1 * lift;
    const centerSide = arch * (0.09 + 0.025 * Math.sin(angle * 2)) * lift;
    const water = -kraken.position.z;
    const unfolding = arch * 0.13 * Math.sin(phase * Math.PI * 2 - t * 2.2) * lift;
    const slapZ =
      THREE.MathUtils.lerp(-0.13, water - 0.045, smooth(t / 0.3)) +
      lift * (arch * 0.65 + Math.pow(t, 0.7) * 0.32) +
      unfolding +
      arch * 0.17 * (1 - retreat) +
      arch * 0.18 * Math.sin(retreat * Math.PI) -
      retreat * (0.35 + t * 0.65);
    const radial = THREE.MathUtils.lerp(reach, centerReach, thrash);
    const lateral = THREE.MathUtils.lerp(side, centerSide, thrash);
    out.set(
      Math.cos(angle) * radial - Math.sin(angle) * lateral,
      Math.sin(angle) * radial + Math.cos(angle) * lateral,
      THREE.MathUtils.lerp(attackZ, slapZ, thrash),
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
        attackPhase:
          target < 0 ? 'idle' : clock - attackStart < SHIP_DESTROYED_AT ? 'attack' : 'submerging',
        krakenDepth: kraken.position.z,
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
        kraken.rotation.z = ships[target].heading;
        debris.forEach((plank) => {
          plank.visible = false;
        });
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
        s.obj.scale.setScalar(SHIP_SCALE * s.fade);
        s.flag.rotation.z = Math.sin(clock * 0.55 + i) * 0.12;
      }
      if (target >= 0) {
        const t = clock - attackStart,
          emerge = smooth(t / 2) * (1 - smooth((t - SHIP_DESTROYED_AT) / AFTERMATH_DURATION)),
          grip = smooth((t - 1.8) / 2),
          sink = smooth((t - 4.2) / 2.8),
          withdraw = smooth((t - SHIP_DESTROYED_AT) / AFTERMATH_DURATION),
          thrash = smooth((t - SHIP_DESTROYED_AT + 0.35) / 0.35),
          s = ships[target];
        let impact = 0;
        for (const [i, hit] of armStrikeTimes.entries()) {
          const elapsed = t - hit;
          if (elapsed >= 0)
            impact += (i % 2 ? -1 : 1) * Math.exp(-elapsed * 2.4) * Math.cos(elapsed * 8);
        }
        const damage = smooth((t - 3.55) / 0.65);
        s.obj.position.z = 0.035 - sink * 1.05 - Math.abs(impact) * 0.055;
        s.obj.rotation.x = sink * 0.65 + impact * 0.22;
        s.obj.rotation.y = impact * 0.62 + damage * 0.28 + sink * 0.5;
        s.obj.scale.setScalar(SHIP_SCALE);
        s.obj.visible = t < SHIP_DESTROYED_AT;
        s.wake.visible = s.otherWake.visible = false;
        s.masts[0].rotation.set(damage * 0.65, -damage * 1.05, damage * 0.18);
        s.masts[1].rotation.set(-smooth((t - 4.7) / 0.55) * 0.85, damage * 0.45, 0);
        kraken.position.z = -sink * 0.12 - withdraw * 0.8;
        for (const [i, tentacle] of tentacles.entries()) {
          // Independent, uneven blows in each arm's fixed lane.
          const hit = armStrikeTimes[i],
            lift = smooth((t - hit + 0.8) / 0.55) * (1 - smooth((t - hit + 0.16) / 0.16)),
            slam = t >= hit ? -0.18 * Math.exp(-(t - hit) * 3.5) : 0,
            strike = lift * (i < 3 ? 0.7 : 0.45) + slam,
            after = t - SHIP_DESTROYED_AT,
            closingHit = closingStrikeTimes[i],
            phase = (after - closingHit + 0.45) / 0.625,
            retreat = smooth((after - armRetreatTimes[i]) / (2.9 - armRetreatTimes[i])),
            armGrip = grip * (1 - thrash * 0.45);
          tentacle.splashAge =
            after >= closingHit && after < closingHit + 0.38 ? after - closingHit : -1;
          for (let j = 0; j < tentacle.parts.length; j++) {
            tentaclePoint(
              tentacle.angle,
              j / 13,
              armGrip,
              emerge,
              a,
              strike,
              thrash,
              phase,
              retreat,
            );
            tentaclePoint(
              tentacle.angle,
              (j + 1) / 13,
              armGrip,
              emerge,
              b,
              strike,
              thrash,
              phase,
              retreat,
            );
            const m = tentacle.parts[j],
              r = 0.05 * (1 - j / 15);
            m.position.copy(a).add(b).multiplyScalar(0.5);
            m.scale.set(r, a.distanceTo(b) + 0.008, r);
            m.quaternion.setFromUnitVectors(up, direction.copy(b).sub(a).normalize());
          }
          const positions = tentacle.tube.geometry.getAttribute('position'),
            normals = tentacle.tube.geometry.getAttribute('normal');
          for (let row = 0; row <= tubeSegments; row++) {
            const u = row / tubeSegments;
            tentaclePoint(tentacle.angle, u, armGrip, emerge, a, strike, thrash, phase, retreat);
            tentaclePoint(
              tentacle.angle,
              u + 0.002,
              armGrip,
              emerge,
              b,
              strike,
              thrash,
              phase,
              retreat,
            );
            direction.copy(b).sub(a).normalize();
            normal.set(0, 0, 1).cross(direction);
            if (normal.lengthSq() < 0.001) normal.set(0, 1, 0).cross(direction);
            normal.normalize();
            binormal.crossVectors(direction, normal).normalize();
            const radius = 0.064 * Math.pow(1 - u, 0.8) + 0.003;
            for (let side = 0; side <= tubeSides; side++) {
              const theta = (side / tubeSides) * Math.PI * 2,
                nx = normal.x * Math.cos(theta) + binormal.x * Math.sin(theta),
                ny = normal.y * Math.cos(theta) + binormal.y * Math.sin(theta),
                nz = normal.z * Math.cos(theta) + binormal.z * Math.sin(theta),
                index = row * (tubeSides + 1) + side;
              positions.setXYZ(index, a.x + nx * radius, a.y + ny * radius, a.z + nz * radius);
              normals.setXYZ(index, nx, ny, nz);
            }
          }
          positions.needsUpdate = normals.needsUpdate = true;
          for (let j = 0; j < tentacle.cups.length; j++) {
            const m = tentacle.cups[j];
            const u = 0.2 + Math.floor(j / 2) * 0.09;
            tentaclePoint(
              tentacle.angle,
              u,
              armGrip,
              emerge,
              m.position,
              strike,
              thrash,
              phase,
              retreat,
            );
            const radius = 0.064 * Math.pow(1 - u, 0.8) + 0.003;
            m.position.x += Math.cos(tentacle.angle) * (j % 2 ? 1 : -1) * radius * 0.45;
            m.position.y += Math.sin(tentacle.angle) * (j % 2 ? 1 : -1) * radius * 0.45;
            m.position.z -= radius * 0.82;
            m.scale.setScalar(0.021 * (1 - u * 0.75));
          }
          tentaclePoint(
            tentacle.angle,
            1,
            armGrip,
            emerge,
            tentacle.tip,
            strike,
            thrash,
            phase,
            retreat,
          );
        }
        for (const [i, plank] of debris.entries()) {
          const age = t - (i < 4 ? strikeTimes[0] : i < 8 ? strikeTimes[1] : strikeTimes[2]);
          plank.visible = age >= 0 && t < ATTACK_DURATION;
          if (!plank.visible) continue;
          const angle = i * 2.399,
            distance = 0.14 + Math.min(age, 1.6) * (0.18 + (i % 3) * 0.08);
          plank.position.set(
            Math.cos(angle) * distance,
            Math.sin(angle) * distance,
            Math.max(0.028 - kraken.position.z, 0.17 + age * 0.65 - age * age * 0.8),
          );
          plank.rotation.set(
            age < 1 ? age * (i % 2 ? 4 : -3) : 0.08 * Math.sin(t * 3 + i),
            age < 1 ? age * 2 : 0,
            angle + age * 0.3,
          );
          plank.scale.setScalar(1 - smooth((t - 9) / 1));
        }
        const lastHit = armStrikeTimes.reduce(
            (latest, hit) => (t >= hit ? Math.max(latest, hit) : latest),
            -1,
          ),
          splashAge = lastHit < 0 ? -1 : t - lastHit;
        for (const [i, ring] of ripples.entries()) {
          const arm = tentacles[i],
            age = arm.splashAge;
          const active = thrash > 0.15 && age >= 0 && age < 0.38;
          ring.visible = active;
          if (active) {
            ring.position.set(arm.tip.x, arm.tip.y, 0.012 - kraken.position.z);
            ring.scale.setScalar(0.045 + age * 0.65);
            (ring.material as THREE.MeshBasicMaterial).opacity = 0.14 * (1 - age / 0.38) * thrash;
          }
        }
        const after = t - SHIP_DESTROYED_AT;
        wash.visible = after > 0.9 && after < AFTERMATH_DURATION;
        if (wash.visible) {
          wash.position.set(kraken.position.x, kraken.position.y, 0.018);
          wash.scale.setScalar(0.18 + Math.max(0, after - 0.9) * 0.27);
          washMaterial.opacity =
            0.16 * smooth((after - 0.9) / 0.35) * (1 - smooth((after - 2) / 1));
        }
        const surfaceSlaps = thrash > 0.2 && withdraw < 0.8;
        splash.visible = surfaceSlaps || (splashAge >= 0 && splashAge < 0.85);
        if (splash.visible) {
          for (let i = 0; i < 18; i++) {
            if (surfaceSlaps) {
              const arm = tentacles[Math.floor(i / 3)],
                age = arm.splashAge,
                visible = age >= 0 && age < 0.3,
                angle = i * 2.399;
              droplet.position.set(
                arm.tip.x + Math.cos(angle) * age * 0.4,
                arm.tip.y + Math.sin(angle) * age * 0.4,
                0.025 - kraken.position.z + Math.max(0, age * 1.3 - age * age * 4),
              );
              droplet.scale.setScalar(visible ? 0.015 * thrash * (1 - age / 0.3) : 0);
              droplet.scale.z *= 2.5;
              droplet.updateMatrix();
              splash.setMatrixAt(i, droplet.matrix);
              continue;
            }
            const angle = i * 2.399,
              spread = 0.13 + splashAge * (0.3 + (i % 4) * 0.12);
            droplet.position.set(
              Math.cos(angle) * spread,
              Math.sin(angle) * spread,
              0.04 +
                -kraken.position.z +
                Math.max(0, splashAge * (0.8 + (i % 3) * 0.2) - 1.5 * splashAge * splashAge),
            );
            droplet.scale.set(0.012, 0.012, 0.035 * (1 - splashAge / 0.85));
            droplet.updateMatrix();
            splash.setMatrixAt(i, droplet.matrix);
          }
          splash.instanceMatrix.needsUpdate = true;
        }
        if (t >= ATTACK_DURATION) {
          kraken.visible = false;
          wash.visible = false;
          reset(s);
          target = -1;
        }
      }
    },
    dispose() {
      splash.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      group.clear();
    },
  };
}
