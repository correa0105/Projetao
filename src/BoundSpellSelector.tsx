import { useEffect, useState } from 'react';
import { api } from './api';
import type { BoundSpellOption, SpellBindingSpec } from '../shared/shop-spell-bindings';

type Choice = { id: string; name: string };
const schoolLabels: Record<string, string> = {
  C: 'Conjuração',
  D: 'Adivinhação',
  V: 'Evocação',
  N: 'Necromancia',
  T: 'Transmutação',
};

export function BoundSpellSelector({
  itemId,
  itemName,
  value,
  onChange,
  disabled,
}: {
  itemId: string;
  itemName: string;
  value?: string;
  onChange: (choice: Choice | undefined) => void;
  disabled: boolean;
}) {
  const [data, setData] = useState<{ spec: SpellBindingSpec; options: BoundSpellOption[] } | null>(
      null,
    ),
    [error, setError] = useState('');
  useEffect(() => {
    let current = true;
    setData(null);
    setError('');
    api<{ spec: SpellBindingSpec; options: BoundSpellOption[] }>(
      '/catalog/' + encodeURIComponent(itemId) + '/spell-options',
    )
      .then((result) => {
        if (current) setData(result);
      })
      .catch((reason) => {
        if (current) setError(reason.message);
      });
    return () => {
      current = false;
    };
  }, [itemId]);
  const selected = data?.options.find((x) => x.id === value);
  return (
    <div className="shop-bound-spell">
      <label>
        Magia vinculada
        <select
          aria-label={'Magia vinculada de ' + itemName}
          value={value ?? ''}
          disabled={disabled || !data}
          onChange={(event) => {
            const option = data?.options.find((x) => x.id === event.target.value);
            onChange(option ? { id: option.id, name: option.label } : undefined);
          }}
        >
          <option value="">
            {error
              ? 'Opções indisponíveis'
              : data
                ? 'Escolher ' +
                  (data.spec.level === 0 ? 'truque' : 'magia de nível ' + data.spec.level)
                : 'Carregando magias…'}
          </option>
          {Object.entries(schoolLabels).map(([school, label]) => (
            <optgroup key={school} label={label}>
              {data?.options
                .filter((x) => x.school === school)
                .map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label} · {option.source}
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      {error ? (
        <small role="alert">{error}</small>
      ) : selected ? (
        <small>
          Vinculada permanentemente.{' '}
          <a href={selected.source_url} target="_blank" rel="noopener noreferrer">
            {selected.name} · {selected.source}
          </a>
        </small>
      ) : (
        <small>Escolha a magia fixa deste exemplar antes de comprar.</small>
      )}
    </div>
  );
}
