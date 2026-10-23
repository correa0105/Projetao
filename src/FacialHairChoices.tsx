import { useId } from 'react';
import {
  beardStyles,
  mustacheStyles,
  facialHairColors,
  facialHairAtlases,
  defaultFacialHair,
  type FacialHair,
} from '../shared/facial-hair';
import { usePreparedAssets } from './AssetLoading';
import './facial-hair.css';

function ModelImage({ kind, index }: { kind: keyof typeof facialHairAtlases; index: number }) {
  const id = useId(),
    atlas = facialHairAtlases[kind],
    width = atlas.width / atlas.columns,
    height = atlas.height / atlas.rows;
  const x = (index % atlas.columns) * width,
    y = Math.floor(index / atlas.columns) * height;
  return (
    <svg className="facial-hair-model" aria-hidden="true" viewBox={`${x} ${y} ${width} ${height}`}>
      <defs>
        <clipPath id={id}>
          <rect x={x} y={y} width={width} height={height} />
        </clipPath>
      </defs>
      <image
        href={atlas.path}
        x="0"
        y="0"
        width={atlas.width}
        height={atlas.height}
        clipPath={`url(#${id})`}
      />
    </svg>
  );
}

export function FacialHairChoices({
  value,
  onChange,
}: {
  value?: FacialHair;
  onChange: (value: FacialHair) => void;
}) {
  const prepared = usePreparedAssets([
    facialHairAtlases.beard.path,
    facialHairAtlases.mustache.path,
  ]);
  const selected = value || defaultFacialHair;
  const update = (patch: Partial<FacialHair>) => onChange({ ...selected, ...patch });
  const hasHair = selected.beard !== 'none' || selected.mustache !== 'none';
  return (
    <section className="facial-hair-choices" aria-label="Barba e bigode">
      <h3>Barba e bigode</h3>
      <p>
        Escolha os modelos separadamente. As escolhas serão usadas na arte e no token, mesmo com uma
        imagem de referência. As ilustrações mostram os formatos; a cor é escolhida abaixo.
      </p>
      {!prepared.ready && (
        <div className="facial-hair-loading" role={prepared.error ? 'alert' : 'status'}>
          {prepared.error || 'Preparando os modelos de barba e bigode…'}
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
            { kind: 'beard', title: 'Modelo de barba', options: beardStyles },
            { kind: 'mustache', title: 'Modelo de bigode', options: mustacheStyles },
          ] as const
        ).map((group) => (
          <fieldset key={group.kind}>
            <legend>{group.title}</legend>
            <div className="facial-hair-options">
              {group.options.map((option, index) => (
                <label
                  key={option.id}
                  className={value?.[group.kind] === option.id ? 'is-selected' : ''}
                >
                  <input
                    type="radio"
                    name={'facial-hair-' + group.kind}
                    value={option.id}
                    checked={value?.[group.kind] === option.id}
                    onChange={() => update({ [group.kind]: option.id })}
                  />
                  <ModelImage kind={group.kind} index={index} />
                  <strong>{option.name}</strong>
                  <span>{option.description}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
      <fieldset disabled={!hasHair}>
        <legend>Cor da barba e do bigode</legend>
        <div className="facial-hair-colors">
          {facialHairColors.map((color) => (
            <label key={color.id} className={selected.color === color.id ? 'is-selected' : ''}>
              <input
                type="radio"
                name="facial-hair-color"
                value={color.id}
                checked={selected.color === color.id}
                onChange={() => update({ color: color.id })}
              />
              <span
                className="facial-hair-swatch"
                style={{ backgroundColor: color.color }}
                aria-hidden="true"
              />
              {color.name}
            </label>
          ))}
        </div>
        <label className="facial-hair-graying">
          <input
            type="checkbox"
            checked={selected.graying}
            onChange={(e) => update({ graying: e.target.checked })}
          />
          Adicionar fios grisalhos
        </label>
        <p className="muted small">
          Mistura fios prateados à cor escolhida, mantendo a cor base. A opção vale para a barba e o
          bigode.
        </p>
      </fieldset>
    </section>
  );
}
