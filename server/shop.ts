import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { transaction } from './db.js';
import { AppError } from './services.js';

export function shopRouter() {
  const router = Router();
  router.post('/shop/checkout', async (req, res) => {
    const data = z
      .object({
        character_id: z.string().uuid(),
        idempotency_key: z.string().uuid(),
        items: z
          .array(
            z.object({
              item_id: z.string().min(1).max(100),
              quantity: z.number().int().min(1).max(99),
            }),
          )
          .min(1)
          .max(65)
          .refine(
            (items) => new Set(items.map((i) => i.item_id)).size === items.length,
            'Item repetido no carrinho.',
          ),
      })
      .parse(req.body);
    const lines = [...data.items].sort((a, b) => a.item_id.localeCompare(b.item_id));
    const result = await transaction(async (client) => {
      const {
        rows: [character],
      } = await client.query(
        'SELECT id,gold_cp FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [data.character_id, res.locals.user.id],
      );
      if (!character) throw new AppError(404, 'Personagem não encontrado.');
      const {
        rows: [previous],
      } = await client.query(
        'SELECT * FROM shop_checkouts WHERE character_id=$1 AND idempotency_key=$2',
        [character.id, data.idempotency_key],
      );
      if (previous) {
        if (JSON.stringify(previous.lines) !== JSON.stringify(lines)) {
          // JSONB can reorder object keys; compare the canonical values instead.
          if (
            previous.lines.length !== lines.length ||
            previous.lines.some(
              (v: { item_id: string; quantity: number }, i: number) =>
                v.item_id !== lines[i].item_id || v.quantity !== lines[i].quantity,
            )
          )
            throw new AppError(409, 'Esta chave já foi usada para outro carrinho.');
        }
        return {
          id: previous.id,
          total_cp: Number(previous.total_cp),
          gold_cp: character.gold_cp,
          replayed: true,
        };
      }
      const { rows: items } = await client.query(
        'SELECT id,price_cp FROM catalog_items WHERE id=ANY($1::text[]) AND active=true ORDER BY id FOR SHARE',
        [lines.map((i) => i.item_id)],
      );
      if (items.length !== lines.length)
        throw new AppError(409, 'Um dos itens não está mais disponível.');
      const prices = new Map(items.map((i) => [i.id, i.price_cp as number | null]));
      if (items.some((i) => i.price_cp === null))
        throw new AppError(409, 'Remova do carrinho os itens sem preço definido.');
      const total = lines.reduce((sum, i) => sum + prices.get(i.item_id)! * i.quantity, 0);
      if (character.gold_cp < total)
        throw new AppError(409, 'Ouro insuficiente para finalizar o carrinho.');
      const {
        rows: [order],
      } = await client.query(
        'INSERT INTO shop_checkouts(character_id,idempotency_key,lines,total_cp) VALUES($1,$2,$3,$4) RETURNING id',
        [character.id, data.idempotency_key, JSON.stringify(lines), total],
      );
      await client.query('UPDATE characters SET gold_cp=gold_cp-$2 WHERE id=$1', [
        character.id,
        total,
      ]);
      for (const line of lines) {
        await client.query(
          'INSERT INTO inventory(character_id,item_id,quantity) VALUES($1,$2,$3) ON CONFLICT(character_id,item_id) DO UPDATE SET quantity=inventory.quantity+excluded.quantity',
          [character.id, line.item_id, line.quantity],
        );
        await client.query(
          'INSERT INTO purchases(character_id,item_id,quantity,total_cp,idempotency_key,checkout_id) VALUES($1,$2,$3,$4,$5,$6)',
          [
            character.id,
            line.item_id,
            line.quantity,
            prices.get(line.item_id)! * line.quantity,
            randomUUID(),
            order.id,
          ],
        );
      }
      await client.query(
        "INSERT INTO achievements(character_id,code) VALUES($1,'first_purchase') ON CONFLICT DO NOTHING",
        [character.id],
      );
      return { id: order.id, total_cp: total, gold_cp: character.gold_cp - total, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  });
  return router;
}
