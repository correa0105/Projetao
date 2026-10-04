import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
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
  playScroll: () => {},
  beginInterlude: (): (() => void) => () => {},
});
const preference = 'alvorada-music-muted';
type SoundChannel = {
  muted: boolean;
  volume: number;
  toggle: () => void;
  setVolume: (value: number) => void;
};
const EffectsContext = createContext<SoundChannel>({
  muted: false,
  volume: 0.4,
  toggle: () => {},
  setVolume: () => {},
});

export function useSoundEffects() {
  return useContext(EffectsContext);
}

export function useLoreScrollSound() {
  return useContext(MusicContext).playScroll;
}

export function useMusicInterlude() {
  return useContext(MusicContext);
}

export function SiteMusicProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const bell = useRef<HTMLAudioElement>(null);
  const scroll = useRef<HTMLAudioElement>(null);
  const interlude = useRef<symbol | null>(null);
  const beginInterlude = useCallback(() => {
    const token = Symbol('music-interlude');
    interlude.current = token;
    audio.current?.pause();
    bell.current?.pause();
    scroll.current?.pause();
    return () => {
      if (interlude.current !== token) return;
      interlude.current = null;
      if (!document.hidden) void audio.current?.play().catch(() => {});
    };
  }, []);
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
  // Existing preferences applied to all audio before the channels were separated.
  const [effectsVolume, setEffectsVolume] = useState(() => {
    try {
      const saved = localStorage.getItem('alvorada-effects-volume');
      const value = saved === null ? volume : Number(saved);
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : volume;
    } catch {
      return volume;
    }
  });
  const [effectsMuted, setEffectsMuted] = useState(() => {
    try {
      const saved = localStorage.getItem('alvorada-effects-muted');
      return saved === null ? muted : saved === 'true';
    } catch {
      return muted;
    }
  });
  const effects = useRef({ muted: effectsMuted, volume: effectsVolume });
  effects.current = { muted: effectsMuted, volume: effectsVolume };
  useEffect(() => {
    const player = audio.current!;
    const doorBell = bell.current!;
    let currentRoute = location.hash;
    player.volume = volume;
    doorBell.volume = Math.min(1, effectsVolume * 1.25);
    const playBell = () => {
      if (!bellPending.current || document.hidden) return;
      bellPending.current = false;
      if (effects.current.muted || effects.current.volume === 0) return;
      doorBell.currentTime = 0;
      void doorBell.play().catch(() => {
        bellPending.current = location.hash === '#shop';
      });
    };
    const play = () => {
      if (interlude.current) return;
      playBell();
      if (player.paused && !document.hidden) void player.play().catch(() => {});
    };
    const visibility = () => {
      if (document.hidden) {
        player.pause();
        doorBell.pause();
        scroll.current?.pause();
      } else play();
    };
    const route = () => {
      if (currentRoute === location.hash) return;
      currentRoute = location.hash;
      if (currentRoute !== '#lore') scroll.current?.pause();
      const nextTrack = trackForPage();
      // Set and play synchronously; waiting for a React effect can lose activation.
      if (player.getAttribute('src') !== nextTrack) player.src = nextTrack;
      setTrack(nextTrack);
      bellPending.current = location.hash === '#shop';
      if (!bellPending.current) doorBell.pause();
      play();
    };
    play();
    // Browsers requiring a gesture start on the first interaction.
    document.addEventListener('pointerdown', play);
    document.addEventListener('keydown', play);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('hashchange', route);
    window.addEventListener('alvorada:navigate', route);
    return () => {
      player.pause();
      doorBell.pause();
      scroll.current?.pause();
      document.removeEventListener('pointerdown', play);
      document.removeEventListener('keydown', play);
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('hashchange', route);
      window.removeEventListener('alvorada:navigate', route);
    };
  }, []);
  useEffect(() => {
    audio.current!.volume = volume;
    try {
      localStorage.setItem('alvorada-music-volume', String(volume));
    } catch {}
  }, [volume]);
  useEffect(() => {
    audio.current!.muted = muted;
    try {
      localStorage.setItem(preference, String(muted));
    } catch {}
  }, [muted]);
  useEffect(() => {
    bell.current!.volume = Math.min(1, effectsVolume * 1.25);
    scroll.current!.volume = Math.min(1, effectsVolume * 1.45);
    bell.current!.muted = effectsMuted;
    scroll.current!.muted = effectsMuted;
    if (effectsMuted || effectsVolume === 0) {
      bell.current!.pause();
      scroll.current!.pause();
    }
    try {
      localStorage.setItem('alvorada-effects-volume', String(effectsVolume));
      localStorage.setItem('alvorada-effects-muted', String(effectsMuted));
    } catch {}
  }, [effectsVolume, effectsMuted]);
  useEffect(() => {
    if (!interlude.current) void audio.current!.play().catch(() => {});
  }, [track]);
  return (
    <MusicContext.Provider
      value={{
        muted,
        volume,
        beginInterlude,
        setVolume: (value) => {
          if (!Number.isFinite(value)) return;
          setVolume(Math.max(0, Math.min(1, value)));
          if (value > 0) setMuted(false);
        },
        toggle: () => setMuted((value) => !value),
        playScroll: () => {
          const sound = scroll.current;
          if (!sound || effectsMuted || effectsVolume === 0 || document.hidden) return;
          sound.currentTime = 0;
          void sound.play().catch(() => {});
        },
      }}
    >
      <EffectsContext.Provider
        value={{
          muted: effectsMuted,
          volume: effectsVolume,
          toggle: () => setEffectsMuted((value) => !value),
          setVolume: (value) => {
            if (!Number.isFinite(value)) return;
            setEffectsVolume(Math.max(0, Math.min(1, value)));
            if (value > 0) setEffectsMuted(false);
          },
        }}
      >
        <audio
          ref={audio}
          src={track}
          loop
          preload="auto"
          muted={muted}
          data-site-music
          aria-hidden="true"
        />
        <audio
          ref={bell}
          src="/audio/shop-door-bell.wav?v=old-shop-door-5"
          preload="auto"
          muted={effectsMuted}
          data-shop-door-bell
          aria-hidden="true"
        />
        {children}
        <audio
          ref={scroll}
          src="/audio/lore-scroll-open.wav"
          preload="auto"
          muted={effectsMuted}
          data-lore-scroll-sound
          aria-hidden="true"
        />
      </EffectsContext.Provider>
    </MusicContext.Provider>
  );
}

export function MusicToggle() {
  const { muted, toggle } = useContext(MusicContext);
  const label = muted ? 'Ativar músicas' : 'Silenciar músicas';
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

function SoundChannelControl({
  channel,
  label,
  settings,
}: {
  channel: 'music' | 'effects';
  label: string;
  settings: SoundChannel;
}) {
  const silent = settings.muted || settings.volume === 0;
  const action = settings.muted
    ? `Ativar ${label.toLowerCase()}`
    : `Silenciar ${label.toLowerCase()}`;
  return (
    <div className={'sound-channel' + (silent ? ' is-muted' : '')} data-channel={channel}>
      <div className="sound-channel-header">
        <span>{label}</span>
        <button
          type="button"
          className="music-toggle"
          aria-label={action}
          title={action}
          aria-pressed={settings.muted}
          onClick={settings.toggle}
        >
          {silent ? (
            <VolumeX size={15} aria-hidden="true" />
          ) : (
            <Volume2 size={15} aria-hidden="true" />
          )}
        </button>
      </div>
      <div className="sound-channel-volume">
        <input
          aria-label={channel === 'music' ? 'Volume das músicas' : 'Volume dos efeitos sonoros'}
          type="range"
          min="0"
          max="100"
          step="1"
          aria-orientation="horizontal"
          value={Math.round(settings.volume * 100)}
          onChange={(e) => settings.setVolume(Number(e.target.value) / 100)}
        />
        <output>{Math.round(settings.volume * 100)}%</output>
      </div>
    </div>
  );
}

export function MusicControls({ login = false }: { login?: boolean }) {
  const music = useContext(MusicContext);
  const effects = useSoundEffects();
  const panelId = useId();
  const silent = (music.muted || music.volume === 0) && (effects.muted || effects.volume === 0);
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
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          root.current?.querySelector<HTMLButtonElement>('.music-settings-trigger')?.focus();
        }
      }}
    >
      <button
        type="button"
        className="music-settings-trigger"
        aria-label="Configurações de som"
        title="Configurações de som"
        aria-controls={open ? panelId : undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {silent ? (
          <VolumeX size={14} aria-hidden="true" />
        ) : (
          <Volume2 size={14} aria-hidden="true" />
        )}
      </button>
      {open && (
        <div
          className="music-volume-panel"
          id={panelId}
          role="group"
          aria-label="Configurações de som"
        >
          <SoundChannelControl channel="music" label="Músicas" settings={music} />
          <SoundChannelControl channel="effects" label="Efeitos sonoros" settings={effects} />
        </div>
      )}
    </div>
  );
}
