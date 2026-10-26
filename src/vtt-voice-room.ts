import { api, post } from './api';
import type { VoicePeer, VoiceSignal, VoiceRoomSnapshot } from '../shared/vtt-voice';
type Connection = {
  pc: RTCPeerConnection;
  sender: RTCRtpSender | null;
  audio: HTMLAudioElement;
  candidates: RTCIceCandidateInit[];
};
export class VttVoiceRoom {
  readonly sessionId = crypto.randomUUID();
  private connections = new Map<string, Connection>();
  private closed = false;
  private timer: ReturnType<typeof setInterval> | undefined;
  private cursor = 0;
  private polling = false;
  private servers: RTCIceServer[] = [];
  private stream: MediaStream | null = null;
  private outputVolume = 0.8;
  private path: string;
  constructor(
    roomId: string,
    private changed: (peers: VoicePeer[], connected: number) => void,
    private failed: (error: string) => void,
  ) {
    this.path = `/vtt/rooms/${roomId}/voice`;
  }
  async join() {
    const joined = await post<{ cursor: number; iceServers: RTCIceServer[] }>(this.path, {
      sessionId: this.sessionId,
      muted: true,
      listening: true,
    });
    if (this.closed) {
      void api(this.path + '?sessionId=' + this.sessionId, { method: 'DELETE' });
      return;
    }
    this.cursor = joined.cursor;
    this.servers = joined.iceServers;
    await this.poll();
    if (this.closed) throw Error('Não foi possível iniciar a conversa de voz.');
    this.timer = setInterval(() => void this.poll(), 1500);
  }
  private async signal(
    to: string,
    value: { description?: RTCSessionDescriptionInit; candidate?: RTCIceCandidateInit },
  ) {
    if (!this.closed)
      await post(this.path + '/signal', { sessionId: this.sessionId, to, ...value });
  }
  private create(sid: string) {
    const old = this.connections.get(sid);
    if (old) return old;
    const pc = new RTCPeerConnection({ iceServers: this.servers }),
      audio = new Audio();
    audio.autoplay = true;
    audio.volume = this.outputVolume;
    // Only the offerer creates a transceiver. The answerer reuses the offered
    // audio section, so its microphone cannot land on an unnegotiated sender.
    const c: Connection = {
      pc,
      sender:
        this.sessionId < sid ? pc.addTransceiver('audio', { direction: 'sendrecv' }).sender : null,
      audio,
      candidates: [],
    };
    this.connections.set(sid, c);
    if (this.stream && c.sender) void c.sender.replaceTrack(this.stream.getAudioTracks()[0]);
    pc.onicecandidate = (e) => {
      if (e.candidate) void this.signal(sid, { candidate: e.candidate.toJSON() }).catch(() => {});
    };
    pc.ontrack = (e) => {
      audio.srcObject = e.streams[0] || new MediaStream([e.track]);
      void audio
        .play()
        .catch(() => this.failed('Clique em Ouvir conversa para liberar a voz dos participantes.'));
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed')
        this.failed(
          'Uma conexão de voz falhou. Saia e entre novamente; redes restritas podem exigir um servidor de retransmissão.',
        );
    };
    return c;
  }
  private async handle(s: VoiceSignal) {
    const c = this.create(s.from);
    if (s.description) {
      await c.pc.setRemoteDescription(s.description);
      if (!c.sender) {
        const transceiver = c.pc.getTransceivers().find((t) => t.receiver.track.kind === 'audio');
        if (transceiver) {
          transceiver.direction = 'sendrecv';
          c.sender = transceiver.sender;
          if (this.stream) await c.sender.replaceTrack(this.stream.getAudioTracks()[0]);
        }
      }
      for (const candidate of c.candidates) await c.pc.addIceCandidate(candidate);
      c.candidates = [];
      if (s.description.type === 'offer') {
        await c.pc.setLocalDescription(await c.pc.createAnswer());
        await this.signal(s.from, { description: c.pc.localDescription!.toJSON() });
      }
    } else if (s.candidate) {
      if (c.pc.remoteDescription) await c.pc.addIceCandidate(s.candidate);
      else c.candidates.push(s.candidate);
    }
  }
  private async poll() {
    if (this.closed || this.polling) return;
    this.polling = true;
    try {
      const snapshot = await api<VoiceRoomSnapshot>(
        this.path + `?sessionId=${this.sessionId}&cursor=${this.cursor}`,
      );
      if (this.closed) return;
      const ids = new Set(snapshot.peers.map((p) => p.sessionId));
      for (const [id, c] of this.connections)
        if (!ids.has(id)) {
          this.release(c);
          this.connections.delete(id);
        }
      for (const peer of snapshot.peers) {
        if (peer.sessionId === this.sessionId || this.connections.has(peer.sessionId)) continue;
        const c = this.create(peer.sessionId);
        if (this.sessionId < peer.sessionId) {
          await c.pc.setLocalDescription(await c.pc.createOffer());
          await this.signal(peer.sessionId, { description: c.pc.localDescription!.toJSON() });
        }
      }
      for (const s of snapshot.signals) if (ids.has(s.from)) await this.handle(s);
      this.cursor = snapshot.cursor;
      this.changed(
        snapshot.peers,
        [...this.connections.values()].filter((c) => c.pc.connectionState === 'connected').length,
      );
    } catch (e) {
      this.failed((e as Error).message);
      this.disconnect();
    } finally {
      this.polling = false;
    }
  }
  async input(stream: MediaStream | null, muted: boolean) {
    this.stream = stream;
    for (const c of this.connections.values())
      if (c.sender) await c.sender.replaceTrack(stream?.getAudioTracks()[0] || null);
    if (!this.closed)
      await api(this.path, {
        method: 'PATCH',
        body: JSON.stringify({ sessionId: this.sessionId, muted, listening: true }),
      });
  }
  async mute(muted: boolean) {
    if (!this.closed)
      await api(this.path, {
        method: 'PATCH',
        body: JSON.stringify({ sessionId: this.sessionId, muted, listening: true }),
      });
  }
  volume(volume: number) {
    this.outputVolume = volume;
    for (const c of this.connections.values()) c.audio.volume = volume;
  }
  unlock() {
    for (const c of this.connections.values()) void c.audio.play().catch(() => {});
  }
  private release(c: Connection) {
    c.pc.ontrack = null;
    c.pc.onicecandidate = null;
    c.pc.onconnectionstatechange = null;
    c.pc.close();
    c.audio.pause();
    c.audio.srcObject = null;
  }
  disconnect() {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.timer);
    for (const c of this.connections.values()) this.release(c);
    this.connections.clear();
    this.changed([], 0);
    void api(this.path + '?sessionId=' + this.sessionId, { method: 'DELETE' }).catch(() => {});
  }
}
