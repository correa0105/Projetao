import { useState } from 'react';
import { fightingStyles } from '../shared/fighting-styles';
import type { SheetResponse } from '../shared/character-sheet';
import { post } from './api';
export function SheetClassChoices({
  id,
  data,
  saved,
}: {
  id: string;
  data: SheetResponse;
  saved: (value: SheetResponse) => void;
}) {
  const fighter = data.derived?.classLevels.find((s) => s.class === 'Guerreiro'),
    c = data.sheet?.choices;
  const [from, setFrom] = useState(''),
    [to, setTo] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  if (!fighter || !c) return null;
  const used =
    c.advancement?.styleChanges?.some((r) => r.classLevel === fighter.level) ||
    c.advancement?.levels.some(
      (r) =>
        r.class === 'Guerreiro' &&
        r.classLevel === fighter.level &&
        r.retrain?.some((s) => s.kind === 'style'),
    );
  const current = from || fighter.choices.style?.[0] || '';
  return (
    <section className="sheet-class-choices" aria-label="Escolhas da classe">
      <h4>Estilo de luta · Guerreiro, nível {fighter.level}</h4>
      <p>
        Ao ganhar um nível de Guerreiro, você pode trocar um estilo de luta por outro. A troca deste
        nível {used ? 'já foi usada.' : 'está disponível.'}
      </p>
      <div className="form-grid">
        <label>
          Estilo atual
          <select
            aria-label="Estilo atual do Guerreiro"
            value={current}
            disabled={busy || used}
            onChange={(e) => setFrom(e.target.value)}
          >
            {(fighter.choices.style || []).map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Novo estilo
          <select
            aria-label="Novo estilo de luta"
            value={to}
            disabled={busy || used}
            onChange={(e) => setTo(e.target.value)}
          >
            <option value="">Escolha o novo estilo</option>
            {fightingStyles
              .filter((s) => !fighter.choices.style?.includes(s))
              .map((s) => (
                <option key={s}>{s}</option>
              ))}
          </select>
        </label>
      </div>
      <button
        className="button outline"
        disabled={busy || used || !to}
        onClick={async () => {
          setBusy(true);
          setError('');
          try {
            saved(
              await post<SheetResponse>(`/characters/${id}/sheet/fighting-style`, {
                classLevel: fighter.level,
                from: current,
                to,
                requestId: crypto.randomUUID(),
              }),
            );
            setFrom('');
            setTo('');
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Confirmar estilo de luta
      </button>
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
