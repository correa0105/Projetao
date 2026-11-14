import { useRef, useState, type PointerEvent } from 'react';
import { ArrowRight, Check } from 'lucide-react';
import { validWorkshopInput, type WorkshopStep, type WorkshopInput } from '../shared/professions';
type AdvancedStep = Extract<WorkshopStep, { kind: 'balance' | 'assembly' | 'trace' }>;
const colors = ['#a77c4b', '#719097', '#b393ba'];
function expandedLine(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Array.from({ length: 8 }, (_, i) => ({
    x: a.x + ((b.x - a.x) * (i + 1)) / 8,
    y: a.y + ((b.y - a.y) * (i + 1)) / 8,
  }));
}
export function AdvancedWorkshop({
  step,
  disabled,
  busy,
  submit,
}: {
  step: AdvancedStep;
  disabled: boolean;
  busy: boolean;
  submit: (input: WorkshopInput) => void;
}) {
  const [ratios, setRatios] = useState<number[]>([0, 0, 0]),
    [slots, setSlots] = useState<number[]>([-1, -1, -1]),
    [selected, setSelected] = useState<number | null>(null),
    [path, setPath] = useState<{ x: number; y: number }[]>([]),
    [assisted, setAssisted] = useState(0);
  const drawing = useRef(false),
    svg = useRef<SVGSVGElement>(null);
  const input: WorkshopInput =
    step.kind === 'balance' ? { ratios } : step.kind === 'assembly' ? { slots } : { path };
  const valid = validWorkshopInput(step, input),
    locked = disabled || busy;
  function place(slot: number, part = selected) {
    if (
      locked ||
      part === null ||
      step.kind !== 'assembly' ||
      part < 0 ||
      part >= step.parts.length
    )
      return;
    setSlots((values) => values.map((v, i) => (i === slot ? part : v === part ? -1 : v)));
    setSelected(null);
  }
  function pointer(e: PointerEvent<SVGSVGElement>) {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(matrix.inverse());
    return { x: Math.max(0, Math.min(100, p.x)), y: Math.max(0, Math.min(100, p.y)) };
  }
  function begin(e: PointerEvent<SVGSVGElement>) {
    if (locked || step.kind !== 'trace') return;
    const p = pointer(e);
    if (!p) return;
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    setPath([p]);
    setAssisted(0);
  }
  function move(e: PointerEvent<SVGSVGElement>) {
    if (!drawing.current || locked) return;
    const p = pointer(e);
    if (!p) return;
    setPath((values) => {
      const last = values[values.length - 1];
      return values.length >= 256 || (last && Math.hypot(last.x - p.x, last.y - p.y) < 0.6)
        ? values
        : [...values, p];
    });
  }
  function guidePoint(index: number) {
    if (locked || step.kind !== 'trace' || index !== assisted) return;
    const next = step.guide[index];
    setPath((values) =>
      values.length
        ? [...values, ...expandedLine(values[values.length - 1], next)]
        : Array.from({ length: 3 }, () => ({ ...next })),
    );
    setAssisted(index + 1);
  }
  return (
    <div className="pf-workshop pf-extra-workshop" data-workshop-kind={step.kind}>
      <div className="pf-step-heading">
        <span className="pf-kicker">NA BANCADA</span>
        <h3>{step.title}</h3>
        <p>{step.instruction}</p>
      </div>
      <div className="pf-work-surface">
        {step.kind === 'balance' ? (
          <>
            <svg
              className="pf-work-svg"
              viewBox="0 0 600 260"
              role="img"
              aria-label="Proporções da mistura"
            >
              <path d="M40 228H560" stroke="#a88a54" />
              {step.labels.map((label, i) => {
                const x = 118 + i * 180;
                return (
                  <g key={i}>
                    <path
                      d={`M${x - 25} 45H${x + 25}V80L${x + 52} 185Q${x + 60} 210 ${x + 35} 211H${x - 35}Q${x - 60} 210 ${x - 52} 185L${x - 25} 80Z`}
                      fill="#87a2a31b"
                      stroke="#b5aa8c"
                      strokeWidth="2"
                    />
                    <rect
                      x={x - 36}
                      y={202 - ratios[i] * 0.9}
                      width="72"
                      height={Math.max(2, ratios[i] * 0.9)}
                      rx="9"
                      fill={colors[i]}
                      opacity=".85"
                    />
                    <text x={x} y="246" textAnchor="middle" fill="#ead7ac" fontSize="13">
                      {label} · {ratios[i]}%
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="pf-formula" aria-label="Fórmula da receita">
              {step.labels.map((label, i) => (
                <span key={i}>
                  <i style={{ background: colors[i] }} />
                  {label}: <strong>{step.target[i]}%</strong>
                </span>
              ))}
            </div>
            <div className="pf-balance-controls">
              {step.labels.map((label, i) => (
                <label key={i}>
                  {label}
                  <output>{ratios[i]}%</output>
                  <input
                    aria-label={'Proporção de ' + label}
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    disabled={locked}
                    value={ratios[i]}
                    onChange={(e) =>
                      setRatios((values) =>
                        values.map((v, n) => (n === i ? Number(e.target.value) : v)),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <p className="pf-mixture-total">
              Total da mistura: <strong>{ratios.reduce((a, b) => a + b, 0)} / 100 partes</strong>
            </p>
          </>
        ) : step.kind === 'assembly' ? (
          <>
            <div className="pf-assembly-parts" aria-label="Componentes disponíveis">
              {step.parts.map((part, i) => (
                <button
                  key={i}
                  type="button"
                  aria-pressed={selected === i}
                  disabled={locked || slots.includes(i)}
                  draggable={!locked && !slots.includes(i)}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', String(i));
                    setSelected(i);
                  }}
                  onClick={() => setSelected(i)}
                >
                  <svg viewBox="0 0 80 80" aria-hidden="true">
                    <path
                      d={
                        i === 0
                          ? 'M14 58 25 28H55L66 58Z'
                          : i === 1
                            ? 'M40 10 64 40 40 70 16 40Z'
                            : 'M15 24H65V57H15Z'
                      }
                      fill={colors[i]}
                      stroke="#ddbc7f"
                      strokeWidth="3"
                    />
                    <circle cx="40" cy="41" r={i === 1 ? 10 : 5} fill="#d9b579" />
                  </svg>
                  <span>{part}</span>
                </button>
              ))}
            </div>
            <div className="pf-assembly-slots" aria-label="Encaixes da peça">
              {step.target.map((expected, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={'Encaixe ' + (i + 1) + ': ' + step.parts[expected]}
                  disabled={locked}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const raw = e.dataTransfer.getData('text/plain');
                    if (/^\d+$/.test(raw)) place(i, Number(raw));
                  }}
                  onClick={() => place(i)}
                  className={slots[i] === expected ? 'is-correct' : ''}
                >
                  <small>ENCAIXE {i + 1}</small>
                  <svg viewBox="0 0 80 80" aria-hidden="true">
                    <path
                      d={
                        expected === 0
                          ? 'M14 58 25 28H55L66 58Z'
                          : expected === 1
                            ? 'M40 10 64 40 40 70 16 40Z'
                            : 'M15 24H65V57H15Z'
                      }
                      fill={slots[i] === -1 ? 'none' : colors[slots[i]]}
                      stroke="#c8a669"
                      strokeWidth="3"
                      strokeDasharray={slots[i] === -1 ? '4 4' : undefined}
                    />
                  </svg>
                  <strong>{step.parts[expected]}</strong>
                  <span>{slots[i] === -1 ? 'Escolha e encaixe' : step.parts[slots[i]]}</span>
                </button>
              ))}
            </div>
            <p className="pf-extra-hint">
              Arraste as peças ou selecione uma e toque no encaixe correspondente.
            </p>
          </>
        ) : (
          <>
            <svg
              ref={svg}
              className="pf-trace-canvas"
              viewBox="0 0 100 100"
              role="img"
              aria-label="Molde dourado para traçar"
              onPointerDown={begin}
              onPointerMove={move}
              onPointerUp={() => (drawing.current = false)}
              onPointerCancel={() => (drawing.current = false)}
            >
              <rect x="3" y="3" width="94" height="94" rx="8" fill="#4a3826" stroke="#9a7849" />
              <polyline
                points={step.guide.map((p) => p.x + ',' + p.y).join(' ')}
                fill="none"
                stroke="#cfab69"
                opacity=".35"
                strokeWidth="7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={step.guide.map((p) => p.x + ',' + p.y).join(' ')}
                fill="none"
                stroke="#e4c482"
                strokeWidth=".8"
                strokeDasharray="1 2"
              />
              {path.length > 1 && (
                <polyline
                  points={path.map((p) => p.x + ',' + p.y).join(' ')}
                  fill="none"
                  stroke="#ecdfbb"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
              {step.guide.map((p, i) => (
                <g key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="3.1"
                    fill="#b48d51"
                    stroke="#efd4a0"
                    strokeWidth=".5"
                  />
                  <text x={p.x} y={p.y + 1.1} textAnchor="middle" fill="#241f17" fontSize="3.3">
                    {i + 1}
                  </text>
                </g>
              ))}
            </svg>
            <div className="pf-assisted-trace" aria-label="Traçado assistido">
              {step.guide.map((_, i) => (
                <button
                  key={i}
                  disabled={locked || i !== assisted}
                  onClick={() => guidePoint(i)}
                  aria-label={'Traçar até o ponto ' + (i + 1)}
                >
                  Ponto {i + 1}
                  {i < assisted && <Check size={12} />}
                </button>
              ))}
            </div>
          </>
        )}
        <button
          className="pf-reset"
          disabled={locked}
          onClick={() => {
            setRatios([0, 0, 0]);
            setSlots([-1, -1, -1]);
            setPath([]);
            setAssisted(0);
            setSelected(null);
          }}
        >
          Recomeçar esta etapa
        </button>
      </div>
      <div className="pf-work-actions">
        <span>
          {valid ? (
            <>
              <Check size={16} /> Ajuste pronto
            </>
          ) : (
            'Siga a referência em dourado'
          )}
        </span>
        <button
          className="button pf-primary"
          disabled={locked || !valid}
          onClick={() => submit(input)}
        >
          {busy ? 'Registrando…' : 'Confirmar etapa'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
