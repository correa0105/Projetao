import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { soundCatalog } from '../shared/vtt-sounds';
import batch from '../data/vtt/dungeon-sounds-20261024.json';
import manifest from '../public/audio/vtt/manifest.json';
import repair from '../data/vtt/dungeon-audio-refinement-20261025.json';
import { soundPath } from '../shared/vtt-sounds';

test('40 áudios de masmorra têm arquivos íntegros, licença rastreável e loops medidos', async () => {
  assert.equal(batch.sounds.length, 40);
  assert.equal(batch.sounds.filter((s) => s.loop).length, 4);
  assert.equal(new Set(batch.sounds.map((s) => s.sha256)).size, 40);
  assert.equal(soundCatalog.length, 195);
  const sourceSlugs = new Set(manifest.sources.map((s) => s.slug));
  for (const source of batch.sources) {
    assert.equal(source.license, 'CC0-1.0');
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.ok(sourceSlugs.has(source.slug));
  }
  for (const sound of batch.sounds) {
    const entry = soundCatalog.find((e) => e.id === sound.id)!;
    const asset = manifest.assets.find((e) => e.id === sound.id)!;
    assert.ok(entry && asset, sound.id);
    assert.equal(entry.kind, sound.loop ? 'ambience' : 'effect');
    const bytes = await readFile('public' + entry.path);
    assert.equal(bytes.toString('ascii', 0, 4), 'OggS');
    assert.equal(bytes.length, asset.bytes);
    const hash = createHash('sha256').update(bytes).digest('hex');
    assert.equal(hash, sound.sha256);
    assert.equal(hash, asset.sha256);
    assert.equal(asset.channels, 2);
    assert.equal(asset.sampleRate, 44100);
    assert.ok(asset.duration > 2 && Math.abs(asset.duration - entry.duration) < 0.001);
    assert.ok(asset.rmsDb > -42 && asset.peakDb < -0.4);
    if (sound.loop) assert.ok(sound.loopSeam < 0.025);
    assert.ok(sound.sources.length);
    for (const source of sound.sources)
      assert.ok(source.startsWith('original:') || sourceSlugs.has(source.split('/')[0]), source);
  }
});

test('áudios revistos mantêm IDs e originais, usam nova URL e têm graves/agudos controlados', async () => {
  assert.equal(repair.sounds.length, 14);
  for (const entry of repair.sounds) {
    const current = manifest.assets.find((a) => a.id === entry.id)!;
    assert.equal(current.file, entry.after.file);
    assert.equal(current.sha256, entry.after.sha256);
    assert.equal(soundPath(entry.id), '/audio/vtt/' + entry.after.file);
    assert.match(entry.after.file, /-r2-20261025\.ogg$/);
    assert.equal(
      createHash('sha256')
        .update(await readFile('public/audio/vtt/' + entry.before.file))
        .digest('hex'),
      entry.before.sha256,
    );
    assert.ok(entry.after.truePeakDb < -8);
    assert.ok(entry.after.shortRmsDb < -20);
    assert.ok(entry.after.bassRatio < 0.35);
    assert.ok(entry.after.trebleRatio < 0.2);
    assert.ok(entry.after.maxSampleStep < 0.18);
  }
});
