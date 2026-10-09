import type { PoolClient } from 'pg';
import { equippedAttacks, type CombatItem } from '../shared/equipped-attacks.js';
import type { SheetChoices } from '../shared/character-sheet.js';
export async function readCharacterLoadout(
  db: Pick<PoolClient, 'query'>,
  character: { id: string; race: string; class: string; stats: number[] },
  choices?: SheetChoices | null,
) {
  const { rows } = await db.query(
    `SELECT c.id,c.name,c.description,c.weight_lb,c.image_path,c.raw_data,i.quantity,
   ARRAY(SELECT e.slot FROM character_equipment e WHERE e.character_id=i.character_id AND e.item_id=i.item_id) AS equipped
   FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND i.quantity>0 ORDER BY c.name`,
    [character.id],
  );
  return { inventory: rows, attacks: equippedAttacks(character, choices, rows as CombatItem[]) };
}
