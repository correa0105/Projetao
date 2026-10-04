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
  for (const id of ['potion-of-healing', 'oil', 'waterskin'])
    assert.equal(shopCounterSoundProfile(item(id, 0.5)).kind, 'liquid');
  assert.equal(shopCounterSoundProfile(item('pocao-especial', 0.5, 'Poções')).kind, 'liquid');
  assert.equal(shopCounterSoundProfile(item('longsword', 3)).kind, 'wood');
  for (const weight of [NaN, -10, 0, 0.1, 1, 5, 20, 65, 10000]) {
    const profile = shopCounterSoundProfile(item('object', weight), 1.22);
    assert.ok(Number.isFinite(profile.gain) && profile.gain > 0 && profile.gain <= 0.82);
    assert.ok(profile.pitch >= 0.8 && profile.pitch <= 1.1);
  }
});

test('balcão: gravações CC0, hashes e WAVs válidos sem clipping', async () => {
  const manifest = JSON.parse(await readFile('public/audio/shop-counter-manifest.json', 'utf8'));
  assert.equal(manifest.license, 'CC0-1.0');
  assert.equal(manifest.sources.length, 3);
  assert.ok(manifest.layers.liquid.some((layer: { id: string }) => layer.id === 'shop-liquid'));
  assert.ok(manifest.layers.liquid.some((layer: { id: string }) => layer.id === 'shop-bottle'));
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
    assert.ok(peak > 0.67 && peak < 0.69);
    assert.ok(Math.sqrt(energy / ((bytes.length - 44) / 2)) > 0.03);
  }
});
