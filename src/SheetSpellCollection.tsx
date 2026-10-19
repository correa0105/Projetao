import { useMemo, useState } from 'react';
import { spells, type SheetChoices } from '../shared/character-sheet';
import { sheetSpellHistory } from '../shared/sheet-spell-history';
import type { Character } from './types';
import { SpellReference } from './SpellReference';

export function SheetSpellCollection({
  character,
  choices,
}: {
  character: Character;
  choices: SheetChoices;
}) {
  const rows = useMemo(() => sheetSpellHistory(character, choices), [character, choices]);
  const [selected, setSelected] = useState<string | null>(null);
  return (
    <section className="sheet-spell-collection" aria-label="Magias adquiridas">
      <h3>Magias e truques adquiridos</h3>
      {!rows.length ? (
        <p>Nenhuma magia adquirida registrada.</p>
      ) : (
        <ul>
          {rows.map((row) => {
            const spell = spells.find((s) => s.id === row.id)!;
            return (
              <li key={row.source + ':' + row.id}>
                <div>
                  <b>{spell.label}</b>
                  <small>
                    {spell.level === 0 ? 'Truque' : `Círculo ${spell.level}`} · {row.status}
                  </small>
                  <span>
                    {row.characterLevel === null
                      ? 'Nível de aquisição não registrado'
                      : `Adquirida no nível ${row.characterLevel} do personagem`}
                    {row.classLevel !== null
                      ? ` · ${row.source} nível ${row.classLevel}`
                      : ` · ${row.source}`}
                  </span>
                </div>
                <button
                  type="button"
                  className="spell-reference-open"
                  aria-label={'Ver magia: ' + spell.label}
                  onClick={() => setSelected(spell.id)}
                >
                  Ver magia
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {selected && (
        <SpellReference
          id={selected}
          label={spells.find((s) => s.id === selected)?.label || selected}
          close={() => setSelected(null)}
        />
      )}
    </section>
  );
}
