import { useEffect, useState } from 'react';
import { WorldPlacePicker } from './WorldPlacePicker';
import { api } from './api';
import type { VttState } from '../shared/vtt';
export function VttPlaceSettings({
  state,
  changed,
  beforeSave,
}: {
  state: VttState;
  changed: (state: VttState) => void;
  beforeSave: () => Promise<unknown>;
}) {
  const [region, setRegion] = useState(state.region_id || ''),
    [place, setPlace] = useState(state.location_id || ''),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    setRegion(state.region_id || '');
    setPlace(state.location_id || '');
    setMessage('');
  }, [state.id, state.region_id, state.location_id]);
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        setBusy(true);
        setMessage('');
        void beforeSave()
          .then(() =>
            api<VttState>('/vtt/rooms/' + state.id + '/location', {
              method: 'PUT',
              body: JSON.stringify({
                region_id: region || undefined,
                location_id: place || undefined,
              }),
            }),
          )
          .then((next) => {
            changed(next);
            setMessage('Local da mesa salvo. Escolha este mesmo local ao publicar a missão.');
          })
          .catch((e) => setMessage(e.message))
          .finally(() => setBusy(false));
      }}
    >
      <h3>Local da aventura</h3>
      <WorldPlacePicker
        regionId={region}
        locationId={place}
        onRegionChange={setRegion}
        onLocationChange={setPlace}
      />
      <button
        disabled={
          busy || (region === (state.region_id || '') && place === (state.location_id || ''))
        }
      >
        {busy ? 'Salvando…' : 'Salvar local da mesa'}
      </button>
      {message && <p role="status">{message}</p>}
    </form>
  );
}
