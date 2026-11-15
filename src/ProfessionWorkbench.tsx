import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Check } from 'lucide-react';
import type { Profession } from '../shared/professions';
import {
  professionActionMotion,
  professionGesture,
  professionToolArtwork,
  professionWork,
} from '../shared/profession-production';
import { insideSurface, professionSurface, type WorkPoint } from './profession-work-surfaces';
import './profession-workbench.css';
import './profession-contact.css';

type Mark = { id: number; points: WorkPoint[] };
export function ProfessionWorkbench(props: {
  profession: Profession;
  enabled: boolean;
  ready: boolean;
  animating: boolean;
  onWork: () => void;
  pending: boolean;
  swingRequest: number;
}) {
  const { profession, enabled, ready, pending, swingRequest } = props;
  const work = professionWork(profession.id),
    gesture = professionGesture(profession.id);
  const surface = professionSurface(profession.id),
    motion = professionActionMotion(profession.id);
  const uid = useId().replace(/:/g, ''),
    description = uid + '-instruction';
  const board = useRef<SVGSVGElement>(null),
    frame = useRef(0),
    sequence = useRef(0);
  const latest = useRef(props);
  latest.current = props;
  const cycle = useRef(false),
    reduced = useRef(false),
    angle = useRef(0),
    activeMark = useRef<number | null>(null);
  const drag = useRef<null | {
    id: number;
    last: WorkPoint;
    distance: number;
    angle: number;
    travel: number;
    started: number;
    credited: boolean;
    outside: boolean;
  }>(null);
  const [contact, setContact] = useState<WorkPoint>({ x: surface.x, y: surface.y });
  const [hover, setHover] = useState(false),
    [working, setWorking] = useState(false);
  const [phase, setPhase] = useState(0),
    [rotation, setRotation] = useState(0);
  const [marks, setMarks] = useState<Mark[]>([]),
    [impact, setImpact] = useState<Mark | null>(null);
  const [strike, setStrike] = useState<(WorkPoint & { id: number }) | null>(null);
  const bench =
    profession.id === 'brewing'
      ? '/professions/mixtures-20261114/brewery-bench.webp'
      : '/professions/actions-20261114/' + work.bench + '-bench.webp';
  const duration = surface.liquid ? 1400 : motion.duration;
  function stop() {
    cancelAnimationFrame(frame.current);
    cycle.current = false;
    drag.current = null;
    activeMark.current = null;
    setWorking(false);
    setStrike(null);
    setHover(false);
  }
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => {
      reduced.current = media.matches;
    };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!enabled) stop();
  }, [enabled]);
  useEffect(() => {
    if (swingRequest > 0) animate({ x: surface.x, y: surface.y });
  }, [swingRequest]);
  function locate(e: PointerEvent<HTMLDivElement>) {
    const b = board.current?.getBoundingClientRect();
    if (!b?.width || !b.height) return null;
    const p = {
      x: ((e.clientX - b.left) * 960) / b.width,
      y: ((e.clientY - b.top) * 640) / b.height,
    };
    if (insideSurface(p, surface)) return p;
    if (e.pointerType !== 'touch') return null;
    const touchSurface = {
      ...surface,
      rx: Math.max(surface.rx, (22 * 960) / b.width),
      ry: Math.max(surface.ry, (22 * 640) / b.height),
    };
    if (!insideSurface(p, touchSurface)) return null;
    // A finger may cover a thin blade or small gem; keep the visible contact on the object.
    const radius = Math.hypot((p.x - surface.x) / surface.rx, (p.y - surface.y) / surface.ry);
    return {
      x: surface.x + ((p.x - surface.x) * 0.9) / radius,
      y: surface.y + ((p.y - surface.y) * 0.9) / radius,
    };
  }
  function mark(p: WorkPoint, fresh = false) {
    if (surface.liquid || gesture.mode === 'strike') return;
    if (fresh || activeMark.current === null) {
      const id = ++sequence.current;
      activeMark.current = id;
      setMarks((old) => [...old.slice(-39), { id, points: [p] }]);
    } else {
      const id = activeMark.current;
      setMarks((old) =>
        old.map((m) =>
          m.id === id && m.points.length < 300 ? { ...m, points: [...m.points, p] } : m,
        ),
      );
    }
  }
  function credit(p: WorkPoint) {
    if (!surface.liquid && gesture.mode !== 'strike')
      setImpact({ id: ++sequence.current, points: [p] });
    if (latest.current.enabled && !latest.current.pending) latest.current.onWork();
  }
  function liquidPose(a: number) {
    if (reduced.current) {
      setContact({ x: surface.x, y: surface.y });
      setRotation(0);
      angle.current = a;
      return;
    }
    setContact({
      x: surface.x + Math.cos(a) * surface.rx * 0.55,
      y: surface.y + Math.sin(a) * surface.ry * 0.55,
    });
    setRotation((a * 180) / Math.PI);
    angle.current = a;
  }
  function animate(anchor: WorkPoint) {
    if (!latest.current.enabled || latest.current.pending || cycle.current) return;
    cycle.current = true;
    setWorking(true);
    activeMark.current = null;
    const start = performance.now(),
      initialAngle = angle.current;
    let flashed = false;
    if (gesture.mode === 'strike') {
      setContact(anchor);
      setStrike({ ...anchor, id: ++sequence.current });
    }
    function tick(now: number) {
      if (!latest.current.enabled) {
        stop();
        return;
      }
      const t = Math.min(1, (now - start) / duration);
      setPhase(reduced.current ? 0 : t);
      if (surface.liquid) liquidPose(initialAngle + t * Math.PI * 2);
      else if (gesture.mode !== 'strike') {
        const p = {
          x: anchor.x + Math.sin(t * Math.PI * 2) * Math.min(surface.rx * 0.35, 34),
          y:
            anchor.y +
            Math.sin(t * Math.PI * (gesture.mode === 'stitch' ? 8 : 2)) *
              Math.min(surface.ry * 0.3, 9),
        };
        if (insideSurface(p, surface)) {
          if (!reduced.current) setContact(p);
          mark(p);
        }
      }
      if (gesture.mode === 'strike' && !flashed && now - start >= motion.impact) {
        flashed = true;
        setImpact({ id: ++sequence.current, points: [anchor] });
      }
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else {
        cycle.current = false;
        setWorking(false);
        setStrike(null);
        activeMark.current = null;
        credit(anchor);
      }
    }
    frame.current = requestAnimationFrame(tick);
  }
  function begin(e: PointerEvent<HTMLDivElement>) {
    if (!enabled || pending || cycle.current || !e.isPrimary || e.button !== 0) return;
    const p = locate(e);
    if (!p) return;
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    if (gesture.mode === 'strike') {
      setContact(p);
      animate(p);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      last: p,
      distance: 0,
      angle: Math.atan2((p.y - surface.y) / surface.ry, (p.x - surface.x) / surface.rx),
      travel: 0,
      started: performance.now(),
      credited: false,
      outside: false,
    };
    setHover(true);
    setWorking(true);
    setContact(p);
    mark(p, true);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!enabled || cycle.current) return;
    const p = locate(e);
    setHover(!!p);
    const d = drag.current;
    if (!p) {
      activeMark.current = null;
      if (d) {
        d.distance = 0;
        d.travel = 0;
        d.outside = true;
      }
      return;
    }
    if (!d) {
      if (!surface.liquid) setContact(p);
      return;
    }
    if (d.id !== e.pointerId) return;
    if (d.outside) {
      d.last = p;
      d.angle = Math.atan2((p.y - surface.y) / surface.ry, (p.x - surface.x) / surface.rx);
      d.outside = false;
      d.started = performance.now();
      return;
    }
    const distance = Math.hypot(p.x - d.last.x, p.y - d.last.y);
    if (distance < 1) return;
    if (surface.liquid) {
      const a = Math.atan2((p.y - surface.y) / surface.ry, (p.x - surface.x) / surface.rx);
      const delta = Math.atan2(Math.sin(a - d.angle), Math.cos(a - d.angle));
      // Pointer jumps across the bowl do not constitute a stirring cycle.
      if (
        Math.abs(delta) < Math.PI / 2 &&
        Math.hypot((p.x - surface.x) / surface.rx, (p.y - surface.y) / surface.ry) > 0.2
      ) {
        d.travel += Math.abs(delta);
        angle.current += delta;
        liquidPose(angle.current);
      }
      d.angle = a;
    } else {
      setContact(p);
      mark(p);
      d.distance += distance;
    }
    d.last = p;
    if (
      (surface.liquid ? d.travel >= Math.PI * 2 : d.distance >= 110) &&
      performance.now() - d.started >= 900 &&
      !latest.current.pending
    ) {
      credit(p);
      d.credited = true;
      d.distance = 0;
      d.travel = 0;
      d.started = performance.now();
      activeMark.current = null;
    }
  }
  function end(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    activeMark.current = null;
    setWorking(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d.credited && e.type !== 'pointercancel' && locate(e)) animate(d.last);
    if (e.pointerType !== 'mouse') setHover(false);
  }
  const toolW =
    gesture.tool === 'brewing-paddle'
      ? 260
      : surface.liquid
        ? 205
        : gesture.mode === 'strike'
          ? 255
          : 160;
  const toolH = gesture.tool === 'brewing-paddle' ? (toolW * 2) / 3 : toolW;
  const tilt = surface.liquid
    ? Math.sin((rotation * Math.PI) / 180) * 9
    : working && gesture.mode === 'stitch'
      ? Math.sin(phase * Math.PI * 6) * 8
      : 0;
  const hint = surface.liquid
    ? 'Mexa dentro do recipiente: arraste em círculos ou toque para completar uma mistura.'
    : gesture.hint + ' Trabalhe diretamente sobre a peça.';
  return (
    <>
      <div
        className={
          'pf-craft-scene pf-contact-scene pf-scene-' +
          work.bench +
          ' pf-gesture-' +
          gesture.mode +
          (enabled ? ' is-interactive' : '') +
          (hover ? ' is-on-piece' : '') +
          (working ? ' is-contact-working' : '')
        }
        role={enabled ? 'button' : 'img'}
        tabIndex={enabled ? 0 : undefined}
        aria-label={'Trabalhar na bancada de ' + profession.name}
        aria-describedby={description}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onLostPointerCapture={() => {
          drag.current = null;
          activeMark.current = null;
          if (!cycle.current) setWorking(false);
        }}
        onPointerLeave={() => setHover(false)}
        onBlur={() => {
          if (!cycle.current) {
            drag.current = null;
            setWorking(false);
          }
          setHover(false);
        }}
        onKeyDown={(e) => {
          if (!e.repeat && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            animate({ x: surface.x, y: surface.y });
          }
        }}
      >
        <div
          className="pf-scene-environment"
          style={{ backgroundImage: `url(${profession.background})` }}
        />
        <svg
          ref={board}
          className="pf-contact-board"
          viewBox="0 0 960 640"
          aria-hidden="true"
          data-bench={profession.id}
        >
          <defs>
            <clipPath id={uid + '-surface'}>
              <ellipse cx={surface.x} cy={surface.y} rx={surface.rx} ry={surface.ry} />
            </clipPath>
            <radialGradient id={uid + '-fade'}>
              <stop offset="75%" stopColor="white" />
              <stop offset="100%" stopColor="black" />
            </radialGradient>
            <mask id={uid + '-liquid'}>
              <ellipse
                cx={surface.x}
                cy={surface.y}
                rx={surface.rx}
                ry={surface.ry}
                fill={'url(#' + uid + '-fade)'}
              />
            </mask>
            <linearGradient id={uid + '-lip-fade'} x1="0" y1="0" x2="0" y2="1">
              <stop stopColor="black" />
              <stop offset=".1" stopColor="white" />
            </linearGradient>
            <mask id={uid + '-lip'}>
              <rect
                x={surface.x - surface.rx - 24}
                y={surface.y + surface.ry * 0.65}
                width={surface.rx * 2 + 48}
                height="190"
                fill={'url(#' + uid + '-lip-fade)'}
              />
            </mask>
          </defs>
          <image className="pf-contact-art" href={bench} width="960" height="640" />
          {surface.liquid && (
            <g mask={'url(#' + uid + '-liquid)'}>
              <image
                className="pf-liquid-texture"
                href={bench}
                width="960"
                height="640"
                transform={`translate(${surface.x} ${surface.y}) scale(1 ${surface.ry / surface.rx}) rotate(${rotation}) scale(1 ${surface.rx / surface.ry}) translate(${-surface.x} ${-surface.y})`}
              />
            </g>
          )}
          <g
            clipPath={'url(#' + uid + '-surface)'}
            className={
              'pf-contact-marks pf-marks-' +
              gesture.mode +
              (profession.id === 'painting' ? ' is-painting' : '')
            }
          >
            {marks.map((m) => (
              <path
                key={m.id}
                d={'M' + m.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L')}
              />
            ))}
            {impact && !surface.liquid && (
              <g
                key={impact.id}
                className="pf-contact-impact"
                transform={`translate(${impact.points[0].x} ${impact.points[0].y})`}
              >
                {gesture.mode === 'strike' ? (
                  <>
                    <ellipse className="pf-metal-glow" rx="48" ry="13" />
                  </>
                ) : gesture.mode === 'polish' ? (
                  <path className="pf-polish-glint" d="M-18 0H18M0-18V18M-9-9L9 9M9-9L-9 9" />
                ) : gesture.mode === 'carve' ? (
                  <>
                    {Array.from({ length: 6 }, (_, i) => (
                      <path
                        className="pf-contact-chip"
                        key={i}
                        d={`M${i * 6 - 20} 0l8 ${4 + (i % 3)}l-5 3z`}
                      />
                    ))}
                  </>
                ) : null}
              </g>
            )}
          </g>
          {impact && gesture.mode === 'strike' && (
            <g
              key={'sparks-' + impact.id}
              className="pf-contact-sparks"
              transform={`translate(${impact.points[0].x} ${impact.points[0].y})`}
            >
              {Array.from({ length: 12 }, (_, i) => (
                <path
                  key={i}
                  pathLength="100"
                  d={`M0 0Q${Math.cos(i * 2.4) * 50} ${-25 - i * 3} ${Math.cos(i * 2.4) * 80} ${15 + i * 2}`}
                />
              ))}
            </g>
          )}
          <ellipse
            className="pf-contact-zone"
            data-work-zone="true"
            cx={surface.x}
            cy={surface.y}
            rx={surface.rx}
            ry={surface.ry}
          />
          {gesture.mode !== 'strike' && (
            <g
              className="pf-contact-tool"
              data-tool={gesture.tool}
              transform={`translate(${contact.x} ${contact.y}) rotate(${tilt})`}
            >
              <ellipse className="pf-tool-contact-shadow" rx={surface.liquid ? 16 : 8} ry="3" />
              <image
                href={professionToolArtwork(gesture.tool)}
                x={(-toolW * gesture.hotspot[0]) / 100}
                y={(-toolH * gesture.hotspot[1]) / 100}
                width={toolW}
                height={toolH}
              />
            </g>
          )}
          {surface.liquid && (
            <image
              className="pf-container-lip"
              href={bench}
              width="960"
              height="640"
              mask={'url(#' + uid + '-lip)'}
            />
          )}
          {gesture.mode === 'strike' && (
            <foreignObject
              x={contact.x - 255 * 0.85}
              y={contact.y - 255 * 0.42}
              width="255"
              height="255"
              overflow="visible"
            >
              <div
                key={strike?.id ?? 'rest'}
                className={strike ? 'pf-contact-hammer is-striking' : 'pf-contact-hammer'}
                style={{ '--strike-duration': motion.duration + 'ms' } as CSSProperties}
              >
                <img src={professionToolArtwork(gesture.tool)} alt="" draggable={false} />
              </div>
            </foreignObject>
          )}
        </svg>
        <span className="pf-scene-caption">
          {ready ? (
            <>
              <Check size={14} /> Pronto para recolher
            </>
          ) : (
            <>
              <span className="pf-working-dot" />
              {working
                ? work.working + '…'
                : enabled
                  ? surface.liquid
                    ? 'Trabalhe os ingredientes dentro do recipiente'
                    : 'Toque ou arraste sobre a peça para trabalhar'
                  : 'Sua oficina está trabalhando'}
            </>
          )}
        </span>
      </div>
      {enabled && (
        <p className="pf-workbench-instruction" id={description}>
          {hint} Enter ou espaço completa uma ação. Dez ações reduzem até 30 minutos.
        </p>
      )}
    </>
  );
}
