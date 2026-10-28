import { useEffect, useState, type CSSProperties } from 'react';
import {
  guildFacilityImage,
  defaultGuildFacilities,
  type GuildFacilityCatalog,
} from '../shared/guild-facilities';
import { guildFloorScale } from '../shared/guild-floor';
import { api } from './api';
import { Modal } from './components';
import { GuildBastionPanel } from './GuildBastionPanel';
import './guild-facilities.css';

export function GuildFacility({
  guildId,
  room,
  levels,
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
    [catalog, setCatalog] = useState<GuildFacilityCatalog | null>(null);
  useEffect(() => {
    let live = true;
    void api<GuildFacilityCatalog>('/community/facilities')
      .then((value) => {
        if (live) setCatalog(value);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [room, open]);
  const facility = (catalog?.items || defaultGuildFacilities()).find((f) => f.room === room);
  if (!facility) return null;
  const level = levels.find((x) => x.room === room)?.level || 1;
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
        onClick={() => setOpen(true)}
      >
        <img src={guildFacilityImage(room)} alt="" draggable={false} />
        <span>
          {facility.name}
          <small>Nível {level}</small>
        </span>
      </button>
      {open && (
        <Modal title={facility.name} close={() => setOpen(false)}>
          <div className="guild-facility-details">
            <img src={guildFacilityImage(room)} alt="" />
            <GuildBastionPanel
              guildId={guildId}
              room={room}
              characterId={characterId}
              changed={changed}
            />
          </div>
        </Modal>
      )}
    </>
  );
}
