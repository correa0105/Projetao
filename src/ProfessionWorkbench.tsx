import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Check } from 'lucide-react';
import type { Profession } from '../shared/professions';
import {
  professionActionMotion,
  professionGesture,
  professionToolArtwork,
  professionWork,
} from '../shared/profession-production';
import './profession-workbench.css';

type Point = { x: number; y: number };
type Stroke = { id: number; points: Point[]; demo?: boolean };
type Burst = Point & { id: number };
export function ProfessionWorkbench({
  profession,
  enabled,
  ready,
  animating,
  onWork,
  pending,
  swingRequest,
}: {
  profession: Profession;
  enabled: boolean;
  ready: boolean;
  animating: boolean;
  onWork: () => void;
  pending: boolean;
  swingRequest: number;
}) {
  const work = professionWork(profession.id),
    gesture = professionGesture(profession.id),
    description = useId(),
    motion = professionActionMotion(profession.id);
  const scene = useRef<HTMLDivElement>(null),
    drawing = useRef<number | null>(null),
    pointer = useRef<number | null>(null),
    lastPoint = useRef<Point | null>(null),
    sequence = useRef(0),
    lastBurst = useRef(0),
    drawDistance = useRef(0),
    strikeLock = useRef(false),
    strikeTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [inside, setInside] = useState(false),
    [pressed, setPressed] = useState(false),
    [strokes, setStrokes] = useState<Stroke[]>([]),
    [bursts, setBursts] = useState<Burst[]>([]),
    [hammerStrike, setHammerStrike] = useState<Burst | null>(null);
  useEffect(
    () => () => {
      strikeTimers.current.forEach(clearTimeout);
    },
    [],
  );
  useEffect(() => {
    if (!enabled) {
      pointer.current = null;
      drawing.current = null;
      setInside(false);
      setPressed(false);
      strikeTimers.current.forEach(clearTimeout);
      strikeLock.current = false;
      setHammerStrike(null);
    }
  }, [enabled]);
  useEffect(() => {
    if (swingRequest > 0)
      startStrike(
        gesture.mode === 'strike'
          ? { x: 580, y: 205 }
          : gesture.mode === 'draw'
            ? { x: 500, y: 345 }
            : { x: 540, y: 300 },
        true,
      );
  }, [swingRequest]);
  function startStrike(point: Point, drawDemo = false) {
    if (!enabled || pending || strikeLock.current) return;
    strikeLock.current = true;
    const strike = { ...point, id: ++sequence.current };
    setHammerStrike(strike);
    if (gesture.mode === 'draw' && drawDemo) {
      const id = ++sequence.current;
      setStrokes((old) => [
        ...old.slice(-23),
        {
          id,
          demo: true,
          points: Array.from({ length: 18 }, (_, i) => ({
            x: point.x - 45 + i * 5,
            y: point.y + Math.sin(i * 0.4) * 10,
          })),
        },
      ]);
    }
    strikeTimers.current = [
      setTimeout(() => {
        burst(point);
        onWork();
      }, motion.impact),
      setTimeout(() => {
        strikeLock.current = false;
        setHammerStrike(null);
      }, motion.duration),
    ];
  }
  function locate(event: PointerEvent<HTMLDivElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width,
      y = (event.clientY - bounds.top) / bounds.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return null;
    event.currentTarget.style.setProperty('--pointer-x', `${x * 100}%`);
    event.currentTarget.style.setProperty('--pointer-y', `${y * 100}%`);
    return { x: x * 1000, y: y * 625 };
  }
  function burst(point: Point) {
    lastBurst.current = performance.now();
    const id = ++sequence.current;
    setBursts((old) => [...old.slice(-7), { ...point, id }]);
  }
  function begin(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || !event.isPrimary || event.button !== 0) return;
    if (gesture.mode === 'draw' && (pending || strikeLock.current)) return;
    const point = locate(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setInside(true);
    setPressed(true);
    lastPoint.current = point;
    drawDistance.current = 0;
    if (gesture.mode !== 'draw') {
      startStrike(point);
      return;
    }
    if (gesture.mode === 'draw') {
      const id = ++sequence.current;
      drawing.current = id;
      setStrokes((old) => [...old.slice(-23), { id, points: [point] }]);
    }
  }
  function move(event: PointerEvent<HTMLDivElement>) {
    if (!enabled || !event.isPrimary) return;
    const point = locate(event);
    if (!point) {
      setInside(false);
      drawing.current = null;
      lastPoint.current = null;
      return;
    }
    setInside(true);
    if (pointer.current !== event.pointerId) return;
    if (
      lastPoint.current &&
      Math.hypot(point.x - lastPoint.current.x, point.y - lastPoint.current.y) < 3
    )
      return;
    if (lastPoint.current)
      drawDistance.current += Math.hypot(
        point.x - lastPoint.current.x,
        point.y - lastPoint.current.y,
      );
    lastPoint.current = point;
    if (gesture.mode === 'draw') {
      if (drawing.current === null) {
        const id = ++sequence.current;
        drawing.current = id;
        setStrokes((old) => [...old.slice(-23), { id, points: [point] }]);
      } else {
        const strokeId = drawing.current;
        setStrokes((old) =>
          old.map((s) =>
            s.id === strokeId && s.points.length < 320 ? { ...s, points: [...s.points, point] } : s,
          ),
        );
      }
    }
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== event.pointerId) return;
    const donePoint = lastPoint.current,
      complete =
        gesture.mode === 'draw' && drawDistance.current >= 20 && event.type !== 'pointercancel';
    pointer.current = null;
    drawing.current = null;
    lastPoint.current = null;
    setPressed(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.pointerType !== 'mouse') setInside(false);
    if (complete && donePoint) startStrike(donePoint);
  }
  return (
    <>
      <div
        ref={scene}
        className={
          'pf-craft-scene pf-scene-' +
          work.bench +
          ' pf-gesture-' +
          gesture.mode +
          (enabled ? ' is-interactive' : '') +
          (inside && enabled ? ' has-tool-cursor' : '') +
          (pressed ? ' is-pressing' : '') +
          (animating ? ' is-working' : '') +
          (hammerStrike
            ? ' has-tool-action' + (gesture.mode === 'strike' ? ' has-forge-strike' : '')
            : '') +
          (ready ? ' is-finished' : '')
        }
        role={enabled ? 'button' : 'img'}
        tabIndex={enabled ? 0 : undefined}
        aria-label={
          enabled ? 'Trabalhar na bancada de ' + profession.name : 'Bancada de ' + profession.name
        }
        aria-describedby={enabled ? description : undefined}
        onPointerEnter={(e) => {
          if (enabled && e.pointerType === 'mouse') {
            locate(e);
            setInside(true);
          }
        }}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={() => {
          pointer.current = null;
          drawing.current = null;
          setPressed(false);
        }}
        onPointerLeave={() => setInside(false)}
        onBlur={() => {
          setInside(false);
          setPressed(false);
          drawing.current = null;
          pointer.current = null;
        }}
        onKeyDown={(e) => {
          if (enabled && !e.repeat && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            startStrike(
              gesture.mode === 'strike'
                ? { x: 580, y: 205 }
                : gesture.mode === 'draw'
                  ? { x: 500, y: 345 }
                  : { x: 540, y: 300 },
              true,
            );
          }
        }}
      >
        <div
          className="pf-scene-environment"
          style={{ backgroundImage: `url(${profession.background})` }}
        />
        <div className="pf-scene-light" />
        <img
          className="pf-scene-bench"
          src={'/professions/actions-20261114/' + work.bench + '-bench.webp'}
          alt=""
          draggable={false}
        />
        <img
          className="pf-scene-tool"
          src={professionToolArtwork(gesture.tool)}
          alt=""
          draggable={false}
        />
        <div className="pf-scene-impact" />
        <div className="pf-scene-particles" aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  '--x': `${Math.cos(i * 2.4) * (55 + i * 5)}px`,
                  '--y': `${-30 - (i % 5) * 24}px`,
                  '--delay': `${(i % 6) * 0.035}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        {gesture.mode === 'draw' && (
          <svg
            className="pf-hand-drawing"
            viewBox="0 0 1000 625"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {strokes.map((s) => (
              <path
                key={s.id}
                d={
                  'M' +
                  s.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L') +
                  (s.points.length === 1 ? ' l.1,.1' : '')
                }
                className={
                  (profession.id === 'painting' ? 'is-paint' : '') +
                  (s.demo ? ' pf-demo-stroke' : '')
                }
              />
            ))}
          </svg>
        )}
        {(work.bench === 'mixture' || work.bench === 'cooking' || work.bench === 'kiln') && (
          <div className="pf-scene-steam" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        )}
        <div className="pf-hand-effects" aria-hidden="true">
          {bursts.map((b) => (
            <span
              key={b.id}
              className="pf-hand-burst"
              style={{ left: `${b.x / 10}%`, top: `${b.y / 6.25}%` }}
            >
              <b />
              {Array.from({ length: gesture.mode === 'draw' ? 0 : 10 }, (_, i) => (
                <i
                  key={i}
                  style={
                    {
                      '--dx': `${Math.cos(i * 2.4) * (20 + i * 5)}px`,
                      '--dy': `${Math.sin(i * 2.4) * 35 - 20}px`,
                      '--turn': `${i * 37}deg`,
                    } as CSSProperties
                  }
                />
              ))}
            </span>
          ))}
        </div>
        {gesture.mode === 'strike' && <span className="pf-forge-target" aria-hidden="true" />}
        {hammerStrike && (
          <div
            key={hammerStrike.id}
            className={
              gesture.mode === 'strike'
                ? 'pf-forge-strike'
                : 'pf-manual-action pf-work-' + gesture.mode
            }
            aria-hidden="true"
            style={
              {
                left: hammerStrike.x / 10 + '%',
                top: hammerStrike.y / 6.25 + '%',
                '--strike-duration': motion.duration + 'ms',
                '--hotspot-x': gesture.hotspot[0] + '%',
                '--hotspot-y': gesture.hotspot[1] + '%',
              } as CSSProperties
            }
          >
            <img src={professionToolArtwork(gesture.tool)} alt="" draggable={false} />
          </div>
        )}
        {hammerStrike && gesture.mode !== 'strike' && (
          <div
            className={'pf-action-surface pf-surface-' + gesture.mode}
            aria-hidden="true"
            style={
              {
                left: hammerStrike.x / 10 + '%',
                top: hammerStrike.y / 6.25 + '%',
                '--action-duration': motion.duration + 'ms',
              } as CSSProperties
            }
          >
            <i />
            <i />
            <i />
            <svg viewBox="0 0 100 40">
              <path
                d={
                  gesture.mode === 'stitch'
                    ? 'M10 24L24 18L29 26L43 20L48 27L62 21L67 28L81 22'
                    : 'M10 28Q35 9 52 23T90 17'
                }
              />
            </svg>
          </div>
        )}
        <div
          className="pf-tool-cursor"
          aria-hidden="true"
          data-tool={gesture.tool}
          style={
            {
              '--hotspot-x': gesture.hotspot[0] + '%',
              '--hotspot-y': gesture.hotspot[1] + '%',
            } as CSSProperties
          }
        >
          <img
            key={bursts.at(-1)?.id ?? 0}
            className={bursts.length ? 'is-stroking' : ''}
            src={professionToolArtwork(gesture.tool)}
            draggable={false}
            alt=""
          />
        </div>
        <span className="pf-scene-caption">
          {ready ? (
            <>
              <Check size={14} /> Pronto para recolher
            </>
          ) : (
            <>
              <span className="pf-working-dot" />
              {hammerStrike || pressed || animating
                ? work.working + '…'
                : enabled
                  ? gesture.hint
                  : 'Sua oficina está trabalhando'}
            </>
          )}
        </span>
      </div>
      {enabled && (
        <p className="pf-workbench-instruction" id={description}>
          {gesture.hint}{' '}
          {gesture.mode === 'strike'
            ? 'No celular, toque na peça. Enter ou espaço também dá uma martelada.'
            : 'No celular, toque ou arraste. Enter ou espaço também registra sua ajuda.'}
        </p>
      )}
    </>
  );
}
