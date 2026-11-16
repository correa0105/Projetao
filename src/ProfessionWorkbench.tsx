import { useEffect, useId, useState, type CSSProperties } from 'react';
import { Check } from 'lucide-react';
import type { Profession } from '../shared/professions';
import {
  professionActionMotion,
  professionBenchArtwork,
  professionGesture,
  professionToolArtwork,
  professionWork,
} from '../shared/profession-production';
import { professionTechnique } from '../shared/profession-techniques';
import {
  surfacePath,
  professionSurface,
  professionView,
  type WorkPoint,
} from './profession-work-surfaces';
import { techniquePose } from './profession-motion';
import { ProfessionSurfaceFeedback } from './ProfessionSurfaceFeedback';
import { ProfessionMortarContents, ProfessionMortarFront } from './ProfessionMortarContents';
import { ProfessionLiquidWork, ProfessionPoisonDrop } from './ProfessionLiquidWork';
import { ProfessionGlasswork } from './ProfessionGlasswork';
import './profession-workbench.css';
import './profession-contact.css';
import './profession-techniques.css';
import './profession-full-control.css';
type Mark = { id: number; points: WorkPoint[] };
type SceneFrame = {
  contact: WorkPoint;
  working: boolean;
  phase: number;
  rotation: number;
  tilt: number;
  lift: number;
  marks: Mark[];
  impact: Mark | null;
  strike: (WorkPoint & { id: number }) | null;
};
export function ProfessionWorkbench({
  profession,
  animating,
  ready,
}: {
  profession: Profession;
  animating: boolean;
  ready: boolean;
}) {
  const work = professionWork(profession.id),
    gesture = professionGesture(profession.id),
    technique = professionTechnique(profession.id),
    surface = professionSurface(profession.id),
    motion = professionActionMotion(profession.id),
    view = professionView(profession.id);
  const mortar = ['alchemy', 'herbalism'].includes(profession.id),
    liquidWork = ['brewing', 'poison', 'cooking'].includes(profession.id),
    glasswork = profession.id === 'glassblowing';
  const uid = useId().replace(/[^a-z0-9_-]/gi, ''),
    bench = professionBenchArtwork(profession.id);
  const idle = (): SceneFrame => ({
    contact: { x: surface.x, y: surface.y },
    working: false,
    phase: 0,
    rotation: 0,
    tilt: 0,
    lift: technique.id === 'dose' ? -32 : technique.id === 'mash' ? 6 : 0,
    marks: [],
    impact: null,
    strike: null,
  });
  const [scene, setScene] = useState<SceneFrame>(idle),
    [reducedMotion, setReducedMotion] = useState(
      () =>
        typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches,
    );
  const { contact, working, phase, rotation, tilt, lift, marks, impact, strike } = scene;
  // O ciclo é apenas visual; somente o pedido do botão ao servidor reduz o prazo.
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'),
      update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    setScene(idle());
    if (!animating || ready || reducedMotion) return;
    let raf = 0,
      lastFrame = -Infinity,
      cycleIndex = -1,
      impactIndex = -1,
      baseRotation = 0,
      lastRotation = 0;
    const start = performance.now(),
      period = motion.duration + 700,
      anchor = { x: surface.x, y: surface.y };
    const leavesTrail = ![
      'hammer',
      'swirl',
      'grind',
      'dose',
      'mash',
      'scoop',
      'pluck',
      'piece',
      'facet',
      'gear',
      'pick',
      'glass',
    ].includes(technique.id);
    function tick(now: number) {
      raf = requestAnimationFrame(tick);
      if (now - lastFrame < 32) return;
      lastFrame = now;
      const elapsed = Math.max(0, now - start),
        step = Math.floor(elapsed / period),
        time = elapsed - step * period,
        active = time < motion.duration,
        t = Math.max(0, Math.min(1, time / motion.duration));
      const fresh = step !== cycleIndex;
      if (fresh) {
        cycleIndex = step;
        baseRotation = lastRotation;
      }
      const pose = techniquePose(technique.id, t, anchor, surface, step);
      lastRotation = baseRotation + pose.rotation;
      const hit = active && time >= motion.impact && impactIndex !== step;
      if (hit) impactIndex = step;
      setScene((old) => {
        let marks = old.marks;
        if (leavesTrail && active) {
          const p = { x: pose.x, y: pose.y };
          marks = fresh
            ? [...marks.slice(-23), { id: step, points: [p] }]
            : marks.map((m) =>
                m.id === step ? { ...m, points: [...m.points, p].slice(-160) } : m,
              );
        }
        return {
          contact: pose,
          working: active,
          phase: t,
          rotation: lastRotation,
          tilt: pose.tilt,
          lift: pose.lift,
          marks,
          impact: hit ? { id: step + 1, points: [pose] } : old.impact,
          strike: gesture.mode === 'strike' && active ? { ...anchor, id: step + 1 } : null,
        };
      });
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [profession.id, animating, ready, reducedMotion]);
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
  return (
    <div
      className={
        'pf-craft-scene pf-contact-scene pf-passive-workbench pf-scene-' +
        work.bench +
        ' pf-technique-' +
        technique.id +
        ' pf-gesture-' +
        gesture.mode +
        (working ? ' is-contact-working' : '')
      }
      role="img"
      aria-label={
        'Bancada de ' + profession.name + (animating && !ready ? ': trabalhando' : ': em repouso')
      }
      data-auto-working={animating && !ready}
    >
      <div
        className="pf-scene-environment"
        style={{ backgroundImage: `url(${profession.background})` }}
      />
      <svg
        className="pf-contact-board"
        viewBox={view.join(' ')}
        aria-hidden="true"
        data-phase={phase}
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
            <path d={surfacePath(surface)} fill="white" />
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
        {mortar ? (
          <ProfessionMortarContents
            id={uid}
            bench={bench}
            phase={phase}
            reduced={reducedMotion}
            travel={
              rotation * (technique.id === 'swirl' ? 1 / 12 : technique.id === 'dose' ? 2 : 1)
            }
          />
        ) : liquidWork ? (
          <ProfessionLiquidWork
            id={uid}
            bench={bench}
            surface={surface}
            contact={contact}
            travel={rotation}
            phase={phase}
            working={working}
            reduced={reducedMotion}
            kind={profession.id}
          />
        ) : (
          surface.liquid && (
            <g mask={'url(#' + uid + '-liquid)'}>
              <image
                className="pf-liquid-texture"
                href={bench}
                width="960"
                height="640"
                transform={`translate(${surface.x} ${surface.y}) scale(1 ${surface.ry / surface.rx}) rotate(${rotation}) scale(1 ${surface.rx / surface.ry}) translate(${-surface.x} ${-surface.y})`}
              />
            </g>
          )
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
            phase={reducedMotion ? 0 : phase}
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
        {gesture.mode !== 'strike' && !glasswork && (
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
        {glasswork && (
          <ProfessionGlasswork
            id={uid}
            rotation={rotation}
            contact={contact}
            working={working}
            reduced={reducedMotion}
          />
        )}
        {profession.id === 'poison' && (
          <ProfessionPoisonDrop
            contact={contact}
            phase={phase}
            working={working}
            reduced={reducedMotion}
            tipLift={lift}
          />
        )}
        {profession.id === 'brewing' && (
          <ProfessionLiquidWork
            id={uid}
            bench={bench}
            surface={surface}
            contact={contact}
            travel={rotation}
            phase={phase}
            working={working}
            reduced={reducedMotion}
            kind={profession.id}
            part="submerge"
          />
        )}
        {mortar ? (
          <ProfessionMortarFront id={uid} bench={bench} />
        ) : liquidWork ? (
          <ProfessionLiquidWork
            id={uid}
            bench={bench}
            surface={surface}
            contact={contact}
            travel={rotation}
            phase={phase}
            working={working}
            reduced={reducedMotion}
            kind={profession.id}
            part="front"
          />
        ) : (
          surface.liquid && (
            <image
              className="pf-container-lip"
              href={bench}
              width="960"
              height="640"
              mask={'url(#' + uid + '-lip)'}
            />
          )
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
            {animating ? work.working + '…' : 'Preparo automático'}
          </>
        )}
      </span>
    </div>
  );
}
