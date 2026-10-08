import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { VttSoundEngine } from '../src/vtt-sound-engine';
import {
  soundCatalog,
  soundboardSchema,
  emptySoundboard,
  soundPath,
  type SoundSnapshot,
  type SoundVoice,
} from '../shared/vtt-sounds';
import { documentSchema, newDocument } from '../shared/vtt';
import { hotbarActionSchema } from '../shared/vtt-hotbar';
class FakeAudio {
  src = '';
  volume = 0;
  loop = false;
  currentTime = 0;
  duration = 30;
  paused = true;
  preload: HTMLAudioElement['preload'] = '';
  plays = 0;
  loads = 0;
  onloadedmetadata: any = null;
  onended: any = null;
  onerror: any = null;
  async play() {
    this.plays++;
    this.paused = false;
  }
  pause() {
    this.paused = true;
  }
  load() {
    this.loads++;
  }
  removeAttribute() {
    this.src = '';
  }
}
const voice = (sourceId: string, loop = true): SoundVoice => ({
  id: randomUUID(),
  sourceId,
  loop,
  channel: sourceId.startsWith('music') ? 'music' : 'ambience',
  volume: 0.7,
  startedAt: Date.now() - 10000,
});
const snap = (voices: SoundVoice[] = []): SoundSnapshot => ({
  revision: 1,
  serverTime: Date.now(),
  soundboard: { ...emptySoundboard(), voices },
  music: { assetId: null, playing: false, volume: 0.5, loop: true },
});
const preferences = { volume: 0.5, muted: false };
test('catálogo local tem fontes restritas, durações reais e canais seguros', () => {
  assert.ok(soundCatalog.length >= 70);
  assert.equal(new Set(soundCatalog.map((e) => e.id)).size, soundCatalog.length);
  for (const e of soundCatalog) {
    assert.match(e.path, /^\/audio\/vtt\/[a-z0-9-]+\.ogg$/);
    assert.ok(e.duration > 0);
    assert.ok(e.credit);
    assert.equal(soundPath(e.id), e.path);
  }
  for (const malicious of [
    'https://example.test/track.mp3',
    'asset:../../secret',
    '/api/vtt/assets/' + randomUUID(),
    'unknown',
  ]) {
    assert.equal(soundPath(malicious), '');
    assert.equal(
      hotbarActionSchema.safeParse({ kind: 'sound', sourceId: malicious, label: 'Teste' }).success,
      false,
    );
  }
  assert.equal(soundPath('asset:' + randomUUID()).startsWith('/api/vtt/assets/'), true);
});
test('documentos antigos recebem som vazio sem modificar o objeto original', () => {
  const d = newDocument(randomUUID());
  const old: any = structuredClone(d);
  delete old.soundboard;
  const parsed = documentSchema.parse(old);
  assert.deepEqual(parsed.soundboard, emptySoundboard());
  assert.equal('soundboard' in old, false);
  assert.equal(soundboardSchema.safeParse({ ...emptySoundboard(), volume: 1.1 }).success, false);
  assert.equal(
    soundboardSchema.safeParse({
      ...emptySoundboard(),
      voices: [voice('music-old-inn'), voice('music-bards-tale')],
    }).success,
    false,
  );
  assert.equal(
    soundboardSchema.safeParse({
      ...emptySoundboard(),
      voices: [{ ...voice('music-old-inn'), channel: 'effect' }],
    }).success,
    false,
  );
});
test('mixer combina canais, aplica preferências locais e segue a linha temporal do loop', async () => {
  const made: FakeAudio[] = [],
    engine = new VttSoundEngine(
      () => {},
      () => {},
      () => {
        const a = new FakeAudio();
        made.push(a);
        return a;
      },
    );
  try {
    const m = voice('music-old-inn'),
      a = voice('amb-hearth');
    const s = snap([m, a]);
    engine.sync(s, preferences, { volume: 0.25, muted: false });
    assert.equal(made.length, 2);
    made.forEach((a) => a.onloadedmetadata());
    assert.ok(made[0].currentTime >= 9.9 && made[0].currentTime < 10.2);
    await new Promise((r) => setTimeout(r, 160));
    assert.ok(made[0].volume > made[1].volume);
    assert.ok(made[0].volume < 0.3);
    engine.sync(s, { ...preferences, muted: true }, preferences);
    await new Promise((r) => setTimeout(r, 160));
    assert.ok(made[0].volume < 0.07);
    engine.sync(s, preferences, preferences);
    assert.equal(made.length, 2);
    assert.equal(made[0].plays, 1);
  } finally {
    engine.dispose();
  }
  assert.ok(made.every((a) => a.paused && !a.src));
});
test('efeitos curtos não se repetem em polls, ganho ou entrada na mesa; um novo disparo toca', async () => {
  const made: FakeAudio[] = [],
    engine = new VttSoundEngine(
      () => {},
      () => {},
      () => {
        const a = new FakeAudio();
        made.push(a);
        return a;
      },
    );
  try {
    const event = {
      ...voice('sfx-dooropen-1', false),
      channel: 'effect' as const,
      startedAt: Date.now(),
    };
    engine.sync(snap([event]), preferences, preferences);
    assert.equal(made.length, 0);
    engine.sync(snap([]), preferences, preferences);
    const fresh = { ...event, id: randomUUID() };
    engine.sync(snap([fresh]), preferences, preferences);
    assert.equal(made.length, 1);
    made[0].onended();
    engine.sync(snap([fresh]), preferences, preferences);
    assert.equal(made[0].plays, 1);
    engine.sync(snap([{ ...fresh, id: randomUUID() }]), preferences, preferences);
    assert.equal(made.length, 2);
    assert.equal(made[0].src, '');
  } finally {
    engine.dispose();
  }
});
test('prévia local não altera estado compartilhado e é descartada com o player', async () => {
  const made: FakeAudio[] = [],
    engine = new VttSoundEngine(
      () => {},
      () => {},
      () => {
        const a = new FakeAudio();
        made.push(a);
        return a;
      },
    );
  try {
    engine.sync(snap(), preferences, preferences);
    await engine.previewSound({
      sourceId: 'music-bards-tale',
      channel: 'music',
      volume: 0.5,
      loop: true,
    });
    assert.equal(made[0].loop, false);
    assert.equal(engine.active('music-bards-tale'), false);
    assert.equal(engine.previewing(), true);
    engine.stopPreview();
    assert.equal(made[0].src, '');
  } finally {
    engine.dispose();
  }
});
test('trilha legada continua funcional ao parar e retomar', () => {
  const made: FakeAudio[] = [],
    engine = new VttSoundEngine(
      () => {},
      () => {},
      () => {
        const a = new FakeAudio();
        made.push(a);
        return a;
      },
    );
  try {
    const s = snap();
    s.music = { assetId: randomUUID(), playing: true, volume: 0.5, loop: true };
    engine.sync(s, preferences, preferences);
    engine.sync({ ...s, music: { ...s.music, playing: false } }, preferences, preferences);
    engine.sync(s, preferences, preferences);
    assert.equal(made.length, 2);
  } finally {
    engine.dispose();
  }
});

test('intervalos seguem o início compartilhado, esperam em silêncio e não acumulam players', () => {
  let now = 100000;
  const made: FakeAudio[] = [];
  const engine = new VttSoundEngine(
    () => {},
    () => {},
    () => {
      const a = new FakeAudio();
      a.duration = 0.4;
      made.push(a);
      return a;
    },
    () => now,
  );
  const v = {
    ...voice('sfx-dooropen-1'),
    channel: 'effect' as const,
    startedAt: 100000,
    repeatEvery: 2,
  };
  const snapshot = () => ({ ...snap([v]), serverTime: now });
  try {
    engine.sync(snapshot(), preferences, preferences);
    assert.equal(made[0].plays, 0);
    made[0].onloadedmetadata();
    assert.equal(made[0].loop, false);
    assert.equal(made[0].plays, 1);
    engine.sync(snapshot(), preferences, preferences);
    assert.equal(made[0].plays, 1);
    made[0].onended();
    now += 1000;
    engine.sync(snapshot(), preferences, preferences);
    assert.equal(made[0].plays, 1);
    now += 1000;
    engine.sync(snapshot(), preferences, preferences);
    assert.equal(made[0].plays, 2);
    assert.equal(made[0].currentTime, 0);
    now += 2000;
    engine.sync(snapshot(), preferences, preferences);
    assert.equal(made[0].plays, 3);
    assert.equal(made.length, 1);
    const hidden = snapshot();
    hidden.soundboard.hiddenSources = [v.sourceId];
    engine.sync(hidden, preferences, preferences);
    assert.equal(engine.active(v.sourceId), false);
    engine.dispose();
    assert.equal(made[0].src, '');
  } finally {
    engine.dispose();
  }
});

test('entrada no silêncio entre intervalos aguarda o próximo ciclo e retoma na fase audível', () => {
  let now = 101200;
  const made: FakeAudio[] = [];
  const engine = new VttSoundEngine(
    () => {},
    () => {},
    () => {
      const a = new FakeAudio();
      a.duration = 0.7;
      made.push(a);
      return a;
    },
    () => now,
  );
  const v = {
    ...voice('sfx-dooropen-1'),
    channel: 'effect' as const,
    startedAt: 100000,
    repeatEvery: 2,
  };
  try {
    engine.sync({ ...snap([v]), serverTime: now }, preferences, preferences);
    made[0].onloadedmetadata();
    assert.equal(made[0].plays, 0);
    assert.equal(made[0].paused, true);
    now = 102200;
    engine.sync({ ...snap([v]), serverTime: now }, preferences, preferences);
    assert.equal(made[0].plays, 1);
    assert.equal(made[0].currentTime, 0.2);
  } finally {
    engine.dispose();
  }
});

test('favoritos, removidos e intervalos têm fontes únicas e limites validados', () => {
  assert.ok(
    soundboardSchema.safeParse({
      ...emptySoundboard(),
      favorites: ['amb-hearth'],
      hiddenSources: ['music-bards-tale'],
      settings: [
        { sourceId: 'amb-hearth', channel: 'ambience', volume: 0.5, loop: true, repeatEvery: 10 },
      ],
    }).success,
  );
  for (const field of ['favorites', 'hiddenSources'])
    assert.equal(
      soundboardSchema.safeParse({ ...emptySoundboard(), [field]: ['amb-hearth', 'amb-hearth'] })
        .success,
      false,
    );
  for (const repeatEvery of [0, -1, 3601, Infinity])
    assert.equal(
      soundboardSchema.safeParse({
        ...emptySoundboard(),
        settings: [
          { sourceId: 'amb-hearth', channel: 'ambience', volume: 0.5, loop: true, repeatEvery },
        ],
      }).success,
      false,
    );
});
