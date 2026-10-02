import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Volume2, VolumeX } from 'lucide-react';

// Add a route key here when an area receives its own soundtrack.
export const siteSoundtracks: Record<string, string> = {
  default: '/audio/medieval-travelers-journey.ogg',
};
const trackForPage = () => siteSoundtracks[location.hash.slice(1)] || siteSoundtracks.default;
const MusicContext = createContext({ muted: false, toggle: () => {} });
const preference = 'alvorada-music-muted';

export function SiteMusicProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [track, setTrack] = useState(trackForPage);
  const [muted, setMuted] = useState(() => {
    try {
      return localStorage.getItem(preference) === 'true';
    } catch {
      return false;
    }
  });
  useEffect(() => {
    const player = audio.current!;
    player.volume = 0.4;
    const play = () => {
      if (player.paused && !document.hidden) void player.play().catch(() => {});
    };
    const visibility = () => (document.hidden ? player.pause() : play());
    const route = () => setTrack(trackForPage());
    play();
    // Browsers requiring a gesture start on the first interaction.
    document.addEventListener('pointerdown', play);
    document.addEventListener('keydown', play);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('hashchange', route);
    return () => {
      player.pause();
      document.removeEventListener('pointerdown', play);
      document.removeEventListener('keydown', play);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('hashchange', route);
    };
  }, []);
  useEffect(() => {
    audio.current!.muted = muted;
    try {
      localStorage.setItem(preference, String(muted));
    } catch {}
  }, [muted]);
  useEffect(() => {
    void audio.current!.play().catch(() => {});
  }, [track]);
  return (
    <MusicContext.Provider value={{ muted, toggle: () => setMuted((value) => !value) }}>
      <audio
        ref={audio}
        src={track}
        loop
        preload="metadata"
        muted={muted}
        data-site-music
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
