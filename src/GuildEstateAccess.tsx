import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import {
  estateOpeningsSchema,
  guildEstateOpenings,
  guildEstateVisionPolygon,
  guildEstateCanSeeOpening,
  guildEstateCanSee,
  type EstateOpeningId,
  type EstateOpenings,
  type EstatePoint,
} from '../shared/guild-estate-vision';
export function useGuildEstateAccess(
  guildId: string,
  characterId: string,
  member: boolean,
  notice: (s: string) => void,
) {
  const [openings, setOpenings] = useState<EstateOpenings>(() => estateOpeningsSchema.parse({})),
    [busy, setBusy] = useState(false);
  const pending = useRef(false),
    version = useRef(0);
  const path = '/guilds/' + guildId + '/estate/openings',
    query = characterId ? '?character_id=' + encodeURIComponent(characterId) : '';
  useEffect(() => {
    setOpenings(estateOpeningsSchema.parse({}));
    if (!member) return;
    let live = true;
    const refresh = () => {
      if (pending.current) return;
      const requestedVersion = version.current;
      void api<{ openings: EstateOpenings }>(path + query)
        .then((r) => {
          if (live && !pending.current && requestedVersion === version.current)
            setOpenings(r.openings);
        })
        .catch((e) => {
          if (live) notice(e.message);
        });
    };
    refresh();
    const timer = setInterval(() => {
      if (!document.hidden) refresh();
    }, 3000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [guildId, characterId, member]);
  async function toggle(id: EstateOpeningId) {
    if (!member || pending.current) return;
    pending.current = true;
    version.current++;
    const before = openings,
      next = { ...openings, [id]: !openings[id] };
    setOpenings(next);
    setBusy(true);
    try {
      const r = await api<{ openings: EstateOpenings }>(path + '/' + id + query, {
        method: 'PATCH',
        body: JSON.stringify({ open: next[id] }),
      });
      setOpenings(r.openings);
    } catch (e) {
      setOpenings(before);
      notice((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return { openings, busy, toggle };
}
export function GuildEstateDoors({
  openings,
  member,
  busy,
  toggle,
  pixel,
  viewer,
}: {
  viewer: EstatePoint | null;
  openings: EstateOpenings;
  member: boolean;
  busy: boolean;
  toggle: (id: EstateOpeningId) => void;
  pixel: number;
}) {
  return (
    <g data-estate-access-controls="doors-and-windows">
      {guildEstateOpenings
        .filter((o) => !viewer || guildEstateCanSeeOpening(viewer, o.id, openings))
        .map((o) => {
          const angle = (o.rotation * Math.PI) / 180,
            normal = { x: -Math.sin(angle), y: Math.cos(angle) },
            center = {
              x: o.x + (Math.cos(angle) * o.length) / 2,
              y: o.y + (Math.sin(angle) * o.length) / 2,
            },
            side =
              !viewer || (viewer.x - center.x) * normal.x + (viewer.y - center.y) * normal.y >= 0
                ? 1
                : -1;
          const open = openings[o.id],
            r = Math.max(0.16, pixel * 12),
            controlY = (o.kind === 'window' ? 0.55 : 0.38) * side,
            controlVisible =
              !viewer ||
              guildEstateCanSee(
                viewer,
                { x: center.x + normal.x * controlY, y: center.y + normal.y * controlY },
                openings,
              );
          return (
            <g
              key={o.id}
              transform={`translate(${o.x} ${o.y}) rotate(${o.rotation})`}
              data-estate-opening={o.id}
              data-open={String(open)}
            >
              {o.kind === 'door' ? (
                <g transform={o.id === 'entry' ? 'translate(0 0)' : 'translate(.04 0)'}>
                  <g
                    data-estate-leaf="door"
                    className="guild-estate-opening-leaf"
                    style={{ transform: `rotate(${open ? -92 : 0}deg)` }}
                  >
                    <image
                      href="/guild/openings-20261020/door-leaf.webp"
                      x="-.025"
                      y="-.145"
                      width={o.id === 'entry' ? 1.78 : o.length - 0.06}
                      height=".29"
                      preserveAspectRatio="none"
                    />
                  </g>
                </g>
              ) : (
                <g transform="translate(.1 0)">
                  <g
                    data-estate-leaf="left-shutter"
                    className="guild-estate-opening-leaf"
                    style={{ transform: `rotate(${open ? -95 : 0}deg)` }}
                  >
                    <image
                      href="/guild/openings-20261020/shutter-leaf.webp"
                      x="0"
                      y="-.1"
                      width={(o.length - 0.2) / 2}
                      height=".2"
                      preserveAspectRatio="none"
                    />
                  </g>
                  <g transform={`translate(${o.length - 0.2} 0)`}>
                    <g
                      data-estate-leaf="right-shutter"
                      className="guild-estate-opening-leaf"
                      style={{ transform: `rotate(${open ? 95 : 0}deg)` }}
                    >
                      <g transform="scale(-1 1)">
                        <image
                          href="/guild/openings-20261020/shutter-leaf.webp"
                          x="0"
                          y="-.1"
                          width={(o.length - 0.2) / 2}
                          height=".2"
                          preserveAspectRatio="none"
                        />
                      </g>
                    </g>
                  </g>
                </g>
              )}
              {member && controlVisible && (
                <g
                  data-estate-interactive="opening"
                  role="button"
                  tabIndex={busy ? -1 : 0}
                  aria-disabled={busy}
                  aria-pressed={open}
                  aria-label={(open ? 'Fechar ' : 'Abrir ') + o.name.toLowerCase()}
                  transform={`translate(${o.length / 2} ${controlY}) rotate(${-o.rotation})`}
                  style={{ cursor: busy ? 'wait' : 'pointer' }}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(o.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggle(o.id);
                    }
                  }}
                >
                  <title>{(open ? 'Fechar ' : 'Abrir ') + o.name.toLowerCase()}</title>
                  <circle r={r * 1.45} fill="transparent" />
                  <circle r={r} fill="#29271cee" stroke="#bca574" strokeWidth={pixel * 1.2} />
                  <path
                    d={open ? 'M-.32-.32L.32.32M.32-.32L-.32.32' : 'M-.4 0H.4M0-.4V.4'}
                    transform={`scale(${r})`}
                    fill="none"
                    stroke="#e2cf9e"
                    strokeWidth=".12"
                  />
                </g>
              )}
            </g>
          );
        })}
    </g>
  );
}
export function GuildEstateVision({ at, openings }: { at: EstatePoint; openings: EstateOpenings }) {
  const path = guildEstateVisionPolygon(at, openings);
  return (
    <g data-estate-vision="walls" pointerEvents="none">
      <defs>
        <clipPath id="ge-visible-area" clipPathUnits="userSpaceOnUse">
          <path d={path} />
        </clipPath>
        <mask
          id="ge-wall-vision"
          x="-60"
          y="-60"
          width="180"
          height="180"
          maskUnits="userSpaceOnUse"
        >
          <rect x="-60" y="-60" width="180" height="180" fill="white" />
          <path d={path} fill="black" stroke="black" strokeWidth=".32" strokeLinejoin="round" />
        </mask>
      </defs>
      <rect x="-60" y="-60" width="180" height="180" fill="#0a0d09" mask="url(#ge-wall-vision)" />
    </g>
  );
}
