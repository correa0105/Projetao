import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Check } from 'lucide-react';
import type { Profession } from '../shared/professions';
import { professionGesture, professionWork } from '../shared/profession-production';
import './profession-workbench.css';

type Point = { x: number; y: number };
type Stroke = { id: number; points: Point[] };
type Burst = Point & { id: number };
export function ProfessionWorkbench({
  profession,
  enabled,
  ready,
  animating,
  onWork,
}: {
  profession: Profession;
  enabled: boolean;
  ready: boolean;
  animating: boolean;
  onWork: () => void;
}) {
  const work = professionWork(profession.id),
    gesture = professionGesture(profession.id),
    description = useId();
  const scene = useRef<HTMLDivElement>(null),
    drawing = useRef<number | null>(null),
    pointer = useRef<number | null>(null),
    lastPoint = useRef<Point | null>(null),
    sequence = useRef(0),
    lastBurst = useRef(0);
  const [inside, setInside] = useState(false),
    [pressed, setPressed] = useState(false),
    [strokes, setStrokes] = useState<Stroke[]>([]),
    [bursts, setBursts] = useState<Burst[]>([]);
  useEffect(() => {
    if (!enabled) {
      pointer.current = null;
      drawing.current = null;
      setInside(false);
      setPressed(false);
    }
  }, [enabled]);
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
    const point = locate(event);
    if (!point) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    pointer.current = event.pointerId;
    event.currentTarget.setPointerCapture(event.pointerId);
    setInside(true);
    setPressed(true);
    lastPoint.current = point;
    if (gesture.mode === 'draw') {
      const id = ++sequence.current;
      drawing.current = id;
      setStrokes((old) => [...old.slice(-23), { id, points: [point] }]);
    }
    burst(point);
    onWork();
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
    } else if (gesture.mode !== 'strike' && performance.now() - lastBurst.current > 110)
      burst(point);
  }
  function end(event: PointerEvent<HTMLDivElement>) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    drawing.current = null;
    lastPoint.current = null;
    setPressed(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (event.pointerType !== 'mouse') setInside(false);
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
            burst({ x: 570, y: 275 });
            onWork();
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
          src={'/professions/actions-20261114/' + gesture.tool + '.webp'}
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
                className={profession.id === 'painting' ? 'is-paint' : ''}
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
            src={'/professions/actions-20261114/' + gesture.tool + '.webp'}
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
              {pressed || animating
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
          {gesture.hint} No celular, toque ou arraste. Enter ou espaço também registra sua ajuda.
        </p>
      )}
    </>
  );
}
