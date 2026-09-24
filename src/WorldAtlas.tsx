import { lazy, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, Compass, MapPin, Plus, ScrollText, X } from 'lucide-react';
import { api } from './api';
import type { AtlasMarker } from './atlas-types';
import { WorldMap } from './WorldMap';
import { WORLD_TERRITORIES } from './world-territories';
import type { AtlasData, AtlasLocation, Post } from './types';
import './world-atlas.css';

const continentPositions = Object.fromEntries(WORLD_TERRITORIES.map((t) => [t.id, [t.x, t.y]]));
const KingdomMap = lazy(() =>
  import('./KingdomMap').then((module) => ({ default: module.KingdomMap })),
);
export function WorldAtlas({
  posts,
  onPublish,
  renderMission,
}: {
  posts: Post[];
  onPublish: (location?: AtlasLocation) => void;
  renderMission: (post: Post) => ReactNode;
}) {
  const [atlas, setAtlas] = useState<AtlasData | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [regionId, setRegionId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [filter, setFilter] = useState<'active' | 'history' | 'all'>('active');
  const [notice, setNotice] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  const region = atlas?.regions.find((r) => r.id === regionId);
  const location = atlas?.locations.find((l) => l.id === locationId);
  const markers = useMemo<AtlasMarker[]>(
    () =>
      !atlas
        ? []
        : regionId
          ? atlas.locations
              .filter((l) => l.region_id === regionId)
              .map((l) => ({ id: l.id, name: l.name, x: Number(l.map_x), y: Number(l.map_y) }))
          : atlas.regions.map((r) => ({
              id: r.id,
              name: r.name,
              available: r.available,
              x: continentPositions[r.id]?.[0] ?? 0.5,
              y: continentPositions[r.id]?.[1] ?? 0.5,
            })),
    [atlas, regionId],
  );
  const regionMissions = posts.filter((p) => p.kind === 'mission' && p.region_id === regionId);
  const missions = regionMissions.filter((p) => !locationId || p.location_id === locationId);
  const visibleMissions = missions.filter(
    (p) =>
      filter === 'all' ||
      (filter === 'active'
        ? ['open', 'active'].includes(p.status)
        : ['completed', 'closed'].includes(p.status)),
  );
  useEffect(() => {
    let alive = true;
    setError('');
    api<AtlasData>('/atlas')
      .then((data) => {
        if (alive) setAtlas(data);
      })
      .catch((e) => {
        if (alive) setError(e.message);
      });
    return () => {
      alive = false;
    };
  }, [retry]);
  useEffect(() => {
    if (drawer) closeRef.current?.focus({ preventScroll: true });
  }, [drawer, locationId]);
  function back() {
    setDrawer(false);
    setRegionId(null);
    setLocationId(null);
    setNotice('');
  }
  function select(id: string) {
    if (!regionId) {
      const next = atlas?.regions.find((r) => r.id === id);
      if (!next?.available) {
        setNotice(`${next?.name}: exploração em breve.`);
        return;
      }
      setNotice('');
      setRegionId(id);
      setLocationId(null);
      setFilter('active');
    } else {
      setLocationId(id);
      setDrawer(true);
      setFilter('active');
    }
  }
  return (
    <section
      className={`world-atlas ${regionId ? 'is-regional' : 'is-world'} ${drawer ? 'has-drawer' : ''}`}
      aria-label="Atlas interativo"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          if (drawer) setDrawer(false);
          else if (regionId) back();
        }
      }}
    >
      {atlas &&
        (regionId ? (
          <Suspense
            fallback={
              <div className="atlas-wait" role="status">
                Abrindo a visão do reino…
              </div>
            }
          >
            <KingdomMap markers={markers} selectedId={locationId} onSelect={select} />
          </Suspense>
        ) : (
          <WorldMap markers={markers} onSelect={select} />
        ))}
      {region && (
        <header className="world-atlas-heading">
          <span className="atlas-eyebrow">
            <Compass size={14} aria-hidden="true" /> Alvorada Cinzenta
          </span>
          <h1>
            {region.name}
            <span className="title-dot">.</span>
          </h1>
          <button className="atlas-back" onClick={back}>
            <ArrowLeft size={14} /> Voltar ao mundo
          </button>
        </header>
      )}
      {!atlas && (
        <div className="atlas-wait" role={error ? 'alert' : 'status'}>
          {error || 'Desdobrando o atlas…'}
          {error && (
            <button className="button outline" onClick={() => setRetry((n) => n + 1)}>
              Tentar novamente
            </button>
          )}
        </div>
      )}
      {notice && (
        <div className="atlas-notice" role="status">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Fechar aviso do território">
            <X size={16} />
          </button>
        </div>
      )}
      {region && !drawer && (
        <div className="atlas-regional-guide">
          <button
            onClick={() => {
              setLocationId(null);
              setDrawer(true);
            }}
          >
            <ScrollText size={16} /> Missões do reino <span>{regionMissions.length}</span>
          </button>
        </div>
      )}
      {drawer && region && (
        <aside
          className="atlas-missions-drawer"
          aria-label={`Missões de ${location?.name || region.name}`}
        >
          <div className="atlas-drawer-head">
            <span className="atlas-eyebrow">
              <MapPin size={13} /> {location ? region.name : 'Reino do Norte'}
            </span>
            <button
              ref={closeRef}
              className="atlas-close"
              onClick={() => setDrawer(false)}
              aria-label="Fechar lista de missões"
            >
              <X size={18} />
            </button>
          </div>
          <h2>{location?.name || region.name}</h2>
          <p className="atlas-place-description">{location?.description || region.description}</p>
          <button className="button primary atlas-create" onClick={() => onPublish(location)}>
            <Plus size={16} /> Registrar missão aqui
          </button>
          <div className="atlas-mission-tabs" aria-label="Filtrar missões do mapa">
            {(
              [
                ['active', 'Ativas'],
                ['history', 'Histórico'],
                ['all', 'Todas'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                onPointerUp={(event) => {
                  // In a scrollable mobile drawer Chromium can consume the
                  // compatibility click after a pan; a completed tap still
                  // changes this idempotent filter.
                  if (event.pointerType === 'touch') setFilter(value);
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="atlas-mission-list">
            {visibleMissions.length ? (
              visibleMissions.map(renderMission)
            ) : (
              <div className="atlas-empty">
                <ScrollText size={26} />
                <h3>Nenhum chamado por aqui</h3>
                <p>
                  {filter === 'history'
                    ? 'As aventuras concluídas nesta região aparecerão aqui.'
                    : 'Abra o primeiro capítulo desta região.'}
                </p>
              </div>
            )}
          </div>
        </aside>
      )}
    </section>
  );
}
