import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { assetReady, preloadImages } from './asset-preloader';
import './asset-loading.css';

export function AssetLoading({
  title = 'Preparando a Alvorada',
  done = 0,
  total = 0,
  error = '',
  retry,
}: {
  title?: string;
  done?: number;
  total?: number;
  error?: string;
  retry?: () => void;
}) {
  return (
    <div
      className="asset-loading"
      data-asset-loading="true"
      role={error ? 'alert' : 'status'}
      aria-live="polite"
    >
      <div className="asset-loading__panel">
        <span className="asset-loading__brand">Alvorada Cinzenta</span>
        <h1>{title}</h1>
        <p>{error || 'Preparando os cenários e as imagens para você entrar.'}</p>
        {!error && (
          <>
            <progress max={Math.max(1, total)} value={done} aria-label="Imagens preparadas" />
            <span className="asset-loading__count">
              {total ? `${done} de ${total} imagens prontas` : 'Organizando a entrada…'}
            </span>
          </>
        )}
        {error && (
          <button className="button primary" onClick={retry}>
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
}
export function usePreparedAssets(paths: readonly string[]) {
  const key = JSON.stringify([...new Set(paths)]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({
    key: '',
    ready: false,
    done: 0,
    total: paths.length,
    error: '',
  });
  useEffect(() => {
    let alive = true;
    const list: string[] = JSON.parse(key);
    setState({
      key,
      ready: list.every(assetReady),
      done: list.filter(assetReady).length,
      total: list.length,
      error: '',
    });
    void preloadImages(list, (done, total) => {
      if (alive) setState({ key, ready: false, done, total, error: '' });
    })
      .then(() => {
        if (alive) setState({ key, ready: true, done: list.length, total: list.length, error: '' });
      })
      .catch(() => {
        if (alive)
          setState((old) => ({
            ...old,
            key,
            ready: false,
            error:
              'Não foi possível preparar todas as imagens. Confira sua conexão e tente novamente.',
          }));
      });
    return () => {
      alive = false;
    };
  }, [key, attempt]);
  return {
    ...state,
    ready: state.key === key && state.ready,
    retry: () => setAttempt((v) => v + 1),
  };
}
function imagePaths(root: HTMLElement) {
  const urls = new Set<string>();
  const images: HTMLImageElement[] = [];
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    if (element.closest('[hidden], dialog')) continue;
    if (element instanceof SVGImageElement && element.href.baseVal) urls.add(element.href.baseVal);
    const box = element.getBoundingClientRect();
    if (
      !box.width ||
      !box.height ||
      box.bottom < 0 ||
      box.right < 0 ||
      box.top > innerHeight ||
      box.left > innerWidth
    )
      continue;
    if (element instanceof HTMLImageElement && element.src) {
      // Hidden scenes do not trigger native lazy loading until they are shown.
      // Promote just the opening viewport; the rest of a catalogue stays lazy.
      element.loading = 'eager';
      urls.add(element.currentSrc || element.src);
      images.push(element);
    }
    for (const pseudo of [null, '::before', '::after']) {
      const style = getComputedStyle(element, pseudo);
      for (const property of [style.backgroundImage, style.borderImageSource, style.maskImage])
        for (const match of property.matchAll(/url\(["']?([^"')]+)["']?\)/g))
          if (!match[1].startsWith('data:')) {
            const url = new URL(match[1], location.href);
            if (
              url.hash &&
              url.origin === location.origin &&
              url.pathname === location.pathname &&
              url.search === location.search
            )
              continue;
            urls.add(match[1]);
          }
    }
  }
  return { urls: [...urls], images };
}
export function AssetGate({
  children,
  assets = [],
  title,
  busy = false,
}: {
  children: ReactNode;
  assets?: readonly string[];
  title: string;
  busy?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const prepared = usePreparedAssets(assets);
  const [visible, setVisible] = useState(false),
    [error, setError] = useState(''),
    [attempt, setAttempt] = useState(0);
  useLayoutEffect(() => {
    const node = root.current;
    if (!node) return;
    let alive = true,
      revision = 0,
      frame = 0;
    const check = () => {
      const current = ++revision;
      const found = imagePaths(node);
      const pending =
        found.urls.some((path) => !assetReady(path)) ||
        found.images.some((image) => !image.complete || !image.naturalWidth);
      if (pending || busy || !prepared.ready) setVisible(false);
      if (busy || !prepared.ready) return;
      void Promise.all([preloadImages(found.urls), ...found.images.map((image) => image.decode())])
        .then(() => {
          if (alive && revision === current)
            frame = requestAnimationFrame(() => {
              if (alive) setVisible(true);
            });
        })
        .catch(() => {
          if (alive && revision === current)
            setError('Uma imagem desta área não terminou de carregar. Tente novamente.');
        });
    };
    setError('');
    check();
    const urlsIn = (value: string | null) =>
      [...(value || '').matchAll(/url\([^)]+\)/g)].map((match) => match[0]).join('|');
    const observer = new MutationObserver((records) => {
      if (
        records.some(
          (record) =>
            record.type === 'childList' ||
            record.attributeName !== 'style' ||
            urlsIn(record.oldValue) !== urlsIn((record.target as Element).getAttribute('style')),
        )
      )
        check();
    });
    observer.observe(node, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true,
      attributeFilter: ['src', 'srcset', 'href', 'style'],
    });
    window.addEventListener('resize', check);
    return () => {
      alive = false;
      observer.disconnect();
      window.removeEventListener('resize', check);
      cancelAnimationFrame(frame);
    };
  }, [busy, prepared.ready, attempt]);
  const ready = prepared.ready && visible && !busy && !error;
  return (
    <>
      <div
        ref={root}
        className="asset-gate-content"
        data-assets-ready={ready}
        inert={!ready}
        style={{ visibility: ready ? 'visible' : 'hidden' }}
      >
        {children}
      </div>
      {!ready && (
        <AssetLoading
          title={title}
          done={prepared.done}
          total={prepared.total}
          error={prepared.error || error}
          retry={() => {
            for (const image of root.current?.querySelectorAll('img') || [])
              if (image.src && !image.naturalWidth) image.src = image.src;
            prepared.retry();
            setAttempt((v) => v + 1);
          }}
        />
      )}
    </>
  );
}
