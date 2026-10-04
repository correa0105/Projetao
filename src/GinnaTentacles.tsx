import { createGinnaTentacleRenderer, GINNA_TENTACLE_DURATION } from './ginna-tentacle-renderer';

/** The coils close around the visitor before the existing eyelids cover the scene. */
export function animateGinnaTentacles(root: HTMLElement, reduced: boolean) {
  const scene = root.querySelector<HTMLElement>('.ginna-return-tentacles')!;
  const renderer = createGinnaTentacleRenderer(scene, reduced);
  let frame = 0;
  let elapsed = 0;
  let previous = performance.now();
  let completed = false;
  let cancelled = false;
  let finish!: () => void;
  const finished = new Promise<void>((resolve) => {
    finish = resolve;
  });

  const update = (now: number) => {
    if (cancelled || completed || document.hidden) return;
    elapsed += Math.min(80, Math.max(0, now - previous));
    previous = now;
    renderer.draw(reduced ? GINNA_TENTACLE_DURATION : elapsed);
    if (elapsed >= (reduced ? 180 : GINNA_TENTACLE_DURATION)) {
      completed = true;
      document.removeEventListener('visibilitychange', visibility);
      renderer.release();
      finish();
      return;
    }
    frame = requestAnimationFrame(update);
  };
  const visibility = () => {
    cancelAnimationFrame(frame);
    previous = performance.now();
    if (!document.hidden && !cancelled && !completed) frame = requestAnimationFrame(update);
  };
  document.addEventListener('visibilitychange', visibility);
  renderer.draw(reduced ? GINNA_TENTACLE_DURATION : 0);
  if (!document.hidden) frame = requestAnimationFrame(update);

  return {
    finished,
    cancel: () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
      renderer.dispose();
      finish();
    },
  };
}

export function GinnaTentacles() {
  return (
    <div
      className="ginna-return-tentacles"
      aria-hidden="true"
      data-stage="sky"
      data-progress="0"
      data-origin="lake"
    >
      <div
        className="ginna-return-pressure"
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0,
          background: 'radial-gradient(ellipse at 50% 48%, transparent 25%, #0007 72%, #000d 100%)',
        }}
      />
    </div>
  );
}
