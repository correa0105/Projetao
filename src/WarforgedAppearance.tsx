import {
  defaultWarforgedAppearance,
  warforgedBodies,
  warforgedHeads,
  warforgedBodyAtlas,
  warforgedHeadAtlas,
  warforgedDetailedHeadAtlas,
  warforgedHeadReference,
  warforgedMetals,
  warforgedFinishes,
  warforgedAccentColors,
  type WarforgedAppearance as Appearance,
} from '../shared/warforged-appearance';
import './warforged-appearance.css';
import { usePreparedAssets } from './AssetLoading';
import { useId } from 'react';

function AtlasImage({
  kind,
  atlas,
  index,
}: {
  kind: 'body' | 'head';
  atlas: string;
  index: number;
}) {
  const id = useId();
  const x = (index % 3) * 512;
  const y = index < 3 ? 0 : kind === 'body' ? 490 : 512;
  const height = kind === 'body' ? (index < 3 ? 490 : 534) : 512;
  return (
    <svg className="warforged-design-image" aria-hidden="true" viewBox={`${x} ${y} 512 ${height}`}>
      <defs>
        <clipPath id={id}>
          <rect x={x} y={y} width="512" height={height} />
        </clipPath>
      </defs>
      <image href={atlas} x="0" y="0" width="1536" height="1024" clipPath={`url(#${id})`} />
    </svg>
  );
}

export function WarforgedBodyChoices({ value, onChange, required = false }: {
  value?: Appearance['body']; onChange: (value: Appearance['body']) => void; required?: boolean;
}) {
  const prepared = usePreparedAssets([warforgedBodyAtlas]);
  return <fieldset>
    <legend>Estrutura do corpo</legend>
    {!prepared.ready && <div className="warforged-models-loading" role={prepared.error ? 'alert' : 'status'}>
      {prepared.error || 'Preparando os modelos de corpo…'}
      {prepared.error && <button type="button" onClick={prepared.retry}>Tentar novamente</button>}
    </div>}
    <div className="warforged-design-options" hidden={!prepared.ready}>
      {warforgedBodies.map((option, index) => <label key={option.id} className={value === option.id ? 'is-selected' : ''}>
        <input type="radio" required={required} name="warforged-body" value={option.id}
          checked={value === option.id} onChange={() => onChange(option.id)} />
        <AtlasImage kind="body" atlas={warforgedBodyAtlas} index={index} />
        <strong>{option.name}</strong><span>{option.description}</span>
      </label>)}
    </div>
  </fieldset>;
}

export function WarforgedAppearance({
  value,
  onChange,
}: {
  value?: Appearance;
  onChange: (value: Appearance) => void;
}) {
  const selected = value || defaultWarforgedAppearance;
  const prepared = usePreparedAssets([
    warforgedBodyAtlas,
    warforgedHeadAtlas,
    warforgedDetailedHeadAtlas,
  ]);
  const update = (patch: Partial<Appearance>) => onChange({ ...selected, ...patch });
  return (
    <section className="warforged-appearance" aria-label="Aparência do Warforged">
      <h3>Construa seu Warforged</h3>
      <p>
        Escolha estrutura, cabeça e cores para a arte do personagem e o token. São escolhas de
        aparência; os atributos e as regras da ficha continuam os mesmos.
      </p>
      {!prepared.ready && (
        <div className="warforged-models-loading" role={prepared.error ? 'alert' : 'status'}>
          {prepared.error || 'Preparando os modelos de corpo e cabeça…'}
          {prepared.error && (
            <button type="button" onClick={prepared.retry}>
              Tentar novamente
            </button>
          )}
        </div>
      )}
      <div hidden={!prepared.ready}>
        {(
          [
            {
              title: 'Estrutura do corpo',
              key: 'body',
              options: warforgedBodies.map((option, index) => ({
                ...option,
                atlas: warforgedBodyAtlas,
                index,
              })),
            },
            {
              title: 'Formato da cabeça',
              key: 'head',
              options: [...warforgedHeads.slice(6), ...warforgedHeads.slice(0, 6)].map(
                (option) => ({ ...option, ...warforgedHeadReference(option.id) }),
              ),
            },
          ] as const
        ).map((group) => (
          <fieldset key={group.key}>
            <legend>{group.title}</legend>
            <div className="warforged-design-options">
              {group.options.map((option) => (
                <label
                  key={option.id}
                  className={selected[group.key] === option.id ? 'is-selected' : ''}
                >
                  <input
                    type="radio"
                    name={'warforged-' + group.key}
                    value={option.id}
                    checked={selected[group.key] === option.id}
                    onChange={() => update({ [group.key]: option.id })}
                  />
                  <AtlasImage kind={group.key} atlas={option.atlas} index={option.index} />
                  <strong>{option.name}</strong>
                  <span>{option.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <p className="muted small">
        As ilustrações mostram os formatos. A combinação de cores abaixo será aplicada na arte
        final.
      </p>
      <fieldset>
        <legend>Metal e acabamento</legend>
        <div className="warforged-material-fields">
          <label>
            Cor metálica principal
            <select
              aria-label="Cor metálica principal"
              value={selected.metal}
              onChange={(e) => update({ metal: e.target.value as Appearance['metal'] })}
            >
              {warforgedMetals.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Acabamento
            <select
              aria-label="Acabamento"
              value={selected.finish}
              onChange={(e) => update({ finish: e.target.value as Appearance['finish'] })}
            >
              {warforgedFinishes.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="warforged-metal-preview" aria-hidden="true">
          <span
            style={{ backgroundColor: warforgedMetals.find((m) => m.id === selected.metal)!.color }}
          />
          {warforgedMetals.find((m) => m.id === selected.metal)!.name} ·{' '}
          {warforgedFinishes.find((f) => f.id === selected.finish)!.name}
        </div>
      </fieldset>
      <fieldset>
        <legend>Detalhes e encaixes</legend>
        <label className="warforged-accent-toggle">
          <input
            type="checkbox"
            checked={selected.accentEnabled}
            onChange={(e) => update({ accentEnabled: e.target.checked })}
          />{' '}
          Usar cor secundária
        </label>
        {selected.accentEnabled && (
          <>
            <p className="muted small">
              Aplicada nos encaixes, juntas e frisos, mantendo a cor principal do corpo.
            </p>
            <div className="warforged-color-options" role="group" aria-label="Cores para detalhes">
              {warforgedAccentColors.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  aria-label={'Detalhes em ' + c.name}
                  title={c.name}
                  aria-pressed={selected.accentColor.toLowerCase() === c.color}
                  onClick={() => update({ accentColor: c.color })}
                >
                  <span style={{ backgroundColor: c.color }} aria-hidden="true" />
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
            <label className="warforged-custom-color">
              Cor secundária personalizada
              <input
                type="color"
                aria-label="Cor secundária personalizada"
                value={selected.accentColor}
                onChange={(e) => update({ accentColor: e.target.value })}
              />
              <span>{selected.accentColor.toUpperCase()}</span>
            </label>
          </>
        )}
      </fieldset>
    </section>
  );
}
