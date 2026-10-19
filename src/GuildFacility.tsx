import { useEffect, useState, type CSSProperties } from 'react';
import {
  guildFacilityCost,
  guildFacilityImage,
  guildFacilityMaxLevel,
  defaultGuildFacilities,
  type GuildFacilityCatalog,
  type GuildFacilityDefinition,
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
  const [catalog, setCatalog] = useState<GuildFacilityCatalog | null>(null),
    [editing, setEditing] = useState<GuildFacilityDefinition | null>(null),
    [notice, setNotice] = useState('');
  useEffect(() => {
    let live = true;
    void api<GuildFacilityCatalog>('/community/facilities')
      .then((value) => {
        if (live) setCatalog(value);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [room]);
  const facility =
    editing || (catalog?.items || defaultGuildFacilities()).find((f) => f.room === room);
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
  async function edit() {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const current = await api<GuildFacilityCatalog>('/community/facilities');
      setCatalog(current);
      if (current.can_edit) setEditing(current.items.find((f) => f.room === room) || null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function saveDefinition() {
    if (!editing) return;
    setBusy(true);
    setError('');
    try {
      const { room: roomId, ...input } = editing;
      const saved = await api<GuildFacilityDefinition>('/community/facilities/' + roomId, {
        method: 'PUT',
        body: JSON.stringify(input),
      });
      setCatalog((current) =>
        current
          ? { ...current, items: current.items.map((f) => (f.room === roomId ? saved : f)) }
          : current,
      );
      setEditing(null);
      setNotice('Objeto atualizado.');
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
            <p>{facility.upgrade_description}</p>
            <p>Benefícios ainda não estão ativos.</p>
            {catalog?.can_edit && !editing && (
              <button className="button outline" disabled={busy} onClick={() => void edit()}>
                Editar objeto e textos
              </button>
            )}
            {editing && (
              <form
                className="guild-facility-editor"
                onSubmit={(event) => {
                  event.preventDefault();
                  void saveDefinition();
                }}
              >
                <p>Texto e posição deste objeto em todas as guildas.</p>
                <fieldset disabled={busy}>
                  <label>
                    Nome do objeto
                    <input
                      value={editing.name}
                      required
                      minLength={2}
                      maxLength={100}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </label>
                  <label>
                    Descrição
                    <textarea
                      aria-label="Descrição"
                      value={editing.description}
                      maxLength={2000}
                      onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                    />
                  </label>
                  <label>
                    Texto das melhorias
                    <textarea
                      aria-label="Texto das melhorias"
                      value={editing.upgrade_description}
                      maxLength={2000}
                      onChange={(e) =>
                        setEditing({ ...editing, upgrade_description: e.target.value })
                      }
                    />
                  </label>
                  <div className="guild-facility-position">
                    <label>
                      Posição horizontal (%)
                      <input
                        type="number"
                        min="3"
                        max="97"
                        step="0.1"
                        value={Math.round(editing.x * 1000) / 10}
                        onChange={(e) =>
                          setEditing({ ...editing, x: Number(e.target.value) / 100 })
                        }
                      />
                    </label>
                    <label>
                      Posição no chão (%)
                      <input
                        type="number"
                        min="40"
                        max="97"
                        step="0.1"
                        value={Math.round(editing.y * 1000) / 10}
                        onChange={(e) =>
                          setEditing({ ...editing, y: Number(e.target.value) / 100 })
                        }
                      />
                    </label>
                    <label>
                      Tamanho base (%)
                      <input
                        type="number"
                        min="4"
                        max="60"
                        step="0.1"
                        value={Math.round(editing.scale * 1000) / 10}
                        onChange={(e) =>
                          setEditing({ ...editing, scale: Number(e.target.value) / 100 })
                        }
                      />
                    </label>
                  </div>
                </fieldset>
                <div>
                  <button className="button primary" disabled={busy}>
                    Salvar objeto
                  </button>
                  <button
                    className="button outline"
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditing(null);
                      setError('');
                    }}
                  >
                    Cancelar edição
                  </button>
                </div>
              </form>
            )}
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
            {notice && <p role="status">{notice}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
