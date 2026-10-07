import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import type { HouseDistortion } from '../shared/house';
import { houseDistortionMatrix } from '../shared/house-distortion';

/** Warp art and its contact shadow together without changing the drag anchor. */
export function HouseWarp({
  distortion,
  children,
}: {
  distortion?: HouseDistortion;
  children: ReactNode;
}) {
  const element = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = element.current!;
    const measure = () => setSize({ width: el.clientWidth, height: el.clientHeight });
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    measure();
    return () => observer.disconnect();
  }, []);
  return (
    <span
      ref={element}
      className="house-warp"
      style={{ transform: houseDistortionMatrix(distortion, size.width, size.height) }}
    >
      {children}
    </span>
  );
}
