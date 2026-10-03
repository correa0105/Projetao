import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

// Add a route key here when an area receives its own soundtrack.
export const siteSoundtracks: Record<string, string> = {
  default: '/audio/medieval-travelers-journey.ogg',
  shop: '/audio/medieval-market.ogg',
};
const trackForPage = () => siteSoundtracks[location.hash.slice(1)] || siteSoundtracks.default;
const MusicContext = createContext({
  muted: false,
  volume: 0.4,
  toggle: () => {},
  setVolume: (_value: number) => {},
});
const preference = 'alvorada-music-muted';

export function SiteMusicProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const bell = useRef<HTMLAudioElement>(null);
  const bellPending = useRef(location.hash === '#shop');
  const [track, setTrack] = useState(trackForPage);
  const [volume, setVolume] = useState(() => {
    try {
      const saved = localStorage.getItem('alvorada-music-volume');
      const value = saved === null ? 0.4 : Number(saved);
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.4;
    } catch {
      return 0.4;
    }
  });
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(preference) === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const player = audio.current!;
    const doorBell = bell.current!;
    player.volume = volume;
    doorBell.volume = volume * 0.8;
    const playBell = () => {
      if (!bellPending.current || document.hidden) return;
      bellPending.current = false;
      doorBell.currentTime = 0;
      void doorBell.play().catch(() => {
        bellPending.current = location.hash === '#shop';
      });
    };
    const play = () => {
      playBell();
      if (player.paused && !document.hidden) void player.play().catch(() => {});
    };
    const visibility = () => {
      if (document.hidden) {
        player.pause();
        doorBell.pause();
      } else play();
    };
    const route = () => {
      setTrack(trackForPage());
      bellPending.current = location.hash === '#shop';
      if (bellPending.current) playBell();
      else doorBell.pause();
    };
    play();
    // Browsers requiring a gesture start on the first interaction.
    document.addEventListener('pointerdown', play);
    document.addEventListener('keydown', play);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('hashchange', route);
    return () => {
      player.pause();
      doorBell.pause();
      document.removeEventListener('pointerdown', play);
      document.removeEventListener('keydown', play);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('hashchange', route);
    };
  }, []);
  useEffect(() => {
    audio.current!.volume = volume;
    bell.current!.volume = volume * 0.8;
    try {
      localStorage.setItem('alvorada-music-volume', String(volume));
    } catch {}
  }, [volume]);
  useEffect(() => {
    audio.current!.muted = muted;
    bell.current!.muted = muted;
    try {
      localStorage.setItem(preference, String(muted));
    } catch {}
  }, [muted]);
  useEffect(() => {
    void audio.current!.play().catch(() => {});
  }, [track]);
  return (
    <MusicContext.Provider
      value={{
        muted,
        volume,
        setVolume: (value) => {
          setVolume(Math.max(0, Math.min(1, value)));
          if (value > 0) setMuted(false);
        },
        toggle: () => setMuted((value) => !value),
      }}
    >
      <audio
        ref={audio}
        src={track}
        loop
        preload="metadata"
        muted={muted}
        data-site-music
        aria-hidden="true"
      />
      <audio
        ref={bell}
        src="/audio/shop-door-bell.wav?v=door-close-2"
        preload="auto"
        muted={muted}
        data-shop-door-bell
        aria-hidden="true"
      />
      {children}
    </MusicContext.Provider>
  );
}

export function MusicToggle() {
  const { muted, toggle } = useContext(MusicContext);
  const label = muted ? 'Ativar música' : 'Mutar música';
  return (
    <button
      type="button"
      className="music-toggle"
      aria-label={label}
      title={label}
      aria-pressed={muted}
      onClick={toggle}
    >
      {muted ? <VolumeX size={12} aria-hidden="true" /> : <Volume2 size={12} aria-hidden="true" />}
    </button>
  );
}

export function MusicControls({ login = false }: { login?: boolean }) {
  const { volume, muted, setVolume } = useContext(MusicContext);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div
      ref={root}
      className={'music-controls' + (login ? ' entry-music' : '')}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setOpen(false);
          root.current?.querySelector<HTMLButtonElement>('.music-settings-trigger')?.focus();
        }
      }}
    >
      <button
        type="button"
        className="music-settings-trigger"
        aria-label="Ajustar volume da música"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
      </button>
      {open && (
        <div className="music-volume-panel">
          <output>{Math.round(volume * 100)}%</output>
          <span className="music-volume-limit">100%</span>
          <input
            aria-label="Volume da música"
            type="range"
            min="0"
            max="100"
            step="1"
            aria-orientation="vertical"
            value={Math.round(volume * 100)}
            onChange={(e) => setVolume(Number(e.target.value) / 100)}
          />
          <span className="music-volume-limit">0%</span>
          <MusicToggle />
        </div>
      )}
    </div>
  );
}
