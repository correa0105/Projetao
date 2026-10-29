import { VttAssetImage } from './VttAssetImage';
import { useEffect, useState, type DragEvent } from 'react';
import { Users, RefreshCw } from 'lucide-react';
import { api } from './api';
import type { VttScene } from '../shared/vtt';
import type { VttRoomCharacter } from '../shared/vtt-room-characters';
import './vtt-map-controls.css';

export function VttRoomCharacters({
  roomId,
  scene,
  busy,
  place,
  drag,
}: {
  roomId: string;
  scene: VttScene;
  busy: boolean;
  place: (id: string) => void;
  drag: (event: DragEvent<HTMLElement>, id: string) => void;
}) {
  const [characters, setCharacters] = useState<VttRoomCharacter[]>([]),
    [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState('');
  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    api<{ characters: VttRoomCharacter[] }>(`/vtt/rooms/${roomId}/characters`)
      .then((value) => {
        if (live) setCharacters(value.characters);
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
  }, [roomId, version]);
  return (
    <section className="vtt-room-characters" aria-label="Personagens dos jogadores da mesa">
      <div className="vtt-room-character-heading">
        <strong>Personagens da mesa</strong>
        <button
          type="button"
          title="Atualizar personagens da mesa"
          aria-label="Atualizar personagens da mesa"
          disabled={busy || loading}
          onClick={() => setVersion((v) => v + 1)}
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <p className="vtt-muted">
        Clique para colocar ou selecionar; arraste para escolher o local. Os jogadores precisam
        entrar nesta mesa para aparecer aqui.
      </p>
      {loading && <p role="status">Carregando personagens…</p>}
      {error && <p role="alert">{error}</p>}
      {characters.map((c) => {
        const token = scene.tokens.find(
          (t) => t.characterId === c.id && t.controller === c.controller,
        );
        return (
          <button
            type="button"
            className="vtt-list-row vtt-room-character"
            key={c.id}
            data-room-character={c.id}
            disabled={busy || loading}
            draggable={!busy && !loading}
            onDragStart={(e) => drag(e, c.id)}
            aria-label={`${token ? 'Selecionar' : 'Colocar'} ${c.name} no mapa`}
            onClick={() => place(c.id)}
          >
            {token?.image ? (
              <VttAssetImage thumbnail src={token.image} alt="" draggable={false} />
            ) : (
              <Users size={25} />
            )}
            <span>
              <b>{c.name}</b>
              <small>
                {c.player_name} · {c.class} · Nível {c.level}
              </small>
              <small>{token ? 'Já está neste mapa' : 'Colocar neste mapa'}</small>
            </span>
          </button>
        );
      })}
      {!loading && !error && !characters.length && (
        <p>Nenhum personagem dos participantes disponível.</p>
      )}
    </section>
  );
}
