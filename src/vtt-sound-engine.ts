import {
  soundPath,
  type SoundVoice,
  type SoundSnapshot,
  type SoundSettings,
} from '../shared/vtt-sounds';
type AudioLike = Pick<
  HTMLAudioElement,
  | 'src'
  | 'volume'
  | 'loop'
  | 'currentTime'
  | 'duration'
  | 'paused'
  | 'onloadedmetadata'
  | 'onended'
  | 'onerror'
  | 'play'
  | 'pause'
  | 'load'
  | 'removeAttribute'
  | 'preload'
>;
type Channel = { volume: number; muted: boolean };
type Voice = {
  audio: AudioLike;
  data: SoundVoice;
  blocked: boolean;
  finished: boolean;
  target: number;
};
export class VttSoundEngine {
  private voices = new Map<string, Voice>();
  private seen = new Set<string>();
  private preview: AudioLike | null = null;
  private previewSettings: SoundSettings | null = null;
  private previewTimer: ReturnType<typeof setTimeout> | undefined;
  private first = true;
  private disposed = false;
  private mix = {
    volume: 1,
    music: { volume: 0.4, muted: false },
    effects: { volume: 0.4, muted: false },
  };
  private timer: ReturnType<typeof setInterval>;
  private retiring: AudioLike[] = [];
  constructor(
    private changed: () => void,
    private failed: (message: string) => void,
    private factory: () => AudioLike = () => new Audio(),
  ) {
    this.timer = setInterval(() => {
      for (const v of this.voices.values()) v.audio.volume += (v.target - v.audio.volume) * 0.3;
      this.retiring = this.retiring.filter((a) => {
        a.volume *= 0.4;
        if (a.volume < 0.002) {
          this.release(a);
          return false;
        }
        return true;
      });
    }, 40);
  }
  private release(audio: AudioLike) {
    audio.onloadedmetadata = null;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }
  private start(v: Voice) {
    void v.audio
      .play()
      .then(() => {
        if (!this.disposed) {
          v.blocked = false;
          this.failed('');
          this.changed();
        }
      })
      .catch((e) => {
        if (this.disposed || !this.voices.has(v.data.id)) return;
        v.blocked = true;
        this.failed(
          e?.name === 'NotAllowedError'
            ? 'Clique em Ativar áudio para ouvir os sons da mesa.'
            : 'Não foi possível reproduzir este áudio. Verifique o arquivo.',
        );
        this.changed();
      });
  }
  private gain(v: SoundSettings) {
    const c = v.channel === 'music' ? this.mix.music : this.mix.effects;
    return c.muted ? 0 : Math.max(0, Math.min(1, c.volume * v.volume * this.mix.volume));
  }
  sync(snapshot: SoundSnapshot, music: Channel, effects: Channel) {
    if (this.disposed) return;
    this.mix = { volume: snapshot.soundboard.volume, music, effects };
    const list = [...snapshot.soundboard.voices];
    if (snapshot.music.playing && snapshot.music.assetId)
      list.push({
        id: 'legacy:' + snapshot.music.assetId,
        sourceId: 'asset:' + snapshot.music.assetId,
        channel: 'music',
        volume: snapshot.music.volume,
        loop: snapshot.music.loop,
        startedAt: 0,
      });
    const ids = new Set(list.map((v) => v.id));
    if (this.preview && this.previewSettings) this.preview.volume = this.gain(this.previewSettings);
    for (const [id, v] of this.voices)
      if (!ids.has(id)) {
        if (v.data.loop && !v.finished && v.audio.volume > 0.002) {
          v.audio.onloadedmetadata = null;
          v.audio.onended = null;
          v.audio.onerror = null;
          this.retiring.push(v.audio);
          if (this.retiring.length > 16) this.release(this.retiring.shift()!);
        } else this.release(v.audio);
        this.voices.delete(id);
        if (id.startsWith('legacy:')) this.seen.delete(id);
      }
    for (const data of list) {
      const previous = this.voices.get(data.id);
      if (previous) {
        previous.data = data;
        previous.audio.loop = data.loop;
        previous.target = this.gain(data);
        continue;
      }
      if (this.seen.has(data.id) && !data.loop) continue;
      this.seen.add(data.id);
      if (this.seen.size > 512) this.seen.delete(this.seen.values().next().value!);
      // A new participant never replays old one-shot events. Loops resume at their timeline.
      if (
        !data.loop &&
        !data.id.startsWith('legacy:') &&
        (this.first || snapshot.serverTime - data.startedAt > 7000)
      )
        continue;
      const path = soundPath(data.sourceId);
      if (!path) continue;
      const audio = this.factory(),
        v: Voice = { audio, data, blocked: false, finished: false, target: this.gain(data) };
      audio.preload = 'auto';
      audio.src = path;
      audio.loop = data.loop;
      audio.volume = 0;
      this.voices.set(data.id, v);
      const receivedAt = Date.now();
      audio.onloadedmetadata = () => {
        if (data.loop && data.startedAt && Number.isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime =
            (Math.max(0, snapshot.serverTime - data.startedAt + Date.now() - receivedAt) / 1000) %
            audio.duration;
        }
      };
      audio.onended = () => {
        v.finished = true;
        this.changed();
      };
      audio.onerror = () => {
        v.finished = true;
        this.failed('O áudio não pôde ser carregado. Verifique o arquivo.');
        this.changed();
      };
      this.start(v);
    }
    this.first = false;
  }
  active(sourceId: string) {
    return [...this.voices.values()].some((v) => v.data.sourceId === sourceId && !v.finished);
  }
  unlock() {
    // Creating/resuming the context and play calls occur within the user gesture.
    const ctx = new AudioContext(),
      source = ctx.createBufferSource();
    source.buffer = ctx.createBuffer(1, 1, 22050);
    source.connect(ctx.destination);
    source.start();
    void ctx
      .resume()
      .then(() => ctx.close())
      .catch(() => ctx.close());
    for (const v of this.voices.values()) if (v.blocked && !v.finished) this.start(v);
  }
  stopPreview() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    if (this.preview) this.release(this.preview);
    this.preview = null;
    this.changed();
  }
  async previewSound(settings: SoundSettings) {
    this.stopPreview();
    const path = soundPath(settings.sourceId);
    if (!path) return;
    const audio = this.factory();
    audio.src = path;
    audio.volume = this.gain(settings);
    audio.loop = false;
    audio.preload = 'auto';
    this.preview = audio;
    this.previewSettings = settings;
    audio.onended = () => this.stopPreview();
    audio.onerror = () => {
      this.stopPreview();
      this.failed('Não foi possível carregar a prévia.');
    };
    try {
      await audio.play();
    } catch {
      this.stopPreview();
      this.failed('Ative o áudio e confira os volumes nas configurações de som.');
      return;
    }
    this.previewTimer = setTimeout(() => this.stopPreview(), 12000);
    this.changed();
  }
  previewing() {
    return !!this.preview;
  }
  dispose() {
    this.disposed = true;
    clearInterval(this.timer);
    this.stopPreview();
    for (const v of this.voices.values()) this.release(v.audio);
    for (const a of this.retiring) this.release(a);
    this.retiring = [];
    this.voices.clear();
    this.seen.clear();
  }
}
