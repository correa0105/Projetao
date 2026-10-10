import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AppError } from './services.js';
import { selectedBoundSpell, spellBindingSpec } from '../shared/shop-spell-bindings.js';

/** Separate inventory IDs keep different fixed spells distinct through storage/equipment. */
export async function configuredShopItem(
  client: PoolClient,
  item: any,
  spellId?: string,
): Promise<string> {
  if (!item.raw_data?.spell_binding) {
    if (spellId) throw new AppError(400, 'Este item não permite escolher uma magia vinculada.');
    return item.id;
  }
  const spec = spellBindingSpec(item);
  if (!spec) throw new AppError(503, 'As opções deste item estão temporariamente indisponíveis.');
  if (!spellId) throw new AppError(409, 'Escolha a magia vinculada antes de comprar este item.');
  const spell = selectedBoundSpell(item, spellId);
  if (!spell)
    throw new AppError(
      400,
      'A magia escolhida não pertence ao nível e às escolas permitidos para este item.',
    );
  const id =
    'configured-' +
    createHash('sha256')
      .update(JSON.stringify(['bound-spell-v1', item.id, spell.id]))
      .digest('hex')
      .slice(0, 32);
  const raw = { ...item.raw_data, configuration_origin: item.id, bound_spell: spell };
  delete raw.spell_binding;
  raw.rules_summary =
    item.raw_data.rules_summary +
    ' Magia fixa deste exemplar: ' +
    spell.label +
    ' (' +
    spell.name +
    '; ' +
    spell.book +
    (spell.page ? ', p. ' + spell.page : '') +
    '). A compra não permite trocar essa magia depois.';
  const name = item.name + ' · ' + spell.label;
  await client.query(
    `INSERT INTO catalog_items(id,name,original_name,category,description,price_cp,weight_lb,source,source_url,raw_data,image_path,audio_path,merchant_comment,weight_estimated,active)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,false) ON CONFLICT(id) DO NOTHING`,
    [
      id,
      name,
      item.original_name + ' (' + spell.name + ')',
      item.category,
      item.description + ' Magia vinculada: ' + spell.label + '.',
      item.price_cp,
      item.weight_lb,
      item.source,
      item.source_url,
      JSON.stringify(raw),
      item.image_path,
      item.audio_path,
      item.merchant_comment,
      item.weight_estimated,
    ],
  );
  const {
    rows: [existing],
  } = await client.query('SELECT raw_data FROM catalog_items WHERE id=$1', [id]);
  if (
    existing?.raw_data?.configuration_origin !== item.id ||
    existing?.raw_data?.bound_spell?.id !== spell.id
  )
    throw new AppError(409, 'A configuração deste item precisa ser revisada.');
  return id;
}
