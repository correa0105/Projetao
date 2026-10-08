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
  cycle: number;
  ready: boolean;
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
  private serverOffset = 0;
  constructor(
    private changed: () => void,
    private failed: (message: string) => void,
    private factory: () => AudioLike = () => new Audio(),
    private clock: () => number = () => Date.now(),
  ) {
    this.timer = setInterval(() => {
      for (const v of this.voices.values()) {
        v.audio.volume += (v.target - v.audio.volume) * 0.3;
        this.repeat(v);
      }
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
  private repeat(v: Voice) {
    if (!v.ready || v.finished || !v.data.loop || !v.data.repeatEvery) return;
    const period = v.data.repeatEvery * 1000;
    const elapsed = Math.max(0, this.clock() + this.serverOffset - v.data.startedAt);
    const cycle = Math.floor(elapsed / period),
      phase = (elapsed % period) / 1000;
    if (cycle === v.cycle) return;
    v.cycle = cycle;
    // Joining midway resumes only the current audible portion. During the gap
    // the voice waits silently for the next shared cycle, without replay.
    if (Number.isFinite(v.audio.duration) && phase >= v.audio.duration) {
      v.audio.pause();
      return;
    }
    v.audio.currentTime = phase;
    this.start(v);
  }
  sync(snapshot: SoundSnapshot, music: Channel, effects: Channel) {
    if (this.disposed) return;
    this.mix = { volume: snapshot.soundboard.volume, music, effects };
    this.serverOffset = snapshot.serverTime - this.clock();
    const list = snapshot.soundboard.voices.filter(
      (v) => !snapshot.soundboard.hiddenSources.includes(v.sourceId),
    );
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
        if (previous.data.repeatEvery !== data.repeatEvery || previous.data.loop !== data.loop)
          previous.cycle = -1;
        const wasInterval = previous.data.loop && previous.data.repeatEvery;
        previous.data = data;
        previous.audio.loop = data.loop && !data.repeatEvery;
        previous.target = this.gain(data);
        if (wasInterval && (!data.repeatEvery || !data.loop) && previous.audio.paused)
          this.start(previous);
        this.repeat(previous);
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
        v: Voice = {
          audio,
          data,
          blocked: false,
          finished: false,
          target: this.gain(data),
          cycle: -1,
          ready: false,
        };
      audio.preload = 'auto';
      audio.src = path;
      audio.loop = data.loop && !data.repeatEvery;
      audio.volume = 0;
      this.voices.set(data.id, v);
      const receivedAt = Date.now();
      audio.onloadedmetadata = () => {
        v.ready = true;
        if (v.data.loop && v.data.repeatEvery) {
          this.repeat(v);
          return;
        }
        if (data.loop && data.startedAt && Number.isFinite(audio.duration) && audio.duration > 0) {
          audio.currentTime =
            (Math.max(0, snapshot.serverTime - data.startedAt + Date.now() - receivedAt) / 1000) %
            audio.duration;
        }
      };
      audio.onended = () => {
        v.finished = !(v.data.loop && v.data.repeatEvery);
        this.changed();
      };
      audio.onerror = () => {
        v.finished = true;
        this.failed('O áudio não pôde ser carregado. Verifique o arquivo.');
        this.changed();
      };
      if (!(data.loop && data.repeatEvery)) this.start(v);
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
    for (const v of this.voices.values())
      if (v.blocked && !v.finished) {
        if (v.data.loop && v.data.repeatEvery) {
          v.cycle = -1;
          this.repeat(v);
        } else this.start(v);
      }
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
