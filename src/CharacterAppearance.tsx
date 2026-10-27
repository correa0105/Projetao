import {
  characterHeights,
  characterBuilds,
  characterAges,
  characterGenders,
  characterPostures,
  characterCanes,
  type AppearanceChoices,
} from '../shared/character-appearance';

export function CharacterAppearance({
  value,
  onChange,
  required = false,
  spellcaster = false,
}: {
  value: AppearanceChoices['physicalTraits'];
  onChange: (value: NonNullable<AppearanceChoices['physicalTraits']>) => void;
  required?: boolean;
  spellcaster?: boolean;
}) {
  return (
    <fieldset className="character-physical-choices">
      <legend>Características físicas</legend>
      <p className="muted small">
        Escolha como seu personagem deve aparecer na arte e no token, mesmo enviando uma referência.
        A altura é relativa à raça escolhida.
      </p>
      <div className="form-grid">
        {(
          [
            ['gender', 'Gênero do personagem', characterGenders],
            ['height', 'Altura', characterHeights],
            ['build', 'Porte físico', characterBuilds],
            ['age', 'Idade aparente', characterAges],
          ] as const
        ).map(([key, label, options]) => (
          <label key={key}>
            {label}
            <select
              required={required || Boolean(key === 'gender' ? value?.gender : value)}
              aria-label={label}
              value={value?.[key] || ''}
              onChange={(e) => onChange({ ...value, [key]: e.target.value })}
            >
              <option value="" disabled>
                Escolha…
              </option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      <div className="form-grid">
        <label>
          Postura
          <select
            aria-label="Postura"
            value={value?.posture || ''}
            onChange={(e) =>
              onChange({
                ...value,
                posture: (e.target.value as 'upright' | 'slightly-curved' | 'hunched') || undefined,
              })
            }
          >
            <option value="">Padrão do personagem</option>
            {characterPostures.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Apoio e cajado
          <select
            aria-label="Apoio e cajado"
            value={value?.cane || ''}
            onChange={(e) =>
              onChange({
                ...value,
                cane:
                  (e.target.value as NonNullable<AppearanceChoices['physicalTraits']>['cane']) ||
                  undefined,
              })
            }
          >
            <option value="">Padrão do personagem</option>
            {characterCanes
              .filter((v) => v.id !== 'wooden-staff' || spellcaster)
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </select>
        </label>
      </div>
      <p className="muted small">
        Combine qualquer postura com ou sem bengala.
        {spellcaster && ' Como conjurador, você também pode escolher um cajado de madeira.'} São
        escolhas visuais; armas, focos e equipamentos continuam seguindo a ficha.
      </p>
      <p className="muted small">
        Essas escolhas orientam a aparência, sem alterar os atributos ou as regras da ficha.
      </p>
    </fieldset>
  );
}
