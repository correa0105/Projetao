import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { MusicControls, useMusicInterlude } from './SiteMusic';
import { GinnaBalloon } from './GinnaBalloon';

// Coordinates share the background's cover plane, including the distant ridges.
// They remain planted in the same patch of soil when the viewport crops the scene.
const eyes = [
  { x: 46.7, y: 25, width: 16, delay: 180, blink: 5.9, angle: 0, depth: 'mountain' },
  // Exposed mountain faces above the forest and the bare cliff below the castle.
  { x: 34.8, y: 29.5, width: 1.7, delay: 820, blink: 4.3, angle: -12, depth: 'ridge' },
  { x: 58, y: 29.2, width: 1.9, delay: 410, blink: 3.7, angle: 8, depth: 'ridge' },
  { x: 64, y: 30.2, width: 1.5, delay: 780, blink: 5.1, angle: -7, depth: 'ridge' },
  { x: 60.8, y: 29.7, width: 1.6, delay: 480, blink: 3.2, angle: 5, depth: 'ridge' },
  { x: 79.6, y: 36.5, width: 2, delay: 670, blink: 4.7, angle: -15, depth: 'ridge' },
  { x: 85.2, y: 39.4, width: 2.1, delay: 390, blink: 3.9, angle: 6, depth: 'ridge' },
  { x: 9, y: 58, width: 1.8, delay: 250, blink: 4.4, angle: -9, depth: 'ground' },
  { x: 27, y: 57, width: 2, delay: 460, blink: 3.1, angle: 4, depth: 'ground' },
  { x: 43, y: 56, width: 2.1, delay: 610, blink: 4.8, angle: -5, depth: 'ground' },
  { x: 62, y: 57, width: 1.8, delay: 530, blink: 2.9, angle: 9, depth: 'ground' },
  { x: 78, y: 59, width: 2.2, delay: 370, blink: 3.8, angle: -6, depth: 'ground' },
  { x: 94, y: 60, width: 2.4, delay: 720, blink: 4.2, angle: 3, depth: 'ground' },
  { x: 6, y: 63, width: 2.7, delay: 840, blink: 3.6, angle: 7, depth: 'ground' },
  { x: 18, y: 65, width: 2.8, delay: 680, blink: 2.8, angle: -12, depth: 'ground' },
  { x: 35, y: 66, width: 3.1, delay: 450, blink: 4.1, angle: 10, depth: 'ground' },
  { x: 52, y: 64, width: 2.9, delay: 280, blink: 3.3, angle: -4, depth: 'ground' },
  { x: 69, y: 67, width: 3.2, delay: 580, blink: 4.6, angle: 6, depth: 'ground' },
  { x: 86, y: 68, width: 3.3, delay: 920, blink: 3.4, angle: -8, depth: 'ground' },
  { x: 20, y: 76, width: 3.9, delay: 550, blink: 4.9, angle: -3, depth: 'ground' },
  { x: 27, y: 74, width: 3.5, delay: 960, blink: 3.2, angle: 12, depth: 'ground' },
  { x: 44, y: 77, width: 4.2, delay: 730, blink: 4.3, angle: -7, depth: 'ground' },
  { x: 60, y: 75, width: 3.8, delay: 640, blink: 2.7, angle: 4, depth: 'ground' },
  { x: 79, y: 79, width: 4.4, delay: 1020, blink: 3.9, angle: -10, depth: 'ground' },
  { x: 95, y: 76, width: 3.9, delay: 800, blink: 4.7, angle: 5, depth: 'ground' },
  // Keep the foreground eyes in the bare path, clear of brush and fallen branches.
  { x: 32, y: 84, width: 4.9, delay: 1090, blink: 3.5, angle: -5, depth: 'ground' },
  { x: 47, y: 82, width: 5.2, delay: 870, blink: 4.5, angle: 7, depth: 'ground' },
  { x: 36, y: 88, width: 5.6, delay: 1200, blink: 3.8, angle: -11, depth: 'ground' },
  { x: 54, y: 85, width: 5, delay: 1000, blink: 4.1, angle: 3, depth: 'ground' },
  { x: 71, y: 89, width: 5.7, delay: 1110, blink: 3.1, angle: -4, depth: 'ground' },
  { x: 89, y: 88, width: 5.3, delay: 930, blink: 4.6, angle: 9, depth: 'ground' },
  { x: 53, y: 95, width: 6.1, delay: 1310, blink: 4.2, angle: 5, depth: 'ground' },
  { x: 69, y: 97, width: 6.2, delay: 1160, blink: 3.7, angle: -7, depth: 'ground' },
  { x: 85, y: 93, width: 5.9, delay: 1250, blink: 4.8, angle: 2, depth: 'ground' },
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
        <div className="ginna-vision-landscape" aria-hidden="true">
          <div className="ginna-vision-ruins" />
          <div className="ginna-vision-eyes">
            {eyes.map((eye, index) => (
              <span
                key={index}
                className="ginna-earth-eye"
                data-depth={eye.depth}
                style={
                  {
                    left: eye.x + '%',
                    top: eye.y + '%',
                    '--eye-width': eye.width + '%',
                    '--eye-delay': eye.delay + 'ms',
                    '--blink-duration': eye.blink + 's',
                    '--eye-angle': eye.angle + 'deg',
                    // Flatter silhouettes at the horizon; steeper rocky faces are upright.
                    '--eye-tilt':
                      (eye.depth === 'mountain'
                        ? 8
                        : eye.depth === 'ridge'
                          ? 32
                          : Math.max(42, 64 - (eye.y - 56) * 0.54)) + 'deg',
                  } as CSSProperties
                }
              >
                <span className="ginna-eye-mound">
                  <span className="ginna-eye-blink" />
                </span>
              </span>
            ))}
          </div>
        </div>
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
