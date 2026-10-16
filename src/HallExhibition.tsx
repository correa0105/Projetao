import { useEffect, useRef, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/** The three plinths and their exhibits share the painting's coordinate system. */
export function HallExhibition({ children }: { children: ReactNode }) {
  const viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const center = () => {
      if (node.clientWidth) node.scrollLeft = (node.scrollWidth - node.clientWidth) / 2;
    };
    const resize = new ResizeObserver(center);
    resize.observe(node);
    center();
    return () => resize.disconnect();
  }, []);
  function move(direction: number) {
    const node = viewport.current;
    if (!node) return;
    const box = node.getBoundingClientRect();
    const points = [...node.querySelectorAll<HTMLElement>('.hall-champion')]
      .map((card) => {
        const r = card.getBoundingClientRect();
        return r.left - box.left + node.scrollLeft + r.width / 2 - node.clientWidth / 2;
      })
      .sort((a, b) => a - b);
    const nearest = points.reduce(
      (best, point, i) =>
        Math.abs(point - node.scrollLeft) < Math.abs(points[best] - node.scrollLeft) ? i : best,
      0,
    );
    const next = Math.max(0, Math.min(points.length - 1, nearest + direction));
    node.scrollTo({
      left: points[next],
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    });
  }
  return (
    <div className="hall-exhibition">
      <div
        className="hall-exhibition-viewport"
        ref={viewport}
        aria-label="Exposições dos destaques"
      >
        <div className="hall-exhibition-scene">{children}</div>
      </div>
      <nav className="hall-exhibition-controls" aria-label="Navegar pelas exposições">
        <button onClick={() => move(-1)} aria-label="Exposição anterior">
          <ChevronLeft size={20} />
        </button>
        <span>Deslize para explorar</span>
        <button onClick={() => move(1)} aria-label="Próxima exposição">
          <ChevronRight size={20} />
        </button>
      </nav>
    </div>
  );
}
