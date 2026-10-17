import { useEffect, useRef } from 'react';
import type { House2Item, House2Plot } from '../shared/house-v2';
import { house2Contains } from '../shared/house2-tokens';
import { house2LightItems } from '../shared/house2-items-lighting';
import { useSoundEffects } from './SiteMusic';
export function useHouse2ItemSounds(
  items: House2Item[],
  plots: House2Plot[],
  interior: string | null,
  listener: { x: number; y: number },
  scene: string | null,
  isolated = false,
) {
  const effects = useSoundEffects(),
    state = useRef(effects);
  state.current = effects;
  const loops = useRef(new Map<string, HTMLAudioElement>()),
    previous = useRef(new Map<string, boolean>()),
    sceneRef = useRef(scene);
  useEffect(() => {
    if (sceneRef.current !== scene) {
      previous.current.clear();
      for (const a of loops.current.values()) a.pause();
      loops.current.clear();
      sceneRef.current = scene;
    }
    const audible = new Set<string>();
    for (const item of items) {
      const spec = house2LightItems[item.catalog_id];
      if (!spec || item.x === null || item.y === null) continue;
      const inside = plots.find((p) => p.house_id && house2Contains(p, { x: item.x!, y: item.y! })),
        distance = Math.hypot(item.x - listener.x, item.y - listener.y),
        heard =
          (!inside || inside.id === interior) &&
          (!isolated || inside?.id === interior) &&
          distance < spec.radius * 3,
        old = previous.current.get(item.id);
      if (
        old !== undefined &&
        old !== !!item.light_on &&
        heard &&
        !effects.muted &&
        effects.volume > 0 &&
        !document.hidden
      ) {
        const sound = new Audio(
          `/audio/vtt/sfx-${spec.sound === 'lamp' ? 'lantern' : 'torch'}-${item.light_on ? 'light' : 'out'}.ogg`,
        );
        sound.volume = effects.volume * 0.55;
        void sound.play().catch(() => {});
      }
      previous.current.set(item.id, !!item.light_on);
      if (item.light_on && heard && spec.sound !== 'candle') {
        audible.add(item.id);
        let a = loops.current.get(item.id);
        if (!a) {
          a = new Audio(`/audio/vtt/${spec.sound === 'fire' ? 'amb-hearth' : 'amb-oil-lamp'}.ogg`);
          a.loop = true;
          a.preload = 'none';
          loops.current.set(item.id, a);
        }
        a.volume =
          effects.volume *
          (spec.sound === 'fire' ? 0.38 : 0.12) *
          Math.max(0, 1 - distance / (spec.radius * 3));
        if (effects.muted || effects.volume === 0 || document.hidden) a.pause();
        else void a.play().catch(() => {});
      }
    }
    for (const [id, a] of loops.current)
      if (!audible.has(id)) {
        a.pause();
        a.removeAttribute('src');
        a.load();
        loops.current.delete(id);
      }
  }, [
    items,
    plots,
    interior,
    listener.x,
    listener.y,
    scene,
    effects.muted,
    effects.volume,
    isolated,
  ]);
  useEffect(() => {
    const sync = () => {
      for (const a of loops.current.values())
        if (document.hidden || state.current.muted || state.current.volume === 0) a.pause();
        else void a.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', sync);
    document.addEventListener('pointerdown', sync);
    document.addEventListener('keydown', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
      document.removeEventListener('pointerdown', sync);
      document.removeEventListener('keydown', sync);
      for (const a of loops.current.values()) a.pause();
      loops.current.clear();
    };
  }, []);
}
