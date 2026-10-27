import type { PoolClient } from 'pg';
import { startingEquipment, type SheetChoices } from '../shared/character-sheet.js';
import catalogMap from '../shared/starting-equipment-items.json';
import { AppError } from './services.js';

// Caller holds the character lock and runs inside a transaction.
export async function grantCharacterStartingItems(db: PoolClient, characterId: string) {
  if (
    (
      await db.query('SELECT 1 FROM character_starting_item_grants WHERE character_id=$1', [
        characterId,
      ])
    ).rowCount
  )
    return false;
  const row = (
    await db.query(
      'SELECT c.class,s.choices,s.finalized_at FROM characters c JOIN character_sheets s ON s.character_id=c.id WHERE c.id=$1 AND c.deleted_at IS NULL',
      [characterId],
    )
  ).rows[0];
  if (!row?.finalized_at || row.choices?.version !== 2) return false;
  const labels = startingEquipment(row.class, row.choices as SheetChoices),
    quantities = new Map<string, number>();
  for (const label of labels) {
    const item = (catalogMap as Record<string, { id: string; quantity: number }>)[label];
    if (!item)
      throw new AppError(
        409,
        `O equipamento inicial “${label}” precisa ser vinculado ao catálogo.`,
      );
    quantities.set(item.id, (quantities.get(item.id) || 0) + item.quantity);
  }
  const items = [...quantities].map(([item_id, quantity]) => ({ item_id, quantity }));
  const known = (
    await db.query('SELECT id FROM catalog_items WHERE id=ANY($1::text[])', [
      [...quantities.keys()],
    ])
  ).rows;
  if (known.length !== quantities.size)
    throw new AppError(409, 'O catálogo do equipamento inicial está incompleto.');
  const claim = await db.query(
    'INSERT INTO character_starting_item_grants(character_id,source_labels,items)VALUES($1,$2,$3)ON CONFLICT DO NOTHING RETURNING character_id',
    [characterId, JSON.stringify(labels), JSON.stringify(items)],
  );
  if (!claim.rowCount) return false;
  for (const { item_id, quantity } of items)
    await db.query(
      'INSERT INTO inventory(character_id,item_id,quantity)VALUES($1,$2,$3)ON CONFLICT(character_id,item_id)DO UPDATE SET quantity=inventory.quantity+excluded.quantity',
      [characterId, item_id, quantity],
    );
  return true;
}
