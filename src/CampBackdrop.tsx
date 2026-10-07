import { useLayoutEffect, useRef, type CSSProperties } from 'react';

// Both camps use the painted fire as the same ground reference, rather than
// fitting the public scene to the much taller profile page.
export function CampBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const effect = ref.current!;
    const camp = effect.closest<HTMLElement>('.character-camp,.public-camp');
    const surface = camp?.matches('.public-camp')
      ? camp
      : camp?.closest<HTMLElement>('.main-shell');
    const stage = camp?.querySelector<HTMLElement>('.camp-stage,.public-camp-stage');
    if (!camp || !surface || !stage) return;
    function align() {
      const bounds = surface!.getBoundingClientRect();
      const campBounds = camp!.getBoundingClientRect();
      const figures = [...stage!.querySelectorAll('.camp-figure')];
      const floor = figures.length
        ? Math.max(...figures.map((figure) => figure.getBoundingClientRect().bottom)) - bounds.top
        : stage!.getBoundingClientRect().bottom - bounds.top - 130;
      const scale = Math.max(
        bounds.width / 1672,
        floor / (941 * 0.66),
        (bounds.height - floor) / (941 * 0.34),
      );
      const imageHeight = 941 * scale;
      surface!.style.setProperty('--camp-background-size', `${1672 * scale}px ${imageHeight}px`);
      surface!.style.setProperty('--camp-background-y', `${floor - imageHeight * 0.66}px`);
      effect.style.left = `${bounds.left + bounds.width / 2 - campBounds.left}px`;
      effect.style.top = `${bounds.top + floor - imageHeight * 0.035 - campBounds.top}px`;
    }
    const observer = new ResizeObserver(align);
    observer.observe(surface);
    observer.observe(stage);
    stage
      .querySelectorAll('.camp-character,.camp-figure')
      .forEach((node) => observer.observe(node));
    align();
    return () => {
      observer.disconnect();
      surface.style.removeProperty('--camp-background-size');
      surface.style.removeProperty('--camp-background-y');
    };
  });
  return (
    <div className="camp-embers" ref={ref} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => (
        <i
          key={i}
          style={
            {
              '--drift': `${((i * 37) % 87) - 43}px`,
              '--start': `${((i * 13) % 39) - 19}px`,
              '--rise': `${65 + ((i * 19) % 100)}px`,
              '--duration': `${2.8 + (i % 5) * 0.5}s`,
              '--delay': `${-i * 0.63}s`,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
