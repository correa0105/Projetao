import { useEffect, useState, type ReactNode } from 'react';
import './item-thumbnail.css';

export function ItemThumbnail({
  image,
  name,
  fallback = null,
}: {
  image?: string | null;
  name: string;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  return image && !failed ? (
    <img
      className="item-thumbnail"
      src={image}
      alt=""
      title={name}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  ) : (
    <>{fallback}</>
  );
}
