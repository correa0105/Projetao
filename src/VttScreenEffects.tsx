import { useEffect, useRef, useState } from 'react';
import { Sparkles, Square, Volume2, VolumeX } from 'lucide-react';
import {
  screenEffectPresets,
  screenEffectPreset,
  type ScreenEffect,
  type ActiveScreenEffectId,
} from '../shared/vtt-screen-effects';
import type { SoundCommand, SoundSnapshot } from '../shared/vtt-sounds';
import './vtt-screen-effects.css';
import { VttScreenPreview } from './VttScreenPreview';
import { screenAtlas, drawScreenSprite } from './vtt-screen-materials';

export function VttScreenEffectControls({
  snapshot,
  sceneId,
  command,
  unlock,
}: {
  snapshot: SoundSnapshot;
  sceneId: string;
  command: (c: SoundCommand) => Promise<void>;
  unlock: () => void;
}) {
  const [preset, setPreset] = useState<ActiveScreenEffectId>('cave-in'),
    [duration, setDuration] = useState(10),
    [intensity, setIntensity] = useState(0.65),
    [volume, setVolume] = useState(0.65),
    [muted, setMuted] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const clockOffset = useRef(0);
  useEffect(() => {
    clockOffset.current = snapshot.serverTime - Date.now();
  }, [snapshot.serverTime]);
  const event = snapshot.soundboard.screenEffect;
  const active = event && now + clockOffset.current < event.startedAt + event.duration * 1000;
  async function send(c: SoundCommand) {
    setBusy(true);
    setError('');
    try {
      await command(c);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="vtt-screen-controls" aria-label="Efeitos imersivos de tela">
      <div className="vtt-sound-section-title">
        <Sparkles size={18} />
        <div>
          <strong>Efeitos de tela</strong>
          <small>Uma cena que envolve toda a mesa</small>
        </div>
      </div>
      <p>
        O efeito aparece para os participantes na cena ativa. A intensidade também controla o
        tremor. Quem desativou efeitos do mestre mantém sua preferência.
      </p>
      <div className="vtt-screen-presets">
        {screenEffectPresets.map((p) => (
          <button
            key={p.id}
            aria-pressed={preset === p.id}
            onClick={() => {
              setPreset(p.id);
              setDuration(p.duration);
            }}
          >
            <VttScreenPreview preset={p.id} />
            <span className="vtt-screen-preset-copy">
              <strong>{p.name}</strong>
              <small>{p.description}</small>
            </span>
          </button>
        ))}
      </div>
      <label>
        Duração · {duration} s
        <input
          aria-label="Duração do efeito de tela"
          type="range"
          min="5"
          max="60"
          step="1"
          value={duration}
          onChange={(e) => setDuration(+e.target.value)}
        />
      </label>
      <label>
        Intensidade · {Math.round(intensity * 100)}%
        <input
          aria-label="Intensidade do efeito de tela"
          type="range"
          min=".1"
          max="1"
          step=".05"
          value={intensity}
          onChange={(e) => setIntensity(+e.target.value)}
        />
      </label>
      <label>
        Volume · {Math.round(volume * 100)}%
        <input
          aria-label="Volume do efeito de tela"
          type="range"
          min="0"
          max="1"
          step=".05"
          value={volume}
          onChange={(e) => setVolume(+e.target.value)}
        />
      </label>
      <label className="vtt-check">
        <input
          type="checkbox"
          checked={active ? event.muted : muted}
          onChange={(e) => {
            setMuted(e.target.checked);
            if (active) void send({ kind: 'screenAudio', muted: e.target.checked });
          }}
        />
        <VolumeX size={14} /> Silenciar som do efeito para todos
      </label>
      <button
        className="vtt-screen-trigger"
        disabled={busy}
        onClick={() => {
          unlock();
          void send({
            kind: 'screenPlay',
            settings: { preset, sceneId, duration, intensity, volume, muted },
          });
        }}
      >
        <Sparkles size={16} /> Disparar {screenEffectPreset(preset).name}
      </button>
      {active && (
        <div className="vtt-screen-running" role="status">
          <strong>{screenEffectPreset(event.preset).name} na mesa</strong>
          <button
            disabled={busy}
            onClick={() => {
              setMuted(!event.muted);
              void send({ kind: 'screenAudio', muted: !event.muted });
            }}
          >
            {event.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}{' '}
            {event.muted ? 'Ativar som' : 'Mutar som'}
          </button>
          <button disabled={busy} onClick={() => void send({ kind: 'screenStop' })}>
            <Square size={13} /> Encerrar efeito
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="vtt-sound-error">
          {error}
        </p>
      )}
    </section>
  );
}

type Particle = {
  x: number;
  y: number;
  depth: number;
  speed: number;
  size: number;
  phase: number;
  spin: number;
  shape: number[];
};
export function VttScreenEffects({
  event,
  serverTime,
  sceneId,
  enabled,
}: {
  event: ScreenEffect | null | undefined;
  serverTime: number;
  sceneId: string;
  enabled: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const offset = useRef(0);
  // Refresh only when a new server snapshot arrives, never when a local frame renders.
  useEffect(() => {
    offset.current = serverTime - Date.now();
  }, [serverTime]);
  useEffect(() => {
    const target = canvas.current;
    if (!target || !event || event.sceneId !== sceneId || !enabled) return;
    const context = target.getContext('2d');
    if (!context) return;
    screenAtlas();
    const workspace = document.querySelector<HTMLElement>('.vtt-workspace');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let width = 0,
      height = 0,
      frame = 0,
      last = 0,
      seed = [...event.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
    const random = () => {
      seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
      seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
      return ((seed ^ (seed >>> 16)) >>> 0) / 4294967296;
    };
    const particles: Particle[] = Array.from({ length: 240 }, () => ({
      x: random(),
      y: random(),
      depth: 0.2 + random() * 0.8,
      speed: 0.7 + random() * 1.8,
      size: 2 + random() * 12,
      phase: random() * Math.PI * 2,
      spin: random() * 4 - 2,
      shape: Array.from({ length: 7 }, () => 0.65 + random() * 0.35),
    }));
    const resize = () => {
      width = innerWidth;
      height = innerHeight;
      const ratio = Math.min(devicePixelRatio || 1, 1.5);
      target.width = width * ratio;
      target.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);
    const resetShake = () => {
      workspace?.style.removeProperty('translate');
    };
    const draw = (stamp: number) => {
      const elapsed = (Date.now() + offset.current - event.startedAt) / 1000;
      if (elapsed >= event.duration) {
        context.clearRect(0, 0, width, height);
        resetShake();
        return;
      }
      frame = requestAnimationFrame(draw);
      if (document.hidden || stamp - last < (reduced.matches ? 100 : 1000 / 40)) return;
      last = stamp;
      context.clearRect(0, 0, width, height);
      resetShake();
      if (elapsed < 0) return;
      const t = elapsed,
        power = event.intensity,
        envelope = Math.min(1, t / 0.7, (event.duration - t) / 1.8),
        alpha = Math.max(0, envelope) * power;
      const debris = event.preset === 'earthquake' || event.preset === 'cave-in';
      if (debris && !reduced.matches) {
        const force =
          (event.preset === 'cave-in' ? 7 : 4.5) * alpha * (0.5 + 0.5 * Math.sin(t * 1.7) ** 2);
        if (workspace)
          workspace.style.translate = `${Math.sin(t * 49) * force}px ${Math.cos(t * 61) * force * 0.7}px`;
      }
      context.globalAlpha = alpha;
      // Gentle edge shading leaves the centre and all controls readable.
      const vignette = context.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.24,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.7,
      );
      vignette.addColorStop(0, 'transparent');
      vignette.addColorStop(1, event.preset === 'embers' ? '#4d201977' : '#0a111b88');
      context.fillStyle = vignette;
      context.fillRect(0, 0, width, height);
      if (event.preset === 'thunderstorm' && !reduced.matches) {
        const lightning = Math.exp(-((((t + 1.6) % 6.5) - 0.7) ** 2) * 150);
        context.fillStyle = `rgba(204,220,240,${lightning * 0.16 * alpha})`;
        context.fillRect(0, 0, width, height);
      }
      if (debris || event.preset === 'haunting') {
        for (let i = 0; i < 7; i++) {
          const p = particles[i],
            x = ((p.x * width + t * (i % 2 ? 18 : -13) + width * 2) % (width * 1.6)) - 0.3 * width,
            y = debris ? height * (0.08 + p.y * 0.75) + Math.sin(t * 0.4 + i) * 40 : p.y * height;
          const radius = (110 + p.depth * 200) * Math.min(width / 700, 1.4),
            mist = context.createRadialGradient(x, y, 0, x, y, radius);
          if (debris) {
            context.save();
            context.globalAlpha = alpha * 0.1;
            const painted = drawScreenSprite(
              context,
              8 + (i % 4),
              x - radius,
              y - radius,
              radius * 2,
            );
            context.restore();
            if (painted) continue;
          }
          mist.addColorStop(
            0,
            debris ? `rgba(155,133,106,${0.12 * alpha})` : `rgba(152,181,193,${0.08 * alpha})`,
          );
          mist.addColorStop(1, 'transparent');
          context.fillStyle = mist;
          context.fillRect(x - radius, y - radius, radius * 2, radius * 2);
        }
      }
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i],
          motion = reduced.matches ? t * 0.12 : t;
        let x = p.x * width,
          y = p.y * height,
          size = p.size * (0.3 + p.depth),
          opacity = alpha * (0.25 + p.depth * 0.65);
        if (debris) {
          // Each stone enters above the viewport, accelerates and tumbles at its own depth.
          const cycle = (motion * p.speed * 0.24 + p.y) % 1;
          y = -70 + cycle * cycle * (height + 180);
          x += Math.sin(p.phase + cycle * 2) * 45 * p.depth;
          size *= event.preset === 'cave-in' ? 1.6 : 0.75;
          if (i % 3 === 0) {
            context.fillStyle = `rgba(193,173,142,${opacity * 0.5})`;
            context.beginPath();
            context.arc(x, y, Math.max(1, size * 0.16), 0, Math.PI * 2);
            context.fill();
            continue;
          }
          context.save();
          context.translate(x, y);
          context.rotate(p.phase + motion * p.spin);
          context.globalAlpha = opacity;
          if (drawScreenSprite(context, i % 8, -size * 1.35, -size * 1.35, size * 2.7)) {
            context.restore();
            continue;
          }
          context.beginPath();
          p.shape.forEach((r, j) => {
            const a = (j / 7) * Math.PI * 2;
            const px = Math.cos(a) * size * r,
              py = Math.sin(a) * size * r;
            if (j) context.lineTo(px, py);
            else context.moveTo(px, py);
          });
          context.closePath();
          const stone = context.createLinearGradient(-size, -size, size, size);
          stone.addColorStop(0, i % 2 ? '#b09b7d' : '#87796b');
          stone.addColorStop(0.45, i % 2 ? '#877561' : '#5c5349');
          stone.addColorStop(1, '#37342f');
          context.fillStyle = stone;
          context.fill();
          context.strokeStyle = '#cbb99d66';
          context.lineWidth = 0.7;
          context.stroke();
          context.beginPath();
          context.moveTo(-size * 0.5, -size * 0.2);
          context.lineTo(size * 0.15, size * 0.1);
          context.lineTo(size * 0.35, size * 0.6);
          context.strokeStyle = '#24211f88';
          context.stroke();
          context.restore();
        } else if (event.preset === 'thunderstorm') {
          y = ((y + motion * (350 + p.depth * 700)) % (height + 100)) - 50;
          x = (x - motion * (80 + p.depth * 130) + width * 100) % width;
          context.strokeStyle = `rgba(172,197,212,${opacity * 0.4})`;
          context.lineWidth = 0.6 + p.depth;
          context.beginPath();
          context.moveTo(x, y);
          context.lineTo(x - 8 * p.depth, y + 22 * p.depth);
          context.stroke();
        } else if (event.preset === 'blizzard') {
          x = (x + motion * (35 + p.depth * 95) + Math.sin(motion + p.phase) * 35) % width;
          y = (y + motion * (20 + p.depth * 65)) % height;
          context.fillStyle = `rgba(224,236,242,${opacity * 0.7})`;
          context.beginPath();
          context.arc(x, y, 0.5 + p.depth * 3, 0, 7);
          context.fill();
        } else if (event.preset === 'embers') {
          y = (y - motion * (18 + p.depth * 75) + height * 100) % height;
          x += Math.sin(motion * 0.6 + p.phase) * 40;
          context.save();
          context.translate(x, y);
          context.rotate(p.phase);
          context.globalAlpha = opacity * (i % 4 ? 0.5 : 1);
          const flake = i % 4 ? 2 + p.depth * 8 : 5 + p.depth * 13;
          const painted = drawScreenSprite(
            context,
            i % 4 ? i % 8 : 12 + (Math.floor(i / 4) % 4),
            -flake / 2,
            -flake / 2,
            flake,
            flake * (i % 4 ? 1.5 : 1),
          );
          context.restore();
          if (painted) continue;
          context.fillStyle =
            i % 4 ? `rgba(170,163,150,${opacity * 0.3})` : `rgba(255,174,86,${opacity})`;
          context.beginPath();
          context.ellipse(x, y, 0.5 + p.depth * 1.8, 1 + p.depth * 3, p.phase, 0, 7);
          context.fill();
        } else if (event.preset === 'arcane') {
          const radius = ((motion * 0.1 + p.y) % 1) * Math.hypot(width, height) * 0.6,
            a = p.phase + motion * 0.08;
          x = width * 0.5 + Math.cos(a) * radius;
          y = height * 0.5 + Math.sin(a) * radius;
          context.fillStyle = `rgba(208,184,244,${opacity * 0.65})`;
          context.beginPath();
          context.arc(x, y, 0.6 + p.depth * 2, 0, 7);
          context.fill();
        } else if (i < 14) {
          x = (i % 2 ? width : 0) + Math.sin(motion * 0.4 + p.phase) * width * 0.12;
          y = p.y * height;
          const mist = context.createRadialGradient(x, y, 0, x, y, 100 + p.depth * 100);
          mist.addColorStop(0, `rgba(143,170,182,${opacity * 0.09})`);
          mist.addColorStop(1, 'transparent');
          context.fillStyle = mist;
          context.fillRect(x - 200, y - 200, 400, 400);
        }
      }
      if (event.preset === 'arcane') {
        const radius = ((t * 0.2) % 1) * Math.hypot(width, height) * 0.65;
        context.globalAlpha = alpha * (1 - ((t * 0.2) % 1)) * 0.3;
        context.strokeStyle = '#c4a5ee';
        context.lineWidth = 5;
        context.beginPath();
        context.ellipse(width / 2, height / 2, radius, radius * 0.65, 0, 0, 7);
        context.stroke();
      }
      context.globalAlpha = 1;
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      resetShake();
      context.clearRect(0, 0, width, height);
    };
  }, [event?.id, event?.duration, event?.intensity, event?.sceneId, sceneId, enabled]);
  return (
    <canvas
      ref={canvas}
      className="vtt-screen-overlay"
      aria-hidden="true"
      data-screen-effect={enabled && event?.sceneId === sceneId ? event?.preset : undefined}
    />
  );
}
