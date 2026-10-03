import { useEffect, useRef, useState } from 'react';

/** Cover the nightmare before changing the scene; reopen onto the actual stable. */
export function GinnaReturn({
  onCovered,
  onFinished,
}: {
  onCovered: () => void;
  onFinished: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [phase, setPhase] = useState('closing');

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
      animations.forEach((animation) => animation.cancel());
      overlay.close();
    };
  }, [onCovered, onFinished]);

  return (
    <dialog
      ref={dialog}
      className="ginna-return"
      data-phase={phase}
      aria-label="Fechando os olhos e voltando ao estábulo"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="ginna-return-lid ginna-return-upper" aria-hidden="true" />
      <div className="ginna-return-lid ginna-return-lower" aria-hidden="true" />
    </dialog>
  );
}
