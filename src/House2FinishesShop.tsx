import { useState } from 'react';
import type { House2Plot } from '../shared/house-v2';
import {
  house2FinishesCatalog,
  house2FinishNames,
  type House2FinishKind,
} from '../shared/house2-finishes';
import { vttVisualSource } from '../shared/vtt-asset-visuals';
import type { Character } from './types';
import { post } from './api';
import { Modal } from './components';
export function House2FinishesShop({
  plot,
  character,
  owned,
  balance,
  disabled,
  refresh,
  notice,
}: {
  plot: House2Plot;
  character: Character | null | undefined;
  owned: string[];
  balance: number;
  disabled: boolean;
  refresh: () => Promise<void>;
  notice: (s: string) => void;
}) {
  const [kind, setKind] = useState<House2FinishKind | null>(null),
    [buy, setBuy] = useState<(typeof house2FinishesCatalog)[number] | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function apply(id: string | null) {
    if (!kind || disabled || busy) return;
    setBusy(true);
    try {
      await post(`/house-v2/plots/${plot.id}/finish`, {
        kind,
        catalog_id: id,
        revision: plot.revision,
      });
      await refresh();
      notice('Revestimento aplicado.');
    } catch (e) {
      notice((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  async function purchase() {
    if (!buy || !character || disabled || busy) return;
    setBusy(true);
    setError('');
    try {
      await post('/house-v2/finishes', {
        character_id: character.id,
        catalog_id: buy.id,
        idempotency_key: crypto.randomUUID(),
      });
      await refresh();
      setBuy(null);
      notice('Revestimento comprado. Agora selecione Aplicar na casa.');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="h2-finishes-shop" aria-label="Revestimentos da casa">
      <h3>Revestimentos da casa</h3>
      <p>Desbloqueie e reutilize nas suas casas. A estrutura e a porta permanecem no lugar.</p>
      <div className="h2-finish-tabs" role="group" aria-label="Tipo de revestimento">
        {(Object.keys(house2FinishNames) as House2FinishKind[]).map((k) => (
          <button
            key={k}
            aria-pressed={kind === k}
            onClick={() => setKind((current) => (current === k ? null : k))}
          >
            {house2FinishNames[k]}
          </button>
        ))}
      </div>
      {disabled && <p>Salve os ajustes do terreno antes de trocar o revestimento.</p>}
      {kind && (
        <div className="h2-catalog h2-finishes-catalog">
          <button
            disabled={disabled || busy || !plot.house_id || !plot.finishes?.[kind]}
            onClick={() => void apply(null)}
          >
            <strong>Original da casa</strong>
            <small>{plot.finishes?.[kind] ? 'Restaurar original' : 'Em uso'}</small>
          </button>
          {house2FinishesCatalog
            .filter((f) => f.kind === kind)
            .map((f) => {
              const purchased = owned.includes(f.id),
                applied = plot.finishes?.[kind] === f.id;
              return (
                <button
                  key={f.id}
                  disabled={
                    disabled ||
                    busy ||
                    applied ||
                    (purchased ? !plot.house_id : !character || balance < f.price)
                  }
                  onClick={() => (purchased ? void apply(f.id) : (setError(''), setBuy(f)))}
                >
                  <img
                    src={vttVisualSource('thumbnail' in f ? f.thumbnail : f.image)}
                    alt={'Prévia · ' + f.name}
                    loading="lazy"
                  />
                  <strong>{f.name}</strong>
                  <small>
                    {applied
                      ? 'Em uso'
                      : purchased
                        ? 'Aplicar na casa'
                        : `${f.price} créditos · comprar`}
                  </small>
                </button>
              );
            })}
        </div>
      )}
      {buy && (
        <Modal
          title="Comprar revestimento"
          close={() => {
            if (!busy) setBuy(null);
          }}
        >
          <div className="h2-purchase-confirmation">
            <img src={vttVisualSource(buy.image)} alt={buy.name} />
            <h3>{buy.name}</h3>
            <p>
              {buy.price} créditos de teste · saldo após a compra: {balance - buy.price}.
            </p>
            {error && <p role="alert">{error}</p>}
            <div className="h2-confirm-actions">
              <button disabled={busy} onClick={() => setBuy(null)}>
                Cancelar
              </button>
              <button
                disabled={busy || disabled || balance < buy.price}
                onClick={() => void purchase()}
              >
                Confirmar compra
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
