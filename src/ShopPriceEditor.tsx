import { useState } from 'react';
import { money } from '../shared/rules';
import { api } from './api';
import { Modal } from './components';
import type { Item } from './types';

type SavedPrice = { id: string; price_cp: number | null };

export function ShopPriceEditor({
  item,
  close,
  saved,
}: {
  item: Item;
  close: () => void;
  saved: (result: SavedPrice) => Promise<void>;
}) {
  const isHouse = item.category === 'Itens de House';
  const [value, setValue] = useState(
    item.price_cp === null ? '' : (item.price_cp / 100).toFixed(2).replace('.', ','),
  );
  const [unpriced, setUnpriced] = useState(item.price_cp === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    if (busy) return;
    setError('');
    let price: number | null = null;
    if (isHouse || !unpriced) {
      const input = value.trim();
      if (!/^\d+(?:[,.]\d{1,2})?$/.test(input)) {
        setError('Informe um preço em PO com até duas casas decimais, como 12,50.');
        return;
      }
      const [whole, fraction = ''] = input.split(/[,.]/);
      price = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
      if (!Number.isSafeInteger(price) || price < 1 || price > 2147483647) {
        setError('O preço deve ficar entre 0,01 e 21.474.836,47 PO.');
        return;
      }
    }
    setBusy(true);
    try {
      const result = await api<SavedPrice>(`/catalog/${encodeURIComponent(item.id)}/price`, {
        method: 'PATCH',
        body: JSON.stringify({ price_cp: price }),
      });
      await saved(result);
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title="Editar preço"
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="shop-price-form"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="shop-price-current">
          <strong>{item.name}</strong>
          <span>
            Preço atual:{' '}
            {item.price_cp === null ? 'sem preço definido' : `${money(item.price_cp)} PO`}
          </span>
        </div>
        <label>
          Preço em PO
          <input
            type="text"
            inputMode="decimal"
            autoFocus
            maxLength={16}
            placeholder="12,50"
            value={value}
            disabled={busy || unpriced}
            required={!unpriced}
            onChange={(event) => {
              setValue(event.target.value);
              setError('');
            }}
            aria-describedby="shop-price-hint"
          />
        </label>
        {!isHouse && (
          <label className="shop-price-unpriced">
            <input
              type="checkbox"
              checked={unpriced}
              disabled={busy}
              onChange={(event) => {
                setUnpriced(event.target.checked);
                setError('');
              }}
            />
            Sem preço definido
          </label>
        )}
        <p id="shop-price-hint" className="shop-price-hint">
          {unpriced
            ? 'O item fica indisponível para compra.'
            : 'Use vírgula ou ponto e até duas casas decimais.'}{' '}
          O novo preço vale para as próximas compras.
        </p>
        {error && (
          <p className="shop-price-error" role="alert">
            {error}
          </p>
        )}
        <div className="shop-price-actions">
          <button type="button" className="button" disabled={busy} onClick={close}>
            Cancelar
          </button>
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar preço'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
