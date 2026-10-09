import type { PoolClient } from 'pg';
import { AppError } from './services.js';
type DB = Pick<PoolClient, 'query'>;
export async function companionAllocated(db: DB, characterId: string) {
  const { rows } = await db.query(
    'SELECT item_id,sum(quantity)::int AS quantity FROM companion_inventory WHERE character_id=$1 GROUP BY item_id',
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
    (SELECT COALESCE(sum(quantity),0) FROM companion_inventory WHERE character_id=$1 AND item_id=$2 AND ($4::uuid IS NULL OR wardrobe_id<>$4)) +
    (SELECT count(*) FROM companion_equipment WHERE character_id=$1 AND item_id=$2 AND wardrobe_id=$4 AND slot<>$5) AS total`,
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

export async function companionBagItems(db: DB, wardrobeId: string) {
  const { rows } = await db.query(
    `SELECT c.*,i.quantity,
    (SELECT count(*)::int FROM companion_equipment e WHERE e.wardrobe_id=i.wardrobe_id AND e.item_id=i.item_id) AS allocated
    FROM companion_inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.wardrobe_id=$1 ORDER BY c.name`,
    [wardrobeId],
  );
  return rows.map((item) => ({ ...item, available: item.quantity - item.allocated }));
}

// Old clients can equip a free purchased item directly. Move its copy into the
// animal's bag atomically instead of letting both owners use the same unit.
export async function claimCompanionCopy(
  db: DB,
  characterId: string,
  wardrobeId: string,
  itemId: string,
  slot: string,
) {
  const {
    rows: [row],
  } = await db.query(
    `SELECT
    COALESCE((SELECT quantity FROM companion_inventory WHERE wardrobe_id=$1 AND item_id=$2),0)::int AS quantity,
    (SELECT count(*)::int FROM companion_equipment WHERE wardrobe_id=$1 AND item_id=$2 AND slot<>$3) AS used,
    COALESCE((SELECT quantity FROM inventory WHERE character_id=$4 AND item_id=$2),0)::int AS stock`,
    [wardrobeId, itemId, slot, characterId],
  );
  if (row.quantity > row.used) return;
  if (row.stock <= (await allocatedCopies(db, characterId, itemId)))
    throw new AppError(
      409,
      'Transfira uma unidade livre para a mochila deste animal antes de equipar.',
    );
  await db.query(
    `INSERT INTO companion_inventory(wardrobe_id,character_id,item_id,quantity) VALUES($1,$2,$3,1)
    ON CONFLICT(wardrobe_id,item_id) DO UPDATE SET quantity=companion_inventory.quantity+1`,
    [wardrobeId, characterId, itemId],
  );
}
