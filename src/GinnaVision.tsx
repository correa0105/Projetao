import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { MusicControls, useMusicInterlude, useSoundEffects } from './SiteMusic';
import { GinnaBalloon } from './GinnaBalloon';
import { GinnaGroundEyes, type GinnaEye } from './GinnaGroundEyes';
import { ginnaFarewell } from './stable-ginna';
import { useGinnaHeartbeat } from './useGinnaHeartbeat';

// Coordinates share the background's cover plane.
// They remain planted in the same patch of soil when the viewport crops the scene.
const eyes: GinnaEye[] = [
  { x: 46.7, y: 24, width: 12.5, delay: 180, blink: 5.9, angle: 0, depth: 'mountain' },
  { x: 9, y: 58, width: 1.8, delay: 250, blink: 4.4, angle: -9, depth: 'ground' },
  { x: 27, y: 57, width: 2, delay: 460, blink: 3.1, angle: 4, depth: 'ground' },
  { x: 43, y: 56, width: 2.1, delay: 610, blink: 4.8, angle: -5, depth: 'ground' },
  { x: 78, y: 59, width: 2.2, delay: 370, blink: 3.8, angle: -6, depth: 'ground' },
  { x: 94, y: 60, width: 2.4, delay: 720, blink: 4.2, angle: 3, depth: 'ground' },
  { x: 6, y: 63, width: 2.7, delay: 840, blink: 3.6, angle: 7, depth: 'ground' },
  { x: 18, y: 65, width: 2.3, delay: 680, blink: 2.8, angle: -12, depth: 'ground' },
  { x: 35, y: 66, width: 2.4, delay: 450, blink: 4.1, angle: 10, depth: 'ground' },
  { x: 52, y: 64, width: 5.4, delay: 280, blink: 3.3, angle: -4, depth: 'ground' },
  { x: 86, y: 68, width: 4.4, delay: 920, blink: 3.4, angle: -8, depth: 'ground' },
  { x: 20, y: 76, width: 3.5, delay: 550, blink: 4.9, angle: -3, depth: 'ground' },
  { x: 27, y: 74, width: 2.8, delay: 960, blink: 3.2, angle: 12, depth: 'ground' },
  { x: 44, y: 77, width: 6, delay: 730, blink: 4.3, angle: -7, depth: 'ground' },
  { x: 79, y: 79, width: 4.4, delay: 1020, blink: 3.9, angle: -10, depth: 'ground' },
  { x: 95, y: 76, width: 3.9, delay: 800, blink: 4.7, angle: 5, depth: 'ground' },
  // Keep the foreground eyes in the bare path, clear of brush and fallen branches.
  { x: 32, y: 84, width: 7.2, delay: 1090, blink: 3.5, angle: -5, depth: 'ground' },
  { x: 47, y: 82, width: 3.8, delay: 870, blink: 4.5, angle: 7, depth: 'ground' },
  { x: 36, y: 88, width: 4.1, delay: 1200, blink: 3.8, angle: -11, depth: 'ground' },
  { x: 54, y: 85, width: 7, delay: 1000, blink: 4.1, angle: 3, depth: 'ground' },
  { x: 89, y: 88, width: 4.3, delay: 930, blink: 4.6, angle: 9, depth: 'ground' },
  { x: 53, y: 95, width: 8.2, delay: 1310, blink: 4.2, angle: 5, depth: 'ground' },
  { x: 85, y: 93, width: 6.8, delay: 1250, blink: 4.8, angle: 2, depth: 'ground' },
];

export function GinnaVision({
  known,
  entering = false,
  returning = false,
  onReady,
  onPresented,
  onFinished,
}: {
  known: boolean;
  entering?: boolean;
  returning?: boolean;
  onReady?: () => void;
  onPresented?: () => void;
  onFinished: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const music = useRef<HTMLAudioElement>(null);
  const [responding, setResponding] = useState(false);
  const [groundEyes3d, setGroundEyes3d] = useState(false);
  const { muted: musicMuted, volume: musicVolume, beginInterlude } = useMusicInterlude();
  const { muted, volume } = useSoundEffects();
  useGinnaHeartbeat(dialog, { muted, volume });

  useLayoutEffect(() => {
    const overlay = dialog.current!;
    overlay.showModal();
    // Keep the blink above this scene and the daytime HUD in the top layer.
    if (entering) onPresented?.();
    else {
      overlay
        .querySelector<HTMLButtonElement>('.stable-keeper-trigger')
        ?.focus({ preventScroll: true });
    }
    return () => overlay.close();
  }, [entering, onPresented]);

  useEffect(() => {
    if (!onReady) return;
    let cancelled = false;
    void Promise.all(
      [
        '/stable/paddock-ruined-eye-mountain-v2.webp',
        '/stable/ginna-shadow.webp',
        '/stable/ginna-raised-eyes.webp',
      ].map((source) => {
        const image = new Image();
        image.src = source;
        return image.decode().catch(() => {});
      }),
    ).then(() => {
      if (!cancelled) onReady();
    });
    return () => {
      cancelled = true;
    };
  }, [onReady]);

  useEffect(() => {
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
      music.current.volume = musicVolume * (returning ? 0.15 : 1);
      music.current.muted = musicMuted;
    }
  }, [musicMuted, musicVolume, returning]);

  return (
    <dialog
      ref={dialog}
      className="ginna-vision"
      data-entering={entering || undefined}
      data-returning={returning || undefined}
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
            <GinnaGroundEyes eyes={eyes} onReady={setGroundEyes3d} />
            {eyes.map((eye, index) => (
              <span
                key={index}
                className="ginna-earth-eye"
                data-depth={eye.depth}
                data-renderer={groundEyes3d ? 'webgl' : 'raster'}
                data-eye-x={eye.x}
                data-eye-y={eye.y}
                data-eye-width={eye.width}
                data-eye-relief={eye.depth === 'ground' ? 'raised' : 'rock-lids-and-convex-globe'}
                style={
                  {
                    left: eye.x + '%',
                    top: eye.y + '%',
                    visibility: groundEyes3d ? 'hidden' : undefined,
                    '--eye-width': eye.width + '%',
                    '--eye-delay': eye.delay + 'ms',
                    '--blink-duration': eye.blink + 's',
                    '--eye-angle': eye.angle + 'deg',
                    // Flatter silhouettes at the horizon; the summit faces the viewer.
                    '--eye-tilt':
                      (eye.depth === 'mountain' ? 8 : Math.max(42, 64 - (eye.y - 56) * 0.54)) +
                      'deg',
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
          text={returning ? ginnaFarewell : 'Pague para ver o que acontece…'}
          textEffect="heartbeat"
          dark
          label={responding ? 'Resposta à cuidadora' : undefined}
        >
          {responding && !returning && (
            <button type="button" onClick={onFinished}>
              Não vou machucá-los!
            </button>
          )}
        </GinnaBalloon>
      </div>
      <div className="ginna-vision-volume">
        <MusicControls />
      </div>
      <audio
        ref={music}
        src="/audio/ginna-lullaby-of-woe.mp3"
        preload="auto"
        loop
        muted={musicMuted}
        data-ginna-music
        aria-hidden="true"
      />
    </dialog>
  );
}
