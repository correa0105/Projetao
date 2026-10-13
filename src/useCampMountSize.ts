import { useLayoutEffect, type RefObject } from 'react';
import { alignCampPetArt } from './camp-pet-art';

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
        ...figures.map(
          (figure) => Math.min(figure.clientHeight, figure.clientWidth * 1.5) * 0.8,
        ),
      );
      if (Number.isFinite(reference) && reference > 0)
        element.style.setProperty('--mount-reference-height', reference + 'px');
      {
        const floor = Math.max(
          ...figures.map((figure) => figure.getBoundingClientRect().bottom),
        );
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
    const figures = [
      ...stage.querySelectorAll<HTMLElement>('.camp-figure,.public-character-figure'),
    ];
    const align = () => {
      alignCampPetArt(element);
      const small = innerWidth <= 600;
      const referenceWidth = Math.min(
        218 * (small ? 0.65 : 1),
        innerWidth * (small ? 0.31 : 0.24),
      );
      const inset = small
        ? 36
        : camp.clientWidth * 0.03 + Math.max(48, Math.min(96, innerWidth * 0.05));
      // Every species shares the dog's ground position, regardless of its size.
      element.style.right = inset + referenceWidth / 2 - element.offsetWidth / 2 + 'px';
      const floor = Math.max(
        ...figures.map((figure) => figure.getBoundingClientRect().bottom),
      );
      if (Number.isFinite(floor))
        element.style.top = floor - camp.getBoundingClientRect().top - 15 + 'px';
    };
    const observer = new ResizeObserver(align);
    [camp, stage, element, ...figures].forEach((node) => observer.observe(node));
    element.addEventListener('load', align, true);
    const mutation = new MutationObserver(align);
    mutation.observe(element, { childList: true, subtree: true });
    align();
    return () => {
      observer.disconnect();
      mutation.disconnect();
      element.removeEventListener('load', align, true);
    };
  }, [host, petId, panel]);
}
