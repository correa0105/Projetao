import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { VttMessage } from '../shared/vtt';
import { useSoundEffects } from './SiteMusic';
import './vtt-dice.css';

type Face = { center: THREE.Vector3; normal: THREE.Vector3 };
// A pentagonal trapezohedron: ten planar kite faces, rather than a generic sphere.
export function d10Geometry() {
  const ring = Array.from(
    { length: 10 },
    (_, i) =>
      new THREE.Vector3(
        Math.cos((i * Math.PI) / 5),
        Math.sin((i * Math.PI) / 5),
        i % 2 ? -0.12 : 0.12,
      ),
  );
  const h = (0.12 * (1 + Math.cos(Math.PI / 5))) / (1 - Math.cos(Math.PI / 5));
  const points = [...ring, new THREE.Vector3(0, 0, h), new THREE.Vector3(0, 0, -h)];
  const faces: Face[] = [],
    positions: number[] = [];
  for (let i = 0; i < 5; i++)
    for (const ids of [
      [10, i * 2, (i * 2 + 1) % 10, (i * 2 + 2) % 10],
      [11, (i * 2 + 1) % 10, (i * 2 + 2) % 10, (i * 2 + 3) % 10],
    ]) {
      const vs = ids.map((id) => points[id]);
      const center = vs.reduce((v, p) => v.add(p), new THREE.Vector3()).multiplyScalar(0.25);
      const normal = new THREE.Vector3()
        .subVectors(vs[1], vs[0])
        .cross(new THREE.Vector3().subVectors(vs[2], vs[0]))
        .normalize();
      if (normal.dot(center) < 0) {
        vs.reverse();
        normal.negate();
      }
      for (const tri of [
        [0, 1, 2],
        [0, 2, 3],
      ])
        for (const id of tri) positions.push(...vs[id].toArray());
      faces.push({ center, normal });
    }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return { geometry, faces };
}
function shape(sides: number) {
  if (sides === 10) return d10Geometry();
  const geo =
    sides === 4
      ? new THREE.TetrahedronGeometry(1)
      : sides === 6
        ? new THREE.BoxGeometry(1.45, 1.45, 1.45)
        : sides === 8
          ? new THREE.OctahedronGeometry(1)
          : sides === 12
            ? new THREE.DodecahedronGeometry(1)
            : new THREE.IcosahedronGeometry(1);
  const geometry = geo.index ? geo.toNonIndexed() : geo;
  if (geometry !== geo) geo.dispose();
  const p = geometry.getAttribute('position'),
    faces: Face[] = [];
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p, i),
      b = new THREE.Vector3().fromBufferAttribute(p, i + 1),
      c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    const center = a
      .add(b)
      .add(c)
      .multiplyScalar(1 / 3);
    const existing = faces.find((f) => f.normal.dot(normal) > 0.9999);
    if (existing) existing.center.add(center);
    else faces.push({ normal, center });
  }
  // Box and dodecahedron faces consist of multiple coplanar triangles.
  const tris = p.count / 3 / faces.length;
  faces.forEach((f) => f.center.multiplyScalar(1 / tris));
  return { geometry, faces };
}
function die(sides: number, result: number, tint: number, percentile = false) {
  const { geometry, faces } = shape(sides),
    group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: tint,
    roughness: 0.36,
    metalness: 0.22,
    flatShading: true,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  group.add(mesh);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0xb8a57d, transparent: true, opacity: 0.6 }),
  );
  group.add(edges);
  const textures: THREE.Texture[] = [];
  faces.forEach((face, i) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const c = canvas.getContext('2d')!;
    c.font = 'bold 80px Georgia';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff1c9';
    c.fillText(
      percentile ? String(i * 10).padStart(2, '0') : sides === 10 ? String(i) : String(i + 1),
      64,
      65,
    );
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    textures.push(texture);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(sides === 20 ? 0.46 : sides === 4 ? 0.58 : 0.64, 0.64),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
      }),
    );
    label.position.copy(face.center).addScaledVector(face.normal, 0.012);
    label.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), face.normal);
    group.add(label);
  });
  const index = sides === 10 ? result % 10 : result - 1;
  const settled = new THREE.Quaternion().setFromUnitVectors(
    faces[index]?.normal || faces[0].normal,
    new THREE.Vector3(0, 0, 1),
  );
  const dispose = () => {
    group.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    textures.forEach((t) => t.dispose());
  };
  return { group, settled, dispose };
}
function impact(context: AudioContext, volume: number, strength: number) {
  const now = context.currentTime,
    buffer = context.createBuffer(1, Math.ceil(context.sampleRate * 0.07), context.sampleRate),
    data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (context.sampleRate * 0.012));
  const noise = context.createBufferSource();
  noise.buffer = buffer;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  const gain = context.createGain();
  gain.gain.setValueAtTime(volume * 0.3 * strength, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
  noise.connect(filter).connect(gain).connect(context.destination);
  noise.start(now);
  const tone = context.createOscillator(),
    body = context.createGain();
  tone.type = 'triangle';
  tone.frequency.setValueAtTime(150, now);
  tone.frequency.exponentialRampToValueAtTime(65, now + 0.06);
  body.gain.setValueAtTime(volume * 0.2 * strength, now);
  body.gain.exponentialRampToValueAtTime(0.0001, now + 0.085);
  tone.connect(body).connect(context.destination);
  tone.start(now);
  tone.stop(now + 0.09);
}
export function VttDice({
  messages,
  roomId,
  enabled,
}: {
  messages: VttMessage[];
  roomId: string;
  enabled: boolean;
}) {
  const host = useRef<HTMLDivElement>(null),
    seen = useRef<Set<string> | null>(null),
    room = useRef(''),
    effects = useSoundEffects(),
    currentEffects = useRef(effects);
  currentEffects.current = effects;
  const [roll, setRoll] = useState<VttMessage | null>(null),
    [fallback, setFallback] = useState(false);
  useEffect(() => {
    if (room.current !== roomId) {
      room.current = roomId;
      seen.current = new Set(messages.map((m) => m.id));
      setRoll(null);
      return;
    }
    const next = messages.filter((m) => !seen.current?.has(m.id));
    next.forEach((m) => seen.current?.add(m.id));
    const last = next.filter((m) => m.roll).at(-1);
    if (last && enabled) setRoll(last);
  }, [messages, roomId, enabled]);
  useEffect(() => {
    if (!roll?.roll || !enabled || !host.current) return;
    const sides = Number(roll.roll.formula.match(/d(\d+)/i)?.[1]);
    if (![4, 6, 8, 10, 12, 20, 100].includes(sides)) {
      setFallback(true);
      const timer = setTimeout(() => setRoll(null), 5000);
      return () => clearTimeout(timer);
    }
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      setFallback(true);
      const t = setTimeout(() => setRoll(null), 5000);
      return () => clearTimeout(t);
    }
    setFallback(false);
    const root = host.current,
      scene = new THREE.Scene(),
      camera = new THREE.OrthographicCamera(-8, 8, 6, -6, 0.1, 100);
    camera.position.set(0, 0, 25);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor(0, 0);
    root.appendChild(renderer.domElement);
    renderer.domElement.setAttribute('aria-label', 'Dados 3D');
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const resize = () => {
      const w = root.clientWidth,
        h = root.clientHeight;
      renderer.setSize(w, h);
      camera.left = -8;
      camera.right = 8;
      camera.top = (8 * h) / w;
      camera.bottom = (-8 * h) / w;
      camera.updateProjectionMatrix();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(root);
    scene.add(new THREE.AmbientLight(0xc3d3ee, 2));
    const light = new THREE.DirectionalLight(0xffebca, 5);
    light.position.set(-5, 8, 12);
    light.castShadow = true;
    light.shadow.camera.left = -10;
    light.shadow.camera.right = 10;
    light.shadow.camera.top = 10;
    light.shadow.camera.bottom = -10;
    light.shadow.mapSize.set(1024, 1024);
    scene.add(light);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.ShadowMaterial({ opacity: 0.3 }),
    );
    floor.position.z = -0.85;
    floor.receiveShadow = true;
    scene.add(floor);
    const values = roll.roll.dice.flatMap((n) =>
      sides === 100
        ? [
            { sides: 10, result: Math.floor((n % 100) / 10), tens: true },
            { sides: 10, result: n % 10, tens: false },
          ]
        : [{ sides, result: n, tens: false }],
    );
    const count = values.length,
      cols = Math.min(12, Math.ceil(Math.sqrt(count * 1.8))),
      rows = Math.ceil(count / cols),
      scale = Math.min(0.85, 12 / (cols * 2), (camera.top * 1.6) / (rows * 2));
    const dice = values.map((v, i) => {
      const d = die(
        [4, 6, 8, 10, 12, 20].includes(v.sides) ? v.sides : 20,
        v.result,
        v.tens ? 0x624430 : 0x293e65,
        v.tens,
      );
      d.group.scale.setScalar(scale);
      scene.add(d.group);
      return {
        ...d,
        x: ((i % cols) - (cols - 1) / 2) * scale * 2.2,
        y: (Math.floor(i / cols) - (rows - 1) / 2) * scale * 2.2,
        startX: -7 + Math.random() * 1.2,
        startY: camera.top * (0.25 + Math.random() * 0.45),
        curve: (Math.random() - 0.5) * 3,
        spin: new THREE.Euler(Math.random() * 9, Math.random() * 9, Math.random() * 9),
      };
    });
    let context: AudioContext | undefined;
    const fx = currentEffects.current;
    if (!fx.muted && fx.volume > 0 && !document.hidden) {
      try {
        context = new AudioContext();
        void context.resume().catch(() => {});
      } catch {
        /* Visual dice still work when audio is unavailable. */
      }
    }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches,
      duration = reduced ? 0.12 : 3.2,
      start = performance.now();
    let frame = 0,
      impactIndex = 0;
    const timings = [0.38, 0.87, 1.35, 1.85, 2.36, 2.85];
    function render(now: number) {
      const elapsed = (now - start) / 1000,
        t = Math.min(1, elapsed / duration);
      if (context && elapsed > (timings[impactIndex] ?? Infinity)) {
        const fx = currentEffects.current;
        if (!fx.muted && !document.hidden) impact(context, fx.volume, 1 - impactIndex * 0.11);
        impactIndex++;
      }
      for (const d of dice) {
        const q = 1 - t;
        d.group.position.set(
          d.startX * q * q + d.x * (1 - q * q),
          d.startY * q * q + d.y * (1 - q * q) + Math.sin(t * Math.PI) * d.curve,
          Math.abs(Math.sin(t * Math.PI * 6)) * q * 2.3,
        );
        d.group.quaternion.setFromEuler(
          new THREE.Euler(d.spin.x * q * 3, d.spin.y * q * 3, d.spin.z * q * 3),
        );
        if (t > 0.82) d.group.quaternion.slerp(d.settled, (t - 0.82) / 0.18);
        if (t === 1) d.group.quaternion.copy(d.settled);
      }
      renderer.render(scene, camera);
      if (elapsed < 6.5) frame = requestAnimationFrame(render);
      else setRoll(null);
    }
    frame = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      dice.forEach((d) => d.dispose());
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      light.shadow.map?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      if (context) void context.close().catch(() => {});
    };
  }, [roll, enabled]);
  return (
    <div
      className="vtt-dice-overlay"
      ref={host}
      aria-hidden={!roll}
      data-dice-count={roll?.roll?.dice.length || 0}
    >
      {roll?.roll && enabled && (
        <output className="vtt-dice-result" aria-live="polite">
          <strong>{roll.roll.total}</strong>
          <span>
            {roll.author} · {roll.roll.formula}
          </span>
          <small>
            {roll.roll.dice.join(' · ')}
            {fallback ? ' · resultado da mesa' : ''}
          </small>
        </output>
      )}
    </div>
  );
}
