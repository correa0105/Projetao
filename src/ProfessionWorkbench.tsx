import { useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent } from 'react';
import { Check } from 'lucide-react';
import type { Profession } from '../shared/professions';
import {
  professionActionMotion,
  professionGesture,
  professionToolArtwork,
  professionWork,
} from '../shared/profession-production';
import { professionTechnique, specializedProfessionBenches } from '../shared/profession-techniques';
import {
  insideSurface,
  professionSurface,
  professionView,
  projectOnSurface,
  type WorkPoint,
} from './profession-work-surfaces';
import { techniquePose } from './profession-motion';
import { ProfessionSurfaceFeedback } from './ProfessionSurfaceFeedback';
import './profession-workbench.css';
import './profession-contact.css';
import './profession-techniques.css';

type Mark = { id: number; points: WorkPoint[] };
type Drag = {
  id: number;
  last: WorkPoint;
  distance: number;
  angle: number;
  travel: number;
  started: number;
  credited: boolean;
  automated: boolean;
};
export function ProfessionWorkbench(props: {
  profession: Profession;
  enabled: boolean;
  ready: boolean;
  animating: boolean;
  onWork: () => void;
  pending: boolean;
  swingRequest: number;
  completedActions?: number;
}) {
  const { profession, enabled, ready, pending, swingRequest } = props;
  const work = professionWork(profession.id),
    gesture = professionGesture(profession.id),
    technique = professionTechnique(profession.id);
  const surface = professionSurface(profession.id),
    motion = professionActionMotion(profession.id),
    view = professionView(profession.id);
  const uid = useId().replace(/[^a-z0-9_-]/gi, ''),
    description = uid + '-instruction';
  const board = useRef<SVGSVGElement>(null),
    frame = useRef(0),
    sequence = useRef(0),
    hold = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(props);
  latest.current = props;
  const initialCount = useRef(props.completedActions ?? 0);
  const rotationValue = useRef(0);
  const cycle = useRef(false),
    reduced = useRef(false),
    activeMark = useRef<number | null>(null),
    drag = useRef<Drag | null>(null),
    localStep = useRef(0);
  const [contact, setContact] = useState<WorkPoint>({ x: surface.x, y: surface.y });
  const [hover, setHover] = useState(false),
    [working, setWorking] = useState(false),
    [phase, setPhase] = useState(0);
  const [rotation, setRotation] = useState(0),
    [tilt, setTilt] = useState(0),
    [lift, setLift] = useState(0);
  const [marks, setMarks] = useState<Mark[]>([]),
    [impact, setImpact] = useState<Mark | null>(null);
  const [strike, setStrike] = useState<(WorkPoint & { id: number }) | null>(null);
  const bench = specializedProfessionBenches.has(profession.id)
    ? '/professions/techniques-20261115/' + profession.id + '-bench.webp'
    : profession.id === 'brewing'
      ? '/professions/mixtures-20261114/brewery-bench.webp'
      : '/professions/actions-20261114/' + work.bench + '-bench.webp';
  function clearHold() {
    if (hold.current) clearTimeout(hold.current);
    hold.current = null;
  }
  function stop() {
    cancelAnimationFrame(frame.current);
    clearHold();
    cycle.current = false;
    drag.current = null;
    activeMark.current = null;
    setWorking(false);
    setStrike(null);
    setLift(0);
    setHover(false);
    setPhase(0);
  }
  useEffect(
    () => () => {
      cancelAnimationFrame(frame.current);
      clearHold();
    },
    [],
  );
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
    const matrix = board.current?.getScreenCTM();
    if (!matrix) return null;
    const mapped = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    const p = { x: mapped.x, y: mapped.y },
      scale = Math.hypot(matrix.a, matrix.b);
    // Generous acquisition zone on both mouse and touch; the tool stays on the actual material.
    const padding = (e.pointerType === 'touch' ? 36 : 25) / scale;
    const hit = { ...surface, rx: surface.rx + padding, ry: surface.ry + padding };
    return insideSurface(p, hit) ? projectOnSurface(p, surface) : null;
  }
  function scale() {
    const m = board.current?.getScreenCTM();
    return m ? Math.hypot(m.a, m.b) : 1;
  }
  const leavesTrail = ![
    'hammer',
    'swirl',
    'grind',
    'dose',
    'mash',
    'scoop',
    'seal',
    'pluck',
    'piece',
    'facet',
    'gear',
    'pick',
    'glass',
  ].includes(technique.id);
  function mark(p: WorkPoint, fresh = false) {
    if (!leavesTrail) return;
    if (fresh || activeMark.current === null) {
      const id = ++sequence.current;
      activeMark.current = id;
      setMarks((old) => [...old.slice(-39), { id, points: [p] }]);
    } else {
      const id = activeMark.current;
      setMarks((old) =>
        old.map((m) =>
          m.id === id && m.points.length < 250 ? { ...m, points: [...m.points, p] } : m,
        ),
      );
    }
  }
  function credit(p: WorkPoint, reflect = true) {
    localStep.current++;
    if (reflect && gesture.mode !== 'strike') setImpact({ id: ++sequence.current, points: [p] });
    if (latest.current.enabled && !latest.current.pending) latest.current.onWork();
  }
  function rotateMaterial(value: number) {
    rotationValue.current = value;
    setRotation(value);
  }
  function animate(anchor: WorkPoint, repeat = false, settle = false) {
    if (!latest.current.enabled || latest.current.pending || cycle.current) return;
    clearHold();
    cycle.current = true;
    setWorking(true);
    activeMark.current = null;
    const start = performance.now(),
      duration = settle ? 650 : motion.duration,
      step = initialCount.current + localStep.current,
      initialRotation = rotationValue.current;
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
      let point = anchor;
      setPhase(t);
      if (gesture.mode !== 'strike' && !settle) {
        const pose = techniquePose(technique.id, t, anchor, surface, step);
        point = pose;
        if (!reduced.current) {
          setContact(pose);
          setTilt(pose.tilt);
          setLift(pose.lift);
          rotateMaterial(initialRotation + pose.rotation);
        }
        mark(pose);
      }
      if (
        !surface.liquid &&
        !flashed &&
        now - start >= (settle ? duration * 0.65 : motion.impact)
      ) {
        flashed = true;
        setImpact({ id: ++sequence.current, points: [point] });
      }
      if (t < 1) frame.current = requestAnimationFrame(tick);
      else {
        cycle.current = false;
        setWorking(false);
        setStrike(null);
        setLift(0);
        activeMark.current = null;
        credit(anchor, false);
        if (repeat && drag.current) {
          drag.current.credited = true;
          const again = () => {
            if (!drag.current || !latest.current.enabled) return;
            if (latest.current.pending) {
              hold.current = setTimeout(again, 100);
              return;
            }
            animate(drag.current.last, true);
          };
          hold.current = setTimeout(again, 90);
        }
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
      automated: false,
    };
    setHover(true);
    setWorking(true);
    setContact(p);
    setPhase(0);
    mark(p, true);
    hold.current = setTimeout(() => {
      const d = drag.current;
      if (d) {
        d.automated = true;
        animate(d.last, true);
      }
    }, 220);
  }
  function move(e: PointerEvent<HTMLDivElement>) {
    if (!enabled || !e.isPrimary) return;
    const p = locate(e);
    setHover(!!p);
    const d = drag.current;
    if (!p) return;
    if (cycle.current) {
      if (d?.id === e.pointerId) d.last = p;
      return;
    }
    if (!d) {
      if (!surface.liquid) setContact(p);
      return;
    }
    if (d.id !== e.pointerId) return;
    const distance = Math.hypot(p.x - d.last.x, p.y - d.last.y);
    if (distance < 1) return;
    clearHold();
    d.automated = false;
    const a = Math.atan2((p.y - surface.y) / surface.ry, (p.x - surface.x) / surface.rx),
      delta = Math.atan2(Math.sin(a - d.angle), Math.cos(a - d.angle));
    if (Math.abs(delta) < Math.PI / 2) d.travel += Math.abs(delta);
    d.angle = a;
    d.distance += distance * scale();
    d.last = p;
    const circular = ['swirl', 'facet', 'gear'].includes(technique.id),
      progress = circular ? Math.max(d.travel / Math.PI, d.distance / 95) : d.distance / 75;
    setContact(p);
    setTilt(technique.id === 'weave' ? 0 : Math.sin(progress * Math.PI) * 9);
    setLift(0);
    setPhase(Math.min(1, progress));
    if (surface.liquid)
      rotateMaterial(
        technique.id === 'grind'
          ? Math.sin(progress * 5) * 12
          : technique.id === 'dose'
            ? 0
            : progress * 95,
      );
    mark(p);
    if (progress >= 1 && performance.now() - d.started >= 650 && !latest.current.pending) {
      credit(p);
      d.credited = true;
      d.distance = 0;
      d.travel = 0;
      d.started = performance.now();
      activeMark.current = null;
      setPhase(0);
    }
  }
  function end(e: PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    clearHold();
    drag.current = null;
    activeMark.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (e.type === 'pointercancel') {
      stop();
      return;
    }
    if (!cycle.current) {
      setWorking(false);
      if (!d.credited && locate(e)) animate(d.last, false, d.distance > 12);
    }
    if (e.pointerType !== 'mouse') setHover(false);
  }
  const toolW =
    gesture.tool === 'brewing-paddle'
      ? 240
      : gesture.tool === 'lute-plectrum'
        ? 75
        : gesture.tool === 'weaving-shuttle'
          ? 175
          : gesture.tool === 'woodworking-plane'
            ? 185
            : surface.liquid
              ? 185
              : gesture.mode === 'strike'
                ? 255
                : 155;
  const toolH = gesture.tool === 'brewing-paddle' ? (toolW * 2) / 3 : toolW;
  const hint =
    technique.hint +
    (gesture.mode === 'strike' ? '' : ' Um toque executa uma ação; segurar repete o gesto.');
  return (
    <>
      <div
        className={
          'pf-craft-scene pf-contact-scene pf-scene-' +
          work.bench +
          ' pf-technique-' +
          technique.id +
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
          clearHold();
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
          viewBox={view.join(' ')}
          aria-hidden="true"
          data-bench={profession.id}
          data-technique={technique.id}
          data-contact-x={contact.x}
          data-contact-y={contact.y}
        >
          <defs>
            <mask
              id={uid + '-surface'}
              maskUnits="userSpaceOnUse"
              x="0"
              y="0"
              width="960"
              height="640"
            >
              <ellipse
                cx={surface.x}
                cy={surface.y}
                rx={surface.rx}
                ry={surface.ry}
                fill="white"
                transform={`rotate(${surface.angle} ${surface.x} ${surface.y})`}
              />
              {surface.holes.map((h, i) => (
                <ellipse key={i} cx={h.x} cy={h.y} rx={h.rx} ry={h.ry} fill="black" />
              ))}
            </mask>
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
                transform={`rotate(${surface.angle} ${surface.x} ${surface.y})`}
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
          <path
            className="pf-technique-guide"
            mask={'url(#' + uid + '-surface)'}
            d={
              'M' +
              Array.from({ length: 36 }, (_, i) => {
                const p = techniquePose(
                  technique.id,
                  i / 35,
                  { x: surface.x, y: surface.y },
                  surface,
                  0,
                );
                return p.x + ',' + p.y;
              }).join(' L')
            }
          />
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
            mask={'url(#' + uid + '-surface)'}
            className={
              'pf-contact-marks pf-marks-' +
              gesture.mode +
              (profession.id === 'painting' ? ' is-painting' : '')
            }
          >
            <ProfessionSurfaceFeedback
              technique={technique.id}
              surface={surface}
              working={working}
              phase={reduced.current ? 0 : phase}
              impact={impact}
            />
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
            transform={`rotate(${surface.angle} ${surface.x} ${surface.y})`}
          />
          {gesture.mode !== 'strike' && (
            <g
              className="pf-contact-tool"
              data-tool={gesture.tool}
              transform={`translate(${contact.x} ${contact.y + lift}) rotate(${tilt})`}
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
                  ? technique.action
                  : 'Sua oficina está trabalhando'}
            </>
          )}
        </span>
      </div>
      {enabled && (
        <div className="pf-gesture-status" data-active={working}>
          <span>{working ? technique.working : 'Toque na peça ou use a ferramenta'}</span>
          <progress
            max="100"
            value={working ? Math.round(phase * 100) : 0}
            aria-label="Gesto em andamento"
          />
        </div>
      )}
      {enabled && (
        <p className="pf-workbench-instruction" id={description}>
          {hint} Enter ou espaço completa uma ação. Dez ações reduzem até 30 minutos.
        </p>
      )}
    </>
  );
}
