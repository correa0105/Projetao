import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { VttMessage } from '../shared/vtt';
import { useSoundEffects } from './SiteMusic';
import './vtt-dice.css';

import { shape } from './vtt-dice-geometry';
import { DicePhysics } from './vtt-dice-physics';
export { d10Geometry } from './vtt-dice-geometry';
function die(sides: number, result: number, tint: number, percentile = false, balance = false) {
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
  const textures: THREE.CanvasTexture[] = [];
  const labels: HTMLCanvasElement[] = [];
  faces.forEach((face, i) => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    labels.push(canvas);
    const c = canvas.getContext('2d')!;
    c.font = 'bold 80px Georgia';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#fff1c9';
    c.fillText(
      balance
        ? ['−', '0', '+'][i % 3]
        : percentile
          ? String(i * 10).padStart(2, '0')
          : sides === 10
            ? String(i)
            : String(i + 1),
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
  const setTop = (orientation: THREE.Quaternion) => {
    const up = faces.reduce(
      (best, face, i) =>
        face.normal.clone().applyQuaternion(orientation).z >
        faces[best].normal.clone().applyQuaternion(orientation).z
          ? i
          : best,
      0,
    );
    const wanted = balance ? result + 1 : sides === 10 ? result % 10 : result - 1;
    if (up === wanted) return;
    for (const [index, value] of [
      [up, wanted],
      [wanted, up],
    ]) {
      const c = labels[index].getContext('2d')!;
      c.clearRect(0, 0, 128, 128);
      c.fillText(
        balance
          ? ['−', '0', '+'][value % 3]
          : percentile
            ? String(value * 10).padStart(2, '0')
            : sides === 10
              ? String(value)
              : String(value + 1),
        64,
        65,
      );
      textures[index].needsUpdate = true;
    }
  };
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
  return { group, geometry, setTop, dispose };
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
    const physical = roll.roll.throws || roll.roll.dice.map((value) => ({ sides, value }));
    if (
      !physical.length ||
      physical.length > 30 ||
      physical.some((t) => ![-1, 4, 6, 8, 10, 12, 20, 100].includes(t.sides))
    ) {
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
    floor.position.z = 0;
    floor.receiveShadow = true;
    scene.add(floor);
    const values = physical.flatMap(({ sides, value: n }) =>
      sides === 100
        ? [
            { sides: 10, result: Math.floor((n % 100) / 10), tens: true, balance: false },
            { sides: 10, result: n % 10, tens: false, balance: false },
          ]
        : [{ sides: sides === -1 ? 6 : sides, result: n, tens: false, balance: sides === -1 }],
    );
    const count = values.length,
      scale = Math.min(
        0.82,
        12 / (Math.ceil(Math.sqrt(count)) * 2.65),
        (camera.top * 1.65) / (Math.ceil(Math.sqrt(count)) * 2.65),
      );
    const dice = values.map((v) => {
      const d = die(v.sides, v.result, v.tens ? 0x624430 : 0x293e65, v.tens, v.balance);
      d.group.scale.setScalar(scale);
      scene.add(d.group);
      return d;
    });
    const physics = new DicePhysics(
      dice.map((d) => d.geometry),
      camera.right - camera.left,
      camera.top - camera.bottom,
      scale,
    );
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
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0,
      cancelled = false,
      lastImpact = -1;
    async function prepare() {
      let slice = performance.now();
      for (let i = 0; i < 420 && !physics.settled; i++) {
        if (cancelled) return;
        physics.step();
        if (performance.now() - slice > 12) {
          await new Promise<void>((resolve) => setTimeout(resolve, 0));
          slice = performance.now();
        }
      }
      if (cancelled) return;
      dice.forEach((d, i) => {
        const q = physics.bodies[i].quaternion;
        d.setTop(new THREE.Quaternion(q.x, q.y, q.z, q.w));
      });
      const duration = (physics.samples.length - 1) / 60,
        start = performance.now();
      function render(now: number) {
        const elapsed = Math.max(0, (now - start) / 1000),
          position = reduced
            ? physics.samples.length - 1
            : Math.min(physics.samples.length - 1, elapsed * 60),
          index = Math.floor(position),
          alpha = position - index;
        const a = physics.samples[index],
          b = physics.samples[Math.min(index + 1, physics.samples.length - 1)];
        for (let i = 0; i < dice.length; i++) {
          const k = i * 7,
            d = dice[i];
          d.group.position.set(
            a[k] + (b[k] - a[k]) * alpha,
            a[k + 1] + (b[k + 1] - a[k + 1]) * alpha,
            a[k + 2] + (b[k + 2] - a[k + 2]) * alpha,
          );
          d.group.quaternion.set(a[k + 3], a[k + 4], a[k + 5], a[k + 6]);
          d.group.quaternion.slerp(
            new THREE.Quaternion(b[k + 3], b[k + 4], b[k + 5], b[k + 6]),
            alpha,
          );
        }
        if (context && !reduced) {
          const fx = currentEffects.current;
          const hit = physics.impacts
            .filter((h) => h.time <= elapsed && h.time > lastImpact)
            .at(-1);
          if (hit) {
            lastImpact = elapsed;
            if (!fx.muted && !document.hidden) impact(context, fx.volume, hit.strength);
          }
        }
        renderer.render(scene, camera);
        renderer.domElement.dataset.physics = 'rigid-body';
        renderer.domElement.dataset.phase =
          position >= physics.samples.length - 1 ? 'settled' : 'rolling';
        if (elapsed < (reduced ? 3 : duration + 2.2)) frame = requestAnimationFrame(render);
        else setRoll(null);
      }
      frame = requestAnimationFrame(render);
    }
    void prepare();
    return () => {
      cancelled = true;
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
