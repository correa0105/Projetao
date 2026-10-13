import { useLayoutEffect, useRef } from 'react';
import type { GuildPerspective } from '../shared/guild-perspective';
import { alignGuildFurnitureImage } from './guild-furniture-geometry';
export function GuildFurnitureArt({
  source,
  perspective,
  onReady,
}: {
  source: string;
  perspective?: GuildPerspective;
  onReady: () => void;
}) {
  const image = useRef<HTMLImageElement>(null),
    ready = useRef(onReady);
  ready.current = onReady;
  useLayoutEffect(() => {
    const el = image.current!;
    const update = () => {
      if (el.complete && el.naturalWidth) {
        alignGuildFurnitureImage(el, perspective);
        ready.current();
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => observer.disconnect();
  }, [source, perspective]);
  return (
    <img
      ref={image}
      src={source}
      alt=""
      draggable={false}
      onLoad={(e) => {
        alignGuildFurnitureImage(e.currentTarget, perspective);
        ready.current();
      }}
    />
  );
}
