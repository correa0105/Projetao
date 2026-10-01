import { useEffect, useState } from 'react';
import { api } from './api';
import type { StorageState } from './types';
import { EQUIPMENT_LABELS, type EquipmentSlot } from '../shared/equipment';
import './equipment.css';

export function ArtEquipmentChoices({
  characterId,
  selected,
  onChange,
  onReady,
  disabled,
}: {
  characterId: string;
  selected: EquipmentSlot[];
  onChange: (slots: EquipmentSlot[]) => void;
  onReady: (ready: boolean) => void;
  disabled: boolean;
}) {
  const [storage, setStorage] = useState<StorageState | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setStorage(null);
    setError('');
    onReady(false);
    api<StorageState>(`/characters/${characterId}/storage`)
      .then((value) => {
        if (!alive) return;
        setStorage(value);
        onChange(value.equipped.filter((item) => item.image_path).map((item) => item.slot));
        onReady(true);
      })
      .catch((error) => {
        if (alive) setError(error.message);
      });
    return () => {
      alive = false;
    };
  }, [characterId, retry, onChange, onReady]);
  return (
    <fieldset disabled={disabled} className="stack">
      <legend>Equipamentos na imagem</legend>
      <p>
        Escolha quais itens equipados devem aparecer. O ilustrador usará as imagens da sua mochila
        para reproduzir os mesmos modelos.
      </p>
      {error ? (
        <>
          <p className="form-error" role="alert">
            {error}
          </p>
          <button
            type="button"
            className="button outline"
            onClick={() => setRetry((value) => value + 1)}
          >
            Carregar equipamentos novamente
          </button>
        </>
      ) : !storage ? (
        <p role="status">Carregando equipamentos…</p>
      ) : !storage.equipped.length ? (
        <p>
          Nenhum item equipado. Equipe seus itens na Mochila antes de gerar uma imagem com eles.
        </p>
      ) : (
        <div className="art-equipment-list">
          {storage.equipped.map((item) => (
            <label className="art-equipment-choice" key={item.slot}>
              <input
                type="checkbox"
                checked={selected.includes(item.slot)}
                disabled={!item.image_path}
                onChange={(event) =>
                  onChange(
                    event.target.checked
                      ? [...selected, item.slot]
                      : selected.filter((slot) => slot !== item.slot),
                  )
                }
              />
              {item.image_path && <img src={item.image_path} alt="" />}
              <span>
                <small>{EQUIPMENT_LABELS[item.slot]}</small>
                {item.name}
                {!item.image_path && <small>Sem imagem de referência</small>}
              </span>
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
