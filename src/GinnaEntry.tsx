import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { createRealityFog, realityShards } from './ginna-reality';

/** Fracture the current scene; change reality only after the dark mist covers it. */
export function GinnaEntry({
  ready,
  sceneRef,
  overlayRef,
  onCovered,
  onFinished,
}: {
  ready: boolean;
  sceneRef: RefObject<HTMLElement | null>;
  overlayRef?: RefObject<HTMLDialogElement | null>;
  onCovered: () => void;
  onFinished: () => void;
}) {
  const ownDialog = useRef<HTMLDialogElement>(null);
  const dialog = overlayRef || ownDialog;
  const canvas = useRef<HTMLCanvasElement>(null);
  const pieces = useRef<HTMLDivElement>(null);
  const fog = useRef<ReturnType<typeof createRealityFog> | null>(null);
  const [phase, setPhase] = useState('closing');
  const [covered, setCovered] = useState(false);
  const reduced = useRef(false);
  const shards = useMemo(realityShards, []);

  useLayoutEffect(() => {
    const overlay = dialog.current!;
    const fracture = pieces.current;
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches;
    overlay.dataset.motion = reduced.current ? 'reduced' : 'full';
    if (!reduced.current) {
      // Inert copies preserve the actual portrait, animal and UI in each falling piece.
      // Copy only this scene, stripping modals, hidden pages and media players.
      const source = sceneRef.current?.closest<HTMLElement>('.main-shell');
      if (source && pieces.current) {
        const rect = source.getBoundingClientRect();
        const snapshot = document.createElement('div');
        snapshot.className = 'app-shell ginna-reality-snapshot';
        snapshot.dataset.page = 'stable';
        snapshot.inert = true;
        const copy = source.cloneNode(true) as HTMLElement;
        copy.querySelectorAll('dialog, audio, video, [hidden]').forEach((node) => node.remove());
        copy.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
        Object.assign(copy.style, {
          position: 'absolute',
          left: rect.left + 'px',
          top: rect.top + 'px',
          width: rect.width + 'px',
          height: rect.height + 'px',
          margin: '0',
        });
        snapshot.append(copy);
        pieces.current
          .querySelectorAll('.ginna-reality-piece')
          .forEach((piece) => piece.append(snapshot.cloneNode(true)));
      }
    }
    fog.current = createRealityFog(canvas.current!, reduced.current);
    overlay.showModal();
    return () => {
      overlay.close();
      fog.current?.destroy();
      fog.current = null;
      fracture?.querySelectorAll('.ginna-reality-snapshot').forEach((copy) => copy.remove());
    };
  }, [dialog, sceneRef]);

  useEffect(() => {
    let frame = 0,
      cancelled = false;
    const animations: Animation[] = [];
    if (!reduced.current) {
      dialog
        .current!.querySelectorAll<HTMLElement>('.ginna-reality-piece')
        .forEach((piece, index) => {
          const shard = shards[index];
          animations.push(
            piece.animate(
              [
                { transform: 'translate3d(0,0,0) rotate(0)', opacity: 1 },
                {
                  transform: `translate3d(${(shard.x - 70) * 0.15}vw,2vh,-30px) rotate(${shard.turn * 0.1}deg)`,
                  opacity: 1,
                  offset: 0.18,
                },
                {
                  transform: `translate3d(${(shard.x - 50) * 0.8}vw,130vh,-260px) rotate(${shard.turn}deg)`,
                  opacity: 0,
                },
              ],
              {
                delay: shard.delay,
                duration: 1250,
                easing: 'cubic-bezier(.38,.05,.8,.6)',
                fill: 'both',
              },
            ),
          );
        });
      dialog
        .current!.querySelectorAll<SVGPathElement>('.ginna-reality-cracks path')
        .forEach((path, index) => {
          animations.push(
            path.animate(
              [
                { strokeDashoffset: 1, opacity: 0 },
                { strokeDashoffset: 0, opacity: 1 },
              ],
              { duration: 470, delay: index * 19, fill: 'both' },
            ),
          );
        });
    }
    const started = performance.now(),
      duration = reduced.current ? 150 : 2700;
    const draw = (time: number) => {
      if (cancelled) return;
      const p = Math.min(1, (time - started) / duration);
      fog.current?.draw(p);
      if (p < 1) frame = requestAnimationFrame(draw);
      else {
        setPhase('closed');
        setCovered(true);
        onCovered();
      }
    };
    frame = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      animations.forEach((a) => a.cancel());
    };
  }, [onCovered, dialog, shards]);

  useEffect(() => {
    if (!covered || !ready) return;
    let frame = 0,
      cancelled = false;
    const hold = window.setTimeout(
      () => {
        setPhase('opening');
        const started = performance.now(),
          duration = reduced.current ? 240 : 1550;
        const draw = (time: number) => {
          if (cancelled) return;
          const p = Math.min(1, (time - started) / duration);
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
    };
  }, [covered, ready, onFinished, dialog]);

  return (
    <dialog
      ref={dialog}
      className="ginna-entry"
      data-phase={phase}
      aria-label="A realidade se quebra e uma névoa escura revela Ginna"
      onCancel={(event) => event.preventDefault()}
    >
      {phase === 'closing' && (
        <div className="ginna-reality-fracture" ref={pieces} aria-hidden="true">
          {shards.map((shard, index) => (
            <div
              key={index}
              className="ginna-reality-piece"
              style={{
                clipPath: `polygon(${shard.points.map((p) => `${p.x}% ${p.y}%`).join(',')})`,
                transformOrigin: `${shard.x}% ${shard.y}%`,
              }}
            />
          ))}
          <svg className="ginna-reality-cracks" viewBox="0 0 100 100" preserveAspectRatio="none">
            {shards.map((shard, index) => (
              <path
                key={index}
                pathLength="1"
                d={'M' + shard.points.map((p) => `${p.x},${p.y}`).join('L') + 'Z'}
              />
            ))}
          </svg>
        </div>
      )}
      <canvas ref={canvas} className="ginna-reality-fog" aria-hidden="true" />
    </dialog>
  );
}
