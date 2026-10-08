import { useEffect, useRef, useState } from 'react';
import type { VttMessage, VttScene, VttToken } from '../shared/vtt';
import { viewerSees } from '../shared/vtt';
import { useVttEffectAudio } from './vtt-effect-audio';
import type { VttCamera } from './vtt-canvas';
import {
  drawWeaponAnimation,
  weaponAnimation,
  weaponAnimationDuration,
  type WeaponAnimation,
} from './vtt-weapon-animation';
import './vtt-attack-visuals.css';

export function VttAttackVisuals({
  roomId,
  messages,
  scene,
  camera,
  bounds,
  enabled,
  gm,
  preview,
  viewer,
  soundEnabled,
  soundVolume,
}: {
  roomId: string;
  messages: VttMessage[];
  scene: VttScene;
  camera: VttCamera;
  bounds: { width: number; height: number };
  enabled: boolean;
  gm: boolean;
  preview: boolean;
  viewer: VttToken | null;
  soundEnabled: boolean;
  soundVolume: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    seen = useRef(new Set<string>()),
    initialized = useRef(''),
    events = useRef<WeaponAnimation[]>([]),
    timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  const audio = useVttEffectAudio(soundEnabled, soundVolume),
    sound = audio.play;
  const current = useRef({ scene, camera, bounds, enabled, gm, preview, viewer });
  current.current = { scene, camera, bounds, enabled, gm, preview, viewer };
  const [version, redraw] = useState(0);
  function visible(id: string) {
    const o = current.current,
      t = o.scene.tokens.find((t) => t.id === id && t.layer === 'tokens');
    return t &&
      ((!o.preview && o.gm) ||
        (!t.hidden && (!o.preview || (!!o.viewer && viewerSees(o.viewer, t, o.scene)))))
      ? t
      : undefined;
  }
  useEffect(() => {
    if (initialized.current !== roomId) {
      initialized.current = roomId;
      seen.current = new Set(messages.map((m) => m.id));
      events.current = [];
      return;
    }
    for (const m of messages) {
      if (seen.current.has(m.id)) continue;
      seen.current.add(m.id);
      const e = m.attackVisual;
      if (!e || e.sceneId !== scene.id || Date.now() - new Date(m.created_at).getTime() > 10000)
        continue;
      const actor = visible(e.actor_id),
        target = visible(e.target_id);
      if (!actor || !target) continue;
      events.current = events.current
        .filter((e) => performance.now() - e.started < weaponAnimationDuration)
        .slice(-15);
      if (current.current.enabled)
        events.current.push(weaponAnimation(e, actor, target, m.id, performance.now()));
      sound(
        e.kind === 'arrow' ? '/audio/vtt-attacks/bow-release.wav' : '/audio/vtt/sfx-knifeslice.ogg',
      );
      if (e.hit) {
        const timer = setTimeout(
          () => {
            timers.current.delete(timer);
            if (
              visible(e.actor_id) &&
              visible(e.target_id) &&
              current.current.scene.id === e.sceneId
            )
              sound(
                e.kind === 'arrow'
                  ? '/audio/vtt-attacks/arrow-impact.wav'
                  : '/audio/vtt-attacks/blade-impact.wav',
              );
          },
          e.kind === 'arrow' ? 830 : 500,
        );
        timers.current.add(timer);
      }
      redraw((v) => v + 1);
    }
    // Retain only the recent replay guard, without a growing room history.
    if (seen.current.size > 500) seen.current = new Set(messages.map((m) => m.id));
  }, [roomId, messages, scene.id]);
  useEffect(() => {
    if (!enabled) {
      events.current = [];
      return;
    }
    if (!canvas.current) return;
    const surface = canvas.current,
      c = surface.getContext('2d')!;
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0,
      last = 0;
    const paint = (now: number) => {
      const o = current.current,
        dpr = Math.min(2, devicePixelRatio || 1);
      if (
        surface.width !== Math.round(o.bounds.width * dpr) ||
        surface.height !== Math.round(o.bounds.height * dpr)
      ) {
        surface.width = Math.round(o.bounds.width * dpr);
        surface.height = Math.round(o.bounds.height * dpr);
      }
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, o.bounds.width, o.bounds.height);
      events.current = events.current.filter(
        (e) =>
          now - e.started <= weaponAnimationDuration &&
          e.sceneId === o.scene.id &&
          visible(e.actor_id) &&
          visible(e.target_id),
      );
      c.translate(o.bounds.width / 2, o.bounds.height / 2);
      c.scale(o.camera.zoom, o.camera.zoom);
      c.translate(-o.camera.x, -o.camera.y);
      for (const e of events.current)
        drawWeaponAnimation(
          c,
          e,
          media.matches ? e.started + (e.kind === 'arrow' ? 900 : 600) : now,
        );
      surface.dataset.activeAttacks = String(events.current.length);
    };
    const animate = (now: number) => {
      if (now - last >= 24) {
        paint(now);
        last = now;
      }
      if (events.current.length && !document.hidden) frame = requestAnimationFrame(animate);
    };
    paint(performance.now());
    if (events.current.length && !document.hidden) frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [enabled, version, scene, camera, bounds]);
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
      timers.current.clear();
      events.current = [];
      audio.stop();
    },
    [roomId, audio.stop],
  );
  return enabled ? <canvas className="vtt-attack-visuals" aria-hidden="true" ref={canvas} /> : null;
}
