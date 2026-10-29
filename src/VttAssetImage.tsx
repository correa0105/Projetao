import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';
import { vttLibraryPreview } from '../shared/vtt-library-preview';
import { vttDisplaySource } from '../shared/vtt-display-source';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src: string;
  fallback?: string;
  thumbnail?: boolean;
};

/** A transient asset failure must not leave a library card permanently broken. */
export function VttAssetImage({ src, fallback, thumbnail = false, ...props }: Props) {
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(!thumbnail);
  const ref = useRef<HTMLImageElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!thumbnail || typeof IntersectionObserver === 'undefined') { setVisible(true); return; }
    const image = ref.current;
    if (!image) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
    }, {root: image.closest('.vtt-panel-content'), rootMargin: '320px 0px'});
    observer.observe(image);
    return () => observer.disconnect();
  }, [thumbnail, src]);
  useEffect(() => {
    setAttempt(0);
    return () => window.clearTimeout(timer.current);
  }, [src]);
  const retrySource = fallback || src;
  const source = attempt
    ? retrySource + (retrySource.includes('?') ? '&' : '?') + 'image_retry=' + attempt
    : thumbnail ? vttLibraryPreview(src) : vttDisplaySource(src);
  return (
    <img
      {...props}
      ref={ref}
      decoding={props.decoding || 'async'}
      fetchPriority={props.fetchPriority || (thumbnail ? 'high' : 'auto')}
      data-vtt-thumbnail={thumbnail || undefined}
      data-asset-deferred={thumbnail || undefined}
      src={visible && source ? source : undefined}
      onError={() => {
        if (attempt >= 3) return;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setAttempt((v) => v + 1), 400 * 2 ** attempt);
      }}
    />
  );
}
