import { useState, type CSSProperties } from 'react';
import {
  guildFacilities,
  guildFacilityCost,
  guildFacilityImage,
  guildFacilityMaxLevel,
} from '../shared/guild-facilities';
import { guildFloorScale } from '../shared/guild-floor';
import { money } from '../shared/rules';
import { api } from './api';
import { Modal } from './components';
import './guild-facilities.css';

export function GuildFacility({
  guildId,
  room,
  levels,
  canUpgrade,
  treasury,
  characterId,
  changed,
}: {
  guildId: string;
  room: string;
  levels: { room: string; level: number }[];
  canUpgrade: boolean;
  treasury: number | null;
  characterId: string;
  changed: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const facility = guildFacilities.find((f) => f.room === room);
  if (!facility) return null;
  const level = levels.find((x) => x.room === room)?.level || 1,
    cost = guildFacilityCost(level);
  async function upgrade() {
    setBusy(true);
    setError('');
    try {
      await api(
        '/guilds/' +
          guildId +
          '/facilities/' +
          room +
          '/upgrade' +
          (characterId ? '?character_id=' + encodeURIComponent(characterId) : ''),
        { method: 'POST', body: JSON.stringify({ level: level + 1 }) },
      );
      await changed();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="guild-facility"
        data-guild-facility={room}
        aria-label={facility.name + ' · nível ' + level}
        style={
          {
            left: facility.x * 100 + '%',
            top: facility.y * 100 + '%',
            width: facility.scale * guildFloorScale(facility.y, room) * 100 + '%',
          } as CSSProperties
        }
        onClick={() => {
          setError('');
          setOpen(true);
        }}
      >
        <img src={guildFacilityImage(room)} alt="" draggable={false} />
        <span>
          {facility.name}
          <small>Nível {level}</small>
        </span>
      </button>
      {open && (
        <Modal title={facility.name} close={() => !busy && setOpen(false)}>
          <div className="guild-facility-details">
            <img src={guildFacilityImage(room)} alt={facility.name} />
            <p>{facility.description}</p>
            <strong>
              Nível {level} de {guildFacilityMaxLevel}
            </strong>
            <p>
              Esta instalação pertence à guilda. As melhorias ficam registradas para receber
              benefícios futuramente.
            </p>
            <p>Benefícios ainda não estão ativos.</p>
            {level < guildFacilityMaxLevel ? (
              <>
                <p>
                  Próximo nível: {level + 1} · {money(cost)} PO do tesouro da guilda.
                </p>
                {treasury !== null && <p>Tesouro disponível: {money(treasury)} PO.</p>}
                {canUpgrade ? (
                  <button
                    className="button primary"
                    disabled={busy || treasury === null || treasury < cost}
                    onClick={() => void upgrade()}
                  >
                    {busy ? 'Melhorando…' : 'Melhorar para nível ' + (level + 1)}
                  </button>
                ) : (
                  <p>O fundador pode autorizar a melhoria usando o tesouro da guilda.</p>
                )}
              </>
            ) : (
              <p>Nível máximo alcançado.</p>
            )}
            {error && <p role="alert">{error}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
