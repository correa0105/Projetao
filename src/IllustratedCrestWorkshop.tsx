import { useRef, useState } from 'react';
import { GuildCrest, crestNames } from './GuildCrest';
import { crestFields, type Crest } from '../shared/guilds';
import {
  crestArtBanners,
  crestArtFrames,
  crestArtSigils,
  crestArtNames,
  type CrestArt,
} from '../shared/guild-crest-art';
const palettes = [
  { name: 'Guerra e osso', colors: ['#f1e3bd', '#781d21', '#260e14', '#c8ac7a'] },
  { name: 'Bosque ancestral', colors: ['#e8ce83', '#123c30', '#071e23', '#c9ac68'] },
  { name: 'Conclave arcano', colors: ['#b9d2ff', '#302044', '#15112b', '#c9b383'] },
  { name: 'Corvo da vigília', colors: ['#c3d5df', '#162a3c', '#07151c', '#a2a6a2'] },
  { name: 'Fênix solar', colors: ['#f7d08d', '#812912', '#431023', '#d9b45f'] },
];
const sections = [
  { id: 'banner', name: 'Tecido', choices: crestArtBanners },
  { id: 'symbol', name: 'Símbolo', choices: crestArtSigils },
  { id: 'frame', name: 'Bordas', choices: crestArtFrames },
] as const;
export function IllustratedCrestWorkshop({
  value,
  onChange,
  name,
}: {
  value: Crest;
  onChange: (v: Crest) => void;
  name: string;
}) {
  const [tab, setTab] = useState<'banner' | 'symbol' | 'frame' | 'colors'>('banner');
  const a = value.art!,
    active = sections.find((s) => s.id === tab);
  const drag = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    factor: number;
  } | null>(null);
  const edit = (patch: Partial<CrestArt>) => onChange({ ...value, art: { ...a, ...patch } });
  return (
    <section
      className="guild-crest-editor crest-illustrated-editor"
      aria-label="Oficina de brasões ilustrados"
    >
      <header className="crest-workshop-heading">
        <div>
          <span className="social-eyebrow">Estandartes e emblemas</span>
          <h3>Marca da companhia</h3>
        </div>
        <button
          type="button"
          onClick={() => {
            const { art, ...old } = value;
            onChange(old);
          }}
        >
          Estilo clássico
        </button>
      </header>
      <div className="crest-workshop-body">
        <aside className="crest-preview">
          <div
            className="crest-display crest-art-display"
            onPointerDown={(e) => {
              if (!(e.target as Element).closest('[data-crest-layer="symbol"]')) return;
              const svg = e.currentTarget.querySelector('svg')!;
              drag.current = {
                x: a.symbolX,
                y: a.symbolY,
                startX: e.clientX,
                startY: e.clientY,
                factor: 120 / svg.getBoundingClientRect().width,
              };
              e.currentTarget.setPointerCapture(e.pointerId);
              e.preventDefault();
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              edit({
                symbolX: Math.max(-25, Math.min(25, d.x + (e.clientX - d.startX) * d.factor)),
                symbolY: Math.max(-25, Math.min(25, d.y + (e.clientY - d.startY) * d.factor)),
              });
            }}
            onPointerUp={(e) => {
              drag.current = null;
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            onPointerCancel={() => (drag.current = null)}
          >
            <GuildCrest crest={value} size={250} />
          </div>
          <h4>{name.trim() || 'Sua guilda'}</h4>
          <p>
            {crestArtNames[a.symbol]} · {crestArtNames[a.banner]}
          </p>
          <small>Arraste o emblema na prévia ou ajuste os controles.</small>
        </aside>
        <div className="crest-design-controls">
          <nav className="crest-design-tabs" aria-label="Personalizar brasão">
            {[
              ...sections.map((s) => ({ id: s.id, name: s.name })),
              { id: 'colors', name: 'Cores' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={tab === s.id}
                onClick={() => setTab(s.id as typeof tab)}
              >
                {s.name}
              </button>
            ))}
          </nav>
          {active && (
            <>
              <div className="crest-choice-heading">
                <h4>Escolha {active.name.toLowerCase()}</h4>
                <small>{active.choices.length} opções</small>
              </div>
              <div
                className="crest-choice-grid"
                role="group"
                aria-label={'Escolher ' + active.name.toLowerCase()}
              >
                {active.choices.map((choice) => (
                  <button
                    key={choice}
                    type="button"
                    aria-label={active.name + ': ' + crestArtNames[choice]}
                    aria-pressed={a[active.id] === choice}
                    onClick={() => edit({ [active.id]: choice })}
                  >
                    <GuildCrest
                      crest={{ ...value, art: { ...a, [active.id]: choice } }}
                      size={96}
                      decorative
                    />
                    <span>{crestArtNames[choice]}</span>
                  </button>
                ))}
              </div>
            </>
          )}
          {tab === 'symbol' && (
            <fieldset className="crest-art-transform">
              <legend>Posição do emblema</legend>
              {(
                [
                  {
                    key: 'symbolScale',
                    label: 'Tamanho do emblema',
                    min: 0.5,
                    max: 1.5,
                    step: 0.05,
                  },
                  {
                    key: 'symbolRotation',
                    label: 'Rotação do emblema',
                    min: -180,
                    max: 180,
                    step: 1,
                  },
                  { key: 'symbolX', label: 'Posição horizontal', min: -25, max: 25, step: 0.5 },
                  { key: 'symbolY', label: 'Posição vertical', min: -25, max: 25, step: 0.5 },
                ] as const
              ).map((c) => (
                <label key={c.key}>
                  {c.label}
                  <input
                    type="range"
                    aria-label={c.label}
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={a[c.key]}
                    onChange={(e) => edit({ [c.key]: Number(e.target.value) })}
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() => edit({ symbolScale: 1, symbolRotation: 0, symbolX: 0, symbolY: 0 })}
              >
                Centralizar emblema
              </button>
            </fieldset>
          )}
          {tab === 'colors' && (
            <fieldset className="crest-colors">
              <legend>Cores e padrões</legend>
              <div className="crest-palettes">
                {palettes.map((p) => (
                  <button
                    type="button"
                    key={p.name}
                    onClick={() =>
                      onChange({
                        ...value,
                        iconColor: p.colors[0],
                        fieldColor: p.colors[1],
                        fieldColor2: p.colors[2],
                        borderColor: p.colors[3],
                      })
                    }
                  >
                    <span>
                      {p.colors.map((c) => (
                        <i key={c} style={{ background: c }} />
                      ))}
                    </span>
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="crest-custom-colors">
                {(
                  [
                    { key: 'iconColor', name: 'Emblema' },
                    { key: 'fieldColor', name: 'Tecido' },
                    { key: 'fieldColor2', name: 'Padrão' },
                    { key: 'borderColor', name: 'Bordas' },
                  ] as const
                ).map((c) => (
                  <label key={c.key}>
                    {c.name}
                    <input
                      type="color"
                      aria-label={'Cor ' + c.name}
                      value={value[c.key]}
                      onChange={(e) => onChange({ ...value, [c.key]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <label>
                Padrão do tecido
                <select
                  aria-label="Padrão do tecido"
                  value={value.field}
                  onChange={(e) => onChange({ ...value, field: e.target.value as Crest['field'] })}
                >
                  {crestFields.map((f) => (
                    <option key={f} value={f}>
                      {crestNames[f]}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          )}
        </div>
      </div>
    </section>
  );
}
