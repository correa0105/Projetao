import { useEffect, useRef, useState } from 'react';
import { api, post } from './api';
import { Modal } from './components';
import type { ArtReview, ArtState } from '../shared/character-art';
import './character-art-choice.css';

export function CharacterArtChoice({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const [reviews, setReviews] = useState<ArtReview[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const seen = useRef(new Set<string>()),
    resolved = useRef(new Set<string>()),
    previous = useRef('');
  const refresh = useRef(onRefresh);
  refresh.current = onRefresh;
  useEffect(() => {
    let alive = true,
      updating = false;
    const update = async () => {
      if (updating) return;
      updating = true;
      try {
        const state = await api<ArtState>('/character-art');
        if (!alive) return;
        const next = (state.reviews || []).filter((review) => !resolved.current.has(review.id)),
          signature = JSON.stringify(next.map((r) => [r.id, r.current_revision]));
        const changed = previous.current && previous.current !== signature;
        previous.current = signature;
        setReviews(next);
        if (changed) await refresh.current();
      } catch {
        /* Keep an already displayed choice while the connection recovers. */
      } finally {
        updating = false;
      }
    };
    void update();
    const timer = setInterval(() => void update(), 4000);
    window.addEventListener('focus', update);
    return () => {
      alive = false;
      clearInterval(timer);
      window.removeEventListener('focus', update);
    };
  }, []);
  useEffect(() => {
    if (openId && !reviews.some((review) => review.id === openId)) {
      setOpenId(null);
      return;
    }
    const next = reviews.find((r) => !seen.current.has(r.id));
    if (next && !openId && !document.querySelector('dialog[open]')) {
      seen.current.add(next.id);
      setOpenId(next.id);
    }
  }, [reviews, openId]);
  const current = reviews.find((r) => r.id === openId);
  return (
    <>
      {!current && reviews.length > 0 && (
        <div className="art-choice-pending" aria-label="Imagens aguardando sua escolha">
          {reviews.map((r) => (
            <button
              key={r.id}
              type="button"
              className="button outline"
              onClick={() => {
                seen.current.add(r.id);
                setOpenId(r.id);
              }}
            >
              Comparar imagem de {r.name}
            </button>
          ))}
        </div>
      )}
      {current && (
        <ArtChoiceDialog
          key={current.id}
          review={current}
          close={() => setOpenId(null)}
          decided={async () => {
            resolved.current.add(current.id);
            setOpenId(null);
            setReviews((rows) => rows.filter((r) => r.id !== current.id));
            window.dispatchEvent(new Event('character-art-choice-updated'));
            await refresh.current();
          }}
        />
      )}
    </>
  );
}

function ArtChoiceDialog({
  review,
  close,
  decided,
}: {
  review: ArtReview;
  close: () => void;
  decided: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loaded, setLoaded] = useState<string[]>([]);
  const ready = [
    'current',
    'portrait',
    'token',
    ...(review.has_current_token ? ['current-token'] : []),
  ].every((k) => loaded.includes(k));
  const load = (key: string) => () =>
    setLoaded((keys) => (keys.includes(key) ? keys : [...keys, key]));
  const fail = () =>
    setError('Não foi possível carregar a comparação. Feche e abra novamente para tentar.');
  const choose = async (decision: 'accepted' | 'kept') => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await post(`/character-art/${review.id}/decision`, { decision });
      await decided();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };
  return (
    <Modal
      title={`Escolher imagem de ${review.name}`}
      close={() => {
        if (!busy) close();
      }}
      dismissOnBackdrop={!busy}
      dismissOnEscape={!busy}
    >
      <div className="art-image-choice" aria-busy={busy}>
        <p>
          A imagem atual continua em uso até você escolher. A escolha inclui o retrato e o token do
          VTT.
        </p>
        <div className="art-image-choice-grid">
          <figure>
            <figcaption>Imagem atual</figcaption>
            <img
              className="art-choice-portrait"
              src={`/api/characters/${review.character_id}/portrait?v=${review.current_revision}`}
              alt={`Imagem atual de ${review.name}`}
              onLoad={load('current')}
              onError={fail}
            />
            <span className="art-choice-token-label">Token atual</span>
            {review.has_current_token ? (
              <img
                className="art-choice-token"
                src={`/api/characters/${review.character_id}/token?preview=1&v=${review.current_revision}`}
                alt={`Token atual de ${review.name}`}
                onLoad={load('current-token')}
                onError={fail}
              />
            ) : (
              <span className="art-choice-no-token">Sem token anterior</span>
            )}
          </figure>
          <figure>
            <figcaption>Imagem nova</figcaption>
            <img
              className="art-choice-portrait"
              src={`/api/character-art/${review.id}/proposed/portrait`}
              alt={`Imagem nova de ${review.name}`}
              onLoad={load('portrait')}
              onError={fail}
            />
            <span className="art-choice-token-label">Token novo</span>
            <img
              className="art-choice-token"
              src={`/api/character-art/${review.id}/proposed/token`}
              alt={`Token novo de ${review.name}`}
              onLoad={load('token')}
              onError={fail}
            />
          </figure>
        </div>
        {!ready && !error && <p role="status">Carregando as imagens para comparar…</p>}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <p className="muted small">
          Esta geração conta na cota mensal mesmo se você mantiver a imagem atual.
        </p>
        <div className="art-choice-actions">
          <button
            type="button"
            className="button outline"
            disabled={busy}
            onClick={() => void choose('kept')}
          >
            Manter imagem antiga
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy || !ready}
            onClick={() => void choose('accepted')}
          >
            {busy ? 'Salvando…' : 'Usar imagem nova'}
          </button>
        </div>
        <button type="button" className="button ghost" disabled={busy} onClick={close}>
          Decidir depois
        </button>
      </div>
    </Modal>
  );
}
