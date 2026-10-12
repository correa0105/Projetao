import { useEffect, useState } from 'react';
import { spells, type SheetResponse } from '../shared/character-sheet';
import { statNames } from '../shared/rules';
import { AdvancementSpells } from './CharacterAdvancement';
import { post } from './api';
const name = (id: string) => spells.find((s) => s.id === id)?.label || id;
export function SheetMagic({
  id,
  data,
  onSaved,
}: {
  id: string;
  data: SheetResponse;
  onSaved: (r: SheetResponse) => void;
}) {
  const d = data.derived!,
    state = data.sheet!.choices!.advancement!;
  const [prepared, setPrepared] = useState(state.prepared || {}),
    [used, setUsed] = useState(state.slotsUsed || (Array(9).fill(0) as number[])),
    [pact, setPact] = useState(state.pactUsed || 0);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    setPrepared(state.prepared || {});
    setUsed(state.slotsUsed || Array(9).fill(0));
    setPact(state.pactUsed || 0);
  }, [state]);
  async function save() {
    setBusy(true);
    setError('');
    setSaved(false);
    try {
      const r = await post<SheetResponse>(`/characters/${id}/sheet/magic-state`, {
        prepared: Object.fromEntries(
          d.magicClasses.filter((m) => m.flexible).map((m) => [m.class, prepared[m.class] || []]),
        ),
        slotsUsed: used,
        pactUsed: pact,
      });
      onSaved(r);
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="sheet-magic-progress">
      {d.magicClasses.length === 0 && (
        <p>As classes deste personagem ainda não concedem conjuração.</p>
      )}
      {d.magicClasses.map((m) => (
        <section className="sheet-magic-class" key={m.class}>
          <h3>
            {m.class} · nível {m.level}
          </h3>
          <p>
            {statNames[m.ability!]} · CD <b>{m.dc}</b> · ataque{' '}
            <b>
              {m.attack >= 0 ? '+' : ''}
              {m.attack}
            </b>{' '}
            · até círculo {m.maxSpell}
          </p>
          <h4>Truques</h4>
          <p>{m.cantrips.map(name).join(' · ') || 'Nenhum.'}</p>
          {m.known.length > 0 && (
            <>
              <h4>{m.class === 'Mago' ? 'Grimório' : 'Magias da classe'}</h4>
              <p>{m.known.map(name).join(' · ')}</p>
            </>
          )}
          {m.flexible && (
            <AdvancementSpells
              label={`Preparadas de ${m.class}`}
              count={m.prepareCount}
              optional
              options={m.allowed}
              value={prepared[m.class] || []}
              onChange={(v) => {
                setPrepared((p) => ({ ...p, [m.class]: v }));
                setSaved(false);
              }}
            />
          )}
          {!m.flexible && m.prepared.length > 0 && (
            <p>
              <b>Preparadas:</b> {m.prepared.map(name).join(' · ')}.
            </p>
          )}
          {m.always.length > 0 && (
            <p className="advancement-automatic">
              <b>Sempre preparadas:</b> {m.always.map(name).join(' · ')}. Não ocupam o limite da
              classe.
            </p>
          )}
          {m.choices.arcanum?.length > 0 && (
            <p>
              <b>Arcanos místicos:</b> {m.choices.arcanum.map(name).join(' · ')}. Um uso de cada por
              descanso longo.
            </p>
          )}
        </section>
      ))}
      {d.slotsByLevel.some((n) => n > 0) && (
        <section className="sheet-magic-slots">
          <h3>Espaços de magia</h3>
          <p>Compartilhados entre as classes conjuradoras. Recuperação em descanso longo.</p>
          <div>
            {d.slotsByLevel.map(
              (n, i) =>
                n > 0 && (
                  <label key={i}>
                    Círculo {i + 1}
                    <span>{n} espaços · gastos</span>
                    <input
                      aria-label={`Espaços gastos de círculo ${i + 1}`}
                      type="number"
                      min={0}
                      max={n}
                      value={used[i]}
                      onChange={(e) => {
                        setUsed((v) => v.map((x, j) => (j === i ? Number(e.target.value) : x)));
                        setSaved(false);
                      }}
                    />
                  </label>
                ),
            )}
          </div>
        </section>
      )}
      {d.magicClasses
        .filter((m) => m.pactSlots)
        .map((m) => (
          <section className="sheet-magic-slots" key={m.class}>
            <h3>Magia de Pacto · círculo {m.pactLevel}</h3>
            <p>{m.pactSlots} espaços separados. Recuperação em descanso curto ou longo.</p>
            <label>
              Espaços de pacto gastos
              <input
                aria-label="Espaços de pacto gastos"
                type="number"
                min={0}
                max={m.pactSlots}
                value={pact}
                onChange={(e) => {
                  setPact(Number(e.target.value));
                  setSaved(false);
                }}
              />
            </label>
          </section>
        ))}
      {error && (
        <p role="alert" className="advancement-error">
          {error}
        </p>
      )}
      {d.magicClasses.length > 0 && (
        <div className="sheet-actions">
          <button className="button primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Salvando…' : 'Salvar magias e espaços'}
          </button>
          {saved && <span role="status">Magias e espaços salvos.</span>}
        </div>
      )}
    </div>
  );
}
