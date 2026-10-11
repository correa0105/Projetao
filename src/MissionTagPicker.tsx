import { useEffect, useState } from 'react';
import { api } from './api';
import type { TagCatalog } from '../shared/mission-tags';
import './mission-tags.css';

export function MissionTagPicker({
  value,
  onChange,
  disabled = false,
}: {
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const [catalog, setCatalog] = useState<TagCatalog | null>(null),
    [error, setError] = useState(''),
    [search, setSearch] = useState('');
  useEffect(() => {
    let active = true;
    api<TagCatalog>('/mission-tags/catalog')
      .then((r) => {
        if (active) setCatalog(r);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, []);
  return (
    <fieldset className="mission-tag-picker" disabled={disabled}>
      <legend>Tags da missão</legend>
      <p className="small muted">Cada participante recebe 1 de cada tag ao concluir.</p>
      {error && <p role="alert">{error}</p>}
      {!catalog && !error && <p role="status">Carregando tags…</p>}
      {catalog && (
        <>
          <input
            type="search"
            aria-label="Buscar tags da missão"
            placeholder="Buscar tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className="tag-choices">
            {catalog.tags
              .filter(
                (t) =>
                  (t.active || value.includes(t.id)) &&
                  t.name.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
              )
              .map((t) => (
                <label key={t.id} className="tag-pill">
                  <input
                    type="checkbox"
                    checked={value.includes(t.id)}
                    disabled={!t.active && !value.includes(t.id)}
                    onChange={(e) =>
                      onChange(
                        e.target.checked ? [...value, t.id] : value.filter((id) => id !== t.id),
                      )
                    }
                  />
                  {t.name}
                </label>
              ))}
          </div>
          {!catalog.tags.some((t) => t.active) && (
            <p className="small muted">O administrador pode cadastrar tags em Conquistas.</p>
          )}
        </>
      )}
    </fieldset>
  );
}
