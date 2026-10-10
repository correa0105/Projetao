import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CloudSun, RotateCcw, X } from 'lucide-react';
import {
  atmosphereSchema,
  dayPresets,
  weatherPresets,
  type MapAtmosphere,
} from '../shared/vtt-atmosphere';
import './vtt-atmosphere.css';
export function VttAtmosphereMenu({
  value,
  busy,
  change,
  effectsEnabled,
  enableEffects,
}: {
  value: MapAtmosphere;
  busy: boolean;
  change: (value: MapAtmosphere) => Promise<void>;
  effectsEnabled: boolean;
  enableEffects: () => void;
}) {
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<'natural' | 'magic'>('natural'),
    [draft, setDraft] = useState(value),
    [saving, setSaving] = useState(false),
    [error, setError] = useState('');
  const panel = useRef<HTMLElement>(null);
  const ref = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) setDraft(value);
  }, [value, open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node) && !panel.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    panel.current?.querySelector<HTMLButtonElement>('.vtt-atmosphere-close')?.focus();
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  async function apply(next: MapAtmosphere) {
    setSaving(true);
    setError('');
    try {
      await change(next);
      setDraft(next);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  const patch = (p: Partial<MapAtmosphere>) => setDraft((d) => ({ ...d, ...p, enabled: true }));
  return (
    <div
      className="vtt-atmosphere-tool"
      ref={ref}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        aria-label="Efeitos do mapa"
        title="Efeitos do mapa"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <CloudSun size={18} />
      </button>
      {open &&
        createPortal(
          <section
            ref={panel}
            className="vtt-atmosphere-menu"
            role="dialog"
            aria-label="Efeitos do mapa"
          >
            <header>
              <div>
                <span>ATMOSFERA DA CENA</span>
                <strong>Efeitos do mapa</strong>
              </div>
              <button
                className="vtt-atmosphere-close"
                aria-label="Fechar efeitos do mapa"
                onClick={() => {
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                <X size={15} />
              </button>
            </header>
            {!effectsEnabled && (
              <p className="vtt-atmosphere-muted">
                Efeitos pausados nesta tela.{' '}
                <button onClick={enableEffects}>Mostrar efeitos</button>
              </p>
            )}
            <div className="vtt-atmosphere-days" aria-label="Horário da cena">
              {dayPresets.map((p) => (
                <button
                  key={p.id}
                  title={p.hint}
                  aria-pressed={draft.day === p.id}
                  onClick={() => patch({ day: p.id })}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <nav aria-label="Categorias de clima">
              <button aria-pressed={tab === 'natural'} onClick={() => setTab('natural')}>
                Clima
              </button>
              <button aria-pressed={tab === 'magic'} onClick={() => setTab('magic')}>
                Fantasia
              </button>
            </nav>
            <div className="vtt-atmosphere-presets">
              {weatherPresets
                .filter((p) => p[2] === tab)
                .map((p) => (
                  <button
                    key={p[0]}
                    aria-pressed={draft.weather === p[0]}
                    data-weather={p[0]}
                    onClick={() => patch({ weather: p[0] })}
                  >
                    <i className={'atmosphere-swatch ' + p[3]} aria-hidden="true" />
                    {p[1]}
                  </button>
                ))}
            </div>
            <label className="vtt-atmosphere-range">
              Intensidade <output>{Math.round(draft.intensity * 100)}%</output>
              <input
                aria-label="Intensidade do clima"
                type="range"
                min="0"
                max="1"
                step=".05"
                value={draft.intensity}
                onChange={(e) => patch({ intensity: Number(e.target.value) })}
              />
            </label>
            <details>
              <summary>Movimento e direção</summary>
              <label className="vtt-atmosphere-range">
                Velocidade <output>{draft.speed.toFixed(1)}×</output>
                <input
                  aria-label="Velocidade do clima"
                  type="range"
                  min=".1"
                  max="2"
                  step=".1"
                  value={draft.speed}
                  onChange={(e) => patch({ speed: Number(e.target.value) })}
                />
              </label>
              <label className="vtt-atmosphere-range">
                Direção do vento <output>{draft.wind}°</output>
                <input
                  aria-label="Direção do vento"
                  type="range"
                  min="0"
                  max="360"
                  step="5"
                  value={draft.wind}
                  onChange={(e) => patch({ wind: Number(e.target.value) })}
                />
              </label>
            </details>
            {error && <p role="alert">{error}</p>}
            <footer>
              <button
                disabled={busy || saving}
                onClick={() => void apply(atmosphereSchema.parse({}))}
              >
                <RotateCcw size={12} />
                Limpar
              </button>
              <button
                className="vtt-atmosphere-apply"
                disabled={busy || saving}
                onClick={() => void apply({ ...draft, enabled: true })}
              >
                {saving ? 'Aplicando…' : 'Aplicar na cena'}
              </button>
            </footer>
            <small>Visível para a mesa. Só o mestre altera.</small>
          </section>,
          document.body,
        )}
    </div>
  );
}
