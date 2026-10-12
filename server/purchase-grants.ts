import type { PoolClient } from 'pg';
import { purchaseContents } from '../shared/armor-bundles.js';
import { purchaseCompanionBag } from './companion-purchase-delivery.js';

export async function grantPurchaseItems(
  client: PoolClient,
  characterId: string,
  itemId: string,
  quantity: number,
  purchaseId: string,
  companionId?: string,
) {
  const { rows: [item] } = await client.query('SELECT id,category,raw_data FROM catalog_items WHERE id=$1', [itemId]);
  const wardrobeId = await purchaseCompanionBag(client, characterId, item, companionId);
  for (const grantedId of purchaseContents(itemId)) {
    await client.query(
      'INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3) ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=inventory.quantity+excluded.quantity',
      [characterId, grantedId, quantity],
    );
    await client.query(
      'INSERT INTO purchase_item_grants(purchase_id,item_id,quantity) VALUES($1,$2,$3)',
      [purchaseId, grantedId, quantity],
    );
    if (wardrobeId) await client.query(
      `INSERT INTO companion_inventory(wardrobe_id,character_id,item_id,quantity) VALUES($1,$2,$3,$4)
       ON CONFLICT(wardrobe_id,item_id) DO UPDATE SET quantity=companion_inventory.quantity+excluded.quantity`,
      [wardrobeId, characterId, grantedId, quantity],
    );
  }
}
