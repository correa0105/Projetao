import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { createRealityFog, GINNA_RUPTURE_DURATION } from './ginna-reality';
import { createGinnaEntryAudio } from './ginna-entry-audio';
import { useSoundEffects } from './SiteMusic';

/** Open a central fissure; change scenes only after its mist covers everything. */
export function GinnaEntry({
  ready,
  overlayRef,
  onCovered,
  onFinished,
}: {
  ready: boolean;
  overlayRef?: RefObject<HTMLDialogElement | null>;
  onCovered: () => void;
  onFinished: () => void;
}) {
  const ownDialog = useRef<HTMLDialogElement>(null);
  const dialog = overlayRef || ownDialog;
  const canvas = useRef<HTMLCanvasElement>(null);
  const fog = useRef<ReturnType<typeof createRealityFog> | null>(null);
  const sound = useRef<ReturnType<typeof createGinnaEntryAudio> | null>(null);
  const [phase, setPhase] = useState('closing');
  const [covered, setCovered] = useState(false);
  const reduced = useRef(false);
  const effects = useSoundEffects();
  const settings = useRef(effects);
  settings.current = effects;

  useLayoutEffect(() => {
    const overlay = dialog.current!;
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    overlay.dataset.motion = reduced.current ? 'reduced' : 'full';
    fog.current = createRealityFog(canvas.current!, reduced.current);
    overlay.showModal();
    return () => {
      overlay.close();
      fog.current?.destroy();
      fog.current = null;
    };
  }, [dialog]);

  useEffect(() => {
    sound.current?.setSettings({ muted: effects.muted, volume: effects.volume });
  }, [effects.muted, effects.volume]);

  useEffect(() => {
    let frame = 0,
      cancelled = false,
      elapsed = 0,
      last = performance.now();
    const player = createGinnaEntryAudio(dialog.current!, reduced.current, settings.current);
    sound.current = player;
    const visibility = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', visibility);
    const duration = reduced.current ? 150 : GINNA_RUPTURE_DURATION;
    const draw = (time: number) => {
      if (cancelled) return;
      if (!document.hidden) elapsed += Math.max(0, Math.min(64, time - last));
      last = time;
      const p = Math.min(1, elapsed / duration);
      fog.current?.draw(p);
      player.update(elapsed);
      if (p < 1) frame = requestAnimationFrame(draw);
      else {
        player.finish();
        setPhase('closed');
        setCovered(true);
        onCovered();
      }
    };
    void player.ready.then(() => {
      if (!cancelled) {
        last = performance.now();
        frame = requestAnimationFrame(draw);
      }
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
      player.dispose();
      if (sound.current === player) sound.current = null;
    };
  }, [onCovered, dialog]);

  useEffect(() => {
    if (!covered || !ready) return;
    let frame = 0,
      cancelled = false,
      elapsed = 0,
      last = performance.now();
    const visibility = () => {
      last = performance.now();
    };
    document.addEventListener('visibilitychange', visibility);
    const hold = window.setTimeout(
      () => {
        setPhase('opening');
        last = performance.now();
        const duration = reduced.current ? 240 : 1550;
        const draw = (time: number) => {
          if (cancelled) return;
          if (!document.hidden) elapsed += Math.max(0, Math.min(64, time - last));
          last = time;
          const p = Math.min(1, elapsed / duration);
          fog.current?.draw(p, true);
          if (p < 1) frame = requestAnimationFrame(draw);
          else {
            dialog.current?.close();
            onFinished();
          }
        };
        frame = requestAnimationFrame(draw);
      },
      reduced.current ? 80 : 180,
    );
    return () => {
      cancelled = true;
      clearTimeout(hold);
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [covered, ready, onFinished, dialog]);

  return (
    <dialog
      ref={dialog}
      className="ginna-entry"
      data-phase={phase}
      aria-label="Uma fissura rompe a realidade e a névoa escura revela Ginna"
      onCancel={(event) => event.preventDefault()}
    >
      <canvas ref={canvas} className="ginna-reality-fog" aria-hidden="true" />
    </dialog>
  );
}
