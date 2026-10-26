import type { VttToken } from '../shared/vtt';
import { Link2, X } from 'lucide-react';
import './vtt-attachment-guide.css';
export function VttAttachmentGuide({
  token,
  parents,
  busy,
  bind,
  change,
  cancel,
}: {
  token: VttToken | undefined;
  parents: VttToken[];
  busy: boolean;
  bind: (id: string | null) => void;
  change: () => void;
  cancel: () => void;
}) {
  return (
    <section className="vtt-attachment-guide" aria-label="Vincular mantendo a posição">
      <header>
        <strong>
          <Link2 size={15} />
          Vincular sem mover
        </strong>
        <button aria-label="Cancelar vinculação" onClick={cancel}>
          <X size={15} />
        </button>
      </header>
      {token ? (
        <>
          <p>
            <b>{token.name}</b> vai acompanhar o apoio. Clique no veículo/token no mapa ou escolha
            abaixo.
          </p>
          <label>
            Apoio para {token.name}
            <select
              aria-label="Escolher apoio para vincular"
              disabled={busy}
              value={token.attachment?.tokenId ?? ''}
              onChange={(e) => {
                if (e.target.value) bind(e.target.value);
              }}
            >
              <option value="">Escolha um veículo ou token</option>
              {parents.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.vehicle ? ' · veículo' : ''}
                </option>
              ))}
            </select>
          </label>
          <footer>
            <button disabled={busy} onClick={change}>
              Escolher outra peça
            </button>
            {token.attachment && (
              <button disabled={busy} onClick={() => bind(null)}>
                Soltar vínculo
              </button>
            )}
          </footer>
        </>
      ) : (
        <p>
          <b>1.</b> Clique no personagem ou peça que vai acompanhar. <b>2.</b> Escolha o veículo ou
          token de apoio.
        </p>
      )}
      <small>O vínculo mantém a posição e a orientação atuais.</small>
    </section>
  );
}
