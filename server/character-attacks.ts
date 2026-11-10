import type { PoolClient } from 'pg';
import { equippedAttacks, type CombatItem } from '../shared/equipped-attacks.js';
import type { SheetChoices } from '../shared/character-sheet.js';
import { prestigeSkinArt } from '../shared/prestige-weapons.js';
export async function readCharacterLoadout(
  db: Pick<PoolClient, 'query'>,
  character: { id: string; race: string; class: string; stats: number[]; level?: number },
  choices?: SheetChoices | null,
) {
  const { rows } = await db.query(
    `SELECT c.id,c.name,c.description,c.weight_lb,COALESCE(s.snapshot->>'image_path',c.image_path) AS image_path,c.raw_data,i.quantity,
   ARRAY(SELECT e.slot FROM character_equipment e WHERE e.character_id=i.character_id AND e.item_id=i.item_id) AS equipped
   FROM inventory i JOIN catalog_items c ON c.id=i.item_id
   JOIN characters p ON p.id=i.character_id
   LEFT JOIN prestige_weapon_skins k ON k.character_id=i.character_id AND k.item_id=i.item_id
   LEFT JOIN special_shop_purchases s ON s.id=k.purchase_id AND s.user_id=p.user_id
   WHERE i.character_id=$1 AND i.quantity>0 ORDER BY c.name`,
    [character.id],
  );
  const inventory = rows.map((item) => ({ ...item, image_path: prestigeSkinArt(item.image_path) })) as CombatItem[];
  return { inventory, attacks: equippedAttacks(character, choices, inventory) };
}
