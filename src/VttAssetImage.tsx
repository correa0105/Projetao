import { useEffect, useRef, useState, type ImgHTMLAttributes } from 'react';

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'onError'> & {
  src: string;
  fallback?: string;
};

/** A transient asset failure must not leave a library card permanently broken. */
export function VttAssetImage({ src, fallback, ...props }: Props) {
  const [attempt, setAttempt] = useState(0);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    setAttempt(0);
    return () => window.clearTimeout(timer.current);
  }, [src]);
  const retrySource = fallback || src;
  const source = attempt
    ? retrySource + (retrySource.includes('?') ? '&' : '?') + 'image_retry=' + attempt
    : src;
  return (
    <img
      decoding="async"
      {...props}
      src={source}
      onError={() => {
        if (attempt >= 3) return;
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setAttempt((v) => v + 1), 400 * 2 ** attempt);
      }}
    />
  );
}
