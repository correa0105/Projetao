import { useEffect, useState } from 'react';
import { api, post } from './api';
import { AttributeDice } from './AttributeDice';
import { AttributeRollRule } from './AttributeRollRule';
import type { CharacterSlotRolls } from '../shared/character-slot-rolls';

export function CharacterSlotDice({
  initialSlot,
  onReady,
}: {
  initialSlot?: number;
  onReady: (slot: number | null) => void;
}) {
  const [slots, setSlots] = useState<CharacterSlotRolls[]>([]),
    [selected, setSelected] = useState(initialSlot ?? 0),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let live = true;
    api<CharacterSlotRolls[]>('/character-slots')
      .then((list) => {
        if (live) {
          setSlots(list);
          setSelected((n) =>
            list.some((p) => p.slot === n && !p.occupied && !p.pending)
              ? n
              : (list.find((p) => !p.occupied && !p.pending)?.slot ?? 0),
          );
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, []);
  const current = slots.find((p) => p.slot === selected),
    ready = !!current?.rolls && current.revealed === 6 && !current.occupied && !current.pending;
  useEffect(() => onReady(ready ? selected : null), [ready, selected, onReady]);
  async function act(action: 'roll' | 'reveal', revealed?: number) {
    setBusy(true);
    setError('');
    try {
      const p = await post<CharacterSlotRolls>(
        `/character-slots/${selected}/${action}`,
        revealed === undefined ? {} : { revealed },
      );
      setSlots((list) => list.map((old) => (old.slot === p.slot ? p : old)));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="character-slot-dice" aria-label="Atributos do slot">
      <h3>Primeiro, role seus atributos</h3>
      <p className="muted small">
        Os dados e seu progresso ficam salvos neste slot. Excluir o personagem antes do nível 4
        mantém os mesmos resultados. Ao alcançar o nível 4, este slot libera uma nova rolagem para a
        próxima criação.
      </p>
      {loading ? (
        <p role="status">Consultando seus slots…</p>
      ) : (
        <label>
          Slot do personagem
          <select
            value={selected}
            disabled={busy}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {!selected && <option value={0}>Nenhum slot disponível</option>}
            {slots.map((p) => (
              <option key={p.slot} value={p.slot} disabled={p.occupied || p.pending}>
                Slot {p.slot}
                {p.occupied
                  ? ` · ${p.name}`
                  : p.pending
                    ? ' · arte em preparação'
                    : p.rolls
                      ? ' · dados salvos'
                      : ' · disponível'}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      {current &&
        !current.occupied &&
        !current.pending &&
        (current.rolls ? (
          <AttributeDice
            key={`${current.slot}-${current.generation}`}
            rolls={current.rolls}
            revealed={current.revealed}
            minimum={current.minimum}
            disabled={busy}
            allowReplay={false}
            onReveal={(n) => void act('reveal', n)}
          />
        ) : (
          <>
            <AttributeRollRule minimum={8} />
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void act('roll')}
            >
              {busy ? 'Guardando dados…' : 'Começar rolagens deste slot'}
            </button>
          </>
        ))}
      {ready && (
        <p role="status">
          Seis resultados guardados. Agora escolha a origem e a aparência do personagem.
        </p>
      )}
    </section>
  );
}
