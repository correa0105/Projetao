import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pool, transaction } from '../server/db.js';
import { reuseVttAsset, uniqueVttAssetsSql, duplicateVttAssetIds } from '../server/vtt-assets.js';

test('VTT reutiliza arquivos, inclusive importações simultâneas, sem perder referências antigas', async () => {
  assert.match(new URL(process.env.DATABASE_URL!).pathname, /^\/alvorada_test_[0-9a-f]{32}$/);
  try {
    await pool.query(
      `CREATE TABLE vtt_assets(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),room_id uuid,name text,kind text,mime text,bytes bytea,width integer,height integer,character_art_source uuid,companion_art_source uuid,created_at timestamptz DEFAULT now())`,
    );
    const roomId = randomUUID(),
      input = {
        roomId,
        name: 'Irineu',
        kind: 'image',
        mime: 'image/webp',
        bytes: Buffer.from('same image'),
      };
    const imports = await Promise.all(
      Array.from({ length: 8 }, () => transaction((db) => reuseVttAsset(db, input))),
    );
    assert.equal(new Set(imports.map((a) => a.id)).size, 1);
    const first = imports[0].id;
    assert.equal(
      (await transaction((db) => reuseVttAsset(db, { ...input, name: 'Renomeado' }))).id,
      first,
    );
    for (const change of [
      { roomId: randomUUID() },
      { bytes: Buffer.from('changed image') },
      { characterId: randomUUID() },
      { companionId: randomUUID() },
    ]) {
      assert.notEqual(
        (await transaction((db) => reuseVttAsset(db, { ...input, ...change }))).id,
        first,
      );
    }
    const characterId = randomUUID();
    const character = await transaction((db) => reuseVttAsset(db, { ...input, characterId }));
    assert.equal(
      (await transaction((db) => reuseVttAsset(db, { ...input, characterId }))).id,
      character.id,
    );
    const old = (
      await pool.query(
        `INSERT INTO vtt_assets(room_id,name,kind,mime,bytes) VALUES($1,'Cópia antiga',$2,$3,$4) RETURNING id`,
        [roomId, input.kind, input.mime, input.bytes],
      )
    ).rows[0].id;
    const visible = (await pool.query(uniqueVttAssetsSql, [roomId])).rows;
    assert.equal(visible.length, 5);
    assert(visible.some((a) => a.id === first));
    assert(!visible.some((a) => a.id === old));
    assert.deepEqual(
      new Set(await duplicateVttAssetIds(pool, roomId, first)),
      new Set([first, old]),
    );
    assert.deepEqual(await duplicateVttAssetIds(pool, randomUUID(), first), []);
    assert.equal(
      (
        await pool.query('SELECT bytes FROM vtt_assets WHERE id=$1', [old])
      ).rows[0].bytes.toString(),
      'same image',
    );
  } finally {
    await pool.end();
  }
});
