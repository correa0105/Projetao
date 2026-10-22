import { useEffect, useId, useRef, useState } from 'react';
import { Crosshair, X } from 'lucide-react';
import type { Character } from './types';
import './character-token-preview.css';

export function CharacterTokenPreview({ character }: { character: Character }) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const source = `/api/characters/${character.id}/token?preview=1&v=${character.portrait_revision}`;
  const close = () => {
    setOpen(false);
    setPinned(false);
  };
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
  useEffect(() => {
    if (!pinned) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [pinned]);
  return (
    <div
      ref={root}
      className="character-token-preview"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned) setOpen(false);
      }}
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          close();
        }
      }}
    >
      <button
        type="button"
        className="character-token-preview-trigger"
        aria-label={`Ver token de ${character.name} no VTT`}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => {
          setPinned(!pinned);
          setOpen(!pinned);
        }}
      >
        <Crosshair size={20} aria-hidden="true" />
        <span className="character-token-preview-light" aria-hidden="true" />
      </button>
      {open && (
        <section
          id={id}
          className="character-token-preview-card"
          aria-label={`Prévia do token de ${character.name}`}
        >
          <div className="character-token-preview-heading">
            <div>
              <strong>{character.name}</strong>
              <small>Vista de cima · VTT</small>
            </div>
            <button type="button" aria-label="Fechar prévia do token" onClick={close}>
              <X size={15} aria-hidden="true" />
            </button>
          </div>
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
              <p role="status">Preparando a prévia…</p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
