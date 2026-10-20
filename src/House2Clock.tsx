import { useState } from 'react';
import { worldClockLabel, worldClockPhase } from '../shared/world-clock';
import { house2DayPhases } from '../shared/house2-lighting';
import { useWorldClock } from './useWorldClock';
export function House2Clock({
  world,
  initiallyEditing = false,
  saved,
}: {
  world: ReturnType<typeof useWorldClock>;
  initiallyEditing?: boolean;
  saved?: () => void;
}) {
  const [editing, setEditing] = useState(initiallyEditing),
    [time, setTime] = useState(() => worldClockLabel(world.timeMs)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function save() {
    setBusy(true);
    setError('');
    try {
      await world.adjust(time);
      setEditing(false);
      saved?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível ajustar o relógio.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="h2-world-clock">
      <span>Relógio do mundo</span>
      <strong>
        <time dateTime={worldClockLabel(world.timeMs)}>
          {world.clock ? worldClockLabel(world.timeMs) : '—:—'}
        </time>{' '}
        · {house2DayPhases[worldClockPhase(world.timeMs)].name}
      </strong>
      <p className="muted small">Um dia no jogo a cada 6 horas reais · 4 ciclos por dia real.</p>
      {world.clock?.canEdit && !editing && (
        <button
          onClick={() => {
            setTime(worldClockLabel(world.timeMs));
            setEditing(true);
            setError('');
          }}
        >
          Ajustar hora
        </button>
      )}
      {world.clock?.canEdit && editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <label>
            Hora do mundo
            <input
              aria-label="Hora do mundo"
              type="time"
              required
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={busy}
            />
          </label>
          <button disabled={busy}>Salvar hora</button>
          <button type="button" disabled={busy} onClick={() => setEditing(false)}>
            Cancelar
          </button>
        </form>
      )}
      {(error || world.error) && <p role="status">{error || world.error}</p>}
    </div>
  );
}
