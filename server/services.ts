import { transaction } from './db.js';

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function purchase(
  userId: string,
  characterId: string,
  itemId: string,
  quantity: number,
  key: string,
) {
  return transaction(async (client) => {
    // Serialize all spending for a character; ownership is checked inside the transaction.
    const {
      rows: [character],
    } = await client.query(
      'SELECT id,gold_cp FROM characters WHERE id=$1 AND user_id=$2 FOR UPDATE',
      [characterId, userId],
    );
    if (!character) throw new AppError(404, 'Personagem não encontrado.');
    const {
      rows: [previous],
    } = await client.query('SELECT * FROM purchases WHERE character_id=$1 AND idempotency_key=$2', [
      characterId,
      key,
    ]);
    if (previous) {
      if (previous.item_id !== itemId || previous.quantity !== quantity)
        throw new AppError(409, 'Esta chave de compra já foi usada para outro pedido.');
      return { purchase: previous, gold_cp: character.gold_cp, replayed: true };
    }
    const {
      rows: [item],
    } = await client.query('SELECT * FROM catalog_items WHERE id=$1 AND active=true FOR SHARE', [
      itemId,
    ]);
    if (!item) throw new AppError(404, 'Item indisponível.');
    const total = item.price_cp * quantity;
    if (character.gold_cp < total) throw new AppError(409, 'Ouro insuficiente para esta compra.');
    const {
      rows: [updated],
    } = await client.query(
      'UPDATE characters SET gold_cp=gold_cp-$1 WHERE id=$2 RETURNING gold_cp',
      [total, characterId],
    );
    await client.query(
      `INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3)
      ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=inventory.quantity+excluded.quantity`,
      [characterId, itemId, quantity],
    );
    const {
      rows: [order],
    } = await client.query(
      'INSERT INTO purchases(character_id,item_id,quantity,total_cp,idempotency_key) VALUES($1,$2,$3,$4,$5) RETURNING *',
      [characterId, itemId, quantity, total, key],
    );
    await client.query(
      "INSERT INTO achievements(character_id,code) VALUES($1,'first_purchase') ON CONFLICT DO NOTHING",
      [characterId],
    );
    return { purchase: order, gold_cp: updated.gold_cp, replayed: false };
  });
}
