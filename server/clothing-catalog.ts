import type { PoolClient } from 'pg';
import { clothingBundles, clothingBundle } from '../shared/clothing-bundles.js';

export async function seedClothingPieces(db: PoolClient) {
  for (const bundle of clothingBundles()) {
    const {
      rows: [parent],
    } = await db.query('SELECT * FROM catalog_items WHERE id=$1', [bundle.id]);
    if (!parent) throw Error('Traje não encontrado: ' + bundle.id);
    for (const piece of bundle.pieces) {
      const description = `${piece.name}. Peça cosmética incluída no traje de viajante, equipada separadamente. Sem bônus de CA ou efeito mágico.`;
      const raw = {
        ...(piece.id === bundle.id ? parent.raw_data : {}),
        equipment_target: 'human',
        equipment_slots: [piece.slot],
        piece_slot: piece.slot,
        clothing_bundle_parent: bundle.id,
        clothing_piece_name: piece.name,
        clothing_piece_image: piece.image_path,
        clothing_piece_description: description,
      };
      if (piece.id === bundle.id) {
        // Retain the purchased ID, equipped tunic and full preview/history in the shop.
        await db.query('UPDATE catalog_items SET weight_lb=$2,raw_data=$3 WHERE id=$1', [
          piece.id,
          piece.weight_lb,
          raw,
        ]);
      } else {
        await db.query(
          `INSERT INTO catalog_items(id,name,original_name,category,description,price_cp,weight_lb,source,source_url,raw_data,active,image_path,weight_estimated)
          VALUES($1,$2,$2,'Cosméticos',$3,NULL,$4,$5,$6,$7,false,$8,true)
          ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,original_name=EXCLUDED.original_name,category=EXCLUDED.category,description=EXCLUDED.description,price_cp=NULL,weight_lb=EXCLUDED.weight_lb,source=EXCLUDED.source,source_url=EXCLUDED.source_url,raw_data=EXCLUDED.raw_data,active=false,image_path=EXCLUDED.image_path,weight_estimated=true`,
          [
            piece.id,
            piece.name,
            description,
            piece.weight_lb,
            parent.source,
            parent.source_url,
            raw,
            piece.image_path,
          ],
        );
      }
    }
  }
  const { rows } = await db.query(
    'SELECT * FROM clothing_bundle_backfills WHERE applied_at IS NULL ORDER BY id FOR UPDATE',
  );
  for (const row of rows) {
    const bundle = clothingBundle(row.item_id);
    if (!bundle) throw Error('Snapshot de traje desconhecido: ' + row.item_id);
    for (const piece of bundle.pieces.slice(1)) {
      if (row.character_id)
        await db.query(
          'INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3) ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=inventory.quantity+EXCLUDED.quantity',
          [row.character_id, piece.id, row.quantity],
        );
      else
        await db.query(
          'INSERT INTO account_vault(user_id,item_id,quantity) VALUES($1,$2,$3) ON CONFLICT(user_id,item_id) DO UPDATE SET quantity=account_vault.quantity+EXCLUDED.quantity',
          [row.user_id, piece.id, row.quantity],
        );
    }
    await db.query('UPDATE clothing_bundle_backfills SET applied_at=now() WHERE id=$1', [row.id]);
  }
}
