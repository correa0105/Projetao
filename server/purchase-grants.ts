import type { PoolClient } from 'pg';
import { purchaseContents } from '../shared/armor-bundles.js';

export async function grantPurchaseItems(
  client: PoolClient,
  characterId: string,
  itemId: string,
  quantity: number,
  purchaseId: string,
) {
  for (const grantedId of purchaseContents(itemId)) {
    await client.query(
      'INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3) ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=inventory.quantity+excluded.quantity',
      [characterId, grantedId, quantity],
    );
    await client.query(
      'INSERT INTO purchase_item_grants(purchase_id,item_id,quantity) VALUES($1,$2,$3)',
      [purchaseId, grantedId, quantity],
    );
  }
}
