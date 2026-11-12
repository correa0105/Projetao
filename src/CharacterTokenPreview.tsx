import { useEffect, useState } from 'react';
import { Modal } from './components';
import type { Character } from './types';
import './character-token-preview.css';

export function CharacterTokenPreview({
  character,
  close,
}: {
  character: Character;
  close: () => void;
}) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const source = `/api/characters/${character.id}/token?preview=1&v=${character.portrait_revision}`;
  useEffect(() => {
    if (!character.token_available) return;
    let alive = true;
    setReady(false);
    setError(false);
    const image = new Image();
    image.onload = async () => {
      try {
        await image.decode();
        if (image.naturalWidth !== image.naturalHeight) throw new Error('token');
        if (alive) setReady(true);
      } catch {
        if (alive) setError(true);
      }
    };
    image.onerror = () => {
      if (alive) setError(true);
    };
    image.src = source;
    return () => {
      alive = false;
    };
  }, [source, character.token_available, retry]);
  return (
    <Modal title={`Token de ${character.name}`} className="character-token-dialog" close={close}>
      <p className="character-token-caption">Vista de cima · VTT</p>
      <div className="character-token-preview-image">
        {!character.token_available ? (
          <p role="status">O token aparecerá aqui quando a arte estiver pronta.</p>
        ) : error ? (
          <div role="status">
            <p>Não foi possível abrir o token.</p>
            <button type="button" onClick={() => setRetry(retry + 1)}>
              Tentar novamente
            </button>
          </div>
        ) : ready ? (
          <img src={source} alt={`Token de ${character.name}, visto de cima para o VTT`} />
        ) : (
          <p role="status">Preparando a prévia.</p>
        )}
      </div>
    </Modal>
  );
}
