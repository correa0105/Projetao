import type { PoolClient } from 'pg';
import {
  armorBundles,
  armorBundle,
  ARMOR_PIECE_NAMES,
  ANIMAL_PIECE_NAMES,
} from '../shared/armor-bundles.js';
import { equipmentTarget } from '../shared/equipment-target.js';

export async function seedArmorPieces(db: PoolClient) {
  // Explicit taxonomy for known saddles/ferraduras/alforjes and animal catalog
  // rows, including older catalog data that did not yet carry target metadata.
  const { rows: catalog } = await db.query('SELECT id,category,raw_data FROM catalog_items');
  for (const item of catalog) {
    const target = equipmentTarget(item);
    if (target !== 'human' && !item.raw_data?.equipment_target)
      await db.query(
        "UPDATE catalog_items SET raw_data=raw_data || jsonb_build_object('equipment_target',$2::text) WHERE id=$1",
        [item.id, target],
      );
  }
  for (const bundle of armorBundles()) {
    const {
      rows: [parent],
    } = await db.query('SELECT * FROM catalog_items WHERE id=$1', [bundle.id]);
    if (!parent) throw Error('Armadura do conjunto não encontrada: ' + bundle.id);
    const names = bundle.target === 'human' ? ARMOR_PIECE_NAMES : ANIMAL_PIECE_NAMES;
    const raw = {
      ...parent.raw_data,
      equipment_target: bundle.target,
      armor_bundle_parent: bundle.id,
      armor_bundle_pieces: bundle.pieces.map(({ id, slot }) => ({ id, slot })),
      armor_bundle_weight_lb: bundle.weight_lb,
      armor_bundle_model_image: parent.image_path,
      armor_bundle_name: parent.name,
      piece_slot: 'armor',
      equipment_slots: ['armor'],
      armor_piece_name:
        bundle.id === 'plate-armor' ? 'Peitoral de placas' : `${names.armor} — ${parent.name}`,
    };
    await db.query('UPDATE catalog_items SET weight_lb=$2,raw_data=$3 WHERE id=$1', [
      bundle.id,
      bundle.pieces[0].weight_lb,
      raw,
    ]);
    for (const piece of bundle.pieces.slice(1)) {
      const pieceRaw = {
        equipment_target: bundle.target,
        armor_bundle_parent: bundle.id,
        piece_slot: piece.slot,
        equipment_slots: [piece.slot],
        armor_bundle_model_image: parent.image_path,
        armor_bundle_name: parent.name,
        armor_piece_name: `${names[piece.slot]} — ${parent.name}`,
      };
      if (bundle.id === 'plate-armor') {
        // Keep the existing artwork, IDs, names, and fullplate glove behavior.
        await db.query(
          'UPDATE catalog_items SET weight_lb=$2,raw_data=raw_data || $3::jsonb,active=false,price_cp=NULL WHERE id=$1',
          [piece.id, piece.weight_lb, pieceRaw],
        );
        continue;
      }
      const icon =
        bundle.target === 'human'
          ? `/shop/equipment/armor-piece-${piece.slot}.svg`
          : `/shop/animal-equipment/armor-piece-${bundle.target}-${piece.slot}.svg`;
      await db.query(
        `INSERT INTO catalog_items(id,name,original_name,category,description,price_cp,weight_lb,source,source_url,raw_data,active,image_path,weight_estimated)
         VALUES($1,$2,$2,$3,$4,NULL,$5,$6,$7,$8,false,$9,true)
         ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name,original_name=EXCLUDED.original_name,category=EXCLUDED.category,description=EXCLUDED.description,price_cp=NULL,weight_lb=EXCLUDED.weight_lb,source=EXCLUDED.source,source_url=EXCLUDED.source_url,raw_data=EXCLUDED.raw_data,active=false,image_path=EXCLUDED.image_path,weight_estimated=true`,
        [
          piece.id,
          pieceRaw.armor_piece_name,
          bundle.target === 'human'
            ? 'Peças de armadura'
            : bundle.target === 'mount'
              ? 'Equipamento de montaria'
              : 'Acessórios para pet',
          `Parte visual do conjunto ${parent.name}. Incluída na compra do conjunto; não adiciona estatísticas ou efeitos independentes.`,
          piece.weight_lb,
          parent.source,
          parent.source_url,
          pieceRaw,
          icon,
        ],
      );
    }
  }
  const { rows: snapshots } = await db.query(
    'SELECT * FROM armor_bundle_backfills WHERE applied_at IS NULL ORDER BY id FOR UPDATE',
  );
  for (const row of snapshots) {
    const bundle = armorBundle(row.item_id);
    if (!bundle) throw Error('Snapshot de armadura sem conjunto: ' + row.item_id);
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
    await db.query('UPDATE armor_bundle_backfills SET applied_at=now() WHERE id=$1', [row.id]);
  }
  const released = await db.query(
    `DELETE FROM companion_equipment e USING catalog_items c,companion_wardrobes w
     WHERE e.item_id=c.id AND e.wardrobe_id=w.id AND COALESCE(c.raw_data->>'equipment_target','human')<>w.kind
     RETURNING e.wardrobe_id`,
  );
  if (released.rowCount)
    await db.query('UPDATE companion_wardrobes SET revision=revision+1 WHERE id=ANY($1::uuid[])', [
      [...new Set(released.rows.map((row) => row.wardrobe_id))],
    ]);
}
