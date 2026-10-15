import { useId } from 'react';
import { statNames } from '../shared/rules';
import './ability-boost-choices.css';

export function AbilityBoostChoices({
  value,
  allowed,
  onChange,
}: {
  value: number[];
  allowed: number[];
  onChange: (values: number[]) => void;
}) {
  const modeName = useId();
  const split = value.includes(2);
  const primary = split
    ? value.indexOf(2)
    : value.findIndex(Boolean) >= 0
      ? value.findIndex(Boolean)
      : allowed[0];
  const secondary = value.findIndex((v, i) => v === 1 && i !== primary);
  const selected = value.filter(Boolean).length;
  const setSplit = (a = primary, b = secondary) => {
    if (!allowed.includes(a)) a = allowed[0];
    if (!allowed.includes(b) || a === b) b = allowed.find((i) => i !== a)!;
    onChange(statNames.map((_, i) => (i === a ? 2 : i === b ? 1 : 0)));
  };
  return (
    <div className="ability-boost-choices">
      <div
        className="ability-boost-modes"
        role="radiogroup"
        aria-label="Forma de distribuir os bônus"
      >
        <label>
          <input type="radio" name={modeName} checked={split} onChange={() => setSplit()} />
          Um +2 e um +1
        </label>
        <label>
          <input
            type="radio"
            name={modeName}
            checked={!split}
            onChange={() => onChange(value.map((v) => (v ? 1 : 0)))}
          />
          Três +1
        </label>
      </div>
      {split ? (
        <div className="ability-boost-split">
          <label>
            Atributo com +2
            <select
              aria-label="Atributo com +2"
              value={primary}
              onChange={(e) => {
                const next = Number(e.target.value);
                setSplit(next, next === secondary ? primary : secondary);
              }}
            >
              {allowed.map((i) => (
                <option key={i} value={i}>
                  {statNames[i]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Atributo com +1
            <select
              aria-label="Atributo com +1"
              value={secondary}
              onChange={(e) => setSplit(primary, Number(e.target.value))}
            >
              {allowed
                .filter((i) => i !== primary)
                .map((i) => (
                  <option key={i} value={i}>
                    {statNames[i]}
                  </option>
                ))}
            </select>
          </label>
        </div>
      ) : (
        <div className="ability-boost-grid" role="group" aria-label="Três atributos com +1">
          {allowed.map((i) => (
            <label key={i}>
              <input
                type="checkbox"
                aria-label={`${statNames[i]} +1`}
                checked={value[i] === 1}
                disabled={!value[i] && selected >= 3}
                onChange={() => onChange(value.map((v, index) => (index === i ? (v ? 0 : 1) : v)))}
              />
              <span>{statNames[i]}</span>
              <strong>+1</strong>
            </label>
          ))}
        </div>
      )}
      <p className="ability-boost-summary" role="status">
        {value
          .map((v, i) => (v ? `${statNames[i]} +${v}` : ''))
          .filter(Boolean)
          .join(' · ') || 'Escolha os atributos.'}
        {!split && (
          <span>
            {selected}/3 selecionados
            {selected < 3 ? ' — selecione três atributos para continuar.' : ''}
          </span>
        )}
      </p>
    </div>
  );
}
