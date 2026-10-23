import {
  characterHeights,
  characterBuilds,
  characterAges,
  type AppearanceChoices,
} from '../shared/character-appearance';

export function CharacterAppearance({
  value,
  onChange,
  required = false,
}: {
  value: AppearanceChoices['physicalTraits'];
  onChange: (value: NonNullable<AppearanceChoices['physicalTraits']>) => void;
  required?: boolean;
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
            ['height', 'Altura', characterHeights],
            ['build', 'Porte físico', characterBuilds],
            ['age', 'Idade aparente', characterAges],
          ] as const
        ).map(([key, label, options]) => (
          <label key={key}>
            {label}
            <select
              required={required || Boolean(value)}
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
      <p className="muted small">
        Essas escolhas orientam a aparência, sem alterar os atributos ou as regras da ficha.
      </p>
    </fieldset>
  );
}
