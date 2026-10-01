import { Router } from 'express';
import { z } from 'zod';
import type { PoolClient } from 'pg';
import { transaction } from './db.js';
import { AppError } from './services.js';
import {
  EQUIPMENT_SLOTS,
  compatibleSlots,
  twoHanded,
  equipmentBlockMessage,
} from '../shared/equipment.js';

const equipSchema = z
  .object({
    character_id: z.string().uuid(),
    slot: z.enum(EQUIPMENT_SLOTS),
    item_id: z.string().min(1).max(100).nullable(),
  })
  .strict();

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
    `SELECT c.*,CASE WHEN c.id='plate-armor' THEN 'Peitoral de placas' ELSE c.name END AS name,i.quantity FROM inventory i JOIN catalog_items c ON c.id=i.item_id
     JOIN characters p ON p.id=i.character_id
     WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL ORDER BY c.name`,
    [characterId, userId],
  );
  const vault = await client.query(
    `SELECT c.*,CASE WHEN c.id='plate-armor' THEN 'Peitoral de placas' ELSE c.name END AS name,v.quantity FROM account_vault v JOIN catalog_items c ON c.id=v.item_id
     WHERE v.user_id=$1 ORDER BY c.name`,
    [userId],
  );
  const equipped = await client.query(
    `SELECT c.*,CASE WHEN c.id='plate-armor' THEN 'Peitoral de placas' ELSE c.name END AS name,e.slot FROM character_equipment e JOIN catalog_items c ON c.id=e.item_id
     JOIN characters p ON p.id=e.character_id WHERE p.id=$1 AND p.user_id=$2 AND p.deleted_at IS NULL ORDER BY e.slot`,
    [characterId, userId],
  );
  return { inventory: inventory.rows, vault: vault.rows, equipped: equipped.rows };
}

export function inventoryRouter() {
  const router = Router();
  router.post('/inventory/equipment', async (req, res) => {
    const data = equipSchema.parse(req.body),
      userId = res.locals.user.id;
    res.json(
      await transaction(async (client) => {
        await lockStorage(client, userId, data.character_id);
        if (data.item_id === null) {
          await client.query('DELETE FROM character_equipment WHERE character_id=$1 AND slot=$2', [
            data.character_id,
            data.slot,
          ]);
          return storageState(client, userId, data.character_id);
        }
        const {
          rows: [item],
        } = await client.query(
          'SELECT c.*,i.quantity FROM inventory i JOIN catalog_items c ON c.id=i.item_id WHERE i.character_id=$1 AND i.item_id=$2 FOR UPDATE OF i',
          [data.character_id, data.item_id],
        );
        if (!item) throw new AppError(409, 'Este item não está na mochila deste personagem.');
        if (!compatibleSlots(item).includes(data.slot))
          throw new AppError(400, 'Este item não pode ser equipado nessa posição.');
        const {
          rows: [used],
        } = await client.query(
          'SELECT count(*)::int AS total FROM character_equipment WHERE character_id=$1 AND item_id=$2 AND slot<>$3',
          [data.character_id, data.item_id, data.slot],
        );
        if (used.total >= item.quantity)
          throw new AppError(409, 'Todas as unidades deste item já estão equipadas.');
        const { rows: equipped } = await client.query(
          'SELECT c.*,e.slot FROM character_equipment e JOIN catalog_items c ON c.id=e.item_id WHERE e.character_id=$1',
          [data.character_id],
        );
        const blocked = equipmentBlockMessage(data.slot, equipped);
        if (blocked) throw new AppError(409, blocked);
        if (data.slot === 'bracers' && item.id === 'plate-bracers')
          await client.query('DELETE FROM character_equipment WHERE character_id=$1 AND slot=$2', [
            data.character_id,
            'hands',
          ]);
        if (data.slot === 'main_hand' && twoHanded(item))
          await client.query('DELETE FROM character_equipment WHERE character_id=$1 AND slot=$2', [
            data.character_id,
            'off_hand',
          ]);
        await client.query(
          `INSERT INTO character_equipment(character_id,slot,item_id) VALUES($1,$2,$3)
        ON CONFLICT(character_id,slot) DO UPDATE SET item_id=excluded.item_id,equipped_at=now()`,
          [data.character_id, data.slot, data.item_id],
        );
        return storageState(client, userId, data.character_id);
      }),
    );
  });
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
      if (data.direction === 'to_vault') {
        const {
          rows: [used],
        } = await client.query(
          'SELECT count(*)::int AS total FROM character_equipment WHERE character_id=$1 AND item_id=$2',
          [data.character_id, data.item_id],
        );
        if (stock.quantity - used.total < data.quantity)
          throw new AppError(409, 'Desequipe o item antes de guardá-lo no cofre.');
      }
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
