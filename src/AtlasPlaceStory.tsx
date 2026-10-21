import { useEffect, useState } from 'react';
import { api, post } from './api';
import { LoreBlocks, LoreEditor } from './LoreLibrary';
import type { LoreIndex, LorePage } from '../shared/lore';
import type { AtlasLocation, AtlasRegion } from './types';
export function AtlasPlaceStory({
  region,
  place,
  admin,
  onChanged,
}: {
  region: AtlasRegion;
  place?: AtlasLocation;
  admin: boolean;
  onChanged: () => Promise<void>;
}) {
  const pageId = place?.history_page_id || (!place ? region.history_page_id : null);
  const [page, setPage] = useState<LorePage | null>(null),
    [index, setIndex] = useState<LoreIndex | null>(null),
    [editing, setEditing] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false);
  useEffect(() => {
    let live = true;
    setPage(null);
    setEditing(false);
    setError('');
    if (!pageId) return;
    setLoading(true);
    void api<LorePage>('/lore/pages/' + pageId)
      .then((p) => {
        if (live) setPage(p);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [pageId]);
  async function edit() {
    setLoading(true);
    setError('');
    try {
      const id =
        pageId ||
        (
          await post<{ page_id: string }>('/atlas/history', {
            region_id: region.id,
            location_id: place?.id,
          })
        ).page_id;
      const [p, i] = await Promise.all([
        api<LorePage>('/lore/pages/' + id),
        api<LoreIndex>('/lore'),
      ]);
      setPage(p);
      setIndex(i);
      setEditing(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section
      className="atlas-place-story lore-library"
      aria-label={'História de ' + (place?.name || region.name)}
    >
      {error && <p role="alert">{error}</p>}
      {loading && <p role="status">Abrindo a história…</p>}
      {editing && page && index ? (
        <LoreEditor
          key={page.id}
          page={page}
          index={index}
          compact
          onCancel={() => setEditing(false)}
          onSaved={async (p) => {
            setPage(p);
            setEditing(false);
            await onChanged();
          }}
        />
      ) : (
        <>
          {admin && (
            <button className="button outline" disabled={loading} onClick={() => void edit()}>
              {page ? 'Editar História' : 'Escrever História'}
            </button>
          )}
          {page ? (
            <article className="lore-reader">
              <h3>{page.title}</h3>
              {page.subtitle && <p>{page.subtitle}</p>}
              {!page.published && <p>Rascunho · visível somente à administração.</p>}
              <LoreBlocks blocks={page.blocks} />
            </article>
          ) : (
            !loading && <p>A história deste local ainda não foi publicada.</p>
          )}
        </>
      )}
    </section>
  );
}
