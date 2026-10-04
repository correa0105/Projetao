import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** Blink in the visitor's view, changing scenes only behind closed eyelids. */
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
  const [phase, setPhase] = useState('closing');
  const [covered, setCovered] = useState(false);
  const reduced = useRef(false);

  useLayoutEffect(() => {
    const overlay = dialog.current!;
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    overlay.dataset.motion = reduced.current ? 'reduced' : 'full';
    overlay.showModal();
    return () => overlay.close();
  }, [dialog]);

  function moveLids(closing: boolean) {
    return [...dialog.current!.querySelectorAll<HTMLElement>('.ginna-entry-lid')].map(
      (lid, index) => {
        const open = reduced.current
          ? { opacity: 0 }
          : { transform: `translateY(${index === 0 ? '-100%' : '100%'})` };
        const closed = reduced.current ? { opacity: 1 } : { transform: 'translateY(0)' };
        return lid.animate(closing ? [open, closed] : [closed, open], {
          duration: reduced.current ? (closing ? 100 : 160) : closing ? 240 : 360,
          easing: closing ? 'cubic-bezier(.5,0,.8,.6)' : 'cubic-bezier(.2,.6,.3,1)',
          fill: 'both',
        });
      },
    );
  }

  useEffect(() => {
    let cancelled = false;
    const animations = moveLids(true);
    void Promise.all(animations.map((animation) => animation.finished.catch(() => {}))).then(() => {
      if (cancelled) return;
      setPhase('closed');
      setCovered(true);
      onCovered();
    });
    return () => {
      cancelled = true;
      animations.forEach((animation) => animation.cancel());
    };
  }, [onCovered]);

  useEffect(() => {
    if (!covered || !ready) return;
    let cancelled = false;
    let animations: Animation[] = [];
    const hold = window.setTimeout(() => {
      setPhase('opening');
      animations = moveLids(false);
      void Promise.all(animations.map((animation) => animation.finished.catch(() => {}))).then(
        () => {
          if (cancelled) return;
          dialog.current?.close();
          onFinished();
        },
      );
    }, 120);
    return () => {
      cancelled = true;
      window.clearTimeout(hold);
      animations.forEach((animation) => animation.cancel());
    };
  }, [covered, ready, onFinished]);

  return (
    <dialog
      ref={dialog}
      className="ginna-entry"
      data-phase={phase}
      aria-label="Uma piscada revela a visão sombria do estábulo"
      onCancel={(event) => event.preventDefault()}
    >
      <div className="ginna-entry-lid ginna-entry-upper" aria-hidden="true" />
      <div className="ginna-entry-lid ginna-entry-lower" aria-hidden="true" />
    </dialog>
  );
}
