import { useRef, useState } from 'react';
import { houseCatalog } from '../shared/house';
import { money } from '../shared/rules';
import { post } from './api';
import { Modal } from './components';
import './house.css';

export function HousePurchase({
  item,
  characterId,
  close,
  purchased,
}: {
  item: (typeof houseCatalog)[number];
  characterId: string;
  close: () => void;
  purchased: () => Promise<void>;
}) {
  const [title, setTitle] = useState(''),
    [text, setText] = useState('');
  const [picture, setPicture] = useState<File | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const key = useRef(crypto.randomUUID());
  function changed() {
    key.current = crypto.randomUUID();
  }
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      let image: string | undefined;
      if (picture) {
        if (picture.size > 5 * 1024 * 1024) throw Error('A imagem deve ter até 5 MB.');
        image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(',')[1]);
          reader.onerror = () => reject(Error('Não foi possível ler a imagem.'));
          reader.readAsDataURL(picture);
        });
      }
      await post('/house/purchase', {
        character_id: characterId,
        catalog_id: item.id,
        idempotency_key: key.current,
        content: { title, text },
        ...(image ? { image } : {}),
      });
      await purchased();
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={item.name}
      close={() => {
        if (!busy) close();
      }}
    >
      <form
        className="house-buy"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <img src={item.image} alt={item.name} />
        <p>{item.description}</p>
        <p>A compra fica na coleção de House deste personagem.</p>
        {['letter', 'frame'].includes(item.id) && (
          <>
            <label>
              {item.id === 'letter' ? 'Assunto' : 'Nome da lembrança'}
              <input
                maxLength={80}
                value={title}
                disabled={busy}
                onChange={(e) => {
                  setTitle(e.target.value);
                  changed();
                }}
              />
            </label>
            <label>
              {item.id === 'letter' ? 'Sua carta' : 'Dedicatória'}
              <textarea
                maxLength={3000}
                value={text}
                disabled={busy}
                onChange={(e) => {
                  setText(e.target.value);
                  changed();
                }}
              />
            </label>
            {item.id === 'frame' && (
              <label>
                Imagem
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  onChange={(e) => {
                    setPicture(e.target.files?.[0] || null);
                    changed();
                  }}
                />
              </label>
            )}
          </>
        )}
        <button type="submit" disabled={busy}>
          Comprar por {money(item.price_cp)} PO
        </button>
        {error && <p role="alert">{error}</p>}
      </form>
    </Modal>
  );
}
