import { useState } from 'react';
import { LockKeyhole, ArrowLeftRight, EyeOff } from 'lucide-react';
import { Modal } from './components';
import type { Character } from './types';
import type { CharacterCampState } from '../shared/character-account';
import './camp-roster.css';
export function CampRoster({
  characters,
  camp,
  target,
  close,
  save,
  create,
  canCreate,
  busy,
}: {
  characters: Character[];
  camp: CharacterCampState;
  target: number | null;
  close: () => void;
  save: (positions: CharacterCampState['positions']) => Promise<void>;
  create: () => void;
  canCreate: boolean;
  busy: boolean;
}) {
  const [position, setPosition] = useState(target ?? 0);
  const names = camp.positions.map(
    (id) => characters.find((c) => c.id === id)?.name || 'Lugar livre',
  );
  const assigned = new Map<number, Character>();
  for (const c of characters)
    if (c.creation_slot && !assigned.has(c.creation_slot)) assigned.set(c.creation_slot, c);
  for (const c of characters.filter((c) => ![...assigned.values()].some((a) => a.id === c.id))) {
    const free = [1, 2, 3, 4].find((slot) => !assigned.has(slot));
    if (free) assigned.set(free, c);
  }
  return (
    <Modal title="Personagens e slots" close={close}>
      <p>
        Dois personagens aparecem no acampamento. Os demais ficam na reserva, com ficha e pertences
        preservados.
      </p>
      <label>
        Onde exibir
        <select
          aria-label="Lugar no acampamento"
          value={position}
          disabled={busy}
          onChange={(e) => setPosition(Number(e.target.value))}
        >
          <option value={0}>Esquerda · {names[0]}</option>
          <option value={1}>Direita · {names[1]}</option>
        </select>
      </label>
      <div className="camp-roster-grid">
        {[1, 2, 3, 4].map((slot, index) => {
          const character = assigned.get(slot),
            locked = slot > camp.limit;
          const displayed = character ? camp.positions.indexOf(character.id) : -1;
          return (
            <article
              className={`camp-roster-card${locked ? ' is-locked' : ''}`}
              key={slot}
              aria-label={`Slot ${slot}${locked ? ' bloqueado' : ''}`}
            >
              <span className="eyebrow">
                Slot {slot} ·{' '}
                {locked
                  ? 'Bloqueado'
                  : character
                    ? displayed >= 0
                      ? 'No acampamento'
                      : 'Na reserva'
                    : 'Disponível'}
              </span>
              {character && !locked ? (
                <>
                  <img
                    src={
                      character.portrait_revision > 0
                        ? `/api/characters/${character.id}/portrait?v=${character.portrait_revision}`
                        : '/character-silhouette-v2.png'
                    }
                    alt=""
                  />
                  <strong>{character.name}</strong>
                  <small>
                    {character.race} · {character.class} · Nível {character.level}
                  </small>
                  <button
                    className="button outline small-button"
                    disabled={busy || displayed === position}
                    onClick={() => {
                      const next = [...camp.positions] as CharacterCampState['positions'];
                      if (displayed >= 0) next[displayed] = next[position];
                      next[position] = character.id;
                      void save(next);
                    }}
                  >
                    <ArrowLeftRight size={14} />
                    {displayed === position
                      ? 'Já neste lugar'
                      : `Exibir ${position === 0 ? 'à esquerda' : 'à direita'}`}
                  </button>
                  {displayed >= 0 && (
                    <button
                      className="button outline small-button"
                      disabled={busy}
                      onClick={() => {
                        const next = [...camp.positions] as CharacterCampState['positions'];
                        next[displayed] = null;
                        setPosition(displayed);
                        void save(next);
                      }}
                    >
                      <EyeOff size={14} />
                      Retirar da tela
                    </button>
                  )}
                </>
              ) : (
                <div className="camp-roster-empty">
                  {locked ? (
                    <>
                      <LockKeyhole size={26} />
                      <span>Slot extra bloqueado para esta conta</span>
                    </>
                  ) : (
                    <span>Espaço para um novo personagem</span>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {canCreate && (
        <button className="button primary" disabled={busy} onClick={create}>
          Criar personagem
        </button>
      )}
    </Modal>
  );
}
