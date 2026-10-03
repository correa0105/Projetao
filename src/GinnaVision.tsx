import { useEffect, useRef, type CSSProperties } from 'react';
import { useMusicInterlude } from './SiteMusic';
import { GINNA_VISION_MS } from './stable-ginna';

const eyes = [
  { x: 7, y: 8, width: 20, delay: 180, blink: 2.3, angle: -8 },
  { x: 28, y: 22, width: 15, delay: 420, blink: 3.1, angle: 5 },
  { x: 44, y: 3, width: 24, delay: 260, blink: 2.7, angle: -4 },
  { x: 62, y: 20, width: 13, delay: 610, blink: 1.9, angle: 8 },
  { x: 79, y: 7, width: 19, delay: 350, blink: 3.4, angle: 2 },
];

export function GinnaVision({ onFinished }: { onFinished: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const music = useRef<HTMLAudioElement>(null);
  const finished = useRef(onFinished);
  const { muted, volume, beginInterlude } = useMusicInterlude();
  finished.current = onFinished;

  useEffect(() => {
    dialog.current?.showModal();
    const player = music.current;
    const resume = beginInterlude();
    const timer = window.setTimeout(() => finished.current(), GINNA_VISION_MS);
    const visibility = () => {
      if (document.hidden) finished.current();
    };
    document.addEventListener('visibilitychange', visibility);
    void player?.play().catch(() => {});
    return () => {
      window.clearTimeout(timer);
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
      aria-labelledby="ginna-vision-title"
      onCancel={(event) => {
        event.preventDefault();
        finished.current();
      }}
    >
      <div className="ginna-vision-ruins" aria-hidden="true" />
      <div className="ginna-vision-fog" aria-hidden="true" />
      <img
        className="ginna-vision-figure"
        src="/stable/ginna-shadow.webp"
        alt="Ginna envolta em fumaça escura, sem chapéu, com olhos brancos"
      />
      <div className="ginna-vision-eyes" aria-hidden="true">
        {eyes.map((eye, index) => (
          <span
            key={index}
            className="ginna-earth-eye"
            style={
              {
                left: eye.x + '%',
                bottom: eye.y + '%',
                width: eye.width + '%',
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
      <p className="ginna-vision-line" id="ginna-vision-title">
        <span>Ginna</span>Pague para ver o que acontece…
      </p>
      <button className="ginna-vision-return" type="button" onClick={() => finished.current()}>
        Voltar ao estábulo
      </button>
      <div className="ginna-vision-shutter" aria-hidden="true" />
      <audio
        ref={music}
        src="/audio/ginna-lullaby-of-woe.mp3"
        preload="auto"
        muted={muted}
        data-ginna-music
        aria-hidden="true"
      />
    </dialog>
  );
}
