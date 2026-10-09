import { useEffect, useState, type DragEvent } from 'react';
import { api } from './api';
import { companionMime, type VttCompanion } from '../shared/vtt-companions';
export function VttCompanions({
  roomId,
  kind,
  disabled,
  bring,
}: {
  roomId: string;
  kind: 'mount' | 'pet';
  disabled: boolean;
  bring: (id: string) => void;
}) {
  const [animals, setAnimals] = useState<VttCompanion[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api<{ companions: VttCompanion[] }>('/vtt/rooms/' + roomId + '/companions')
      .then((data) => {
        if (active) setAnimals(data.companions);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [roomId, kind]);
  const drag = (event: DragEvent<HTMLButtonElement>, id: string) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData(companionMime, id);
    event.dataTransfer.effectAllowed = 'copy';
  };
  const shown = animals.filter((a) => a.kind === kind);
  return (
    <section
      aria-label={kind === 'mount' ? 'Montarias dos personagens' : 'Mascotes dos personagens'}
    >
      <h3>{kind === 'mount' ? 'Trazer montaria' : 'Trazer mascote'}</h3>
      <p className="vtt-muted">Clique ou arraste a imagem para colocar no mapa.</p>
      {error && <p role="alert">{error}</p>}
      {loading && <p>Carregando animais…</p>}
      {!loading && !error && !shown.length && (
        <p>Nenhum animal deste tipo pertence aos seus personagens.</p>
      )}
      {shown.map((a) => (
        <button
          key={a.id}
          className="vtt-list-row vtt-character-row"
          data-companion-id={a.id}
          aria-label={'Colocar ' + a.name + ' · ' + a.characterName}
          disabled={disabled}
          draggable={!disabled}
          onDragStart={(e) => drag(e, a.id)}
          onClick={() => bring(a.id)}
          title="Arraste para o mapa"
        >
          <span className="vtt-companion-thumbnail">
            <img src={a.portraitUrl || a.tokenUrl} alt="" />
          </span>
          <span>
            <strong>{a.name}</strong>
            <small>{a.speciesName}</small>
            <small>
              Pertence a {a.characterName} · {a.ownerName}
            </small>
          </span>
          <span className="vtt-companion-token-mini" title="Token visto de cima">
            <img src={a.tokenUrl} alt="Token visto de cima" />
          </span>
        </button>
      ))}
    </section>
  );
}
