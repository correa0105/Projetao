import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { transaction } from './db.js';
import { AppError } from './services.js';

const uuid = z.string().uuid();
const transferSchema = z
  .object({
    character_id: uuid,
    item_id: z.string().min(1).max(100),
    direction: z.enum(['to_vault', 'to_backpack']),
    quantity: z.number().int().min(1).max(2147483647),
    idempotency_key: uuid,
  })
  .strict();

async function lockStorage(client: PoolClient, userId: string, characterId: string) {
  // Same lock order as character deletion: account, then character. Purchases lock character.
  await client.query('SELECT id FROM "user" WHERE id=$1 FOR UPDATE', [userId]);
  const owned = await client.query(
    'SELECT id FROM characters WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL FOR UPDATE',
    [characterId, userId],
  );
  if (!owned.rowCount) throw new AppError(404, 'Personagem não encontrado.');
}

async function storageState(client: PoolClient, userId: string, characterId: string) {
  const inventory = await client.query(
    `SELECT c.*,i.quantity FROM inventory i JOIN catalog_items c ON c.id=i.item_id
     JOIN characters p ON p.id=i.character_id
     WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL ORDER BY c.name`,
    [characterId, userId],
  );
  const vault = await client.query(
    `SELECT c.*,v.quantity FROM account_vault v JOIN catalog_items c ON c.id=v.item_id
     WHERE v.user_id=$1 ORDER BY c.name`,
    [userId],
  );
  return { inventory: inventory.rows, vault: vault.rows };
}

export function inventoryRouter() {
  const router = Router();
  router.get('/characters/:id/storage', async (req, res) => {
    const id = uuid.parse(req.params.id),
      userId = res.locals.user.id;
    res.json(
      await transaction(async (client) => {
        await lockStorage(client, userId, id);
        return storageState(client, userId, id);
      }),
    );
  });
  router.post('/inventory/transfers', async (req, res) => {
    const data = transferSchema.parse(req.body),
      userId = res.locals.user.id;
    const result = await transaction(async (client) => {
      await lockStorage(client, userId, data.character_id);
      const {
        rows: [previous],
      } = await client.query(
        'SELECT * FROM inventory_transfers WHERE user_id=$1 AND idempotency_key=$2',
        [userId, data.idempotency_key],
      );
      if (previous) {
        if (
          previous.character_id !== data.character_id ||
          previous.item_id !== data.item_id ||
          previous.direction !== data.direction ||
          previous.quantity !== data.quantity
        )
          throw new AppError(409, 'Esta transferência já foi usada para outro pedido.');
        return { ...(await storageState(client, userId, data.character_id)), replayed: true };
      }
      // Table and owner column come only from this closed server-side mapping.
      const bag = { table: 'inventory', column: 'character_id', owner: data.character_id };
      const vault = { table: 'account_vault', column: 'user_id', owner: userId };
      const [source, target] = data.direction === 'to_vault' ? [bag, vault] : [vault, bag];
      const {
        rows: [stock],
      } = await client.query(
        `SELECT quantity FROM ${source.table} WHERE ${source.column}=$1 AND item_id=$2 FOR UPDATE`,
        [source.owner, data.item_id],
      );
      if (!stock || stock.quantity < data.quantity)
        throw new AppError(
          409,
          'Quantidade indisponível. Atualize o inventário e tente novamente.',
        );
      const {
        rows: [destination],
      } = await client.query(
        `SELECT quantity FROM ${target.table} WHERE ${target.column}=$1 AND item_id=$2 FOR UPDATE`,
        [target.owner, data.item_id],
      );
      if ((destination?.quantity ?? 0) + data.quantity > 2147483647)
        throw new AppError(409, 'O destino não comporta essa quantidade.');
      if (stock.quantity === data.quantity) {
        await client.query(`DELETE FROM ${source.table} WHERE ${source.column}=$1 AND item_id=$2`, [
          source.owner,
          data.item_id,
        ]);
      } else {
        await client.query(
          `UPDATE ${source.table} SET quantity=quantity-$3 WHERE ${source.column}=$1 AND item_id=$2`,
          [source.owner, data.item_id, data.quantity],
        );
      }
      await client.query(
        `INSERT INTO ${target.table}(${target.column},item_id,quantity) VALUES($1,$2,$3)
         ON CONFLICT(${target.column},item_id) DO UPDATE SET quantity=${target.table}.quantity+excluded.quantity`,
        [target.owner, data.item_id, data.quantity],
      );
      await client.query(
        `INSERT INTO inventory_transfers(user_id,character_id,item_id,direction,quantity,idempotency_key)
         VALUES($1,$2,$3,$4,$5,$6)`,
        [
          userId,
          data.character_id,
          data.item_id,
          data.direction,
          data.quantity,
          data.idempotency_key,
        ],
      );
      return { ...(await storageState(client, userId, data.character_id)), replayed: false };
    });
    res.status(result.replayed ? 200 : 201).json(result);
  });
  return router;
}
