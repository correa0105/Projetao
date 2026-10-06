import { useEffect, useState } from 'react';
import { houseCatalog, type HouseItem } from '../shared/house';
import { Modal } from './components';
import './house-reader.css';

const fontOptions = [
  { value: 'medieval', label: 'Cursiva medieval' },
  { value: 'calligraphy', label: 'Caligrafia' },
  { value: 'gothic', label: 'Gótica' },
  { value: 'classic', label: 'Clássica' },
] as const;
type ReadingFont = (typeof fontOptions)[number]['value'];
const preferenceKey = 'alvorada.house.reading-font';

function initialFont(): ReadingFont {
  try {
    const stored = localStorage.getItem(preferenceKey);
    if (fontOptions.some((option) => option.value === stored)) return stored as ReadingFont;
  } catch {
    // A private browser may refuse preference storage; reading remains available.
  }
  return 'medieval';
}

export function HouseItemReader({ item, close }: { item: HouseItem; close: () => void }) {
  const [font, setFont] = useState<ReadingFont>(initialFont);
  const [imageError, setImageError] = useState(false);
  const spec = houseCatalog.find((entry) => entry.id === item.catalog_id);
  const title = item.content.title || spec?.name || 'Lembrança';
  const text = item.content.text || spec?.description || '';
  const letter = item.catalog_id === 'letter';
  const frame = item.catalog_id === 'frame';

  useEffect(() => {
    try {
      localStorage.setItem(preferenceKey, font);
    } catch {
      // Font choice still works for the current reading session.
    }
  }, [font]);
  useEffect(() => {
    setImageError(false);
  }, [item.id]);

  return (
    <Modal title={title} close={close}>
      <div
        className={`house-item-reader house-item-reader--${letter ? 'letter' : frame ? 'frame' : 'memory'}`}
        data-reading-font={font}
      >
        <div className="house-reader-tools">
          <label>
            Fonte de leitura
            <select value={font} onChange={(event) => setFont(event.target.value as ReadingFont)}>
              {fontOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {letter ? (
          <div className="house-reader-paper">
            <img
              src="/house/items/letter-open.webp"
              alt=""
              draggable={false}
              className="house-reader-paper-art"
            />
            <section
              className="house-reader-paper-content"
              tabIndex={0}
              aria-label={`Texto de ${title}`}
            >
              <h3>{title}</h3>
              <p>{text}</p>
              {item.sender_name && <small>Presente de {item.sender_name}</small>}
            </section>
          </div>
        ) : (
          <>
            {frame && (
              <div className="house-reader-picture">
                {item.has_image && !imageError ? (
                  <img
                    src={`/api/house/items/${encodeURIComponent(item.id)}/image`}
                    alt={title}
                    draggable={false}
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <p>
                    {imageError
                      ? 'Não foi possível carregar a imagem.'
                      : 'Este quadro ainda não tem imagem.'}
                  </p>
                )}
              </div>
            )}
            <section
              className="house-reader-dedication"
              tabIndex={0}
              aria-label={`Texto de ${title}`}
            >
              <h3>{title}</h3>
              <p>{text}</p>
              {item.sender_name && <small>Presente de {item.sender_name}</small>}
            </section>
          </>
        )}
      </div>
    </Modal>
  );
}
