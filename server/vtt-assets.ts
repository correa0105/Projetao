import type { PoolClient } from 'pg';

type AssetInput = {
  roomId: string;
  name: string;
  kind: string;
  mime: string;
  bytes: Buffer;
  width?: number | null;
  height?: number | null;
  characterId?: string | null;
  companionId?: string | null;
};

/** Call inside a transaction. A room lock also serializes simultaneous identical uploads. */
export async function reuseVttAsset(db: Pick<PoolClient, 'query'>, a: AssetInput) {
  await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [
    'vtt-assets:' + a.roomId,
  ]);
  const args = [a.roomId, a.kind, a.mime, a.bytes, a.characterId || null, a.companionId || null];
  const found = await db.query(
    `SELECT id,name,kind,width,height FROM vtt_assets WHERE room_id=$1 AND kind=$2 AND mime=$3 AND bytes=$4 AND character_art_source IS NOT DISTINCT FROM $5::uuid AND companion_art_source IS NOT DISTINCT FROM $6::uuid ORDER BY created_at,id LIMIT 1`,
    args,
  );
  if (found.rows.length) return found.rows[0];
  return (
    await db.query(
      `INSERT INTO vtt_assets(room_id,name,kind,mime,bytes,width,height,character_art_source,companion_art_source) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id,name,kind,width,height`,
      [
        a.roomId,
        a.name,
        a.kind,
        a.mime,
        a.bytes,
        a.width ?? null,
        a.height ?? null,
        a.characterId || null,
        a.companionId || null,
      ],
    )
  ).rows[0];
}

/** Old copies remain addressable by maps and tokens, but appear once in the library. */
export const uniqueVttAssetsSql = `SELECT id,name,kind,width,height FROM (SELECT DISTINCT ON(kind,mime,character_art_source,companion_art_source,sha256(bytes)) id,name,kind,width,height,created_at FROM vtt_assets WHERE room_id=$1 ORDER BY kind,mime,character_art_source,companion_art_source,sha256(bytes),created_at,id) a ORDER BY created_at DESC,id`;

export async function duplicateVttAssetIds(
  db: Pick<PoolClient, 'query'>,
  roomId: string,
  id: string,
): Promise<string[]> {
  return (
    await db.query(
      `SELECT a.id FROM vtt_assets a JOIN vtt_assets selected ON selected.id=$2 AND selected.room_id=$1 WHERE a.room_id=$1 AND a.kind=selected.kind AND a.mime=selected.mime AND a.bytes=selected.bytes AND a.character_art_source IS NOT DISTINCT FROM selected.character_art_source AND a.companion_art_source IS NOT DISTINCT FROM selected.companion_art_source`,
      [roomId, id],
    )
  ).rows.map((a) => a.id);
}
