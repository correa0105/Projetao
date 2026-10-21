import { useState, type FormEvent } from 'react';
import type { AtlasLocation } from './types';
import { api, post } from './api';
import { Modal } from './components';
export function AtlasPinEditor({
  regionId,
  position,
  place,
  places,
  close,
  saved,
}: {
  regionId: string;
  position: { x: number; y: number };
  place?: AtlasLocation;
  places: AtlasLocation[];
  close: () => void;
  saved: (id: string) => Promise<void>;
}) {
  const [existing, setExisting] = useState(place);
  const [name, setName] = useState(place?.name || ''),
    [description, setDescription] = useState(place?.description || ''),
    [visible, setVisible] = useState(place?.pin_visible ?? true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const value = {
        name,
        description,
        map_x: position.x,
        map_y: position.y,
        pin_visible: visible,
      };
      const result = existing
        ? await api<{ id: string }>('/atlas/locations/' + existing.id, {
            method: 'PUT',
            body: JSON.stringify({ ...value, revision: existing.revision || 0 }),
          })
        : await post<{ id: string }>('/atlas/locations', { ...value, region_id: regionId });
      await saved(result.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={place ? 'Editar pin do mapa' : 'Novo pin do mapa'} close={close}>
      <form className="stack" onSubmit={submit}>
        {!place && (
          <label>
            Local do reino
            <select
              value={existing?.id || ''}
              onChange={(e) => {
                const next = places.find((p) => p.id === e.target.value);
                setExisting(next);
                setName(next?.name || '');
                setDescription(next?.description || '');
                setVisible(true);
              }}
            >
              <option value="">Criar um novo local</option>
              {places
                .filter((p) => p.region_id === regionId)
                .map((p) => (
                  <option value={p.id} key={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </label>
        )}
        <label>
          Nome do local
          <input
            autoFocus
            value={name}
            minLength={2}
            maxLength={100}
            required
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Descrição curta
          <textarea
            rows={3}
            maxLength={1500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="atlas-visible-check">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} />
          Mostrar pin no mapa
        </label>
        <p className="muted small">
          Ocultar o pin mantém a história e as missões vinculadas ao local.
        </p>
        {error && <p role="alert">{error}</p>}
        <button className="button primary" disabled={busy}>
          {busy ? 'Salvando…' : 'Salvar pin'}
        </button>
      </form>
    </Modal>
  );
}
