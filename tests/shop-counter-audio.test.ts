import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { shopCounterSoundProfile } from '../src/shop-counter-audio.js';

const item = (id: string, weight: number, category = 'Itens mundanos') => ({
  id,
  name: id,
  original_name: id,
  category,
  weight_lb: String(weight),
});
test('balcão: peso, tamanho e conteúdo determinam o impacto com headroom', () => {
  const ring = shopCounterSoundProfile(item('ring', 0.1));
  const sword = shopCounterSoundProfile(item('sword', 3), 1.22);
  const plate = shopCounterSoundProfile(item('plate-armor', 27), 1.18);
  assert.equal(plate.weight, 65);
  assert.ok(ring.gain < sword.gain && sword.gain < plate.gain);
  assert.ok(ring.pitch > sword.pitch && sword.pitch > plate.pitch);
  assert.ok(plate.cutoff < ring.cutoff);
  assert.ok(
    shopCounterSoundProfile(item('large', 3), 1.22).gain >
      shopCounterSoundProfile(item('small', 3), 1).gain,
  );
  for (const id of ['potion-of-healing', 'oil', 'antitoxin', 'alchemists-fire', 'acid'])
    assert.equal(shopCounterSoundProfile(item(id, 0.5)).kind, 'liquid');
  assert.equal(shopCounterSoundProfile(item('waterskin', 5)).kind, 'waterskin');
  assert.equal(shopCounterSoundProfile(item('pocao-especial', 0.5, 'Poções')).kind, 'liquid');
  assert.equal(shopCounterSoundProfile(item('longsword', 3)).kind, 'metal');
  for (const weight of [NaN, -10, 0, 0.1, 1, 5, 20, 65, 10000]) {
    const profile = shopCounterSoundProfile(item('object', weight), 1.22);
    assert.ok(Number.isFinite(profile.gain) && profile.gain > 0 && profile.gain <= 0.82);
    assert.ok(profile.pitch >= 0.8 && profile.pitch <= 1.1);
  }
});

test('balcão: contato reconhece materiais, líquido e objetos vazios sem depender da categoria mágica', () => {
  const cases = {
    chain: 'chain',
    'chain-mail': 'chain',
    manacles: 'chain',
    'ball-bearings': 'spheres',
    'glass-bottle': 'glass',
    'crystal-ball': 'glass',
    'ring-of-protection': 'metal',
    'cosmetic-necklace': 'metal',
    'cosmetic-tiara': 'metal',
    'cosmetic-gloves': 'leather',
    'cosmetic-boots': 'leather',
    'cosmetic-cape': 'cloth',
    'spell-scroll-cantrip': 'paper',
    book: 'paper',
    cigar: 'paper',
    backpack: 'leather',
    'leather-armor': 'leather',
    blanket: 'cloth',
    bucket: 'wood',
    quarterstaff: 'wood',
  };
  for (const [id, kind] of Object.entries(cases))
    assert.equal(shopCounterSoundProfile({ ...item(id, 2), name: 'Nome alterado' }).kind, kind, id);
  assert.equal(shopCounterSoundProfile(item('nova-garrafa-de-vidro', 1)).kind, 'glass');
  assert.equal(shopCounterSoundProfile(item('novo-cantil', 1)).kind, 'waterskin');
  assert.equal(shopCounterSoundProfile(item('nova-bola-de-gude', 1)).kind, 'spheres');
  assert.equal(shopCounterSoundProfile(item('nova-corrente', 1)).kind, 'chain');
  assert.ok(
    shopCounterSoundProfile(item('blanket', 3)).gain <
      shopCounterSoundProfile(item('longsword', 3)).gain,
    'tecido deve ter contato mais discreto que aço de mesmo peso',
  );
});

test('balcão: gravações CC0, hashes e WAVs válidos sem clipping', async () => {
  const manifest = JSON.parse(await readFile('public/audio/shop-counter-manifest.json', 'utf8'));
  assert.equal(manifest.license, 'CC0-1.0');
  assert.ok(manifest.sources.length > 3);
  assert.ok(manifest.sources.every((source: { license: string }) => source.license === 'CC0-1.0'));
  assert.deepEqual(Object.keys(manifest.files).sort(), [
    'chain',
    'cloth',
    'glass',
    'leather',
    'liquid',
    'metal',
    'paper',
    'spheres',
    'waterskin',
    'wood',
  ]);
  assert.equal(
    new Set((Object.values(manifest.files) as { sha256: string }[]).map((file) => file.sha256))
      .size,
    10,
  );
  assert.ok(manifest.layers.liquid.some((layer: { id: string }) => layer.id === 'shop-liquid'));
  assert.ok(manifest.layers.liquid.some((layer: { id: string }) => layer.id === 'shop-bottle'));
  assert.ok(!manifest.layers.liquid.some((layer: { id: string }) => layer.id === 'shop-wood'));
  assert.ok(manifest.layers.waterskin.some((layer: { id: string }) => layer.id === 'shop-liquid'));
  assert.ok(!manifest.layers.waterskin.some((layer: { id: string }) => layer.id === 'shop-bottle'));
  for (const file of Object.values(manifest.files) as {
    file: string;
    sha256: string;
    duration: number;
  }[]) {
    const bytes = await readFile('public/audio/' + file.file);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
    assert.equal(bytes.toString('ascii', 8, 12), 'WAVE');
    assert.equal(bytes.readUInt32LE(24), 48000);
    assert.equal(bytes.readUInt16LE(22), 1);
    assert.equal(bytes.readUInt16LE(34), 16);
    assert.equal((bytes.length - 44) / 96000, file.duration);
    let peak = 0,
      energy = 0;
    for (let i = 44; i < bytes.length; i += 2) {
      const value = bytes.readInt16LE(i) / 32767;
      peak = Math.max(peak, Math.abs(value));
      energy += value ** 2;
    }
    assert.ok(peak > 0.05 && peak <= 0.681, `${file.file}: pico sem headroom`);
    assert.ok(Math.sqrt(energy / ((bytes.length - 44) / 2)) > 0.005, `${file.file}: áudio vazio`);
  }
});

test('balcão: poção tem contato delicado e preserva o nível da água aprovada', async () => {
  const bytes = await readFile('public/audio/shop-counter-liquid.wav');
  const rms = (from: number, to: number) => {
    let energy = 0;
    const first = Math.round(from * 48000),
      last = Math.round(to * 48000);
    for (let frame = first; frame < last; frame++)
      energy += (bytes.readInt16LE(44 + frame * 2) / 32767) ** 2;
    return Math.sqrt(energy / (last - first));
  };
  // The old initial contact was RMS .31970; this window follows the same timing.
  assert.ok(rms(0, 0.08) < 0.08, 'o contato inicial do frasco continua forte demais');
  // After the bottle settles, only the already approved slosh remains (old PCM reference).
  assert.ok(Math.abs(rms(0.65, 0.9) - 0.026329128071674215) < 0.00001);
});
