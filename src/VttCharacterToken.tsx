import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import type { Character } from './types';
import './vtt-character-tokens.css';

export function VttCharacterToken({ character }: { character: Character }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [character.id, character.portrait_revision]);
  return (
    <span className="vtt-character-preview">
      {character.portrait_revision > 0 && !failed ? (
        <img
          src={`/api/characters/${character.id}/token?v=${character.portrait_revision}`}
          alt={`Token de ${character.name}`}
          draggable={false}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <Users size={20} aria-hidden="true" />
      )}
    </span>
  );
}
