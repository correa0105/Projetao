import { Router } from 'express';
import { z } from 'zod';
import { pool, transaction } from './db.js';
import { cards } from '../shared/cards.js';
import { AppError } from './services.js';
import { currentGoldUnlimited, spendGold } from './gold.js';
const uuid = z.string().uuid();
export function cardsRouter() {
  const router = Router();
  router.get('/cards/:characterId', async (req, res) => {
    const id = uuid.parse(req.params.characterId);
    if (
      !(
        await pool.query(
          'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL',
          [id, res.locals.user.id],
        )
      ).rowCount
    )
      throw new AppError(404, 'Personagem não encontrado.');
    res.json(
      (
        await pool.query(
          'SELECT id,card_id,level,slot,price_cp,created_at FROM character_cards WHERE character_id=$1 ORDER BY created_at,id',
          [id],
        )
      ).rows,
    );
  });
  router.post('/cards/purchase', async (req, res) => {
    const d = z
        .object({ character_id: uuid, card_id: z.string().max(40), idempotency_key: uuid })
        .strict()
        .parse(req.body),
      card = cards.find((c) => c.id === d.card_id);
    if (!card?.buyable)
      throw new AppError(400, 'Esta carta ainda não está disponível para compra.');
    const result = await transaction(async (client) => {
      const gold_unlimited = await currentGoldUnlimited(client, res.locals.user.id);
      const {
        rows: [character],
      } = await client.query(
        'SELECT id,gold_cp FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
        [d.character_id, res.locals.user.id],
      );
      if (!character) throw new AppError(404, 'Personagem não encontrado.');
      const {
        rows: [previous],
      } = await client.query(
        'SELECT id,card_id,level,slot,price_cp,created_at FROM character_cards WHERE character_id=$1 AND idempotency_key=$2',
        [character.id, d.idempotency_key],
      );
      if (previous) {
        if (previous.card_id !== card.id)
          throw new AppError(409, 'Esta compra já foi registrada com outra carta.');
        return { card: previous, gold_cp: character.gold_cp, gold_unlimited, replayed: true };
      }
      if (
        (
          await client.query('SELECT 1 FROM character_cards WHERE character_id=$1 AND card_id=$2', [
            character.id,
            card.id,
          ])
        ).rowCount
      )
        throw new AppError(409, 'Este personagem já possui esta carta.');
      const gold_cp = await spendGold(
        client,
        character,
        card.price_cp,
        gold_unlimited,
        'Ouro insuficiente para comprar esta carta.',
      );
      const {
        rows: [owned],
      } = await client.query(
        'INSERT INTO character_cards(character_id,card_id,price_cp,idempotency_key)VALUES($1,$2,$3,$4)RETURNING id,card_id,level,slot,price_cp,created_at',
        [character.id, card.id, card.price_cp, d.idempotency_key],
      );
      return { card: owned, gold_cp, gold_unlimited, replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  });
  router.put('/cards/:characterId/equipment', async (req, res) => {
    const id = uuid.parse(req.params.characterId),
      d = z
        .object({ slots: z.array(uuid.nullable()).length(3) })
        .strict()
        .refine(
          (d) => new Set(d.slots.filter(Boolean)).size === d.slots.filter(Boolean).length,
          'Não equipe a mesma carta duas vezes.',
        )
        .parse(req.body);
    await transaction(async (client) => {
      if (
        !(
          await client.query(
            'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
            [id, res.locals.user.id],
          )
        ).rowCount
      )
        throw new AppError(404, 'Personagem não encontrado.');
      const ids = d.slots.filter(Boolean);
      if (
        (
          await client.query(
            'SELECT id FROM character_cards WHERE character_id=$1 AND id=ANY($2::uuid[])',
            [id, ids],
          )
        ).rowCount !== ids.length
      )
        throw new AppError(403, 'Equipe apenas cartas deste personagem.');
      await client.query('UPDATE character_cards SET slot=NULL WHERE character_id=$1', [id]);
      for (let i = 0; i < 3; i++)
        if (d.slots[i])
          await client.query('UPDATE character_cards SET slot=$2 WHERE id=$1', [d.slots[i], i + 1]);
    });
    res.json({ ok: true });
  });
  return router;
}
