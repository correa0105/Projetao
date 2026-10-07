import { useLayoutEffect, type RefObject } from 'react';

// One visual metre for both people and mounts, measured from the figure slots.
// The reference human cutout has a 2:3 canvas; species keep their own scale.
export function useCampMountSize(
  host: RefObject<HTMLElement | null>,
  mountId?: string,
  panel?: string,
) {
  useLayoutEffect(() => {
    const element = host.current;
    const camp = element?.closest<HTMLElement>('.character-camp,.public-camp');
    const stage = camp?.querySelector<HTMLElement>('.camp-stage,.public-camp-stage');
    if (!element || !camp || !stage) return;
    const figures = [
      ...stage.querySelectorAll<HTMLElement>('.camp-figure,.public-character-figure'),
    ];
    const align = () => {
      const reference = Math.max(
        ...figures.map((figure) => Math.min(figure.clientHeight, figure.clientWidth * 1.5) * 0.8),
      );
      if (Number.isFinite(reference) && reference > 0)
        element.style.setProperty('--mount-reference-height', reference + 'px');
      {
        const floor = Math.max(...figures.map((figure) => figure.getBoundingClientRect().bottom));
        if (Number.isFinite(floor))
          element.style.top = floor - camp.getBoundingClientRect().top + 12 + 'px';
      }
    };
    const observer = new ResizeObserver(align);
    [camp, stage, ...figures].forEach((node) => observer.observe(node));
    align();
    return () => observer.disconnect();
  }, [host, mountId, panel]);
}

export function useCampPetPosition(
  host: RefObject<HTMLElement | null>,
  petId?: string,
  panel?: string,
) {
  useLayoutEffect(() => {
    const element = host.current;
    const camp = element?.closest<HTMLElement>('.character-camp,.public-camp');
    const stage = camp?.querySelector<HTMLElement>('.camp-stage,.public-camp-stage');
    if (!element || !camp || !stage) return;
    const figures = [...stage.querySelectorAll<HTMLElement>('.camp-figure')];
    const align = () => {
      const floor = Math.max(...figures.map((figure) => figure.getBoundingClientRect().bottom));
      if (Number.isFinite(floor))
        element.style.top = floor - camp.getBoundingClientRect().top - 15 + 'px';
    };
    const observer = new ResizeObserver(align);
    [camp, stage, ...figures].forEach((node) => observer.observe(node));
    align();
    return () => observer.disconnect();
  }, [host, petId, panel]);
}
