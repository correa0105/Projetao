import './vtt-scenery-actions.css';
import { ArrowUpRight, Link2 } from 'lucide-react';
import type { VttToken } from '../shared/vtt';
export function VttSceneryActions({
  token,
  candidates,
  busy,
  convert,
  bind,
  chooseOnMap,
}: {
  token: VttToken;
  candidates: VttToken[];
  busy: boolean;
  convert: () => void;
  bind: (id: string | null) => void;
  chooseOnMap: () => void;
}) {
  return (
    <section className="vtt-scenery-actions" aria-label="Movimento vinculado">
      {token.layer === 'map' && !token.vehicle && !token.sceneryToken && (
        <button disabled={busy} onClick={convert}>
          <ArrowUpRight size={14} />
          Transformar cenário em token
        </button>
      )}
      <label>
        <Link2 size={14} />
        {token.name} acompanha
        <select
          aria-label="Veículo ou token de apoio"
          disabled={busy}
          value={token.attachment?.tokenId ?? ''}
          onChange={(e) => bind(e.target.value || null)}
        >
          <option value="">Independente</option>
          {candidates.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.vehicle ? ' · veículo' : ''}
            </option>
          ))}
        </select>
      </label>
      <button disabled={busy} onClick={chooseOnMap}>
        Escolher apoio no mapa
      </button>
      {token.attachment && (
        <button disabled={busy} onClick={() => bind(null)}>
          Soltar vínculo
        </button>
      )}
      <small>A posição atual é mantida. Esta peça acompanha o movimento e o giro do apoio.</small>
    </section>
  );
}
