import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Footprints } from 'lucide-react';
import { api } from './api';
import { mounts, mountCoats, ownedMountImage, type OwnedMount } from '../shared/mounts';
import './character-mount.css';
import { useCampMountSize } from './useCampMountSize';

export function CampMount({ characterId }: { characterId: string }) {
  const [mount, setMount] = useState<OwnedMount | null>(null);
  const [artRefresh, setArtRefresh] = useState(0);
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail?.characterId === characterId) setArtRefresh((v) => v + 1);
    };
    window.addEventListener('companion-art-updated', changed);
    return () => window.removeEventListener('companion-art-updated', changed);
  }, [characterId]);
  const host = useRef<HTMLDivElement>(null);
  useCampMountSize(host, mount?.id);
  useEffect(() => {
    let active = true;
    void api<OwnedMount[]>(`/stable/${characterId}`)
      .then((items) => {
        if (active) setMount(items.find((item) => item.displayed) || null);
      })
      .catch(() => {
        if (active) setMount(null);
      });
    return () => {
      active = false;
    };
  }, [characterId, artRefresh]);
  if (!mount) return null;
  const animal = mounts.find((item) => item.id === mount.mount_id);
  return (
    <div
      ref={host}
      className="camp-mount"
      data-mount-id={mount.id}
      data-character-id={characterId}
      style={{ '--mount-scale': animal?.scale || 1 } as CSSProperties}
    >
      <img src={ownedMountImage(mount)} alt={`${mount.name}, ${animal?.name || 'montaria'}`} />
      <span className="camp-mount-name">{mount.name}</span>
    </div>
  );
}

export function MountSelection({ characterId }: { characterId: string }) {
  const [artRefresh, setArtRefresh] = useState(0);
  useEffect(() => {
    const changed = (event: Event) => {
      if ((event as CustomEvent).detail?.characterId === characterId) setArtRefresh((v) => v + 1);
    };
    window.addEventListener('companion-art-updated', changed);
    return () => window.removeEventListener('companion-art-updated', changed);
  }, [characterId]);
  const [items, setItems] = useState<OwnedMount[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    void api<OwnedMount[]>(`/stable/${characterId}`)
      .then((value) => {
        if (active) {
          setItems(value);
          setReady(true);
        }
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [characterId, artRefresh]);
  async function select(id: string | null) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/stable/${characterId}/display`, {
        method: 'PUT',
        body: JSON.stringify({ mount_id: id }),
      });
      setItems((value) => value.map((item) => ({ ...item, displayed: item.id === id })));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="inventory-mounts" aria-label="Montarias do personagem">
      <header>
        <Footprints size={19} />
        <div>
          <h3>Montaria</h3>
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      {!ready && !error && <p role="status">Consultando suas montarias…</p>}
      {ready && !items.length && (
        <p>
          Você ainda não tem uma montaria. Encontre seu companheiro no{' '}
          <a href="#stable">estábulo</a>.
        </p>
      )}
      <div className="inventory-mount-list">
        {items.map((item) => (
          <button
            key={item.id}
            className="inventory-mount-choice"
            disabled={busy}
            aria-pressed={item.displayed}
            aria-label={`Mostrar ${item.name} no acampamento`}
            onClick={() => void select(item.id)}
          >
            <img src={ownedMountImage(item)} alt="" />
            <span>
              <strong>{item.name}</strong>
              <small>
                {mounts.find((animal) => animal.id === item.mount_id)?.name} ·{' '}
                {mountCoats[item.mount_id]?.find((coat) => coat.id === item.coat)?.label}
              </small>
            </span>
            {item.displayed && <Check size={17} />}
          </button>
        ))}
      </div>
      {items.length > 0 && (
        <button
          className="text-button"
          disabled={busy || !items.some((item) => item.displayed)}
          onClick={() => void select(null)}
        >
          Ocultar montaria
        </button>
      )}
    </section>
  );
}
