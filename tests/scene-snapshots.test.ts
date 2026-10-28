import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  clearSceneSnapshots,
  sceneSnapshotScope,
  readSceneSnapshot,
  writeSceneSnapshot,
} from '../src/scene-snapshots';
import { staticAssetCacheControl } from '../server/static-asset-cache';

test('cenas isolam conta, personagem, prévia e sessão e não compartilham objetos mutáveis', () => {
  clearSceneSnapshots();
  const scope = sceneSnapshotScope('owner', 'hero', false),
    scene = { plots: [{ can_edit: true, x: 1 }] };
  writeSceneSnapshot(scope, 'house:one', scene);
  scene.plots[0].x = 99;
  const cached = readSceneSnapshot<typeof scene>(scope, 'house:one')!;
  assert.equal(cached.plots[0].x, 1);
  cached.plots[0].x = 88;
  assert.equal(readSceneSnapshot<typeof scene>(scope, 'house:one')!.plots[0].x, 1);
  for (const other of [
    sceneSnapshotScope('other', 'hero', false),
    sceneSnapshotScope('owner', 'other', false),
    sceneSnapshotScope('owner', 'hero', true),
  ])
    assert.equal(readSceneSnapshot(other, 'house:one'), null);
  clearSceneSnapshots();
  // A request finishing after logout can only populate the old, unreachable scope.
  writeSceneSnapshot(scope, 'house:one', scene);
  assert.equal(readSceneSnapshot(sceneSnapshotScope('owner', 'hero', false), 'house:one'), null);
});
test('snapshots de exibição expiram e conservam uma quantidade limitada de cenas', () => {
  clearSceneSnapshots();
  const scope = sceneSnapshotScope('user', 'hero', false),
    clock = Date.now;
  let now = 1000;
  Date.now = () => now;
  try {
    writeSceneSnapshot(scope, 'scene', {});
    now += 600001;
    assert.equal(readSceneSnapshot(scope, 'scene'), null);
    for (let i = 0; i < 30; i++) writeSceneSnapshot(scope, String(i), { i });
    assert.equal(readSceneSnapshot(scope, '0'), null);
    assert.deepEqual(readSceneSnapshot(scope, '29'), { i: 29 });
  } finally {
    Date.now = clock;
    clearSceneSnapshots();
  }
});
test('somente artes e bundles com versão recebem cache longo; HTML e arquivos mutáveis mantêm renovação', () => {
  const root = resolve('dist/client');
  for (const file of [
    'guild/roof-overhead-20261020/slate.webp',
    'house2/floors-20261018/floor-parquet-oak.webp',
    'vtt/reference-grass-20261017/grass-reference-sparse.webp',
    'assets/Guilds-abcd.js',
    'cards/host-shadow-study-20261027.png',
  ])
    assert.equal(
      staticAssetCacheControl(root, resolve(root, file)),
      'public, max-age=31536000, immutable',
    );
  assert.equal(staticAssetCacheControl(root, resolve(root, 'index.html')), 'no-store');
  assert.equal(
    staticAssetCacheControl(root, resolve(root, 'character-silhouette-v2.png')),
    'public, max-age=3600',
  );
  assert.equal(staticAssetCacheControl(root, resolve(root, 'data.json')), null);
});
