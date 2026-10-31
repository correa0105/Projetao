import { useEffect, useState, type CSSProperties } from 'react';

// Source-art coordinates keep every light attached to its lantern after cover/cropping.
const pools = [
  [70, 57, 13, 28, 0],
  [62, 62, 19, 38, 0.5],
  [68, 43, 17, 35, 1],
  [39, 52, 26, 52, 1.5],
  [11, 36, 25, 65, 2.05],
  [58, 17, 23, 45, 2.6],
];
export function AtriumRelighting({
  background,
  x,
  y,
  tinted,
}: {
  background: string;
  x: number;
  y: number;
  tinted: boolean;
}) {
  const [viewport, setViewport] = useState(() => [innerWidth, innerHeight]);
  const [artSize, setArtSize] = useState([1672, 941]);
  useEffect(() => {
    let live = true;
    const image = new Image();
    image.src = background;
    void image
      .decode()
      .then(() => {
        if (live) setArtSize([image.naturalWidth, image.naturalHeight]);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [background]);
  useEffect(() => {
    const resize = () => setViewport([innerWidth, innerHeight]);
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);
  const scale = Math.max(viewport[0] / artSize[0], viewport[1] / artSize[1]);
  const width = artSize[0] * scale,
    height = artSize[1] * scale;
  const image = {
    backgroundImage: `linear-gradient(180deg,#06080c25,#06080c10 55%,#06080c65),${tinted ? 'linear-gradient(#79090066,#79090066),' : ''}url('${background}')`,
  };
  return (
    <div className="events-intimidation-scene" aria-hidden="true">
      <div
        className="events-relight-art"
        style={{
          width,
          height,
          left: ((viewport[0] - width) * x) / 100,
          top: ((viewport[1] - height) * y) / 100,
        }}
      >
        {pools.map(([cx, cy, rx, ry, delay], index) => (
          <div
            key={index}
            className="events-light-pool"
            data-light={index}
            style={
              {
                ...image,
                maskImage: `radial-gradient(ellipse ${rx}% ${ry}% at ${cx}% ${cy}%,#000 12%,#0009 48%,transparent 100%)`,
                '--light-delay': `${delay}s`,
              } as CSSProperties
            }
          />
        ))}
        <div className="events-relight-base" style={image} />
      </div>
    </div>
  );
}
