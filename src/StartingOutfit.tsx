import {
  defaultStartingOutfit,
  startingTops,
  startingTrousers,
  startingFootwear,
  outfitColors,
  type StartingOutfit as Outfit,
} from '../shared/starting-outfit';
import './starting-outfit.css';
import { OutfitIllustration } from './OutfitIllustration';

function Color({
  label,
  value,
  change,
}: {
  label: string;
  value: string;
  change: (color: string) => void;
}) {
  return (
    <div className="starting-outfit-color">
      <label>
        <span>{label}</span>
        <span className="starting-outfit-picker">
          <span className="starting-outfit-color-chip" style={{ backgroundColor: value }}>
            <input
              aria-label={label}
              type="color"
              value={value}
              onChange={(e) => change(e.target.value)}
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                minHeight: 0,
                padding: 0,
                margin: 0,
                border: 0,
                opacity: 0,
                cursor: 'pointer',
              }}
            />
          </span>
          <span>{value.toUpperCase()}</span>
        </span>
      </label>
      <div
        className="starting-outfit-swatches"
        role="group"
        aria-label={`Sugestões para ${label.toLowerCase()}`}
      >
        {outfitColors.map((c) => (
          <button
            key={c.value}
            type="button"
            aria-label={`${label}: ${c.name}`}
            aria-pressed={value.toLowerCase() === c.value}
            title={c.name}
            style={{ backgroundColor: c.value }}
            onClick={() => change(c.value)}
          >
            {value.toLowerCase() === c.value ? '✓' : ''}
          </button>
        ))}
      </div>
    </div>
  );
}
export function StartingOutfit({
  value,
  onChange,
}: {
  value?: Outfit;
  onChange: (value: Outfit | undefined) => void;
}) {
  const outfit = value || defaultStartingOutfit;
  function update(patch: Partial<Outfit>) {
    onChange({ ...outfit, ...patch });
  }
  return (
    <fieldset className="starting-outfit" aria-label="Roupa inicial">
      <legend>Roupa inicial</legend>
      <p className="muted small">
        Escolha o corte de cada peça e suas cores. Armaduras e roupas equipadas aparecem por cima ou
        substituem a peça correspondente.
      </p>
      <div className="starting-outfit-grid">
        {(
          [
            ['top', 'Parte superior', startingTops, 'topColor', 'Cor da parte superior'],
            ['trousers', 'Calça', startingTrousers, 'trousersColor', 'Cor da calça'],
            ['footwear', 'Calçado', startingFootwear, 'footwearColor', 'Cor do calçado'],
          ] as const
        ).map(([key, label, models, colorKey, colorLabel]) => (
          <section key={key} className="starting-outfit-piece" aria-label={label}>
            <label>
              {label}
              <select
                aria-label={`Modelo: ${label.toLowerCase()}`}
                value={outfit[key]}
                onChange={(e) => update({ [key]: e.target.value })}
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted small">{models.find((m) => m.id === outfit[key])?.detail}</p>
            <div
              className="starting-outfit-models"
              role="group"
              aria-label={`Prévias: ${label.toLowerCase()}`}
            >
              {models.map((model) => (
                <button
                  type="button"
                  key={model.id}
                  aria-label={`Escolher ${model.name}`}
                  aria-pressed={outfit[key] === model.id}
                  onClick={() => update({ [key]: model.id })}
                >
                  <OutfitIllustration
                    piece={key}
                    model={model.id}
                    color={outfit[colorKey]}
                    label={`${model.name}, cor ${outfit[colorKey]}`}
                  />
                  <span>{model.name}</span>
                  <span className="outfit-model-check" aria-hidden="true">
                    {outfit[key] === model.id ? '✓' : ''}
                  </span>
                </button>
              ))}
            </div>
            {!(key === 'footwear' && outfit.footwear === 'barefoot') && (
              <Color
                label={colorLabel}
                value={outfit[colorKey]}
                change={(v) => update({ [colorKey]: v })}
              />
            )}
          </section>
        ))}
        <section className="starting-outfit-piece" aria-label="Faixa da cintura">
          <label className="starting-outfit-sash">
            <input
              type="checkbox"
              checked={outfit.sash}
              onChange={(e) => update({ sash: e.target.checked })}
            />
            Usar faixa na cintura
          </label>
          <p className="muted small">
            {outfit.sash
              ? 'Faixa de tecido com caimento natural.'
              : 'Sem a faixa de tecido na barriga.'}
          </p>
          <div className="starting-outfit-sash-preview">
            {outfit.sash ? (
              <OutfitIllustration
                piece="sash"
                model="sash"
                color={outfit.sashColor}
                label={`Faixa, cor ${outfit.sashColor}`}
              />
            ) : (
              <span>Sem faixa na cintura</span>
            )}
          </div>
          {outfit.sash && (
            <Color
              label="Cor da faixa"
              value={outfit.sashColor}
              change={(v) => update({ sashColor: v })}
            />
          )}
        </section>
      </div>
      <div className="starting-outfit-footer">
        <p className="muted small">
          Escolhas de aparência, sem alterar a proteção ou os atributos da ficha. Uma nova arte
          aplica as mudanças ao personagem. As ilustrações acima mostram o modelo e a cor agora.
        </p>
        {value && (
          <button
            className="button outline small"
            type="button"
            onClick={() => onChange(undefined)}
          >
            Restaurar traje padrão
          </button>
        )}
      </div>
    </fieldset>
  );
}
