import { useState } from 'react';
import { Mic, MicOff, Headphones, Radio, Square, Download, Play } from 'lucide-react';
import { monsterVoices, type MonsterVoiceId } from '../shared/vtt-voice';
import type { useVttVoice } from './useVttVoice';
import './vtt-voice.css';
export function VttVoicePanel({
  voice,
  gm,
  share,
}: {
  voice: ReturnType<typeof useVttVoice>;
  gm: boolean;
  share: (file: File) => Promise<void>;
}) {
  const [sharing, setSharing] = useState(false),
    [failure, setFailure] = useState('');
  return (
    <section className="vtt-voice-panel" aria-label="Microfone e vozes de monstros">
      <div className="vtt-sound-section-title">
        <Mic size={19} />
        <div>
          <strong>Voz dos monstros</strong>
          <small>10 efeitos em tempo real</small>
        </div>
      </div>
      <p>
        Entre para ouvir a conversa. Ative o microfone quando quiser falar com a voz escolhida. O
        processamento acontece neste navegador.
      </p>
      <div className="vtt-voice-actions">
        {voice.joined ? (
          <>
            <button onClick={voice.unlock}>
              <Headphones size={14} /> Ouvir conversa
            </button>
            <button onClick={voice.leave}>Sair da conversa</button>
          </>
        ) : (
          <button disabled={voice.busy} onClick={() => void voice.join()}>
            <Radio size={15} /> Entrar na conversa
          </button>
        )}
        {voice.mic ? (
          <button onClick={voice.stopMic}>
            <MicOff size={14} /> Desligar microfone
          </button>
        ) : (
          <button disabled={voice.busy} onClick={() => void voice.startMic()}>
            <Mic size={14} /> Ativar microfone
          </button>
        )}
      </div>
      {voice.joined && (
        <p role="status">
          {voice.peers.length} na conversa · {voice.connected} conexões de áudio
        </p>
      )}
      {!!voice.peers.length && (
        <ul className="vtt-voice-peers">
          {voice.peers.map((p) => (
            <li key={p.sessionId}>
              {p.muted ? <MicOff size={12} /> : <Mic size={12} />} {p.name}
              <span>{p.muted ? 'mudo' : 'microfone ativo'}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="vtt-voice-presets">
        <button
          aria-pressed={voice.preset === 'natural'}
          onClick={() => voice.setPreset('natural')}
        >
          <strong>Voz natural</strong>
          <small>Sem transformação</small>
        </button>
        {monsterVoices.map((p) => (
          <button
            key={p.id}
            aria-pressed={voice.preset === p.id}
            onClick={() => voice.setPreset(p.id as MonsterVoiceId)}
          >
            <strong>{p.name}</strong>
            <small>{p.description}</small>
          </button>
        ))}
      </div>
      {voice.devices.length > 0 && (
        <label>
          Microfone
          <select
            aria-label="Dispositivo de microfone"
            value={voice.device}
            disabled={voice.mic}
            onChange={(e) => voice.setDevice(e.target.value)}
          >
            <option value="">Padrão do sistema</option>
            {voice.devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || 'Microfone'}
              </option>
            ))}
          </select>
        </label>
      )}
      <label>
        Transformação · {Math.round(voice.mix * 100)}%
        <input
          aria-label="Intensidade da voz"
          type="range"
          min="0"
          max="1"
          step=".05"
          value={voice.mix}
          onChange={(e) => voice.setMix(+e.target.value)}
        />
      </label>
      <label>
        Volume do microfone · {Math.round(voice.volume * 100)}%
        <input
          aria-label="Volume do microfone"
          type="range"
          min="0"
          max="1"
          step=".05"
          value={voice.volume}
          onChange={(e) => voice.setVolume(+e.target.value)}
        />
      </label>
      <label>
        Volume da conversa · {Math.round(voice.listenVolume * 100)}%
        <input
          aria-label="Volume da conversa"
          type="range"
          min="0"
          max="1"
          step=".05"
          value={voice.listenVolume}
          onChange={(e) => voice.setListenVolume(+e.target.value)}
        />
      </label>
      <div
        className="vtt-voice-meter"
        role="meter"
        aria-label="Nível do microfone"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(voice.level * 100)}
      >
        <i style={{ width: Math.round(voice.level * 100) + '%' }} />
      </div>
      <div className="vtt-voice-actions">
        <button
          disabled={!voice.mic}
          aria-pressed={voice.muted}
          onClick={() => voice.setMuted(!voice.muted)}
        >
          {voice.muted ? <MicOff size={14} /> : <Mic size={14} />}{' '}
          {voice.muted ? 'Liberar minha voz' : 'Mutar minha voz'}
        </button>
        <label className="vtt-check">
          <input
            type="checkbox"
            disabled={!voice.mic}
            checked={voice.monitor}
            onChange={(e) => voice.setMonitor(e.target.checked)}
          />
          Ouvir minha voz
        </label>
      </div>
      <p className="vtt-voice-hint">
        Use fones para ouvir sua voz sem retorno. A voz modificada é enviada apenas a quem entrou na
        conversa desta mesa.
      </p>
      <div className="vtt-voice-record">
        <strong>Preparar uma fala</strong>
        <p>Grave até 30 segundos para ouvir, baixar ou tocar na mesa depois.</p>
        <button
          disabled={!voice.mic || voice.muted}
          onClick={voice.recording ? voice.stopRecording : voice.record}
        >
          {voice.recording ? <Square size={13} /> : <Mic size={13} />}{' '}
          {voice.recording ? 'Parar gravação' : 'Gravar fala'}
        </button>
        {voice.url && (
          <>
            <audio controls src={voice.url} />
            <a
              href={voice.url}
              download={
                'voz-' + voice.preset + (voice.clip?.type.includes('ogg') ? '.ogg' : '.webm')
              }
            >
              <Download size={13} /> Baixar fala
            </a>
            {gm && (
              <button
                disabled={sharing || !voice.clip}
                onClick={async () => {
                  setSharing(true);
                  setFailure('');
                  try {
                    await share(
                      new File(
                        [voice.clip!],
                        'Voz de ' +
                          voice.preset +
                          (voice.clip!.type.includes('ogg') ? '.ogg' : '.webm'),
                        { type: voice.clip!.type },
                      ),
                    );
                  } catch (e) {
                    setFailure((e as Error).message);
                  } finally {
                    setSharing(false);
                  }
                }}
              >
                <Play size={13} /> {sharing ? 'Preparando…' : 'Tocar fala na mesa'}
              </button>
            )}
          </>
        )}
      </div>
      {(voice.error || failure) && (
        <p role="alert" className="vtt-sound-error">
          {failure || voice.error}
        </p>
      )}
    </section>
  );
}
export function VttVoiceStatus({ voice }: { voice: ReturnType<typeof useVttVoice> }) {
  if (!voice.mic && !voice.joined) return null;
  const label = monsterVoices.find((p) => p.id === voice.preset)?.name || 'Voz natural';
  return (
    <div className="vtt-voice-status" aria-label="Estado do microfone">
      <span>
        {voice.mic && !voice.muted ? <Mic size={13} /> : <MicOff size={13} />}{' '}
        {voice.mic ? (voice.muted ? 'Microfone mudo' : label) : 'Ouvindo conversa'}
      </span>
      {voice.mic && (
        <button
          aria-label={voice.muted ? 'Liberar microfone da mesa' : 'Mutar microfone da mesa'}
          onClick={() => voice.setMuted(!voice.muted)}
        >
          {voice.muted ? <Mic size={13} /> : <MicOff size={13} />}
        </button>
      )}
      <button
        aria-label="Encerrar microfone e conversa"
        onClick={() => {
          voice.stopMic();
          voice.leave();
        }}
      >
        <Square size={12} />
      </button>
    </div>
  );
}
