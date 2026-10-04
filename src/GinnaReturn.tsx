import { useEffect, useRef, useState } from 'react';
import { GinnaTentacles, animateGinnaTentacles } from './GinnaTentacles';
import { useMusicInterlude } from './SiteMusic';
import { createGinnaTentacleAudio } from './ginna-tentacle-audio';

/** Cover the nightmare before changing the scene; reopen onto the actual stable. */
export function GinnaReturn({
  onCovered,
  onFinished,
}: {
  onCovered: () => void;
  onFinished: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState('reaching');
  const { muted, volume } = useMusicInterlude();
  const settings = useRef({ muted, volume });
  settings.current = { muted, volume };
  const sound = useRef<ReturnType<typeof createGinnaTentacleAudio> | null>(null);
  useEffect(() => sound.current?.setSettings({ muted, volume }), [muted, volume]);

  useEffect(() => {
    const overlay = dialog.current!;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lids = Array.from(overlay.querySelectorAll<HTMLElement>('.ginna-return-lid'));
    const animations: Animation[] = [];
    let cancelled = false;
    let hold: number;
    let releaseHold: (() => void) | undefined;
    overlay.dataset.motion = reduced ? 'reduced' : 'full';
    overlay.showModal();
    const audio = createGinnaTentacleAudio(overlay, reduced, settings.current);
    sound.current = audio;
    let tentacles: ReturnType<typeof animateGinnaTentacles> | undefined;

    async function moveLids(closing: boolean) {
      const motions = lids.map((lid, index) => {
        const open = reduced
          ? { opacity: 0 }
          : { transform: `translateY(${index === 0 ? '-100%' : '100%'})` };
        const closed = reduced ? { opacity: 1 } : { transform: 'translateY(0)' };
        const animation = lid.animate(closing ? [open, closed] : [closed, open], {
          duration: reduced ? (closing ? 120 : 220) : closing ? 420 : 720,
          easing: closing ? 'cubic-bezier(.5,0,.8,.6)' : 'cubic-bezier(.2,.6,.3,1)',
          fill: 'both',
        });
        animations.push(animation);
        return animation.finished.catch(() => {});
      });
      await Promise.all(motions);
    }

    void (async () => {
      await audio.ready;
      if (cancelled) return;
      tentacles = animateGinnaTentacles(overlay, reduced, audio.update);
      await tentacles.finished;
      if (cancelled) return;
      audio.finish();
      setPhase('closing');
      await moveLids(true);
      if (cancelled) return;
      setPhase('closed');
      onCovered();
      await new Promise<void>((resolve) => {
        releaseHold = resolve;
        hold = window.setTimeout(resolve, 380);
      });
      if (cancelled) return;
      setPhase('opening');
      await moveLids(false);
      if (cancelled) return;
      overlay.close();
      onFinished();
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(hold);
      releaseHold?.();
      tentacles?.cancel();
      audio.dispose();
      if (sound.current === audio) sound.current = null;
      animations.forEach((animation) => animation.cancel());
      overlay.close();
    };
  }, [onCovered, onFinished]);

  return (
    <dialog
      ref={dialog}
      className="ginna-return"
      data-phase={phase}
      aria-label="Tentáculos envolvem a visão antes do retorno ao estábulo"
      onCancel={(event) => event.preventDefault()}
    >
      <GinnaTentacles />
      <div className="ginna-return-lid ginna-return-upper" aria-hidden="true" />
      <div className="ginna-return-lid ginna-return-lower" aria-hidden="true" />
    </dialog>
  );
}
