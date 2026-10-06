import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { Check, Footprints } from 'lucide-react';
import { api } from './api';
import { mounts, mountCoats, ownedMountImage, type OwnedMount } from '../shared/mounts';
import './character-mount.css';

export function CampMount({ characterId }: { characterId: string }) {
  const [mount, setMount] = useState<OwnedMount | null>(null);
  const host = useRef<HTMLDivElement>(null);
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
  }, [characterId]);
  useLayoutEffect(() => {
    const element = host.current;
    const camp = element?.closest<HTMLElement>('.character-camp');
    const stage = camp?.querySelector<HTMLElement>('.camp-stage');
    if (!element || !camp || !stage) return;
    const align = () => {
      const bounds = camp.getBoundingClientRect(),
        figures = [...stage.querySelectorAll<HTMLElement>('.camp-figure')];
      const floor = Math.max(...figures.map((figure) => figure.getBoundingClientRect().bottom));
      const height = Math.max(...figures.map((figure) => figure.clientHeight));
      if (Number.isFinite(floor))
        element.style.top = `${floor - bounds.top + Math.min(14, height * 0.035)}px`;
    };
    const observer = new ResizeObserver(align);
    observer.observe(camp);
    observer.observe(stage);
    stage.querySelectorAll('.camp-figure').forEach((element) => observer.observe(element));
    align();
    return () => observer.disconnect();
  }, [mount]);
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
  }, [characterId]);
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
