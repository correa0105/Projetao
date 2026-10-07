import { useId, useState } from 'react';
import type { ArmorSetOption } from './armor-set-options';

export function ArmorSetPicker({
  options,
  busy,
  onEquip,
}: {
  options: ArmorSetOption[];
  busy: boolean;
  onEquip: (id: string) => void;
}) {
  const id = useId();
  const [choice, setChoice] = useState('');
  const selected = options.find((option) => option.id === choice);
  return (
    <div className="equipment-set-picker">
      <label htmlFor={id}>Armadura completa</label>
      <div className="equipment-set-controls">
        <select
          id={id}
          value={selected?.id || ''}
          disabled={busy || !options.length}
          onChange={(event) => setChoice(event.target.value)}
        >
          <option value="">
            {options.length ? 'Escolher conjunto' : 'Nenhum conjunto na mochila'}
          </option>
          {options.map((option) => (
            <option key={option.id} value={option.id} disabled={!option.available}>
              {option.name}
              {!option.available ? ' — peças indisponíveis' : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button outline small-button"
          disabled={busy || !selected?.available}
          onClick={() => {
            if (!busy && selected?.available) onEquip(selected.id);
          }}
        >
          Equipar armadura
        </button>
      </div>
      <p>
        {selected?.available
          ? `Equipa as ${selected.pieceCount} peças compatíveis do conjunto de uma vez.`
          : 'As peças precisam estar na mochila e livres para este personagem ou animal.'}
      </p>
    </div>
  );
}
