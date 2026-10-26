import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import {
  soundCatalog,
  soundCommandSchema,
  emptySoundboard,
  type SoundSnapshot,
} from '../shared/vtt-sounds';
import { soundMatches, soundScenarios, soundDuration } from '../shared/vtt-sound-library';
import { screenEffectPresets } from '../shared/vtt-screen-effects';
import { monsterVoices } from '../shared/vtt-voice';
import manifest from '../public/audio/vtt/manifest.json';
import { VttSoundEngine } from '../src/vtt-sound-engine';

test('46 novos áudios têm mídia íntegra, volumes medidos, fontes CC0 e metadados úteis', async () => {
  assert.equal(soundCatalog.length, 241);
  assert.equal(soundCatalog.filter((e) => e.kind === 'music').length, 25);
  assert.equal(soundCatalog.filter((e) => e.kind === 'ambience').length, 29);
  const added = soundCatalog.filter((e) =>
    /^(music-scene|amb-scene|sfx-scene|sfx-screen)-/.test(e.id),
  );
  assert.equal(added.length, 46);
  for (const e of added) {
    const asset = manifest.assets.find((a) => a.id === e.id)!;
    assert(asset);
    assert.equal(
      createHash('sha256')
        .update(await readFile('public' + e.path))
        .digest('hex'),
      asset.sha256,
    );
    assert.equal(asset.sampleRate, 48000);
    assert.equal(asset.channels, 2);
    assert(asset.truePeakDb !== undefined && asset.truePeakDb < -0.4);
    assert(asset.lufs !== undefined && Number.isFinite(asset.lufs));
    assert(e.description.length > 30);
    assert(e.tags?.length);
    assert(soundScenarios(e).length);
  }
  assert(soundCatalog.every((e) => e.description !== 'Efeito individual para pontuar a cena.'));
  for (const s of manifest.sources.filter((s) => s.slug.startsWith('audio-20261026-'))) {
    assert.equal(s.license, 'CC0-1.0');
    assert.match(s.sha256, /^[a-f0-9]{64}$/);
  }
  assert.equal(soundDuration(119.8), '2:00');
  assert(
    soundMatches(
      soundCatalog.find((e) => e.id === 'sfx-scene-thunder-01')!,
      'clima trovao',
    ),
  );
  assert(
    soundMatches(
      soundCatalog.find((e) => e.id === 'sfx-dungeon-giant-roar')!,
      'dragao',
    ),
  );
});

test('efeitos de tela só aceitam presets, cenas, intensidade e duração válidos', () => {
  assert.deepEqual(screenEffectPresets.map(p=>p.id),['cave-in','embers']);
  for (const p of screenEffectPresets) {
    assert(soundCatalog.some((e) => e.id === p.sound));
    assert(
      soundCommandSchema.safeParse({
        kind: 'screenPlay',
        settings: {
          preset: p.id,
          sceneId: randomUUID(),
          intensity: 0.65,
          duration: 12,
          volume: 0.5,
          muted: false,
        },
      }).success,
    );
  }
  for (const bad of [
    { preset: 'script' },
    ...['earthquake','thunderstorm','blizzard','haunting','arcane'].map(preset=>({preset})),
    { duration: 3600 },
    { volume: 8 },
    { sceneId: 'other' },
    { url: 'https://example.test' },
  ])
    assert(
      !soundCommandSchema.safeParse({
        kind: 'screenPlay',
        settings: {
          preset: 'cave-in',
          sceneId: randomUUID(),
          intensity: 0.65,
          duration: 12,
          volume: 0.5,
          muted: false,
          ...bad,
        },
      }).success,
    );
});

test('áudio de tela espera o horário compartilhado, respeita mute local e termina sem novo poll', async () => {
  let now = 10000;
  let played = 0;
  const audio = {
    src: '',
    volume: 0,
    loop: false,
    currentTime: 0,
    duration: 24,
    paused: true,
    preload: '' as HTMLAudioElement['preload'],
    onloadedmetadata: null as any,
    onended: null as any,
    onerror: null as any,
    play: async () => {
      played++;
      audio.paused = false;
    },
    pause: () => {
      audio.paused = true;
    },
    load: () => {},
    removeAttribute: () => {
      audio.src = '';
    },
  };
  const engine = new VttSoundEngine(
      () => {},
      () => {},
      () => audio,
      () => now,
    ),
    id = randomUUID();
  const event = {
    id,
    preset: 'earthquake' as const,
    sceneId: randomUUID(),
    startedAt: 10100,
    duration: 5,
    intensity: 0.7,
    muted: false,
    volume: 0.6,
  };
  const snapshot: SoundSnapshot = {
    revision: 1,
    serverTime: now,
    soundboard: {
      ...emptySoundboard(),
      screenEffect: event,
      voices: [
        {
          id,
          sourceId: 'sfx-screen-earthquake',
          channel: 'effect',
          volume: 0.6,
          loop: true,
          startedAt: event.startedAt,
        },
      ],
    },
    music: { assetId: null, playing: false, volume: 0.5, loop: false },
  };
  try {
    engine.sync(
      snapshot,
      { volume: 1, muted: false },
      { volume: 1, muted: false },
      { volume: 1, muted: true },
    );
    assert.equal(played, 0);
    now = 10120;
    await new Promise((r) => setTimeout(r, 130));
    assert.equal(played, 1);
    assert.equal(audio.volume, 0);
    now = 15110;
    await new Promise((r) => setTimeout(r, 60));
    assert(audio.paused);
    assert.equal(audio.src, '');
    assert(!engine.active('sfx-screen-earthquake'));
  } finally {
    engine.dispose();
  }
});

test('dez vozes processam áudio real com alturas distintas, saída finita e sem clipping', async () => {
  let Processor: any;
  const code = await readFile('public/audio/vtt-monster-voice-worklet.js', 'utf8');
  runInNewContext(code, {
    AudioWorkletProcessor: class {
      port = { onmessage: null };
    },
    registerProcessor: (_name: string, c: any) => {
      Processor = c;
    },
    Float32Array,
    Math,
    Number,
    Object,
    sampleRate: 48000,
  });
  const hashes = new Set<string>();
  const render = (params: object) => {
    const p = new Processor();
    p.port.onmessage({ data: params });
    const result = new Float32Array(48000);
    for (let at = 0; at < result.length; at += 128) {
      const input = Float32Array.from(
          { length: 128 },
          (_, i) => 0.15 * Math.sin(((at + i) * 2 * Math.PI * 200) / 48000),
        ),
        out = new Float32Array(128);
      p.process([[input]], [[out]]);
      result.set(out.subarray(0, Math.min(128, result.length - at)), at);
    }
    return result;
  };
  const dominant = (a: Float32Array) => {
    let best = 0,
      freq = 0;
    for (let f = 60; f <= 420; f += 2) {
      let re = 0,
        im = 0;
      for (let n = 0; n < 8192; n++) {
        const w = 0.5 - 0.5 * Math.cos((n / 8191) * 2 * Math.PI),
          v = a[a.length - 8192 + n] * w;
        re += v * Math.cos((2 * Math.PI * f * n) / 48000);
        im += v * Math.sin((2 * Math.PI * f * n) / 48000);
      }
      const energy = re * re + im * im;
      if (energy > best) {
        best = energy;
        freq = f;
      }
    }
    return freq;
  };
  for (const p of monsterVoices) {
    const a = render({
      ratio: 2 ** (p.semitones / 12),
      layerRatio: 2 ** (p.layer / 12),
      layerMix: p.layerMix,
      drive: p.drive,
      ring: p.ring,
      ringHz: p.ringHz,
      mix: 1,
    });
    assert(a.every(Number.isFinite));
    assert(Math.max(...a) < 0.95);
    assert(a.some((x) => Math.abs(x) > 0.01));
    hashes.add(createHash('sha256').update(Buffer.from(a.buffer)).digest('hex'));
  }
  assert.equal(hashes.size, 10);
  assert(Math.abs(dominant(render({ ratio: 2 ** (-7 / 12), mix: 1 })) - 200 * 2 ** (-7 / 12)) < 16);
  assert(Math.abs(dominant(render({ ratio: 2 ** (6 / 12), mix: 1 })) - 200 * 2 ** (6 / 12)) < 16);
});
