import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MusicControls, useMusicInterlude } from './SiteMusic';
import { GinnaBalloon } from './GinnaBalloon';

// Small eyes at different depths across the soil, away from the camera edge.
const eyes = [
  { x: 11, y: 62, width: 2.4, delay: 180, blink: 2.3, angle: -8 },
  { x: 29, y: 60, width: 2, delay: 420, blink: 3.1, angle: 5 },
  { x: 47, y: 65, width: 3.2, delay: 260, blink: 2.7, angle: -4 },
  { x: 76, y: 62, width: 2.2, delay: 610, blink: 1.9, angle: 8 },
  { x: 87, y: 72, width: 3.8, delay: 350, blink: 3.4, angle: 2 },
  { x: 18, y: 72, width: 4.3, delay: 730, blink: 2.8, angle: -12 },
  { x: 36, y: 80, width: 5.4, delay: 550, blink: 3.7, angle: 10 },
  { x: 59, y: 76, width: 4.6, delay: 800, blink: 2.5, angle: -6 },
  { x: 72, y: 84, width: 6.2, delay: 950, blink: 3.3, angle: 7 },
  { x: 10, y: 85, width: 6.8, delay: 680, blink: 2.9, angle: -3 },
  { x: 48, y: 87, width: 7.2, delay: 1100, blink: 4.1, angle: 4 },
];

export function GinnaVision({ known, onFinished }: { known: boolean; onFinished: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const music = useRef<HTMLAudioElement>(null);
  const [responding, setResponding] = useState(false);
  const { muted, volume, beginInterlude } = useMusicInterlude();

  useEffect(() => {
    dialog.current?.showModal();
    const player = music.current;
    const resume = beginInterlude();
    const visibility = () => {
      if (document.hidden) player?.pause();
      else void player?.play().catch(() => {});
    };
    document.addEventListener('visibilitychange', visibility);
    visibility();
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      player?.pause();
      resume();
    };
  }, [beginInterlude]);

  useEffect(() => {
    if (music.current) {
      music.current.volume = volume;
      music.current.muted = muted;
    }
  }, [muted, volume]);

  return (
    <dialog
      ref={dialog}
      className="ginna-vision"
      aria-label="Visão sombria do estábulo"
      onCancel={(event) => {
        event.preventDefault();
        setResponding(true);
      }}
    >
      <div className="ginna-nightmare-scene">
        <div className="ginna-vision-ruins" aria-hidden="true" />
        <div className="ginna-vision-fog" aria-hidden="true" />
        <div className="ginna-vision-keeper">
          <button
            className="stable-keeper-trigger"
            type="button"
            aria-label="Conversar com a cuidadora na visão"
            aria-expanded={responding}
            onClick={() => setResponding(true)}
          >
            <img
              className="ginna-vision-figure"
              src="/stable/ginna-shadow.webp"
              alt="Cuidadora envolta em fumaça escura, sem chapéu, com olhos brancos"
            />
          </button>
        </div>
        <div className="ginna-vision-eyes" aria-hidden="true">
          {eyes.map((eye, index) => (
            <span
              key={index}
              className="ginna-earth-eye"
              style={
                {
                  left: eye.x + '%',
                  top: eye.y + '%',
                  '--eye-width': eye.width + '%',
                  '--eye-delay': eye.delay + 'ms',
                  '--blink-duration': eye.blink + 's',
                  '--eye-angle': eye.angle + 'deg',
                } as CSSProperties
              }
            >
              <span className="ginna-eye-blink" />
            </span>
          ))}
        </div>
        <GinnaBalloon
          speaker={known ? 'Ginna' : 'Cuidadora'}
          text="Pague para ver o que acontece…"
          dark
          label={responding ? 'Resposta à cuidadora' : undefined}
        >
          {responding && (
            <button type="button" onClick={onFinished}>
              Não vou machucá-los!
            </button>
          )}
        </GinnaBalloon>
      </div>
      <div className="ginna-vision-volume">
        <MusicControls />
      </div>
      <div className="ginna-vision-shutter" aria-hidden="true" />
      <audio
        ref={music}
        src="/audio/ginna-lullaby-of-woe.mp3"
        preload="auto"
        loop
        muted={muted}
        data-ginna-music
        aria-hidden="true"
      />
    </dialog>
  );
}
