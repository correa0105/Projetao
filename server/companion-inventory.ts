import type { PoolClient } from 'pg';
type DB = Pick<PoolClient, 'query'>;
export async function companionAllocated(db: DB, characterId: string) {
  const { rows } = await db.query(
    'SELECT item_id,count(*)::int AS quantity FROM companion_equipment WHERE character_id=$1 AND item_id IS NOT NULL GROUP BY item_id',
    [characterId],
  );
  return Object.fromEntries(rows.map((row) => [row.item_id, row.quantity])) as Record<
    string,
    number
  >;
}
export async function allocatedCopies(
  db: DB,
  characterId: string,
  itemId: string,
  except?: { humanSlot?: string; wardrobeId?: string; companionSlot?: string },
) {
  const {
    rows: [row],
  } = await db.query(
    `SELECT
    (SELECT count(*) FROM character_equipment WHERE character_id=$1 AND item_id=$2 AND ($3::text IS NULL OR slot<>$3)) +
    (SELECT count(*) FROM companion_equipment WHERE character_id=$1 AND item_id=$2 AND ($4::uuid IS NULL OR wardrobe_id<>$4 OR slot<>$5)) AS total`,
    [
      characterId,
      itemId,
      except?.humanSlot || null,
      except?.wardrobeId || null,
      except?.companionSlot || null,
    ],
  );
  return Number(row.total);
}
