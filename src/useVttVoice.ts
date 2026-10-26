import { useEffect, useRef, useState } from 'react';
import { VttVoiceProcessor } from './vtt-voice-processor';
import { VttVoiceRoom } from './vtt-voice-room';
import type { MonsterVoiceId, VoicePeer } from '../shared/vtt-voice';

export function useVttVoice(roomId: string | undefined) {
  const processor = useRef<VttVoiceProcessor | null>(null),
    room = useRef<VttVoiceRoom | null>(null),
    generation = useRef(0),
    recorder = useRef<MediaRecorder | null>(null),
    clipUrl = useRef('');
  const [preset, setPreset] = useState<MonsterVoiceId>('ogre'),
    [mix, setMix] = useState(1),
    [volume, setVolume] = useState(0.8),
    [listenVolume, setListenVolume] = useState(0.8),
    [monitor, setMonitor] = useState(false),
    [muted, setMuted] = useState(true),
    [mic, setMic] = useState(false),
    [joined, setJoined] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [level, setLevel] = useState(0),
    [peers, setPeers] = useState<VoicePeer[]>([]),
    [connected, setConnected] = useState(0),
    [devices, setDevices] = useState<MediaDeviceInfo[]>([]),
    [device, setDevice] = useState(''),
    [recording, setRecording] = useState(false),
    [clip, setClip] = useState<Blob | null>(null),
    [url, setUrl] = useState('');
  const values = useRef({ preset, mix, volume, listenVolume, monitor, muted });
  values.current = { preset, mix, volume, listenVolume, monitor, muted };
  function release() {
    generation.current++;
    if (recorder.current?.state === 'recording') recorder.current.stop();
    recorder.current = null;
    processor.current?.close();
    processor.current = null;
    room.current?.disconnect();
    room.current = null;
  }
  useEffect(() => {
    setMic(false);
    setJoined(false);
    setPeers([]);
    return release;
  }, [roomId]);
  useEffect(
    () => () => {
      if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
    },
    [],
  );
  useEffect(() => {
    processor.current?.preset(preset, mix);
  }, [preset, mix]);
  useEffect(() => {
    processor.current?.gain(volume);
  }, [volume]);
  useEffect(() => {
    processor.current?.monitor(monitor);
  }, [monitor]);
  useEffect(() => {
    processor.current?.mute(muted);
    void room.current?.mute(muted).catch((e) => setError(e.message));
  }, [muted]);
  useEffect(() => {
    room.current?.volume(listenVolume);
  }, [listenVolume]);
  useEffect(() => {
    if (!mic) return;
    const timer = setInterval(() => setLevel(processor.current?.level() || 0), 70);
    return () => {
      clearInterval(timer);
      setLevel(0);
    };
  }, [mic]);
  async function startMic() {
    if (processor.current || busy) return;
    setBusy(true);
    setError('');
    const token = generation.current;
    try {
      const next = await VttVoiceProcessor.open(device || undefined);
      if (token !== generation.current) {
        next.close();
        return;
      }
      processor.current = next;
      const v = values.current;
      next.preset(v.preset, v.mix);
      next.gain(v.volume);
      next.monitor(v.monitor);
      next.mute(false);
      setMuted(false);
      setMic(true);
      setDevices(
        (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput'),
      );
      await room.current?.input(next.destination.stream, false);
    } catch (e) {
      setError(
        (e as Error).name === 'NotAllowedError'
          ? 'O acesso ao microfone foi negado. Libere-o nas permissões do navegador.'
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }
  function stopMic() {
    if (recorder.current?.state === 'recording') recorder.current.stop();
    recorder.current = null;
    processor.current?.close();
    processor.current = null;
    setMic(false);
    setMuted(true);
    setMonitor(false);
    void room.current?.input(null, true).catch((e) => setError(e.message));
  }
  async function join() {
    if (!roomId || room.current || busy) return;
    setBusy(true);
    setError('');
    const token = generation.current;
    const next = new VttVoiceRoom(
      roomId,
      (list, count) => {
        if (token === generation.current && room.current === next) {
          setPeers(list);
          setConnected(count);
          if (!list.length) {
            setJoined(false);
            room.current = null;
          }
        }
      },
      (message) => {
        if (token === generation.current) setError(message);
      },
    );
    room.current = next;
    try {
      await next.join();
      if (token !== generation.current) {
        next.disconnect();
        return;
      }
      next.volume(values.current.listenVolume);
      if (processor.current)
        await next.input(processor.current.destination.stream, values.current.muted);
      setJoined(true);
    } catch (e) {
      next.disconnect();
      room.current = null;
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function leave() {
    room.current?.disconnect();
    room.current = null;
    setJoined(false);
    setPeers([]);
    setConnected(0);
    setMuted(true);
    processor.current?.mute(true);
  }
  function record() {
    const p = processor.current;
    if (!p || recorder.current) return;
    const mime = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'].find((t) =>
      MediaRecorder.isTypeSupported(t),
    );
    const token = generation.current;
    try {
      const r = new MediaRecorder(
          p.destination.stream,
          mime ? { mimeType: mime, audioBitsPerSecond: 128000 } : undefined,
        ),
        chunks: BlobPart[] = [];
      let timer: ReturnType<typeof setTimeout>;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = () => {
        clearTimeout(timer);
        if (token !== generation.current) return;
        recorder.current = null;
        setRecording(false);
        const blob = new Blob(chunks, { type: r.mimeType });
        if (clipUrl.current) URL.revokeObjectURL(clipUrl.current);
        const next = URL.createObjectURL(blob);
        clipUrl.current = next;
        setClip(blob);
        setUrl(next);
      };
      r.start();
      recorder.current = r;
      setRecording(true);
      timer = setTimeout(() => {
        if (r.state === 'recording') r.stop();
      }, 30000);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return {
    preset,
    setPreset,
    mix,
    setMix,
    volume,
    setVolume,
    listenVolume,
    setListenVolume,
    monitor,
    setMonitor,
    muted,
    setMuted,
    mic,
    joined,
    busy,
    error,
    level,
    peers,
    connected,
    devices,
    device,
    setDevice,
    recording,
    clip,
    url,
    startMic,
    stopMic,
    join,
    leave,
    record,
    stopRecording: () => {
      if (recorder.current?.state === 'recording') recorder.current.stop();
    },
    unlock: () => room.current?.unlock(),
  };
}
